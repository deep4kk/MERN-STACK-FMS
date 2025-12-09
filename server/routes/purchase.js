import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getPurchaseDashboardData, fetchIndentRecords } from '../services/googleSheetsService.js';
import ChecklistTemplate from '../models/ChecklistTemplate.js';
import ChecklistOccurrence from '../models/ChecklistOccurrence.js';
import User from '../models/User.js';

const router = express.Router();

// Cache for dashboard data (refresh every 5 minutes)
let dashboardCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/purchase/dashboard
 * Get all purchase dashboard data including indent metrics and recent indents
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const now = Date.now();
    
    // Check if we have valid cached data
    if (dashboardCache && (now - cacheTimestamp) < CACHE_DURATION) {
      return res.json(dashboardCache);
    }
    
    // Fetch fresh data from Google Sheets
    const dashboardData = await getPurchaseDashboardData();
    
    // Update cache
    dashboardCache = dashboardData;
    cacheTimestamp = now;
    
    res.json(dashboardData);
  } catch (error) {
    console.error('Purchase dashboard error:', error);
    
    // If we have cached data, return it even if expired (better than nothing)
    if (dashboardCache) {
      return res.json({
        ...dashboardCache,
        cached: true,
        cacheAge: Math.round((Date.now() - cacheTimestamp) / 1000)
      });
    }
    
    // Return fallback data if Google Sheets is unavailable
    res.status(500).json({
      success: false,
      message: 'Unable to fetch data from Google Sheets',
      error: error.message,
      fallback: true,
      metrics: {
        totalIndents: 0,
        approved: 0,
        pending: 0,
        fullyIssued: 0,
        partiallyIssued: 0,
        urgentCount: 0,
        normalCount: 0
      },
      storeStats: [],
      recentIndents: [],
      allIndents: []
    });
  }
});

/**
 * GET /api/purchase/indents
 * Get all indent records with optional filtering
 */
router.get('/indents', authenticateToken, async (req, res) => {
  try {
    const { store, status, nature, search, page = 1, limit = 50 } = req.query;
    
    let { records } = await fetchIndentRecords();
    
    // Apply filters
    if (store) {
      records = records.filter(r => r.storeName.toLowerCase().includes(store.toLowerCase()));
    }
    
    if (status) {
      records = records.filter(r => r.status.toLowerCase() === status.toLowerCase());
    }
    
    if (nature) {
      records = records.filter(r => r.nature.toLowerCase() === nature.toLowerCase());
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      records = records.filter(r => 
        r.indentNumber.toLowerCase().includes(searchLower) ||
        r.itemName.toLowerCase().includes(searchLower) ||
        r.issuedTo.toLowerCase().includes(searchLower) ||
        r.projectName.toLowerCase().includes(searchLower)
      );
    }
    
    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedRecords = records.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      total: records.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(records.length / parseInt(limit)),
      records: paginatedRecords
    });
  } catch (error) {
    console.error('Fetch indents error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch indent records',
      error: error.message
    });
  }
});

/**
 * GET /api/purchase/indent/:indentNumber
 * Get a specific indent by indent number
 */
router.get('/indent/:indentNumber', authenticateToken, async (req, res) => {
  try {
    const { indentNumber } = req.params;
    const { records } = await fetchIndentRecords();
    
    const indent = records.find(r => r.indentNumber === indentNumber);
    
    if (!indent) {
      return res.status(404).json({
        success: false,
        message: 'Indent not found'
      });
    }
    
    res.json({
      success: true,
      indent
    });
  } catch (error) {
    console.error('Fetch indent error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch indent',
      error: error.message
    });
  }
});

/**
 * POST /api/purchase/refresh
 * Force refresh the dashboard cache
 */
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    // Clear cache
    dashboardCache = null;
    cacheTimestamp = 0;
    
    // Fetch fresh data
    const dashboardData = await getPurchaseDashboardData();
    
    // Update cache
    dashboardCache = dashboardData;
    cacheTimestamp = Date.now();
    
    res.json({
      success: true,
      message: 'Dashboard data refreshed',
      data: dashboardData
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to refresh data',
      error: error.message
    });
  }
});

/**
 * GET /api/purchase/checklists-by-person
 * Get all checklists grouped by person with frequency information (ALL TIME)
 */
router.get('/checklists-by-person', authenticateToken, async (req, res) => {
  try {
    // Get all active checklist templates with their assigned users
    const templates = await ChecklistTemplate.find({ status: 'active' })
      .populate('assignedTo', 'username email department')
      .populate('createdBy', 'username')
      .lean();

    // Get all checklist occurrences to count actual instances (ALL TIME)
    const occurrences = await ChecklistOccurrence.find({})
      .populate('templateId', 'name frequency')
      .populate('assignedTo', 'username email department')
      .lean();

    // Group templates by assigned person
    const personMap = new Map();

    templates.forEach(template => {
      if (!template.assignedTo) return;
      
      const userId = template.assignedTo._id.toString();
      const username = template.assignedTo.username || 'Unknown';
      const email = template.assignedTo.email || '';

      if (!personMap.has(userId)) {
        personMap.set(userId, {
          userId,
          username,
          email,
          department: template.assignedTo.department || 'General',
          checklists: []
        });
      }

      // Count occurrences for this template
      const occurrenceCount = occurrences.filter(
        occ => occ.templateId && occ.templateId._id.toString() === template._id.toString()
      ).length;

      // Count pending occurrences
      const pendingCount = occurrences.filter(
        occ => occ.templateId && 
               occ.templateId._id.toString() === template._id.toString() &&
               occ.status === 'pending'
      ).length;

      // Count completed occurrences
      const completedCount = occurrences.filter(
        occ => occ.templateId && 
               occ.templateId._id.toString() === template._id.toString() &&
               occ.status === 'completed'
      ).length;

      personMap.get(userId).checklists.push({
        templateId: template._id.toString(),
        name: template.name,
        category: template.category || 'General',
        frequency: template.frequency,
        itemCount: template.items?.length || 0,
        totalOccurrences: occurrenceCount,
        pendingOccurrences: pendingCount,
        completedOccurrences: completedCount,
        status: template.status,
        dateRange: template.dateRange ? {
          startDate: template.dateRange.startDate,
          endDate: template.dateRange.endDate
        } : null,
        weeklyDays: template.weeklyDays || [],
        monthlyDates: template.monthlyDates || [],
        excludeSunday: template.excludeSunday || false
      });
    });

    // Convert map to array and sort
    const result = Array.from(personMap.values())
      .map(person => ({
        ...person,
        checklists: person.checklists.sort((a, b) => {
          // Sort by frequency priority, then by name
          const frequencyOrder = {
            'daily': 1,
            'weekly': 2,
            'fortnightly': 3,
            'monthly': 4,
            'quarterly': 5,
            'yearly': 6
          };
          const freqDiff = (frequencyOrder[a.frequency] || 99) - (frequencyOrder[b.frequency] || 99);
          if (freqDiff !== 0) return freqDiff;
          return a.name.localeCompare(b.name);
        }),
        totalChecklists: person.checklists.length,
        totalPending: person.checklists.reduce((sum, cl) => sum + cl.pendingOccurrences, 0),
        totalCompleted: person.checklists.reduce((sum, cl) => sum + cl.completedOccurrences, 0)
      }))
      .sort((a, b) => a.username.localeCompare(b.username)); // Sort persons alphabetically

    res.json({
      success: true,
      data: result,
      summary: {
        totalPersons: result.length,
        totalChecklists: result.reduce((sum, p) => sum + p.totalChecklists, 0),
        totalPending: result.reduce((sum, p) => sum + p.totalPending, 0),
        totalCompleted: result.reduce((sum, p) => sum + p.totalCompleted, 0)
      }
    });
  } catch (error) {
    console.error('Error fetching checklists by person:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch checklists',
      error: error.message
    });
  }
});

export default router;

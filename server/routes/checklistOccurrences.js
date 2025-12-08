import express from 'express';
import ChecklistOccurrence from '../models/ChecklistOccurrence.js';
import ChecklistTemplate from '../models/ChecklistTemplate.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all occurrences with filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { assignedTo, status, templateId, dateFrom, dateTo } = req.query;

    let query = {};

    if (assignedTo) query.assignedTo = assignedTo;
    if (status) query.status = status;
    if (templateId) query.templateId = templateId;

    if (dateFrom || dateTo) {
      query.dueDate = {};
      if (dateFrom) query.dueDate.$gte = new Date(dateFrom);
      if (dateTo) query.dueDate.$lte = new Date(dateTo);
    }

    const occurrences = await ChecklistOccurrence.find(query)
      .populate('assignedTo', 'username email')
      .populate('templateId', 'name frequency')
      .populate('completedBy', 'username email')
      .sort({ dueDate: 1 });

    res.json(occurrences);
  } catch (error) {
    console.error('Error fetching occurrences:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Get calendar data for a specific month
router.get('/calendar', authenticateToken, async (req, res) => {
  try {
    const { year, month, userId } = req.query;
    const requestingUser = req.user;
    const requestingUserId = requestingUser?._id?.toString();
    const isAdmin = ['admin', 'superadmin', 'pc'].includes(requestingUser?.role);

    if (!year || !month) {
      return res.status(400).json({
        error: 'year and month are required'
      });
    }

    const targetYear = parseInt(year);
    const targetMonth = parseInt(month); // 0-based (0 = January)

    if (Number.isNaN(targetYear) || Number.isNaN(targetMonth)) {
      return res.status(400).json({
        error: 'Invalid year or month'
      });
    }

    const requestedUserId = userId ? userId.toString() : undefined;

    if (!isAdmin && !requestedUserId) {
      return res.status(400).json({
        error: 'userId is required for non-admin users'
      });
    }

    if (!isAdmin && requestedUserId && requestedUserId !== requestingUserId) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Get first and last day of the month
    const firstDay = new Date(targetYear, targetMonth, 1);
    const lastDay = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    const query = {
      dueDate: {
        $gte: firstDay,
        $lte: lastDay
      }
    };

    if (requestedUserId) {
      query.assignedTo = requestedUserId;
    } else if (!isAdmin && requestingUserId) {
      query.assignedTo = requestingUserId;
    }

    // Fetch all occurrences for this user/role in this month
    const occurrences = await ChecklistOccurrence.find(query)
      .populate('templateId', 'name')
      .populate('assignedTo', 'username email department')
      .sort({ dueDate: 1 });

    // Group occurrences by date
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const calendarData = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(targetYear, targetMonth, day);
      const dateString = date.toISOString().split('T')[0];

      // Find all occurrences for this day
      const dayOccurrences = occurrences.filter(occ => {
        const occDate = new Date(occ.dueDate);
        return occDate.getDate() === day &&
          occDate.getMonth() === targetMonth &&
          occDate.getFullYear() === targetYear;
      });

      const totalCount = dayOccurrences.length;
      const completedCount = dayOccurrences.filter(occ => occ.status === 'completed').length;
      const isFullyCompleted = totalCount > 0 && completedCount === totalCount;

      calendarData.push({
        date: dateString,
        day: day,
        occurrences: dayOccurrences,
        total: totalCount,
        completed: completedCount,
        isFullyCompleted: isFullyCompleted
      });
    }

    res.json({
      year: targetYear,
      month: targetMonth,
      calendarData: calendarData
    });
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Get occurrences for a specific date
router.get('/by-date', authenticateToken, async (req, res) => {
  try {
    const { date, userId } = req.query;

    if (!date || !userId) {
      return res.status(400).json({
        error: 'date and userId are required'
      });
    }

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const occurrences = await ChecklistOccurrence.find({
      assignedTo: userId,
      dueDate: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    })
      .populate('assignedTo', 'username email')
      .populate('templateId', 'name frequency')
      .populate('completedBy', 'username email')
      .sort({ templateName: 1 });

    res.json(occurrences);
  } catch (error) {
    console.error('Error fetching occurrences by date:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Get occurrence by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const occurrence = await ChecklistOccurrence.findById(req.params.id)
      .populate('assignedTo', 'username email')
      .populate({
        path: 'templateId',
        select: 'name frequency category items fmsConfiguration'
      })
      .populate('completedBy', 'username email');

    if (!occurrence) {
      return res.status(404).json({ error: 'Occurrence not found' });
    }

    res.json(occurrence);
  } catch (error) {
    console.error('Error fetching occurrence:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Update occurrence (tick items)
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { items } = req.body;

    const occurrence = await ChecklistOccurrence.findById(req.params.id);

    if (!occurrence) {
      return res.status(404).json({ error: 'Occurrence not found' });
    }

    // Update items
    if (items) {
      occurrence.items = items;
    }

    await occurrence.save();
    await occurrence.populate('assignedTo templateId completedBy');

    res.json(occurrence);
  } catch (error) {
    console.error('Error updating occurrence:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Update a specific item in an occurrence
router.patch('/:id/items/:itemIndex', authenticateToken, async (req, res) => {
  try {
    const { checked, remarks, status, notDoneReason, actionTaken } = req.body;
    const itemIndex = parseInt(req.params.itemIndex);

    const occurrence = await ChecklistOccurrence.findById(req.params.id);

    if (!occurrence) {
      return res.status(404).json({ error: 'Occurrence not found' });
    }

    if (itemIndex < 0 || itemIndex >= occurrence.items.length) {
      return res.status(400).json({ error: 'Invalid item index' });
    }

    if (checked !== undefined) {
      occurrence.items[itemIndex].checked = checked;
      occurrence.items[itemIndex].checkedAt = checked ? new Date() : null;
      if (checked) {
        occurrence.items[itemIndex].status = 'done';
      }
    }

    if (status) {
      occurrence.items[itemIndex].status = status;
      if (status === 'done') {
        occurrence.items[itemIndex].checked = true;
        occurrence.items[itemIndex].checkedAt = new Date();
      } else if (status === 'not-done') {
        occurrence.items[itemIndex].checked = false;
        if (notDoneReason) {
          occurrence.items[itemIndex].notDoneReason = notDoneReason;
        }
        if (actionTaken) {
          occurrence.items[itemIndex].actionTaken = actionTaken;
        }
      } else if (status === 'pending') {
        // Reset to pending - clear all status-related fields
        occurrence.items[itemIndex].checked = false;
        occurrence.items[itemIndex].checkedAt = null;
        occurrence.items[itemIndex].notDoneReason = undefined;
        occurrence.items[itemIndex].actionTaken = undefined;
      }
    }

    if (remarks !== undefined) {
      occurrence.items[itemIndex].remarks = remarks;
    }

    await occurrence.save();
    await occurrence.populate('assignedTo templateId completedBy');

    res.json(occurrence);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Submit checklist occurrence (with FMS triggering support)
router.post('/:id/submit', authenticateToken, async (req, res) => {
  try {
    const occurrence = await ChecklistOccurrence.findById(req.params.id)
      .populate({
        path: 'templateId',
        select: 'name description category items fmsConfiguration'
      });

    if (!occurrence) {
      return res.status(404).json({ error: 'Occurrence not found' });
    }

    // Check if user has access
    if (
      occurrence.assignedTo.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin' &&
      req.user.role !== 'superadmin'
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Mark as completed
    occurrence.status = 'completed';
    occurrence.completedAt = new Date();
    occurrence.completedBy = req.user._id;
    occurrence.submittedAt = new Date();
    occurrence.submittedBy = req.user._id;

    await occurrence.save();

    // Check if FMS should be triggered
    const template = occurrence.templateId;
    let triggeredProject = null;

    if (template && template.fmsConfiguration && template.fmsConfiguration.enabled && template.fmsConfiguration.triggerOnSubmission) {
      try {
        const FMS = (await import('../models/FMS.js')).default;
        const Project = (await import('../models/Project.js')).default;
        const mongoose = (await import('mongoose')).default;

        const fms = await FMS.findById(template.fmsConfiguration.fmsId).populate('steps.who');
        if (fms) {
          // Get next project ID
          const PROJECT_ID_REGEX = /^PRJ-\d+$/;
          const getNextProjectId = async () => {
            const latestProject = await Project.findOne({ projectId: { $regex: PROJECT_ID_REGEX } })
              .sort({ projectId: -1 })
              .select('projectId')
              .lean();
            const latestNumber = latestProject?.projectId ? parseInt(latestProject.projectId.split('-')[1], 10) : 0;
            const nextNumber = Number.isNaN(latestNumber) ? 1 : latestNumber + 1;
            return `PRJ-${nextNumber.toString().padStart(4, '0')}`;
          };

          const projectId = await getNextProjectId();
          const projectName = `${template.fmsConfiguration.fmsName || fms.fmsName} - ${occurrence.templateName}`;
          const startDate = new Date();

          const normalizeUserId = (value) => {
            if (!value) return null;
            if (typeof value === 'string') {
              return mongoose.Types.ObjectId.isValid(value) ? value : null;
            }
            if (typeof value === 'object') {
              if (value._id && mongoose.Types.ObjectId.isValid(value._id)) return value._id;
              if (value.id && mongoose.Types.ObjectId.isValid(value.id)) return value.id;
            }
            return null;
          };

          const tasks = fms.steps.map((step, index) => {
            const assignees = (Array.isArray(step.who) ? step.who : [])
              .map(normalizeUserId)
              .filter(Boolean);

            if (assignees.length === 0) {
              assignees.push(occurrence.assignedTo);
            }

            let plannedDueDate = null;
            let status = 'Not Started';

            if (index === 0) {
              status = 'Pending';
              const dueDate = new Date(startDate);
              if (step.when && step.whenUnit) {
                if (step.whenUnit === 'days') {
                  dueDate.setDate(dueDate.getDate() + step.when);
                } else if (step.whenUnit === 'hours') {
                  dueDate.setHours(dueDate.getHours() + step.when);
                }
              }
              plannedDueDate = dueDate;
            } else {
              status = 'Not Started';
            }

            return {
              stepNo: step.stepNo || index + 1,
              what: step.what || '',
              who: assignees,
              how: step.how || '',
              plannedDueDate,
              status,
              whenType: step.whenType || 'fixed',
              requiresChecklist: step.checklistItems && step.checklistItems.length > 0,
              checklistItems: step.checklistItems || [],
              attachments: step.attachments || [],
              requireAttachments: step.requireAttachments || false,
              mandatoryAttachments: step.mandatoryAttachments || false
            };
          });

          const project = new Project({
            projectId,
            fmsId: fms._id,
            projectName,
            startDate,
            tasks,
            createdBy: req.user._id,
            startedFromChecklist: {
              checklistId: occurrence._id,
              checklistName: occurrence.templateName,
              startedAt: new Date()
            }
          });

          await project.save();

          // Update occurrence with triggered FMS info
          occurrence.triggeredFMS = {
            projectId: project._id,
            projectName: project.projectId,
            triggeredAt: new Date()
          };
          await occurrence.save();

          triggeredProject = {
            projectId: project.projectId,
            projectName: project.projectName
          };
        }
      } catch (fmsError) {
        console.error('Error triggering FMS:', fmsError);
        // Continue with submission even if FMS trigger fails
      }
    }

    await occurrence.populate({
      path: 'assignedTo',
      select: 'username email'
    });
    await occurrence.populate({
      path: 'templateId',
      select: 'name description category items fmsConfiguration'
    });
    await occurrence.populate({
      path: 'completedBy',
      select: 'username email'
    });

    res.json({
      message: 'Checklist submitted successfully',
      occurrence,
      triggeredFMS: triggeredProject
    });
  } catch (error) {
    console.error('Error submitting checklist:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Complete occurrence (mark as done) - kept for backward compatibility
router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;

    const occurrence = await ChecklistOccurrence.findById(req.params.id);

    if (!occurrence) {
      return res.status(404).json({ error: 'Occurrence not found' });
    }

    occurrence.status = 'completed';
    occurrence.completedAt = new Date();
    occurrence.completedBy = userId;
    occurrence.submittedAt = new Date();
    occurrence.submittedBy = userId;

    await occurrence.save();
    await occurrence.populate('assignedTo templateId completedBy');

    res.json(occurrence);
  } catch (error) {
    console.error('Error completing occurrence:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Get person-wise checklist assignments with calendar data
router.get('/person-dashboard', authenticateToken, async (req, res) => {
  try {
    const requestingUser = req.user;
    if (!requestingUser || !requestingUser._id) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const requestingUserId = requestingUser._id.toString();
    const isAdmin = ['admin', 'superadmin', 'pc'].includes(requestingUser?.role || '');
    
    // Get date range for calendar (default to last 6 months and next month)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setHours(23, 59, 59, 999);

    // Fetch all checklist occurrences with template info
    let query = {
      dueDate: {
        $gte: sixMonthsAgo,
        $lte: nextMonth
      }
    };

    // Non-admins can only see their own data
    if (!isAdmin) {
      query.assignedTo = requestingUserId;
    }

    const occurrences = await ChecklistOccurrence.find(query)
      .populate('assignedTo', 'username email')
      .populate({
        path: 'templateId',
        select: 'name frequency category'
      })
      .sort({ dueDate: 1 })
      .lean();

    // Helper function to safely convert ObjectId to string
    const toIdString = (value) => {
      if (!value) return null;
      if (typeof value === 'string') return value;
      if (value && typeof value === 'object' && value.toString) {
        return value.toString();
      }
      return String(value);
    };

    // Helper function to safely get date string
    const getDateString = (dateValue) => {
      if (!dateValue) return null;
      if (dateValue instanceof Date) {
        if (isNaN(dateValue.getTime())) return null;
        return dateValue.toISOString().split('T')[0];
      }
      try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0];
      } catch (e) {
        return null;
      }
    };

    // Group by user
    const userMap = new Map();
    
    for (const occ of occurrences) {
      try {
        // Handle assignedTo - could be ObjectId or populated object
        let userId, userName, userEmail;
        
        if (occ.assignedTo) {
          if (typeof occ.assignedTo === 'object' && occ.assignedTo._id) {
            userId = toIdString(occ.assignedTo._id);
            userName = occ.assignedTo.username || 'Unknown';
            userEmail = occ.assignedTo.email || '';
          } else if (typeof occ.assignedTo === 'object' && occ.assignedTo.toString) {
            // Might be an ObjectId directly
            userId = toIdString(occ.assignedTo);
            userName = 'Unknown';
            userEmail = '';
          } else {
            userId = toIdString(occ.assignedTo);
            userName = 'Unknown';
            userEmail = '';
          }
        } else {
          // Skip if no assignedTo
          continue;
        }
        
        if (!userId) continue; // Skip if still no userId
        
        if (!userMap.has(userId)) {
          userMap.set(userId, {
            userId,
            userName,
            email: userEmail,
            checklists: [],
            calendar: new Map() // date -> { completed: 0, pending: 0 }
          });
        }
        
        const userData = userMap.get(userId);
        
        // Handle dueDate - ensure it's a valid date
        const dateKey = getDateString(occ.dueDate);
        if (!dateKey) {
          console.warn('Skipping occurrence with invalid date:', toIdString(occ._id));
          continue;
        }
        
        // Initialize calendar day if not exists
        if (!userData.calendar.has(dateKey)) {
          userData.calendar.set(dateKey, { completed: 0, pending: 0, total: 0 });
        }
        
        const dayData = userData.calendar.get(dateKey);
        dayData.total++;
        
        if (occ.status === 'completed') {
          dayData.completed++;
        } else {
          dayData.pending++;
        }
        
        // Group checklists by template
        const templateName = (occ.templateId?.name || occ.templateName || 'Unknown').toString();
        const frequency = (occ.templateId?.frequency || 'unknown').toString();
        const category = (occ.templateId?.category || occ.category || 'General').toString();
        
        let checklistGroup = userData.checklists.find(
          c => c.templateName === templateName && c.frequency === frequency
        );
        
        if (!checklistGroup) {
          checklistGroup = {
            templateName,
            frequency,
            category,
            occurrences: [],
            totalCount: 0,
            completedCount: 0,
            pendingCount: 0
          };
          userData.checklists.push(checklistGroup);
        }
        
        const dueDateStr = getDateString(occ.dueDate) || new Date().toISOString().split('T')[0];
        
        checklistGroup.occurrences.push({
          _id: toIdString(occ._id),
          dueDate: dueDateStr,
          status: occ.status || 'pending',
          progressPercentage: occ.progressPercentage || 0
        });
        
        checklistGroup.totalCount++;
        if (occ.status === 'completed') {
          checklistGroup.completedCount++;
        } else {
          checklistGroup.pendingCount++;
        }
      } catch (occError) {
        console.error('Error processing occurrence:', toIdString(occ?._id), occError);
        // Continue with next occurrence
        continue;
      }
    }
    
    // Convert calendar maps to arrays and sort
    const result = Array.from(userMap.values()).map(userData => {
      try {
        const calendarArray = Array.from(userData.calendar.entries())
          .map(([date, data]) => ({ date, ...data }))
          .sort((a, b) => a.date.localeCompare(b.date));
        
        return {
          userId: userData.userId,
          userName: userData.userName,
          email: userData.email,
          checklists: userData.checklists,
          calendar: calendarArray
        };
      } catch (mapError) {
        console.error('Error mapping user data:', userData.userId, mapError);
        return {
          userId: userData.userId,
          userName: userData.userName || 'Unknown',
          email: userData.email || '',
          checklists: [],
          calendar: []
        };
      }
    });

    res.json({
      users: result,
      dateRange: {
        start: sixMonthsAgo.toISOString().split('T')[0],
        end: nextMonth.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error('Error fetching person dashboard:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Server error', 
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

// Get dashboard statistics
router.get('/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.query;
    const requestingUser = req.user;
    const requestingUserId = requestingUser?._id?.toString();
    const isAdmin = ['admin', 'superadmin', 'pc'].includes(requestingUser?.role);
    const requestedUserId = userId ? userId.toString() : undefined;

    if (!isAdmin && !requestedUserId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!isAdmin && requestedUserId && requestedUserId !== requestingUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const assignedToFilter = requestedUserId || (!isAdmin ? requestingUserId : undefined);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const baseQuery = assignedToFilter ? { assignedTo: assignedToFilter } : {};

    const [totalPending, totalCompleted, todayPending, todayCompleted] = await Promise.all([
      ChecklistOccurrence.countDocuments({
        ...baseQuery,
        status: 'pending'
      }),
      ChecklistOccurrence.countDocuments({
        ...baseQuery,
        status: 'completed'
      }),
      ChecklistOccurrence.countDocuments({
        ...baseQuery,
        status: 'pending',
        dueDate: { $gte: today, $lt: tomorrow }
      }),
      ChecklistOccurrence.countDocuments({
        ...baseQuery,
        status: 'completed',
        dueDate: { $gte: today, $lt: tomorrow }
      })
    ]);

    res.json({
      totalPending,
      totalCompleted,
      todayPending,
      todayCompleted,
      total: totalPending + totalCompleted
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// ============ SUPER ADMIN CHECKLIST MANAGEMENT ENDPOINTS ============

// Middleware to check if user is superadmin
const isSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  if (req.user.role === 'superadmin') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Only Super Admin can perform this action.' });
};

// Super Admin: Delete checklist occurrence
router.delete('/:id/admin-delete', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const { reason } = req.body;

    const occurrence = await ChecklistOccurrence.findById(req.params.id);

    if (!occurrence) {
      return res.status(404).json({ error: 'Occurrence not found' });
    }

    // Store for audit log
    const deletedData = occurrence.toObject();

    await ChecklistOccurrence.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Checklist occurrence deleted successfully',
      deletedData
    });
  } catch (error) {
    console.error('Error deleting checklist occurrence:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Super Admin: Update checklist occurrence status
router.patch('/:id/admin-status', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const { status, reason } = req.body;

    if (!['pending', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be pending or completed' });
    }

    const occurrence = await ChecklistOccurrence.findById(req.params.id);

    if (!occurrence) {
      return res.status(404).json({ error: 'Occurrence not found' });
    }

    const oldStatus = occurrence.status;
    occurrence.status = status;

    // If changing to pending, clear completion data
    if (status === 'pending') {
      occurrence.completedAt = null;
      occurrence.completedBy = null;
    }

    await occurrence.save();
    await occurrence.populate('assignedTo templateId completedBy');

    res.json({
      success: true,
      message: `Status updated from ${oldStatus} to ${status}`,
      occurrence
    });
  } catch (error) {
    console.error('Error updating checklist status:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Super Admin: Update checklist occurrence due date
router.patch('/:id/admin-duedate', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const { dueDate, reason } = req.body;

    if (!dueDate) {
      return res.status(400).json({ error: 'Due date is required' });
    }

    const newDueDate = new Date(dueDate);
    if (isNaN(newDueDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const occurrence = await ChecklistOccurrence.findById(req.params.id);

    if (!occurrence) {
      return res.status(404).json({ error: 'Occurrence not found' });
    }

    const oldDueDate = occurrence.dueDate;
    occurrence.dueDate = newDueDate;

    await occurrence.save();
    await occurrence.populate('assignedTo templateId completedBy');

    res.json({
      success: true,
      message: `Due date updated from ${oldDueDate.toISOString().split('T')[0]} to ${newDueDate.toISOString().split('T')[0]}`,
      occurrence
    });
  } catch (error) {
    console.error('Error updating checklist due date:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

export default router;


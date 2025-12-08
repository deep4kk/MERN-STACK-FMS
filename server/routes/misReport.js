import express from 'express';
import mongoose from 'mongoose';
import { authenticateToken } from '../middleware/auth.js';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import Checklist from '../models/Checklist.js';
import HelpTicket from '../models/HelpTicket.js';
import User from '../models/User.js';

const router = express.Router();

// Require authentication and superadmin role
router.use(authenticateToken);
router.use((req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Access denied. Superadmin only.' });
  }
  next();
});

// Helper function to get start and end of month
const getMonthRange = (year, month) => {
  const startDate = new Date(year, month - 1, 1);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  return { startDate, endDate };
};

// GET /api/mis-report/data
// Get aggregated MIS report data for a specific month
router.get('/data', async (req, res) => {
  try {
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({ message: 'Year and month are required' });
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ message: 'Invalid year or month' });
    }

    const { startDate, endDate } = getMonthRange(yearNum, monthNum);

    // Get all users for person-wise breakdown
    const users = await User.find({}, 'username email _id').lean();

    // ============================================
    // TASKS AGGREGATION
    // ============================================
    const tasks = await Task.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('assignedTo', 'username email').lean();

    const taskStats = {
      total: tasks.length,
      oneOff: tasks.filter(t => t.taskType === 'one-time').length,
      cyclic: tasks.filter(t => t.taskType !== 'one-time').length,
      byPerson: {},
      byStatus: {
        pending: 0,
        'in-progress': 0,
        completed: 0,
        overdue: 0
      },
      byType: {
        'one-time': 0,
        daily: 0,
        weekly: 0,
        monthly: 0,
        quarterly: 0,
        yearly: 0
      }
    };

    tasks.forEach(task => {
      // Status breakdown
      if (task.status) {
        taskStats.byStatus[task.status] = (taskStats.byStatus[task.status] || 0) + 1;
      }

      // Type breakdown
      if (task.taskType) {
        taskStats.byType[task.taskType] = (taskStats.byType[task.taskType] || 0) + 1;
      }

      // Person-wise breakdown
      if (task.assignedTo && task.assignedTo._id) {
        const userId = task.assignedTo._id.toString();
        if (!taskStats.byPerson[userId]) {
          taskStats.byPerson[userId] = {
            userId,
            username: task.assignedTo.username || 'Unknown',
            email: task.assignedTo.email || '',
            total: 0,
            oneOff: 0,
            cyclic: 0,
            pending: 0,
            'in-progress': 0,
            completed: 0,
            overdue: 0
          };
        }
        taskStats.byPerson[userId].total++;
        if (task.taskType === 'one-time') {
          taskStats.byPerson[userId].oneOff++;
        } else {
          taskStats.byPerson[userId].cyclic++;
        }
        if (task.status) {
          taskStats.byPerson[userId][task.status] = (taskStats.byPerson[userId][task.status] || 0) + 1;
        }
      }
    });

    // ============================================
    // FMS AGGREGATION
    // ============================================
    const projects = await Project.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('fmsId', 'fmsName fmsId')
      .populate('tasks.who', 'username email')
      .lean();

    const fmsStats = {
      total: projects.length,
      inProgress: 0,
      completed: 0,
      byPerson: {},
      stepStatusBreakdown: {} // Track which step is pending for each project
    };

    projects.forEach(project => {
      // Overall project status
      const allTasksDone = project.tasks.every(t => t.status === 'Done');
      const hasInProgress = project.tasks.some(t => t.status === 'In Progress' || t.status === 'Pending');
      
      if (allTasksDone) {
        fmsStats.completed++;
      } else if (hasInProgress) {
        fmsStats.inProgress++;
      }

      // Find pending step for each project
      const pendingStep = project.tasks.find(t => 
        t.status === 'Pending' || t.status === 'In Progress' || t.status === 'Not Started'
      );
      if (pendingStep) {
        const stepNo = pendingStep.stepNo || 0;
        fmsStats.stepStatusBreakdown[stepNo] = (fmsStats.stepStatusBreakdown[stepNo] || 0) + 1;
      }

      // Person-wise breakdown
      project.tasks.forEach(task => {
        if (task.who && task.who._id) {
          const userId = task.who._id.toString();
          if (!fmsStats.byPerson[userId]) {
            fmsStats.byPerson[userId] = {
              userId,
              username: task.who.username || 'Unknown',
              email: task.who.email || '',
              total: 0,
              inProgress: 0,
              completed: 0,
              pendingSteps: []
            };
          }
          fmsStats.byPerson[userId].total++;
          if (task.status === 'In Progress') {
            fmsStats.byPerson[userId].inProgress++;
          } else if (task.status === 'Done') {
            fmsStats.byPerson[userId].completed++;
          } else {
            fmsStats.byPerson[userId].pendingSteps.push(task.stepNo || 0);
          }
        }
      });
    });

    // ============================================
    // CHECKLIST AGGREGATION
    // ============================================
    const checklists = await Checklist.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('assignedTo', 'username email').lean();

    const checklistStats = {
      total: checklists.length,
      done: 0,
      notDone: 0,
      byPerson: {}
    };

    checklists.forEach(checklist => {
      // Status breakdown
      if (checklist.status === 'Submitted') {
        checklistStats.done++;
      } else {
        checklistStats.notDone++;
      }

      // Person-wise breakdown
      if (checklist.assignedTo && checklist.assignedTo._id) {
        const userId = checklist.assignedTo._id.toString();
        if (!checklistStats.byPerson[userId]) {
          checklistStats.byPerson[userId] = {
            userId,
            username: checklist.assignedTo.username || 'Unknown',
            email: checklist.assignedTo.email || '',
            total: 0,
            done: 0,
            notDone: 0
          };
        }
        checklistStats.byPerson[userId].total++;
        if (checklist.status === 'Submitted') {
          checklistStats.byPerson[userId].done++;
        } else {
          checklistStats.byPerson[userId].notDone++;
        }
      }
    });

    // ============================================
    // HELP TICKETS AGGREGATION
    // ============================================
    const helpTickets = await HelpTicket.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('raisedBy', 'username email')
      .populate('assignedTo', 'username email')
      .lean();

    const helpTicketStats = {
      total: helpTickets.length,
      open: 0,
      'in-progress': 0,
      closed: 0,
      byPerson: {}
    };

    helpTickets.forEach(ticket => {
      // Status breakdown
      const status = ticket.status?.toLowerCase() || 'open';
      if (status === 'open') {
        helpTicketStats.open++;
      } else if (status === 'in progress') {
        helpTicketStats['in-progress']++;
      } else if (status === 'closed' || status === 'verified & closed') {
        helpTicketStats.closed++;
      }

      // Person-wise breakdown (by assignedTo, fallback to raisedBy)
      const personId = ticket.assignedTo?._id || ticket.raisedBy?._id;
      if (personId) {
        const userId = personId.toString();
        const person = ticket.assignedTo || ticket.raisedBy;
        if (!helpTicketStats.byPerson[userId]) {
          helpTicketStats.byPerson[userId] = {
            userId,
            username: person.username || 'Unknown',
            email: person.email || '',
            total: 0,
            open: 0,
            'in-progress': 0,
            closed: 0
          };
        }
        helpTicketStats.byPerson[userId].total++;
        if (status === 'open') {
          helpTicketStats.byPerson[userId].open++;
        } else if (status === 'in progress') {
          helpTicketStats.byPerson[userId]['in-progress']++;
        } else if (status === 'closed' || status === 'verified & closed') {
          helpTicketStats.byPerson[userId].closed++;
        }
      }
    });

    // Convert person-wise objects to arrays
    const convertPersonStats = (stats) => {
      return Object.values(stats).map(person => ({
        ...person,
        userId: person.userId.toString()
      }));
    };

    res.json({
      success: true,
      period: {
        year: yearNum,
        month: monthNum,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      tasks: {
        ...taskStats,
        byPerson: convertPersonStats(taskStats.byPerson)
      },
      fms: {
        ...fmsStats,
        byPerson: convertPersonStats(fmsStats.byPerson)
      },
      checklists: {
        ...checklistStats,
        byPerson: convertPersonStats(checklistStats.byPerson)
      },
      helpTickets: {
        ...helpTicketStats,
        byPerson: convertPersonStats(helpTicketStats.byPerson)
      },
      users: users.map(u => ({
        _id: u._id.toString(),
        username: u.username,
        email: u.email
      }))
    });

  } catch (error) {
    console.error('Error fetching MIS report data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

export default router;


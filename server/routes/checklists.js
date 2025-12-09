import express from 'express';
import mongoose from 'mongoose';
import auth from '../middleware/auth.js';
import ChecklistOccurrence from '../models/ChecklistOccurrence.js';
import ChecklistTemplate from '../models/ChecklistTemplate.js';
import Checklist from '../models/Checklist.js';

const router = express.Router();

// Get all checklists (occurrences) for logged-in user
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.role;
        const { status, priority, dueDate } = req.query;

        // Build filter - Admin, Superadmin, and PC roles can see all checklists
        const filter = {};

        // Only filter by assignedTo if user is NOT an admin, superadmin, or PC
        if (!['admin', 'superadmin', 'pc'].includes(userRole)) {
            filter.assignedTo = userId;
        }

        if (status) {
            filter.status = status;
        }

        if (priority) {
            filter.priority = priority;
        }

        if (dueDate) {
            const targetDate = new Date(dueDate);
            const nextDay = new Date(targetDate);
            nextDay.setDate(nextDay.getDate() + 1);
            filter.dueDate = {
                $gte: targetDate,
                $lt: nextDay
            };
        }

        const checklists = await ChecklistOccurrence.find(filter)
            .populate('templateId', 'name description category')
            .populate('assignedBy', 'username email')
            .populate('assignedTo', 'username email')
            .sort({ dueDate: 1 });

        res.json(checklists);
    } catch (error) {
        console.error('Error fetching checklists:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get pending checklists for logged-in user
router.get('/pending', auth, async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.role;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Build filter - Admin, Superadmin, and PC roles can see all pending checklists
        const filter = {
            status: { $in: ['pending', 'in-progress'] },
            dueDate: { $lte: today }
        };

        // Only filter by assignedTo if user is NOT an admin, superadmin, or PC
        if (!['admin', 'superadmin', 'pc'].includes(userRole)) {
            filter.assignedTo = userId;
        }

        const pendingChecklists = await ChecklistOccurrence.find(filter)
            .populate('templateId', 'name description category')
            .populate('assignedBy', 'username email')
            .populate('assignedTo', 'username email')
            .sort({ dueDate: 1 });

        res.json(pendingChecklists);
    } catch (error) {
        console.error('Error fetching pending checklists:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get upcoming checklists for logged-in user
router.get('/upcoming', auth, async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.role;
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        // Build filter - Admin, Superadmin, and PC roles can see all upcoming checklists
        const filter = {
            status: { $in: ['pending', 'in-progress'] },
            dueDate: { $gt: today }
        };

        // Only filter by assignedTo if user is NOT an admin, superadmin, or PC
        if (!['admin', 'superadmin', 'pc'].includes(userRole)) {
            filter.assignedTo = userId;
        }

        const upcomingChecklists = await ChecklistOccurrence.find(filter)
            .populate('templateId', 'name description category')
            .populate('assignedBy', 'username email')
            .populate('assignedTo', 'username email')
            .sort({ dueDate: 1 });

        res.json(upcomingChecklists);
    } catch (error) {
        console.error('Error fetching upcoming checklists:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get dashboard statistics
router.get('/dashboard', auth, async (req, res) => {
    try {
        const { assignedTo, role, userId } = req.query;
        const requestingUser = req.user;
        const requestingUserId = requestingUser?._id?.toString();
        const userRole = requestingUser?.role;
        
        // Determine if user can see all checklists (admin, superadmin, pc)
        const canSeeAll = ['admin', 'superadmin', 'pc'].includes(userRole);
        
        // Build base filter
        let filter = {};
        
        // If assignedTo is provided and user has permission, use it
        if (assignedTo) {
            // Only allow filtering by assignedTo if user can see all OR it's their own ID
            if (canSeeAll || assignedTo === requestingUserId) {
                filter.assignedTo = assignedTo;
            } else {
                // Employee trying to see someone else's data - deny access
                return res.status(403).json({ message: 'Access denied' });
            }
        } else if (!canSeeAll) {
            // Employee without assignedTo filter - show only their own
            filter.assignedTo = requestingUserId;
        }
        // If canSeeAll and no assignedTo, filter is empty (show all)

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get all checklists matching the filter
        // Use lean() for better performance and to avoid Mongoose document issues
        const allChecklists = await ChecklistOccurrence.find(filter)
            .populate('templateId', 'name category frequency')
            .populate('assignedTo', 'username email')
            .lean()
            .sort({ dueDate: -1 });

        // Calculate statistics with safe null checks
        const total = allChecklists.length;
        const completed = allChecklists.filter(c => c && c.status === 'completed').length;
        const pending = allChecklists.filter(c => c && c.status === 'pending').length;
        const overdue = allChecklists.filter(c => {
            if (!c) return false;
            if (c.status === 'completed') return false;
            if (!c.dueDate) return false;
            try {
                const dueDate = new Date(c.dueDate);
                return dueDate < today;
            } catch (e) {
                return false;
            }
        }).length;

        // Group by recurrence (from template or default to 'none')
        const byRecurrence = {};
        allChecklists.forEach(checklist => {
            if (!checklist) return;
            try {
                const template = checklist.templateId;
                let recurrenceType = 'none';
                if (template && typeof template === 'object' && template.frequency) {
                    recurrenceType = template.frequency;
                } else if (checklist.category) {
                    recurrenceType = checklist.category;
                }
                byRecurrence[recurrenceType] = (byRecurrence[recurrenceType] || 0) + 1;
            } catch (e) {
                byRecurrence['none'] = (byRecurrence['none'] || 0) + 1;
            }
        });

        // Group by category (use denormalized category field or template category)
        const byCategory = {};
        allChecklists.forEach(checklist => {
            if (!checklist) return;
            try {
                const template = checklist.templateId;
                const category = checklist.category || 
                               (template && typeof template === 'object' ? template.category : null) || 
                               'General';
                byCategory[category] = (byCategory[category] || 0) + 1;
            } catch (e) {
                byCategory['General'] = (byCategory['General'] || 0) + 1;
            }
        });

        // Group by department (use category as fallback since template doesn't have department)
        const byDepartment = {};
        allChecklists.forEach(checklist => {
            if (!checklist) return;
            try {
                const template = checklist.templateId;
                const category = checklist.category || 
                               (template && typeof template === 'object' ? template.category : null) || 
                               'General';
                // Use category as department since template doesn't have department field
                byDepartment[category] = (byDepartment[category] || 0) + 1;
            } catch (e) {
                byDepartment['General'] = (byDepartment['General'] || 0) + 1;
            }
        });

        // Today's submissions by category
        const todayByCategory = {};
        const todayChecklists = allChecklists.filter(c => {
            if (!c) return false;
            if (!c.updatedAt && !c.createdAt) return false;
            try {
                const updatedAt = new Date(c.updatedAt || c.createdAt);
                return updatedAt >= today && updatedAt < tomorrow;
            } catch (e) {
                return false;
            }
        });
        todayChecklists.forEach(checklist => {
            if (!checklist) return;
            try {
                const template = checklist.templateId;
                const category = checklist.category || 
                               (template && typeof template === 'object' ? template.category : null) || 
                               'General';
                todayByCategory[category] = (todayByCategory[category] || 0) + 1;
            } catch (e) {
                // Skip invalid entries
            }
        });

        // Today's submissions by frequency
        const todayByFrequency = {};
        todayChecklists.forEach(checklist => {
            if (!checklist) return;
            try {
                const template = checklist.templateId;
                const frequency = (template && typeof template === 'object' ? template.frequency : null) || 'none';
                todayByFrequency[frequency] = (todayByFrequency[frequency] || 0) + 1;
            } catch (e) {
                // Skip invalid entries
            }
        });

        // Recent submissions (last 30 days, limit to 50)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentSubmissions = allChecklists
            .filter(c => {
                if (!c) return false;
                if (!c.updatedAt && !c.createdAt) return false;
                try {
                    const updatedAt = new Date(c.updatedAt || c.createdAt);
                    return updatedAt >= thirtyDaysAgo;
                } catch (e) {
                    return false;
                }
            })
            .slice(0, 50)
            .map(checklist => {
                try {
                    const items = checklist.items || [];
                    const totalItems = items.length;
                    const itemsSubmitted = items.filter((item) => item && item.checked).length;
                    const template = checklist.templateId;
                    
                    return {
                        _id: checklist._id ? checklist._id.toString() : Math.random().toString(),
                        title: checklist.templateName || 
                              (template && typeof template === 'object' ? template.name : null) || 
                              'Untitled Checklist',
                        updatedAt: checklist.updatedAt || checklist.createdAt || new Date(),
                        status: checklist.status || 'pending',
                        totalItems,
                        itemsSubmitted,
                        itemsPercentage: totalItems > 0 ? Math.round((itemsSubmitted / totalItems) * 100) : 0,
                        category: checklist.category || 
                                 (template && typeof template === 'object' ? template.category : null) || 
                                 'General',
                        recurrence: (template && typeof template === 'object' && template.frequency) ? 
                                   { type: template.frequency } : undefined,
                        items: items.map((item) => ({
                            _id: (item && item._id) ? item._id.toString() : Math.random().toString(),
                            title: (item && item.label) || 'Untitled Item',
                            isDone: (item && item.checked) || false
                        }))
                    };
                } catch (e) {
                    // Return a safe default if mapping fails
                    return {
                        _id: checklist._id ? checklist._id.toString() : Math.random().toString(),
                        title: 'Untitled Checklist',
                        updatedAt: new Date(),
                        status: 'pending',
                        totalItems: 0,
                        itemsSubmitted: 0,
                        itemsPercentage: 0,
                        category: 'General',
                        items: []
                    };
                }
            });

        res.json({
            total,
            completed,
            pending,
            overdue,
            byRecurrence,
            byCategory,
            byDepartment,
            todayByCategory,
            todayByFrequency,
            recentSubmissions
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            message: 'Server error', 
            error: error.message,
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        });
    }
});

// Get checklist calendar data
router.get('/calendar', auth, async (req, res) => {
    try {
        const { year, month, userId } = req.query;
        const requestingUser = req.user;
        const requestingUserId = requestingUser?._id?.toString();
        const userRole = requestingUser?.role;
        
        const targetYear = parseInt(year) || new Date().getFullYear();
        const targetMonth = parseInt(month) || new Date().getMonth();
        
        let query = {
            startDate: {
                $gte: new Date(targetYear, targetMonth, 1),
                $lte: new Date(targetYear, targetMonth + 1, 0, 23, 59, 59)
            }
        };
        
        // RBAC: employees see only their checklists
        if (userRole === 'employee') {
            query.assignedTo = userId || requestingUserId;
        } else if (userId) {
            // Admin/superadmin/pc can filter by userId
            query.assignedTo = userId;
        }
        
        const checklists = await Checklist.find(query)
            .populate('assignedTo', 'username')
            .sort({ startDate: 1 });
        
        // Generate calendar structure
        const firstDay = new Date(targetYear, targetMonth, 1).getDay();
        const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        const calendar = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(targetYear, targetMonth, day);
            const dayChecklists = checklists.filter(cl => {
                const clDate = new Date(cl.startDate);
                return clDate.getDate() === day &&
                       clDate.getMonth() === targetMonth &&
                       clDate.getFullYear() === targetYear;
            });
            
            const completedCount = dayChecklists.filter(cl => cl.status === 'Submitted').length;
            const totalCount = dayChecklists.length;
            
            // Calculate activity level (0-4 scale)
            let level = 0;
            if (totalCount > 0) {
                const completionRate = completedCount / totalCount;
                level = completionRate >= 1 ? 4 : completionRate >= 0.75 ? 3 : completionRate >= 0.5 ? 2 : completionRate > 0 ? 1 : 0;
            }
            
            calendar.push({
                date: date.toISOString().split('T')[0],
                checklists: dayChecklists,
                completed: completedCount,
                total: totalCount,
                level: level
            });
        }
        
        res.json({
            year: targetYear,
            month: targetMonth,
            calendar: calendar
        });
    } catch (error) {
        console.error('Error fetching calendar data:', error);
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

// Get a specific checklist by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const checklist = await ChecklistOccurrence.findById(req.params.id)
            .populate('templateId', 'name description category items')
            .populate('assignedBy', 'username email')
            .populate('assignedTo', 'username email');

        if (!checklist) {
            return res.status(404).json({ message: 'Checklist not found' });
        }

        // Check if user has access to this checklist
        if (
            checklist.assignedTo._id.toString() !== req.user._id.toString() &&
            req.user.role !== 'admin' &&
            req.user.role !== 'superadmin'
        ) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(checklist);
    } catch (error) {
        console.error('Error fetching checklist:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update checklist status or progress
router.patch('/:id', auth, async (req, res) => {
    try {
        const { status, itemStatuses, completedItems, notes } = req.body;
        const checklist = await ChecklistOccurrence.findById(req.params.id);

        if (!checklist) {
            return res.status(404).json({ message: 'Checklist not found' });
        }

        // Check if user has access to update this checklist
        if (
            checklist.assignedTo.toString() !== req.user._id.toString() &&
            req.user.role !== 'admin' &&
            req.user.role !== 'superadmin'
        ) {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (status) {
            checklist.status = status;
        }

        if (itemStatuses) {
            checklist.itemStatuses = itemStatuses;
        }

        if (completedItems !== undefined) {
            checklist.completedItems = completedItems;
        }

        if (notes) {
            checklist.notes = notes;
        }

        if (status === 'completed') {
            checklist.completedAt = new Date();
        }

        await checklist.save();

        const updatedChecklist = await ChecklistOccurrence.findById(req.params.id)
            .populate('templateId', 'name description category')
            .populate('assignedBy', 'username email')
            .populate('assignedTo', 'username email');

        res.json(updatedChecklist);
    } catch (error) {
        console.error('Error updating checklist:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update checklist item status (done/not done)
router.patch('/:id/items/:itemId', auth, async (req, res) => {
    try {
        const { status, notDoneReason, actionTaken } = req.body;
        const checklist = await ChecklistOccurrence.findById(req.params.id);

        if (!checklist) {
            return res.status(404).json({ message: 'Checklist not found' });
        }

        // Check if user has access
        if (
            checklist.assignedTo.toString() !== req.user._id.toString() &&
            req.user.role !== 'admin' &&
            req.user.role !== 'superadmin'
        ) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const item = checklist.items.id(req.params.itemId);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        if (status) {
            item.status = status;
            if (status === 'done') {
                item.checked = true;
                item.checkedAt = new Date();
            } else if (status === 'not-done') {
                item.checked = false;
                if (notDoneReason) {
                    item.notDoneReason = notDoneReason;
                }
                if (actionTaken) {
                    item.actionTaken = actionTaken;
                }
            }
        }

        await checklist.save();

        const updatedChecklist = await ChecklistOccurrence.findById(req.params.id)
            .populate('templateId', 'name description category items fmsConfiguration')
            .populate('assignedBy', 'username email')
            .populate('assignedTo', 'username email');

        res.json(updatedChecklist);
    } catch (error) {
        console.error('Error updating checklist item:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Submit checklist
router.post('/:id/submit', auth, async (req, res) => {
    try {
        const checklist = await ChecklistOccurrence.findById(req.params.id)
            .populate('templateId');

        if (!checklist) {
            return res.status(404).json({ message: 'Checklist not found' });
        }

        // Check if user has access
        if (
            checklist.assignedTo.toString() !== req.user._id.toString() &&
            req.user.role !== 'admin' &&
            req.user.role !== 'superadmin'
        ) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Mark as completed
        checklist.status = 'completed';
        checklist.completedAt = new Date();
        checklist.completedBy = req.user._id;
        checklist.submittedAt = new Date();
        checklist.submittedBy = req.user._id;

        await checklist.save();

        // Check if FMS should be triggered
        const template = checklist.templateId;
        let triggeredProject = null;

        if (template && template.fmsConfiguration && template.fmsConfiguration.enabled && template.fmsConfiguration.triggerOnSubmission) {
            try {
                const FMS = (await import('../models/FMS.js')).default;
                const Project = (await import('../models/Project.js')).default;
                
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

                const fms = await FMS.findById(template.fmsConfiguration.fmsId).populate('steps.who');
                if (fms) {
                    // Create project from FMS
                    const projectId = await getNextProjectId();
                    const projectName = `${template.fmsConfiguration.fmsName || fms.fmsName} - ${checklist.templateName}`;
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
                            assignees.push(checklist.assignedTo);
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
                            checklistId: checklist._id,
                            checklistName: checklist.templateName,
                            startedAt: new Date()
                        }
                    });

                    await project.save();

                    // Update checklist with triggered FMS info
                    checklist.triggeredFMS = {
                        projectId: project._id,
                        projectName: project.projectId,
                        triggeredAt: new Date()
                    };
                    await checklist.save();

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

        const updatedChecklist = await ChecklistOccurrence.findById(req.params.id)
            .populate('templateId', 'name description category items fmsConfiguration')
            .populate('assignedBy', 'username email')
            .populate('assignedTo', 'username email');

        res.json({
            message: 'Checklist submitted successfully',
            checklist: updatedChecklist,
            triggeredFMS: triggeredProject
        });
    } catch (error) {
        console.error('Error submitting checklist:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get all checklists grouped by person with frequencies (all-time) - Super Admin only
router.get('/person-wise-assignments', auth, async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Only Super Admins can access this report' });
        }

        // Get all checklist templates with their assignments
        const templates = await ChecklistTemplate.find({ status: 'active' })
            .populate('assignedTo', 'username email department')
            .lean();

        // Get all checklist occurrences to count actual assignments
        const occurrences = await ChecklistOccurrence.find({})
            .populate('templateId', 'name frequency')
            .populate('assignedTo', 'username email department')
            .lean();

        // Group by person
        const personWiseData = {};

        templates.forEach(template => {
            if (!template.assignedTo) return;
            
            const userId = template.assignedTo._id.toString();
            const username = template.assignedTo.username || 'Unknown';
            const email = template.assignedTo.email || '';
            const department = template.assignedTo.department || 'General';

            if (!personWiseData[userId]) {
                personWiseData[userId] = {
                    userId,
                    username,
                    email,
                    department,
                    checklists: []
                };
            }

            // Count occurrences for this template
            const occurrenceCount = occurrences.filter(occ => 
                occ.templateId && occ.templateId._id.toString() === template._id.toString()
            ).length;

            personWiseData[userId].checklists.push({
                templateId: template._id.toString(),
                templateName: template.name,
                frequency: template.frequency || 'monthly',
                category: template.category || 'General',
                occurrenceCount,
                status: template.status
            });
        });

        // Convert to array and sort by username
        const result = Object.values(personWiseData)
            .map(person => ({
                ...person,
                checklists: person.checklists.sort((a, b) => a.templateName.localeCompare(b.templateName)),
                totalChecklists: person.checklists.length
            }))
            .sort((a, b) => a.username.localeCompare(b.username));

        res.json(result);
    } catch (error) {
        console.error('Error fetching person-wise assignments:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete a checklist (Super Admin only)
router.delete('/:id', auth, async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Only Super Admins can delete checklists' });
        }

        const checklist = await ChecklistOccurrence.findByIdAndDelete(req.params.id);

        if (!checklist) {
            return res.status(404).json({ message: 'Checklist not found' });
        }

        res.json({ message: 'Checklist deleted successfully' });
    } catch (error) {
        console.error('Error deleting checklist:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

export default router;

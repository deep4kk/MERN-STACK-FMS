
import express from 'express';
import FMS from '../models/FMS.js';
import Project from '../models/Project.js';
import User from '../models/User.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Middleware to check if user is superadmin
const isSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  if (req.user.role === 'superadmin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access denied. Only Super Admin can perform this action.' });
};

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|pdf|docx|xlsx|webm|mp3|wav/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  }
});

const FMS_ID_REGEX = /^FMS-\d+$/;
const getNextFmsId = async () => {
  const latestFms = await FMS.findOne({ fmsId: { $regex: FMS_ID_REGEX } })
    .sort({ fmsId: -1 })
    .select('fmsId')
    .lean();

  const latestNumber = latestFms?.fmsId ? parseInt(latestFms.fmsId.split('-')[1], 10) : 0;
  const nextNumber = Number.isNaN(latestNumber) ? 1 : latestNumber + 1;

  return `FMS-${nextNumber.toString().padStart(4, '0')}`;
};

// Create FMS Template
router.post('/', upload.array('files', 10), async (req, res) => {
  try {
    const {
      fmsName,
      category,
      steps,
      createdBy,
      frequency,
      frequencySettings,
      shiftSundayToMonday
    } = req.body;

    // Validate required fields
    if (!fmsName || !fmsName.trim()) {
      return res.status(400).json({ success: false, message: 'FMS name is required' });
    }
    if (!createdBy) {
      return res.status(400).json({ success: false, message: 'Creator ID is required' });
    }

    // Parse steps if sent as string
    let parsedSteps = typeof steps === 'string' ? JSON.parse(steps) : steps;
    let parsedFrequencySettings = typeof frequencySettings === 'string'
      ? JSON.parse(frequencySettings || '{}')
      : (frequencySettings || {});

    parsedFrequencySettings = {
      includeSunday: parsedFrequencySettings.includeSunday ?? true,
      shiftSundayToMonday: parsedFrequencySettings.shiftSundayToMonday ?? (shiftSundayToMonday === 'true' || shiftSundayToMonday === true),
      weeklyDays: parsedFrequencySettings.weeklyDays || [],
      monthlyDay: parsedFrequencySettings.monthlyDay,
      yearlyDuration: parsedFrequencySettings.yearlyDuration
    };

    if (!Array.isArray(parsedSteps) || parsedSteps.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one step is required' });
    }

    // Validate and convert step data
    parsedSteps = parsedSteps.map((step, index) => {
      // Set stepNo to ensure it's present (this was missing and causing the 500 error)
      step.stepNo = index + 1;

      // Validate required fields
      if (!step.what || !step.how) {
        throw new Error(`Step ${index + 1}: Missing required fields (what/how)`);
      }
      if (!step.who || (typeof step.who === 'string' && step.who.trim() === '')) {
        throw new Error(`Step ${index + 1}: An assignee is required`);
      }

      // Ensure who is a valid ObjectId (handle both array for backward compatibility and single value)
      if (Array.isArray(step.who)) {
        // Backward compatibility: if array, take first element
        if (step.who.length === 0) {
          throw new Error(`Step ${index + 1}: An assignee is required`);
        }
        step.who = step.who[0];
      }
      
      if (typeof step.who === 'string' && step.who.length !== 24) {
        throw new Error(`Step ${index + 1}: Invalid user ID format`);
      }
      
      // Validate dependent step configuration
      if (step.dependentOnStep !== undefined && step.dependentOnStep !== null) {
        if (typeof step.dependentOnStep !== 'number' || step.dependentOnStep < 1 || step.dependentOnStep >= index + 1) {
          throw new Error(`Step ${index + 1}: Dependent step must be a previous step number`);
        }
        if (step.dependentDelay === undefined || step.dependentDelay === null || step.dependentDelay < 0) {
          throw new Error(`Step ${index + 1}: Dependent delay is required and must be >= 0`);
        }
        if (!step.dependentDelayUnit || !['days', 'hours'].includes(step.dependentDelayUnit)) {
          throw new Error(`Step ${index + 1}: Dependent delay unit must be 'days' or 'hours'`);
        }
      }

      // Handle triggersFMSId if provided
      if (step.triggersFMSId && typeof step.triggersFMSId === 'string' && step.triggersFMSId.length === 24) {
        // Keep as string, MongoDB will convert
      } else if (step.triggersFMSId) {
        delete step.triggersFMSId; // Remove invalid triggersFMSId
      }

      // Default whenType if missing
      if (!step.whenType) {
        step.whenType = index === 0 ? 'fixed' : 'dependent';
      }

      if (!['fixed', 'dependent', 'ask-on-completion'].includes(step.whenType)) {
        throw new Error(`Step ${index + 1}: Invalid whenType`);
      }

      if (step.whenType === 'ask-on-completion') {
        // For ask-on-completion we expect scheduling information later, so clear duration fields
        step.when = 0;
        step.whenDays = 0;
        step.whenHours = 0;
        step.whenUnit = 'days';
      }

      step.requireAttachments = step.requireAttachments === true || step.requireAttachments === 'true';
      step.mandatoryAttachments = step.mandatoryAttachments === true || step.mandatoryAttachments === 'true';

      return step;
    });

    // Process file uploads
    if (req.files && req.files.length > 0) {
      const fileMap = {};
      req.files.forEach(file => {
        const stepIndex = parseInt(file.fieldname.split('-')[1]);
        if (!fileMap[stepIndex]) fileMap[stepIndex] = [];
        fileMap[stepIndex].push({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          size: file.size,
          uploadedBy: createdBy,
          uploadedAt: new Date()
        });
      });

      parsedSteps.forEach((step, index) => {
        if (fileMap[index]) {
          step.attachments = fileMap[index];
        }
      });
    }

    const basePayload = {
      fmsName,
      category: category || 'General',
      steps: parsedSteps,
      createdBy,
      status: 'Active',
      frequency: frequency || 'one-time',
      frequencySettings: parsedFrequencySettings
    };

    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const fmsId = await getNextFmsId();

      try {
        const fms = new FMS({
          ...basePayload,
          fmsId
        });

        await fms.save();

        return res.json({ success: true, message: 'FMS template created successfully', fmsId });
      } catch (saveError) {
        if (saveError?.code === 11000 && saveError?.keyPattern?.fmsId && attempt < maxAttempts - 1) {
          // Collision detected, retry with a freshly generated ID
          continue;
        }
        throw saveError;
      }
    }

    throw new Error('Unable to allocate unique FMS ID. Please try again.');
  } catch (error) {
    console.error('Create FMS error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: error.message
    });
  }
});

// Get all FMS templates with access control
router.get('/', async (req, res) => {
  try {
    const { userId, isAdmin } = req.query;

    let query = {};

    // If not admin/superadmin, only show FMS where user is part of at least one step
    // Admin and superadmin can see all FMS templates
    if (!isAdmin || isAdmin === 'false') {
      if (userId) {
        query = {
          'steps.who': userId
        };
      } else {
        return res.json({ success: true, fmsList: [] });
      }
    }
    // For admin/superadmin, query remains empty {} to fetch all FMS

    const fmsList = await FMS.find(query)
      .populate('createdBy', 'username email')
      .populate('steps.who', 'username email name designation')
      .sort({ createdAt: -1 }); // Sort by newest first

    const formattedList = fmsList.map(fms => {
      let totalHours = 0;
      fms.steps.forEach(step => {
        if (step.whenUnit === 'days') {
          totalHours += step.when * 24;
        } else if (step.whenUnit === 'hours') {
          totalHours += step.when;
        } else if (step.whenUnit === 'days+hours') {
          totalHours += (step.whenDays || 0) * 24 + (step.whenHours || 0);
        }
      });

      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      const totalTimeFormatted = days > 0 ? `${days} days ${hours} hours` : `${hours} hours`;

      return {
        _id: fms._id,
        fmsId: fms.fmsId,
        fmsName: fms.fmsName,
        category: fms.category || 'General',
        stepCount: fms.steps.length,
        createdBy: fms.createdBy?.username || 'Unknown',
        createdOn: fms.createdAt,
        totalTimeFormatted,
        steps: fms.steps,
        frequency: fms.frequency || 'one-time',
        frequencySettings: fms.frequencySettings
      };
    });

    res.json({ success: true, fmsList: formattedList });
  } catch (error) {
    console.error('Get FMS error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Get single FMS template
router.get('/:fmsId', authenticateToken, async (req, res) => {
  try {
    const idParam = req.params.fmsId;
    let fms;

    console.log('Fetching FMS with ID:', idParam);

    // Try to find by MongoDB _id first (for edit mode), then by fmsId
    if (idParam.match(/^[0-9a-fA-F]{24}$/)) {
      // Valid MongoDB ObjectId format
      console.log('Searching by MongoDB _id');
      fms = await FMS.findById(idParam)
        .populate('createdBy', 'username email')
        .populate('steps.who', 'username email name designation');
      console.log('FMS found by _id:', !!fms);
    }

    // If not found by _id, try by fmsId
    if (!fms) {
      console.log('Searching by fmsId field');
      fms = await FMS.findOne({ fmsId: idParam })
        .populate('createdBy', 'username email')
        .populate('steps.who', 'username email name designation');
      console.log('FMS found by fmsId:', !!fms);
    }

    if (!fms) {
      console.log('FMS not found with ID:', idParam);
      return res.status(404).json({ success: false, message: 'FMS template not found' });
    }

    res.json(fms);
  } catch (error) {
    console.error('Get FMS error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Update FMS template - Super Admin only
router.put('/:id', authenticateToken, isSuperAdmin, upload.array('files', 10), async (req, res) => {
  try {
    const {
      fmsName,
      category,
      steps,
      frequency,
      frequencySettings,
      shiftSundayToMonday
    } = req.body;

    const fms = await FMS.findById(req.params.id);
    if (!fms) {
      return res.status(404).json({ success: false, message: 'FMS template not found' });
    }

    // Validate required fields if provided
    if (fmsName !== undefined && (!fmsName || !fmsName.trim())) {
      return res.status(400).json({ success: false, message: 'FMS name cannot be empty' });
    }

    // Update FMS name if provided
    if (fmsName !== undefined) {
      fms.fmsName = fmsName.trim();
    }

    // Update category if provided
    if (category !== undefined) {
      fms.category = category || 'General';
    }

    // Update frequency if provided
    if (frequency !== undefined) {
      fms.frequency = frequency || 'one-time';
    }

    // Update frequency settings if provided
    if (frequencySettings !== undefined) {
      let parsedFrequencySettings = typeof frequencySettings === 'string'
        ? JSON.parse(frequencySettings || '{}')
        : (frequencySettings || {});

      fms.frequencySettings = {
        includeSunday: parsedFrequencySettings.includeSunday ?? fms.frequencySettings?.includeSunday ?? true,
        shiftSundayToMonday: parsedFrequencySettings.shiftSundayToMonday ?? (shiftSundayToMonday === 'true' || shiftSundayToMonday === true) ?? fms.frequencySettings?.shiftSundayToMonday ?? false,
        weeklyDays: parsedFrequencySettings.weeklyDays || fms.frequencySettings?.weeklyDays || [],
        monthlyDay: parsedFrequencySettings.monthlyDay ?? fms.frequencySettings?.monthlyDay,
        yearlyDuration: parsedFrequencySettings.yearlyDuration ?? fms.frequencySettings?.yearlyDuration
      };
    }

    // Update steps if provided
    if (steps !== undefined) {
      let parsedSteps = typeof steps === 'string' ? JSON.parse(steps) : steps;

      if (!Array.isArray(parsedSteps) || parsedSteps.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one step is required' });
      }

      // Validate and convert step data
      parsedSteps = parsedSteps.map((step, index) => {
        // Set stepNo to ensure it's present (this was missing and causing the 500 error)
        step.stepNo = index + 1;

        // Validate required fields
        if (!step.what || !step.how) {
          throw new Error(`Step ${index + 1}: Missing required fields (what/how)`);
        }
        if (!step.who || (typeof step.who === 'string' && step.who.trim() === '')) {
          throw new Error(`Step ${index + 1}: An assignee is required`);
        }

        // Ensure who is a valid ObjectId (handle both array for backward compatibility and single value)
        if (Array.isArray(step.who)) {
          // Backward compatibility: if array, take first element
          if (step.who.length === 0) {
            throw new Error(`Step ${index + 1}: An assignee is required`);
          }
          step.who = step.who[0];
        }
        
        if (typeof step.who === 'string' && step.who.length !== 24) {
          throw new Error(`Step ${index + 1}: Invalid user ID format`);
        }
        
        // Validate dependent step configuration
        if (step.dependentOnStep !== undefined && step.dependentOnStep !== null) {
          if (typeof step.dependentOnStep !== 'number' || step.dependentOnStep < 1 || step.dependentOnStep >= index + 1) {
            throw new Error(`Step ${index + 1}: Dependent step must be a previous step number`);
          }
          if (step.dependentDelay === undefined || step.dependentDelay === null || step.dependentDelay < 0) {
            throw new Error(`Step ${index + 1}: Dependent delay is required and must be >= 0`);
          }
          if (!step.dependentDelayUnit || !['days', 'hours'].includes(step.dependentDelayUnit)) {
            throw new Error(`Step ${index + 1}: Dependent delay unit must be 'days' or 'hours'`);
          }
        }

        // Handle triggersFMSId if provided
        if (step.triggersFMSId && typeof step.triggersFMSId === 'string' && step.triggersFMSId.length === 24) {
          // Keep as string, MongoDB will convert
        } else if (step.triggersFMSId) {
          delete step.triggersFMSId; // Remove invalid triggersFMSId
        }

        // Default whenType if missing
        if (!step.whenType) {
          step.whenType = index === 0 ? 'fixed' : 'dependent';
        }

        if (!['fixed', 'dependent', 'ask-on-completion'].includes(step.whenType)) {
          throw new Error(`Step ${index + 1}: Invalid whenType`);
        }

        if (step.whenType === 'ask-on-completion') {
          step.when = 0;
          step.whenDays = 0;
          step.whenHours = 0;
          step.whenUnit = 'days';
        }

        step.requireAttachments = step.requireAttachments === true || step.requireAttachments === 'true';
        step.mandatoryAttachments = step.mandatoryAttachments === true || step.mandatoryAttachments === 'true';

        return step;
      });

      // Process file uploads if any
      if (req.files && req.files.length > 0) {
        const fileMap = {};
        req.files.forEach(file => {
          const stepIndex = parseInt(file.fieldname.split('-')[1]);
          if (!fileMap[stepIndex]) fileMap[stepIndex] = [];
          fileMap[stepIndex].push({
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            size: file.size,
            uploadedBy: req.user._id,
            uploadedAt: new Date()
          });
        });

        parsedSteps.forEach((step, index) => {
          if (fileMap[index]) {
            // Merge new files with existing attachments or replace if needed
            step.attachments = [...(step.attachments || []), ...fileMap[index]];
          }
        });
      }

      fms.steps = parsedSteps;
    }

    await fms.save();

    const updatedFms = await FMS.findById(fms._id)
      .populate('createdBy', 'username email')
      .populate('steps.who', 'username email name designation');

    res.json({ success: true, message: 'FMS template updated successfully', fms: updatedFms });
  } catch (error) {
    console.error('Update FMS error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

export default router;

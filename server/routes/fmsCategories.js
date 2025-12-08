import express from 'express';
import FMS from '../models/FMS.js';
import mongoose from 'mongoose';
import FMSCategory from '../models/FMSCategory.js';

const router = express.Router();

// Middleware to check if user is superadmin
const isSuperAdmin = (req, res, next) => {
  const { role } = req.query;
  const roleFromBody = req.body?.role;
  if (role === 'superadmin' || roleFromBody === 'superadmin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access denied. Only Super Admin can manage categories.' });
};

// Get all FMS templates with category support
router.get('/', async (req, res) => {
  try {
    const { userId, isAdmin, category } = req.query;
    const query = {};

    // If not admin, only show active templates
    if (isAdmin !== 'true') {
      query.status = 'Active';
    }

    // Filter by category if specified
    if (category) {
      query.category = category;
    }

    const fmsList = await FMS.find(query)
      .populate('createdBy', 'username')
      .populate('steps.who', 'username designation')
      .sort({ createdAt: -1 });

    // Calculate total time for each FMS
    const formattedFMSList = fmsList.map(fms => {
      const totalTime = fms.steps.reduce((acc, step) => {
        let timeInHours = 0;
        if (step.whenUnit === 'days') {
          timeInHours = step.when * 24;
        } else if (step.whenUnit === 'hours') {
          timeInHours = step.when;
        } else if (step.whenUnit === 'days+hours') {
          timeInHours = (step.whenDays || 0) * 24 + (step.whenHours || 0);
        }
        return acc + timeInHours;
      }, 0);

      // Format total time
      const days = Math.floor(totalTime / 24);
      const hours = totalTime % 24;
      const totalTimeFormatted = `${days > 0 ? `${days}d ` : ''}${hours > 0 ? `${hours}h` : ''}`.trim();

      return {
        _id: fms._id,
        fmsId: fms.fmsId,
        fmsName: fms.fmsName,
        category: fms.category || 'Uncategorized',
        stepCount: fms.steps.length,
        createdBy: fms.createdBy.username,
        createdOn: fms.createdAt,
        totalTimeFormatted,
        steps: fms.steps
      };
    });

    res.json({
      success: true,
      fmsList: formattedFMSList
    });
  } catch (error) {
    console.error('Error fetching FMS templates:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Update FMS category (Superadmin only)
router.put('/:id/category', isSuperAdmin, async (req, res) => {
  try {
    const { category } = req.body;
    if (!category) {
      return res.status(400).json({ success: false, message: 'Category is required' });
    }

    const fms = await FMS.findByIdAndUpdate(
      req.params.id,
      { category },
      { new: true }
    );

    if (!fms) {
      return res.status(404).json({ success: false, message: 'FMS template not found' });
    }

    res.json({
      success: true,
      fms
    });
  } catch (error) {
    console.error('Error updating FMS category:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Get available categories
router.get('/categories', async (req, res) => {
  try {
    const [categoryDocs, counts] = await Promise.all([
      FMSCategory.find().sort({ name: 1 }),
      FMS.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const countMap = counts.reduce((acc, item) => {
      const key = item._id || 'Uncategorized';
      acc[key] = item.count;
      return acc;
    }, {});

    let categories = [];

    if (categoryDocs.length > 0) {
      categories = categoryDocs.map(doc => ({
        name: doc.name,
        count: countMap[doc.name] || 0
      }));
    } else {
      // Fallback if no categories have been manually created yet
      categories = Object.entries(countMap).map(([name, count]) => ({
        name,
        count
      }));
    }

    // Ensure "General" always exists
    if (!categories.some(cat => cat.name === 'General')) {
      categories.unshift({ name: 'General', count: countMap['General'] || 0 });
    }

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Add new category (Superadmin only)
router.post('/categories', isSuperAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const trimmedName = name.trim();

    // Check if category already exists
    const exists = await FMSCategory.findOne({ name: trimmedName });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Category already exists' });
    }

    await FMSCategory.create({ name: trimmedName });

    res.json({
      success: true,
      message: 'Category created successfully'
    });
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Update category name (Superadmin only)
router.put('/categories/update', isSuperAdmin, async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) {
      return res.status(400).json({ success: false, message: 'Both old and new category names are required' });
    }

    const trimmedNewName = newName.trim();

    // Update stored category record
    await FMSCategory.findOneAndUpdate(
      { name: oldName },
      { name: trimmedNewName },
      { upsert: true, new: true }
    );

    // Update all FMS with the old category name
    const result = await FMS.updateMany(
      { category: oldName },
      { $set: { category: trimmedNewName } }
    );

    res.json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} FMS template(s)`
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

export default router;
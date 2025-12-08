import express from 'express';
import User from '../models/User.js';
import FMSDisplayConfig from '../models/FMSDisplayConfig.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware to check if user is superadmin
const isSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'superadmin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access denied. Only Super Admin can manage designations.' });
};

// Get all unique designations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const designations = await User.distinct('designation', { designation: { $exists: true, $ne: '' } });
    res.json({ success: true, designations: designations.filter(Boolean).sort() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching designations', error: error.message });
  }
});

// Get all users with their designations (for superadmin)
router.get('/users', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const users = await User.find().select('username email designation role isActive').sort({ username: 1 });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching users', error: error.message });
  }
});

// Update user designation
router.put('/users/:userId', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { designation } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.designation = designation || '';
    await user.save();

    res.json({ success: true, message: 'Designation updated successfully', user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating designation', error: error.message });
  }
});

// Get FMS display configuration
router.get('/fms-display-config', authenticateToken, async (req, res) => {
  try {
    const config = await FMSDisplayConfig.getConfig();
    res.json({ success: true, config: { displayMode: config.displayMode } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching display configuration', error: error.message });
  }
});

// Update FMS display configuration (superadmin only)
router.put('/fms-display-config', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const { displayMode } = req.body;

    if (!['name', 'designation', 'both'].includes(displayMode)) {
      return res.status(400).json({ success: false, message: 'Invalid display mode. Must be: name, designation, or both' });
    }

    const config = await FMSDisplayConfig.updateConfig(displayMode);
    res.json({ success: true, message: 'Display configuration updated successfully', config: { displayMode: config.displayMode } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating display configuration', error: error.message });
  }
});

export default router;

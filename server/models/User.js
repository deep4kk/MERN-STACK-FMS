import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  designation: {
    type: String,
    trim: true,
    default: ''
  },
  profilePicture: {
    type: String,
    default: ''
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'manager', 'employee', 'pc'],
    default: 'employee'
  },
  permissions: {
    // Task Permissions
    canViewTasks: { type: Boolean, default: true },
    canViewAllTeamTasks: { type: Boolean, default: false },
    canAssignTasks: { type: Boolean, default: false },
    canDeleteTasks: { type: Boolean, default: false },
    canEditTasks: { type: Boolean, default: false },
    canCompleteTasksOnBehalf: { type: Boolean, default: false },
    canCompleteAnyTask: { type: Boolean, default: false },
    canEditRecurringTaskSchedules: { type: Boolean, default: false },
    
    // Checklist Permissions
    canViewAllChecklists: { type: Boolean, default: false },
    canCreateChecklists: { type: Boolean, default: false },
    canEditChecklists: { type: Boolean, default: false },
    canDeleteChecklists: { type: Boolean, default: false },
    canManageChecklistCategories: { type: Boolean, default: false },
    
    // Complaint Permissions
    canViewAllComplaints: { type: Boolean, default: false },
    canRaiseComplaints: { type: Boolean, default: true },
    canAssignComplaints: { type: Boolean, default: false },
    canResolveComplaints: { type: Boolean, default: false },
    
    // User Management Permissions
    canManageUsers: { type: Boolean, default: false },
    canManageRoles: { type: Boolean, default: false },
    
    // Stationery Permissions
    canManageStationery: { type: Boolean, default: false },
    
    // Objection Permissions
    canViewObjectionMaster: { type: Boolean, default: false },
    canApproveObjections: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  preferences: {
    sidebar: {
      sectionOrder: {
        type: [String],
        default: []
      }
    }
  }
}, {
  timestamps: true
});

// ============================================
// PERFORMANCE INDEXES for User Model
// ============================================
// Index for login queries (username, email, phone)
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ phoneNumber: 1 });

// Compound index for finding active users
userSchema.index({ isActive: 1, role: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
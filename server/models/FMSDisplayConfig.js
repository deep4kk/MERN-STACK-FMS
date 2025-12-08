import mongoose from 'mongoose';

const fmsDisplayConfigSchema = new mongoose.Schema({
  displayMode: {
    type: String,
    enum: ['name', 'designation', 'both'],
    default: 'name',
    required: true
  }
}, {
  timestamps: true
});

// Ensure only one configuration document exists
fmsDisplayConfigSchema.statics.getConfig = async function() {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({ displayMode: 'name' });
  }
  return config;
};

fmsDisplayConfigSchema.statics.updateConfig = async function(displayMode) {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({ displayMode });
  } else {
    config.displayMode = displayMode;
    await config.save();
  }
  return config;
};

export default mongoose.model('FMSDisplayConfig', fmsDisplayConfigSchema);

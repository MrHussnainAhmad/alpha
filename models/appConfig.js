const mongoose = require('mongoose');

const appConfigSchema = new mongoose.Schema({
  collegeName: {
    type: String,
    default: 'Alpha Education',
    required: true,
    trim: true,
    maxlength: 100
  },
  logoUrl: {
    type: String,
    default: '',
    trim: true
  },
  logoPublicId: {
    type: String,
    default: '',
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure only one configuration document exists
appConfigSchema.statics.getConfig = async function() {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({});
  }
  return config;
};

appConfigSchema.statics.updateConfig = async function(updateData) {
  let config = await this.findOne();
  if (!config) {
    config = await this.create(updateData);
  } else {
    Object.assign(config, updateData);
    config.updatedAt = new Date();
    await config.save();
  }
  return config;
};

module.exports = mongoose.model('AppConfig', appConfigSchema);

const mongoose = require('mongoose');

const resetTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userModel'
  },
  userModel: {
    type: String,
    required: true,
    enum: ['Teacher', 'Student']
  },
  email: {
    type: String,
    required: true
  },
  token: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  used: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for faster queries and automatic cleanup
resetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
resetTokenSchema.index({ token: 1 });

module.exports = mongoose.model('ResetToken', resetTokenSchema);

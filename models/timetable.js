const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  day: {
    type: String,
    required: true,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  timeSlot: {
    type: String,
    required: true,
    // Format: "HH:MM-HH:MM" (e.g., "09:00-10:00")
    validate: {
      validator: function(v) {
        return /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(v);
      },
      message: 'Time slot must be in format HH:MM-HH:MM'
    }
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index to ensure no duplicate time slots for the same class and day
timetableSchema.index({ class: 1, day: 1, timeSlot: 1 }, { unique: true });

// Index for efficient queries
timetableSchema.index({ class: 1, teacher: 1 });
timetableSchema.index({ teacher: 1, day: 1 });

const Timetable = mongoose.model('Timetable', timetableSchema);

module.exports = Timetable;

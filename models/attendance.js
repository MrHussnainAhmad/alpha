const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: false // Optional for teacher attendance
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: false // Optional for student attendance
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: false // Optional for teacher attendance
  },
  status: {
    type: String,
    enum: ['A', 'P', 'H'], // A = Absent, P = Present, H = Holiday/Event
    required: true
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: false // Make it optional to handle default admin
  },
  markedAt: {
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

// Index for better query performance
attendanceSchema.index({ date: 1, studentId: 1, classId: 1 });
attendanceSchema.index({ date: 1, teacherId: 1, classId: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);

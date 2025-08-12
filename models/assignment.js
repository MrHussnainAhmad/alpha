const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
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
  teacherName: {
    type: String,
    required: true,
    trim: true
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  className: {
    type: String,
    required: true,
    trim: true
  },
  section: {
    type: String,
    required: true,
    trim: true
  },
  dueDate: {
    type: Date,
    required: false
  },
  images: [{
    type: String, // Cloudinary URLs for assignment images
  }],
  attachments: [{
    fileName: {
      type: String,
      required: true,
      trim: true
    },
    fileUrl: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    fileType: {
      type: String,
      required: true,
      trim: true
    }
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'archived'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  totalStudents: {
    type: Number,
    default: 0
  },
  submittedCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient querying
assignmentSchema.index({ class: 1, section: 1 });
assignmentSchema.index({ teacher: 1 });
assignmentSchema.index({ subject: 1 });
assignmentSchema.index({ status: 1 });
assignmentSchema.index({ dueDate: 1 });
assignmentSchema.index({ createdAt: -1 });

// Static method to get assignments for a class
assignmentSchema.statics.getClassAssignments = function(classId, options = {}) {
  const query = {
    class: classId,
    isActive: true
  };
  
  if (options.status) query.status = options.status;
  if (options.subject) query.subject = options.subject;
  if (options.teacher) query.teacher = options.teacher;
  
  return this.find(query)
    .populate('teacher', 'fullname teacherId img')
    .populate('class', 'classNumber section')
    .sort({ createdAt: -1 });
};

// Static method to get teacher's assignments
assignmentSchema.statics.getTeacherAssignments = function(teacherId, options = {}) {
  const query = {
    teacher: teacherId,
    isActive: true
  };
  
  if (options.status) query.status = options.status;
  if (options.class) query.class = options.class;
  if (options.subject) query.subject = options.subject;
  
  return this.find(query)
    .populate('class', 'classNumber section')
    .sort({ createdAt: -1 });
};

// Method to update submission count
assignmentSchema.methods.updateSubmissionCount = function(count) {
  this.submittedCount = count;
  return this.save();
};

// Method to update total students count
assignmentSchema.methods.updateTotalStudents = function(count) {
  this.totalStudents = count;
  return this.save();
};

// Pre-save middleware to update status based on due date
assignmentSchema.pre('save', function(next) {
  if (this.dueDate && new Date() > this.dueDate && this.status === 'active') {
    this.status = 'expired';
  }
  next();
});

module.exports = mongoose.model("Assignment", assignmentSchema);


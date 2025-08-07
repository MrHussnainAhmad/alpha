const mongoose = require("mongoose");

const marksSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  studentIdString: {
    type: String,
    required: true,
    trim: true
  },
  studentName: {
    type: String,
    required: true,
    trim: true
  },
  class: {
    type: String,
    required: true,
    trim: true
  },
  section: {
    type: String,
    required: true,
    trim: true
  },
  examType: {
    type: String,
    required: true,
    enum: ['midterm', 'final', 'quiz', 'assignment', 'test', 'monthly', 'weekly'],
    trim: true
  },
  examDate: {
    type: Date,
    required: true
  },
  subjects: [{
    subjectName: {
      type: String,
      required: true,
      trim: true
    },
    marksObtained: {
      type: Number,
      required: true,
      min: 0
    },
    totalMarks: {
      type: Number,
      required: true,
      min: 1
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100
    },
    grade: {
      type: String,
      enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'],
      trim: true
    },
    remarks: {
      type: String,
      trim: true,
      default: ''
    }
  }],
  totalMarksObtained: {
    type: Number,
    default: 0
  },
  totalMarksMax: {
    type: Number,
    default: 0
  },
  overallPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  overallGrade: {
    type: String,
    enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'],
    trim: true
  },
  position: {
    type: Number,
    min: 1
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'addedByType'
  },
  addedByType: {
    type: String,
    required: true,
    enum: ['Admin', 'Teacher']
  },
  addedByName: {
    type: String,
    required: true,
    trim: true
  },
  academicYear: {
    type: String,
    required: true,
    trim: true
  },
  semester: {
    type: String,
    enum: ['1st', '2nd', '3rd', '4th'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  remarks: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

// Index for efficient querying
marksSchema.index({ studentId: 1, examType: 1, academicYear: 1 });
marksSchema.index({ studentIdString: 1 });
marksSchema.index({ class: 1, section: 1, examType: 1 });
marksSchema.index({ addedBy: 1, addedByType: 1 });

// Calculate percentage and grade for individual subjects
marksSchema.methods.calculateSubjectGrades = function() {
  this.subjects.forEach(subject => {
    // Calculate percentage
    subject.percentage = Math.round((subject.marksObtained / subject.totalMarks) * 100 * 100) / 100;
    
    // Calculate grade based on percentage
    subject.grade = this.getGrade(subject.percentage);
  });
};

// Calculate overall percentage and grade
marksSchema.methods.calculateOverallGrade = function() {
  if (this.subjects.length === 0) return;
  
  this.totalMarksObtained = this.subjects.reduce((sum, subject) => sum + subject.marksObtained, 0);
  this.totalMarksMax = this.subjects.reduce((sum, subject) => sum + subject.totalMarks, 0);
  
  this.overallPercentage = Math.round((this.totalMarksObtained / this.totalMarksMax) * 100 * 100) / 100;
  this.overallGrade = this.getGrade(this.overallPercentage);
};

// Get grade based on percentage
marksSchema.methods.getGrade = function(percentage) {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 75) return 'B+';
  if (percentage >= 70) return 'B';
  if (percentage >= 65) return 'C+';
  if (percentage >= 60) return 'C';
  if (percentage >= 55) return 'D+';
  if (percentage >= 50) return 'D';
  return 'F';
};

// Pre-save middleware to calculate grades
marksSchema.pre('save', function(next) {
  this.calculateSubjectGrades();
  this.calculateOverallGrade();
  next();
});

// Static method to get student's academic record
marksSchema.statics.getStudentRecord = function(studentId, options = {}) {
  const query = { studentId, isActive: true };
  
  if (options.examType) query.examType = options.examType;
  if (options.academicYear) query.academicYear = options.academicYear;
  if (options.semester) query.semester = options.semester;
  
  return this.find(query)
    .populate('addedBy', 'fullname username teacherId')
    .sort({ examDate: -1, createdAt: -1 });
};

// Static method to get class performance
marksSchema.statics.getClassPerformance = function(className, section, examType, academicYear) {
  return this.find({
    class: className,
    section: section,
    examType: examType,
    academicYear: academicYear,
    isActive: true
  })
    .populate('studentId', 'fullname studentId')
    .sort({ overallPercentage: -1 });
};

module.exports = mongoose.model("Marks", marksSchema);

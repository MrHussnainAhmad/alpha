const mongoose = require("mongoose");

const classQuestionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  question: {
    type: String,
    required: true,
    trim: true
  },
  images: [{
    type: String, // Cloudinary URLs for question images
  }],
  subject: {
    type: String,
    required: true,
    trim: true
  },
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
  academicYear: {
    type: String,
    required: true,
    trim: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'answered', 'closed'],
    default: 'pending'
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  answers: [{
    answer: {
      type: String,
      required: true,
      trim: true
    },
    images: [{
      type: String // Cloudinary URLs for answer images
    }],
    answeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'answers.answeredByType'
    },
    answeredByType: {
      type: String,
      required: true,
      enum: ['Admin', 'Teacher']
    },
    answeredByName: {
      type: String,
      required: true,
      trim: true
    },
    answeredAt: {
      type: Date,
      default: Date.now
    },
    isAccepted: {
      type: Boolean,
      default: false
    },
    likes: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      userType: {
        type: String,
        enum: ['teacher', 'student'],
        required: true
      },
      likedAt: {
        type: Date,
        default: Date.now
      }
    }],
    remarks: {
      type: String,
      trim: true,
      default: ''
    }
  }],
  acceptedAnswerId: {
    type: mongoose.Schema.Types.ObjectId
  },
  viewedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    userType: {
      type: String,
      enum: ['admin', 'teacher', 'student'],
      required: true
    },
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }],
  totalViews: {
    type: Number,
    default: 0
  },
  totalAnswers: {
    type: Number,
    default: 0
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
classQuestionSchema.index({ class: 1, section: 1, academicYear: 1 });
classQuestionSchema.index({ studentId: 1 });
classQuestionSchema.index({ subject: 1 });
classQuestionSchema.index({ status: 1 });
classQuestionSchema.index({ lastActivityAt: -1 });
classQuestionSchema.index({ createdAt: -1 });

// Method to add an answer
classQuestionSchema.methods.addAnswer = function(answerData, answeredBy, answeredByType, answeredByName) {
  this.answers.push({
    ...answerData,
    answeredBy,
    answeredByType,
    answeredByName
  });
  
  this.totalAnswers = this.answers.length;
  this.lastActivityAt = new Date();
  
  if (this.status === 'pending') {
    this.status = 'answered';
  }
};

// Method to accept an answer
classQuestionSchema.methods.acceptAnswer = function(answerId) {
  const answer = this.answers.id(answerId);
  if (answer) {
    // Reset all answers
    this.answers.forEach(ans => ans.isAccepted = false);
    // Accept the selected answer
    answer.isAccepted = true;
    this.acceptedAnswerId = answerId;
    this.status = 'answered';
    this.lastActivityAt = new Date();
    return true;
  }
  return false;
};

// Method to add view
classQuestionSchema.methods.addView = function(userId, userType) {
  const existingView = this.viewedBy.find(view => 
    view.userId.toString() === userId.toString() && view.userType === userType
  );
  
  if (!existingView) {
    this.viewedBy.push({
      userId,
      userType,
      viewedAt: new Date()
    });
    this.totalViews = this.viewedBy.length;
  }
};

// Method to like an answer
classQuestionSchema.methods.likeAnswer = function(answerId, userId, userType) {
  const answer = this.answers.id(answerId);
  if (answer) {
    const existingLike = answer.likes.find(like => 
      like.userId.toString() === userId.toString() && like.userType === userType
    );
    
    if (!existingLike) {
      answer.likes.push({
        userId,
        userType,
        likedAt: new Date()
      });
      return true;
    }
  }
  return false;
};

// Static method to get questions for a class
classQuestionSchema.statics.getClassQuestions = function(className, section, options = {}) {
  const query = {
    class: className,
    section: section,
    isActive: true
  };
  
  if (options.status) query.status = options.status;
  if (options.subject) query.subject = options.subject;
  if (options.academicYear) query.academicYear = options.academicYear;
  if (options.priority) query.priority = options.priority;
  
  return this.find(query)
    .populate('studentId', 'fullname studentId img')
    .populate('answers.answeredBy', 'fullname username teacherId')
    .sort({ lastActivityAt: -1, createdAt: -1 });
};

// Static method to get student's questions
classQuestionSchema.statics.getStudentQuestions = function(studentId, options = {}) {
  const query = {
    studentId: studentId,
    isActive: true
  };
  
  if (options.status) query.status = options.status;
  if (options.subject) query.subject = options.subject;
  if (options.academicYear) query.academicYear = options.academicYear;
  
  return this.find(query)
    .populate('answers.answeredBy', 'fullname username teacherId')
    .sort({ createdAt: -1 });
};

// Static method to get questions by subject
classQuestionSchema.statics.getQuestionsBySubject = function(subject, options = {}) {
  const query = {
    subject: subject,
    isActive: true
  };
  
  if (options.class) query.class = options.class;
  if (options.section) query.section = options.section;
  if (options.status) query.status = options.status;
  if (options.academicYear) query.academicYear = options.academicYear;
  
  return this.find(query)
    .populate('studentId', 'fullname studentId class section')
    .populate('answers.answeredBy', 'fullname username teacherId')
    .sort({ lastActivityAt: -1 });
};

module.exports = mongoose.model("ClassQuestion", classQuestionSchema);

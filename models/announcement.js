const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  images: [{
    type: String, // Cloudinary URLs
  }],
  targetType: {
    type: String,
    required: true,
    enum: ['all', 'teachers', 'students', 'class', 'question'],
    default: 'all'
  },
  targetClassName: {
    type: String,
    trim: true,
    // Required only when targetType is 'class'
    required: function() {
      return this.targetType === 'class';
    }
  },
  targetSection: {
    type: String,
    trim: true,
    // Optional for class-specific announcements
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'createdByType'
  },
  createdByType: {
    type: String,
    required: true,
    enum: ['Admin', 'Teacher', 'Student']
  },
  createdByName: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  expiresAt: {
    type: Date,
    default: null // null means no expiration
  },
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    userType: {
      type: String,
      enum: ['teacher', 'student'],
      required: true
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  // For student questions
  questionType: {
    type: String,
    enum: ['general', 'homework', 'exam', 'subject', 'other'],
    required: function() {
      return this.targetType === 'question';
    }
  },
  subject: {
    type: String,
    trim: true,
    required: function() {
      return this.targetType === 'question';
    }
  },
  // Replies from teachers/admins to student questions
  replies: [{
    replyMessage: {
      type: String,
      required: true,
      trim: true
    },
    replyImages: [{
      type: String // Cloudinary URLs
    }],
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'replies.repliedByType'
    },
    repliedByType: {
      type: String,
      required: true,
      enum: ['Admin', 'Teacher']
    },
    repliedByName: {
      type: String,
      required: true,
      trim: true
    },
    repliedAt: {
      type: Date,
      default: Date.now
    },
    isAcceptedAnswer: {
      type: Boolean,
      default: false
    }
  }],
  isResolved: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient querying
announcementSchema.index({ targetType: 1, targetClass: 1, isActive: 1 });
announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ expiresAt: 1 });

// Method to check if announcement is valid (not expired)
announcementSchema.methods.isValid = function() {
  if (!this.isActive) return false;
  if (this.expiresAt && new Date() > this.expiresAt) return false;
  return true;
};

// Method to mark as read by user
announcementSchema.methods.markAsRead = function(userId, userType) {
  const existingRead = this.readBy.find(read => 
    read.userId.toString() === userId.toString() && read.userType === userType
  );
  
  if (!existingRead) {
    this.readBy.push({
      userId: userId,
      userType: userType,
      readAt: new Date()
    });
  }
};

// Method to add reply to student question
announcementSchema.methods.addReply = function(replyData, repliedBy, repliedByType, repliedByName) {
  this.replies.push({
    replyMessage: replyData.replyMessage,
    replyImages: replyData.replyImages || [],
    repliedBy: repliedBy,
    repliedByType: repliedByType,
    repliedByName: repliedByName,
    repliedAt: new Date()
  });
};

// Method to accept a reply as the answer
announcementSchema.methods.acceptReply = function(replyId) {
  const reply = this.replies.id(replyId);
  if (reply) {
    // Remove accepted status from other replies
    this.replies.forEach(r => r.isAcceptedAnswer = false);
    reply.isAcceptedAnswer = true;
    this.isResolved = true;
    return true;
  }
  return false;
};

// Static method to get student questions for class
announcementSchema.statics.getClassQuestions = function(className, section = null, filters = {}) {
  const query = {
    targetType: 'question',
    targetClass: className,
    isActive: true
  };
  
  if (section) {
    query.targetSection = section;
  }
  
  if (filters.subject) query.subject = filters.subject;
  if (filters.questionType) query.questionType = filters.questionType;
  if (filters.isResolved !== undefined) query.isResolved = filters.isResolved;
  
  return this.find(query)
    .populate('createdBy', 'fullname studentId class section')
    .populate('replies.repliedBy', 'fullname username teacherId')
    .sort({ createdAt: -1 });
};

// Static method to get announcements for specific user
announcementSchema.statics.getForUser = function(userType, userId, userClass = null, userSection = null) {
  const query = {
    isActive: true,
    $or: [
      { targetType: 'all' },
      { targetType: userType === 'teacher' ? 'teachers' : 'students' }
    ]
  };
  
  // Add class-specific announcements and questions for students
  if (userType === 'student' && userClass) {
    query.$or.push(
      {
        targetType: 'class',
        targetClass: userClass,
        $or: [
          { targetSection: { $exists: false } },
          { targetSection: null },
          { targetSection: '' },
          { targetSection: userSection }
        ]
      },
      {
        targetType: 'question',
        targetClass: userClass,
        $or: [
          { targetSection: { $exists: false } },
          { targetSection: null },
          { targetSection: '' },
          { targetSection: userSection }
        ]
      }
    );
  }
  
  // Add class questions for teachers (they can see all class questions)
  if (userType === 'teacher') {
    query.$or.push({ targetType: 'question' });
  }
  
  return this.find(query)
    .populate('createdBy', 'fullname username studentId')
    .populate('replies.repliedBy', 'fullname username teacherId')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model("Announcement", announcementSchema);

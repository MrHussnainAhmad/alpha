const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
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
  type: {
    type: String,
    required: true,
    enum: ['announcement', 'post', 'question', 'reply', 'grade', 'fee', 'general'],
    default: 'announcement'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  // Target users for this notification
  targetUsers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'targetUsers.userType'
    },
    userType: {
      type: String,
      required: true,
      enum: ['teacher', 'student']
    },
    isRead: {
      type: Boolean,
      default: false
    },
    readAt: {
      type: Date,
      default: null
    }
  }],
  // Reference to the related content (announcement, post, etc.)
  relatedContent: {
    contentType: {
      type: String,
      enum: ['announcement', 'post', 'question', 'grade', 'fee'],
      required: true
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    }
  },
  // Who created this notification
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
  // Additional data for specific notification types
  metadata: {
    targetType: String, // 'all', 'teachers', 'students', 'class'
    targetClass: String,
    targetSection: String,
    images: [String], // URLs for notification images
    actionUrl: String, // Deep link or action URL
    expiresAt: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // For tracking notification delivery
  sentCount: {
    type: Number,
    default: 0
  },
  deliveredCount: {
    type: Number,
    default: 0
  },
  readCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
notificationSchema.index({ 'targetUsers.userId': 1, 'targetUsers.userType': 1 });
notificationSchema.index({ 'targetUsers.isRead': 1 });
notificationSchema.index({ type: 1, isActive: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ 'relatedContent.contentType': 1, 'relatedContent.contentId': 1 });

// Virtual for unread count
notificationSchema.virtual('unreadCount').get(function() {
  return this.targetUsers.filter(user => !user.isRead).length;
});

// Method to mark notification as read for a specific user
notificationSchema.methods.markAsRead = function(userId, userType) {
  const targetUser = this.targetUsers.find(
    user => user.userId.toString() === userId.toString() && user.userType === userType
  );
  
  if (targetUser && !targetUser.isRead) {
    targetUser.isRead = true;
    targetUser.readAt = new Date();
    this.readCount += 1;
    return true;
  }
  return false;
};

// Method to add target user
notificationSchema.methods.addTargetUser = function(userId, userType) {
  const existingUser = this.targetUsers.find(
    user => user.userId.toString() === userId.toString() && user.userType === userType
  );
  
  if (!existingUser) {
    this.targetUsers.push({
      userId: userId,
      userType: userType,
      isRead: false
    });
    this.sentCount += 1;
    return true;
  }
  return false;
};

// Static method to create notification for announcement
notificationSchema.statics.createForAnnouncement = async function(announcement) {
  const Notification = this;
  const targetUsers = [];
  
  // Import models at the top of the function
  const Teacher = require('./teacher');
  const Student = require('./student');
  
  try {
    // Determine target users based on announcement targetType
    switch (announcement.targetType) {
      case 'all':
        // Get all verified teachers and students
        const teachers = await Teacher.find({ isVerified: true, isActive: true });
        const students = await Student.find({ isVerified: true, isActive: true });
        
        teachers.forEach(teacher => {
          targetUsers.push({
            userId: teacher._id,
            userType: 'teacher',
            isRead: false
          });
        });
        
        students.forEach(student => {
          targetUsers.push({
            userId: student._id,
            userType: 'student',
            isRead: false
          });
        });
        break;
        
      case 'teachers':
        const allTeachers = await Teacher.find({ isVerified: true, isActive: true });
        allTeachers.forEach(teacher => {
          targetUsers.push({
            userId: teacher._id,
            userType: 'teacher',
            isRead: false
          });
        });
        break;
        
      case 'students':
        const allStudents = await Student.find({ isVerified: true, isActive: true });
        allStudents.forEach(student => {
          targetUsers.push({
            userId: student._id,
            userType: 'student',
            isRead: false
          });
        });
        break;
        
      case 'class':
        const classStudents = await Student.find({
          isVerified: true,
          isActive: true,
          className: announcement.targetClassName,
          ...(announcement.targetSection && { section: announcement.targetSection })
        });
        
        classStudents.forEach(student => {
          targetUsers.push({
            userId: student._id,
            userType: 'student',
            isRead: false
          });
        });
        break;
    }
    
    if (targetUsers.length === 0) {
      console.log('No target users found for notification');
      return null;
    }
    
    // Create notification
    const notification = new Notification({
      title: announcement.title,
      message: announcement.message.length > 100 ? announcement.message.substring(0, 100) + '...' : announcement.message,
      type: 'announcement',
      priority: announcement.priority,
      targetUsers: targetUsers,
      relatedContent: {
        contentType: 'announcement',
        contentId: announcement._id
      },
      createdBy: announcement.createdBy,
      createdByType: announcement.createdByType,
      createdByName: announcement.createdByName,
      metadata: {
        targetType: announcement.targetType,
        targetClass: announcement.targetClassName,
        targetSection: announcement.targetSection,
        images: announcement.images,
        actionUrl: `announcement://${announcement._id}`,
        expiresAt: announcement.expiresAt
      },
      sentCount: targetUsers.length
    });
    
    await notification.save();
    console.log(`✅ Created notification for ${targetUsers.length} users`);
    
    // Send real-time notification via WebSocket
    try {
      const socketService = require('../services/socketService');
      socketService.sendAnnouncementNotification(announcement, targetUsers);
    } catch (socketError) {
      console.error('Error sending real-time notification:', socketError);
      // Don't fail the notification creation if real-time sending fails
    }
    
    return notification;
    
  } catch (error) {
    console.error('Error creating notification for announcement:', error);
    throw error;
  }
};

// Check if the model already exists before compiling
module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

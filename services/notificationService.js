const { Expo } = require('expo-server-sdk');
const Teacher = require('../models/teacher');
const Student = require('../models/student');

// Create a new Expo SDK client
const expo = new Expo();

class NotificationService {
  // Save or update push token for a user
  static async savePushToken(userId, userType, token, deviceId) {
    try {
      let user;
      
      if (userType === 'teacher') {
        user = await Teacher.findById(userId);
      } else if (userType === 'student') {
        user = await Student.findById(userId);
      }
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Check if token is valid
      if (!Expo.isExpoPushToken(token)) {
        throw new Error(`Push token ${token} is not a valid Expo push token`);
      }
      
      // Remove existing token for the same device
      user.pushTokens = user.pushTokens.filter(t => t.deviceId !== deviceId);
      
      // Add new token
      user.pushTokens.push({
        token,
        deviceId,
        addedAt: new Date()
      });
      
      await user.save();
      return { success: true, message: 'Push token saved successfully' };
    } catch (error) {
      console.error('Error saving push token:', error);
      throw error;
    }
  }
  
  // Send push notifications to multiple recipients
  static async sendPushNotifications(tokens, title, body, data = {}) {
    // Create the messages that you want to send to clients
    const messages = [];
    
    for (const pushToken of tokens) {
      // Check that all your push tokens appear to be valid Expo push tokens
      if (!Expo.isExpoPushToken(pushToken)) {
        console.error(`Push token ${pushToken} is not a valid Expo push token`);
        continue;
      }
      
      // Construct a message
      messages.push({
        to: pushToken,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high',
        badge: 1,
      });
    }
    
    // The Expo push notification service accepts batches of notifications
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    
    // Send the chunks to the Expo push notification service
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending notification chunk:', error);
      }
    }
    
    return tickets;
  }
  
  // Send notification to all teachers
  static async notifyAllTeachers(title, body, data = {}) {
    try {
      const teachers = await Teacher.find({ 
        isVerified: true, 
        isActive: true,
        'pushTokens.0': { $exists: true }
      });
      
      const tokens = [];
      teachers.forEach(teacher => {
        teacher.pushTokens.forEach(tokenObj => {
          tokens.push(tokenObj.token);
        });
      });
      
      if (tokens.length > 0) {
        return await this.sendPushNotifications(tokens, title, body, data);
      }
      
      return [];
    } catch (error) {
      console.error('Error notifying teachers:', error);
      throw error;
    }
  }
  
  // Send notification to all students
  static async notifyAllStudents(title, body, data = {}) {
    try {
      const students = await Student.find({ 
        isVerified: true, 
        isActive: true,
        'pushTokens.0': { $exists: true }
      });
      
      const tokens = [];
      students.forEach(student => {
        student.pushTokens.forEach(tokenObj => {
          tokens.push(tokenObj.token);
        });
      });
      
      if (tokens.length > 0) {
        return await this.sendPushNotifications(tokens, title, body, data);
      }
      
      return [];
    } catch (error) {
      console.error('Error notifying students:', error);
      throw error;
    }
  }
  
  // Send notification to students of a specific class
  static async notifyClassStudents(classId, title, body, data = {}) {
    try {
      const students = await Student.find({ 
        class: classId,
        isVerified: true, 
        isActive: true,
        'pushTokens.0': { $exists: true }
      });
      
      const tokens = [];
      students.forEach(student => {
        student.pushTokens.forEach(tokenObj => {
          tokens.push(tokenObj.token);
        });
      });
      
      if (tokens.length > 0) {
        return await this.sendPushNotifications(tokens, title, body, data);
      }
      
      return [];
    } catch (error) {
      console.error('Error notifying class students:', error);
      throw error;
    }
  }
  
  // Send notification based on post recipients
  static async notifyPostRecipients(post) {
    try {
      const title = 'Notification from Admin';
      const body = post.content.substring(0, 100) + (post.content.length > 100 ? '...' : '');
      const data = {
        postId: post._id.toString(),
        type: 'school_post'
      };
      
      let results = [];
      
      if (post.recipients === 'teachers') {
        results = await this.notifyAllTeachers(title, body, data);
      } else if (post.recipients === 'students') {
        results = await this.notifyAllStudents(title, body, data);
      } else if (post.recipients === 'both') {
        const teacherResults = await this.notifyAllTeachers(title, body, data);
        const studentResults = await this.notifyAllStudents(title, body, data);
        results = [...teacherResults, ...studentResults];
      } else if (post.recipients === 'class' && post.targetClass) {
        results = await this.notifyClassStudents(post.targetClass, title, body, data);
      }
      
      return results;
    } catch (error) {
      console.error('Error notifying post recipients:', error);
      throw error;
    }
  }
  
  // Remove push token when user logs out
  static async removePushToken(userId, userType, deviceId) {
    try {
      let user;
      
      if (userType === 'teacher') {
        user = await Teacher.findById(userId);
      } else if (userType === 'student') {
        user = await Student.findById(userId);
      }
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Remove token for the device
      user.pushTokens = user.pushTokens.filter(t => t.deviceId !== deviceId);
      
      await user.save();
      return { success: true, message: 'Push token removed successfully' };
    } catch (error) {
      console.error('Error removing push token:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;

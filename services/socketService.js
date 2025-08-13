const socketIo = require('socket.io');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // Map to store user connections
  }

  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`🔌 User connected: ${socket.id}`);

      // Handle user authentication
      socket.on('authenticate', (data) => {
        const { userId, userType, token } = data;
        
        if (userId && userType) {
          // Store user connection
          this.connectedUsers.set(socket.id, {
            userId: userId,
            userType: userType,
            socketId: socket.id,
            connectedAt: new Date()
          });

          // Join user-specific room
          socket.join(`user_${userType}_${userId}`);
          
          console.log(`✅ User authenticated: ${userType} - ${userId}`);
          socket.emit('authenticated', { success: true });
        } else {
          socket.emit('error', { message: 'Authentication failed' });
        }
      });

      // Handle user joining specific rooms
      socket.on('join-room', (roomName) => {
        socket.join(roomName);
        console.log(`👥 User ${socket.id} joined room: ${roomName}`);
      });

      // Handle user leaving rooms
      socket.on('leave-room', (roomName) => {
        socket.leave(roomName);
        console.log(`👋 User ${socket.id} left room: ${roomName}`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        const userInfo = this.connectedUsers.get(socket.id);
        if (userInfo) {
          console.log(`🔌 User disconnected: ${userInfo.userType} - ${userInfo.userId}`);
          this.connectedUsers.delete(socket.id);
        } else {
          console.log(`🔌 Anonymous user disconnected: ${socket.id}`);
        }
      });

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });

    console.log('🚀 Socket.IO service initialized');
  }

  // Send notification to specific user
  sendToUser(userId, userType, notification) {
    const roomName = `user_${userType}_${userId}`;
    this.io.to(roomName).emit('new-notification', {
      type: 'notification',
      data: notification
    });
    console.log(`📱 Notification sent to ${userType} ${userId}`);
  }

  // Send notification to multiple users
  sendToUsers(userIds, userType, notification) {
    userIds.forEach(userId => {
      this.sendToUser(userId, userType, notification);
    });
  }

  // Send notification to all users of a specific type
  sendToAllUsers(userType, notification) {
    this.io.to(`all_${userType}`).emit('new-notification', {
      type: 'notification',
      data: notification
    });
    console.log(`📢 Notification sent to all ${userType}s`);
  }

  // Send notification to specific class
  sendToClass(className, section, notification) {
    const roomName = `class_${className}_${section}`;
    this.io.to(roomName).emit('new-notification', {
      type: 'notification',
      data: notification
    });
    console.log(`📚 Notification sent to class ${className}${section}`);
  }

  // Broadcast to all connected users
  broadcastToAll(notification) {
    this.io.emit('new-notification', {
      type: 'notification',
      data: notification
    });
    console.log('🌐 Notification broadcasted to all users');
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Get connected users by type
  getConnectedUsersByType(userType) {
    const users = [];
    this.connectedUsers.forEach((userInfo, socketId) => {
      if (userInfo.userType === userType) {
        users.push({
          ...userInfo,
          socketId
        });
      }
    });
    return users;
  }

  // Check if user is online
  isUserOnline(userId, userType) {
    for (const [socketId, userInfo] of this.connectedUsers) {
      if (userInfo.userId === userId && userInfo.userType === userType) {
        return true;
      }
    }
    return false;
  }

  // Send system message
  sendSystemMessage(userId, userType, message) {
    const roomName = `user_${userType}_${userId}`;
    this.io.to(roomName).emit('system-message', {
      type: 'system',
      message: message,
      timestamp: new Date()
    });
  }

  // Send announcement notification
  sendAnnouncementNotification(announcement, targetUsers) {
    // Group users by type for efficient sending
    const teachers = targetUsers.filter(user => user.userType === 'teacher');
    const students = targetUsers.filter(user => user.userType === 'student');

    // Send to teachers
    if (teachers.length > 0) {
      const teacherIds = teachers.map(user => user.userId);
      this.sendToUsers(teacherIds, 'teacher', {
        id: announcement._id,
        title: announcement.title,
        message: announcement.message,
        type: 'announcement',
        priority: announcement.priority,
        createdBy: announcement.createdByName,
        createdAt: announcement.createdAt,
        targetType: announcement.targetType,
        actionUrl: `announcement://${announcement._id}`
      });
    }

    // Send to students
    if (students.length > 0) {
      const studentIds = students.map(user => user.userId);
      this.sendToUsers(studentIds, 'student', {
        id: announcement._id,
        title: announcement.title,
        message: announcement.message,
        type: 'announcement',
        priority: announcement.priority,
        createdBy: announcement.createdByName,
        createdAt: announcement.createdAt,
        targetType: announcement.targetType,
        actionUrl: `announcement://${announcement._id}`
      });
    }

    console.log(`📢 Real-time announcement sent to ${targetUsers.length} users`);
  }
}

// Export singleton instance
module.exports = new SocketService();


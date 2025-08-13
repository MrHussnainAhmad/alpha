const express = require("express");
const Notification = require("../models/notification");
const { authenticateToken, authenticateAdmin, authenticateTeacher } = require("../middleware/auth");
const NotificationService = require("../services/notificationService");

const router = express.Router();

// Get user's notifications (paginated)
router.get("/my-notifications", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const skip = (page - 1) * limit;
    
    const userType = req.user.userType === 'teacher' ? 'teacher' : 'student';
    
    // Build query
    const query = {
      'targetUsers.userId': req.user.id,
      'targetUsers.userType': userType,
      isActive: true
    };
    
    if (unreadOnly === 'true') {
      query['targetUsers.isRead'] = false;
    }
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('relatedContent.contentId', 'title message images targetType targetClassName targetSection')
      .lean();
    
    // Get total count for pagination
    const total = await Notification.countDocuments(query);
    
    // Get unread count
    const unreadCount = await Notification.countDocuments({
      'targetUsers.userId': req.user.id,
      'targetUsers.userType': userType,
      'targetUsers.isRead': false,
      isActive: true
    });
    
    res.status(200).json({
      success: true,
      notifications: notifications.map(notification => ({
        id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        isRead: notification.targetUsers.find(
          user => user.userId.toString() === req.user.id && user.userType === userType
        )?.isRead || false,
        readAt: notification.targetUsers.find(
          user => user.userId.toString() === req.user.id && user.userType === userType
        )?.readAt || null,
        relatedContent: notification.relatedContent,
        createdBy: notification.createdBy,
        createdByType: notification.createdByType,
        createdByName: notification.createdByName,
        metadata: notification.metadata,
        createdAt: notification.createdAt
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      },
      unreadCount
    });
    
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch notifications' 
    });
  }
});

// Mark notification as read
router.post("/:notificationId/read", authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userType = req.user.userType === 'teacher' ? 'teacher' : 'student';
    
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ 
        success: false,
        message: 'Notification not found' 
      });
    }
    
    // Check if user is target of this notification
    const isTarget = notification.targetUsers.some(
      user => user.userId.toString() === req.user.id && user.userType === userType
    );
    
    if (!isTarget) {
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to mark this notification as read' 
      });
    }
    
    // Mark as read
    const marked = notification.markAsRead(req.user.id, userType);
    if (marked) {
      await notification.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      isRead: true
    });
    
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to mark notification as read' 
    });
  }
});

// Mark all notifications as read
router.post("/mark-all-read", authenticateToken, async (req, res) => {
  try {
    const userType = req.user.userType === 'teacher' ? 'teacher' : 'student';
    
    const result = await Notification.updateMany(
      {
        'targetUsers.userId': req.user.id,
        'targetUsers.userType': userType,
        'targetUsers.isRead': false,
        isActive: true
      },
      {
        $set: {
          'targetUsers.$.isRead': true,
          'targetUsers.$.readAt': new Date()
        }
      }
    );
    
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      updatedCount: result.modifiedCount
    });
    
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to mark notifications as read' 
    });
  }
});

// Get unread count
router.get("/unread-count", authenticateToken, async (req, res) => {
  try {
    const userType = req.user.userType === 'teacher' ? 'teacher' : 'student';
    
    const unreadCount = await Notification.countDocuments({
      'targetUsers.userId': req.user.id,
      'targetUsers.userType': userType,
      'targetUsers.isRead': false,
      isActive: true
    });
    
    res.status(200).json({
      success: true,
      unreadCount
    });
    
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch unread count' 
    });
  }
});

// Delete notification (for user)
router.delete("/:notificationId", authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userType = req.user.userType === 'teacher' ? 'teacher' : 'student';
    
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ 
        success: false,
        message: 'Notification not found' 
      });
    }
    
    // Remove user from target users
    notification.targetUsers = notification.targetUsers.filter(
      user => !(user.userId.toString() === req.user.id && user.userType === userType)
    );
    
    // If no more target users, deactivate the notification
    if (notification.targetUsers.length === 0) {
      notification.isActive = false;
    }
    
    await notification.save();
    
    res.status(200).json({
      success: true,
      message: 'Notification deleted'
    });
    
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete notification' 
    });
  }
});

// Admin: Get notification statistics
router.get("/admin/stats", authenticateAdmin, async (req, res) => {
  try {
    const totalNotifications = await Notification.countDocuments();
    const activeNotifications = await Notification.countDocuments({ isActive: true });
    const totalSent = await Notification.aggregate([
      { $group: { _id: null, total: { $sum: '$sentCount' } } }
    ]);
    const totalRead = await Notification.aggregate([
      { $group: { _id: null, total: { $sum: '$readCount' } } }
    ]);
    
    // Notifications by type
    const byType = await Notification.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    
    // Recent notifications (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentNotifications = await Notification.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });
    
    res.status(200).json({
      success: true,
      stats: {
        totalNotifications,
        activeNotifications,
        totalSent: totalSent[0]?.total || 0,
        totalRead: totalRead[0]?.total || 0,
        byType,
        recentNotifications
      }
    });
    
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch notification statistics' 
    });
  }
});

// Admin: Get all notifications (for management)
router.get("/admin/all", authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, type, priority } = req.query;
    const skip = (page - 1) * limit;
    
    const query = {};
    if (type) query.type = type;
    if (priority) query.priority = priority;
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('relatedContent.contentId', 'title message targetType')
      .lean();
    
    const total = await Notification.countDocuments(query);
    
    res.status(200).json({
      success: true,
      notifications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching all notifications:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch notifications' 
    });
  }
});

// Save or update push token for authenticated user
router.post("/push-token", authenticateToken, async (req, res) => {
  try {
    const { token, deviceId } = req.body;
    
    if (!token || !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Token and deviceId are required'
      });
    }
    
    const result = await NotificationService.savePushToken(
      req.user.id,
      req.user.userType,
      token,
      deviceId
    );
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error saving push token:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to save push token'
    });
  }
});

// Remove push token on logout
router.delete("/push-token", authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'DeviceId is required'
      });
    }
    
    const result = await NotificationService.removePushToken(
      req.user.id,
      req.user.userType,
      deviceId
    );
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error removing push token:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to remove push token'
    });
  }
});

// Admin: Send test notification
router.post("/admin/test-notification", authenticateAdmin, async (req, res) => {
  try {
    const { target, title, body } = req.body;
    
    let results = [];
    if (target === 'teachers') {
      results = await NotificationService.notifyAllTeachers(title, body);
    } else if (target === 'students') {
      results = await NotificationService.notifyAllStudents(title, body);
    } else if (target === 'both') {
      const teacherResults = await NotificationService.notifyAllTeachers(title, body);
      const studentResults = await NotificationService.notifyAllStudents(title, body);
      results = [...teacherResults, ...studentResults];
    }
    
    res.status(200).json({
      success: true,
      message: 'Test notification sent',
      sentCount: results.length
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification'
    });
  }
});

// Manual push token registration (for testing without auth)
router.post("/manual-register-token", async (req, res) => {
  try {
    const { userId, userType, token, deviceId } = req.body;
    
    if (!userId || !userType || !token || !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'userId, userType, token, and deviceId are required'
      });
    }
    
    const result = await NotificationService.savePushToken(
      userId,
      userType,
      token,
      deviceId
    );
    
    res.status(200).json({
      success: true,
      message: 'Push token registered successfully',
      ...result
    });
  } catch (error) {
    console.error('Error manually registering push token:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to register push token'
    });
  }
});

// Send immediate test notification to specific token (no auth required)
router.post("/test-direct", async (req, res) => {
  try {
    const { token, title, body } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }
    
    const results = await NotificationService.sendPushNotifications(
      [token],
      title || 'Direct Test Notification',
      body || 'This is a direct test notification!',
      { type: 'direct_test', timestamp: new Date().toISOString() }
    );
    
    res.status(200).json({
      success: true,
      message: 'Direct test notification sent',
      results: results
    });
  } catch (error) {
    console.error('Error sending direct test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send direct test notification'
    });
  }
});

module.exports = router;


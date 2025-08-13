const mongoose = require("mongoose");
const Teacher = require("../models/teacher");
const Student = require("../models/student");
const dotenv = require("dotenv");
const cron = require("node-cron");

dotenv.config();

// Connect to MongoDB (only if not already connected)
const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log("✅ MongoDB connected for cleanup job");
    } else {
      console.log("✅ Using existing MongoDB connection");
    }
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    throw error;
  }
};

// Cleanup function for unverified accounts
const cleanupUnverifiedAccounts = async () => {
  try {
    console.log(`🧹 Starting cleanup of unverified accounts at ${new Date().toISOString()}`);
    
    // Calculate 12 hours ago
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    
    // Get current time to check if it's after 5:00 AM
    const now = new Date();
    const currentHour = now.getHours();
    const isAfter5AM = currentHour >= 5;
    
    console.log(`⏰ Current time: ${now.toLocaleString()}, Hour: ${currentHour}, After 5 AM: ${isAfter5AM}`);
    
    // Build query conditions
    let queryConditions = {};
    
    // If it's after 5:00 AM, also delete accounts created before 5:00 AM today
    if (isAfter5AM) {
      const today5AM = new Date(now);
      today5AM.setHours(5, 0, 0, 0);
      
      // Use OR condition to delete accounts that are either:
      // 1. More than 12 hours old OR
      // 2. Created before 5:00 AM today
      queryConditions = {
        isVerified: false,
        $or: [
          { createdAt: { $lt: twelveHoursAgo } }, // 12 hours old
          { createdAt: { $lt: today5AM } } // Before 5:00 AM today
        ]
      };
      
      console.log(`🌅 After 5 AM - will delete unverified accounts:`);
      console.log(`   - Older than 12 hours (before ${twelveHoursAgo.toLocaleString()})`);
      console.log(`   - OR created before 5:00 AM today (${today5AM.toLocaleString()})`);
    } else {
      // Before 5 AM, only delete accounts older than 12 hours
      queryConditions = {
        isVerified: false,
        createdAt: { $lt: twelveHoursAgo }
      };
      console.log(`🌙 Before 5 AM - will only delete unverified accounts older than 12 hours (before ${twelveHoursAgo.toLocaleString()})`);
    }
    
    // Delete unverified teachers
    const deletedTeachers = await Teacher.deleteMany(queryConditions);
    
    // Delete unverified students
    const deletedStudents = await Student.deleteMany(queryConditions);
    
    console.log(`✅ Cleanup completed:`);
    console.log(`   - Deleted ${deletedTeachers.deletedCount} unverified teachers`);
    console.log(`   - Deleted ${deletedStudents.deletedCount} unverified students`);
    
    return {
      teachersDeleted: deletedTeachers.deletedCount,
      studentsDeleted: deletedStudents.deletedCount,
      timestamp: new Date().toISOString(),
      isAfter5AM: isAfter5AM
    };
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  }
};

// Manual cleanup function (can be called via API)
const manualCleanup = async () => {
  await connectDB();
  const result = await cleanupUnverifiedAccounts();
  await mongoose.connection.close();
  return result;
};

// Schedule cleanup job for 5:00 AM every day
const startScheduledCleanup = async () => {
  await connectDB();
  
  // Schedule for 5:00 AM every day
  cron.schedule('0 5 * * *', async () => {
    console.log('⏰ Running scheduled cleanup at 5:00 AM');
    try {
      await cleanupUnverifiedAccounts();
    } catch (error) {
      console.error('❌ 5 AM cleanup failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Karachi" // Pakistan timezone
  });
  
  // Also schedule for every hour to check for 12-hour old accounts
  cron.schedule('0 * * * *', async () => {
    console.log('⏰ Running hourly cleanup check');
    try {
      await cleanupUnverifiedAccounts();
    } catch (error) {
      console.error('❌ Hourly cleanup failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Karachi"
  });
  
  console.log('📅 Cleanup jobs scheduled:');
  console.log('   - Daily at 5:00 AM (Pakistan Time)');
  console.log('   - Every hour at :00 (to check for 12-hour old accounts)');
  
  // Also run cleanup on startup if there are old unverified accounts
  console.log('🚀 Running initial cleanup check...');
  try {
    await cleanupUnverifiedAccounts();
  } catch (error) {
    console.error('❌ Initial cleanup failed:', error);
  }
};

// Export for use in other files
module.exports = {
  cleanupUnverifiedAccounts,
  manualCleanup,
  startScheduledCleanup
};

// If running directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === '--manual') {
    // Run manual cleanup
    manualCleanup()
      .then((result) => {
        console.log('Manual cleanup completed:', result);
        process.exit(0);
      })
      .catch((error) => {
        console.error('Manual cleanup failed:', error);
        process.exit(1);
      });
  } else {
    // Start scheduled cleanup
    startScheduledCleanup()
      .catch((error) => {
        console.error('Failed to start scheduled cleanup:', error);
        process.exit(1);
      });
  }
}

const mongoose = require("mongoose");
const Teacher = require("../models/teacher");
const Student = require("../models/student");
const dotenv = require("dotenv");
const cron = require("node-cron");

dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected for cleanup job");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
};

// Cleanup function for unverified accounts
const cleanupUnverifiedAccounts = async () => {
  try {
    console.log(`🧹 Starting cleanup of unverified accounts at ${new Date().toISOString()}`);
    
    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Delete unverified teachers created more than 24 hours ago
    const deletedTeachers = await Teacher.deleteMany({
      isVerified: false,
      createdAt: { $lt: twentyFourHoursAgo }
    });
    
    // Delete unverified students created more than 24 hours ago
    const deletedStudents = await Student.deleteMany({
      isVerified: false,
      createdAt: { $lt: twentyFourHoursAgo }
    });
    
    console.log(`✅ Cleanup completed:`);
    console.log(`   - Deleted ${deletedTeachers.deletedCount} unverified teachers`);
    console.log(`   - Deleted ${deletedStudents.deletedCount} unverified students`);
    
    return {
      teachersDeleted: deletedTeachers.deletedCount,
      studentsDeleted: deletedStudents.deletedCount,
      timestamp: new Date().toISOString()
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
    await cleanupUnverifiedAccounts();
  }, {
    scheduled: true,
    timezone: "Asia/Karachi" // Adjust timezone as needed
  });
  
  console.log('📅 Cleanup job scheduled for 5:00 AM daily');
  
  // Also run cleanup on startup if there are old unverified accounts
  console.log('🚀 Running initial cleanup check...');
  await cleanupUnverifiedAccounts();
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

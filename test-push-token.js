const mongoose = require('mongoose');
const Teacher = require('./models/teacher');
const Student = require('./models/student');
const NotificationService = require('./services/notificationService');

// Connect to MongoDB
require('dotenv').config();
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testManualPushToken() {
  try {
    console.log('🧪 Manual Push Token Registration Test\n');

    // Get all active users
    const teachers = await Teacher.find({ isActive: true, isVerified: true }).select('_id fullname email customTeacherId');
    const students = await Student.find({ isActive: true, isVerified: true }).select('_id fullname email customStudentId');

    console.log(`📊 Found ${teachers.length} verified teachers and ${students.length} verified students\n`);

    if (teachers.length === 0 && students.length === 0) {
      console.log('❌ No verified users found. Make sure users are logged in and verified.');
      return;
    }

    // Show users for selection
    console.log('👥 Available users:');
    teachers.forEach((teacher, index) => {
      console.log(`  T${index + 1}. ${teacher.fullname} (${teacher.customTeacherId || 'No ID'}) - Teacher`);
    });
    students.forEach((student, index) => {
      console.log(`  S${index + 1}. ${student.fullname} (${student.customStudentId || 'No ID'}) - Student`);
    });

    console.log('\n📱 To manually register push tokens:');
    console.log('1. Use Expo Go or your development build to get an Expo push token');
    console.log('2. Modify this script to add the actual push tokens for your devices');
    console.log('3. Run this script to register tokens in the database\n');

    // Example of how to manually add push tokens
    // Uncomment and modify these lines with real tokens from your devices:
    
    console.log('💡 Example usage (uncomment and modify with real tokens):');
    console.log(`
    // For admin device (if you have an admin user):
    if (teachers.length > 0) {
      const testToken = 'ExponentPushToken[YOUR_ACTUAL_TOKEN_HERE]';
      const deviceId = 'admin_device_001';
      
      await NotificationService.savePushToken(
        teachers[0]._id,
        'teacher',
        testToken,
        deviceId
      );
      console.log('✅ Admin token registered');
    }

    // For student device:
    if (students.length > 0) {
      const studentToken = 'ExponentPushToken[YOUR_STUDENT_TOKEN_HERE]';
      const studentDeviceId = 'student_device_001';
      
      await NotificationService.savePushToken(
        students[0]._id,
        'student',
        studentToken,
        studentDeviceId
      );
      console.log('✅ Student token registered');
    }
    `);

    console.log('🔧 To get your actual push tokens:');
    console.log('1. Open your mobile app');
    console.log('2. Check the console logs for "Push token:" messages');
    console.log('3. Copy those tokens and replace them in this script');
    console.log('4. Run this script again to register them\n');

    // Get the actual user IDs for easy reference
    const adminUser = teachers.length > 0 ? teachers[0] : null;
    const firstStudent = students.length > 0 ? students[0] : null;
    const secondStudent = students.length > 1 ? students[1] : null;

    // MANUAL TOKEN REGISTRATION
    // STEP 1: Get tokens from your mobile app console logs
    // STEP 2: Uncomment and replace the tokens below
    // STEP 3: Run this script again
    
    const MANUAL_TOKENS = [
      // ADMIN DEVICE TOKEN (Teacher account):
      // {
      //   userId: '689ae6d691d0cf9a2d9f7981',  // Teacher ID
      //   userType: 'teacher',
      //   token: 'ExponentPushToken[PASTE_YOUR_ADMIN_TOKEN_HERE]',
      //   deviceId: 'admin_device_001'
      // },
      
      // STUDENT DEVICE TOKEN:
      // {
      //   userId: '689ae71091d0cf9a2d9f7984',  // Student ID (choose one)
      //   userType: 'student',
      //   token: 'ExponentPushToken[PASTE_YOUR_STUDENT_TOKEN_HERE]',
      //   deviceId: 'student_device_001'
      // }
    ];
    
    console.log('\n🚀 QUICK SETUP:');
    console.log('1. Get push tokens from your mobile app console logs');
    console.log('2. Edit this file and uncomment/replace the tokens above');
    console.log('3. Run: node test-push-token.js');
    console.log('4. Test notifications!');
    console.log();
    console.log('📱 Your User IDs:');
    console.log(`   Admin (Teacher): 689ae6d691d0cf9a2d9f7981`);
    console.log(`   Student 1: 689ae71091d0cf9a2d9f7984`);
    console.log(`   Student 2: 689bd8829a280717762ebe1b`);
    console.log();
    console.log('💡 Example token format: ExponentPushToken[xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx]');
    
    
    console.log('\n📋 Copy these IDs for token registration:');
    if (adminUser) {
      console.log(`   Admin/Teacher ID: ${adminUser._id}`);
      console.log(`   Admin Name: ${adminUser.fullname}`);
    }
    if (firstStudent) {
      console.log(`   Student 1 ID: ${firstStudent._id}`);
      console.log(`   Student 1 Name: ${firstStudent.fullname}`);
    }
    if (secondStudent) {
      console.log(`   Student 2 ID: ${secondStudent._id}`);
      console.log(`   Student 2 Name: ${secondStudent.fullname}`);
    }

    if (MANUAL_TOKENS.length > 0) {
      console.log('🚀 Registering manual tokens...\n');
      
      for (const tokenData of MANUAL_TOKENS) {
        try {
          await NotificationService.savePushToken(
            tokenData.userId,
            tokenData.userType,
            tokenData.token,
            tokenData.deviceId
          );
          console.log(`✅ Token registered for ${tokenData.userType} (${tokenData.deviceId})`);
        } catch (error) {
          console.error(`❌ Failed to register token for ${tokenData.userType}:`, error.message);
        }
      }

      // Test notification
      console.log('\n📨 Sending test notification...');
      const results = await NotificationService.sendPushNotifications(
        MANUAL_TOKENS.map(t => t.token),
        'Manual Test Notification',
        'This is a test notification sent via manual script!',
        { type: 'manual_test', timestamp: new Date().toISOString() }
      );

      console.log(`✅ Test notification sent! Results: ${results.length} tickets`);
    } else {
      console.log('ℹ️  No manual tokens configured. Add your tokens to MANUAL_TOKENS array above.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

testManualPushToken();

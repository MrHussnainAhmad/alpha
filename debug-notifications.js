const mongoose = require('mongoose');
const Teacher = require('./models/teacher');
const Student = require('./models/student');
const NotificationService = require('./services/notificationService');

// Connect to MongoDB
require('dotenv').config();
mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/alpha', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function debugNotifications() {
  try {
    console.log('🔍 Starting push notification debug...\n');

    // 1. Check database connection
    console.log('📡 Database connection status:', mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected');

    // 2. Check for teachers with push tokens
    console.log('\n👨‍🏫 Checking teachers with push tokens...');
    const teachersWithTokens = await Teacher.find({ 
      isVerified: true, 
      isActive: true,
      'pushTokens.0': { $exists: true }
    }).select('fullname email pushTokens customTeacherId');

    console.log(`Found ${teachersWithTokens.length} teachers with push tokens:`);
    teachersWithTokens.forEach((teacher, index) => {
      console.log(`  ${index + 1}. ${teacher.fullname} (${teacher.customTeacherId || 'No ID'})`);
      teacher.pushTokens.forEach((token, tokenIndex) => {
        console.log(`     Token ${tokenIndex + 1}: ${token.token.substring(0, 20)}...`);
        console.log(`     Device: ${token.deviceId || 'Unknown'}`);
        console.log(`     Added: ${token.addedAt || 'Unknown'}`);
      });
    });

    // 3. Check for students with push tokens
    console.log('\n👨‍🎓 Checking students with push tokens...');
    const studentsWithTokens = await Student.find({ 
      isVerified: true, 
      isActive: true,
      'pushTokens.0': { $exists: true }
    }).select('fullname email pushTokens customStudentId');

    console.log(`Found ${studentsWithTokens.length} students with push tokens:`);
    studentsWithTokens.forEach((student, index) => {
      console.log(`  ${index + 1}. ${student.fullname} (${student.customStudentId || 'No ID'})`);
      student.pushTokens.forEach((token, tokenIndex) => {
        console.log(`     Token ${tokenIndex + 1}: ${token.token.substring(0, 20)}...`);
        console.log(`     Device: ${token.deviceId || 'Unknown'}`);
        console.log(`     Added: ${token.addedAt || 'Unknown'}`);
      });
    });

    // 4. Test sending a notification to all found tokens
    const allTokens = [];
    teachersWithTokens.forEach(teacher => {
      teacher.pushTokens.forEach(tokenObj => {
        allTokens.push(tokenObj.token);
      });
    });
    studentsWithTokens.forEach(student => {
      student.pushTokens.forEach(tokenObj => {
        allTokens.push(tokenObj.token);
      });
    });

    console.log(`\n📱 Total tokens found: ${allTokens.length}`);

    if (allTokens.length > 0) {
      console.log('\n🚀 Sending test notification...');
      try {
        const results = await NotificationService.sendPushNotifications(
          allTokens,
          'Debug Test Notification',
          'This is a test notification from the debug script. If you receive this, push notifications are working!',
          { type: 'debug_test', timestamp: new Date().toISOString() }
        );

        console.log(`✅ Notification sent successfully!`);
        console.log(`📊 Results: ${results.length} tickets received`);
        
        // Check for any errors in the tickets
        const errors = results.filter(ticket => ticket.status === 'error');
        const success = results.filter(ticket => ticket.status === 'ok');
        
        console.log(`   Success: ${success.length}`);
        console.log(`   Errors: ${errors.length}`);
        
        if (errors.length > 0) {
          console.log('\n❌ Error details:');
          errors.forEach((error, index) => {
            console.log(`   ${index + 1}. ${error.message || error.details?.error || 'Unknown error'}`);
          });
        }

      } catch (error) {
        console.error('❌ Failed to send test notification:', error.message);
      }
    } else {
      console.log('⚠️  No push tokens found. Make sure devices are logged in and tokens are registered.');
    }

    // 5. Check all teachers and students (including those without tokens)
    console.log('\n📊 Overall statistics:');
    const totalTeachers = await Teacher.countDocuments({ isActive: true });
    const totalStudents = await Student.countDocuments({ isActive: true });
    const verifiedTeachers = await Teacher.countDocuments({ isActive: true, isVerified: true });
    const verifiedStudents = await Student.countDocuments({ isActive: true, isVerified: true });

    console.log(`   Total active teachers: ${totalTeachers}`);
    console.log(`   Verified teachers: ${verifiedTeachers}`);
    console.log(`   Teachers with push tokens: ${teachersWithTokens.length}`);
    console.log(`   Total active students: ${totalStudents}`);
    console.log(`   Verified students: ${verifiedStudents}`);
    console.log(`   Students with push tokens: ${studentsWithTokens.length}`);

    console.log('\n✅ Debug completed!');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

debugNotifications();

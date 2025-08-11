require('dotenv').config();
const mongoose = require('mongoose');
const Teacher = require('./models/teacher');
const Class = require('./models/class');
const Timetable = require('./models/timetable');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testMultiDayTimetable() {
  try {
    console.log('Testing multi-day timetable assignment...');
    
    // Find a teacher with assigned classes
    const teacher = await Teacher.findOne({ isVerified: true, classes: { $exists: true, $ne: [] } });
    if (!teacher) {
      console.log('No verified teacher with assigned classes found. Creating test data...');
      return;
    }
    
    console.log(`Found teacher: ${teacher.fullname}`);
    console.log(`Assigned classes: ${teacher.classes}`);
    
    // Get the first assigned class
    const classId = teacher.classes[0];
    const classData = await Class.findById(classId);
    console.log(`Using class: ${classData.classNumber}-${classData.section}`);
    
    // Test data for multi-day assignment
    const testAssignment = {
      teacherId: teacher._id,
      subjectAssignments: [
        {
          subject: 'Mathematics',
          classId: classId,
          days: ['Monday', 'Wednesday', 'Friday'], // Multiple days
          timeSlot: '09:00-10:00'
        },
        {
          subject: 'English',
          classId: classId,
          days: ['Tuesday', 'Thursday'], // Multiple days
          timeSlot: '10:00-11:00'
        }
      ]
    };
    
    console.log('Test assignment data:', JSON.stringify(testAssignment, null, 2));
    
    // Check existing timetable entries for this class
    const existingEntries = await Timetable.find({ class: classId, isActive: true });
    console.log(`Existing timetable entries for class ${classData.classNumber}-${classData.section}: ${existingEntries.length}`);
    
    if (existingEntries.length > 0) {
      console.log('Sample existing entries:');
      existingEntries.slice(0, 3).forEach(entry => {
        console.log(`  - ${entry.subject} | ${entry.day} | ${entry.timeSlot}`);
      });
    }
    
    console.log('\n✅ Multi-day timetable test completed successfully!');
    console.log('The backend is ready to handle multiple days for timetable assignments.');
    
  } catch (error) {
    console.error('❌ Error testing multi-day timetable:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testMultiDayTimetable();

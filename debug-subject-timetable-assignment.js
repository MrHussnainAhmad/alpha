const mongoose = require('mongoose');
const Teacher = require('./models/teacher');
const Class = require('./models/class');
const Timetable = require('./models/timetable');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alpha')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(error => console.error('❌ MongoDB connection error:', error));

async function debugSubjectAssignment() {
  console.log('\n=== DEBUG: Subject Assignment with Timetable ===\n');
  
  try {
    // 1. Find all verified teachers with classes
    console.log('1. Finding verified teachers with classes...');
    const teachers = await Teacher.find({ 
      isVerified: true, 
      classes: { $exists: true, $not: { $size: 0 } } 
    }).populate('classes', 'name classNumber level');
    
    console.log(`Found ${teachers.length} verified teachers with classes:`);
    teachers.forEach((teacher, index) => {
      console.log(`   ${index + 1}. ${teacher.fullname} (${teacher.teacherId || 'No ID'})`);
      console.log(`      Classes: ${teacher.classes.map(c => c.name || c.classNumber).join(', ')}`);
      console.log(`      Subjects: [${teacher.subjects.join(', ')}]`);
      console.log(`      Classes IDs: [${teacher.classes.map(c => c._id).join(', ')}]`);
    });
    
    if (teachers.length === 0) {
      console.log('\n❌ No verified teachers with classes found!');
      console.log('   - Make sure teachers are verified (isVerified: true)');
      console.log('   - Make sure teachers have assigned classes');
      return;
    }
    
    // 2. Find all available classes
    console.log('\n2. Finding all available classes...');
    const classes = await Class.find({}).select('name classNumber level');
    console.log(`Found ${classes.length} classes:`);
    classes.forEach((cls, index) => {
      console.log(`   ${index + 1}. ${cls.name || cls.classNumber} (Level: ${cls.level || 'N/A'}) - ID: ${cls._id}`);
    });
    
    // 3. Check existing timetable entries
    console.log('\n3. Checking existing timetable entries...');
    const timetableEntries = await Timetable.find({ isActive: true })
      .populate('teacher', 'fullname')
      .populate('class', 'name classNumber');
    
    console.log(`Found ${timetableEntries.length} existing timetable entries:`);
    timetableEntries.forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.subject} - ${entry.teacher.fullname} - ${entry.class.name || entry.class.classNumber}`);
      console.log(`      Day: ${entry.day}, Time: ${entry.timeSlot}`);
    });
    
    // 4. Create a test subject assignment request
    if (teachers.length > 0 && classes.length > 0) {
      const testTeacher = teachers[0];
      const testClass = testTeacher.classes[0];
      
      console.log('\n4. Testing subject assignment request format...');
      console.log(`Using teacher: ${testTeacher.fullname} (${testTeacher._id})`);
      console.log(`Using class: ${testClass.name || testClass.classNumber} (${testClass._id})`);
      
      // Sample request body that should work
      const sampleRequest = {
        teacherId: testTeacher._id.toString(),
        subjectAssignments: [
          {
            subject: "Mathematics",
            classId: testClass._id.toString(),
            days: ["Monday", "Wednesday"],
            timeSlot: "09:00-10:00"
          },
          {
            subject: "Physics",
            classId: testClass._id.toString(),
            days: "Tuesday",
            timeSlot: "10:00-11:00"
          }
        ]
      };
      
      console.log('\n✅ Sample request body format:');
      console.log(JSON.stringify(sampleRequest, null, 2));
      
      // 5. Validate the request data
      console.log('\n5. Validating request data...');
      
      // Check teacher exists and is verified
      if (!testTeacher.isVerified) {
        console.log('❌ Teacher is not verified');
      } else {
        console.log('✅ Teacher is verified');
      }
      
      // Check teacher has classes
      if (!testTeacher.classes || testTeacher.classes.length === 0) {
        console.log('❌ Teacher has no assigned classes');
      } else {
        console.log('✅ Teacher has assigned classes');
      }
      
      // Check class assignment
      const classIds = testTeacher.classes.map(c => c._id.toString());
      const requestedClassId = testClass._id.toString();
      if (!classIds.includes(requestedClassId)) {
        console.log('❌ Requested class is not assigned to teacher');
      } else {
        console.log('✅ Requested class is assigned to teacher');
      }
      
      // Check time slot format
      const timeSlotRegex = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
      const testTimeSlot = "09:00-10:00";
      if (!timeSlotRegex.test(testTimeSlot)) {
        console.log('❌ Time slot format is invalid');
      } else {
        console.log('✅ Time slot format is valid');
      }
      
      // Check for existing conflicts
      const conflictCheck = await Timetable.findOne({
        class: testClass._id,
        day: "Monday",
        timeSlot: "09:00-10:00",
        isActive: true
      });
      
      if (conflictCheck) {
        console.log('⚠️ Time slot conflict detected:');
        console.log(`   Monday 09:00-10:00 is already occupied by ${conflictCheck.subject}`);
      } else {
        console.log('✅ No time slot conflicts detected');
      }
    }
    
    // 6. Common validation issues
    console.log('\n6. Common issues that cause 400 errors:');
    console.log('   ❌ Teacher not found (invalid teacherId)');
    console.log('   ❌ Teacher not verified (isVerified: false)'); 
    console.log('   ❌ Teacher has no assigned classes');
    console.log('   ❌ subjectAssignments is empty or not an array');
    console.log('   ❌ classId in assignment not assigned to teacher');
    console.log('   ❌ Invalid time slot format (must be HH:MM-HH:MM)');
    console.log('   ❌ Time slot conflict with existing timetable');
    console.log('   ❌ Invalid day name (must be Monday-Sunday)');
    
    console.log('\n=== Debug Complete ===');
    
  } catch (error) {
    console.error('❌ Error during debug:', error);
  }
}

// Run debug if this file is executed directly
if (require.main === module) {
  debugSubjectAssignment()
    .then(() => {
      console.log('\n✅ Debug completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

module.exports = { debugSubjectAssignment };

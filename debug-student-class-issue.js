const mongoose = require('mongoose');
const Student = require('./models/student');
const Class = require('./models/class');
const Teacher = require('./models/teacher');

// MongoDB connection string from .env
const MONGODB_URI = 'mongodb+srv://admin:adminhu@cluster0.f0l9ktg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function debugStudentClassIssue() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get the student data you mentioned
    console.log('\n🔍 Looking for student Hussnain...');
    const student = await Student.findOne({
      $or: [
        { fullname: { $regex: /hussnain/i } },
        { email: 'hussnain@gmail.com' },
        { rollNumber: '1153' }
      ]
    }).populate('class');
    
    if (student) {
      console.log('✅ Found student:', {
        fullname: student.fullname,
        email: student.email,
        rollNumber: student.rollNumber,
        classId: student.class,
        className: student.class ? student.class.name : 'No class assigned',
        isVerified: student.isVerified,
        isActive: student.isActive
      });
    } else {
      console.log('❌ Student not found');
    }

    // Get class information
    console.log('\n🔍 Looking for class with ID: 6897ad3598dc4bb6f9732a0f...');
    const classInfo = await Class.findById('6897ad3598dc4bb6f9732a0f');
    
    if (classInfo) {
      console.log('✅ Found class:', {
        _id: classInfo._id,
        name: classInfo.name
      });
    } else {
      console.log('❌ Class not found with that ID');
    }

    // Check all students in that class
    console.log('\n🔍 Checking all students in class 6897ad3598dc4bb6f9732a0f...');
    const studentsInClass = await Student.find({
      class: new mongoose.Types.ObjectId('6897ad3598dc4bb6f9732a0f')
    }).populate('class').select('fullname email class isVerified isActive rollNumber');

    console.log(`Found ${studentsInClass.length} students in this class:`);
    studentsInClass.forEach((student, index) => {
      console.log(`${index + 1}. ${student.fullname} - ${student.email} - Class: ${student.class?.name || 'None'} - Verified: ${student.isVerified} - Active: ${student.isActive}`);
    });

    // Check if there are any teachers assigned to this class
    console.log('\n🔍 Checking teachers assigned to this class...');
    const teachersWithClass = await Teacher.find({
      classes: new mongoose.Types.ObjectId('6897ad3598dc4bb6f9732a0f')
    }).select('fullname email classes');

    console.log(`Found ${teachersWithClass.length} teachers assigned to this class:`);
    teachersWithClass.forEach((teacher, index) => {
      console.log(`${index + 1}. ${teacher.fullname} - ${teacher.email}`);
    });

    // Check data type issues
    console.log('\n🔍 Checking for data type inconsistencies...');
    const allStudents = await Student.find({}).select('fullname class').limit(10);
    console.log('Sample student class field types:');
    allStudents.forEach((student, index) => {
      console.log(`${index + 1}. ${student.fullname} - Class type: ${typeof student.class} - Value: ${student.class}`);
    });

    // Test the exact query that's failing
    console.log('\n🔍 Testing the exact teacher query that should work...');
    const testQuery = {
      class: new mongoose.Types.ObjectId('6897ad3598dc4bb6f9732a0f'),
      isVerified: true,
      isActive: true
    };
    
    console.log('Query:', JSON.stringify(testQuery, null, 2));
    const testResults = await Student.find(testQuery).populate('class');
    console.log(`Query returned ${testResults.length} students`);

    if (testResults.length > 0) {
      console.log('✅ Query is working! Students found:');
      testResults.forEach(student => {
        console.log(`- ${student.fullname} (${student.email})`);
      });
    } else {
      console.log('❌ Query returned no results - there might be a data issue');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the debug function
debugStudentClassIssue();

const mongoose = require('mongoose');
require('dotenv').config();

const Student = require('../models/student');
const Class = require('../models/class');

async function testClassAssignment() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ Connected to MongoDB');

    // Find a student with 'Unassigned' in their studentId
    const student = await Student.findOne({
      studentId: { $regex: 'Unassigned', $options: 'i' }
    });

    if (!student) {
      console.log('❌ No students with "Unassigned" found');
      process.exit(0);
    }

    console.log(`👤 Found student: ${student.fullname} (${student.studentId})`);

    // Find an available class
    const availableClass = await Class.findOne({});
    if (!availableClass) {
      console.log('❌ No classes available');
      process.exit(0);
    }

    console.log(`🏫 Available class: ${availableClass.classNumber} ${availableClass.section}`);

    // Show current studentId
    console.log(`📋 Current studentId: ${student.studentId}`);

    // Assign the class to the student
    console.log('🔄 Assigning class to student...');
    student.class = availableClass._id;
    student.section = availableClass.section;
    
    // Save the student - this should trigger the pre-save middleware
    await student.save();

    // Fetch the updated student to see the changes
    const updatedStudent = await Student.findById(student._id);
    console.log(`✅ Updated studentId: ${updatedStudent.studentId}`);

    if (updatedStudent.studentId.includes('Unassigned')) {
      console.log('❌ StudentId still contains "Unassigned" - fix may not have worked');
    } else {
      console.log('🎉 Success! StudentId has been updated correctly');
    }

    console.log('\n📊 Student Details:');
    console.log(`   Name: ${updatedStudent.fullname}`);
    console.log(`   StudentId: ${updatedStudent.studentId}`);
    console.log(`   Class: ${availableClass.classNumber}`);
    console.log(`   Section: ${updatedStudent.section}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the test
testClassAssignment();

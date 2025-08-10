const mongoose = require('mongoose');
require('dotenv').config();

const Student = require('../models/student');
const Class = require('../models/class');

// Function to generate Student ID: S-name-class
function generateStudentId(name, className) {
  const cleanName = name.replace(/\s+/g, '').toLowerCase();
  return `S-${cleanName}-${className}`;
}

async function fixStudentIds() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Find all students with 'Unassigned' in their studentId
    const studentsWithUnassigned = await Student.find({
      studentId: { $regex: 'Unassigned', $options: 'i' }
    });

    console.log(`📊 Found ${studentsWithUnassigned.length} students with 'Unassigned' in their studentId`);

    if (studentsWithUnassigned.length === 0) {
      console.log('✅ No students need fixing!');
      process.exit(0);
    }

    // Show the students that will be updated
    console.log('📝 Students to be updated:');
    studentsWithUnassigned.forEach(student => {
      console.log(`   - ${student.fullname} (${student.studentId}) -> Class: ${student.class ? 'Assigned' : 'Not Assigned'}`);
    });

    // Fix each student
    let fixedCount = 0;
    let skippedCount = 0;

    for (const student of studentsWithUnassigned) {
      if (student.class) {
        // Student has a class assigned, update their studentId
        const studentClass = await Class.findById(student.class);
        if (studentClass) {
          const newStudentId = generateStudentId(student.fullname, studentClass.classNumber);
          
          console.log(`🔄 Updating ${student.fullname}: ${student.studentId} -> ${newStudentId}`);
          
          student.studentId = newStudentId;
          await student.save();
          fixedCount++;
        } else {
          console.log(`⚠️  Skipped ${student.fullname}: Class not found in database`);
          skippedCount++;
        }
      } else {
        console.log(`⚠️  Skipped ${student.fullname}: No class assigned`);
        skippedCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Fixed: ${fixedCount} students`);
    console.log(`   ⚠️  Skipped: ${skippedCount} students`);
    console.log(`   📝 Total: ${studentsWithUnassigned.length} students processed`);

    if (skippedCount > 0) {
      console.log('\n💡 Note: Skipped students still have "Unassigned" in their studentId.');
      console.log('   They will be automatically fixed when a class is assigned to them.');
    }

    console.log('\n🎉 Student ID fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing student IDs:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the script
fixStudentIds();


require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Student = require('../models/student');
const Class = require('../models/class');

// Import the generateStudentId function from Student model
const { generateStudentId } = require('../models/student');

// Function to generate Special Student ID: S-name-class-rollnumber
function generateSpecialStudentId(name, studentClass, rollNumber) {
  const cleanName = name.replace(/\s+/g, '').toLowerCase();
  return `S-${cleanName}-${studentClass}-${rollNumber}`;
}

const updateStudentIds = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    const students = await Student.find({});
    console.log(`Found ${students.length} students to update.`);

    for (const student of students) {
      let studentIdUpdated = false;
      let specialStudentIdUpdated = false;

      if (student.class) {
        const studentClass = await Class.findById(student.class);
        if (studentClass) {
          const newStudentId = await generateStudentId(student.fullname, studentClass.name);
          if (newStudentId !== student.studentId) {
            student.studentId = newStudentId;
            studentIdUpdated = true;
          }

          if (student.rollNumber) {
            const newSpecialStudentId = generateSpecialStudentId(student.fullname, studentClass.name, student.rollNumber);
            if (newSpecialStudentId !== student.specialStudentId) {
              student.specialStudentId = newSpecialStudentId;
              specialStudentIdUpdated = true;
            }
          }
        }
      }

      if (studentIdUpdated || specialStudentIdUpdated) {
        await student.save();
        console.log(`Updated student ${student.fullname} (ID: ${student._id})`);
      }
    }

    console.log('All students have been checked and updated where necessary.');
  } catch (error) {
    console.error('Error updating student IDs:', error);
  } finally {
    mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

updateStudentIds();

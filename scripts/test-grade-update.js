const mongoose = require('mongoose');
const Student = require('../models/student');
const Grade = require('../models/grade');

// Load environment variables from .env file
require('dotenv').config({ path: '../.env' });

const MONGODB_URI = process.env.MONGO_URL;

async function runTest() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected for test.');

    // 1. Create a dummy student
    const dummyStudent = new Student({
      fullname: 'Test Student',
      fathername: 'Test Father',
      dob: new Date('2000-01-01'),
      email: `teststudent${Date.now()}@example.com`,
      password: 'password123',
      phoneNumber: '1234567890',
      homePhone: '0987654321',
      gender: 'male',
      address: '123 Test St',
    });
    await dummyStudent.save();
    console.log('Dummy student created:', dummyStudent._id);

    // 2. Simulate adding a grade (similar to what the route does)
    const examId = `${dummyStudent.studentId || dummyStudent._id}-grades-${Date.now()}`;
    const subjects = [
      { name: 'Math', grade: 'A' },
      { name: 'Science', grade: 'B' },
    ];

    const newGrade = new Grade({
      examId,
      student: dummyStudent._id,
      examDate: new Date(),
      gradeType: 'Midterm',
      comments: 'Good performance',
      subjects,
    });
    await newGrade.save();
    console.log('New grade record created:', newGrade._id);

    // Manually update the student document as the route would
    // This part simulates the logic added to routes/grades.js
    dummyStudent.grades.push(newGrade._id);
    dummyStudent.examIds.push(examId);
    dummyStudent.allGrades.push({ examId, subjects });
    await dummyStudent.save();
    console.log('Student document updated with new grade info.');

    // 3. Verify the student document
    const updatedStudent = await Student.findById(dummyStudent._id);

    console.log('\n--- Verification ---');
    console.log('Student grades array:', updatedStudent.grades);
    console.log('Student examIds array:', updatedStudent.examIds);
    console.log('Student allGrades array:', updatedStudent.allGrades);

    if (updatedStudent.grades.includes(newGrade._id) &&
        updatedStudent.examIds.includes(examId) &&
        updatedStudent.allGrades.some(g => g.examId === examId && g.subjects.length === subjects.length)) {
      console.log('Test PASSED: Student document updated correctly.');
    } else {
      console.error('Test FAILED: Student document not updated as expected.');
    }

    // Clean up: remove dummy data
    await Student.deleteOne({ _id: dummyStudent._id });
    await Grade.deleteOne({ _id: newGrade._id });
    console.log('Dummy data cleaned up.');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}

runTest();

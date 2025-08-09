const mongoose = require('mongoose');
const Teacher = require('./models/teacher');
const Student = require('./models/student');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const MONGODB_URI = 'mongodb+srv://admin:adminhu@cluster0.f0l9ktg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testMobileAPI() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get the teacher (same as mobile app would get after login)
    const teacher = await Teacher.findOne({ email: 'teacher@gmail.com' });
    if (!teacher) {
      console.log('❌ Teacher not found');
      return;
    }
    
    console.log('🔍 Teacher found:', {
      id: teacher._id.toString(),
      fullname: teacher.fullname,
      email: teacher.email,
      teacherId: teacher.teacherId,
      classes: teacher.classes
    });
    
    // Simulate the exact API call logic from the my-class-students endpoint
    const teacherId = teacher._id;
    const { classId, section } = { classId: null, section: null }; // No filters initially
    
    console.log('\n🔍 Testing /my-class-students endpoint logic...');
    console.log('Teacher ID:', teacherId);
    console.log('Query params - classId:', classId, 'section:', section);

    // Get teacher classes
    const teacherWithClasses = await Teacher.findById(teacherId).select('classes');
    console.log('Teacher classes:', teacherWithClasses.classes);

    if (!teacherWithClasses.classes || teacherWithClasses.classes.length === 0) {
      console.log('❌ No classes assigned to this teacher');
      return;
    }

    // Convert teacher.classes to ObjectIds
    const teacherClassIds = teacherWithClasses.classes.map(id => 
      typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
    );
    
    console.log('Teacher class IDs (ObjectIds):', teacherClassIds);

    // Build the query to find students
    let query = { 
      class: { $in: teacherClassIds },
      isVerified: true,
      isActive: true
    };

    // Apply specific class filter if provided
    if (classId) {
      const requestedClassId = new mongoose.Types.ObjectId(classId);
      const isAssigned = teacherClassIds.some(id => id.equals(requestedClassId));
      
      if (isAssigned) {
        query.class = requestedClassId;
      } else {
        console.log('❌ Teacher not assigned to requested class');
        return;
      }
    }

    // Apply section filter if provided
    if (section) {
      query.section = section;
      if (section.toLowerCase() === 'boys') {
        query.gender = 'male';
      } else if (section.toLowerCase() === 'girls') {
        query.gender = 'female';
      }
    }

    console.log('Final student query:', JSON.stringify(query, null, 2));
    
    // Execute the query
    const students = await Student.find(query)
      .populate('class', 'name')
      .select('-password')
      .sort({ fullname: 1 });

    console.log(`\n✅ Found ${students.length} students`);
    
    if (students.length > 0) {
      console.log('Students found:');
      students.forEach((student, index) => {
        console.log(`${index + 1}. ${student.fullname} (${student.email})`);
        console.log(`   - Class: ${student.class?.name || 'No Class'}`);
        console.log(`   - Section: ${student.section || 'No Section'}`);
        console.log(`   - Verified: ${student.isVerified}`);
        console.log(`   - Active: ${student.isActive}`);
        console.log(`   - Roll Number: ${student.rollNumber || 'N/A'}`);
        console.log('');
      });

      // Group by class
      const studentsByClass = students.reduce((acc, student) => {
        const className = student.class ? student.class.name : 'No Class';
        if (!acc[className]) {
          acc[className] = [];
        }
        acc[className].push(student);
        return acc;
      }, {});

      console.log('📊 Students grouped by class:');
      Object.entries(studentsByClass).forEach(([className, classStudents]) => {
        console.log(`${className}: ${classStudents.length} students`);
      });

      // Simulate the exact API response
      const apiResponse = {
        students,
        studentsByClass,
        totalStudents: students.length,
        assignedClasses: teacherWithClasses.classes.length,
        teacherClassIds: teacherClassIds,
        query: query
      };

      console.log('\n📱 Simulated API Response Structure:');
      console.log('- students: Array of', students.length, 'students');
      console.log('- studentsByClass: Object with', Object.keys(studentsByClass).length, 'classes');
      console.log('- totalStudents:', students.length);
      console.log('- assignedClasses:', teacherWithClasses.classes.length);
    } else {
      console.log('❌ No students found for this teacher');
      
      // Let's debug why no students were found
      console.log('\n🔍 Debugging - Let\'s check each condition:');
      
      // Check students in teacher's classes (without other filters)
      const studentsInClasses = await Student.find({ 
        class: { $in: teacherClassIds }
      }).populate('class', 'name');
      
      console.log(`Students in teacher's classes (no filters): ${studentsInClasses.length}`);
      studentsInClasses.forEach(s => {
        console.log(`- ${s.fullname}: verified=${s.isVerified}, active=${s.isActive}, class=${s.class?.name}`);
      });
      
      // Check verified students
      const verifiedStudents = await Student.find({ 
        class: { $in: teacherClassIds },
        isVerified: true
      }).populate('class', 'name');
      console.log(`Verified students: ${verifiedStudents.length}`);
      
      // Check active students
      const activeStudents = await Student.find({ 
        class: { $in: teacherClassIds },
        isActive: true
      }).populate('class', 'name');
      console.log(`Active students: ${activeStudents.length}`);
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

testMobileAPI();

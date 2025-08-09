const mongoose = require('mongoose');
const Teacher = require('./models/teacher');
const Student = require('./models/student');
const MONGODB_URI = 'mongodb+srv://admin:adminhu@cluster0.f0l9ktg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testTeacherAPI() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Simulate the teacher API call
    const teacherId = '6897a739bd272ee44a235b03'; // Teacher 1's ID
    const classId = '6897ad3598dc4bb6f9732a0f'; // Class 9 - Boys ID
    
    console.log('🔍 Testing the exact API logic used by the teacher panel...');
    
    // Get teacher data (like the authenticateTeacher middleware would)
    const teacher = await Teacher.findById(teacherId).select('classes');
    console.log('Teacher classes:', teacher.classes);
    
    // Convert teacher.classes to ObjectIds
    const teacherClassIds = teacher.classes.map(id => 
      typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
    );
    
    // Build query like the API does
    let query = { 
      class: { $in: teacherClassIds },
      isVerified: true,
      isActive: true
    };
    
    console.log('Query being used:', JSON.stringify(query, null, 2));
    
    // Execute the query
    const students = await Student.find(query)
      .populate('class', 'name')
      .select('-password')
      .sort({ fullname: 1 });
    
    console.log(`Found ${students.length} students in teacher's classes:`);
    students.forEach(student => {
      console.log(`- ${student.fullname} (${student.email}) - Class: ${student.class?.name || 'Unknown'}`);
    });
    
    // Also test with specific class filter
    console.log('\n🔍 Testing with specific class filter...');
    const specificQuery = {
      class: new mongoose.Types.ObjectId(classId),
      isVerified: true,
      isActive: true
    };
    
    const specificStudents = await Student.find(specificQuery)
      .populate('class', 'name')
      .select('-password');
      
    console.log(`Found ${specificStudents.length} students in specific class:`);
    specificStudents.forEach(student => {
      console.log(`- ${student.fullname} (${student.email}) - Class: ${student.class?.name || 'Unknown'}`);
    });
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testTeacherAPI();

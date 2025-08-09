const express = require("express");
const Teacher = require("../models/teacher");
const Student = require("../models/student");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { authenticateTeacher } = require('../middleware/auth');

const router = express.Router();

// Teacher login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const teacher = await Teacher.findOne({ email });
    if (!teacher || !teacher.isActive) {
      return res.status(400).json({ message: "Invalid credentials or account deactivated" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, teacher.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: teacher._id, teacherId: teacher.teacherId, userType: "teacher" },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({ 
      message: "Login successful",
      token,
      teacher: {
        id: teacher._id,
        fullname: teacher.fullname,
        teacherId: teacher.teacherId,
        email: teacher.email,
        phoneNumber: teacher.phoneNumber,
        img: teacher.img
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper function to generate unique Teacher ID
function generateUniqueTeacherId(name, joiningYear) {
  const cleanName = name.replace(/\s+/g, '').toLowerCase();
  return `T-${cleanName}-${joiningYear}`;
}

// Teacher signup (self-registration with auto-generated teacherId)
router.post("/signup", async (req, res) => {
  try {
    const teacherData = req.body;
    
    // Check if teacher with email already exists
    const existingTeacher = await Teacher.findOne({ email: teacherData.email });
    if (existingTeacher) {
      return res.status(400).json({ message: "Teacher with this email already exists" });
    }

    // Check if CNIC already exists
    const existingCNIC = await Teacher.findOne({ cnicNumber: teacherData.cnicNumber });
    if (existingCNIC) {
      return res.status(400).json({ message: "Teacher with this CNIC already exists" });
    }

    const hashedPassword = await bcrypt.hash(teacherData.password, 10);
    
    // Generate auto Teacher ID
    let teacherId = generateUniqueTeacherId(teacherData.fullname, teacherData.joiningYear);
    let counter = 1;
    
    // Ensure uniqueness
    while (await Teacher.findOne({ teacherId })) {
      teacherId = `${generateUniqueTeacherId(teacherData.fullname, teacherData.joiningYear)}-${counter}`;
      counter++;
    }
    
    const teacher = new Teacher({
      ...teacherData,
      password: hashedPassword,
      teacherId, // Auto-generated Teacher ID
      img: '', // Default to empty, will show default image in frontend
    });

    await teacher.save();

    res.status(201).json({ 
      message: "Teacher account created successfully with Teacher ID: " + teacherId,
      teacher: {
        id: teacher._id,
        fullname: teacher.fullname,
        teacherId: teacher.teacherId,
        email: teacher.email,
        phoneNumber: teacher.phoneNumber
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Search student by Student ID (teacher function)
router.get("/search/student/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const student = await Student.findOne({ studentId }).select('-password');
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json({ student });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create student (teacher function)
router.post("/create-student", async (req, res) => {
  try {
    const studentData = req.body;
    const hashedPassword = await bcrypt.hash(studentData.password, 10);
    
    const student = new Student({
      ...studentData,
      password: hashedPassword,
      class: studentData.class || null // Ensure class is stored as ObjectId or null
    });

    await student.save();

    res.status(201).json({ 
      message: "Student created successfully",
      student: {
        id: student._id,
        fullname: student.fullname,
        studentId: student.studentId,
        email: student.email,
        class: student.class,
        section: student.section
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get students by class and section
router.get("/students/:class/:section", async (req, res) => {
  try {
    const { class: studentClass, section } = req.params;
    
    const students = await Student.find({ 
      class: studentClass, 
      section: section,
      isActive: true 
    }).select('-password');

    res.status(200).json({ students });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update teacher profile
router.put("/profile", async (req, res) => {
  try {
    const { teacherId } = req.body;
    const updateData = { ...req.body };
    delete updateData.password; // Don't allow password update through this route
    delete updateData.teacherId; // Don't allow teacherId change
    
    const teacher = await Teacher.findOneAndUpdate(
      { _id: req.body.id },
      updateData,
      { new: true }
    ).select('-password');

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.status(200).json({ 
      message: "Profile updated successfully",
      teacher 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all students (teacher function)
router.get("/students", async (req, res) => {
  try {
    const students = await Student.find({ isActive: true }).select('-password');
    res.status(200).json({ students });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Assign student ID (teacher function)
router.put("/assign-student-id/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;
    
    if (!studentId) {
      return res.status(400).json({ message: "Student ID is required" });
    }

    // Check if student ID already exists
    const existingStudent = await Student.findOne({ studentId, _id: { $ne: id } });
    if (existingStudent) {
      return res.status(400).json({ message: "Student ID already exists" });
    }
    
    const student = await Student.findByIdAndUpdate(
      id,
      { studentId },
      { new: true }
    ).select('-password');

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json({ 
      message: "Student ID assigned successfully",
      student 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update student (teacher function)
router.put("/update-student/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Don't allow password update through this route
    delete updateData.password;

    // Handle class update if provided
    if (updateData.class) {
      // If it's an empty string, set to null
      updateData.class = updateData.class === '' ? null : updateData.class;
    }
    
    const student = await Student.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).select('-password');

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json({ 
      message: "Student updated successfully",
      student 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Change password
router.put("/change-password", async (req, res) => {
  try {
    const { id, currentPassword, newPassword } = req.body;
    
    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const isCurrentPasswordCorrect = await bcrypt.compare(currentPassword, teacher.password);
    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    teacher.password = hashedNewPassword;
    await teacher.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all verified students (for class assignment)
router.get('/verified-students', authenticateTeacher, async (req, res) => {
  try {
    const { classId, section } = req.query;
    const query = { isVerified: true };

    if (classId) {
      query.class = classId;
    }
    if (section) {
      query.section = section;
      if (section.toLowerCase() === 'boys') {
        query.gender = 'male';
      } else if (section.toLowerCase() === 'girls') {
        query.gender = 'female';
      }
    }

    console.log('Backend query for students:', query);
    const students = await Student.find(query).populate('class', 'name').select('-password');
    res.status(200).json({ students });
  } catch (error) {
    console.error('Error fetching verified students:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get students from teacher's assigned classes
router.get('/my-class-students', authenticateTeacher, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const teacherId = req.user.id; // Get teacher ID from authenticated user
    const { classId, section } = req.query;

    console.log('🔍 MY-CLASS-STUDENTS API CALLED');
    console.log('📱 Request from mobile app');
    console.log('👤 Teacher ID:', teacherId);
    console.log('🔍 Query params - classId:', classId, 'section:', section);
    console.log('⏰ Timestamp:', new Date().toISOString());

    // First, get the teacher to see which classes they are assigned to
    const teacher = await Teacher.findById(teacherId).select('classes');
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    console.log('Teacher classes:', teacher.classes);

    if (!teacher.classes || teacher.classes.length === 0) {
      return res.status(200).json({ 
        students: [], 
        message: 'No classes assigned to this teacher yet'
      });
    }

    // Convert teacher.classes to ObjectIds for proper comparison
    const teacherClassIds = teacher.classes.map(id => 
      typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
    );

    console.log('Teacher class IDs (ObjectIds):', teacherClassIds);

    // Build the query to find students in teacher's assigned classes
    let query = { 
      class: { $in: teacherClassIds }, // Students in any of teacher's classes
      isVerified: true, // Only verified students
      isActive: true // Only active students
    };

    // If a specific class is requested, filter by that class (if teacher is assigned to it)
    if (classId) {
      const requestedClassId = new mongoose.Types.ObjectId(classId);
      const isAssigned = teacherClassIds.some(id => id.equals(requestedClassId));
      
      if (isAssigned) {
        query.class = requestedClassId;
      } else {
        return res.status(403).json({ 
          message: 'You are not assigned to this class'
        });
      }
    }

    // Filter by section if provided
    if (section) {
      query.section = section;
      // If section indicates gender-based grouping
      if (section.toLowerCase() === 'boys') {
        query.gender = 'male';
      } else if (section.toLowerCase() === 'girls') {
        query.gender = 'female';
      }
    }

    console.log('Final student query:', JSON.stringify(query, null, 2));
    
    // Fetch students with class information
    const students = await Student.find(query)
      .populate('class', 'name')
      .select('-password')
      .sort({ fullname: 1 }); // Sort alphabetically by name

    console.log(`Found ${students.length} students`);
    if (students.length > 0) {
      console.log('First student class info:', students[0].class);
    }

    // Group students by class for better organization
    const studentsByClass = students.reduce((acc, student) => {
      const className = student.class ? student.class.name : 'No Class';
      if (!acc[className]) {
        acc[className] = [];
      }
      acc[className].push(student);
      return acc;
    }, {});

    const response = {
      students,
      studentsByClass,
      totalStudents: students.length,
      assignedClasses: teacher.classes.length,
      teacherClassIds: teacherClassIds, // For debugging
      query: query // For debugging
    };
    
    console.log('📤 SENDING RESPONSE TO MOBILE APP:');
    console.log('📊 Total students found:', students.length);
    console.log('🏫 Classes with students:', Object.keys(studentsByClass));
    if (students.length > 0) {
      console.log('👥 First student:', students[0].fullname, '- Class:', students[0].class?.name);
    }
    console.log('✅ Response sent successfully');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching teacher class students:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Assign student to class
router.post('/assign-student-class', authenticateTeacher, async (req, res) => {
  try {
    const { studentId, classId } = req.body;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    // Check if student is already assigned to this class
    if (student.class && student.class.toString() === classId) {
      return res.status(400).json({ message: 'Student already assigned to this class.' });
    }

    student.class = classId;
    await student.save();
    
    // Populate the class name for the response
    await student.populate('class', 'name');

    res.status(200).json({ message: 'Student assigned to class successfully.', student });
  } catch (error) {
    console.error('Error assigning student to class:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Unassign student from class
router.post('/unassign-student-class', authenticateTeacher, async (req, res) => {
  try {
    const { studentId } = req.body;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    student.class = null; // Set class to null to unassign
    await student.save();

    res.status(200).json({ message: 'Student unassigned from class successfully.', student });
  } catch (error) {
    console.error('Error unassigning student from class:', error);
    res.status(500).json({ message: 'Server error' });
  }
});





// Get teacher dashboard stats
router.get("/dashboard-stats", authenticateTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id; // Authenticated teacher's ID

    const teacher = await Teacher.findById(teacherId).populate('classes');
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const studentCount = await Student.countDocuments({ isActive: true }); // Still count all students for now
    const classCount = teacher.classes.length;

    // Placeholder for assignments
    const assignmentCount = 0; // To be implemented

    res.status(200).json({
      success: true,
      stats: {
        students: studentCount,
        classes: classCount,
        assignments: assignmentCount,
      },
    });
  } catch (error) {
    console.error('Error fetching teacher dashboard stats:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all unique subjects from all teachers
router.get("/subjects", async (req, res) => {
  try {
    const subjects = await Teacher.distinct("subjects");
    res.status(200).json({ subjects });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Debug endpoint to check teacher and student data
router.get('/debug-data', authenticateTeacher, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const teacherId = req.user.id;
    
    // Get teacher data
    const teacher = await Teacher.findById(teacherId).populate('classes', 'name');
    
    // Get all students with their class data
    const allStudents = await Student.find({}).populate('class', 'name').select('fullname class isVerified isActive');
    
    // Get only students in teacher's classes
    let teacherStudents = [];
    if (teacher && teacher.classes && teacher.classes.length > 0) {
      const teacherClassIds = teacher.classes.map(cls => cls._id);
      teacherStudents = await Student.find({ 
        class: { $in: teacherClassIds }
      }).populate('class', 'name').select('fullname class isVerified isActive');
    }
    
    res.status(200).json({
      teacher: {
        id: teacher._id,
        fullname: teacher.fullname,
        classes: teacher.classes
      },
      allStudentsCount: allStudents.length,
      teacherStudentsCount: teacherStudents.length,
      allStudents: allStudents.slice(0, 5), // First 5 students
      teacherStudents: teacherStudents.slice(0, 5) // First 5 teacher students
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Simple test to check if student has the expected class format
router.get('/simple-test', authenticateTeacher, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const teacherId = req.user.id;
    
    // Get teacher
    const teacher = await Teacher.findById(teacherId);
    console.log('Teacher found:', !!teacher);
    console.log('Teacher classes:', teacher?.classes);
    
    // Get first few students to see their structure
    const students = await Student.find({}).limit(3).select('fullname class isVerified isActive');
    console.log('Sample students:', students);
    
    // Check if student's class field matches teacher's class
    if (teacher?.classes?.length > 0 && students.length > 0) {
      const teacherClassId = teacher.classes[0].toString();
      const studentClassId = students[0]?.class?.toString();
      console.log('Teacher first class ID:', teacherClassId);
      console.log('Student first class ID:', studentClassId);
      console.log('Do they match?', teacherClassId === studentClassId);
    }
    
    res.json({
      teacherExists: !!teacher,
      teacherClasses: teacher?.classes || [],
      sampleStudents: students,
      message: 'Check console for detailed logs'
    });
  } catch (error) {
    console.error('Simple test error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/test", (req, res) => {
  res.send("Test route is working");
});

module.exports = router;

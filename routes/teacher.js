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
      password: hashedPassword
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

// Get teacher dashboard stats
router.get("/dashboard-stats", authenticateTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id; // Authenticated teacher's ID

    // Count all active students (temporary, until teacher-class/section association is clear)
    const studentCount = await Student.countDocuments({ isActive: true });

    // Count unique classes (unique combinations of class and section)
    const uniqueClasses = await Student.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: { class: "$class", section: "$section" } } },
      { $count: "count" }
    ]);
    const classCount = uniqueClasses.length > 0 ? uniqueClasses[0].count : 0;

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

module.exports = router;

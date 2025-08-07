const express = require("express");
const Teacher = require("../models/teacher");
const Student = require("../models/student");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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

module.exports = router;

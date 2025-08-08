const express = require("express");
const Admin = require("../models/admin");
const Teacher = require("../models/teacher");
const Student = require("../models/student");
const Announcement = require("../models/announcement");
const AppConfig = require("../models/appConfig");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

// Helper functions for ID generation
function generateTeacherId(name, joiningYear) {
  const cleanName = name.replace(/\s+/g, '').toLowerCase();
  return `T-${cleanName}-${joiningYear}`;
}

function generateStudentId(name, studentClass) {
  const cleanName = name.replace(/\s+/g, '').toLowerCase();
  return `S-${cleanName}-${studentClass}`;
}

// Admin signup (only for initial setup or by existing admin)
router.post("/signup", async (req, res) => {
  try {
    const { fullname, username, email, password, role } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ 
      $or: [{ email }, { username }] 
    });
    if (existingAdmin) {
      return res.status(400).json({ 
        message: "Admin with this email or username already exists" 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = new Admin({
      fullname,
      username,
      email,
      password: hashedPassword,
      role: role || "admin"
    });

    await admin.save();

    res.status(201).json({ 
      message: "Admin created successfully",
      admin: {
        id: admin._id,
        fullname: admin.fullname,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for default admin credentials (temporary)
    if (email === "admin@gmail.com" && password === "123457") {
      const token = jwt.sign(
        { id: "default-admin", role: "admin", userType: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      return res.status(200).json({ 
        message: "Login successful (Default Admin)",
        token,
        admin: {
          id: "default-admin",
          fullname: "System Administrator",
          username: "admin",
          email: "admin@gmail.com",
          role: "admin"
        }
      });
    }

    // Try to find admin in database
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, admin.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role, userType: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({ 
      message: "Login successful",
      token,
      admin: {
        id: admin._id,
        fullname: admin.fullname,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Search teacher by Teacher ID
router.get("/search/teacher/:teacherId", async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    const teacher = await Teacher.findOne({ teacherId }).select('-password');
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.status(200).json({ teacher });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Search student by Student ID
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

// Create teacher (admin function)
router.post("/create-teacher", async (req, res) => {
  try {
    const teacherData = req.body;
    const hashedPassword = await bcrypt.hash(teacherData.password, 10);
    
    const teacher = new Teacher({
      ...teacherData,
      password: hashedPassword
    });

    await teacher.save();

    res.status(201).json({ 
      message: "Teacher created successfully",
      teacher: {
        id: teacher._id,
        fullname: teacher.fullname,
        teacherId: teacher.teacherId,
        email: teacher.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create student (admin function)
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
        email: student.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all teachers (admin function)
router.get("/teachers", async (req, res) => {
  try {
    const teachers = await Teacher.find({ isActive: true }).select('-password');
    res.status(200).json({ teachers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all students (admin function)
router.get("/students", async (req, res) => {
  try {
    const students = await Student.find({ isActive: true }).select('-password');
    res.status(200).json({ students });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update teacher (admin function)
router.put("/update-teacher/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Don't allow password update through this route
    delete updateData.password;
    
    const teacher = await Teacher.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).select('-password');

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.status(200).json({ 
      message: "Teacher updated successfully",
      teacher 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete teacher (admin function)
router.delete("/delete-teacher/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const teacher = await Teacher.findByIdAndDelete(id);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.status(200).json({ message: "Teacher deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get dashboard stats (admin function)
router.get("/stats", async (req, res) => {
  try {
    const teachersCount = await Teacher.countDocuments({ isActive: true });
    const studentsCount = await Student.countDocuments({ isActive: true });
    const announcementsCount = await Announcement.countDocuments();
    
    res.status(200).json({
      stats: {
        teachers: teachersCount,
        students: studentsCount,
        announcements: announcementsCount
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update student (admin function)
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

// Delete student (admin function)
router.delete("/delete-student/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const student = await Student.findByIdAndDelete(id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json({ message: "Student deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Clean up teachers without teacherId (should run periodically)
router.post("/cleanup-teachers", async (req, res) => {
  try {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    
    const deletedTeachers = await Teacher.deleteMany({
      teacherId: { $exists: false },
      createdAt: { $lt: twelveHoursAgo }
    });

    res.status(200).json({ 
      message: `Cleaned up ${deletedTeachers.deletedCount} teachers without Teacher ID`,
      deletedCount: deletedTeachers.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Clean up students without studentId (should run periodically)
router.post("/cleanup-students", async (req, res) => {
  try {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    
    const deletedStudents = await Student.deleteMany({
      studentId: { $exists: false },
      createdAt: { $lt: twelveHoursAgo }
    });

    res.status(200).json({ 
      message: `Cleaned up ${deletedStudents.deletedCount} students without Student ID`,
      deletedCount: deletedStudents.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Assign Teacher ID (admin only)
router.put("/assign-teacher-id/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { customTeacherId } = req.body;
    
    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }
    
    // Generate teacher ID if not provided custom one
    const teacherId = customTeacherId || generateTeacherId(teacher.fullname, teacher.joiningYear);
    
    // Check if teacher ID already exists
    const existingTeacher = await Teacher.findOne({ teacherId, _id: { $ne: id } });
    if (existingTeacher) {
      return res.status(400).json({ message: "Teacher ID already exists" });
    }
    
    teacher.teacherId = teacherId;
    await teacher.save();
    
    res.status(200).json({ 
      message: "Teacher ID assigned successfully",
      teacher: {
        id: teacher._id,
        fullname: teacher.fullname,
        teacherId: teacher.teacherId,
        email: teacher.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Assign Student ID (admin and teachers can do this)
router.put("/assign-student-id/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { customStudentId } = req.body;
    
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    // Generate student ID if not provided custom one
    const studentId = customStudentId || generateStudentId(student.fullname, student.class);
    
    // Check if student ID already exists
    const existingStudent = await Student.findOne({ studentId, _id: { $ne: id } });
    if (existingStudent) {
      return res.status(400).json({ message: "Student ID already exists" });
    }
    
    student.studentId = studentId;
    await student.save();
    
    res.status(200).json({ 
      message: "Student ID assigned successfully",
      student: {
        id: student._id,
        fullname: student.fullname,
        studentId: student.studentId,
        email: student.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== APP CONFIGURATION ROUTES =====

// Get app configuration
router.get("/app-config", async (req, res) => {
  try {
    const config = await AppConfig.getConfig();
    res.status(200).json({ 
      message: "App configuration retrieved successfully",
      config 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update app configuration
router.put("/app-config", async (req, res) => {
  try {
    const { collegeName, logoBase64, logoType } = req.body;
    console.log('App config update request:', { collegeName, hasLogo: !!logoBase64, logoType });
    
    const updateData = {};
    
    // Update college name if provided
    if (collegeName) {
      updateData.collegeName = collegeName.trim();
    }
    
    // Handle logo upload if provided
    if (logoBase64 && logoType) {
      try {
        // Get current config to delete old logo if exists
        const currentConfig = await AppConfig.getConfig();
        
        // Delete old logo from cloudinary if exists
        if (currentConfig.logoPublicId) {
          try {
            await cloudinary.uploader.destroy(currentConfig.logoPublicId);
          } catch (deleteError) {
            console.log('Error deleting old logo:', deleteError);
          }
        }
        
        // Upload new logo to cloudinary
        const uploadResult = await cloudinary.uploader.upload(
          `data:${logoType};base64,${logoBase64}`,
          {
            folder: 'school-app/logos',
            resource_type: 'image',
            transformation: [
              { width: 400, height: 400, crop: 'fill', quality: 'auto' }
            ]
          }
        );
        
        updateData.logoUrl = uploadResult.secure_url;
        updateData.logoPublicId = uploadResult.public_id;
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        return res.status(400).json({ 
          message: "Error uploading logo", 
          error: uploadError.message 
        });
      }
    }
    
    // Ensure we have something to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        message: "No data provided to update" 
      });
    }
    
    const updatedConfig = await AppConfig.updateConfig(updateData);
    
    res.status(200).json({ 
      message: "App configuration updated successfully",
      config: updatedConfig 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reset app configuration to defaults
router.post("/app-config/reset", async (req, res) => {
  try {
    // Get current config to delete logo if exists
    const currentConfig = await AppConfig.getConfig();
    
    // Delete logo from cloudinary if exists
    if (currentConfig.logoPublicId) {
      try {
        await cloudinary.uploader.destroy(currentConfig.logoPublicId);
      } catch (deleteError) {
        console.log('Error deleting logo during reset:', deleteError);
      }
    }
    
    // Reset to default values
    const resetData = {
      collegeName: 'Alpha Education',
      logoUrl: '',
      logoPublicId: ''
    };
    
    const resetConfig = await AppConfig.updateConfig(resetData);
    
    res.status(200).json({ 
      message: "App configuration reset to defaults successfully",
      config: resetConfig 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

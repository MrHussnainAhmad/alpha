const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Admin = require("../models/admin");
const Teacher = require("../models/teacher");
const Student = require("../models/student");

// General authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: "Access token is required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// Admin-only middleware
const authenticateAdmin = async (req, res, next) => {
  authenticateToken(req, res, async () => {
    try {
      if (req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      // Validate admin id format
      if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
        return res.status(403).json({ message: 'Invalid admin token' });
      }

      const admin = await Admin.findById(req.user.id);
      if (!admin) {
        return res.status(403).json({ message: 'Admin not found' });
      }
      req.user = admin;
      next();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
};

// Teacher-only middleware
const authenticateTeacher = async (req, res, next) => {
  authenticateToken(req, res, async () => {
    try {
      if (req.user.userType !== 'teacher') {
        return res.status(403).json({ message: "Teacher access required" });
      }
      
      const teacher = await Teacher.findById(req.user.id);
      if (!teacher || !teacher.isActive) {
        return res.status(403).json({ message: "Teacher not found or inactive" });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
};

// Student-only middleware
const authenticateStudent = async (req, res, next) => {
  authenticateToken(req, res, async () => {
    try {
      if (req.user.userType !== 'student') {
        return res.status(403).json({ message: "Student access required" });
      }
      
      const student = await Student.findById(req.user.id);
      if (!student || !student.isActive) {
        return res.status(403).json({ message: "Student not found or inactive" });
      }
      
      // Set studentId for fee voucher routes
      req.user.studentId = student.studentId;
      req.user.specialStudentId = student.specialStudentId;
      
      next();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
};

// Admin or Teacher middleware
const authenticateAdminOrTeacher = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.userType === 'admin' || req.user.userType === 'teacher') {
      next();
    } else {
      res.status(403).json({ message: "Admin or Teacher access required" });
    }
  });
};

module.exports = {
  authenticateToken,
  authenticateAdmin,
  authenticateTeacher,
  authenticateStudent,
  authenticateAdminOrTeacher
};

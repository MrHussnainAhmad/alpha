const express = require("express");
const Admin = require("../models/admin");
const Teacher = require("../models/teacher");
const Student = require("../models/student");
const Class = require("../models/class");
const Announcement = require("../models/announcement");
const AppConfig = require("../models/appConfig");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { authenticateAdmin } = require('../middleware/auth');

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
    console.log("Students data sent to frontend:", students.map(s => ({ id: s._id, fullname: s.fullname, profilePicture: s.profilePicture }))); // Log relevant student data
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
    console.log('Admin updateTeacher updateData:', updateData);
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

// Update teacher pay (admin function)
router.put("/update-teacher-pay/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPay, futurePay } = req.body;

    const updateData = {};
    if (currentPay !== undefined) {
      updateData.currentPay = currentPay;
    }
    if (futurePay !== undefined) {
      updateData.futurePay = futurePay;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No pay data provided for update" });
    }

    const teacher = await Teacher.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).select('-password');

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.status(200).json({ 
      message: "Teacher pay updated successfully",
      teacher 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Verify/Unverify Teacher
router.put('/verify-teacher/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;
    
    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }
    
    teacher.isVerified = isVerified;
    if (isVerified) {
      teacher.verifiedAt = new Date();
      teacher.verifiedBy = req.user.id === 'default-admin' ? null : req.user.id;
    } else {
      teacher.verifiedAt = null;
      teacher.verifiedBy = null;
    }
    
    await teacher.save();
    
    res.status(200).json({ 
      success: true,
      message: `Teacher ${isVerified ? 'verified' : 'unverified'} successfully`,
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

    // Check if class is being updated (this will trigger studentId update)
    const isClassBeingUpdated = updateData.class !== undefined;
    
    // Handle class and section update if provided
    if (updateData.class && updateData.section) {
      const classDoc = await Class.findById(updateData.class);
      if (classDoc) {
        updateData.className = classDoc.name; // Store class name as string
        updateData.section = updateData.section; // Store section as string
      } else {
        // Handle case where class is not found, maybe return an error
        return res.status(400).json({ message: "Invalid class ID" });
      }
      // Remove original class and section from updateData as they are now in className and section
      delete updateData.class;
      // updateData.section is already handled, no need to delete it again
    } else if (updateData.class === '' && updateData.section === '') {
      updateData.className = null;
      updateData.section = null;
      delete updateData.class; // Remove original class from updateData
    } else if (updateData.class === '') { // Only class is being unset
      updateData.className = null;
      delete updateData.class;
    } else if (updateData.section === '') { // Only section is being unset
      updateData.section = null;
    }
    
    let student;
    
    // If class is being updated, use save() to trigger pre-save middleware
    if (isClassBeingUpdated) {
      student = await Student.findById(id);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Update the student document with new data
      Object.assign(student, updateData);
      await student.save(); // This will trigger the pre-save middleware
      student = await Student.findById(id).select('-password');
    } else {
      // For non-class updates, use findByIdAndUpdate for efficiency
      student = await Student.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      ).select('-password');
    }

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

// Update student fee (admin function)
router.put("/update-student-fee/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentFee, futureFee } = req.body;

    const updateData = {};
    if (currentFee !== undefined) {
      updateData.currentFee = currentFee;
    }
    if (futureFee !== undefined) {
      updateData.futureFee = futureFee;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No fee data provided for update" });
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
      message: "Student fee updated successfully",
      student 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Verify/Unverify Student
router.put('/verify-student/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;
    
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    student.isVerified = isVerified;
    if (isVerified) {
      student.verifiedAt = new Date();
      student.verifiedBy = req.user.id === 'default-admin' ? null : req.user.id;
    } else {
      student.verifiedAt = null;
      student.verifiedBy = null;
    }
    
    await student.save();
    
    res.status(200).json({ 
      success: true,
      message: `Student ${isVerified ? 'verified' : 'unverified'} successfully`,
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

// Get all verified teachers (for class assignment)
router.get('/verified-teachers', authenticateAdmin, async (req, res) => {
  try {
    const teachers = await Teacher.find({ isVerified: true }).populate('classes', 'classNumber').select('-password');
    res.status(200).json({ teachers });
  } catch (error) {
    console.error('Error fetching verified teachers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign class to teacher
router.post('/assign-class', authenticateAdmin, async (req, res) => {
  try {
    const { teacherId, classId } = req.body;

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    // Check if class is already assigned
    if (teacher.classes.includes(classId)) {
      return res.status(400).json({ message: 'Class already assigned to this teacher.' });
    }

    teacher.classes.push(classId);
    await teacher.save();
    
    // Populate the class number for the response
    await teacher.populate('classes', 'classNumber');

    res.status(200).json({ message: 'Class assigned successfully.', teacher });
  } catch (error) {
    console.error('Error assigning class:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Unassign class from teacher
router.post('/unassign-class', authenticateAdmin, async (req, res) => {
  try {
    const { teacherId, classId } = req.body;

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    // Check if class is assigned
    if (!teacher.classes.includes(classId)) {
      return res.status(400).json({ message: 'Class not assigned to this teacher.' });
    }

    teacher.classes = teacher.classes.filter(cls => cls.toString() !== classId);
    await teacher.save();

    // Populate the class number for the response
    await teacher.populate('classes', 'classNumber');

    res.status(200).json({ message: 'Class unassigned successfully.', teacher });
  } catch (error) {
    console.error('Error unassigning class:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get teachers with assigned classes (for subject management)
router.get('/teachers-with-classes', authenticateAdmin, async (req, res) => {
  try {
    // Find teachers who have classes assigned and are verified
    const teachers = await Teacher.find({ 
      isVerified: true, 
      classes: { $exists: true, $not: { $size: 0 } } 
    })
    .populate('classes', 'name level')
    .select('fullname email teacherId classes subjects')
    .lean();

    res.json({
      success: true,
      teachers: teachers || []
    });
  } catch (error) {
    console.error('Error fetching teachers with classes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teachers with classes',
      error: error.message
    });
  }
});

// Assign subjects to teacher
router.post('/assign-subjects', authenticateAdmin, async (req, res) => {
  try {
    const { teacherId, subjects } = req.body;

    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ message: 'Please provide subjects to assign.' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    if (!teacher.isVerified) {
      return res.status(400).json({ message: 'Teacher must be verified to assign subjects.' });
    }

    if (!teacher.classes || teacher.classes.length === 0) {
      return res.status(400).json({ message: 'Teacher must have assigned classes before assigning subjects.' });
    }

    // Remove duplicates and add new subjects
    const uniqueSubjects = [...new Set([...teacher.subjects, ...subjects])];
    teacher.subjects = uniqueSubjects;
    await teacher.save();
    
    // Populate the teacher data for response
    await teacher.populate('classes', 'name');

    res.status(200).json({ 
      message: 'Subjects assigned successfully.', 
      teacher 
    });
  } catch (error) {
    console.error('Error assigning subjects:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove subjects from teacher
router.post('/remove-subjects', authenticateAdmin, async (req, res) => {
  try {
    const { teacherId, subjects } = req.body;

    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ message: 'Please provide subjects to remove.' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    // Remove specified subjects
    teacher.subjects = teacher.subjects.filter(subject => !subjects.includes(subject));
    await teacher.save();
    
    // Populate the teacher data for response
    await teacher.populate('classes', 'name');

    res.status(200).json({ 
      message: 'Subjects removed successfully.', 
      teacher 
    });
  } catch (error) {
    console.error('Error removing subjects:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search verified teachers with optional filters
router.get('/search-teachers', authenticateAdmin, async (req, res) => {
  try {
    const { q, hasClasses } = req.query;
    
    let searchQuery = { isVerified: true };
    
    // Add text search if query provided
    if (q && q.trim()) {
      const searchTerm = q.trim();
      searchQuery.$or = [
        { fullname: { $regex: searchTerm, $options: 'i' } },
        { teacherId: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } }
      ];
    }
    
    // Filter by teachers with classes if requested
    if (hasClasses === 'true') {
      searchQuery.classes = { $exists: true, $ne: [] };
    }
    
    const teachers = await Teacher.find(searchQuery)
      .populate('classes', 'name')
      .select('-password')
      .sort({ fullname: 1 });
    
    res.status(200).json({ teachers });
  } catch (error) {
    console.error('Error searching teachers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign subjects to teacher
router.post('/assign-subjects', authenticateAdmin, async (req, res) => {
  try {
    const { teacherId, subjects } = req.body;

    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ message: 'Please provide subjects to assign.' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    if (!teacher.isVerified) {
      return res.status(400).json({ message: 'Teacher must be verified to assign subjects.' });
    }

    if (!teacher.classes || teacher.classes.length === 0) {
      return res.status(400).json({ message: 'Teacher must have assigned classes before assigning subjects.' });
    }

    // Remove duplicates and add new subjects
    const uniqueSubjects = [...new Set([...teacher.subjects, ...subjects])];
    teacher.subjects = uniqueSubjects;
    await teacher.save();
    
    // Populate the teacher data for response
    await teacher.populate('classes', 'name');

    res.status(200).json({ 
      message: 'Subjects assigned successfully.', 
      teacher 
    });
  } catch (error) {
    console.error('Error assigning subjects:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove subjects from teacher
router.post('/remove-subjects', authenticateAdmin, async (req, res) => {
  try {
    const { teacherId, subjects } = req.body;

    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ message: 'Please provide subjects to remove.' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    // Remove specified subjects
    teacher.subjects = teacher.subjects.filter(subject => !subjects.includes(subject));
    await teacher.save();
    
    // Populate the teacher data for response
    await teacher.populate('classes', 'name');

    res.status(200).json({ 
      message: 'Subjects removed successfully.', 
      teacher 
    });
  } catch (error) {
    console.error('Error removing subjects:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search verified teachers with optional filters
router.get('/search-teachers', authenticateAdmin, async (req, res) => {
  try {
    const { q, hasClasses } = req.query;
    
    let searchQuery = { isVerified: true };
    
    // Add text search if query provided
    if (q && q.trim()) {
      const searchTerm = q.trim();
      searchQuery.$or = [
        { fullname: { $regex: searchTerm, $options: 'i' } },
        { teacherId: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } }
      ];
    }
    
    // Filter by teachers with classes if requested
    if (hasClasses === 'true') {
      searchQuery.classes = { $exists: true, $ne: [] };
    }
    
    const teachers = await Teacher.find(searchQuery)
      .populate('classes', 'name')
      .select('-password')
      .sort({ fullname: 1 });
    
    res.status(200).json({ teachers });
  } catch (error) {
    console.error('Error searching teachers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign subjects to teacher with timetable
router.post('/assign-subjects-with-timetable', authenticateAdmin, async (req, res) => {
  try {
    const { teacherId, subjectAssignments } = req.body;
    const Timetable = require('../models/timetable');

    if (!subjectAssignments || !Array.isArray(subjectAssignments) || subjectAssignments.length === 0) {
      return res.status(400).json({ message: 'Please provide subject assignments with timetable information.' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    if (!teacher.isVerified) {
      return res.status(400).json({ message: 'Teacher must be verified to assign subjects.' });
    }

    if (!teacher.classes || teacher.classes.length === 0) {
      return res.status(400).json({ message: 'Teacher must have assigned classes before assigning subjects.' });
    }

    // Extract unique subjects from assignments
    const subjects = [...new Set(subjectAssignments.map(assignment => assignment.subject))];
    
    // Remove duplicates and add new subjects to teacher
    const uniqueSubjects = [...new Set([...teacher.subjects, ...subjects])];
    teacher.subjects = uniqueSubjects;
    await teacher.save();

    // Create timetable entries
    const timetableEntries = [];
    for (const assignment of subjectAssignments) {
      const { subject, classId, days, timeSlot } = assignment;
      
      // Validate that the class is assigned to this teacher
      if (!teacher.classes.includes(classId)) {
        return res.status(400).json({ 
          message: `Class ${classId} is not assigned to teacher ${teacher.fullname}` 
        });
      }

      // Handle multiple days
      const daysToProcess = Array.isArray(days) ? days : [days];
      
      for (const day of daysToProcess) {
        // Check for time slot conflicts
        const existingSlot = await Timetable.findOne({
          class: classId,
          day: day,
          timeSlot: timeSlot,
          isActive: true
        });

        if (existingSlot) {
          return res.status(400).json({ 
            message: `Time slot ${timeSlot} on ${day} is already occupied for this class` 
          });
        }

        // Create timetable entry
        const timetableEntry = new Timetable({
          class: classId,
          day: day,
          timeSlot: timeSlot,
          subject: subject,
          teacher: teacherId
        });

        await timetableEntry.save();
        timetableEntries.push(timetableEntry);
      }
    }
    
    // Populate the teacher data for response
    await teacher.populate('classes', 'name');

    res.status(200).json({ 
      message: 'Subjects assigned successfully with timetable.', 
      teacher,
      timetableEntries: timetableEntries.length
    });
  } catch (error) {
    console.error('Error assigning subjects with timetable:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get timetable for a class
router.get('/timetable/:classId', authenticateAdmin, async (req, res) => {
  try {
    const { classId } = req.params;
    const Timetable = require('../models/timetable');
    
    const timetable = await Timetable.find({ 
      class: classId, 
      isActive: true 
    })
    .populate('teacher', 'fullname')
    .sort({ day: 1, timeSlot: 1 });

    // Group by day
    const groupedTimetable = {};
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    days.forEach(day => {
      groupedTimetable[day] = timetable.filter(entry => entry.day === day);
    });

    res.status(200).json({ 
      classId,
      timetable: groupedTimetable
    });
  } catch (error) {
    console.error('Error fetching timetable:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove timetable entry
router.delete('/timetable/:entryId', authenticateAdmin, async (req, res) => {
  try {
    const { entryId } = req.params;
    const Timetable = require('../models/timetable');
    
    const entry = await Timetable.findById(entryId);
    if (!entry) {
      return res.status(404).json({ message: 'Timetable entry not found.' });
    }

    // Soft delete by setting isActive to false
    entry.isActive = false;
    await entry.save();

    res.status(200).json({ 
      message: 'Timetable entry removed successfully.' 
    });
  } catch (error) {
    console.error('Error removing timetable entry:', error);
    res.status(500).json({ message: 'Server error' });
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
    const studentId = customStudentId || generateStudentId(student.fullname, student.className); // Use className
    
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
    const { collegeName, logoBase64, logoType, phoneNumber } = req.body;
    console.log('App config update request:', { collegeName, hasLogo: !!logoBase64, logoType });
    
    const updateData = {};
    
    // Update college name if provided
    if (collegeName) {
      updateData.collegeName = collegeName.trim();
    }

    if (phoneNumber !== undefined) {
      updateData.phoneNumber = phoneNumber.trim();
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

const { getGradeSettings, updateGradeSettings } = require('../controllers/gradeSettingsController');

// Grade Settings routes
router.get('/grade-settings', authenticateAdmin, getGradeSettings);
router.post('/grade-settings', authenticateAdmin, updateGradeSettings);

module.exports = router;

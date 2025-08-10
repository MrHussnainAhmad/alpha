const express = require("express");
const Marks = require("../models/marks");
const Student = require("../models/student");
const Admin = require("../models/admin");
const Teacher = require("../models/teacher");
const { authenticateAdmin, authenticateTeacher, authenticateAdminOrTeacher, authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Admin/Teacher: Add marks for a student
router.post("/add", authenticateAdminOrTeacher, async (req, res) => {
  try {
    const {
      studentIdString,
      examType,
      examDate,
      subjects,
      academicYear,
      semester,
      remarks
    } = req.body;

    // Validate required fields
    if (!studentIdString || !examType || !examDate || !subjects || !academicYear) {
      return res.status(400).json({
        message: "Student ID, exam type, exam date, subjects, and academic year are required"
      });
    }

    // Validate subjects array
    if (!Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({
        message: "Subjects must be a non-empty array"
      });
    }

    // Validate each subject
    for (let subject of subjects) {
      if (!subject.subjectName || typeof subject.marksObtained !== 'number' || typeof subject.totalMarks !== 'number') {
        return res.status(400).json({
          message: "Each subject must have subjectName, marksObtained, and totalMarks"
        });
      }
      if (subject.marksObtained > subject.totalMarks) {
        return res.status(400).json({
          message: `Marks obtained cannot be greater than total marks for ${subject.subjectName}`
        });
      }
    }

    // Find student by studentId string
    const student = await Student.findOne({ studentId: studentIdString });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Get user details (admin or teacher)
    let addedBy, addedByName, addedByType;
    if (req.user.userType === 'admin') {
      const admin = await Admin.findById(req.user.id);
      addedBy = admin._id;
      addedByName = admin.fullname;
      addedByType = 'Admin';
    } else {
      const teacher = await Teacher.findById(req.user.id);
      addedBy = teacher._id;
      addedByName = teacher.fullname;
      addedByType = 'Teacher';
    }

    // Check if marks already exist for this student, exam type, and academic year
    const existingMarks = await Marks.findOne({
      studentId: student._id,
      examType: examType,
      academicYear: academicYear,
      semester: semester || undefined
    });

    if (existingMarks) {
      return res.status(400).json({
        message: `Marks for ${examType} exam in ${academicYear} already exist for this student`
      });
    }

    // Create new marks record
    const marks = new Marks({
      studentId: student._id,
      studentIdString: student.studentId,
      studentName: student.fullname,
      className: student.className,
      section: student.section,
      examType,
      examDate: new Date(examDate),
      subjects,
      addedBy,
      addedByType,
      addedByName,
      academicYear,
      semester,
      remarks: remarks || ''
    });

    await marks.save();

    res.status(201).json({
      message: "Marks added successfully",
      marks: {
        id: marks._id,
        studentName: marks.studentName,
        studentId: marks.studentIdString,
        examType: marks.examType,
        subjects: marks.subjects,
        overallPercentage: marks.overallPercentage,
        overallGrade: marks.overallGrade,
        addedBy: marks.addedByName
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin/Teacher: Update marks for a student
router.put("/:id", authenticateAdminOrTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Don't allow changing certain fields
    delete updateData.studentId;
    delete updateData.studentIdString;
    delete updateData.addedBy;
    delete updateData.addedByType;
    delete updateData.addedByName;

    const marks = await Marks.findById(id);
    if (!marks) {
      return res.status(404).json({ message: "Marks record not found" });
    }

    // Only admin or the teacher who added the marks can update
    if (req.user.userType !== 'admin' && marks.addedBy.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "You can only update marks that you have added" 
      });
    }

    // Update marks
    Object.assign(marks, updateData);
    await marks.save();

    res.status(200).json({
      message: "Marks updated successfully",
      marks
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin/Teacher: Delete marks record
router.delete("/:id", authenticateAdminOrTeacher, async (req, res) => {
  try {
    const { id } = req.params;

    const marks = await Marks.findById(id);
    if (!marks) {
      return res.status(404).json({ message: "Marks record not found" });
    }

    // Only admin or the teacher who added the marks can delete
    if (req.user.userType !== 'admin' && marks.addedBy.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "You can only delete marks that you have added" 
      });
    }

    marks.isActive = false;
    await marks.save();

    res.status(200).json({ message: "Marks record deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get student's complete academic record
router.get("/student/:studentIdString", authenticateToken, async (req, res) => {
  try {
    const { studentIdString } = req.params;
    const { examType, academicYear, semester } = req.query;

    // Find student
    const student = await Student.findOne({ studentId: studentIdString });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Check permission: admin, teacher, or the student themselves
    if (req.user.userType === 'student' && req.user.id !== student._id.toString()) {
      return res.status(403).json({ 
        message: "You can only view your own marks" 
      });
    }

    // Get marks record
    const marks = await Marks.getStudentRecord(student._id, {
      examType,
      academicYear,
      semester
    });

    // Group marks by academic year and exam type
    const groupedMarks = {};
    marks.forEach(mark => {
      const key = `${mark.academicYear}_${mark.examType}`;
      if (!groupedMarks[key]) {
        groupedMarks[key] = {
          academicYear: mark.academicYear,
          examType: mark.examType,
          semester: mark.semester,
          examDate: mark.examDate,
          subjects: mark.subjects,
          overallPercentage: mark.overallPercentage,
          overallGrade: mark.overallGrade,
          position: mark.position,
          addedBy: mark.addedByName,
          addedDate: mark.createdAt,
          remarks: mark.remarks
        };
      }
    });

    res.status(200).json({
      student: {
        name: student.fullname,
        studentId: student.studentId,
        className: student.className,
        section: student.section
      },
      academicRecord: Object.values(groupedMarks)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get class performance (Admin/Teacher only)
router.get("/class/:className/:section", authenticateAdminOrTeacher, async (req, res) => {
  try {
    const { className: queryClassName, section } = req.params; // Renamed class to queryClassName
    const { examType, academicYear } = req.query;

    if (!examType || !academicYear) {
      return res.status(400).json({
        message: "Exam type and academic year are required"
      });
    }

    const classPerformance = await Marks.getClassPerformance(
      queryClassName, // Use queryClassName
      section,
      examType,
      academicYear
    );

    // Calculate positions
    const sortedByPercentage = classPerformance.sort((a, b) => b.overallPercentage - a.overallPercentage);
    let currentPosition = 1;
    
    for (let i = 0; i < sortedByPercentage.length; i++) {
      if (i > 0 && sortedByPercentage[i].overallPercentage < sortedByPercentage[i-1].overallPercentage) {
        currentPosition = i + 1;
      }
      sortedByPercentage[i].position = currentPosition;
      await sortedByPercentage[i].save();
    }

    res.status(200).json({
      className: queryClassName, // Use queryClassName
      section: section,
      examType: examType,
      academicYear: academicYear,
      totalStudents: classPerformance.length,
      performance: classPerformance.map(mark => ({
        studentName: mark.studentId.fullname,
        studentId: mark.studentId.studentId,
        subjects: mark.subjects,
        overallPercentage: mark.overallPercentage,
        overallGrade: mark.overallGrade,
        position: mark.position
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get marks added by specific teacher (Teacher only)
router.get("/teacher/my-records", authenticateTeacher, async (req, res) => {
  try {
    const { page = 1, limit = 10, examType, academicYear } = req.query;
    
    const query = {
      addedBy: req.user.id,
      addedByType: 'Teacher',
      isActive: true
    };
    
    if (examType) query.examType = examType;
    if (academicYear) query.academicYear = academicYear;

    const marks = await Marks.find(query)
      .populate('studentId', 'fullname studentId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Marks.countDocuments(query);

    res.status(200).json({
      marks,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalRecords: total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get all marks records with filters
router.get("/admin/all", authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, examType, academicYear, class: className, section } = req.query;
    
    const query = { isActive: true };
    
    if (examType) query.examType = examType;
    if (academicYear) query.academicYear = academicYear;
    if (className) query.className = className;
    if (section) query.section = section;

    const marks = await Marks.find(query)
      .populate('studentId', 'fullname studentId')
      .populate('addedBy', 'fullname username teacherId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Marks.countDocuments(query);

    res.status(200).json({
      marks,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalRecords: total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get marks statistics (Admin only)
router.get("/admin/stats", authenticateAdmin, async (req, res) => {
  try {
    const totalRecords = await Marks.countDocuments({ isActive: true });
    
    const statsByExamType = await Marks.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$examType", count: { $sum: 1 }, avgPercentage: { $avg: "$overallPercentage" } } }
    ]);

    const statsByClass = await Marks.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: { className: "$className", section: "$section" }, count: { $sum: 1 }, avgPercentage: { $avg: "$overallPercentage" } } }
    ]);

    const gradeDistribution = await Marks.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$overallGrade", count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      totalRecords,
      statsByExamType,
      statsByClass,
      gradeDistribution
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

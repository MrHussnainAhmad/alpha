const express = require('express');
const router = express.Router();
const { authenticateToken, authenticateAdmin, authenticateTeacher, authenticateStudent } = require('../middleware/auth');
const Attendance = require('../models/attendance');
const Student = require('../models/student');
const Teacher = require('../models/teacher');
const Class = require('../models/class');

// Admin: Mark student attendance
router.post('/mark-student', authenticateAdmin, async (req, res) => {
  try {
    const { studentId, classId, status, date } = req.body;
    console.log('Received status for student attendance:', status);
    
    if (!studentId || !classId || !status || !['A', 'P', 'H'].includes(status)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if student exists and belongs to the class
    const student = await Student.findById(studentId).populate('class');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Check if class exists
    const classExists = await Class.findById(classId);
    if (!classExists) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Use provided date or current date
    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0); // Set to start of day

    // Check if attendance already exists for this date
    const existingAttendance = await Attendance.findOne({
      date: attendanceDate,
      studentId,
      classId
    });

    if (existingAttendance) {
      // Update existing attendance
      existingAttendance.status = status;
      existingAttendance.updatedAt = new Date();
      await existingAttendance.save();
      
      return res.json({ 
        message: 'Attendance updated successfully',
        attendance: existingAttendance
      });
    }

    // Create new attendance record
    const attendance = new Attendance({
      date: attendanceDate,
      studentId,
      classId,
      status,
      markedBy: req.user.id || undefined // Handle default admin case
    });

    await attendance.save();
    
    console.log('Attendance saved successfully:', {
      studentId,
      classId,
      status,
      date: attendanceDate
    });
    
    res.status(201).json({ 
      message: 'Attendance marked successfully',
      attendance
    });

  } catch (error) {
    console.error('Error marking student attendance:', error);
    console.error('Error details:', error.message);
    console.error('Error name:', error.name);
    if (error.errors) {
      console.error('Mongoose validation errors:', error.errors);
    }
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', details: error.message });
  }
});

// Admin: Mark teacher attendance
router.post('/mark-teacher', authenticateAdmin, async (req, res) => {
  try {
    console.log('Teacher attendance request body:', req.body);
    const { teacherId, classId, status, date } = req.body;
    console.log('Received status for teacher attendance:', status);
    
    console.log('Extracted values:', { teacherId, classId, status, date });
    
    if (!teacherId || !status || !['A', 'P', 'H'].includes(status)) {
      console.log('Validation failed:', { teacherId: !!teacherId, status: !!status, validStatus: ['A', 'P'].includes(status) });
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if teacher exists and is verified
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    if (!teacher.isVerified) {
      return res.status(400).json({ message: 'Only verified teachers can have attendance marked' });
    }

    // Use provided date or current date
    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0); // Set to start of day

    // Check if attendance already exists for this date
    const existingAttendance = await Attendance.findOne({
      date: attendanceDate,
      teacherId,
      classId: classId || null
    });

    if (existingAttendance) {
      // Update existing attendance
      existingAttendance.status = status;
      existingAttendance.updatedAt = new Date();
      await existingAttendance.save();
      
      return res.json({ 
        message: 'Attendance updated successfully',
        attendance: existingAttendance
      });
    }

    // Create new attendance record
    const attendance = new Attendance({
      date: attendanceDate,
      teacherId,
      classId: classId || null, // Make classId optional for teachers
      status,
      markedBy: req.user.id || undefined // Handle default admin case
    });

    await attendance.save();
    
    console.log('Teacher attendance saved successfully:', {
      teacherId,
      classId: classId || 'null',
      status,
      date: attendanceDate
    });
    
    res.status(201).json({ 
      message: 'Attendance marked successfully',
      attendance
    });

  } catch (error) {
    console.error('Error marking teacher attendance:', error);
    console.error('Error details:', error.message);
    console.error('Error name:', error.name);
    if (error.errors) {
      console.error('Mongoose validation errors:', error.errors);
    }
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', details: error.message });
  }
});

// Admin: Update attendance
router.put('/update/:id', authenticateAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!status || !['A', 'P', 'H'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    attendance.status = status;
    attendance.updatedAt = new Date();
    await attendance.save();

    res.json({ 
      message: 'Attendance updated successfully',
      attendance
    });

  } catch (error) {
    console.error('Error updating attendance:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get students for a class (excluding those already marked today) - for marking attendance
router.get('/students/:classId', authenticateAdmin, async (req, res) => {
  try {
    const { classId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    console.log('Fetching students for class:', classId, 'date:', today);

    // Get all students in the class
    const allStudents = await Student.find({ class: classId })
      .select('fullname studentId rollNumber')
      .sort({ rollNumber: 1 });

    console.log('Total students in class:', allStudents.length);

    // Get students who already have attendance marked today
    const markedToday = await Attendance.find({
      classId,
      date: today,
      studentId: { $exists: true }
    }).select('studentId');

    console.log('Students marked today:', markedToday.length);

    const markedStudentIds = markedToday.map(att => att.studentId.toString());

    // Filter out students who are already marked today
    const availableStudents = allStudents.filter(student => 
      !markedStudentIds.includes(student._id.toString())
    );

    console.log('Available students (not marked today):', availableStudents.length);

    res.json({ students: availableStudents });

  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get all students for a class (for viewing attendance records) - shows all students
router.get('/students-records/:classId', authenticateAdmin, async (req, res) => {
  try {
    const { classId } = req.params;

    console.log('Fetching ALL students for records, class:', classId);

    // Get all students in the class (no filtering for attendance marking)
    const allStudents = await Student.find({ class: classId })
      .select('fullname studentId rollNumber')
      .sort({ rollNumber: 1 });

    console.log('Total students for records:', allStudents.length);

    res.json({ students: allStudents });

  } catch (error) {
    console.error('Error fetching students for records:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get all verified teachers (excluding those already marked today)
router.get('/teachers', authenticateAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    console.log('Fetching verified teachers for date:', today);

    // Get all verified teachers
    const allTeachers = await Teacher.find({ isVerified: true })
      .select('fullname teacherId')
      .sort({ fullname: 1 });

    console.log('Total verified teachers:', allTeachers.length);

    // Get teachers who already have attendance marked today (any class or no class)
    const markedToday = await Attendance.find({
      date: today,
      teacherId: { $exists: true }
    }).select('teacherId');

    console.log('Teachers marked today:', markedToday.length);

    const markedTeacherIds = markedToday.map(att => att.teacherId.toString());

    // Filter out teachers who are already marked today
    const availableTeachers = allTeachers.filter(teacher => 
      !markedTeacherIds.includes(teacher._id.toString())
    );

    console.log('Available teachers (not marked today):', availableTeachers.length);

    res.json({ teachers: availableTeachers });

  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get attendance record for a specific user and month
router.get('/record/:type/:id/:month', authenticateAdmin, async (req, res) => {
  try {
    const { type, id, month } = req.params; // month format: YYYY-MM

    const [year, monthNum] = month.split('-');
    const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59);

    let query = {
      date: { $gte: startDate, $lte: endDate }
    };

    if (type === 'student') {
      query.studentId = id;
    } else if (type === 'teacher') {
      query.teacherId = id;
    } else {
      return res.status(400).json({ message: 'Invalid type' });
    }

    const attendance = await Attendance.find(query)
      .populate('classId', 'name')
      .sort({ date: 1 });

    // Calculate statistics
    const totalDays = attendance.filter(a => a.status === 'P' || a.status === 'A').length;
    const presentDays = attendance.filter(a => a.status === 'P').length;
    const absentDays = attendance.filter(a => a.status === 'A').length;
    const attendancePercentage = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(2) : 0;

    res.json({
      attendance,
      statistics: {
        totalDays,
        presentDays,
        absentDays,
        attendancePercentage: parseFloat(attendancePercentage)
      }
    });

  } catch (error) {
    console.error('Error fetching attendance record:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Teacher: Get own attendance record
router.get('/my-record/:month', authenticateTeacher, async (req, res) => {
  try {
    const { month } = req.params;
    const teacherId = req.user.id;

    const [year, monthNum] = month.split('-');
    const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59);

    const attendance = await Attendance.find({
      teacherId,
      date: { $gte: startDate, $lte: endDate }
    })
    .populate('classId', 'name')
    .sort({ date: 1 });

    // Calculate statistics
    const totalDays = attendance.filter(a => a.status === 'P' || a.status === 'A').length;
    const presentDays = attendance.filter(a => a.status === 'P').length;
    const absentDays = attendance.filter(a => a.status === 'A').length;
    const attendancePercentage = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(2) : 0;

    res.json({
      attendance,
      statistics: {
        totalDays,
        presentDays,
        absentDays,
        attendancePercentage: parseFloat(attendancePercentage)
      }
    });

  } catch (error) {
    console.error('Error fetching teacher attendance record:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Student: Get own attendance record
router.get('/student/my-record/:month', authenticateStudent, async (req, res) => {
  try {
    const { month } = req.params;
    const studentId = req.user.id;

    const [year, monthNum] = month.split('-');
    const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59);

    const attendance = await Attendance.find({
      studentId,
      date: { $gte: startDate, $lte: endDate }
    })
    .populate('classId', 'name')
    .sort({ date: 1 });

    // Calculate statistics
    const totalDays = attendance.filter(a => a.status === 'P' || a.status === 'A').length;
    const presentDays = attendance.filter(a => a.status === 'P').length;
    const absentDays = attendance.filter(a => a.status === 'A').length;
    const attendancePercentage = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(2) : 0;

    res.json({
      attendance,
      statistics: {
        totalDays,
        presentDays,
        absentDays,
        attendancePercentage: parseFloat(attendancePercentage)
      }
    });

  } catch (error) {
    console.error('Error fetching student attendance record:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

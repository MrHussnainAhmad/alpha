const express = require('express');
const router = express.Router();
const Class = require('../models/class');
const auth = require('../middleware/auth'); // Assuming you have an auth middleware

// Create a new class
router.post('/', auth.authenticateAdmin, async (req, res) => {
  try {
    console.log('Received request body for class creation:', req.body);
    const { classNumber, section } = req.body;
    if (!classNumber || !section) {
      return res.status(400).json({ message: 'Class number and section are required.' });
    }
    const newClass = new Class({ classNumber, section });
    await newClass.save();
    res.status(201).json({ message: 'Class created successfully', class: newClass });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Class with this number and section already exists.' });
    }
    console.error('Error creating class:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all classes
router.get('/', auth.authenticateAdmin, async (req, res) => {
  try {
    const classes = await Class.find({});
    res.status(200).json({ classes });
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all classes (publicly accessible)
router.get('/public', async (req, res) => {
  try {
    const classes = await Class.find({});
    res.status(200).json({ classes });
  } catch (error) {
    console.error('Error fetching public classes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get classes statistics - MUST be before /:id routes to avoid conflicts
router.get('/stats', async (req, res) => {
  console.log('GET /classes/stats endpoint hit');
  try {
    const Teacher = require('../models/teacher');
    const Student = require('../models/student');
    
    // Get all classes
    const classes = await Class.find({});
    console.log('Found classes:', classes.length);
    
    // Get statistics for each class
    const classesWithStats = await Promise.all(classes.map(async (classItem) => {
      const teachersCount = await Teacher.countDocuments({ 
        classes: classItem._id,
        isVerified: true 
      });
      
      const studentsCount = await Student.countDocuments({ 
        class: classItem._id,
        isActive: true 
      });
      
      // For now, subjects count is 0 (would need to implement subject-class relationship)
      const subjectsCount = 0;
      
      return {
        _id: classItem._id,
        classNumber: classItem.classNumber,
        section: classItem.section,
        stats: {
          totalStudents: studentsCount,
          assignedTeachers: teachersCount,
          subjects: subjectsCount
        }
      };
    }));
    
    console.log('Sending response with classes:', classesWithStats.length);
    res.status(200).json({ 
      classes: classesWithStats,
      totalClasses: classes.length
    });
  } catch (error) {
    console.error('Error fetching classes stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Test route to verify endpoint is working
router.get('/test', (req, res) => {
  console.log('GET /classes/test endpoint hit');
  res.status(200).json({ message: 'Classes test endpoint working' });
});

// Update a class
router.put('/:id', auth.authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { classNumber, section } = req.body;

    if (!classNumber || !section) {
      return res.status(400).json({ message: 'Class number and section are required.' });
    }

    const updatedClass = await Class.findByIdAndUpdate(
      id,
      { classNumber, section },
      { new: true, runValidators: true }
    );

    if (!updatedClass) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    res.status(200).json({ message: 'Class updated successfully', class: updatedClass });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Class with this number and section already exists.' });
    }
    console.error('Error updating class:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a class
router.delete('/:id', auth.authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedClass = await Class.findByIdAndDelete(id);

    if (!deletedClass) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    res.status(200).json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Error deleting class:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get class with assigned teachers
router.get('/:id/teachers', auth.authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const Teacher = require('../models/teacher');
    
    // Find the class first
    const classData = await Class.findById(id);
    if (!classData) {
      return res.status(404).json({ message: 'Class not found.' });
    }
    
    // Find teachers assigned to this class
    const teachers = await Teacher.find({ 
      classes: id,
      isVerified: true 
    }).populate('classes', 'classNumber').select('-password');
    
    res.status(200).json({ 
      class: classData,
      teachers 
    });
  } catch (error) {
    console.error('Error fetching class teachers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get class statistics
router.get('/:id/stats', auth.authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const Teacher = require('../models/teacher');
    const Student = require('../models/student');
    
    // Find the class first
    const classData = await Class.findById(id);
    if (!classData) {
      return res.status(404).json({ message: 'Class not found.' });
    }
    
    // Get statistics
    const teachersCount = await Teacher.countDocuments({ 
      classes: id,
      isVerified: true 
    });
    
    const studentsCount = await Student.countDocuments({ 
      class: id,
      isActive: true 
    });
    
    res.status(200).json({ 
      class: classData,
      stats: {
        teachers: teachersCount,
        students: studentsCount
      }
    });
  } catch (error) {
    console.error('Error fetching class stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get class details with teachers and subjects
router.get('/:id/details', auth.authenticateStudent, async (req, res) => {
  try {
    const { id } = req.params;
    const Timetable = require('../models/timetable');
    
    // Find the class first
    const classData = await Class.findById(id);
    if (!classData) {
      return res.status(404).json({ message: 'Class not found.' });
    }
    
    // Get timetable entries for this class
    const timetableEntries = await Timetable.find({ 
      class: id, 
      isActive: true 
    })
    .populate('teacher', 'fullname')
    .sort({ day: 1, timeSlot: 1 });

    // Group by day for better organization
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const groupedTimetable = {};
    
    days.forEach(day => {
      groupedTimetable[day] = timetableEntries
        .filter(entry => entry.day === day)
        .map(entry => ({
          subject: entry.subject,
          teacher: {
            fullname: entry.teacher.fullname
          },
          timeSlot: entry.timeSlot
        }));
    });

    // Also provide a flat list for backward compatibility
    const subjectsWithTeachers = timetableEntries.map(entry => ({
      name: entry.subject,
      teacher: {
        fullname: entry.teacher.fullname
      },
      timeSlot: entry.timeSlot,
      day: entry.day
    }));

    console.log('Class details for student:', {
      class: classData,
      timetable: groupedTimetable,
      subjects: subjectsWithTeachers
    });
    
    res.status(200).json({ 
      class: {
        ...classData.toObject(),
        subjects: subjectsWithTeachers,
        timetable: groupedTimetable
      }
    });
  } catch (error) {
    console.error('Error fetching class details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Grade = require('../models/grade');
const Student = require('../models/student');
const { authenticateAdmin } = require('../middleware/auth');

// Create a new grade record
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { studentId, examDate, gradeType, comments, subjects } = req.body;

    // Validate required fields
    if (!studentId || !examDate || !gradeType || !subjects || subjects.length === 0) {
      return res.status(400).json({ message: 'Missing required grade fields.' });
    }

    // Check if student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    // Generate examId from student's studentId
    let examId;
    if (student.studentId) {
      examId = `${student.studentId}-grades`;
    } else {
      // Fallback if studentId is not set
      examId = `${student._id}-grades`;
    }

    // Create new grade record
    const newGrade = new Grade({
      examId,
      student: studentId,
      examDate,
      gradeType,
      comments,
      subjects,
    });

    await newGrade.save();

    // Add grade reference to student's grades array
    student.grades.push(newGrade._id);
    // Also push examId and subjects to student's document
    student.examIds.push(examId);
    student.allGrades.push({ examId, subjects });
    await student.save();

    res.status(201).json({ message: 'Grade added successfully', grade: newGrade, examId });
  } catch (error) {
    if (error.code === 11000) {
      // If duplicate examId, it means we're adding another grade entry for the same student
      // This is actually okay - we want multiple grade entries for the same student
      // Let's modify the examId to include a timestamp to make it unique
      try {
        const { studentId, examDate, gradeType, comments, subjects } = req.body;
        const student = await Student.findById(studentId);
        
        let baseExamId;
        if (student.studentId) {
          baseExamId = `${student.studentId}-grades`;
        } else {
          baseExamId = `${student._id}-grades`;
        }
        
        // Add timestamp to make it unique
        const examId = `${baseExamId}-${Date.now()}`;
        
        const newGrade = new Grade({
          examId,
          student: studentId,
          examDate,
          gradeType,
          comments,
          subjects,
        });

        await newGrade.save();
        student.grades.push(newGrade._id);
        // Also push examId and subjects to student's document in the retry block
        student.examIds.push(examId);
        student.allGrades.push({ examId, subjects });
        await student.save();

        res.status(201).json({ message: 'Grade added successfully', grade: newGrade, examId });
      } catch (retryError) {
        console.error('Error creating grade (retry):', retryError);
        res.status(500).json({ message: 'Server error' });
      }
    } else {
      console.error('Error creating grade:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// Get all grades for a specific student
router.get('/student/:studentId', authenticateAdmin, async (req, res) => {
  try {
    const { studentId } = req.params;

    const grades = await Grade.find({ student: studentId }).sort({ examDate: -1 });
    res.status(200).json({ grades });
  } catch (error) {
    console.error('Error fetching student grades:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get grades by examId (for fetching all grades of a student)
router.get('/exam/:examId', authenticateAdmin, async (req, res) => {
  try {
    const { examId } = req.params;
    const { examDate } = req.query; // Optional: filter by specific exam date
    
    let query = {};
    
    // If examId ends with '-grades', find all grades that start with the base examId
    if (examId.endsWith('-grades')) {
      query.examId = { $regex: `^${examId.replace('-grades', '')}-grades` };
    } else {
      query.examId = examId;
    }
    
    // Add date filter if provided
    if (examDate) {
      query.examDate = new Date(examDate);
    }

    const grades = await Grade.find(query)
      .populate('student', 'fullname studentId specialStudentId')
      .sort({ examDate: -1 });
      
    res.status(200).json({ grades, examId });
  } catch (error) {
    console.error('Error fetching grades by examId:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single grade record by ID
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const grade = await Grade.findById(id);

    if (!grade) {
      return res.status(404).json({ message: 'Grade record not found.' });
    }

    res.status(200).json({ grade });
  } catch (error) {
    console.error('Error fetching single grade:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
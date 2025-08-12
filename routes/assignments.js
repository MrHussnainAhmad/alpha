const express = require('express');
const router = express.Router();
const Assignment = require('../models/assignment');
const Teacher = require('../models/teacher');
const Student = require('../models/student');
const Class = require('../models/class');
const auth = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and documents
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.oasis.opendocument.text'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDF, TXT, DOC, DOCX, and ODT files are allowed.'), false);
    }
  }
});

// Get teacher's assigned classes
router.get('/teacher/classes', auth.authenticateTeacher, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id).populate('classes', 'classNumber section');
    
    if (!teacher || !teacher.classes || teacher.classes.length === 0) {
      return res.status(404).json({ message: 'No classes assigned to this teacher' });
    }

    res.status(200).json({ 
      classes: teacher.classes.map(cls => ({
        id: cls._id,
        name: `${cls.classNumber}-${cls.section}`,
        classNumber: cls.classNumber,
        section: cls.section
      }))
    });
  } catch (error) {
    console.error('Error fetching teacher classes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new assignment
router.post('/create', auth.authenticateTeacher, upload.array('files', 10), async (req, res) => {
  try {
    const {
      title,
      description,
      subject,
      classId,
      dueDate,
      priority
    } = req.body;

    // Validate required fields
    if (!title || !description || !subject || !classId || !dueDate) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Check if teacher is assigned to this class
    const teacher = await Teacher.findById(req.user.id);
    const isAssignedToClass = teacher.classes.some(cls => cls.toString() === classId);
    
    if (!isAssignedToClass) {
      return res.status(403).json({ message: 'You are not assigned to this class' });
    }

    // Get class details
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Upload files to Cloudinary
    const uploadedFiles = [];
    const uploadedImages = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                resource_type: 'auto',
                folder: 'assignments',
                public_id: `${Date.now()}_${file.originalname}`
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            
            stream.end(file.buffer);
          });

          if (file.mimetype.startsWith('image/')) {
            uploadedImages.push(result.secure_url);
          } else {
            uploadedFiles.push({
              fileName: file.originalname,
              fileUrl: result.secure_url,
              fileSize: file.size,
              fileType: file.mimetype
            });
          }
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          return res.status(500).json({ message: 'Error uploading file' });
        }
      }
    }

    // Create assignment
    const assignment = new Assignment({
      title,
      description,
      subject,
      teacher: req.user.id,
      teacherName: teacher.fullname,
      class: classId,
      className: `${classData.classNumber}-${classData.section}`,
      section: classData.section,
      dueDate: new Date(dueDate),
      images: uploadedImages,
      attachments: uploadedFiles,
      priority: priority || 'medium'
    });

    await assignment.save();

    // Get total students in the class for statistics
    const studentCount = await Student.countDocuments({ class: classId, isActive: true });
    assignment.totalStudents = studentCount;
    await assignment.save();

    res.status(201).json({
      message: 'Assignment created successfully',
      assignment: {
        id: assignment._id,
        title: assignment.title,
        subject: assignment.subject,
        className: assignment.className,
        dueDate: assignment.dueDate,
        priority: assignment.priority,
        totalStudents: assignment.totalStudents
      }
    });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get assignments for a specific class (for students)
router.get('/class/:classId', auth.authenticateStudent, async (req, res) => {
  try {
    const { classId } = req.params;
    
    // Check if student belongs to this class
    const student = await Student.findById(req.user.id);
    if (student.class.toString() !== classId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const assignments = await Assignment.getClassAssignments(classId);
    
    res.status(200).json({ assignments });
  } catch (error) {
    console.error('Error fetching class assignments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get teacher's assignments
router.get('/teacher', auth.authenticateTeacher, async (req, res) => {
  try {
    const { classId, subject, status } = req.query;
    const options = {};
    
    if (classId) options.class = classId;
    if (subject) options.subject = subject;
    if (status) options.status = status;

    const assignments = await Assignment.getTeacherAssignments(req.user.id, options);
    
    res.status(200).json({ assignments });
  } catch (error) {
    console.error('Error fetching teacher assignments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get assignment details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const assignment = await Assignment.findById(id)
      .populate('teacher', 'fullname teacherId img')
      .populate('class', 'classNumber section');
    
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    res.status(200).json({ assignment });
  } catch (error) {
    console.error('Error fetching assignment details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update assignment
router.put('/:id', auth.authenticateTeacher, upload.array('files', 10), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      subject,
      dueDate,
      priority,
      status
    } = req.body;

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Check if teacher owns this assignment
    if (assignment.teacher.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only edit your own assignments' });
    }

    // Handle file uploads if any
    if (req.files && req.files.length > 0) {
      const uploadedFiles = [];
      const uploadedImages = [];

      for (const file of req.files) {
        try {
          const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                resource_type: 'auto',
                folder: 'assignments',
                public_id: `${Date.now()}_${file.originalname}`
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            
            stream.end(file.buffer);
          });

          if (file.mimetype.startsWith('image/')) {
            uploadedImages.push(result.secure_url);
          } else {
            uploadedFiles.push({
              fileName: file.originalname,
              fileUrl: result.secure_url,
              fileSize: file.size,
              fileType: file.mimetype
            });
          }
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          return res.status(500).json({ message: 'Error uploading file' });
        }
      }

      // Merge with existing files
      assignment.images = [...assignment.images, ...uploadedImages];
      assignment.attachments = [...assignment.attachments, ...uploadedFiles];
    }

    // Update assignment fields
    if (title) assignment.title = title;
    if (description) assignment.description = description;
    if (subject) assignment.subject = subject;
    if (dueDate) assignment.dueDate = new Date(dueDate);
    if (priority) assignment.priority = priority;
    if (status) assignment.status = status;

    await assignment.save();

    res.status(200).json({
      message: 'Assignment updated successfully',
      assignment
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete assignment
router.delete('/:id', auth.authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Check if teacher owns this assignment
    if (assignment.teacher.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own assignments' });
    }

    // Soft delete
    assignment.isActive = false;
    await assignment.save();

    res.status(200).json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get assignment statistics for teacher
router.get('/teacher/stats', auth.authenticateTeacher, async (req, res) => {
  try {
    const totalAssignments = await Assignment.countDocuments({ 
      teacher: req.user.id, 
      isActive: true 
    });
    
    const activeAssignments = await Assignment.countDocuments({ 
      teacher: req.user.id, 
      isActive: true, 
      status: 'active' 
    });
    
    const expiredAssignments = await Assignment.countDocuments({ 
      teacher: req.user.id, 
      isActive: true, 
      status: 'expired' 
    });

    res.status(200).json({
      stats: {
        total: totalAssignments,
        active: activeAssignments,
        expired: expiredAssignments
      }
    });
  } catch (error) {
    console.error('Error fetching assignment stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


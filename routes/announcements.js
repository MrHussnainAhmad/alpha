const express = require("express");
const Announcement = require("../models/announcement");
const Admin = require("../models/admin");
const Teacher = require("../models/teacher");
const Student = require("../models/student");
const { authenticateAdmin, authenticateToken, authenticateTeacher, authenticateAdminOrTeacher } = require("../middleware/auth");

const router = express.Router();

// Admin: Create announcement
router.post("/create", authenticateAdmin, async (req, res) => {
  try {
    const {
      title,
      message,
      images,
      targetType,
      targetClass,
      targetSection,
      priority,
      expiresAt
    } = req.body;

    // Validate targetType and required fields
    if (targetType === 'class' && !targetClass) {
      return res.status(400).json({ 
        message: "Target class is required when targeting specific class" 
      });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const announcement = new Announcement({
      title,
      message,
      images: images || [],
      targetType,
      targetClass: targetType === 'class' ? targetClass : undefined,
      targetSection: targetType === 'class' ? targetSection : undefined,
      createdBy: admin._id,
      createdByType: 'Admin',
      createdByName: admin.fullname,
      priority: priority || 'medium',
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    await announcement.save();

    res.status(201).json({
      message: "Announcement created successfully",
      announcement: {
        id: announcement._id,
        title: announcement.title,
        message: announcement.message,
        images: announcement.images,
        targetType: announcement.targetType,
        targetClass: announcement.targetClass,
        targetSection: announcement.targetSection,
        priority: announcement.priority,
        createdAt: announcement.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get all announcements (with filters)
router.get("/admin/all", authenticateAdmin, async (req, res) => {
  try {
    const { targetType, targetClass, priority, page = 1, limit = 10 } = req.query;
    
    const query = {};
    if (targetType) query.targetType = targetType;
    if (targetClass) query.targetClass = targetClass;
    if (priority) query.priority = priority;

    const announcements = await Announcement.find(query)
      .populate('createdBy', 'fullname username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Announcement.countDocuments(query);

    res.status(200).json({
      announcements,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalAnnouncements: total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Update announcement
router.put("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Don't allow changing createdBy fields
    delete updateData.createdBy;
    delete updateData.createdByName;

    const announcement = await Announcement.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('createdBy', 'fullname username');

    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    res.status(200).json({
      message: "Announcement updated successfully",
      announcement
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Delete announcement (soft delete)
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    res.status(200).json({ message: "Announcement deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get announcement statistics
router.get("/admin/stats", authenticateAdmin, async (req, res) => {
  try {
    const stats = await Announcement.aggregate([
      {
        $group: {
          _id: "$targetType",
          count: { $sum: 1 },
          priorities: {
            $push: "$priority"
          }
        }
      },
      {
        $project: {
          targetType: "$_id",
          count: 1,
          priorities: {
            $reduce: {
              input: "$priorities",
              initialValue: {},
              in: {
                $mergeObjects: [
                  "$$value",
                  {
                    $arrayToObject: [[
                      { k: "$$this", v: { $add: [{ $ifNull: [{ $getField: { field: "$$this", input: "$$value" } }, 0] }, 1] } }
                    ]]
                  }
                ]
              }
            }
          },
          _id: 0
        }
      }
    ]);

    const totalAnnouncements = await Announcement.countDocuments({ isActive: true });
    const expiredAnnouncements = await Announcement.countDocuments({ 
      expiresAt: { $lt: new Date() },
      isActive: true 
    });

    res.status(200).json({
      totalAnnouncements,
      expiredAnnouncements,
      byTargetType: stats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Teacher: Create announcement (can only target students or specific class)
router.post("/teacher/create", authenticateTeacher, async (req, res) => {
  try {
    const {
      title,
      message,
      images,
      targetType,
      targetClass,
      targetSection,
      priority,
      expiresAt
    } = req.body;

    // Teachers can only create announcements for students or specific classes
    if (targetType && !['students', 'class'].includes(targetType)) {
      return res.status(403).json({ 
        message: "Teachers can only send announcements to students or specific classes" 
      });
    }

    // Validate targetType and required fields
    if (targetType === 'class' && !targetClass) {
      return res.status(400).json({ 
        message: "Target class is required when targeting specific class" 
      });
    }

    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const announcement = new Announcement({
      title,
      message,
      images: images || [],
      targetType: targetType || 'students', // Default to all students
      targetClass: targetType === 'class' ? targetClass : undefined,
      targetSection: targetType === 'class' ? targetSection : undefined,
      createdBy: teacher._id,
      createdByType: 'Teacher',
      createdByName: teacher.fullname,
      priority: priority || 'medium',
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    await announcement.save();

    res.status(201).json({
      message: "Announcement created successfully",
      announcement: {
        id: announcement._id,
        title: announcement.title,
        message: announcement.message,
        images: announcement.images,
        targetType: announcement.targetType,
        targetClass: announcement.targetClass,
        targetSection: announcement.targetSection,
        priority: announcement.priority,
        createdAt: announcement.createdAt,
        createdByName: announcement.createdByName
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Teacher: Get their own announcements
router.get("/teacher/my-announcements", authenticateTeacher, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const announcements = await Announcement.find({ 
      createdBy: req.user.id,
      createdByType: 'Teacher'
    })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Announcement.countDocuments({ 
      createdBy: req.user.id,
      createdByType: 'Teacher'
    });

    res.status(200).json({
      announcements,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalAnnouncements: total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Teacher: Update their own announcement
router.put("/teacher/:id", authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Don't allow changing createdBy fields
    delete updateData.createdBy;
    delete updateData.createdByName;
    delete updateData.createdByType;
    
    // Validate targetType restrictions for teachers
    if (updateData.targetType && !['students', 'class'].includes(updateData.targetType)) {
      return res.status(403).json({ 
        message: "Teachers can only target students or specific classes" 
      });
    }

    const announcement = await Announcement.findOneAndUpdate(
      { 
        _id: id, 
        createdBy: req.user.id,
        createdByType: 'Teacher'
      },
      updateData,
      { new: true }
    );

    if (!announcement) {
      return res.status(404).json({ 
        message: "Announcement not found or you don't have permission to update it" 
      });
    }

    res.status(200).json({
      message: "Announcement updated successfully",
      announcement
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Teacher: Delete their own announcement
router.delete("/teacher/:id", authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findOneAndUpdate(
      { 
        _id: id, 
        createdBy: req.user.id,
        createdByType: 'Teacher'
      },
      { isActive: false },
      { new: true }
    );

    if (!announcement) {
      return res.status(404).json({ 
        message: "Announcement not found or you don't have permission to delete it" 
      });
    }

    res.status(200).json({ message: "Announcement deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get announcements for teachers
router.get("/teacher", authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ message: "Teacher access required" });
    }

    const announcements = await Announcement.getForUser('teacher', req.user.id);

    res.status(200).json({ announcements });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get announcements for students
router.get("/student", authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'student') {
      return res.status(403).json({ message: "Student access required" });
    }

    // Get student details for class-specific announcements
    const student = await Student.findById(req.user.id).select('class section');
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const announcements = await Announcement.getForUser(
      'student', 
      req.user.id, 
      student.class, 
      student.section
    );

    res.status(200).json({ announcements });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark announcement as read
router.post("/:id/read", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userType = req.user.userType;
    
    if (userType !== 'teacher' && userType !== 'student') {
      return res.status(403).json({ message: "Only teachers and students can mark announcements as read" });
    }

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    announcement.markAsRead(req.user.id, userType);
    await announcement.save();

    res.status(200).json({ message: "Announcement marked as read" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Student: Post a question to class announcement board
router.post("/student/ask-question", authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'student') {
      return res.status(403).json({ message: "Student access required" });
    }

    const {
      title,
      message,
      images,
      questionType,
      subject,
      priority
    } = req.body;

    if (!title || !message || !questionType || !subject) {
      return res.status(400).json({
        message: "Title, message, question type, and subject are required"
      });
    }

    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const questionAnnouncement = new Announcement({
      title,
      message,
      images: images || [],
      targetType: 'question',
      targetClass: student.class,
      targetSection: student.section,
      questionType,
      subject,
      createdBy: student._id,
      createdByType: 'Student',
      createdByName: student.fullname,
      priority: priority || 'medium'
    });

    await questionAnnouncement.save();

    res.status(201).json({
      message: "Question posted successfully",
      question: {
        id: questionAnnouncement._id,
        title: questionAnnouncement.title,
        message: questionAnnouncement.message,
        subject: questionAnnouncement.subject,
        questionType: questionAnnouncement.questionType,
        class: questionAnnouncement.targetClass,
        section: questionAnnouncement.targetSection,
        studentName: questionAnnouncement.createdByName,
        createdAt: questionAnnouncement.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Teacher/Admin: Reply to student question
router.post("/:questionId/reply", authenticateAdminOrTeacher, async (req, res) => {
  try {
    const { questionId } = req.params;
    const { replyMessage, replyImages } = req.body;

    if (!replyMessage) {
      return res.status(400).json({ message: "Reply message is required" });
    }

    const question = await Announcement.findOne({
      _id: questionId,
      targetType: 'question'
    });
    
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Get replier details
    let repliedBy, repliedByName, repliedByType;
    if (req.user.userType === 'admin') {
      const admin = await Admin.findById(req.user.id);
      repliedBy = admin._id;
      repliedByName = admin.fullname;
      repliedByType = 'Admin';
    } else {
      const teacher = await Teacher.findById(req.user.id);
      repliedBy = teacher._id;
      repliedByName = teacher.fullname;
      repliedByType = 'Teacher';
    }

    const replyData = {
      replyMessage,
      replyImages: replyImages || []
    };

    question.addReply(replyData, repliedBy, repliedByType, repliedByName);
    await question.save();

    res.status(201).json({
      message: "Reply added successfully",
      reply: {
        replyId: question.replies[question.replies.length - 1]._id,
        replyMessage,
        repliedBy: repliedByName,
        repliedAt: question.replies[question.replies.length - 1].repliedAt
      },
      totalReplies: question.replies.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Student: Accept a teacher's reply as the answer
router.post("/:questionId/accept-reply/:replyId", authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'student') {
      return res.status(403).json({ message: "Only students can accept replies" });
    }

    const { questionId, replyId } = req.params;

    const question = await Announcement.findOne({
      _id: questionId,
      targetType: 'question',
      createdBy: req.user.id
    });
    
    if (!question) {
      return res.status(404).json({ 
        message: "Question not found or you don't have permission" 
      });
    }

    const success = question.acceptReply(replyId);
    if (!success) {
      return res.status(404).json({ message: "Reply not found" });
    }

    await question.save();

    res.status(200).json({
      message: "Reply accepted as answer successfully",
      acceptedReplyId: replyId,
      isResolved: question.isResolved
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get questions for a specific class (for teachers and students)
router.get("/questions/class/:class/:section", authenticateToken, async (req, res) => {
  try {
    const { class: className, section } = req.params;
    const { subject, questionType, isResolved, page = 1, limit = 10 } = req.query;
    
    // Check access permissions
    let hasAccess = false;
    if (req.user.userType === 'admin') {
      hasAccess = true;
    } else if (req.user.userType === 'teacher') {
      hasAccess = true; // Teachers can view all class questions
    } else if (req.user.userType === 'student') {
      const student = await Student.findById(req.user.id);
      hasAccess = student && student.class === className && student.section === section;
    }

    if (!hasAccess) {
      return res.status(403).json({ message: "You don't have access to this class" });
    }

    const filters = {};
    if (subject) filters.subject = subject;
    if (questionType) filters.questionType = questionType;
    if (isResolved !== undefined) filters.isResolved = isResolved === 'true';

    const questions = await Announcement.getClassQuestions(className, section, filters);

    // Add pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedQuestions = questions.slice(startIndex, endIndex);

    res.status(200).json({
      questions: paginatedQuestions,
      totalQuestions: questions.length,
      totalPages: Math.ceil(questions.length / limit),
      currentPage: page,
      hasMore: endIndex < questions.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Student: Get their own questions
router.get("/student/my-questions", authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'student') {
      return res.status(403).json({ message: "Student access required" });
    }

    const { subject, questionType, isResolved } = req.query;
    
    const query = {
      targetType: 'question',
      createdBy: req.user.id,
      isActive: true
    };
    
    if (subject) query.subject = subject;
    if (questionType) query.questionType = questionType;
    if (isResolved !== undefined) query.isResolved = isResolved === 'true';

    const questions = await Announcement.find(query)
      .populate('replies.repliedBy', 'fullname username teacherId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      totalQuestions: questions.length,
      questions: questions.map(q => ({
        id: q._id,
        title: q.title,
        message: q.message,
        subject: q.subject,
        questionType: q.questionType,
        isResolved: q.isResolved,
        totalReplies: q.replies.length,
        createdAt: q.createdAt,
        replies: q.replies
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single announcement details
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findById(id)
      .populate('createdBy', 'fullname username studentId')
      .populate('replies.repliedBy', 'fullname username teacherId');
      
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    // Check if user has access to this announcement
    const userType = req.user.userType;
    if (userType === 'teacher' || userType === 'student') {
      let hasAccess = false;
      
      if (announcement.targetType === 'all') {
        hasAccess = true;
      } else if (announcement.targetType === 'teachers' && userType === 'teacher') {
        hasAccess = true;
      } else if (announcement.targetType === 'students' && userType === 'student') {
        hasAccess = true;
      } else if (announcement.targetType === 'question') {
        // For questions, check class access
        if (userType === 'teacher') {
          hasAccess = true; // Teachers can see all questions
        } else if (userType === 'student') {
          const student = await Student.findById(req.user.id).select('class section');
          hasAccess = student && 
                     student.class === announcement.targetClass && 
                     student.section === announcement.targetSection;
        }
      } else if (announcement.targetType === 'class' && userType === 'student') {
        const student = await Student.findById(req.user.id).select('class section');
        if (student && student.class === announcement.targetClass) {
          if (!announcement.targetSection || 
              !student.section || 
              announcement.targetSection === student.section) {
            hasAccess = true;
          }
        }
      }
      
      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this announcement" });
      }
    }

    res.status(200).json({ announcement });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

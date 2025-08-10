const express = require("express");
const ClassQuestion = require("../models/classQuestion");
const Student = require("../models/student");
const Teacher = require("../models/teacher");
const Admin = require("../models/admin");
const { authenticateToken, authenticateAdmin, authenticateTeacher, authenticateAdminOrTeacher } = require("../middleware/auth");

const router = express.Router();

// Student: Post a question for class
router.post("/student/ask", authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'student') {
      return res.status(403).json({ message: "Student access required" });
    }

    const {
      title,
      question,
      images,
      subject,
      academicYear,
      priority,
      isAnonymous,
      tags
    } = req.body;

    if (!title || !question || !subject || !academicYear) {
      return res.status(400).json({
        message: "Title, question, subject, and academic year are required"
      });
    }

    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const classQuestion = new ClassQuestion({
      title,
      question,
      images: images || [],
      subject,
      studentId: student._id,
      studentIdString: student.studentId,
      studentName: isAnonymous ? "Anonymous Student" : student.fullname,
      className: student.className,
      section: student.section,
      academicYear,
      priority: priority || 'medium',
      isAnonymous: isAnonymous || false,
      tags: tags || []
    });

    await classQuestion.save();

    res.status(201).json({
      message: "Question posted successfully",
      question: {
        id: classQuestion._id,
        title: classQuestion.title,
        question: classQuestion.question,
        subject: classQuestion.subject,
        class: classQuestion.class,
        section: classQuestion.section,
        studentName: classQuestion.studentName,
        status: classQuestion.status,
        createdAt: classQuestion.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get questions for a class (visible to students and teachers of that class)
router.get("/class/:className/:section", authenticateToken, async (req, res) => {
  try {
    const { className: queryClassName, section } = req.params; // Renamed class to queryClassName
    const { subject, status, academicYear, priority, page = 1, limit = 10 } = req.query;
    
    // Check if user has access to this class
    let hasAccess = false;
    
    if (req.user.userType === 'admin') {
      hasAccess = true;
    } else if (req.user.userType === 'student') {
      const student = await Student.findById(req.user.id);
      hasAccess = student && student.className === queryClassName && student.section === section; // Use className
    } else if (req.user.userType === 'teacher') {
      hasAccess = true; // Teachers can view all classes
    }

    if (!hasAccess) {
      return res.status(403).json({ message: "You don't have access to this class" });
    }

    const questions = await ClassQuestion.getClassQuestions(queryClassName, section, { // Use queryClassName
      subject,
      status,
      academicYear,
      priority
    });

    // Add pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedQuestions = questions.slice(startIndex, endIndex);

    // Add view tracking if user is viewing
    if (req.user.userType !== 'admin') {
      for (let question of paginatedQuestions) {
        question.addView(req.user.id, req.user.userType);
        await question.save();
      }
    }

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

// Teacher/Admin: Answer a question
router.post("/:questionId/answer", authenticateAdminOrTeacher, async (req, res) => {
  try {
    const { questionId } = req.params;
    const { answer, images, remarks } = req.body;

    if (!answer) {
      return res.status(400).json({ message: "Answer is required" });
    }

    const question = await ClassQuestion.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Get answerer details
    let answeredBy, answeredByName, answeredByType;
    if (req.user.userType === 'admin') {
      const admin = await Admin.findById(req.user.id);
      answeredBy = admin._id;
      answeredByName = admin.fullname;
      answeredByType = 'Admin';
    } else {
      const teacher = await Teacher.findById(req.user.id);
      answeredBy = teacher._id;
      answeredByName = teacher.fullname;
      answeredByType = 'Teacher';
    }

    const answerData = {
      answer,
      images: images || [],
      remarks: remarks || ''
    };

    question.addAnswer(answerData, answeredBy, answeredByType, answeredByName);
    await question.save();

    res.status(201).json({
      message: "Answer added successfully",
      answer: {
        answerId: question.answers[question.answers.length - 1]._id,
        answer,
        answeredBy: answeredByName,
        answeredAt: question.answers[question.answers.length - 1].answeredAt
      },
      questionStatus: question.status,
      totalAnswers: question.totalAnswers
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Student: Accept an answer (only the question author can accept)
router.post("/:questionId/accept/:answerId", authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'student') {
      return res.status(403).json({ message: "Only students can accept answers" });
    }

    const { questionId, answerId } = req.params;

    const question = await ClassQuestion.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Check if the student is the author of the question
    if (question.studentId.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only accept answers to your own questions" });
    }

    const success = question.acceptAnswer(answerId);
    if (!success) {
      return res.status(404).json({ message: "Answer not found" });
    }

    await question.save();

    res.status(200).json({
      message: "Answer accepted successfully",
      acceptedAnswerId: answerId,
      questionStatus: question.status
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Like an answer
router.post("/:questionId/like/:answerId", authenticateToken, async (req, res) => {
  try {
    if (req.user.userType === 'admin') {
      return res.status(403).json({ message: "Admins cannot like answers" });
    }

    const { questionId, answerId } = req.params;

    const question = await ClassQuestion.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const success = question.likeAnswer(answerId, req.user.id, req.user.userType);
    if (!success) {
      return res.status(400).json({ message: "Answer not found or already liked" });
    }

    await question.save();

    const answer = question.answers.id(answerId);
    res.status(200).json({
      message: "Answer liked successfully",
      totalLikes: answer.likes.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get student's own questions
router.get("/student/my-questions", authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'student') {
      return res.status(403).json({ message: "Student access required" });
    }

    const { subject, status, academicYear } = req.query;
    
    const questions = await ClassQuestion.getStudentQuestions(req.user.id, {
      subject,
      status,
      academicYear
    });

    res.status(200).json({
      totalQuestions: questions.length,
      questions: questions.map(q => ({
        id: q._id,
        title: q.title,
        question: q.question,
        subject: q.subject,
        status: q.status,
        totalAnswers: q.totalAnswers,
        totalViews: q.totalViews,
        acceptedAnswerId: q.acceptedAnswerId,
        createdAt: q.createdAt,
        lastActivityAt: q.lastActivityAt,
        answers: q.answers
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get questions by subject (for teachers)
router.get("/subject/:subject", authenticateAdminOrTeacher, async (req, res) => {
  try {
    const { subject } = req.params;
    const { className, section, status, academicYear } = req.query; // Renamed class to className
    
    const questions = await ClassQuestion.getQuestionsBySubject(subject, {
      className: className, // Use className
      section,
      status,
      academicYear
    });

    res.status(200).json({
      subject,
      totalQuestions: questions.length,
      questions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single question details
router.get("/:questionId", authenticateToken, async (req, res) => {
  try {
    const { questionId } = req.params;
    
    const question = await ClassQuestion.findById(questionId)
      .populate('studentId', 'fullname studentId className section img') // Use className
      .populate('answers.answeredBy', 'fullname username teacherId');
      
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Check access permissions
    let hasAccess = false;
    if (req.user.userType === 'admin') {
      hasAccess = true;
    } else if (req.user.userType === 'teacher') {
      hasAccess = true;
    } else if (req.user.userType === 'student') {
      const student = await Student.findById(req.user.id);
      hasAccess = student && student.className === question.className && student.section === question.section; // Use className
    }

    if (!hasAccess) {
      return res.status(403).json({ message: "You don't have access to this question" });
    }

    // Add view tracking
    if (req.user.userType !== 'admin') {
      question.addView(req.user.id, req.user.userType);
      await question.save();
    }

    res.status(200).json({ question });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get all questions with filters
router.get("/admin/all", authenticateAdmin, async (req, res) => {
  try {
    const { 
      subject, 
      status, 
      academicYear, 
      class: className, 
      section, 
      priority,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const query = { isActive: true };
    
    if (subject) query.subject = subject;
    if (status) query.status = status;
    if (academicYear) query.academicYear = academicYear;
    if (className) query.className = className;
    if (section) query.section = section;
    if (priority) query.priority = priority;

    const questions = await ClassQuestion.find(query)
      .populate('studentId', 'fullname studentId className section') // Use className
      .populate('answers.answeredBy', 'fullname username teacherId')
      .sort({ lastActivityAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ClassQuestion.countDocuments(query);

    res.status(200).json({
      questions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalQuestions: total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get Q&A statistics
router.get("/admin/statistics", authenticateAdmin, async (req, res) => {
  try {
    const totalQuestions = await ClassQuestion.countDocuments({ isActive: true });
    
    const statusStats = await ClassQuestion.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const subjectStats = await ClassQuestion.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$subject", count: { $sum: 1 }, avgAnswers: { $avg: "$totalAnswers" } } },
      { $sort: { count: -1 } }
    ]);

    const classStats = await ClassQuestion.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: { className: "$className", section: "$section" }, count: { $sum: 1 } } },
      { $sort: { "_id.className": 1, "_id.section": 1 } }
    ]);

    res.status(200).json({
      totalQuestions,
      statusDistribution: statusStats,
      subjectDistribution: subjectStats,
      classDistribution: classStats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Student: Update/Delete their own question
router.put("/student/:questionId", authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'student') {
      return res.status(403).json({ message: "Student access required" });
    }

    const { questionId } = req.params;
    const updateData = { ...req.body };
    
    // Don't allow changing certain fields
    delete updateData.studentId;
    delete updateData.studentIdString;
    delete updateData.className;
    delete updateData.section;
    delete updateData.answers;
    delete updateData.status;

    const question = await ClassQuestion.findOne({
      _id: questionId,
      studentId: req.user.id
    });

    if (!question) {
      return res.status(404).json({ message: "Question not found or you don't have permission" });
    }

    // Only allow updates if no answers yet
    if (question.totalAnswers > 0) {
      return res.status(400).json({ message: "Cannot update question after it has been answered" });
    }

    Object.assign(question, updateData);
    await question.save();

    res.status(200).json({
      message: "Question updated successfully",
      question
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

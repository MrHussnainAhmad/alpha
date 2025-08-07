const express = require("express");
const FeeVoucher = require("../models/feeVoucher");
const Student = require("../models/student");
const Admin = require("../models/admin");
const { authenticateAdmin, authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Admin: Get all fee vouchers with filters and grouping
router.get("/admin/all", authenticateAdmin, async (req, res) => {
  try {
    const { 
      status, 
      academicYear, 
      month, 
      feeType, 
      class: className, 
      section,
      studentId,
      specialStudentId,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const query = { isActive: true };
    
    if (status) query.status = status;
    if (academicYear) query.academicYear = academicYear;
    if (month) query.month = month;
    if (feeType) query.feeType = feeType;
    if (className) query.class = className;
    if (section) query.section = section;
    if (studentId) query.studentIdString = studentId;
    if (specialStudentId) query.specialStudentId = specialStudentId;

    const vouchers = await FeeVoucher.find(query)
      .populate('studentId', 'fullname studentId class section fathername')
      .populate('verifiedBy', 'fullname username')
      .sort({ submissionDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await FeeVoucher.countDocuments(query);

    // Group vouchers by student for better organization
    const groupedVouchers = {};
    vouchers.forEach(voucher => {
      const studentKey = voucher.studentIdString;
      if (!groupedVouchers[studentKey]) {
        groupedVouchers[studentKey] = {
          studentInfo: {
            studentId: voucher.studentIdString,
            studentName: voucher.studentName,
            fatherName: voucher.fatherName,
            class: voucher.class,
            section: voucher.section
          },
          vouchers: []
        };
      }
      groupedVouchers[studentKey].vouchers.push({
        id: voucher._id,
        specialStudentId: voucher.specialStudentId,
        voucherImage: voucher.voucherImage,
        voucherNumber: voucher.voucherNumber,
        amount: voucher.amount,
        feeType: voucher.feeType,
        month: voucher.month,
        academicYear: voucher.academicYear,
        paymentDate: voucher.paymentDate,
        submissionDate: voucher.submissionDate,
        status: voucher.status,
        verifiedBy: voucher.verifiedByName,
        verificationDate: voucher.verificationDate,
        adminRemarks: voucher.adminRemarks,
        studentRemarks: voucher.studentRemarks
      });
    });

    res.status(200).json({
      vouchers,
      groupedVouchers,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalVouchers: total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Search vouchers by special student ID
router.get("/admin/search/:specialStudentId", authenticateAdmin, async (req, res) => {
  try {
    const { specialStudentId } = req.params;
    
    const voucher = await FeeVoucher.findOne({ 
      specialStudentId: specialStudentId,
      isActive: true 
    })
      .populate('studentId', 'fullname studentId class section fathername')
      .populate('verifiedBy', 'fullname username');

    if (!voucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    res.status(200).json({ voucher });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get vouchers grouped by student
router.get("/admin/grouped/:studentIdString", authenticateAdmin, async (req, res) => {
  try {
    const { studentIdString } = req.params;
    const { status, academicYear, month, feeType } = req.query;
    
    const vouchers = await FeeVoucher.getStudentVouchers(studentIdString, {
      status,
      academicYear,
      month,
      feeType
    });

    if (vouchers.length === 0) {
      return res.status(404).json({ message: "No vouchers found for this student" });
    }

    // Group vouchers by academic year and month for better organization
    const groupedByPeriod = {};
    vouchers.forEach(voucher => {
      const key = `${voucher.academicYear}_${voucher.month || 'general'}`;
      if (!groupedByPeriod[key]) {
        groupedByPeriod[key] = {
          academicYear: voucher.academicYear,
          month: voucher.month,
          vouchers: []
        };
      }
      groupedByPeriod[key].vouchers.push(voucher);
    });

    res.status(200).json({
      studentInfo: {
        studentId: vouchers[0].studentIdString,
        studentName: vouchers[0].studentName,
        fatherName: vouchers[0].fatherName,
        class: vouchers[0].class,
        section: vouchers[0].section
      },
      totalVouchers: vouchers.length,
      groupedByPeriod,
      allVouchers: vouchers
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Verify fee voucher
router.put("/admin/verify/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const voucher = await FeeVoucher.findById(id);
    if (!voucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    voucher.verifyVoucher(admin._id, admin.fullname, remarks);
    await voucher.save();

    res.status(200).json({
      message: "Voucher verified successfully",
      voucher: {
        id: voucher._id,
        specialStudentId: voucher.specialStudentId,
        status: voucher.status,
        verifiedBy: voucher.verifiedByName,
        verificationDate: voucher.verificationDate,
        adminRemarks: voucher.adminRemarks
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Reject fee voucher
router.put("/admin/reject/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    if (!remarks) {
      return res.status(400).json({ message: "Remarks are required when rejecting a voucher" });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const voucher = await FeeVoucher.findById(id);
    if (!voucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    voucher.rejectVoucher(admin._id, admin.fullname, remarks);
    await voucher.save();

    res.status(200).json({
      message: "Voucher rejected successfully",
      voucher: {
        id: voucher._id,
        specialStudentId: voucher.specialStudentId,
        status: voucher.status,
        verifiedBy: voucher.verifiedByName,
        verificationDate: voucher.verificationDate,
        adminRemarks: voucher.adminRemarks
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get fee voucher statistics
router.get("/admin/statistics", authenticateAdmin, async (req, res) => {
  try {
    const { academicYear, month } = req.query;
    
    const statistics = await FeeVoucher.getStatistics({ academicYear, month });
    
    // Get statistics by class
    const classwiseStats = await FeeVoucher.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: { class: "$class", section: "$section" },
          totalVouchers: { $sum: 1 },
          pendingVouchers: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
          },
          verifiedVouchers: {
            $sum: { $cond: [{ $eq: ["$status", "verified"] }, 1, 0] }
          },
          rejectedVouchers: {
            $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] }
          },
          totalAmount: { $sum: "$amount" }
        }
      },
      { $sort: { "_id.class": 1, "_id.section": 1 } }
    ]);

    // Get monthly statistics
    const monthlyStats = await FeeVoucher.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: { academicYear: "$academicYear", month: "$month" },
          totalVouchers: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          averageAmount: { $avg: "$amount" }
        }
      },
      { $sort: { "_id.academicYear": -1, "_id.month": 1 } }
    ]);

    res.status(200).json({
      overallStatistics: statistics[0] || {
        totalVouchers: 0,
        pendingVouchers: 0,
        verifiedVouchers: 0,
        rejectedVouchers: 0,
        totalAmount: 0,
        averageAmount: 0
      },
      classwiseStatistics: classwiseStats,
      monthlyStatistics: monthlyStats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get vouchers by class
router.get("/admin/class/:class/:section", authenticateAdmin, async (req, res) => {
  try {
    const { class: className, section } = req.params;
    const { status, academicYear, month, feeType } = req.query;
    
    const vouchers = await FeeVoucher.getClassVouchers(className, section, {
      status,
      academicYear,
      month,
      feeType
    });

    // Group by student
    const groupedByStudent = {};
    vouchers.forEach(voucher => {
      const studentKey = voucher.studentIdString;
      if (!groupedByStudent[studentKey]) {
        groupedByStudent[studentKey] = {
          studentInfo: {
            studentId: voucher.studentIdString,
            studentName: voucher.studentName,
            rollNumber: voucher.rollNumber
          },
          vouchers: []
        };
      }
      groupedByStudent[studentKey].vouchers.push(voucher);
    });

    res.status(200).json({
      class: className,
      section: section,
      totalVouchers: vouchers.length,
      groupedByStudent,
      allVouchers: vouchers
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Student: Get own vouchers
router.get("/student/my-vouchers", authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'student') {
      return res.status(403).json({ message: "Student access required" });
    }

    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const { status, academicYear, month, feeType } = req.query;
    
    const vouchers = await FeeVoucher.getStudentVouchers(student.studentId, {
      status,
      academicYear,
      month,
      feeType
    });

    res.status(200).json({
      totalVouchers: vouchers.length,
      vouchers: vouchers.map(voucher => ({
        id: voucher._id,
        specialStudentId: voucher.specialStudentId,
        voucherImage: voucher.voucherImage,
        amount: voucher.amount,
        feeType: voucher.feeType,
        month: voucher.month,
        academicYear: voucher.academicYear,
        paymentDate: voucher.paymentDate,
        submissionDate: voucher.submissionDate,
        status: voucher.status,
        verificationDate: voucher.verificationDate,
        adminRemarks: voucher.adminRemarks,
        studentRemarks: voucher.studentRemarks
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

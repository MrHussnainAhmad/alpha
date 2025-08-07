const express = require("express");
const Student = require("../models/student");
const Announcement = require("../models/announcement");
const Marks = require("../models/marks");
const FeeVoucher = require("../models/feeVoucher");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const router = express.Router();

// Student login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const student = await Student.findOne({ email });
    if (!student || !student.isActive) {
      return res.status(400).json({ message: "Invalid credentials or account deactivated" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, student.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: student._id, studentId: student.studentId, userType: "student" },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({ 
      message: "Login successful",
      token,
      student: {
        id: student._id,
        fullname: student.fullname,
        studentId: student.studentId,
        email: student.email,
        class: student.class,
        section: student.section,
        img: student.img,
        specialStudentId: student.specialStudentId
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get student profile
router.get("/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const student = await Student.findById(id).select('-password');
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json({ student });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update student profile
router.put("/profile", async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.password; // Don't allow password update through this route
    delete updateData.studentId; // Don't allow studentId change
    delete updateData.specialStudentId; // Don't allow specialStudentId change
    
    const student = await Student.findOneAndUpdate(
      { _id: req.body.id },
      updateData,
      { new: true }
    ).select('-password');

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json({ 
      message: "Profile updated successfully",
      student 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Change password
router.put("/change-password", async (req, res) => {
  try {
    const { id, currentPassword, newPassword } = req.body;
    
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const isCurrentPasswordCorrect = await bcrypt.compare(currentPassword, student.password);
    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    student.password = hashedNewPassword;
    await student.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Submit fee voucher with image
router.post("/submit-fee-voucher", async (req, res) => {
  try {
    const {
      studentId,
      rollNumber,
      voucherNumber,
      amount,
      feeType,
      academicYear,
      month,
      bankName,
      paymentDate,
      studentRemarks
    } = req.body;
    const feeVoucherImage = req.file ? req.file.path : null;

    if (!feeVoucherImage) {
      return res.status(400).json({ message: "Fee voucher image is required" });
    }

    if (!studentId || !rollNumber || !academicYear || !paymentDate) {
      return res.status(400).json({
        message: "Student ID, roll number, academic year, and payment date are required"
      });
    }

    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Assign special ID for fee voucher
    const specialId = student.assignSpecialIdForFeeVoucher(rollNumber);
    student.feeVoucherSubmitted = true;
    student.feeVoucherImage = feeVoucherImage;
    
    await student.save();

    // Create fee voucher record in the dedicated database
    const feeVoucher = new FeeVoucher({
      specialStudentId: specialId,
      studentId: student._id,
      studentIdString: student.studentId,
      studentName: student.fullname,
      fatherName: student.fathername,
      class: student.class,
      section: student.section,
      rollNumber: rollNumber,
      voucherImage: feeVoucherImage,
      voucherNumber: voucherNumber || '',
      amount: amount || 0,
      feeType: feeType || 'monthly',
      academicYear: academicYear,
      month: month || null,
      bankName: bankName || '',
      paymentDate: new Date(paymentDate),
      studentRemarks: studentRemarks || ''
    });

    await feeVoucher.save();

    res.status(200).json({ 
      message: "Fee voucher submitted successfully",
      specialStudentId: specialId,
      voucherDetails: {
        id: feeVoucher._id,
        specialStudentId: feeVoucher.specialStudentId,
        voucherImage: feeVoucher.voucherImage,
        amount: feeVoucher.amount,
        feeType: feeVoucher.feeType,
        status: feeVoucher.status,
        submissionDate: feeVoucher.submissionDate
      },
      student: {
        id: student._id,
        fullname: student.fullname,
        studentId: student.studentId,
        specialStudentId: student.specialStudentId,
        feeVoucherSubmitted: student.feeVoucherSubmitted
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get fee voucher status
router.get("/fee-voucher-status/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const student = await Student.findOne({ studentId })
      .select('fullname studentId specialStudentId feeVoucherSubmitted feeVoucherImage rollNumber');
    
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json({ 
      student: {
        fullname: student.fullname,
        studentId: student.studentId,
        specialStudentId: student.specialStudentId,
        feeVoucherSubmitted: student.feeVoucherSubmitted,
        feeVoucherImage: student.feeVoucherImage,
        rollNumber: student.rollNumber
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

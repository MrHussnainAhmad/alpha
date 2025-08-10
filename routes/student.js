const express = require("express");
const Student = require("../models/student");
const Announcement = require("../models/announcement");
const FeeVoucher = require("../models/feeVoucher");
const Class = require("../models/class");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { authenticateAdmin } = require("../middleware/auth");

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
        className: student.className,
        section: student.section,
        profilePicture: student.profilePicture,
        specialStudentId: student.specialStudentId
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Student signup (self-registration with auto-generated studentId)
router.post("/signup", async (req, res) => {
  console.log('Executing new signup route handler...'); // Diagnostic log
  try {
    const studentData = req.body;
    
    // Check if student with email already exists
    const existingStudent = await Student.findOne({ email: studentData.email });
    if (existingStudent) {
      return res.status(400).json({ message: "Student with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(studentData.password, 10);
    
    // Generate auto Student ID
    const cleanName = studentData.fullname.replace(/\s+/g, '').toLowerCase();
    
    // Generate studentId - if class is provided, we'll update it in pre-save middleware
    // For now, create a temporary studentId
    let studentId;
    if (studentData.class) {
      const studentClass = await Class.findById(studentData.class);
      if (studentClass) {
        studentId = `S-${cleanName}-${studentClass.classNumber}`;
      } else {
        studentId = `S-${cleanName}-Unassigned`;
      }
    } else {
      studentId = `S-${cleanName}-Unassigned`;
    }
    
    const student = new Student({
      ...studentData,
      password: hashedPassword,
      studentId, // Auto-generated Student ID
      img: '', // Default to empty, will show default image in frontend
    });

    await student.save();

    res.status(201).json({ 
      message: "Student account created successfully with Student ID: " + studentId,
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

// Update student profile (by admin)
router.put("/admin/profile", authenticateAdmin, async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.password; // Don't allow password update through this route
    
    const student = await Student.findOneAndUpdate(
      { _id: req.body.id },
      updateData,
      { new: true }
    ).select('-password');

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json({ 
      message: "Profile updated successfully by admin",
      student 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update student profile (by student)
router.put("/profile", async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.password; // Don't allow password update through this route
    delete updateData.studentId; // Don't allow studentId change
    delete updateData.specialStudentId; // Don't allow specialStudentId change
    delete updateData.currentFee; // Don't allow fee changes
    delete updateData.futureFee; // Don't allow fee changes
    
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
      className: student.className, // Changed from class
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
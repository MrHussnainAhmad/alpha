const express = require("express");
const FeeVoucher = require("../models/feeVoucher");
const Student = require("../models/student");
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { authenticateStudent, authenticateAdmin } = require('../middleware/auth');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

// Helper function to generate specialStudentId and newId
async function generateFeeVoucherIds(studentId) {
  let specialStudentId;
  let newIdNumber = 1;

  // Find existing specialStudentId for this student
  const existingVoucher = await FeeVoucher.findOne({ studentId }).sort({ uploadedAt: -1 });

  if (existingVoucher) {
    specialStudentId = existingVoucher.specialStudentId;
    const lastNewIdParts = existingVoucher.newId.split('-');
    const lastNewIdNumber = parseInt(lastNewIdParts[lastNewIdParts.length - 1]);
    newIdNumber = lastNewIdNumber + 1;
  } else {
    // Generate a new specialStudentId if no existing vouchers for this student
    // Format: studentId-timestamp (e.g., s-ali-10-1678886400000)
    specialStudentId = `${studentId}-${Date.now()}`;
  }

  const newId = `${specialStudentId}-${newIdNumber}`;
  return { specialStudentId, newId };
}

// Student upload fee voucher
router.post("/upload", authenticateStudent, upload.single('image'), async (req, res) => {
  try {
    const studentId = req.user.studentId; // Assuming studentId is available in req.user from authentication
    const student = await Student.findOne({ studentId });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const b64 = Buffer.from(req.file.buffer).toString("base64");
    let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

    const { specialStudentId, newId } = await generateFeeVoucherIds(studentId);

    const uploadResult = await cloudinary.uploader.upload(dataURI, {
      folder: 'school-app/feeVouchers',
      resource_type: 'image',
    });

    const feeVoucher = new FeeVoucher({
      student: student._id,
      studentId: student.studentId,
      specialStudentId,
      newId,
      imageUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    });

    await feeVoucher.save();

    res.status(201).json({ message: "Fee voucher uploaded successfully", feeVoucher });
  } catch (error) {
    console.error("Error uploading fee voucher:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get student's fee vouchers
router.get("/my-vouchers", authenticateStudent, async (req, res) => {
  try {
    const studentId = req.user.studentId; // Assuming studentId is available in req.user
    const feeVouchers = await FeeVoucher.find({ studentId }).sort({ uploadedAt: -1 });
    res.status(200).json({ feeVouchers });
  } catch (error) {
    console.error("Error fetching student's fee vouchers:", error);
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get all fee vouchers with search
router.get("/admin/all", authenticateAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      // Search by specialStudentId or student name (assuming student name can be derived or is stored)
      // For now, let's search by specialStudentId or studentId
      query.$or = [
        { specialStudentId: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
      ];
    }

    const feeVouchers = await FeeVoucher.find(query)
      .populate('student', 'fullname profilePicture') // Populate student details
      .sort({ uploadedAt: -1 });

    console.log('Backend: FeeVouchers after populate:', JSON.stringify(feeVouchers, null, 2));

    // Group by specialStudentId to show unique students
    const groupedVouchers = {};
    feeVouchers.forEach(voucher => {
      console.log(`Backend: Processing voucher for student ${voucher.studentId}, profilePicture: ${voucher.student ? voucher.student.profilePicture : 'N/A'}`);
      if (!groupedVouchers[voucher.specialStudentId]) {
        groupedVouchers[voucher.specialStudentId] = {
          studentId: voucher.studentId,
          specialStudentId: voucher.specialStudentId,
          studentName: voucher.student ? voucher.student.fullname : 'Unknown',
          studentProfilePicture: voucher.student ? voucher.student.profilePicture : '',
          latestUpload: voucher.uploadedAt,
          count: 0,
        };
      }
      groupedVouchers[voucher.specialStudentId].count++;
    });

    const result = Object.values(groupedVouchers).sort((a, b) => b.latestUpload - a.latestUpload);

    res.status(200).json({ feeVouchers: result });
  } catch (error) {
    console.error("Error fetching all fee vouchers for admin:", error);
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get a single student's fee vouchers
router.get("/admin/:specialStudentId", authenticateAdmin, async (req, res) => {
  try {
    const { specialStudentId } = req.params;
    const feeVouchers = await FeeVoucher.find({ specialStudentId })
      .populate('student', 'fullname profilePicture')
      .sort({ newId: 1 }); // Sort by newId to maintain order

    if (feeVouchers.length === 0) {
      return res.status(404).json({ message: "No fee vouchers found for this student" });
    }

    const studentInfo = {
      fullname: feeVouchers[0].student ? feeVouchers[0].student.fullname : 'Unknown',
      profilePicture: feeVouchers[0].student ? feeVouchers[0].student.profilePicture : '',
      studentId: feeVouchers[0].studentId,
      specialStudentId: feeVouchers[0].specialStudentId,
    };

    res.status(200).json({ studentInfo, feeVouchers });
  } catch (error) {
    console.error("Error fetching single student's fee vouchers for admin:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
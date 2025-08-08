
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cloudinary = require("cloudinary");
const multer = require("multer");
// Import all route files
const adminRoutes = require("./routes/admin.js");
const teacherRoutes = require("./routes/teacher.js");
const studentRoutes = require("./routes/student.js");
const announcementRoutes = require("./routes/announcements.js");
const marksRoutes = require("./routes/marks.js");
const feeVoucherRoutes = require("./routes/feeVouchers.js");
const classQuestionRoutes = require("./routes/classQuestions.js");
const profileRoutes = require("./routes/profile.js");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Import models
const AppConfig = require("./models/appConfig");

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage configuration for profile images
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "profiles",
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});

// Storage configuration for fee vouchers
const voucherStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "fee-vouchers",
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
  },
});

// Storage configuration for announcement images
const announcementStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "announcements",
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});

const uploadProfile = multer({ storage: profileStorage });
const uploadVoucher = multer({ storage: voucherStorage });
const uploadAnnouncement = multer({ storage: announcementStorage });

// Use routes with specific prefixes
app.use("/api/admin", adminRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/marks", marksRoutes);
app.use("/api/fee-vouchers", feeVoucherRoutes);
app.use("/api/class-questions", classQuestionRoutes);
app.use("/api/profile", profileRoutes);

// Public app configuration endpoint (no authentication required)
app.get("/api/app-config", async (req, res) => {
  try {
    const config = await AppConfig.getConfig();
    res.status(200).json({ 
      success: true,
      config: {
        collegeName: config.collegeName,
        logoUrl: config.logoUrl
      }
    });
  } catch (error) {
    console.error('Error fetching app config:', error);
    res.status(200).json({ 
      success: true,
      config: {
        collegeName: 'Alpha Education',
        logoUrl: ''
      }
    });
  }
});

// Image upload endpoints
app.post("/api/upload-profile", uploadProfile.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }
    res.status(200).json({ 
      message: "Image uploaded successfully",
      imageUrl: req.file.path 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/upload-voucher", uploadVoucher.single("voucher"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No voucher uploaded" });
    }
    res.status(200).json({ 
      message: "Voucher uploaded successfully",
      voucherUrl: req.file.path 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Upload multiple images for announcements
app.post("/api/upload-announcement-images", uploadAnnouncement.array("images", 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images uploaded" });
    }
    
    const imageUrls = req.files.map(file => file.path);
    
    res.status(200).json({ 
      message: "Images uploaded successfully",
      imageUrls: imageUrls
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server is running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });

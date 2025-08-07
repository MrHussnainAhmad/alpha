
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
const { CloudinaryStorage } = require("multer-storage-cloudinary");

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

const uploadProfile = multer({ storage: profileStorage });
const uploadVoucher = multer({ storage: voucherStorage });

// Use routes with specific prefixes
app.use("/api/admin", adminRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/student", studentRoutes);

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

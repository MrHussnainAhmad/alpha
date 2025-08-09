
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cloudinary = require("cloudinary");
const multer = require("multer");
// Import all route files
const adminRoutes = require("./routes/admin.js");
const classRoutes = require("./routes/classes.js");
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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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



// Storage configuration for announcement images
const announcementStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "announcements",
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});

const uploadProfile = multer({ storage: profileStorage });

const uploadAnnouncement = multer({ storage: announcementStorage });

// Use routes with specific prefixes
app.use("/api/admin", adminRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/marks", marksRoutes);
app.use("/api/fee-vouchers", feeVoucherRoutes);
app.use("/api/class-questions", classQuestionRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/classes", classRoutes);

// Public app configuration endpoint (no authentication required)
app.get("/api/app-config", async (req, res) => {
  try {
    const config = await AppConfig.getConfig();
    res.status(200).json({ 
      success: true,
      config: {
        collegeName: config.collegeName,
        logoUrl: config.logoUrl,
        phoneNumber: config.phoneNumber,
      }
    });
  } catch (error) {
    console.error('Error fetching app config:', error);
    res.status(200).json({ 
      success: true,
      config: {
        collegeName: 'Alpha Education',
        logoUrl: '',
        phoneNumber: ''
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

// Import cleanup scheduler
const { startScheduledCleanup } = require("./scripts/cleanupUnverifiedAccounts");

function printRoutes(app) {
  console.log('Registered routes:');
  if (!app._router || !app._router.stack) {
    console.log('Router not initialized yet');
    return;
  }
  app._router.stack.forEach((middleware) => {
    if (middleware.route) { // routes registered directly on the app
      console.log(middleware.route.path, middleware.route.methods);
    } else if (middleware.name === 'router') { // router middleware 
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          console.log(handler.route.path, handler.route.methods);
        }
      });
    }
  });
}

mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server is running on port ${process.env.PORT || 5000}`);
      
      // Print registered routes after server starts
      printRoutes(app);
      
      // Start the cleanup scheduler
      console.log('Starting cleanup scheduler...');
      startScheduledCleanup().catch(error => {
        console.error('Failed to start cleanup scheduler:', error);
      });
    });
  })
  .catch((err) => {
    console.log(err);
  });

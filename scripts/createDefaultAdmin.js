const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Admin = require("../models/admin");
require("dotenv").config();

async function createDefaultAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB");

    // Check if default admin already exists
    const existingAdmin = await Admin.findOne({ email: "admin@gmail.com" });
    
    if (existingAdmin) {
      console.log("❌ Default admin already exists!");
      console.log("Email: admin@gmail.com");
      console.log("Password: 123457");
      return;
    }

    // Create default admin account
    const hashedPassword = await bcrypt.hash("123457", 10);
    
    const defaultAdmin = new Admin({
      fullname: "System Administrator",
      username: "admin",
      email: "admin@gmail.com",
      password: hashedPassword,
      role: "admin"
    });

    await defaultAdmin.save();

    console.log("✅ Default admin account created successfully!");
    console.log("📧 Email: admin@gmail.com");
    console.log("🔐 Password: 123457");
    console.log("⚠️  IMPORTANT: Change this password after first login!");

  } catch (error) {
    console.error("Error creating default admin:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

// Run the script
createDefaultAdmin();

const express = require("express");
const Teacher = require("../models/teacher");
const Student = require("../models/student");
const bcrypt = require("bcrypt");
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper function to upload image to cloudinary
async function uploadImageToCloudinary(base64Data, folder) {
  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder: `school-app/${folder}`,
      resource_type: 'image',
      transformation: [
        { width: 400, height: 400, crop: 'fill', quality: 'auto' }
      ]
    });
    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  } catch (error) {
    throw new Error('Failed to upload image');
  }
}

// Helper function to delete image from cloudinary
async function deleteImageFromCloudinary(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.log('Error deleting image:', error);
  }
}

// Get Teacher Profile
router.get("/teacher/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const teacher = await Teacher.findById(id).select('-password');
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.status(200).json({ 
      success: true,
      teacher 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Student Profile
router.get("/student/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const student = await Student.findById(id).select('-password');
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json({ 
      success: true,
      student 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Teacher Profile
router.put("/teacher/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      fullname, 
      phoneNumber, 
      whatsappNumber, 
      cnicNumber, 
      gender, 
      age, 
      address,
      profileImageBase64,
      currentPassword,
      newPassword
    } = req.body;

    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const updateData = {};

    // Update basic fields if provided
    if (fullname) updateData.fullname = fullname.trim();
    if (phoneNumber) updateData.phoneNumber = phoneNumber.trim();
    if (whatsappNumber) updateData.whatsappNumber = whatsappNumber.trim();
    if (cnicNumber) updateData.cnicNumber = cnicNumber.trim();
    if (gender) updateData.gender = gender;
    if (age) updateData.age = parseInt(age);
    if (address) updateData.address = address.trim();

    // Handle profile image update
    if (profileImageBase64) {
      try {
        // Delete old image if exists
        if (teacher.img) {
          const oldPublicId = teacher.img.split('/').pop().split('.')[0];
          await deleteImageFromCloudinary(`school-app/profiles/${oldPublicId}`);
        }

        // Upload new image
        const imageResult = await uploadImageToCloudinary(
          `data:image/jpeg;base64,${profileImageBase64}`,
          'profiles'
        );
        updateData.img = imageResult.url;
      } catch (error) {
        return res.status(400).json({ 
          message: "Error uploading profile image", 
          error: error.message 
        });
      }
    }

    // Handle password update
    if (currentPassword && newPassword) {
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, teacher.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long" });
      }

      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    // Update teacher
    const updatedTeacher = await Teacher.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).select('-password');

    res.status(200).json({ 
      success: true,
      message: "Profile updated successfully",
      teacher: updatedTeacher 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Student Profile
router.put("/student/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      fullname, 
      fathername,
      dob,
      phoneNumber, 
      homePhone,
      gender, 
      address,
      class: studentClass,
      section,
      rollNumber,
      profileImageBase64,
      currentPassword,
      newPassword
    } = req.body;

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const updateData = {};

    // Update basic fields if provided
    if (fullname) updateData.fullname = fullname.trim();
    if (fathername) updateData.fathername = fathername.trim();
    if (dob) updateData.dob = new Date(dob);
    if (phoneNumber) updateData.phoneNumber = phoneNumber.trim();
    if (homePhone) updateData.homePhone = homePhone.trim();
    if (gender) updateData.gender = gender;
    if (address) updateData.address = address.trim();
    if (studentClass) updateData.class = studentClass.trim();
    if (section) updateData.section = section.trim();
    if (rollNumber) updateData.rollNumber = rollNumber.trim();

    // Handle profile image update
    if (profileImageBase64) {
      try {
        // Delete old image if exists
        if (student.img) {
          const oldPublicId = student.img.split('/').pop().split('.')[0];
          await deleteImageFromCloudinary(`school-app/profiles/${oldPublicId}`);
        }

        // Upload new image
        const imageResult = await uploadImageToCloudinary(
          `data:image/jpeg;base64,${profileImageBase64}`,
          'profiles'
        );
        updateData.img = imageResult.url;
      } catch (error) {
        return res.status(400).json({ 
          message: "Error uploading profile image", 
          error: error.message 
        });
      }
    }

    // Handle password update
    if (currentPassword && newPassword) {
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, student.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long" });
      }

      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    // Update student
    const updatedStudent = await Student.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).select('-password');

    res.status(200).json({ 
      success: true,
      message: "Profile updated successfully",
      student: updatedStudent 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

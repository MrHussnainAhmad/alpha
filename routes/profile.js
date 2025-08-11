const express = require("express");
const Teacher = require("../models/teacher");
const Student = require("../models/student");
const Class = require("../models/class");
const Grade = require("../models/grade");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { authenticateToken, authenticateTeacher, authenticateStudent } = require('../middleware/auth');

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
    console.error('Cloudinary upload error:', error);
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

// Get authenticated Teacher Profile (without ID)
router.get("/teacher", authenticateTeacher, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id).populate('classes', 'classNumber').select('-password');
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Map the response to match frontend expectations
    const profile = {
      name: teacher.fullname || '',
      email: teacher.email || '',
      phone: teacher.phoneNumber || '',
      address: teacher.address || '',
      qualification: teacher.qualification || '',
      experience: teacher.experience || '',
      subjects: teacher.subjects || [],
      classes: teacher.classes || [],
      profileImage: teacher.img || '',
      isVerified: teacher.isVerified || false,
      currentPay: teacher.currentPay || 0,
      futurePay: teacher.futurePay || 0
    };

    res.status(200).json({ 
      success: true,
      profile 
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get Teacher Profile by ID (for admin/other uses)
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

// Get authenticated Student Profile (without ID)
router.get("/student", authenticateStudent, async (req, res) => {
  try {
    console.log('Backend: GET /profile/student hit.');
    console.log('Backend: req.user.id from token:', req.user.id);
    const student = await Student.findById(req.user.id).populate('class').select('-password');
    console.log('Backend: Student found by ID:', student ? student.fullname : 'None');
    if (!student) {
      console.log('Backend: Student not found for ID:', req.user.id);
      return res.status(404).json({ message: "Student not found" });
    }

    // Map the response to match frontend expectations
    const profile = {
      studentId: student.studentId || '',
      name: student.fullname || '',
      email: student.email || '',
      phone: student.phoneNumber || '',
      address: student.address || '',
      fatherName: student.fathername || '',
      motherName: student.mothername || '',
      dateOfBirth: student.dob ? student.dob.toISOString().split('T')[0] : '',
      gender: student.gender || '',
      profileImage: student.profilePicture || '',
      classNumber: student.class ? student.class.classNumber : '', // Use classNumber from populated class
      section: student.class ? student.class.section : '',     // Use section from populated class
      rollNumber: student.rollNumber || '',
      isVerified: student.isVerified || false,
      currentFee: student.currentFee || 0,
      futureFee: student.futureFee || 0,
      hasClassAndSectionSet: student.hasClassAndSectionSet || false
    };

    console.log("Sending profile:", profile);
    res.status(200).json({ 
      success: true,
      profile 
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get Student Profile by ID (for admin/teacher uses)
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

// Update authenticated Teacher Profile
router.put("/teacher", authenticateTeacher, async (req, res) => {
  try {
    const { 
      name, 
      email,
      phone, 
      address,
      qualification,
      experience,
      subjects,
      profileImageBase64,
      profileImageType,
      password
    } = req.body;

    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const updateData = {};

    // Update basic fields if provided
    if (name) updateData.fullname = name.trim();
    if (email) updateData.email = email.trim();
    if (phone) updateData.phoneNumber = phone.trim();
    if (address) updateData.address = address.trim();
    if (qualification) updateData.qualification = qualification.trim();
    if (experience) updateData.experience = experience;
    if (subjects) updateData.subjects = subjects;
    console.log('Backend updateData:', updateData);
    // Handle profile image update
    if (profileImageBase64 && profileImageType) {
      console.log('Received teacher profile image update request:');
      console.log('profileImageType:', profileImageType);
      console.log('profileImageBase64 length:', profileImageBase64 ? profileImageBase64.length : '0');
      try {
        // Delete old image if exists
        if (teacher.img) {
          const oldPublicId = teacher.img.split('/').pop().split('.')[0];
          await deleteImageFromCloudinary(`school-app/profiles/${oldPublicId}`);
        }

        // Upload new image
        const imageResult = await uploadImageToCloudinary(
          `data:${profileImageType};base64,${profileImageBase64}`,
          'profiles'
        );
        updateData.img = imageResult.url;
        console.log('Backend: updateData.profilePicture set to:', updateData.profilePicture);
      } catch (error) {
        return res.status(400).json({
          message: "Error uploading profile image",
          error: error.message
        });
      }
    }

    // Handle password update
    if (password && password.length >= 6) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Update teacher
    const updatedTeacher = await Teacher.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true }
    ).select('-password');

    const profile = {
      name: updatedTeacher.fullname || '',
      email: updatedTeacher.email || '',
      phone: updatedTeacher.phoneNumber || '',
      address: updatedTeacher.address || '',
      qualification: updatedTeacher.qualification || '',
      experience: updatedTeacher.experience || '',
      subjects: updatedTeacher.subjects || [],
      profileImage: updatedTeacher.img || ''
    };

    res.status(200).json({ 
      success: true,
      message: "Profile updated successfully",
      profile
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update Teacher Profile by ID (for admin use)
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

// Update authenticated Student Profile
router.put("/student", authenticateStudent, async (req, res) => {
  try {
    console.log('Backend: PUT /profile/student hit. req.body:', req.body); // Added console.log
    const { 
      name, 
      email,
      phone, 
      address,
      fatherName,
      motherName,
      dateOfBirth,
      gender,
      rollNumber,
      profileImageBase64,
      profileImageType,
      password,
      classId, // New: classId from frontend
      section // New: section from frontend
    } = req.body;

    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const updateData = {};

    // Prevent student from changing rollNumber if it's already assigned and different from the new value
    if (student.rollNumber && student.rollNumber.length > 0 && rollNumber && student.rollNumber !== rollNumber) {
      return res.status(400).json({ message: "Roll number cannot be changed once assigned." });
    }

    // Handle class and section update
    if (classId !== undefined && classId !== null && classId !== '') {
      // Removed the error check for hasClassAndSectionSet to allow updates
      const classDoc = await Class.findById(classId);
      if (!classDoc) {
        return res.status(400).json({ message: "Invalid class selected." });
      }
      updateData.class = classId;
      updateData.hasClassAndSectionSet = true; // Still set this to true if classId is provided
    }

    if (section !== undefined && section !== null && section !== '') {
      updateData.section = section;
    }

    // Update basic fields if provided
    if (name) updateData.fullname = name.trim();
    if (email) updateData.email = email.trim();
    if (phone) updateData.phoneNumber = phone.trim();
    if (address) updateData.address = address.trim();
    if (fatherName) updateData.fathername = fatherName.trim();
    if (motherName) updateData.mothername = motherName.trim();
    if (dateOfBirth) updateData.dob = new Date(dateOfBirth);
    if (gender) updateData.gender = gender;
    if (rollNumber) updateData.rollNumber = rollNumber.trim();

    // Handle profile image update
    if (profileImageBase64 && profileImageType) {
      console.log('Received profile image update request:');
      console.log('profileImageType:', profileImageType);
      console.log('profileImageBase64 length:', profileImageBase64 ? profileImageBase64.length : '0');
      try {
        // Delete old image if exists
        if (student.profilePicture) {
          const oldPublicId = student.profilePicture.split('/').pop().split('.')[0];
          await deleteImageFromCloudinary(`school-app/profiles/${oldPublicId}`);
        }

        // Upload new image
        const imageResult = await uploadImageToCloudinary(
          `data:${profileImageType};base64,${profileImageBase64}`,
          'profiles'
        );
        updateData.profilePicture = imageResult.url;
        console.log('Backend: updateData.profilePicture set to:', updateData.profilePicture);
      } catch (error) {
        return res.status(400).json({ 
          message: "Error uploading profile image", 
          error: error.message 
        });
      }
    }

    // Handle password update
    if (password && password.length >= 6) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    console.log('Backend: updateData before findByIdAndUpdate:', updateData); // Added console.log
    // Update student
    const updatedStudent = await Student.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true }
    ).select('-password');

    console.log('Backend: updatedStudent after findByIdAndUpdate:', updatedStudent); // Added console.log
    const profile = {
      name: updatedStudent.fullname || '',
      email: updatedStudent.email || '',
      phone: updatedStudent.phoneNumber || '',
      address: updatedStudent.address || '',
      fatherName: updatedStudent.fathername || '',
      motherName: updatedStudent.mothername || '',
      dateOfBirth: updatedStudent.dob ? updatedStudent.dob.toISOString().split('T')[0] : '',
      gender: updatedStudent.gender || '',
      profileImage: updatedStudent.profilePicture || '',
      class: updatedStudent.class || null, // Include the class ID
      section: updatedStudent.section || '',
      rollNumber: updatedStudent.rollNumber || '',
      hasClassAndSectionSet: updatedStudent.hasClassAndSectionSet || false // Include in response
    };

    res.status(200).json({ 
      success: true,
      message: "Profile updated successfully",
      profile
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update Student Profile by ID (for admin/teacher use)
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
        if (student.profilePicture) {
          const oldPublicId = student.profilePicture.split('/').pop().split('.')[0];
          await deleteImageFromCloudinary(`school-app/profiles/${oldPublicId}`);
        }

        // Upload new image
        const imageResult = await uploadImageToCloudinary(
          `data:image/jpeg;base64,${profileImageBase64}`,
          'profiles'
        );
        updateData.profilePicture = imageResult.url;
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



// Get all grades for the authenticated student
router.get("/student/my-grades", authenticateStudent, async (req, res) => {
  try {
    const grades = await Grade.find({ student: req.user.id }).sort({ examDate: -1 });
    res.status(200).json({ success: true, grades });
  } catch (error) {
    console.error('Error fetching student grades:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
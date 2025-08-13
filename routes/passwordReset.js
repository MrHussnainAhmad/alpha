const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const ResetToken = require('../models/resetToken');
const Teacher = require('../models/teacher');
const Student = require('../models/student');

const router = express.Router();

// Debug: Check if email credentials are loaded
console.log('Email configuration check:');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 5)}...` : 'NOT SET');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'NOT SET');

// Validate email configuration
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error('⚠️ WARNING: Email credentials are not properly configured!');
  console.error('Please check your .env file for EMAIL_USER and EMAIL_PASS');
}

// Configure nodemailer with Gmail SMTP settings
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Verify transporter configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('Email transporter verification failed:', error);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
    }
    
    // Find user across Teacher and Student models only
    let user = await Teacher.findOne({ email });
    let userModel = 'Teacher';
    
    if (!user) {
      user = await Student.findOne({ email });
      userModel = 'Student';
    }
    
    // Check if email exists in database
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Intruder! Your Account is not registered with this mail.',
        errorType: 'NOT_REGISTERED'
      });
    }
    
    // Check if account is verified
    if (!user.isVerified) {
      return res.status(403).json({ 
        success: false,
        message: 'For Password Reset Account Should be Verified from Admin, Please Approach admin to verify your account.',
        errorType: 'NOT_VERIFIED'
      });
    }
    
    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    // Save token
    await ResetToken.create({
      userId: user._id,
      userModel,
      email,
      token: await bcrypt.hash(token, 10),
      expiresAt
    });
    
    // Create reset link (for mobile app, this will be a deep link)
    const resetLink = `alphaeducation://reset-password?token=${token}&email=${email}`;
    
    // Email template
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #4A90E2; color: white; padding: 20px; text-align: center;">
          <h1>Superior Science College</h1>
          <h2>Password Reset Request</h2>
        </div>
        
        <div style="padding: 20px; background: #f9f9f9;">
          <p>Hello <strong>${user.fullname}</strong>,</p>
          
          <p>You requested a password reset for your Superior account.</p>
          
          <div style="background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #4A90E2;">
            <p><strong>Reset Token:</strong></p>
            <p style="font-family: monospace; font-size: 18px; background: #f0f0f0; padding: 10px; border-radius: 4px; text-align: center;">
              ${token}
            </p>
          </div>
          
          <p><strong>Instructions:</strong></p>
          <ol>
            <li>Open the Superior Science College mobile app</li>
            <li>Go to the password reset screen</li>
            <li>Enter the token above</li>
            <li>Set your new password</li>
          </ol>
          
          <p><strong>Important:</strong></p>
          <ul>
            <li><strong>Make Sure No Extra Spaces in Token!</strong></li>
            <li>This token will expire in 1 hour</li>
            <li>If you didn't request this reset, please ignore this email</li>
            <li>For security, this token can only be used once</li>
          </ul>
          
          <p>If you have any questions, please contact your school administrator.</p>
        </div>
        
        <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
          <p>This is an automated message from Alpha Education System</p>
        </div>
      </div>
    `;
    
    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Superior Science College - Password Reset Request',
      html: emailContent
    };
    
    await transporter.sendMail(mailOptions);
    
    res.status(200).json({ 
      success: true,
      message: 'Password reset email sent successfully',
      email: email
    });
    
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send reset email. Please try again later.' 
    });
  }
});

// Verify reset token
router.post('/verify-token', async (req, res) => {
  try {
    const { token, email } = req.body;
    
    if (!token || !email) {
      return res.status(400).json({ 
        success: false,
        message: 'Token and email are required' 
      });
    }
    
    // Find user to check verification status
    let user = await Teacher.findOne({ email });
    let userModel = 'Teacher';
    
    if (!user) {
      user = await Student.findOne({ email });
      userModel = 'Student';
    }
    
    // Check if email exists in database
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Intruder! Your Account is not registered with this mail.',
        errorType: 'NOT_REGISTERED'
      });
    }
    
    // Check if account is verified
    if (!user.isVerified) {
      return res.status(403).json({ 
        success: false,
        message: 'For Password Reset Account Should be Verified from Admin, Please Approach admin to verify your account.',
        errorType: 'NOT_VERIFIED'
      });
    }
    
    // Find reset token
    const resetToken = await ResetToken.findOne({ 
      email, 
      used: false, 
      expiresAt: { $gt: new Date() } 
    });
    
    if (!resetToken) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired reset token' 
      });
    }
    
    // Verify token
    const isValidToken = await bcrypt.compare(token, resetToken.token);
    if (!isValidToken) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid reset token' 
      });
    }
    
    res.status(200).json({ 
      success: true,
      message: 'Token is valid',
      email: email
    });
    
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to verify token' 
    });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, email, newPassword } = req.body;
    
    if (!token || !email || !newPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'Token, email, and new password are required' 
      });
    }
    
    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'Password must be at least 6 characters long' 
      });
    }
    
    // Find user to check verification status
    let user = await Teacher.findOne({ email });
    let userModel = 'Teacher';
    
    if (!user) {
      user = await Student.findOne({ email });
      userModel = 'Student';
    }
    
    // Check if email exists in database
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Intruder! Your Account is not registered with this mail.',
        errorType: 'NOT_REGISTERED'
      });
    }
    
    // Check if account is verified
    if (!user.isVerified) {
      return res.status(403).json({ 
        success: false,
        message: 'For Password Reset Account Should be Verified from Admin, Please Approach admin to verify your account.',
        errorType: 'NOT_VERIFIED'
      });
    }
    
    // Find reset token
    const resetToken = await ResetToken.findOne({ 
      email, 
      used: false, 
      expiresAt: { $gt: new Date() } 
    });
    
    if (!resetToken) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired reset token' 
      });
    }
    
    // Verify token
    const isValidToken = await bcrypt.compare(token, resetToken.token);
    if (!isValidToken) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid reset token' 
      });
    }
    
    // Get user model
    const UserModel = resetToken.userModel === 'Teacher' ? Teacher : Student;
    const userToUpdate = await UserModel.findById(resetToken.userId);
    
    if (!userToUpdate) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    // Update password
    userToUpdate.password = await bcrypt.hash(newPassword, 10);
    await userToUpdate.save();
    
    // Mark token as used
    resetToken.used = true;
    await resetToken.save();
    
    res.status(200).json({ 
      success: true,
      message: 'Password reset successfully' 
    });
    
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to reset password' 
    });
  }
});

module.exports = router;

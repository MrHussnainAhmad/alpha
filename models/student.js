const mongoose = require("mongoose");

// Function to generate Student ID: S-name-class
function generateStudentId(name, studentClass) {
  const cleanName = name.replace(/\s+/g, '').toLowerCase();
  return `S-${cleanName}-${studentClass}`;
}

// Function to generate Special Student ID: S-name-class-rollnumber
function generateSpecialStudentId(name, studentClass, rollNumber) {
  const cleanName = name.replace(/\s+/g, '').toLowerCase();
  return `S-${cleanName}-${studentClass}-${rollNumber}`;
}

const studentSchema = new mongoose.Schema({
  fullname: {
    type: String,
    required: true,
    trim: true
  },
  fathername: {
    type: String,
    required: true,
    trim: true
  },
  dob: {
    type: Date,
    required: true
  },
  studentId: {
    type: String,
    unique: true,
    trim: true
  },
  specialStudentId: {
    type: String,
    unique: true,
    sparse: true, // Only create index if value exists
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  homePhone: {
    type: String,
    required: true,
    trim: true
  },
  recordNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  gender: {
    type: String,
    required: true,
    enum: ['male', 'female', 'other']
  },
  profilePicture: {
    type: String, // Cloudinary URL
    default: null
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  class: {
    type: String,
    required: true,
    trim: true
  },
  section: {
    type: String,
    required: true,
    trim: true
  },
  rollNumber: {
    type: String,
    sparse: true, // Only required when generating special ID
    trim: true
  },
  feeVoucherSubmitted: {
    type: Boolean,
    default: false
  },
  feeVoucherImage: {
    type: String, // Cloudinary URL for fee voucher
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false,
    index: true // Index for faster cleanup queries
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  role: {
    type: String,
    default: "student"
  }
}, {
  timestamps: true
});

// Pre-save middleware to generate special student ID when roll number is provided
studentSchema.pre('save', function(next) {
  // Generate special student ID when roll number is provided and student already has studentId
  if (this.rollNumber && this.studentId && this.fullname && this.class) {
    // Regenerate if rollNumber or class changed
    if (!this.specialStudentId || this.isModified('rollNumber') || this.isModified('class')) {
      this.specialStudentId = generateSpecialStudentId(this.fullname, this.class, this.rollNumber);
    }
  }
  
  next();
});

// Method to assign special ID for fee voucher submission
studentSchema.methods.assignSpecialIdForFeeVoucher = function(rollNumber) {
  if (!this.specialStudentId) {
    this.rollNumber = rollNumber;
    // Use existing studentId and just append rollNumber
    this.specialStudentId = `${this.studentId}-${rollNumber}`;
  }
  return this.specialStudentId;
};

module.exports = mongoose.model("Student", studentSchema);

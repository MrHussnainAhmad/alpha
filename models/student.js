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
  img: {
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
  role: {
    type: String,
    default: "student"
  }
}, {
  timestamps: true
});

// Pre-save middleware to generate studentId if not provided
studentSchema.pre('save', function(next) {
  if (!this.studentId && this.fullname && this.class) {
    this.studentId = generateStudentId(this.fullname, this.class);
  }
  
  // Generate special student ID when roll number is provided (for fee voucher submission)
  if (this.rollNumber && !this.specialStudentId && this.fullname && this.class) {
    this.specialStudentId = generateSpecialStudentId(this.fullname, this.class, this.rollNumber);
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

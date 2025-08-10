const mongoose = require("mongoose");
const Class = require("./class");

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
    unique: true,
    sparse: true, // Allows null values
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
  className: {
    type: String,
    trim: true,
    default: null
  },
  section: {
    type: String,
    trim: true
  },
  rollNumber: {
    type: String,
    sparse: true, // Only required when generating special ID
    trim: true
  },
  hasClassAndSectionSet: {
    type: Boolean,
    default: false
  },
  currentFee: {
    type: Number,
    default: 0,
  },
  futureFee: {
    type: Number,
    default: 0,
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
studentSchema.pre('save', async function(next) {
  // Only generate special student ID if class is assigned
  if (this.isModified('rollNumber') && this.rollNumber && this.class) {
    const studentClass = await Class.findById(this.class);
    if (studentClass) {
      this.specialStudentId = generateSpecialStudentId(this.fullname, studentClass.name, this.rollNumber);
    }
  }
  
  next();
});

// Method to assign special ID for fee voucher submission
studentSchema.methods.assignSpecialIdForFeeVoucher = async function(rollNumber) {
  if (!this.specialStudentId) {
    this.rollNumber = rollNumber;
    const studentClass = await Class.findById(this.class);
    if (studentClass) {
      this.specialStudentId = generateSpecialStudentId(this.fullname, studentClass.name, this.rollNumber);
    }
  }
  return this.specialStudentId;
};

module.exports = mongoose.model("Student", studentSchema);

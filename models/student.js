const mongoose = require("mongoose");
const Class = require("./class");

// Function to generate Student ID: S-name-class
function generateStudentId(name, className) {
  const cleanName = name.replace(/\s+/g, '').toLowerCase();
  return `S-${cleanName}-${className}`;
}

// Function to generate Special Student ID: S-name-class-rollnumber
function generateSpecialStudentId(name, className, rollNumber) {
  const cleanName = name.replace(/\s+/g, '').toLowerCase();
  return `S-${cleanName}-${className}-${rollNumber}`;
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
  examIds: [{
    type: String,
  }],
  allGrades: [{
    examId: String,
    subjects: [{
      name: String,
      grade: String,
    }]
  }],
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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
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
  grades: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Grade',
    },
  ],
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

// Pre-save middleware to generate student ID when class is assigned
studentSchema.pre('save', async function(next) {
  console.log('Entering pre-save middleware for studentId generation');
  console.log(`isModified('class'): ${this.isModified('class')}`);
  console.log(`this.class: ${this.class}`);
  if (this.isModified('class') && this.class) {
    const studentClass = await Class.findById(this.class);
    if (studentClass) {
      // Generate new studentId based on class
      const newStudentId = generateStudentId(this.fullname, studentClass.classNumber);
      console.log(`newStudentId: ${newStudentId}`);
      
      // Update studentId if it doesn't exist or if it contains 'Unassigned'
      if (!this.studentId || this.studentId.includes('Unassigned')) {
        this.studentId = newStudentId;
        console.log(`this.studentId after update: ${this.studentId}`);
      }
    }
  }
  next();
});

// Pre-save middleware to generate special student ID when roll number is provided
studentSchema.pre('save', async function(next) {
  // Only generate special student ID if class is assigned and roll number is provided
  if (this.isModified('rollNumber') && this.rollNumber && this.class) {
    const studentClass = await Class.findById(this.class);
    if (studentClass) {
      this.specialStudentId = generateSpecialStudentId(this.fullname, studentClass.classNumber, this.rollNumber);
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
      this.specialStudentId = generateSpecialStudentId(this.fullname, studentClass.classNumber, this.rollNumber);
    }
  }
  return this.specialStudentId;
};

module.exports = mongoose.model("Student", studentSchema);
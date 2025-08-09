const mongoose = require("mongoose");

// Function to generate Teacher ID: T-name-joiningyear
function generateTeacherId(name, joiningYear) {
  const cleanName = name.replace(/\s+/g, '').toLowerCase();
  return `T-${cleanName}-${joiningYear}`;
}

const teacherSchema = new mongoose.Schema({
  fullname: {
    type: String,
    required: true,
    trim: true
  },
  teacherId: {
    type: String,
    unique: true,
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
  cnicNumber: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{13}$/.test(v); // Validates 13 digits
      },
      message: 'CNIC must be exactly 13 digits'
    },
    unique: true
  },
  gender: {
    type: String,
    required: true,
    enum: ['male', 'female', 'other']
  },
  age: {
    type: Number,
    required: true,
    min: 18,
    max: 70
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
  qualification: {
    type: String,
    trim: true,
  },
  experience: {
    type: Number,
  },
  subjects: [{
    type: String,
    trim: true,
  }],
  classes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
  }],
  whatsappNumber: {
    type: String,
    required: true,
    trim: true
  },
  joiningYear: {
    type: Number,
    required: true,
    min: 1990,
    max: new Date().getFullYear() + 1
  },
  currentPay: {
    type: Number,
    default: 0,
  },
  futurePay: {
    type: Number,
    default: 0,
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
    default: "teacher"
  }
}, {
  timestamps: true
});

// Note: teacherId will only be assigned by admin, not auto-generated during signup

module.exports = mongoose.model("Teacher", teacherSchema);

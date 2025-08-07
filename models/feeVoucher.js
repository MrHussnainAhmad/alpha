const mongoose = require("mongoose");

const feeVoucherSchema = new mongoose.Schema({
  specialStudentId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  studentIdString: {
    type: String,
    required: true,
    trim: true
  },
  studentName: {
    type: String,
    required: true,
    trim: true
  },
  fatherName: {
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
    required: true,
    trim: true
  },
  voucherImage: {
    type: String,
    required: true // Cloudinary URL
  },
  voucherNumber: {
    type: String,
    trim: true
  },
  amount: {
    type: Number,
    min: 0
  },
  feeType: {
    type: String,
    enum: ['monthly', 'admission', 'exam', 'transport', 'library', 'sports', 'other'],
    default: 'monthly'
  },
  academicYear: {
    type: String,
    required: true,
    trim: true
  },
  month: {
    type: String,
    enum: ['january', 'february', 'march', 'april', 'may', 'june', 
           'july', 'august', 'september', 'october', 'november', 'december']
  },
  bankName: {
    type: String,
    trim: true
  },
  paymentDate: {
    type: Date,
    required: true
  },
  submissionDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verificationDate: {
    type: Date
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  verifiedByName: {
    type: String,
    trim: true
  },
  adminRemarks: {
    type: String,
    trim: true,
    default: ''
  },
  studentRemarks: {
    type: String,
    trim: true,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
feeVoucherSchema.index({ specialStudentId: 1 });
feeVoucherSchema.index({ studentId: 1 });
feeVoucherSchema.index({ studentIdString: 1 });
feeVoucherSchema.index({ class: 1, section: 1 });
feeVoucherSchema.index({ status: 1 });
feeVoucherSchema.index({ academicYear: 1, month: 1 });
feeVoucherSchema.index({ submissionDate: -1 });

// Method to verify voucher
feeVoucherSchema.methods.verifyVoucher = function(adminId, adminName, remarks = '') {
  this.status = 'verified';
  this.verificationDate = new Date();
  this.verifiedBy = adminId;
  this.verifiedByName = adminName;
  if (remarks) this.adminRemarks = remarks;
};

// Method to reject voucher
feeVoucherSchema.methods.rejectVoucher = function(adminId, adminName, remarks = '') {
  this.status = 'rejected';
  this.verificationDate = new Date();
  this.verifiedBy = adminId;
  this.verifiedByName = adminName;
  if (remarks) this.adminRemarks = remarks;
};

// Static method to get vouchers by student
feeVoucherSchema.statics.getStudentVouchers = function(studentIdentifier, options = {}) {
  // studentIdentifier can be studentId, studentIdString, or specialStudentId
  const query = {
    isActive: true,
    $or: [
      { studentIdString: studentIdentifier },
      { specialStudentId: studentIdentifier }
    ]
  };
  
  if (options.status) query.status = options.status;
  if (options.academicYear) query.academicYear = options.academicYear;
  if (options.month) query.month = options.month;
  if (options.feeType) query.feeType = options.feeType;
  
  return this.find(query)
    .populate('studentId', 'fullname studentId class section')
    .populate('verifiedBy', 'fullname username')
    .sort({ submissionDate: -1 });
};

// Static method to get vouchers by class
feeVoucherSchema.statics.getClassVouchers = function(className, section, options = {}) {
  const query = {
    class: className,
    section: section,
    isActive: true
  };
  
  if (options.status) query.status = options.status;
  if (options.academicYear) query.academicYear = options.academicYear;
  if (options.month) query.month = options.month;
  if (options.feeType) query.feeType = options.feeType;
  
  return this.find(query)
    .populate('studentId', 'fullname studentId')
    .populate('verifiedBy', 'fullname username')
    .sort({ submissionDate: -1 });
};

// Static method to get statistics
feeVoucherSchema.statics.getStatistics = function(options = {}) {
  const matchQuery = { isActive: true };
  
  if (options.academicYear) matchQuery.academicYear = options.academicYear;
  if (options.month) matchQuery.month = options.month;
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalVouchers: { $sum: 1 },
        pendingVouchers: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        verifiedVouchers: {
          $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] }
        },
        rejectedVouchers: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
        },
        totalAmount: { $sum: '$amount' },
        averageAmount: { $avg: '$amount' }
      }
    }
  ]);
};

module.exports = mongoose.model("FeeVoucher", feeVoucherSchema);

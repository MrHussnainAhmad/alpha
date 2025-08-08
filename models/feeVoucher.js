const mongoose = require('mongoose');

const feeVoucherSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  studentId: {
    type: String,
    required: true,
    trim: true,
  },
  specialStudentId: {
    type: String,
    required: true,
    trim: true,
  },
  newId: {
    type: String,
    required: true,
    trim: true,
  },
  imageUrl: {
    type: String,
    required: true,
    trim: true,
  },
  publicId: {
    type: String,
    required: true,
    trim: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('FeeVoucher', feeVoucherSchema);
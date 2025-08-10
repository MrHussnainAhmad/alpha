const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema({
  examId: {
    type: String,
    required: true,
    // Remove unique constraint to allow multiple grade entries per student
    trim: true,
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  examDate: {
    type: Date,
    required: true,
  },
  gradeType: {
    type: String,
    required: true,
  },
  comments: {
    type: String,
  },
  subjects: [
    {
      subject: { type: String, required: true },
      marksObtained: { type: Number, required: true },
      totalMarks: { type: Number, required: true },
      percentage: { type: Number, required: true },
      grade: { type: String, required: true },
    },
  ],
}, { timestamps: true });

const Grade = mongoose.model('Grade', gradeSchema);

module.exports = Grade;
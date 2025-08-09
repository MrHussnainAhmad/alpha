const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  // You can add more fields here, e.g., teacher, students, etc.
  // teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  // students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
}, { timestamps: true });

const Class = mongoose.model('Class', classSchema);

module.exports = Class;

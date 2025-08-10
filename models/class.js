const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  section: {
    type: String,
    required: true,
    trim: true,
  },
  // You can add more fields here, e.g., teacher, students, etc.
  // teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  // students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
}, { timestamps: true });

// Add a unique compound index for name and section (FIXED)
classSchema.index({ classNumber: 1, section: 1 }, { unique: true });

if (mongoose.models.Class) {
  delete mongoose.models.Class;
}
const Class = mongoose.model('Class', classSchema);

module.exports = Class;
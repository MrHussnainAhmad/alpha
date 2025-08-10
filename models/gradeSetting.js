const mongoose = require('mongoose');

const gradeSettingSchema = new mongoose.Schema({
  grade: {
    type: String,
    required: true,
    unique: true,
    enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F']
  },
  minPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  }
});

const GradeSetting = mongoose.model('GradeSetting', gradeSettingSchema);

module.exports = GradeSetting;

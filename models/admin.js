const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  fullname: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
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
  role: {
    type: String,
    default: "admin",
    enum: ["admin", "principal"]
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Admin", adminSchema);

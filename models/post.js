const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  // Post content
  content: {
    type: String,
    required: function() {
      // Content is required if no image is provided
      return !this.imageUrl;
    },
    trim: true,
    maxlength: 1000
  },
  
  // Image URL (optional)
  imageUrl: {
    type: String,
    default: null
  },
  
  // Post type: 'text', 'image', 'image_text'
  postType: {
    type: String,
    enum: ['text', 'image', 'image_text'],
    required: true
  },
  
  // Author (admin who created the post)
  author: {
    type: mongoose.Schema.Types.Mixed, // Can be ObjectId or String for default admin
    required: true
  },
  
  // Target audience
  targetAudience: {
    type: String,
    enum: ['teachers', 'students', 'both', 'class'],
    required: true
  },
  
  // If targetAudience is 'class', specify which class
  targetClass: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: function() {
      return this.targetAudience === 'class';
    }
  },
  
  // Visibility status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient querying
postSchema.index({ targetAudience: 1, targetClass: 1, isActive: 1, createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });

// Virtual for formatted date
postSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Ensure virtuals are serialized
postSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Post', postSchema);

const express = require('express');
const Post = require('../models/post');
const Admin = require('../models/admin');
const Teacher = require('../models/teacher');
const Student = require('../models/student');
const Class = require('../models/class');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { authenticateAdmin, authenticateTeacher, authenticateStudent } = require('../middleware/auth');
const NotificationService = require('../services/notificationService');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

// Helper function to upload image to cloudinary
async function uploadImageToCloudinary(base64Data, folder) {
  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder: `school-app/${folder}`,
      resource_type: 'image',
      transformation: [
        { width: 800, height: 600, crop: 'limit', quality: 'auto' }
      ]
    });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image');
  }
}

// Admin: Create a new post
router.post('/create', authenticateAdmin, upload.single('image'), async (req, res) => {
  try {
    const { content, postType, targetAudience, targetClass } = req.body;
    
    // Require a valid admin ID
    const adminId = req.user.id;

    // Validate post type
    if (!['text', 'image', 'image_text'].includes(postType)) {
      return res.status(400).json({ message: 'Invalid post type' });
    }

    // Validate target audience
    if (!['teachers', 'students', 'both', 'class'].includes(targetAudience)) {
      return res.status(400).json({ message: 'Invalid target audience' });
    }

    // Validate content requirements
    if (postType === 'text' && (!content || content.trim().length === 0)) {
      return res.status(400).json({ message: 'Text content is required for text posts' });
    }

    if (postType === 'image' && !req.file) {
      return res.status(400).json({ message: 'Image is required for image posts' });
    }

    if (postType === 'image_text' && (!content || content.trim().length === 0) && !req.file) {
      return res.status(400).json({ message: 'Either text content or image is required for image_text posts' });
    }

    // Validate target class if audience is 'class'
    if (targetAudience === 'class' && !targetClass) {
      return res.status(400).json({ message: 'Target class is required when audience is class' });
    }

    let imageUrl = null;
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;
      imageUrl = await uploadImageToCloudinary(dataURI, 'posts');
    }

    const post = new Post({
      content: content ? content.trim() : null,
      imageUrl,
      postType,
      author: adminId,
      targetAudience,
      targetClass: targetAudience === 'class' ? targetClass : null
    });

    await post.save();

    // Populate author from database
    await post.populate('author', 'fullname');
    
    if (targetAudience === 'class') {
      await post.populate('targetClass', 'classNumber section');
    }

    // Send push notifications based on target audience
    try {
      const notificationTitle = 'Notification from Admin';
      const notificationBody = content ? 
        (content.substring(0, 100) + (content.length > 100 ? '...' : '')) : 
        'New post from admin';
      const notificationData = {
        postId: post._id.toString(),
        type: 'school_post'
      };

      if (targetAudience === 'teachers') {
        await NotificationService.notifyAllTeachers(notificationTitle, notificationBody, notificationData);
      } else if (targetAudience === 'students') {
        await NotificationService.notifyAllStudents(notificationTitle, notificationBody, notificationData);
      } else if (targetAudience === 'both') {
        await NotificationService.notifyAllTeachers(notificationTitle, notificationBody, notificationData);
        await NotificationService.notifyAllStudents(notificationTitle, notificationBody, notificationData);
      } else if (targetAudience === 'class' && targetClass) {
        await NotificationService.notifyClassStudents(targetClass, notificationTitle, notificationBody, notificationData);
      }
    } catch (notificationError) {
      console.error('Error sending push notifications:', notificationError);
      // Don't fail the post creation if notifications fail
    }

    res.status(201).json({
      message: 'Post created successfully',
      post
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get all posts (for management)
router.get('/admin/all', authenticateAdmin, async (req, res) => {
  try {
    const posts = await Post.find({ isActive: true })
      .populate('targetClass', 'classNumber section')
      .sort({ createdAt: -1 });

    // Ensure authors are populated (no default-admin fallback)
    const postsWithAuthors = await Promise.all(posts.map(async (post) => {
      const postObj = post.toObject();
      if (postObj.author && typeof postObj.author === 'object' && postObj.author._id) {
        return postObj;
      }
      try {
        const admin = await Admin.findById(postObj.author).select('fullname');
        if (admin) {
          postObj.author = { _id: admin._id, fullname: admin.fullname };
        }
      } catch (error) {
        console.error('Error populating admin:', error);
        postObj.author = { _id: postObj.author, fullname: 'Unknown Admin' };
      }
      return postObj;
    }));

    res.status(200).json({ posts: postsWithAuthors });
  } catch (error) {
    console.error('Error fetching posts for admin:', error);
    res.status(500).json({ message: error.message });
  }
});

// Admin: Delete a post
router.delete('/admin/:postId', authenticateAdmin, async (req, res) => {
  try {
    const { postId } = req.params;
    
    const adminId = req.user.id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Only the author can delete the post
    if (post.author.toString() !== adminId) {
      return res.status(403).json({ message: 'You can only delete your own posts' });
    }

    // Delete image from cloudinary if exists
    if (post.imageUrl) {
      try {
        const publicId = post.imageUrl.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`school-app/posts/${publicId}`);
      } catch (error) {
        console.error('Error deleting image from cloudinary:', error);
      }
    }

    await Post.findByIdAndDelete(postId);

    res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: error.message });
  }
});

// Teacher: Get posts for teachers
router.get('/teacher', authenticateTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id;
    
    // Get posts that are visible to teachers
    const query = {
      isActive: true,
      $or: [
        { targetAudience: 'teachers' },
        { targetAudience: 'both' }
      ]
    };

    const posts = await Post.find(query)
      .populate('targetClass', 'classNumber section')
      .sort({ createdAt: -1 });

    const postsWithAuthors = await Promise.all(posts.map(async (post) => {
      const postObj = post.toObject();
      if (postObj.author && typeof postObj.author === 'object' && postObj.author._id) {
        return postObj;
      }
      try {
        const admin = await Admin.findById(postObj.author).select('fullname');
        if (admin) {
          postObj.author = { _id: admin._id, fullname: admin.fullname };
        }
      } catch (error) {
        console.error('Error populating admin:', error);
        postObj.author = { _id: postObj.author, fullname: 'Unknown Admin' };
      }
      return postObj;
    }));

    res.status(200).json({ posts: postsWithAuthors });
  } catch (error) {
    console.error('Error fetching posts for teacher:', error);
    res.status(500).json({ message: error.message });
  }
});

// Student: Get posts for students
router.get('/student', authenticateStudent, async (req, res) => {
  try {
    const studentId = req.user.id;
    
    // Get student's class
    const student = await Student.findById(studentId).populate('class');
    const studentClassId = student.class ? student.class._id : null;

    // Build query for posts visible to this student
    const query = {
      isActive: true,
      $or: [
        { targetAudience: 'students' },
        { targetAudience: 'both' },
        {
          targetAudience: 'class',
          targetClass: studentClassId
        }
      ]
    };

    const posts = await Post.find(query)
      .populate('targetClass', 'classNumber section')
      .sort({ createdAt: -1 });

    const postsWithAuthors = await Promise.all(posts.map(async (post) => {
      const postObj = post.toObject();
      if (postObj.author && typeof postObj.author === 'object' && postObj.author._id) {
        return postObj;
      }
      try {
        const admin = await Admin.findById(postObj.author).select('fullname');
        if (admin) {
          postObj.author = { _id: admin._id, fullname: admin.fullname };
        }
      } catch (error) {
        console.error('Error populating admin:', error);
        postObj.author = { _id: postObj.author, fullname: 'Unknown Admin' };
      }
      return postObj;
    }));

    res.status(200).json({ posts: postsWithAuthors });
  } catch (error) {
    console.error('Error fetching posts for student:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get post statistics (for admin dashboard)
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const totalPosts = await Post.countDocuments({ isActive: true });
    const textPosts = await Post.countDocuments({ postType: 'text', isActive: true });
    const imagePosts = await Post.countDocuments({ postType: 'image', isActive: true });
    const imageTextPosts = await Post.countDocuments({ postType: 'image_text', isActive: true });

    const audienceStats = await Post.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$targetAudience', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      totalPosts,
      postTypes: {
        text: textPosts,
        image: imagePosts,
        imageText: imageTextPosts
      },
      audienceStats
    });
  } catch (error) {
    console.error('Error fetching post stats:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

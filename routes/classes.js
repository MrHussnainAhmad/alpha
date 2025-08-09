const express = require('express');
const router = express.Router();
const Class = require('../models/class');
const auth = require('../middleware/auth'); // Assuming you have an auth middleware

// Create a new class
router.post('/', auth.authenticateAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Class name is required.' });
    }
    const newClass = new Class({ name });
    await newClass.save();
    res.status(201).json({ message: 'Class created successfully', class: newClass });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Class with this name already exists.' });
    }
    console.error('Error creating class:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all classes
router.get('/', auth.authenticateAdmin, async (req, res) => {
  try {
    const classes = await Class.find({});
    res.status(200).json({ classes });
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all classes (publicly accessible)
router.get('/public', async (req, res) => {
  try {
    const classes = await Class.find({});
    res.status(200).json({ classes });
  } catch (error) {
    console.error('Error fetching public classes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a class
router.put('/:id', auth.authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Class name is required.' });
    }

    const updatedClass = await Class.findByIdAndUpdate(
      id,
      { name },
      { new: true, runValidators: true }
    );

    if (!updatedClass) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    res.status(200).json({ message: 'Class updated successfully', class: updatedClass });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Class with this name already exists.' });
    }
    console.error('Error updating class:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a class
router.delete('/:id', auth.authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedClass = await Class.findByIdAndDelete(id);

    if (!deletedClass) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    res.status(200).json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Error deleting class:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

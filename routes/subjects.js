const express = require('express');
const router = express.Router();
const Subject = require('../models/subject');
const { authenticateAdmin } = require('../middleware/auth');

// Get all subjects
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const subjects = await Subject.find({}).sort({ name: 1 });
    res.status(200).json({ subjects });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new subject
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Subject name is required.' });
    }

    const newSubject = new Subject({ name });
    await newSubject.save();
    res.status(201).json({ message: 'Subject created successfully', subject: newSubject });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Subject already exists.' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a subject
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Subject name is required.' });
    }

    const updatedSubject = await Subject.findByIdAndUpdate(
      id,
      { name },
      { new: true, runValidators: true }
    );

    if (!updatedSubject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    res.status(200).json({ message: 'Subject updated successfully', subject: updatedSubject });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Subject already exists.' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a subject
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedSubject = await Subject.findByIdAndDelete(id);

    if (!deletedSubject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    res.status(200).json({ message: 'Subject deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
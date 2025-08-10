const GradeSetting = require('../models/gradeSetting');

exports.getGradeSettings = async (req, res) => {
  try {
    const gradeSettings = await GradeSetting.find({});
    res.status(200).json({ success: true, gradeSettings });
  } catch (error) {
    console.error('Error fetching grade settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateGradeSettings = async (req, res) => {
  try {
    const { settings } = req.body;

    if (!Array.isArray(settings)) {
      return res.status(400).json({ success: false, message: 'Settings must be an array.' });
    }

    const operations = settings.map(setting => ({
      updateOne: {
        filter: { grade: setting.grade },
        update: { $set: { minPercentage: setting.minPercentage } },
        upsert: true
      }
    }));

    await GradeSetting.bulkWrite(operations);

    res.status(200).json({ success: true, message: 'Grade settings updated successfully.' });
  } catch (error) {
    console.error('Error updating grade settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

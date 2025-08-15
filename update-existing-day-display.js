const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const Timetable = require('./models/timetable');

async function updateExistingDayDisplay() {
  try {
    console.log('🔍 Starting to update existing day display...');
    
    // Get all timetable entries
    const allEntries = await Timetable.find({ isActive: true });
    console.log(`📊 Found ${allEntries.length} active timetable entries`);
    
    // Group entries by teacher, subject, class, and timeSlot
    const groupedEntries = {};
    
    allEntries.forEach(entry => {
      const key = `${entry.teacher}-${entry.subject}-${entry.class}-${entry.timeSlot}`;
      if (!groupedEntries[key]) {
        groupedEntries[key] = {
          teacher: entry.teacher,
          subject: entry.subject,
          class: entry.class,
          timeSlot: entry.timeSlot,
          days: []
        };
      }
      groupedEntries[key].days.push(entry.day);
    });
    
    console.log(`📋 Grouped into ${Object.keys(groupedEntries).length} unique assignments`);
    
    // Check which groups match the full day pattern
    const fullDayPattern = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'];
    let updatedCount = 0;
    
    for (const [key, group] of Object.entries(groupedEntries)) {
      const hasFullDayPattern = fullDayPattern.every(d => group.days.includes(d));
      
      if (hasFullDayPattern) {
        console.log(`✅ Found full day pattern for: ${group.subject} - Teacher: ${group.teacher} - Class: ${group.class} - Time: ${group.timeSlot}`);
        console.log(`   Days: ${group.days.join(', ')}`);
        
        // Update all entries in this group to have a special marker
        // We'll add a field to indicate this should be displayed as "Full day"
        const updateResult = await Timetable.updateMany(
          {
            teacher: group.teacher,
            subject: group.subject,
            class: group.class,
            timeSlot: group.timeSlot,
            isActive: true
          },
          {
            $set: { displayAsFullDay: true }
          }
        );
        
        console.log(`   Updated ${updateResult.modifiedCount} entries`);
        updatedCount += updateResult.modifiedCount;
      }
    }
    
    console.log(`\n🎉 Update complete! Modified ${updatedCount} entries to display as "Full day"`);
    
  } catch (error) {
    console.error('❌ Error updating day display:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the update
updateExistingDayDisplay();

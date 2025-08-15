require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/student');
const Class = require('../models/class');

// Safe migration script to update student IDs for existing students
const safeStudentIdMigration = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Get all students with class assignments
    const students = await Student.find({ 
      class: { $exists: true, $ne: null },
      isActive: true 
    }).populate('class', 'classNumber section');
    
    console.log(`📊 Found ${students.length} students to check`);

    const results = {
      total: students.length,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: []
    };

    for (const student of students) {
      try {
        console.log(`\n🔍 Checking student: ${student.fullname} (${student.studentId})`);
        
        if (!student.class) {
          console.log(`   ⏭️  Skipped: No class assigned`);
          results.skipped++;
          results.details.push({
            studentId: student.studentId,
            studentName: student.fullname,
            action: 'skipped',
            reason: 'No class assigned'
          });
          continue;
        }

        const expectedStudentId = `S-${student.fullname.replace(/\s+/g, '').toLowerCase()}-${student.class.classNumber}`;
        const expectedSpecialStudentId = student.rollNumber 
          ? `S-${student.fullname.replace(/\s+/g, '').toLowerCase()}-${student.class.classNumber}-${student.rollNumber}`
          : null;

        let needsUpdate = false;
        let updateReason = [];

        // Check if studentId needs update
        if (student.studentId !== expectedStudentId) {
          needsUpdate = true;
          updateReason.push(`studentId mismatch: ${student.studentId} → ${expectedStudentId}`);
        }

        // Check if specialStudentId needs update
        if (student.rollNumber && student.specialStudentId !== expectedSpecialStudentId) {
          needsUpdate = true;
          updateReason.push(`specialStudentId mismatch: ${student.specialStudentId} → ${expectedSpecialStudentId}`);
        }

        // Check if className needs update
        const expectedClassName = `${student.class.classNumber}-${student.class.section}`;
        if (student.className !== expectedClassName) {
          needsUpdate = true;
          updateReason.push(`className mismatch: ${student.className} → ${expectedClassName}`);
        }

        if (!needsUpdate) {
          console.log(`   ✅ No updates needed`);
          results.skipped++;
          results.details.push({
            studentId: student.studentId,
            studentName: student.fullname,
            action: 'skipped',
            reason: 'IDs already correct'
          });
          continue;
        }

        console.log(`   🔄 Updates needed: ${updateReason.join(', ')}`);

        // Store old values for logging
        const oldValues = {
          studentId: student.studentId,
          specialStudentId: student.specialStudentId,
          className: student.className
        };

        // Update the fields
        student.studentId = expectedStudentId;
        student.className = expectedClassName;
        
        if (student.rollNumber && expectedSpecialStudentId) {
          student.specialStudentId = expectedSpecialStudentId;
        }

        // Save the changes
        await student.save();

        console.log(`   ✅ Successfully updated:`);
        console.log(`      studentId: ${oldValues.studentId} → ${student.studentId}`);
        if (oldValues.specialStudentId !== student.specialStudentId) {
          console.log(`      specialStudentId: ${oldValues.specialStudentId} → ${student.specialStudentId}`);
        }
        console.log(`      className: ${oldValues.className} → ${student.className}`);

        results.updated++;
        results.details.push({
          studentId: student.studentId,
          studentName: student.fullname,
          action: 'updated',
          oldValues,
          newValues: {
            studentId: student.studentId,
            specialStudentId: student.specialStudentId,
            className: student.className
          },
          reason: updateReason.join(', ')
        });

      } catch (error) {
        console.error(`   ❌ Error updating ${student.fullname}:`, error.message);
        results.errors++;
        results.details.push({
          studentId: student.studentId,
          studentName: student.fullname,
          action: 'error',
          error: error.message
        });
      }
    }

    // Print summary
    console.log('\n📋 MIGRATION SUMMARY:');
    console.log(`   Total students checked: ${results.total}`);
    console.log(`   Successfully updated: ${results.updated}`);
    console.log(`   Skipped (no changes needed): ${results.skipped}`);
    console.log(`   Errors: ${results.errors}`);

    if (results.errors > 0) {
      console.log('\n❌ ERRORS:');
      results.details
        .filter(detail => detail.action === 'error')
        .forEach(error => {
          console.log(`   - ${error.studentName} (${error.studentId}): ${error.error}`);
        });
    }

    if (results.updated > 0) {
      console.log('\n✅ SUCCESSFUL UPDATES:');
      results.details
        .filter(detail => detail.action === 'updated')
        .forEach(update => {
          console.log(`   - ${update.studentName}: ${update.reason}`);
        });
    }

    console.log('\n🎯 Migration completed successfully!');
    return results;

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run migration if this script is executed directly
if (require.main === module) {
  console.log('🚀 Starting Safe Student ID Migration...');
  console.log('⚠️  This will update student IDs to match their current class assignments');
  console.log('⚠️  Make sure you have a backup of your database before proceeding\n');
  
  safeStudentIdMigration()
    .then(results => {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { safeStudentIdMigration };

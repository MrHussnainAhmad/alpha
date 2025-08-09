const mongoose = require('mongoose');
const Student = require('./models/student');
const Class = require('./models/class');
const Teacher = require('./models/teacher');

// MongoDB connection string from .env
const MONGODB_URI = 'mongodb+srv://admin:adminhu@cluster0.f0l9ktg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function fixStudentClassIssues() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n🔧 Starting Student-Class Relationship Fixes...\n');

    // Fix 1: Find students with string class IDs instead of ObjectIds
    console.log('🔍 Fix 1: Checking for string class IDs...');
    const studentsWithStringClassIds = await Student.find({
      class: { $type: "string" }
    });

    if (studentsWithStringClassIds.length > 0) {
      console.log(`Found ${studentsWithStringClassIds.length} students with string class IDs`);
      
      for (let student of studentsWithStringClassIds) {
        try {
          // Convert string to ObjectId if it's a valid ObjectId string
          if (mongoose.Types.ObjectId.isValid(student.class)) {
            student.class = new mongoose.Types.ObjectId(student.class);
            await student.save();
            console.log(`✅ Fixed class ID for student: ${student.fullname}`);
          } else {
            console.log(`❌ Invalid class ID for student: ${student.fullname} - ${student.class}`);
          }
        } catch (error) {
          console.log(`❌ Error fixing student ${student.fullname}: ${error.message}`);
        }
      }
    } else {
      console.log('✅ No string class IDs found');
    }

    // Fix 2: Check for null/undefined class references
    console.log('\n🔍 Fix 2: Checking for null/undefined class references...');
    const studentsWithNullClass = await Student.find({
      $or: [
        { class: null },
        { class: { $exists: false } }
      ]
    });

    console.log(`Found ${studentsWithNullClass.length} students without class assignment`);
    studentsWithNullClass.forEach(student => {
      console.log(`- ${student.fullname} (${student.email})`);
    });

    // Fix 3: Validate class references exist
    console.log('\n🔍 Fix 3: Validating class references exist...');
    const studentsWithClassIds = await Student.find({
      class: { $ne: null, $exists: true }
    });

    let invalidReferences = 0;
    for (let student of studentsWithClassIds) {
      if (student.class) {
        const classExists = await Class.findById(student.class);
        if (!classExists) {
          console.log(`❌ Invalid class reference for student: ${student.fullname} - Class ID: ${student.class}`);
          invalidReferences++;
          
          // Optionally, set class to null for students with invalid class references
          // student.class = null;
          // await student.save();
        }
      }
    }

    if (invalidReferences === 0) {
      console.log('✅ All class references are valid');
    } else {
      console.log(`❌ Found ${invalidReferences} invalid class references`);
    }

    // Fix 4: Ensure Hussnain student is properly assigned to the class
    console.log('\n🔍 Fix 4: Checking Hussnain student assignment...');
    const hussnainStudent = await Student.findOne({
      $or: [
        { email: 'hussnain@gmail.com' },
        { fullname: { $regex: /hussnain/i } }
      ]
    });

    if (hussnainStudent) {
      console.log('Found Hussnain:', {
        fullname: hussnainStudent.fullname,
        email: hussnainStudent.email,
        currentClass: hussnainStudent.class,
        isVerified: hussnainStudent.isVerified,
        isActive: hussnainStudent.isActive
      });

      // Check if the class ID from your log exists
      const targetClassId = '6897ad3598dc4bb6f9732a0f';
      const targetClass = await Class.findById(targetClassId);
      
      if (targetClass) {
        console.log(`Target class exists: ${targetClass.name}`);
        
        // If Hussnain's class doesn't match, update it
        if (!hussnainStudent.class || hussnainStudent.class.toString() !== targetClassId) {
          console.log('🔧 Updating Hussnain\'s class assignment...');
          hussnainStudent.class = new mongoose.Types.ObjectId(targetClassId);
          await hussnainStudent.save();
          console.log('✅ Updated Hussnain\'s class assignment');
        } else {
          console.log('✅ Hussnain is already correctly assigned to this class');
        }
      } else {
        console.log('❌ Target class not found in database');
      }
    } else {
      console.log('❌ Hussnain student not found');
    }

    // Fix 5: Test the teacher query
    console.log('\n🔍 Fix 5: Testing teacher query...');
    const testQuery = {
      class: new mongoose.Types.ObjectId('6897ad3598dc4bb6f9732a0f'),
      isVerified: true,
      isActive: true
    };

    const testResults = await Student.find(testQuery).populate('class');
    console.log(`Teacher query now returns ${testResults.length} students`);
    
    if (testResults.length > 0) {
      console.log('Students found:');
      testResults.forEach(student => {
        console.log(`- ${student.fullname} (${student.email}) - Class: ${student.class?.name || 'Unknown'}`);
      });
    }

    console.log('\n✅ Student-Class relationship fixes completed!');

  } catch (error) {
    console.error('❌ Error during fixes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the fix function
fixStudentClassIssues();

const mongoose = require('mongoose');
const FeeVoucher = require('./models/feeVoucher');
const Student = require('./models/student');

// Connect to MongoDB
require('dotenv').config();
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testFeeVouchers() {
  try {
    console.log('🔍 Testing Fee Vouchers Data\n');

    // Get all students
    const students = await Student.find({ isActive: true, isVerified: true })
      .select('_id fullname studentId customStudentId specialStudentId');

    console.log(`📊 Found ${students.length} active verified students:\n`);
    students.forEach((student, index) => {
      console.log(`  ${index + 1}. ${student.fullname}`);
      console.log(`     _id: ${student._id}`);
      console.log(`     studentId: ${student.studentId || 'null'}`);
      console.log(`     customStudentId: ${student.customStudentId || 'null'}`);
      console.log(`     specialStudentId: ${student.specialStudentId || 'null'}\n`);
    });

    // Get all fee vouchers
    console.log('💰 Fee Vouchers in database:\n');
    const allVouchers = await FeeVoucher.find({})
      .populate('student', 'fullname')
      .sort({ uploadedAt: -1 });

    if (allVouchers.length === 0) {
      console.log('❌ No fee vouchers found in the database!');
    } else {
      console.log(`Found ${allVouchers.length} fee vouchers:\n`);
      allVouchers.forEach((voucher, index) => {
        console.log(`  ${index + 1}. Student: ${voucher.student?.fullname || 'Unknown'}`);
        console.log(`     Student ObjectId: ${voucher.student?._id}`);
        console.log(`     studentId: ${voucher.studentId}`);
        console.log(`     specialStudentId: ${voucher.specialStudentId}`);
        console.log(`     newId: ${voucher.newId}`);
        console.log(`     uploadedAt: ${voucher.uploadedAt}\n`);
      });

      // Test querying vouchers for each student
      console.log('🔍 Testing voucher queries for each student:\n');
      for (const student of students) {
        console.log(`Testing for student: ${student.fullname}`);
        console.log(`  Using studentId: ${student.studentId}`);
        
        // Query by studentId (like the API does)
        const vouchersByStudentId = await FeeVoucher.find({ 
          studentId: student.studentId 
        }).sort({ uploadedAt: -1 });
        
        console.log(`  Found ${vouchersByStudentId.length} vouchers by studentId`);
        
        // Also try by student ObjectId
        const vouchersByObjectId = await FeeVoucher.find({ 
          student: student._id 
        }).sort({ uploadedAt: -1 });
        
        console.log(`  Found ${vouchersByObjectId.length} vouchers by ObjectId\n`);
      }
    }

    // Check the specific issue - simulate the API call
    console.log('🎯 Simulating API call for first student:\n');
    if (students.length > 0) {
      const testStudent = students[0];
      console.log(`Simulating API call for: ${testStudent.fullname}`);
      console.log(`Student ID used in query: ${testStudent.studentId}`);
      
      const apiResult = await FeeVoucher.find({ 
        studentId: testStudent.studentId 
      }).sort({ uploadedAt: -1 });
      
      console.log(`API would return: ${apiResult.length} vouchers`);
      console.log(`Response would be: { feeVouchers: [${apiResult.length} items] }`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

testFeeVouchers();

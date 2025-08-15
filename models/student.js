const mongoose = require("mongoose");
const Class = require("./class");

// Function to generate Student ID: S-name-class with duplicate handling
async function generateStudentId(name, className) {
  const cleanName = name.replace(/\s+/g, '').toLowerCase();
  let baseId = `S-${cleanName}-${className}`;
  
  // Check if this base ID already exists
  const Student = mongoose.model('Student');
  let counter = 1;
  let finalId = baseId;
  
  // Keep checking until we find a unique ID
  while (await Student.findOne({ studentId: finalId })) {
    counter++;
    finalId = `S-${cleanName}${counter}-${className}`;
  }
  
  return finalId;
}

// Function to generate Special Student ID: S-name-class-rollNumber
function generateSpecialStudentId(name, className, rollNumber) {
  const cleanName = name.replace(/\s+/g, '').toLowerCase();
  return `S-${cleanName}-${className}-${rollNumber}`;
}

const studentSchema = new mongoose.Schema({
  fullname: {
    type: String,
    required: true,
    trim: true
  },
  fathername: {
    type: String,
    required: true,
    trim: true
  },
  dob: {
    type: Date,
    required: true
  },
  studentId: {
    type: String,
    unique: true,
    trim: true
  },
  examIds: [{
    type: String,
  }],
  allGrades: [{
    examId: String,
    subjects: [{
      name: String,
      grade: String,
    }]
  }],
  specialStudentId: {
    type: String,
    unique: true,
    sparse: true, // Only create index if value exists
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
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  homePhone: {
    type: String,
    required: true,
    trim: true
  },
  gender: {
    type: String,
    required: true,
    enum: ['male', 'female', 'other']
  },
  profilePicture: {
    type: String, // Cloudinary URL
    default: null
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    default: null
  },
  className: {
    type: String,
    trim: true
  },
  section: {
    type: String,
    trim: true
  },
  rollNumber: {
    type: String,
    sparse: true, // Only required when generating special ID
    trim: true
  },
  hasClassAndSectionSet: {
    type: Boolean,
    default: false
  },
  currentFee: {
    type: Number,
    default: 0,
  },
  futureFee: {
    type: Number,
    default: 0,
  },
  feeVoucherSubmitted: {
    type: Boolean,
    default: false
  },
  feeVoucherImage: {
    type: String, // Cloudinary URL for fee voucher
    default: null
  },
  grades: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Grade',
    },
  ],
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false,
    index: true // Index for faster cleanup queries
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  role: {
    type: String,
    default: "student"
  },

}, {
  timestamps: true
});

// Pre-save middleware to generate student ID when class is assigned
studentSchema.pre('save', async function(next) {
  try {
    console.log('Entering pre-save middleware for studentId generation');
    console.log(`isModified('class'): ${this.isModified('class')}`);
    console.log(`this.class: ${this.class}`);
    console.log(`Current studentId: ${this.studentId}`);
    
    // Check if class is assigned and studentId needs to be updated
    if (this.class && (!this.studentId || this.studentId.includes('Unassigned'))) {
      const studentClass = await Class.findById(this.class);
      if (studentClass) {
        // Generate new studentId based on class with duplicate handling
        const newStudentId = await generateStudentId(this.fullname, studentClass.classNumber);
        console.log(`newStudentId: ${newStudentId}`);
        
        // Update studentId if it doesn't exist or if it contains 'Unassigned'
        if (!this.studentId || this.studentId.includes('Unassigned')) {
          this.studentId = newStudentId;
          console.log(`this.studentId after update: ${this.studentId}`);
        }
        
        // Also update className field
        this.className = `${studentClass.classNumber}-${studentClass.section}`;
        console.log(`className updated: ${this.className}`);
      }
    }
    next();
  } catch (error) {
    console.error('Error in studentId generation middleware:', error);
    next(error);
  }
});

// Pre-save middleware to generate special student ID when roll number is provided
studentSchema.pre('save', async function(next) {
  try {
    // Only generate special student ID if class is assigned and roll number is provided
    if (this.isModified('rollNumber') && this.rollNumber && this.class) {
      const studentClass = await Class.findById(this.class);
      if (studentClass) {
        this.specialStudentId = generateSpecialStudentId(this.fullname, studentClass.classNumber, this.rollNumber);
      }
    }
    next();
  } catch (error) {
    console.error('Error in specialStudentId generation middleware:', error);
    next(error);
  }
});

// SAFE METHOD: Update student IDs when class changes
studentSchema.methods.updateStudentIdsForClassChange = async function(newClassId) {
  try {
    console.log(`Updating student IDs for class change: ${this.fullname}`);
    console.log(`Current studentId: ${this.studentId}`);
    console.log(`Current specialStudentId: ${this.specialStudentId}`);
    console.log(`New class ID: ${newClassId}`);
    
    // Store old IDs for logging
    const oldStudentId = this.studentId;
    const oldSpecialStudentId = this.specialStudentId;
    
    // Get the new class details
    const newClass = await Class.findById(newClassId);
    if (!newClass) {
      throw new Error('New class not found');
    }
    
    // Generate new studentId
    const newStudentId = await generateStudentId(this.fullname, newClass.classNumber);
    console.log(`New studentId: ${newStudentId}`);
    
    // Generate new specialStudentId if rollNumber exists
    let newSpecialStudentId = null;
    if (this.rollNumber) {
      newSpecialStudentId = generateSpecialStudentId(this.fullname, newClass.classNumber, this.rollNumber);
      console.log(`New specialStudentId: ${newSpecialStudentId}`);
    }
    
    // Update the fields
    this.studentId = newStudentId;
    this.className = `${newClass.classNumber}-${newClass.section}`;
    
    if (newSpecialStudentId) {
      this.specialStudentId = newSpecialStudentId;
    }
    
    // Save the changes
    await this.save();
    
    console.log(`Successfully updated student IDs for ${this.fullname}:`);
    console.log(`  Old studentId: ${oldStudentId} → New studentId: ${this.studentId}`);
    if (oldSpecialStudentId && newSpecialStudentId) {
      console.log(`  Old specialStudentId: ${oldSpecialStudentId} → New specialStudentId: ${this.specialStudentId}`);
    }
    
    return {
      success: true,
      oldStudentId,
      newStudentId: this.studentId,
      oldSpecialStudentId,
      newSpecialStudentId: this.specialStudentId
    };
    
  } catch (error) {
    console.error('Error updating student IDs for class change:', error);
    throw error;
  }
};

// SAFE METHOD: Update student IDs when roll number changes
studentSchema.methods.updateSpecialStudentIdForRollNumberChange = async function(newRollNumber) {
  try {
    console.log(`Updating special student ID for roll number change: ${this.fullname}`);
    console.log(`Current specialStudentId: ${this.specialStudentId}`);
    console.log(`New roll number: ${newRollNumber}`);
    
    if (!this.class) {
      throw new Error('Student must be assigned to a class to update special student ID');
    }
    
    const studentClass = await Class.findById(this.class);
    if (!studentClass) {
      throw new Error('Student class not found');
    }
    
    const oldSpecialStudentId = this.specialStudentId;
    const newSpecialStudentId = generateSpecialStudentId(this.fullname, studentClass.classNumber, newRollNumber);
    
    this.rollNumber = newRollNumber;
    this.specialStudentId = newSpecialStudentId;
    
    await this.save();
    
    console.log(`Successfully updated special student ID for ${this.fullname}:`);
    console.log(`  Old specialStudentId: ${oldSpecialStudentId} → New specialStudentId: ${this.specialStudentId}`);
    
    return {
      success: true,
      oldSpecialStudentId,
      newSpecialStudentId: this.specialStudentId
    };
    
  } catch (error) {
    console.error('Error updating special student ID for roll number change:', error);
    throw error;
  }
};

// Method to assign special ID for fee voucher submission
studentSchema.methods.assignSpecialIdForFeeVoucher = async function(rollNumber) {
  try {
    if (!this.specialStudentId) {
      this.rollNumber = rollNumber;
      const studentClass = await Class.findById(this.class);
      if (studentClass) {
        this.specialStudentId = generateSpecialStudentId(this.fullname, studentClass.classNumber, this.rollNumber);
      }
    }
    return this.specialStudentId;
  } catch (error) {
    console.error('Error assigning special ID for fee voucher:', error);
    throw error;
  }
};

// Check if the model already exists before compiling
module.exports = mongoose.models.Student || mongoose.model("Student", studentSchema);

// Export utility functions for use in other parts of the application
module.exports.generateStudentId = generateStudentId;
module.exports.generateSpecialStudentId = generateSpecialStudentId;

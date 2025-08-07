# School App Backend API

A comprehensive backend API for a mobile school application supporting three user types: Admin/Principal, Teachers, and Students.

## Features

- **User Management**: Three distinct user types with role-based authentication
- **Auto-generated IDs**: 
  - Teacher IDs: `T-name-joiningyear` (e.g., T-johnsmith-2023)
  - Student IDs: `S-name-class` (e.g., S-janedoe-10A)
  - Special Student IDs: `S-name-class-rollnumber` (for fee voucher submissions)
- **Image Uploads**: Profile pictures and fee voucher uploads via Cloudinary
- **Fee Voucher System**: Students can submit fee vouchers and get special IDs
- **Search Functionality**: Admin and teachers can search users by ID

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file based on `.env.example`
4. Start the server:
   ```bash
   node index.js
   ```

## API Endpoints

### Admin/Principal Routes (`/api/admin`)

#### Authentication
- **POST** `/signup` - Create admin account
- **POST** `/login` - Admin login

#### User Management
- **POST** `/create-teacher` - Create teacher account
- **POST** `/create-student` - Create student account
- **GET** `/search/teacher/:teacherId` - Search teacher by Teacher ID
- **GET** `/search/student/:studentId` - Search student by Student ID

### Teacher Routes (`/api/teacher`)

#### Authentication
- **POST** `/login` - Teacher login

#### Profile Management
- **PUT** `/profile` - Update teacher profile
- **PUT** `/change-password` - Change password

#### Student Management
- **POST** `/create-student` - Create student account
- **GET** `/search/student/:studentId` - Search student by Student ID
- **GET** `/students/:class/:section` - Get students by class and section

### Student Routes (`/api/student`)

#### Authentication
- **POST** `/login` - Student login

#### Profile Management
- **GET** `/profile/:id` - Get student profile
- **PUT** `/profile` - Update student profile
- **PUT** `/change-password` - Change password

#### Fee Voucher System
- **POST** `/submit-fee-voucher` - Submit fee voucher with image
- **GET** `/fee-voucher-status/:studentId` - Check fee voucher status

### Announcement Routes (`/api/announcements`)

#### Admin Functions
- **POST** `/create` - Create announcement (Admin only)
- **GET** `/admin/all` - Get all announcements with filters (Admin only)
- **PUT** `/:id` - Update announcement (Admin only)
- **DELETE** `/:id` - Delete announcement (Admin only)
- **GET** `/admin/stats` - Get announcement statistics (Admin only)

#### Teacher Functions
- **POST** `/teacher/create` - Create announcement (Teacher only - can target students or specific class)
- **GET** `/teacher/my-announcements` - Get teacher's own announcements
- **PUT** `/teacher/:id` - Update teacher's own announcement
- **DELETE** `/teacher/:id` - Delete teacher's own announcement

#### User Functions
- **GET** `/teacher` - Get announcements for teachers
- **GET** `/student` - Get announcements for students (includes class-specific)
- **GET** `/:id` - Get single announcement details
- **POST** `/:id/read` - Mark announcement as read

### Marks/Grades Routes (`/api/marks`)

#### Admin/Teacher Functions
- **POST** `/add` - Add marks for a student (Admin/Teacher only)
- **PUT** `/:id` - Update marks record (Admin/Teacher only)
- **DELETE** `/:id` - Delete marks record (Admin/Teacher only)
- **GET** `/class/:class/:section` - Get class performance (Admin/Teacher only)

#### Teacher Functions
- **GET** `/teacher/my-records` - Get marks added by teacher (Teacher only)

#### Admin Functions
- **GET** `/admin/all` - Get all marks records with filters (Admin only)
- **GET** `/admin/stats` - Get marks statistics (Admin only)

#### Student Functions
- **GET** `/student/:studentIdString` - Get student's academic record

### File Upload Routes

- **POST** `/api/upload-profile` - Upload profile image
- **POST** `/api/upload-voucher` - Upload fee voucher image
- **POST** `/api/upload-announcement-images` - Upload announcement images (up to 5)

## Data Models

### Admin Model
```javascript
{
  fullname: String (required),
  username: String (required, unique),
  email: String (required, unique),
  password: String (required, hashed),
  role: String (enum: ["admin", "principal"])
}
```

### Teacher Model
```javascript
{
  fullname: String (required),
  teacherId: String (auto-generated: T-name-joiningyear),
  email: String (required, unique),
  password: String (required, hashed),
  phoneNumber: String (required),
  cnicNumber: String (required, 11 digits, unique),
  gender: String (enum: ["male", "female", "other"]),
  age: Number (required, 18-70),
  img: String (Cloudinary URL),
  address: String (required),
  whatsappNumber: String (required),
  joiningYear: Number (required),
  isActive: Boolean (default: true),
  role: String (default: "teacher")
}
```

### Student Model
```javascript
{
  fullname: String (required),
  fathername: String (required),
  dob: Date (required),
  studentId: String (auto-generated: S-name-class),
  specialStudentId: String (auto-generated: S-name-class-rollnumber),
  email: String (required, unique),
  password: String (required, hashed),
  phoneNumber: String (required),
  homePhone: String (required),
  recordNumber: String (required, unique),
  gender: String (enum: ["male", "female", "other"]),
  img: String (Cloudinary URL),
  address: String (required),
  class: String (required),
  section: String (required),
  rollNumber: String (optional, required for special ID),
  feeVoucherSubmitted: Boolean (default: false),
  feeVoucherImage: String (Cloudinary URL),
  isActive: Boolean (default: true),
  role: String (default: "student")
}
```

### Announcement Model
```javascript
{
  title: String (required),
  message: String (required),
  images: [String] (array of Cloudinary URLs),
  targetType: String (required, enum: ['all', 'teachers', 'students', 'class']),
  targetClass: String (required if targetType is 'class'),
  targetSection: String (optional for class-specific),
  createdBy: ObjectId (reference to Admin or Teacher),
  createdByType: String (enum: ['Admin', 'Teacher']),
  createdByName: String (required),
  isActive: Boolean (default: true),
  priority: String (enum: ['low', 'medium', 'high', 'urgent']),
  expiresAt: Date (optional),
  readBy: [{
    userId: ObjectId,
    userType: String (enum: ['teacher', 'student']),
    readAt: Date
  }]
}
```

### Marks Model
```javascript
{
  studentId: ObjectId (reference to Student),
  studentIdString: String (required, e.g., "S-ahmedali-10A"),
  studentName: String (required),
  class: String (required),
  section: String (required),
  examType: String (required, enum: ['midterm', 'final', 'quiz', 'assignment', 'test', 'monthly', 'weekly']),
  examDate: Date (required),
  subjects: [{
    subjectName: String (required),
    marksObtained: Number (required),
    totalMarks: Number (required),
    percentage: Number (auto-calculated),
    grade: String (auto-calculated: A+, A, B+, B, C+, C, D+, D, F),
    remarks: String
  }],
  totalMarksObtained: Number (auto-calculated),
  totalMarksMax: Number (auto-calculated),
  overallPercentage: Number (auto-calculated),
  overallGrade: String (auto-calculated),
  position: Number (class position),
  addedBy: ObjectId (reference to Admin or Teacher),
  addedByType: String (enum: ['Admin', 'Teacher']),
  addedByName: String (required),
  academicYear: String (required, e.g., "2023-2024"),
  semester: String (enum: ['1st', '2nd', '3rd', '4th']),
  isActive: Boolean (default: true),
  remarks: String
}
```

## Usage Examples

### Creating an Admin
```javascript
POST /api/admin/signup
{
  "fullname": "John Principal",
  "username": "admin001",
  "email": "admin@school.com",
  "password": "securepassword",
  "role": "admin"
}
```

### Creating a Teacher (by Admin)
```javascript
POST /api/admin/create-teacher
{
  "fullname": "Jane Smith",
  "email": "jane.smith@school.com",
  "password": "teacherpass",
  "phoneNumber": "03001234567",
  "cnicNumber": "12345678901",
  "gender": "female",
  "age": 35,
  "address": "123 Main St, City",
  "whatsappNumber": "03001234567",
  "joiningYear": 2023
}
// Auto-generates teacherId: "T-janesmith-2023"
```

### Creating a Student (by Admin or Teacher)
```javascript
POST /api/admin/create-student
{
  "fullname": "Ahmed Ali",
  "fathername": "Ali Khan",
  "dob": "2010-05-15",
  "email": "ahmed.ali@student.com",
  "password": "studentpass",
  "phoneNumber": "03009876543",
  "homePhone": "0429876543",
  "recordNumber": "REC001",
  "gender": "male",
  "address": "456 School St, City",
  "class": "10A",
  "section": "A"
}
// Auto-generates studentId: "S-ahmedali-10A"
```

### Fee Voucher Submission
```javascript
POST /api/student/submit-fee-voucher
{
  "studentId": "S-ahmedali-10A",
  "rollNumber": "15"
}
// Auto-generates specialStudentId: "S-ahmedali-10A-15"
```

### Creating Announcements (Admin)

#### Announcement to All Users
```javascript
POST /api/announcements/create
{
  "title": "School Holiday Notice",
  "message": "School will remain closed tomorrow due to weather conditions.",
  "images": ["https://cloudinary.com/image1.jpg"],
  "targetType": "all",
  "priority": "high"
}
```

#### Announcement to Teachers Only
```javascript
POST /api/announcements/create
{
  "title": "Staff Meeting",
  "message": "Monthly staff meeting tomorrow at 2 PM in conference room.",
  "targetType": "teachers",
  "priority": "medium"
}
```

#### Announcement to Students Only
```javascript
POST /api/announcements/create
{
  "title": "Sports Day",
  "message": "Annual sports day will be held next Friday. All students must participate.",
  "images": ["https://cloudinary.com/sports1.jpg", "https://cloudinary.com/sports2.jpg"],
  "targetType": "students",
  "priority": "medium"
}
```

#### Announcement to Specific Class
```javascript
POST /api/announcements/create
{
  "title": "Class 10A Exam Schedule",
  "message": "Final exams for Class 10A will start from Monday. Please check the detailed schedule.",
  "images": ["https://cloudinary.com/schedule.jpg"],
  "targetType": "class",
  "targetClass": "10A",
  "targetSection": "A",
  "priority": "high",
  "expiresAt": "2024-12-31"
}
```

### Creating Announcements (Teacher)

#### Teacher Announcement to All Students
```javascript
POST /api/announcements/teacher/create
{
  "title": "Assignment Submission",
  "message": "Please submit your math assignments by Friday. Late submissions will not be accepted.",
  "images": ["https://cloudinary.com/assignment.jpg"],
  "targetType": "students",
  "priority": "medium"
}
```

#### Teacher Announcement to Specific Class
```javascript
POST /api/announcements/teacher/create
{
  "title": "Class 9B Quiz Tomorrow",
  "message": "Don't forget about the biology quiz tomorrow. Make sure to review chapters 5-7.",
  "targetType": "class",
  "targetClass": "9B",
  "priority": "high"
}
```

### Adding Student Marks (Admin/Teacher)

#### Add Marks for Multiple Subjects
```javascript
POST /api/marks/add
{
  "studentIdString": "S-ahmedali-10A",
  "examType": "midterm",
  "examDate": "2024-03-15",
  "academicYear": "2023-2024",
  "semester": "2nd",
  "subjects": [
    {
      "subjectName": "Mathematics",
      "marksObtained": 85,
      "totalMarks": 100,
      "remarks": "Good performance"
    },
    {
      "subjectName": "English",
      "marksObtained": 78,
      "totalMarks": 100,
      "remarks": "Needs improvement in grammar"
    },
    {
      "subjectName": "Physics",
      "marksObtained": 92,
      "totalMarks": 100,
      "remarks": "Excellent"
    }
  ],
  "remarks": "Overall good performance in midterm exam"
}
// Auto-calculates: percentages, grades, overall percentage, overall grade
```

#### Get Student's Academic Record
```javascript
GET /api/marks/student/S-ahmedali-10A
// Returns organized academic record with all exams, subjects, and grades
```

#### Get Class Performance
```javascript
GET /api/marks/class/10A/A?examType=midterm&academicYear=2023-2024
// Returns class performance with rankings and positions
```

## Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Environment Variables

Create a `.env` file with the following variables:
- `MONGO_URL`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `PORT`: Server port (default: 5000)
- `CLOUDINARY_NAME`: Cloudinary cloud name
- `CLOUDINARY_API_KEY`: Cloudinary API key
- `CLOUDINARY_API_SECRET`: Cloudinary API secret

## Error Handling

All endpoints return appropriate HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Role-based access control
- Input validation
- Unique constraints on emails and IDs

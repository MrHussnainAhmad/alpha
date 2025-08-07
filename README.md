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

### File Upload Routes

- **POST** `/api/upload-profile` - Upload profile image
- **POST** `/api/upload-voucher` - Upload fee voucher image

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

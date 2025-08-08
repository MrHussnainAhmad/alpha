# Backend Setup with MongoDB Atlas

This guide will help you set up the backend server with MongoDB Atlas.

## Prerequisites

- Node.js (v16 or later)
- MongoDB Atlas account
- Cloudinary account (for image uploads)

## MongoDB Atlas Setup

1. **Create MongoDB Atlas Account**
   - Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
   - Sign up or log in to your account

2. **Create a Cluster**
   - Click "Create a Deployment"
   - Choose "FREE" tier (M0 Sandbox)
   - Select your preferred cloud provider and region
   - Click "Create Cluster"

3. **Create Database User**
   - Go to "Security" → "Database Access"
   - Click "Add New Database User"
   - Choose "Password" authentication method
   - Set username and password (remember these!)
   - Set role to "Atlas Admin" or "Read and write to any database"
   - Click "Add User"

4. **Configure Network Access**
   - Go to "Security" → "Network Access"
   - Click "Add IP Address"
   - For development: Click "Allow Access from Anywhere" (0.0.0.0/0)
   - For production: Add your server's specific IP address
   - Click "Confirm"

5. **Get Connection String**
   - Go to "Deployment" → "Database"
   - Click "Connect" on your cluster
   - Select "Connect your application"
   - Choose "Node.js" as driver
   - Copy the connection string

## Backend Configuration

1. **Install Dependencies**
```bash
cd backend
npm install
```

2. **Configure Environment Variables**
   - Update the `.env` file with your MongoDB Atlas connection string:

```env
# MongoDB connection string - MongoDB Atlas
MONGO_URL=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/school-app?retryWrites=true&w=majority

# JWT Secret Key (use a strong, unique secret)
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_complex_at_least_32_characters

# Server Port
PORT=5000

# Cloudinary Configuration (optional for image uploads)
CLOUDINARY_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

3. **Replace Connection String Values**
   - Replace `YOUR_USERNAME` with your MongoDB Atlas username
   - Replace `YOUR_PASSWORD` with your MongoDB Atlas password
   - Replace `cluster0.xxxxx` with your actual cluster address
   - The database name `school-app` will be created automatically

4. **Generate Strong JWT Secret**
   You can generate a strong JWT secret using Node.js:
```javascript
// Run this in Node.js console
require('crypto').randomBytes(32).toString('hex')
```

## Cloudinary Setup (Optional)

If you want to enable image uploads:

1. Go to [https://cloudinary.com/](https://cloudinary.com/)
2. Sign up for a free account
3. Get your credentials from the dashboard
4. Update the `.env` file with your Cloudinary credentials

## Running the Backend

1. **Start the Server**
```bash
npm start
# or for development with nodemon
npm run dev
```

2. **Verify Connection**
   - The server should start on port 5000
   - You should see "Server is running on port 5000" in the console
   - MongoDB connection should be established

## Testing the API

You can test the API endpoints using tools like Postman or curl:

### Create Admin User (First Time Setup)
```bash
POST http://localhost:5000/api/admin/signup
Content-Type: application/json

{
  "fullname": "Admin User",
  "username": "admin",
  "email": "admin@example.com",
  "password": "admin123",
  "role": "admin"
}
```

### Test Teacher Signup
```bash
POST http://localhost:5000/api/admin/create-teacher
Content-Type: application/json

{
  "fullname": "John Doe",
  "email": "teacher@example.com",
  "password": "password123",
  "phoneNumber": "1234567890",
  "cnicNumber": "12345678901",
  "gender": "male",
  "age": 30,
  "address": "123 Main St",
  "whatsappNumber": "1234567890",
  "joiningYear": 2024
}
```

### Test Student Signup
```bash
POST http://localhost:5000/api/admin/create-student
Content-Type: application/json

{
  "fullname": "Jane Smith",
  "fathername": "John Smith",
  "dob": "2005-01-15T00:00:00.000Z",
  "email": "student@example.com",
  "password": "password123",
  "phoneNumber": "1234567890",
  "homePhone": "1234567890",
  "recordNumber": "REC001",
  "gender": "female",
  "address": "456 Oak Ave",
  "class": "10th",
  "section": "A"
}
```

## Database Collections

The following collections will be created automatically in your MongoDB Atlas database:

- `admins` - Admin users
- `teachers` - Teacher profiles
- `students` - Student profiles
- `announcements` - School announcements
- `marks` - Student grades/marks
- `feevouchers` - Fee payment records
- `classquestions` - Class questions/assignments

## API Endpoints

The backend provides the following main API routes:

- `/api/admin/*` - Admin operations
- `/api/teacher/*` - Teacher operations
- `/api/student/*` - Student operations
- `/api/announcements/*` - Announcement management
- `/api/marks/*` - Grade management
- `/api/fee-vouchers/*` - Fee voucher management
- `/api/class-questions/*` - Assignment management

## Security Features

- Password hashing with bcrypt
- JWT token-based authentication
- CORS enabled for cross-origin requests
- Input validation and error handling

## Troubleshooting

### Common Issues

1. **Connection Error**
   - Check your MongoDB Atlas connection string
   - Verify network access is configured correctly
   - Ensure database user exists and has correct permissions

2. **Authentication Error**
   - Verify username and password in connection string
   - Check if database user is active

3. **Port Already in Use**
   - Change the PORT in `.env` file
   - Kill the process using port 5000: `netstat -ano | findstr :5000`

4. **Cloudinary Errors**
   - Check if Cloudinary credentials are correct
   - Image uploads will fail if Cloudinary is not configured

### Environment Variables Check

Make sure your `.env` file has all required variables:
```bash
# Required
MONGO_URL=mongodb+srv://...
JWT_SECRET=your-secret-key
PORT=5000

# Optional (for image uploads)
CLOUDINARY_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

## Production Deployment

For production deployment:

1. Use a strong JWT secret
2. Configure specific IP addresses in MongoDB Atlas Network Access
3. Use environment-specific connection strings
4. Enable MongoDB Atlas Data API if needed
5. Set up monitoring and alerts

The backend is now ready to work with the mobile app!

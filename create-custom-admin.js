const axios = require('axios');
const readline = require('readline');

// Configuration - Update with your backend URL
const API_BASE_URL = 'http://localhost:5000/api';

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function createCustomAdmin() {
  try {
    console.log('🔧 Create Custom Admin Account\n');
    console.log('Please provide the following details:\n');

    // Get admin details from user
    const fullname = await askQuestion('Full Name: ');
    const username = await askQuestion('Username: ');
    const email = await askQuestion('Email: ');
    const password = await askQuestion('Password: ');
    const confirmPassword = await askQuestion('Confirm Password: ');

    // Validate password match
    if (password !== confirmPassword) {
      console.log('\n❌ Passwords do not match!');
      rl.close();
      return;
    }

    // Validate required fields
    if (!fullname || !username || !email || !password) {
      console.log('\n❌ All fields are required!');
      rl.close();
      return;
    }

    const adminData = {
      fullname,
      username,
      email,
      password,
      role: "admin"
    };

    console.log('\n📝 Creating admin account with these details:');
    console.log('   Full Name:', adminData.fullname);
    console.log('   Username:', adminData.username);
    console.log('   Email:', adminData.email);
    console.log('   Role:', adminData.role);
    console.log('');

    const response = await axios.post(`${API_BASE_URL}/admin/signup`, adminData);
    
    console.log('✅ Admin account created successfully!');
    console.log('Response:', response.data.message);
    
    console.log('\n🔐 Login Credentials:');
    console.log('   Email:', adminData.email);
    console.log('   Password:', adminData.password);
    
    console.log('\n⚠️  Important Notes:');
    console.log('   1. Save these credentials securely');
    console.log('   2. Change the password after first login');
    console.log('   3. You can now login with these credentials');
    
    // Test the login immediately
    console.log('\n🧪 Testing login...');
    const loginResponse = await axios.post(`${API_BASE_URL}/admin/login`, {
      email: adminData.email,
      password: adminData.password
    });
    
    console.log('✅ Login test successful!');
    console.log('   Token received:', loginResponse.data.token ? 'Yes' : 'No');
    
  } catch (error) {
    console.error('\n❌ Failed to create admin account');
    if (error.response) {
      console.error('Error:', error.response.data.message);
      console.error('Status:', error.response.status);
      
      if (error.response.status === 400 && error.response.data.message.includes('already exists')) {
        console.log('\n💡 Tip: Try using a different email or username');
      }
    } else {
      console.error('Error:', error.message);
      console.log('\n💡 Tip: Make sure your backend server is running on localhost:5000');
    }
  } finally {
    rl.close();
  }
}

// Run the script
createCustomAdmin();

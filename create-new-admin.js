const axios = require('axios');

// Configuration - Update with your backend URL
const API_BASE_URL = 'http://localhost:5000/api';

async function createNewAdmin() {
  try {
    console.log('🔧 Creating New Admin Account...\n');
    
    // You can modify these details
    const adminData = {
      fullname: "School Administrator",
      username: "schooladmin",
      email: "admin@school.com",
      password: "admin123",
      role: "admin"
    };

    console.log('📝 Admin Details:');
    console.log('   Full Name:', adminData.fullname);
    console.log('   Username:', adminData.username);
    console.log('   Email:', adminData.email);
    console.log('   Password:', adminData.password);
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
  }
}

// Run the script
createNewAdmin();

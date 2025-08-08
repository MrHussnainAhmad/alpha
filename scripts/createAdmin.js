const axios = require('axios');

// Configuration - Update with your backend URL
const API_BASE_URL = 'http://192.168.3.58:5000/api';

async function createAdmin(adminData) {
  try {
    console.log('Creating admin account...');
    console.log('Admin Data:', {
      fullname: adminData.fullname,
      username: adminData.username,
      email: adminData.email,
      role: adminData.role
    });

    const response = await axios.post(`${API_BASE_URL}/admin/signup`, adminData);
    
    console.log('✅ Admin account created successfully!');
    console.log('Response:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create admin account');
    if (error.response) {
      console.error('Error:', error.response.data.message);
      console.error('Status:', error.response.status);
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

// Example usage - Modify these details
async function main() {
  const adminData = {
    fullname: "John Doe",
    username: "johnadmin",
    email: "john@yourschool.com",
    password: "securepassword123",
    role: "admin"
  };

  try {
    await createAdmin(adminData);
    console.log('\n🎉 Admin account is ready!');
    console.log('📧 Email:', adminData.email);
    console.log('🔐 Password:', adminData.password);
    console.log('⚠️  Please change the password after first login');
  } catch (error) {
    console.log('\n💡 Tips:');
    console.log('1. Make sure your backend is running');
    console.log('2. Check if the email is already used');
    console.log('3. Verify the API URL is correct');
  }
}

// Run the script
main();

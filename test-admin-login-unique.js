const axios = require('axios');

// Configuration - Update with your backend URL
const API_BASE_URL = 'http://localhost:5000/api';

async function testAdminCreationAndLogin() {
  try {
    console.log('🧪 Testing Admin Creation and Login...\n');

    // Generate unique credentials using timestamp
    const timestamp = Date.now();
    const adminData = {
      fullname: `Test Admin ${timestamp}`,
      username: `testadmin${timestamp}`,
      email: `testadmin${timestamp}@school.com`,
      password: "testpass123",
      role: "admin"
    };

    // Test 1: Create a new admin
    console.log('1️⃣ Creating new admin account...');
    console.log('   Email:', adminData.email);
    console.log('   Username:', adminData.username);

    const signupResponse = await axios.post(`${API_BASE_URL}/admin/signup`, adminData);
    console.log('✅ Admin created successfully:', signupResponse.data.message);

    // Test 2: Login with the new admin
    console.log('\n2️⃣ Testing login with new admin...');
    const loginResponse = await axios.post(`${API_BASE_URL}/admin/login`, {
      email: adminData.email,
      password: adminData.password
    });
    console.log('✅ New admin login successful:', loginResponse.data.message);
    console.log('   Token received:', loginResponse.data.token ? 'Yes' : 'No');

    // Test 3: Login with default admin
    console.log('\n3️⃣ Testing login with default admin...');
    const defaultLoginResponse = await axios.post(`${API_BASE_URL}/admin/login`, {
      email: "admin@gmail.com",
      password: "123457"
    });
    console.log('✅ Default admin login successful:', defaultLoginResponse.data.message);
    console.log('   Token received:', defaultLoginResponse.data.token ? 'Yes' : 'No');

    // Test 4: Try to login with wrong password
    console.log('\n4️⃣ Testing login with wrong password...');
    try {
      await axios.post(`${API_BASE_URL}/admin/login`, {
        email: adminData.email,
        password: "wrongpassword"
      });
      console.log('❌ This should have failed!');
    } catch (error) {
      console.log('✅ Correctly rejected wrong password:', error.response.data.message);
    }

    console.log('\n🎉 All tests passed! Admin creation and login is working correctly.');
    console.log('\n📝 New Admin Credentials:');
    console.log('   Email:', adminData.email);
    console.log('   Password:', adminData.password);

  } catch (error) {
    console.error('\n❌ Test failed:');
    if (error.response) {
      console.error('Error:', error.response.data.message);
      console.error('Status:', error.response.status);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the test
testAdminCreationAndLogin();

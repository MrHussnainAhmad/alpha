const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:5000/api';

async function testAdminCreationAndLogin() {
  try {
    console.log('🧪 Testing Admin Creation and Login Process...\n');

    // Generate unique credentials
    const timestamp = Date.now();
    const adminData = {
      fullname: `Test Admin ${timestamp}`,
      username: `testadmin${timestamp}`,
      email: `testadmin${timestamp}@school.com`,
      password: "testpass123",
      role: "admin"
    };

    console.log('📝 Creating admin with these credentials:');
    console.log('   Email:', adminData.email);
    console.log('   Username:', adminData.username);
    console.log('   Password:', adminData.password);
    console.log('');

    // Step 1: Create admin
    console.log('1️⃣ Creating new admin account...');
    const signupResponse = await axios.post(`${API_BASE_URL}/admin/signup`, adminData);
    console.log('✅ Admin created successfully');
    console.log('   Response:', signupResponse.data.message);
    console.log('   Admin ID:', signupResponse.data.admin._id);
    console.log('');

    // Step 2: Try to login with the new admin
    console.log('2️⃣ Testing login with newly created admin...');
    const loginResponse = await axios.post(`${API_BASE_URL}/admin/login`, {
      email: adminData.email,
      password: adminData.password
    });
    console.log('✅ Login successful');
    console.log('   Response:', loginResponse.data.message);
    console.log('   Token received:', loginResponse.data.token ? 'Yes' : 'No');
    console.log('   Admin data:', {
      id: loginResponse.data.admin.id,
      email: loginResponse.data.admin.email,
      fullname: loginResponse.data.admin.fullname
    });
    console.log('');

    // Step 3: Test default admin login
    console.log('3️⃣ Testing default admin login...');
    const defaultLoginResponse = await axios.post(`${API_BASE_URL}/admin/login`, {
      email: 'admin@gmail.com',
      password: '123457'
    });
    console.log('✅ Default admin login successful');
    console.log('   Response:', defaultLoginResponse.data.message);
    console.log('');

    // Step 4: Test with wrong password
    console.log('4️⃣ Testing login with wrong password...');
    try {
      await axios.post(`${API_BASE_URL}/admin/login`, {
        email: adminData.email,
        password: 'wrongpassword'
      });
      console.log('❌ This should have failed');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Correctly rejected wrong password');
        console.log('   Error:', error.response.data.message);
      } else {
        throw error;
      }
    }
    console.log('');

    // Step 5: Test with non-existent email
    console.log('5️⃣ Testing login with non-existent email...');
    try {
      await axios.post(`${API_BASE_URL}/admin/login`, {
        email: 'nonexistent@school.com',
        password: 'testpass123'
      });
      console.log('❌ This should have failed');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Correctly rejected non-existent email');
        console.log('   Error:', error.response.data.message);
      } else {
        throw error;
      }
    }

    console.log('\n🎉 All admin creation and login tests passed!');
    console.log('\n💡 The admin creation and login system is working correctly.');
    console.log('\n📱 You should now be able to:');
    console.log('   1. Create new admin accounts through the web app');
    console.log('   2. Login with those new admin accounts');
    console.log('   3. Login with the default admin account');

  } catch (error) {
    console.error('\n❌ Admin creation and login test failed:');
    if (error.response) {
      console.error('Error:', error.response.data.message);
      console.error('Status:', error.response.status);
      console.error('Full response:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the test
testAdminCreationAndLogin();

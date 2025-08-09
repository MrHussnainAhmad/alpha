const axios = require('axios');

// Configuration - Update with your backend URL
const API_BASE_URL = 'http://localhost:5000/api';
const ADMIN_TOKEN = 'your_admin_token_here'; // Get this from admin login

const headers = {
  'Authorization': `Bearer ${ADMIN_TOKEN}`,
  'Content-Type': 'application/json'
};

async function testEndpoints() {
  console.log('🧪 Testing Class and Subject Management Endpoints\n');

  try {
    // Test 1: Get all classes
    console.log('1. Testing GET /api/classes/');
    const classesResponse = await axios.get(`${API_BASE_URL}/classes/`, { headers });
    console.log('✅ Classes fetched:', classesResponse.data.classes?.length || 0, 'classes\n');

    // Test 2: Create a test class
    console.log('2. Testing POST /api/classes/');
    const newClassResponse = await axios.post(`${API_BASE_URL}/classes/`, {
      name: 'Test Class 10 Boys'
    }, { headers });
    console.log('✅ Class created:', newClassResponse.data.class.name);
    const testClassId = newClassResponse.data.class._id;
    console.log('   Class ID:', testClassId, '\n');

    // Test 3: Get verified teachers
    console.log('3. Testing GET /api/admin/verified-teachers');
    const teachersResponse = await axios.get(`${API_BASE_URL}/admin/verified-teachers`, { headers });
    console.log('✅ Verified teachers fetched:', teachersResponse.data.teachers?.length || 0, 'teachers\n');

    // Test 4: Search teachers
    console.log('4. Testing GET /api/admin/search-teachers');
    const searchResponse = await axios.get(`${API_BASE_URL}/admin/search-teachers?q=ali`, { headers });
    console.log('✅ Search results:', searchResponse.data.teachers?.length || 0, 'teachers found\n');

    // Test 5: Get teachers with classes
    console.log('5. Testing GET /api/admin/teachers-with-classes');
    const teachersWithClassesResponse = await axios.get(`${API_BASE_URL}/admin/teachers-with-classes`, { headers });
    console.log('✅ Teachers with classes:', teachersWithClassesResponse.data.teachers?.length || 0, 'teachers\n');

    // Test 6: Test class assignment (if we have teachers)
    const availableTeachers = teachersResponse.data.teachers || [];
    if (availableTeachers.length > 0) {
      const testTeacher = availableTeachers[0];
      console.log('6. Testing POST /api/admin/assign-class');
      console.log('   Assigning class to teacher:', testTeacher.fullname);
      
      try {
        const assignResponse = await axios.post(`${API_BASE_URL}/admin/assign-class`, {
          teacherId: testTeacher._id,
          classId: testClassId
        }, { headers });
        console.log('✅ Class assigned successfully\n');

        // Test 7: Assign subjects
        console.log('7. Testing POST /api/admin/assign-subjects');
        const subjectsResponse = await axios.post(`${API_BASE_URL}/admin/assign-subjects`, {
          teacherId: testTeacher._id,
          subjects: ['Mathematics', 'Physics']
        }, { headers });
        console.log('✅ Subjects assigned successfully\n');

        // Test 8: Unassign class
        console.log('8. Testing POST /api/admin/unassign-class');
        const unassignResponse = await axios.post(`${API_BASE_URL}/admin/unassign-class`, {
          teacherId: testTeacher._id,
          classId: testClassId
        }, { headers });
        console.log('✅ Class unassigned successfully\n');
      } catch (error) {
        console.log('⚠️  Assignment test failed:', error.response?.data?.message || error.message, '\n');
      }
    } else {
      console.log('⚠️  Skipping assignment tests - no verified teachers found\n');
    }

    // Test 9: Get class stats
    console.log('9. Testing GET /api/classes/:id/stats');
    const statsResponse = await axios.get(`${API_BASE_URL}/classes/${testClassId}/stats`, { headers });
    console.log('✅ Class stats:', statsResponse.data.stats);
    console.log('   Teachers:', statsResponse.data.stats.teachers);
    console.log('   Students:', statsResponse.data.stats.students, '\n');

    // Cleanup: Delete test class
    console.log('10. Cleanup - Deleting test class');
    await axios.delete(`${API_BASE_URL}/classes/${testClassId}`, { headers });
    console.log('✅ Test class deleted\n');

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.message || error.message);
    console.error('Status:', error.response?.status);
    console.error('URL:', error.config?.url);
  }
}

// Instructions for running the test
console.log('📋 Test Setup Instructions:');
console.log('1. Make sure your backend server is running (npm start or node index.js)');
console.log('2. Login as admin to get your admin token');
console.log('3. Replace ADMIN_TOKEN variable above with your actual token');
console.log('4. Run this script: node scripts/test-class-subject-endpoints.js');
console.log('5. Make sure you have at least one verified teacher in the system\n');

// Check if token is provided
if (ADMIN_TOKEN === 'your_admin_token_here') {
  console.log('⚠️  Please update the ADMIN_TOKEN variable before running tests\n');
} else {
  // Run tests
  testEndpoints();
}

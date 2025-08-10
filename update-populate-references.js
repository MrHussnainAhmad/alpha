const fs = require('fs');
const path = require('path');

// Read the admin.js file
const adminPath = path.join(__dirname, 'routes', 'admin.js');
let content = fs.readFileSync(adminPath, 'utf8');

// Replace all populate references from 'name' to 'classNumber'
content = content.replace(/populate\('classes', 'name'\)/g, "populate('classes', 'classNumber')");

// Write the updated content back
fs.writeFileSync(adminPath, content, 'utf8');

console.log('Updated all populate references in admin.js');

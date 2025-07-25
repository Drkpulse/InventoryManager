const fs = require('fs');
const path = require('path');

async function testAllFixes() {
  console.log('🧪 Testing All Applied Fixes...\n');
  
  let testsRun = 0;
  let testsPassed = 0;
  
  function runTest(testName, testFn) {
    testsRun++;
    console.log(`${testsRun}. Testing: ${testName}`);
    
    try {
      const result = testFn();
      if (result) {
        testsPassed++;
        console.log('   ✅ PASSED\n');
      } else {
        console.log('   ❌ FAILED\n');
      }
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}\n`);
    }
  }
  
  // Test 1: Check if AJAX middleware exists
  runTest('AJAX Response Middleware Created', () => {
    return fs.existsSync('./src/middleware/ajaxResponse.js');
  });
  
  // Test 2: Check if database migration exists
  runTest('Database Migration Script Created', () => {
    return fs.existsSync('./database/add-missing-columns.sql');
  });
  
  // Test 3: Check if contracts table migration exists
  runTest('Contracts Table Migration Created', () => {
    const migrationContent = fs.readFileSync('./database/add-missing-columns.sql', 'utf8');
    return migrationContent.includes('CREATE TABLE IF NOT EXISTS contracts');
  });
  
  // Test 4: Check if user interface CSS improvements exist
  runTest('User Interface CSS Improvements Created', () => {
    return fs.existsSync('./public/css/user-interface-improvements.css');
  });
  
  // Test 5: Check if validation function has debug statements
  runTest('Debug Statements Added to Validation', () => {
    const itemControllerContent = fs.readFileSync('./src/controllers/itemController.js', 'utf8');
    return itemControllerContent.includes('console.log(\'🔍 Validating item data:\'');
  });
  
  // Test 6: Check if SIM card template is fixed
  runTest('SIM Card Template Fixed', () => {
    const simCreateContent = fs.readFileSync('./src/views/simcards/create.ejs', 'utf8');
    return !simCreateContent.includes('req.query.client_id') && 
           simCreateContent.includes('locals.query && query.client_id');
  });
  
  // Test 7: Check if user controller has enhanced settings
  runTest('User Controller Enhanced with JSON Responses', () => {
    const userControllerContent = fs.readFileSync('./src/controllers/userController.js', 'utf8');
    return userControllerContent.includes('console.log(\'🎨 Updating display settings:\'');
  });
  
  // Test 8: Check if settings form has enhanced JavaScript
  runTest('Settings Form Enhanced with AJAX', () => {
    const settingsContent = fs.readFileSync('./src/views/users/settings.ejs', 'utf8');
    return settingsContent.includes('displaySettingsForm') && 
           settingsContent.includes('X-Requested-With');
  });
  
  // Test 9: Check if admin controller has COALESCE fixes
  runTest('Admin Controller Fixed for Missing Columns', () => {
    const adminControllerContent = fs.readFileSync('./src/controllers/adminController.js', 'utf8');
    return adminControllerContent.includes('COALESCE(active, true)');
  });
  
  // Test 10: Check if software controller has COALESCE fixes
  runTest('Software Controller Fixed for Missing Columns', () => {
    const softwareControllerContent = fs.readFileSync('./src/controllers/softwareController.js', 'utf8');
    return softwareControllerContent.includes('COALESCE(s.description, \'\')') &&
           softwareControllerContent.includes('COALESCE(s.max_licenses, 1)');
  });
  
  // Test 11: Check if layout includes new CSS
  runTest('Layout Template Includes New CSS', () => {
    const layoutContent = fs.readFileSync('./src/views/layout.ejs', 'utf8');
    return layoutContent.includes('user-interface-improvements.css');
  });
  
  // Test 12: Check if startup script exists
  runTest('Startup Fix Script Created', () => {
    return fs.existsSync('./startup-fix.sh');
  });
  
  // Test 13: Check if middleware is added to app.js
  runTest('AJAX Middleware Added to App.js', () => {
    const appContent = fs.readFileSync('./src/app.js', 'utf8');
    return appContent.includes('handleAjaxResponse') &&
           appContent.includes('./middleware/ajaxResponse');
  });
  
  // Test 14: Check if PDA controller has debug statements
  runTest('PDA Controller Enhanced with Debug Statements', () => {
    const pdaControllerContent = fs.readFileSync('./src/controllers/pdaController.js', 'utf8');
    return pdaControllerContent.includes('console.log(\'📱 Loading PDAs page with filters:\'');
  });
  
  // Test Database Connection (if available)
  try {
    const db = require('./src/config/db');
    
    runTest('Database Connection Available', () => {
      // This is just a check if the module loads without error
      return typeof db.query === 'function';
    });
    
    // If DB is available, test some queries
    setTimeout(async () => {
      try {
        await db.query('SELECT 1');
        testsRun++;
        testsPassed++;
        console.log(`${testsRun}. Testing: Database Query Execution`);
        console.log('   ✅ PASSED\n');
        
        // Test if settings column exists
        try {
          await db.query('SELECT settings FROM users LIMIT 1');
          testsRun++;
          testsPassed++;
          console.log(`${testsRun}. Testing: Settings Column Exists`);
          console.log('   ✅ PASSED\n');
        } catch (e) {
          testsRun++;
          console.log(`${testsRun}. Testing: Settings Column Exists`);
          console.log('   ❌ FAILED: Settings column not found\n');
        }
        
        printResults();
      } catch (dbError) {
        testsRun++;
        console.log(`${testsRun}. Testing: Database Query Execution`);
        console.log('   ❌ FAILED: Database not available\n');
        printResults();
      }
    }, 1000);
    
  } catch (dbError) {
    runTest('Database Connection Available', () => {
      console.log('   ⚠️  Database not available for testing');
      return false;
    });
    printResults();
  }
  
  function printResults() {
    console.log('=' .repeat(50));
    console.log(`📊 Test Results: ${testsPassed}/${testsRun} tests passed`);
    
    if (testsPassed === testsRun) {
      console.log('🎉 All tests passed! Fixes appear to be working correctly.');
    } else {
      console.log(`⚠️  ${testsRun - testsPassed} tests failed. Some fixes may need attention.`);
    }
    
    console.log('\n📋 Manual Verification Checklist:');
    console.log('   □ Start the application and check console for errors');
    console.log('   □ Navigate to /items and verify page loads in mainContent');
    console.log('   □ Try creating a new item (should work without description error)');
    console.log('   □ Go to /users/settings and try changing theme');
    console.log('   □ Check that users page loads without "active" column error');
    console.log('   □ Check that software page loads without "description" error');
    console.log('   □ Test AJAX navigation between pages');
    console.log('   □ Verify user menu dropdown styling is improved');
  }
  
  // Don't print results immediately if DB test is running
  if (!fs.existsSync('./src/config/db.js')) {
    printResults();
  }
}

// Run the tests
if (require.main === module) {
  testAllFixes().catch(console.error);
}

module.exports = { testAllFixes };
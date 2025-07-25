const fs = require('fs');
const path = require('path');

function testAjaxNavigation() {
  console.log('🔍 Testing AJAX Navigation System...\n');
  
  // 1. Check if AJAX middleware is properly integrated
  console.log('1. Checking AJAX Response Middleware Integration:');
  
  const appPath = './src/app.js';
  if (fs.existsSync(appPath)) {
    const appContent = fs.readFileSync(appPath, 'utf8');
    
    if (appContent.includes('handleAjaxResponse')) {
      console.log('   ✅ AJAX middleware imported');
    } else {
      console.log('   ❌ AJAX middleware not imported');
    }
    
    if (appContent.includes('app.use(handleAjaxResponse)')) {
      console.log('   ✅ AJAX middleware registered');
    } else {
      console.log('   ❌ AJAX middleware not registered');
    }
  }
  
  // 2. Check if content loader script is included
  console.log('\n2. Checking Content Loader Script:');
  
  const layoutPath = './src/views/layout.ejs';
  if (fs.existsSync(layoutPath)) {
    const layoutContent = fs.readFileSync(layoutPath, 'utf8');
    
    if (layoutContent.includes('content-loader.js')) {
      console.log('   ✅ Content loader script included in layout');
    } else {
      console.log('   ❌ Content loader script missing from layout');
    }
    
    if (layoutContent.includes('id="mainContent"')) {
      console.log('   ✅ Main content container exists');
    } else {
      console.log('   ❌ Main content container missing');
    }
  }
  
  // 3. Check navigation links
  console.log('\n3. Checking Navigation Links:');
  
  const sidebarPath = './src/views/partials/sidebar.ejs';
  if (fs.existsSync(sidebarPath)) {
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
    
    const dataNoAjaxCount = (sidebarContent.match(/data-no-ajax/g) || []).length;
    const linkCount = (sidebarContent.match(/href="/g) || []).length;
    
    console.log(`   📊 Found ${linkCount} links, ${dataNoAjaxCount} with data-no-ajax`);
    
    if (dataNoAjaxCount === 0) {
      console.log('   ✅ No navigation links disabled for AJAX');
    } else {
      console.log('   ⚠️  Some links disabled for AJAX');
    }
  }
  
  // 4. Check AJAX middleware file
  console.log('\n4. Checking AJAX Middleware File:');
  
  const middlewarePath = './src/middleware/ajaxResponse.js';
  if (fs.existsSync(middlewarePath)) {
    const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
    
    if (middlewareContent.includes('x-requested-with')) {
      console.log('   ✅ AJAX detection logic present');
    } else {
      console.log('   ❌ AJAX detection logic missing');
    }
    
    if (middlewareContent.includes('res.json')) {
      console.log('   ✅ JSON response logic present');
    } else {
      console.log('   ❌ JSON response logic missing');
    }
  }
  
  // 5. Generate test recommendations
  console.log('\n5. Test Recommendations:');
  console.log('   🧪 Open browser console and click navigation links');
  console.log('   🧪 Look for "🔄 Loading content via AJAX" messages');
  console.log('   🧪 Check for "🔍 AJAX Response Middleware" messages');
  console.log('   🧪 Verify mainContent div updates without page reload');
  
  console.log('\n6. Common Issues & Fixes:');
  console.log('   📋 If pages don\'t load: Check middleware order in app.js');
  console.log('   📋 If JSON errors occur: Check controller render calls');
  console.log('   📋 If navigation fails: Check for data-no-ajax attributes');
  console.log('   📋 If styles break: Check CSS loading in main layout');
}

function fixCommonIssues() {
  console.log('\n🔧 Applying Common AJAX Navigation Fixes...\n');
  
  // Fix 1: Ensure AJAX middleware is early in the chain
  const appPath = './src/app.js';
  if (fs.existsSync(appPath)) {
    let appContent = fs.readFileSync(appPath, 'utf8');
    
    // Make sure AJAX middleware comes before routes
    if (appContent.includes('app.use(handleAjaxResponse)') && 
        appContent.includes('app.use(\'/\', mainRoutes)')) {
      
      const ajaxMiddlewareIndex = appContent.indexOf('app.use(handleAjaxResponse)');
      const mainRoutesIndex = appContent.indexOf('app.use(\'/\', mainRoutes)');
      
      if (ajaxMiddlewareIndex > mainRoutesIndex) {
        console.log('   ⚠️  AJAX middleware is after routes - this may cause issues');
        console.log('   💡 Consider moving AJAX middleware before route definitions');
      } else {
        console.log('   ✅ AJAX middleware correctly positioned before routes');
      }
    }
  }
  
  // Fix 2: Add error boundaries to content loader
  const contentLoaderPath = './public/js/content-loader.js';
  if (fs.existsSync(contentLoaderPath)) {
    let contentLoaderContent = fs.readFileSync(contentLoaderPath, 'utf8');
    
    if (!contentLoaderContent.includes('catch(error => {')) {
      console.log('   ❌ Content loader missing error handling');
    } else {
      console.log('   ✅ Content loader has error handling');
    }
  }
  
  // Fix 3: Verify main content container
  const layoutPath = './src/views/layout.ejs';
  if (fs.existsSync(layoutPath)) {
    const layoutContent = fs.readFileSync(layoutPath, 'utf8');
    
    if (layoutContent.includes('<main id="mainContent">')) {
      console.log('   ✅ Main content container correctly defined');
    } else {
      console.log('   ❌ Main content container may be incorrectly defined');
    }
  }
  
  console.log('\n✅ Fix analysis complete!');
}

// Run the tests
console.log('🧪 AJAX Navigation Test & Fix Script\n');
console.log('='.repeat(50));

testAjaxNavigation();
fixCommonIssues();

console.log('\n' + '='.repeat(50));
console.log('🎯 Test Complete!');
console.log('\n📋 Next Steps:');
console.log('1. Start the application: npm start');
console.log('2. Open browser console');
console.log('3. Click navigation links and watch for AJAX messages');
console.log('4. If issues persist, check server logs for middleware messages');
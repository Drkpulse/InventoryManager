const fs = require('fs');
const path = require('path');

async function debugAllIssues() {
  console.log('🐛 Comprehensive Debug Analysis\n');
  console.log('='.repeat(50));
  
  // 1. Check all template files for req object usage
  console.log('\n1. 🔍 Template Analysis');
  console.log('-'.repeat(30));
  
  const templateIssues = findTemplateIssues();
  
  // 2. Check controller consistency
  console.log('\n2. 🎮 Controller Analysis');
  console.log('-'.repeat(30));
  
  const controllerIssues = findControllerIssues();
  
  // 3. Check for missing query parameter passing
  console.log('\n3. 📝 Form Parameter Analysis');
  console.log('-'.repeat(30));
  
  const parameterIssues = findParameterIssues();
  
  // 4. Generate fix suggestions
  console.log('\n4. 💡 Fix Suggestions');
  console.log('-'.repeat(30));
  
  generateFixSuggestions(templateIssues, controllerIssues, parameterIssues);
  
  // 5. Test database connectivity
  console.log('\n5. 🗄️ Database Connectivity');
  console.log('-'.repeat(30));
  
  await testDatabaseConnectivity();
  
  console.log('\n' + '='.repeat(50));
  console.log('🎯 Debug Analysis Complete');
}

function findTemplateIssues() {
  const issues = [];
  const viewsDir = './src/views';
  
  function scanDirectory(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (entry.name.endsWith('.ejs')) {
          scanTemplate(fullPath);
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Could not scan directory: ${dir}`);
    }
  }
  
  function scanTemplate(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for direct req usage in EJS
        if (line.includes('req.') && line.includes('<%') && !line.includes('<script')) {
          issues.push({
            type: 'template',
            file: path.relative('.', filePath),
            line: index + 1,
            content: line.trim(),
            severity: 'high'
          });
        }
        
        // Check for missing locals checks
        if (line.includes('formData.') && !line.includes('locals.formData')) {
          issues.push({
            type: 'template',
            file: path.relative('.', filePath),
            line: index + 1,
            content: line.trim(),
            severity: 'medium'
          });
        }
      });
    } catch (error) {
      console.log(`   ⚠️  Could not read template: ${filePath}`);
    }
  }
  
  scanDirectory(viewsDir);
  
  if (issues.length === 0) {
    console.log('   ✅ No template issues found');
  } else {
    console.log(`   ❌ Found ${issues.length} template issues:`);
    issues.forEach(issue => {
      console.log(`      ${issue.file}:${issue.line} - ${issue.content.substring(0, 60)}...`);
    });
  }
  
  return issues;
}

function findControllerIssues() {
  const issues = [];
  const controllersDir = './src/controllers';
  
  try {
    const controllers = fs.readdirSync(controllersDir);
    
    for (const controller of controllers) {
      if (controller.endsWith('.js')) {
        try {
          const content = fs.readFileSync(path.join(controllersDir, controller), 'utf8');
          
          // Check if create forms pass query parameters
          if (content.includes('createForm') || content.includes('Create')) {
            if (!content.includes('query: req.query')) {
              issues.push({
                type: 'controller',
                file: controller,
                issue: 'Create form method may not be passing query parameters',
                severity: 'medium'
              });
            }
          }
          
          // Check for inconsistent user object passing
          if (content.includes('user: req.user') && content.includes('user: req.session.user')) {
            issues.push({
              type: 'controller',
              file: controller,
              issue: 'Inconsistent user object source (req.user vs req.session.user)',
              severity: 'low'
            });
          }
          
        } catch (error) {
          console.log(`   ⚠️  Could not read controller: ${controller}`);
        }
      }
    }
  } catch (error) {
    console.log('   ⚠️  Could not scan controllers directory');
  }
  
  if (issues.length === 0) {
    console.log('   ✅ No controller issues found');
  } else {
    console.log(`   ❌ Found ${issues.length} controller issues:`);
    issues.forEach(issue => {
      console.log(`      ${issue.file} - ${issue.issue}`);
    });
  }
  
  return issues;
}

function findParameterIssues() {
  const issues = [];
  
  // Check for specific known problematic patterns
  const problematicFiles = [
    'src/views/pdas/create.ejs',
    'src/views/printers/create.ejs',
    'src/views/simcards/create.ejs'
  ];
  
  problematicFiles.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        
        if (content.includes('req.query')) {
          issues.push({
            type: 'parameter',
            file: path.relative('.', file),
            issue: 'Still contains req.query usage',
            severity: 'high'
          });
        }
        
        if (content.includes('locals.query && query.') || content.includes('query.client_id')) {
          // This is good - it's been fixed
        } else if (content.includes('client_id')) {
          issues.push({
            type: 'parameter',
            file: path.relative('.', file),
            issue: 'May need query parameter handling for client selection',
            severity: 'medium'
          });
        }
      } catch (error) {
        issues.push({
          type: 'parameter',
          file: file,
          issue: 'Could not read file',
          severity: 'low'
        });
      }
    }
  });
  
  if (issues.length === 0) {
    console.log('   ✅ No parameter issues found');
  } else {
    console.log(`   ❌ Found ${issues.length} parameter issues:`);
    issues.forEach(issue => {
      console.log(`      ${issue.file} - ${issue.issue}`);
    });
  }
  
  return issues;
}

function generateFixSuggestions(templateIssues, controllerIssues, parameterIssues) {
  const allIssues = [...templateIssues, ...controllerIssues, ...parameterIssues];
  
  if (allIssues.length === 0) {
    console.log('   🎉 No issues found! System appears to be working correctly.');
    return;
  }
  
  console.log('   📋 Recommended Actions:');
  
  const highSeverity = allIssues.filter(i => i.severity === 'high');
  const mediumSeverity = allIssues.filter(i => i.severity === 'medium');
  
  if (highSeverity.length > 0) {
    console.log('\n   🚨 HIGH PRIORITY FIXES:');
    highSeverity.forEach((issue, index) => {
      console.log(`      ${index + 1}. Fix ${issue.file}`);
      if (issue.type === 'template') {
        console.log(`         Replace direct req usage with locals variables`);
      }
    });
  }
  
  if (mediumSeverity.length > 0) {
    console.log('\n   ⚠️  MEDIUM PRIORITY FIXES:');
    mediumSeverity.forEach((issue, index) => {
      console.log(`      ${index + 1}. ${issue.file} - ${issue.issue}`);
    });
  }
  
  console.log('\n   🛠️  Quick Fix Commands:');
  console.log('      node fix-template-issues.js    # Auto-fix template issues');
  console.log('      node test-fixes.js             # Verify all fixes');
  console.log('      ./startup-fix.sh               # Apply database fixes and start');
}

async function testDatabaseConnectivity() {
  try {
    const db = require('./src/config/db');
    
    // Test basic connectivity
    await db.query('SELECT 1 as test');
    console.log('   ✅ Database connection: OK');
    
    // Test if required columns exist
    const tests = [
      { table: 'users', column: 'active', description: 'Users active column' },
      { table: 'users', column: 'settings', description: 'Users settings column' },
      { table: 'software', column: 'description', description: 'Software description column' },
      { table: 'software', column: 'max_licenses', description: 'Software max_licenses column' },
      { table: 'items', column: 'description', description: 'Items description column' }
    ];
    
    for (const test of tests) {
      try {
        await db.query(`SELECT ${test.column} FROM ${test.table} LIMIT 1`);
        console.log(`   ✅ ${test.description}: OK`);
      } catch (error) {
        console.log(`   ❌ ${test.description}: MISSING`);
      }
    }
    
  } catch (error) {
    console.log('   ❌ Database connection: FAILED');
    console.log(`      Error: ${error.message}`);
    console.log('      Run: ./startup-fix.sh to fix database issues');
  }
}

// Run the debug analysis
if (require.main === module) {
  debugAllIssues().catch(console.error);
}

module.exports = { debugAllIssues };
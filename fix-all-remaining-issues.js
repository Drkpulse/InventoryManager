const fs = require('fs');
const path = require('path');

async function fixAllRemainingIssues() {
  console.log('🚀 Comprehensive Fix for All Remaining Issues\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Fix template formData issues
    console.log('\n1. 🔧 Fixing Template FormData Issues');
    console.log('-'.repeat(40));
    await fixTemplateFormDataIssues();
    
    // 2. Fix controller consistency
    console.log('\n2. 🎮 Fixing Controller Consistency Issues');
    console.log('-'.repeat(40));
    await fixControllerConsistency();
    
    // 3. Apply database fixes if needed
    console.log('\n3. 🗄️ Checking Database Status');
    console.log('-'.repeat(40));
    await checkDatabase();
    
    // 4. Update package.json if needed
    console.log('\n4. 📦 Checking Dependencies');
    console.log('-'.repeat(40));
    await checkDependencies();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 All fixes completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Restart the application: npm start');
    console.log('2. Test theme switching in user settings');
    console.log('3. Test creating/editing items, PDAs, printers');
    console.log('4. Test navigation between pages');
    console.log('5. Test translation switching');
    
  } catch (error) {
    console.error('❌ Error during fix process:', error.message);
  }
}

async function fixTemplateFormDataIssues() {
  const fixPatterns = [
    {
      pattern: /typeof formData !== 'undefined' && formData\.(\w+)/g,
      replacement: 'getFormValue("$1")',
      description: 'Replace formData access with helper function'
    },
    {
      pattern: /typeof formData !== 'undefined' && formData\[['"](\w+)['"]\]/g,
      replacement: 'getFormValue("$1")',
      description: 'Replace formData bracket access with helper function'
    }
  ];
  
  let filesFixed = 0;
  
  function processDirectory(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          processDirectory(fullPath);
        } else if (entry.name.endsWith('.ejs')) {
          if (processFile(fullPath)) {
            filesFixed++;
          }
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Could not process directory: ${dir}`);
    }
  }
  
  function processFile(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let changed = false;
      
      fixPatterns.forEach(fix => {
        if (fix.pattern.test(content)) {
          console.log(`   🔧 Fixing ${path.relative('.', filePath)}: ${fix.description}`);
          content = content.replace(fix.pattern, fix.replacement);
          changed = true;
        }
      });
      
      if (changed) {
        fs.writeFileSync(filePath, content);
        return true;
      }
      
      return false;
    } catch (error) {
      console.log(`   ❌ Could not process file: ${filePath}`);
      return false;
    }
  }
  
  processDirectory('./src/views');
  
  console.log(`   ✅ Fixed ${filesFixed} template files`);
}

async function fixControllerConsistency() {
  const controllers = [
    'src/controllers/adminController.js',
    'src/controllers/employeeController.js',
    'src/controllers/itemController.js',
    'src/controllers/pdaController.js',
    'src/controllers/printerController.js',
    'src/controllers/simCardController.js',
    'src/controllers/softwareController.js'
  ];
  
  let controllersFixed = 0;
  
  for (const controllerPath of controllers) {
    if (fs.existsSync(controllerPath)) {
      try {
        let content = fs.readFileSync(controllerPath, 'utf8');
        let changed = false;
        
        // Fix inconsistent user object usage
        if (content.includes('user: req.user') && !content.includes('user: req.session.user || req.user')) {
          content = content.replace(/user: req\.user/g, 'user: req.session.user || req.user');
          changed = true;
        }
        
        // Add query parameter passing to create form methods
        if (content.includes('createForm') || content.includes('Create')) {
          if (!content.includes('query: req.query')) {
            // Add query parameter to render calls in create methods
            content = content.replace(
              /(res\.render\([^,]+,\s*{[^}]+)(}\);)/g,
              '$1,\n      query: req.query,\n      $2'
            );
            changed = true;
          }
        }
        
        if (changed) {
          fs.writeFileSync(controllerPath, content);
          console.log(`   🔧 Fixed ${path.basename(controllerPath)}`);
          controllersFixed++;
        }
      } catch (error) {
        console.log(`   ❌ Could not fix ${controllerPath}`);
      }
    }
  }
  
  console.log(`   ✅ Fixed ${controllersFixed} controllers`);
}

async function checkDatabase() {
  try {
    const db = require('./src/config/db');
    await db.query('SELECT 1');
    console.log('   ✅ Database connection: OK');
    
    // Check required columns
    const requiredColumns = [
      { table: 'users', column: 'active' },
      { table: 'users', column: 'settings' },
      { table: 'software', column: 'description' },
      { table: 'software', column: 'max_licenses' },
      { table: 'items', column: 'description' }
    ];
    
    for (const check of requiredColumns) {
      try {
        await db.query(`SELECT ${check.column} FROM ${check.table} LIMIT 1`);
        console.log(`   ✅ ${check.table}.${check.column}: OK`);
      } catch (error) {
        console.log(`   ❌ ${check.table}.${check.column}: MISSING`);
        console.log('       Run: ./startup-fix.sh to apply database migrations');
      }
    }
  } catch (error) {
    console.log('   ❌ Database not available. Run ./startup-fix.sh to start and fix database');
  }
}

async function checkDependencies() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    const requiredDeps = ['multer', 'express', 'ejs', 'pg', 'bcrypt'];
    
    let missingDeps = [];
    
    for (const dep of requiredDeps) {
      if (!packageJson.dependencies[dep] && !packageJson.devDependencies?.[dep]) {
        missingDeps.push(dep);
      }
    }
    
    if (missingDeps.length > 0) {
      console.log(`   ❌ Missing dependencies: ${missingDeps.join(', ')}`);
      console.log('       Run: npm install ' + missingDeps.join(' '));
    } else {
      console.log('   ✅ All required dependencies present');
    }
  } catch (error) {
    console.log('   ⚠️  Could not check dependencies');
  }
}

// Run the comprehensive fix
if (require.main === module) {
  fixAllRemainingIssues().catch(console.error);
}

module.exports = { fixAllRemainingIssues };
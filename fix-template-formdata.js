const fs = require('fs');
const path = require('path');

function fixTemplateFormDataIssues() {
  console.log('🔧 Fixing template formData issues...\n');
  
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
    },
    {
      pattern: /formData\.(\w+)/g,
      replacement: 'getFormValue("$1")',
      description: 'Replace direct formData access with helper function'
    }
  ];
  
  let filesFixed = 0;
  let totalReplacements = 0;
  
  function processDirectory(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          processDirectory(fullPath);
        } else if (entry.name.endsWith('.ejs')) {
          const replacements = processFile(fullPath);
          if (replacements > 0) {
            filesFixed++;
            totalReplacements += replacements;
          }
        }
      }
    } catch (error) {
      console.log(`❌ Could not process directory: ${dir}`);
    }
  }
  
  function processFile(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let replacements = 0;
      
      fixPatterns.forEach(fix => {
        const matches = content.match(fix.pattern);
        if (matches) {
          console.log(`🔧 Fixing ${path.relative('.', filePath)}: ${fix.description} (${matches.length} occurrences)`);
          content = content.replace(fix.pattern, fix.replacement);
          replacements += matches.length;
        }
      });
      
      if (replacements > 0) {
        fs.writeFileSync(filePath, content);
      }
      
      return replacements;
    } catch (error) {
      console.log(`❌ Could not process file: ${filePath}`);
      return 0;
    }
  }
  
  processDirectory('./src/views');
  
  console.log(`\n✅ Fixed ${filesFixed} template files with ${totalReplacements} total replacements`);
  
  if (totalReplacements > 0) {
    console.log('\n📋 Next steps:');
    console.log('1. Update controllers to pass formData when rendering templates with validation errors');
    console.log('2. Test form validation to ensure formData is preserved correctly');
    console.log('3. Run the application to verify all templates work correctly');
  }
}

// Manual pattern fixes for specific cases
function applyManualFixes() {
  console.log('\n🔧 Applying manual fixes for specific patterns...');
  
  const manualFixes = [
    {
      file: 'src/views/users/settings.ejs',
      search: 'for (let [key, value] of formData.entries()) {',
      replace: '// FormData entries are handled by fetch'
    }
  ];
  
  manualFixes.forEach(fix => {
    if (fs.existsSync(fix.file)) {
      try {
        let content = fs.readFileSync(fix.file, 'utf8');
        if (content.includes(fix.search)) {
          content = content.replace(fix.search, fix.replace);
          fs.writeFileSync(fix.file, content);
          console.log(`✅ Applied manual fix to ${fix.file}`);
        }
      } catch (error) {
        console.log(`❌ Could not apply manual fix to ${fix.file}`);
      }
    }
  });
}

// Run the fixes
if (require.main === module) {
  fixTemplateFormDataIssues();
  applyManualFixes();
  
  console.log('\n🎉 Template fixes completed!');
  console.log('Run `node test-fixes.js` to verify everything works correctly.');
}

module.exports = { fixTemplateFormDataIssues, applyManualFixes };
const fs = require('fs');
const path = require('path');

function findAndFixTemplateIssues() {
  console.log('🔍 Searching for template issues...\n');
  
  const viewsDir = './src/views';
  const issues = [];
  
  function scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.name.endsWith('.ejs')) {
        scanFile(fullPath);
      }
    }
  }
  
  function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Look for req.query usage in EJS tags (not in script tags)
      if (line.includes('req.query') && 
          line.includes('<%') && 
          !line.includes('<script') &&
          !isInScriptBlock(lines, index)) {
        
        issues.push({
          file: filePath,
          line: index + 1,
          content: line.trim(),
          issue: 'Direct req.query usage in EJS template'
        });
      }
      
      // Look for req.params usage
      if (line.includes('req.params') && 
          line.includes('<%') && 
          !line.includes('<script') &&
          !isInScriptBlock(lines, index)) {
        
        issues.push({
          file: filePath,
          line: index + 1,
          content: line.trim(),
          issue: 'Direct req.params usage in EJS template'
        });
      }
      
      // Look for req.body usage
      if (line.includes('req.body') && 
          line.includes('<%') && 
          !line.includes('<script') &&
          !isInScriptBlock(lines, index)) {
        
        issues.push({
          file: filePath,
          line: index + 1,
          content: line.trim(),
          issue: 'Direct req.body usage in EJS template'
        });
      }
    });
  }
  
  function isInScriptBlock(lines, currentIndex) {
    // Check if we're inside a <script> block
    let inScript = false;
    
    for (let i = 0; i <= currentIndex; i++) {
      if (lines[i].includes('<script')) {
        inScript = true;
      }
      if (lines[i].includes('</script>')) {
        inScript = false;
      }
    }
    
    return inScript;
  }
  
  scanDirectory(viewsDir);
  
  if (issues.length === 0) {
    console.log('✅ No template issues found!');
    return;
  }
  
  console.log(`❌ Found ${issues.length} template issues:\n`);
  
  issues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue.file}:${issue.line}`);
    console.log(`   Issue: ${issue.issue}`);
    console.log(`   Content: ${issue.content}`);
    console.log('');
  });
  
  console.log('💡 Recommended fixes:');
  console.log('   - Replace req.query with locals.query (and pass query in controller)');
  console.log('   - Replace req.params with locals.params (and pass params in controller)');
  console.log('   - Replace req.body with locals.formData (and pass formData in controller)');
  console.log('   - Make sure controllers pass these values in render options');
}

// Auto-fix function for common patterns
function autoFixTemplates() {
  console.log('\n🔧 Attempting to auto-fix common issues...\n');
  
  const fixPatterns = [
    {
      pattern: /\(req\.query\.(\w+)/g,
      replacement: '(locals.query && query.$1',
      description: 'Replace req.query.* with locals.query check'
    },
    {
      pattern: /req\.query\.(\w+)/g,
      replacement: '(locals.query ? query.$1 : "")',
      description: 'Replace standalone req.query.* with safe access'
    }
  ];
  
  let filesFixed = 0;
  
  function processDirectory(dir) {
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
  }
  
  function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    fixPatterns.forEach(fix => {
      if (fix.pattern.test(content)) {
        console.log(`🔧 Fixing ${filePath}: ${fix.description}`);
        content = content.replace(fix.pattern, fix.replacement);
        changed = true;
      }
    });
    
    if (changed) {
      fs.writeFileSync(filePath, content);
      return true;
    }
    
    return false;
  }
  
  processDirectory('./src/views');
  
  console.log(`\n✅ Fixed ${filesFixed} template files`);
}

// Run both functions
if (require.main === module) {
  findAndFixTemplateIssues();
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('\n🤔 Would you like to attempt auto-fixes? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      autoFixTemplates();
    }
    rl.close();
  });
}

module.exports = { findAndFixTemplateIssues, autoFixTemplates };
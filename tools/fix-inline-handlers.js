#!/usr/bin/env node

/**
 * Script to identify and fix inline event handlers in EJS templates
 * This helps resolve Content Security Policy violations
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const VIEWS_DIR = path.join(__dirname, '../src/views');

// Common inline event handlers to find
const INLINE_HANDLERS = [
  'onclick',
  'onchange',
  'onsubmit',
  'onfocus',
  'onblur',
  'onload',
  'onkeyup',
  'onkeydown'
];

function findInlineHandlers() {
  console.log('🔍 Scanning for inline event handlers...\n');

  const ejsFiles = glob.sync('**/*.ejs', { cwd: VIEWS_DIR });
  let totalIssues = 0;

  ejsFiles.forEach(file => {
    const filePath = path.join(VIEWS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    let fileIssues = 0;

    lines.forEach((line, index) => {
      INLINE_HANDLERS.forEach(handler => {
        if (line.includes(`${handler}="`)) {
          console.log(`📄 ${file}:${index + 1}`);
          console.log(`   ${handler} found: ${line.trim()}`);
          console.log('');
          fileIssues++;
          totalIssues++;
        }
      });
    });

    if (fileIssues === 0) {
      console.log(`✅ ${file} - No inline handlers found`);
    }
  });

  console.log(`\n📊 Summary: Found ${totalIssues} inline event handlers in ${ejsFiles.length} files\n`);

  if (totalIssues > 0) {
    console.log('💡 Recommendations:');
    console.log('   1. Replace onclick="func()" with id="elementId" and addEventListener');
    console.log('   2. Move inline scripts to external files or use event delegation');
    console.log('   3. Use data attributes for parameters instead of inline JavaScript');
    console.log('   4. Consider using a frontend framework for better event handling\n');
  }
}

if (require.main === module) {
  findInlineHandlers();
}

module.exports = { findInlineHandlers };

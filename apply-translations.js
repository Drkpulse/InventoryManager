const fs = require('fs');
const path = require('path');

// Common translations to apply across templates
const translationMappings = [
  // Navigation and common elements
  { search: '>Dashboard<', replace: '><%= t("nav.dashboard") %><' },
  { search: '>Assets<', replace: '><%= t("nav.items") %><' },
  { search: '>Employees<', replace: '><%= t("nav.employees") %><' },
  { search: '>Software<', replace: '><%= t("nav.software") %><' },
  { search: '>Reports<', replace: '><%= t("nav.reports") %><' },
  { search: '>Administration<', replace: '><%= t("nav.admin") %><' },
  { search: '>Settings<', replace: '><%= t("nav.settings") %><' },
  
  // Common buttons and actions
  { search: '>Save<', replace: '><%= t("common.save") %><' },
  { search: '>Cancel<', replace: '><%= t("common.cancel") %><' },
  { search: '>Delete<', replace: '><%= t("common.delete") %><' },
  { search: '>Edit<', replace: '><%= t("common.edit") %><' },
  { search: '>View<', replace: '><%= t("common.view") %><' },
  { search: '>Add<', replace: '><%= t("common.add") %><' },
  { search: '>Create<', replace: '><%= t("common.create") %><' },
  { search: '>Update<', replace: '><%= t("common.update") %><' },
  { search: '>Search<', replace: '><%= t("common.search") %><' },
  { search: '>Export<', replace: '><%= t("common.export") %><' },
  
  // Form labels
  { search: '>Name<', replace: '><%= t("items.name") %><' },
  { search: '>Email<', replace: '><%= t("employees.email") %><' },
  { search: '>Status<', replace: '><%= t("items.status") %><' },
  { search: '>Type<', replace: '><%= t("items.type") %><' },
  { search: '>Brand<', replace: '><%= t("items.brand") %><' },
  { search: '>Model<', replace: '><%= t("items.model") %><' },
  { search: '>Serial Number<', replace: '><%= t("items.serial_number") %><' },
  { search: '>Price<', replace: '><%= t("items.price") %><' },
  { search: '>Description<', replace: '><%= t("items.description") %><' },
  
  // Status values
  { search: '>Active<', replace: '><%= t("status.active") %><' },
  { search: '>Inactive<', replace: '><%= t("status.inactive") %><' },
  { search: '>Available<', replace: '><%= t("status.available") %><' },
  { search: '>Assigned<', replace: '><%= t("status.assigned") %><' },
  { search: '>Under Maintenance<', replace: '><%= t("status.maintenance") %><' },
  { search: '>Retired<', replace: '><%= t("status.retired") %><' },
  { search: '>Damaged<', replace: '><%= t("status.damaged") %><' }
];

function applyTranslationsToFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    translationMappings.forEach(mapping => {
      if (content.includes(mapping.search)) {
        content = content.replace(new RegExp(mapping.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), mapping.replace);
        changed = true;
      }
    });
    
    if (changed) {
      fs.writeFileSync(filePath, content);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

function processDirectory(dir) {
  let filesProcessed = 0;
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        filesProcessed += processDirectory(fullPath);
      } else if (entry.name.endsWith('.ejs')) {
        if (applyTranslationsToFile(fullPath)) {
          console.log(`✅ Applied translations to: ${path.relative('.', fullPath)}`);
          filesProcessed++;
        }
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${dir}:`, error.message);
  }
  
  return filesProcessed;
}

function updateLayoutForTranslations() {
  const layoutPath = 'src/views/layout.ejs';
  
  try {
    let content = fs.readFileSync(layoutPath, 'utf8');
    
    // Add language attribute to html tag
    if (!content.includes('lang="<%= currentLanguage %>')) {
      content = content.replace(
        '<html lang="en">',
        '<html lang="<%= currentLanguage || "en" %>">'
      );
    }
    
    // Update navigation items
    const navTranslations = [
      { search: 'Dashboard', replace: '<%= t("nav.dashboard") %>' },
      { search: 'My Profile', replace: '<%= t("nav.profile") %>' },
      { search: 'Settings', replace: '<%= t("nav.settings") %>' },
      { search: 'Logout', replace: '<%= t("nav.logout") %>' }
    ];
    
    navTranslations.forEach(nav => {
      // Only replace if not already translated
      if (content.includes(`>${nav.search}<`) && !content.includes(nav.replace)) {
        content = content.replace(`>${nav.search}<`, `>${nav.replace}<`);
      }
    });
    
    fs.writeFileSync(layoutPath, content);
    console.log('✅ Updated layout.ejs with translations');
  } catch (error) {
    console.error('Error updating layout:', error.message);
  }
}

function addTranslationKeysToUtils() {
  const utilsPath = 'src/utils/translations.js';
  
  try {
    let content = fs.readFileSync(utilsPath, 'utf8');
    
    // Add missing translation keys
    const additionalKeys = {
      en: {
        'nav.profile': 'My Profile',
        'nav.logout': 'Logout',
        'items.assign': 'Assign',
        'items.unassign': 'Unassign',
        'items.history': 'History',
        'actions.print_label': 'Print Label',
        'actions.edit_details': 'Edit Details',
        'actions.view_history': 'View History'
      },
      'pt-PT': {
        'nav.profile': 'Meu Perfil',
        'nav.logout': 'Sair',
        'items.assign': 'Atribuir',
        'items.unassign': 'Remover Atribuição',
        'items.history': 'Histórico',
        'actions.print_label': 'Imprimir Etiqueta',
        'actions.edit_details': 'Editar Detalhes',
        'actions.view_history': 'Ver Histórico'
      }
    };
    
    // Insert additional keys before the closing braces
    Object.keys(additionalKeys).forEach(lang => {
      const langSection = `'${lang}': {`;
      const insertionPoint = content.indexOf(langSection);
      
      if (insertionPoint !== -1) {
        const closingBrace = content.indexOf('\n  }', insertionPoint);
        if (closingBrace !== -1) {
          const keysToAdd = Object.entries(additionalKeys[lang])
            .map(([key, value]) => `     '${key}': '${value}',`)
            .join('\n');
          
          content = content.slice(0, closingBrace) + 
                   ',\n     \n     // Additional keys\n' + 
                   keysToAdd + 
                   content.slice(closingBrace);
        }
      }
    });
    
    fs.writeFileSync(utilsPath, content);
    console.log('✅ Added additional translation keys');
  } catch (error) {
    console.error('Error updating translations:', error.message);
  }
}

console.log('🌍 Applying translations across the website...\n');

// Process all EJS templates
const viewsDir = 'src/views';
const filesProcessed = processDirectory(viewsDir);

// Update layout specifically
updateLayoutForTranslations();

// Add missing translation keys
addTranslationKeysToUtils();

console.log(`\n✅ Translation application complete!`);
console.log(`📊 Files processed: ${filesProcessed}`);
console.log('\n📋 Next steps:');
console.log('1. Test the application with different languages');
console.log('2. Add more specific translations as needed');
console.log('3. Verify all translated elements render correctly');

if (filesProcessed > 0) {
  console.log('\n⚠️  Note: Some translations are generic. You may want to review and make them more specific to context.');
}
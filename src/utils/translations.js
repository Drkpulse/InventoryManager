// Translation system for the inventory management system

const translations = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.items': 'Assets',
    'nav.employees': 'Employees',
    'nav.software': 'Software',
    'nav.reports': 'Reports',
    'nav.admin': 'Administration',
    'nav.settings': 'Settings',
    
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.view': 'View',
    'common.add': 'Add',
    'common.create': 'Create',
    'common.update': 'Update',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.export': 'Export',
    'common.import': 'Import',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.loading': 'Loading...',
    'common.success': 'Success',
    'common.error': 'Error',
    'common.warning': 'Warning',
    'common.info': 'Information',
    
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.total_assets': 'Total Assets',
    'dashboard.total_employees': 'Total Employees',
    'dashboard.unassigned_assets': 'Unassigned Assets',
    'dashboard.recent_activity': 'Recent Activity',
    
    // Assets/Items
    'items.title': 'Asset Management',
    'items.add_new': 'Add New Asset',
    'items.asset_id': 'Asset ID',
    'items.name': 'Asset Name',
    'items.type': 'Type',
    'items.brand': 'Brand',
    'items.model': 'Model',
    'items.serial_number': 'Serial Number',
    'items.assigned_to': 'Assigned To',
    'items.status': 'Status',
    'items.price': 'Price',
    'items.description': 'Description',
    'items.date_acquired': 'Date Acquired',
    'items.receipt': 'Receipt',
    
    // Employees
    'employees.title': 'Employee Management',
    'employees.add_new': 'Add New Employee',
    'employees.name': 'Name',
    'employees.email': 'Email',
    'employees.employee_id': 'Employee ID',
    'employees.department': 'Department',
    'employees.location': 'Location',
    'employees.join_date': 'Join Date',
    'employees.status': 'Status',
    
    // Software
    'software.title': 'Software Management',
    'software.add_new': 'Add New Software',
    'software.name': 'Software Name',
    'software.version': 'Version',
    'software.vendor': 'Vendor',
    'software.license_type': 'License Type',
    'software.cost_per_license': 'Cost per License',
    'software.max_licenses': 'Max Licenses',
    'software.assigned_licenses': 'Assigned Licenses',
    
    // User Settings
    'settings.title': 'User Settings',
    'settings.display': 'Display Settings',
    'settings.theme': 'Theme',
    'settings.language': 'Language',
    'settings.timezone': 'Timezone',
    'settings.items_per_page': 'Items per Page',
    'settings.notifications': 'Notification Settings',
    'settings.security': 'Security Settings',
    'settings.save_success': 'Settings saved successfully!',
    
    // Themes
    'theme.light': 'Light Mode',
    'theme.dark': 'Dark Mode',
    'theme.auto': 'Auto (System)',
    
    // Languages
    'lang.en': 'English',
    'lang.pt-PT': 'Português (Portugal)',
    'lang.es': 'Español',
    'lang.fr': 'Français',
    
    // Messages
    'msg.no_data': 'No data available',
    'msg.loading_error': 'Error loading data',
    'msg.save_success': 'Saved successfully',
    'msg.delete_confirm': 'Are you sure you want to delete this item?',
    'msg.delete_success': 'Item deleted successfully',
    'msg.update_success': 'Item updated successfully',
    'msg.create_success': 'Item created successfully',
    
    // Validation
    'validation.required': 'This field is required',
    'validation.email': 'Please enter a valid email address',
    'validation.numeric': 'Please enter a valid number',
    'validation.date': 'Please enter a valid date',
    
    // Status
    'status.active': 'Active',
    'status.inactive': 'Inactive',
    'status.assigned': 'Assigned',
    'status.unassigned': 'Unassigned',
    'status.available': 'Available',
    'status.maintenance': 'Under Maintenance',
    'status.retired': 'Retired',
    'status.damaged': 'Damaged'
  },
  
  'pt-PT': {
    // Navigation
    'nav.dashboard': 'Painel',
    'nav.items': 'Ativos',
    'nav.employees': 'Funcionários',
    'nav.software': 'Software',
    'nav.reports': 'Relatórios',
    'nav.admin': 'Administração',
    'nav.settings': 'Definições',
    
    // Common
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.view': 'Ver',
    'common.add': 'Adicionar',
    'common.create': 'Criar',
    'common.update': 'Atualizar',
    'common.search': 'Pesquisar',
    'common.filter': 'Filtrar',
    'common.export': 'Exportar',
    'common.import': 'Importar',
    'common.yes': 'Sim',
    'common.no': 'Não',
    'common.loading': 'A carregar...',
    'common.success': 'Sucesso',
    'common.error': 'Erro',
    'common.warning': 'Aviso',
    'common.info': 'Informação',
    
    // Dashboard
    'dashboard.title': 'Painel de Controlo',
    'dashboard.total_assets': 'Total de Ativos',
    'dashboard.total_employees': 'Total de Funcionários',
    'dashboard.unassigned_assets': 'Ativos Não Atribuídos',
    'dashboard.recent_activity': 'Atividade Recente',
    
    // Assets/Items
    'items.title': 'Gestão de Ativos',
    'items.add_new': 'Adicionar Novo Ativo',
    'items.asset_id': 'ID do Ativo',
    'items.name': 'Nome do Ativo',
    'items.type': 'Tipo',
    'items.brand': 'Marca',
    'items.model': 'Modelo',
    'items.serial_number': 'Número de Série',
    'items.assigned_to': 'Atribuído a',
    'items.status': 'Estado',
    'items.price': 'Preço',
    'items.description': 'Descrição',
    'items.date_acquired': 'Data de Aquisição',
    'items.receipt': 'Recibo',
    
    // Employees
    'employees.title': 'Gestão de Funcionários',
    'employees.add_new': 'Adicionar Novo Funcionário',
    'employees.name': 'Nome',
    'employees.email': 'Email',
    'employees.employee_id': 'ID do Funcionário',
    'employees.department': 'Departamento',
    'employees.location': 'Localização',
    'employees.join_date': 'Data de Entrada',
    'employees.status': 'Estado',
    
    // Software
    'software.title': 'Gestão de Software',
    'software.add_new': 'Adicionar Novo Software',
    'software.name': 'Nome do Software',
    'software.version': 'Versão',
    'software.vendor': 'Fornecedor',
    'software.license_type': 'Tipo de Licença',
    'software.cost_per_license': 'Custo por Licença',
    'software.max_licenses': 'Licenças Máximas',
    'software.assigned_licenses': 'Licenças Atribuídas',
    
    // User Settings
    'settings.title': 'Definições de Utilizador',
    'settings.display': 'Definições de Visualização',
    'settings.theme': 'Tema',
    'settings.language': 'Idioma',
    'settings.timezone': 'Fuso Horário',
    'settings.items_per_page': 'Itens por Página',
    'settings.notifications': 'Definições de Notificações',
    'settings.security': 'Definições de Segurança',
    'settings.save_success': 'Definições guardadas com sucesso!',
    
    // Themes
    'theme.light': 'Modo Claro',
    'theme.dark': 'Modo Escuro',
    'theme.auto': 'Automático (Sistema)',
    
    // Languages
    'lang.en': 'Inglês',
    'lang.pt-PT': 'Português (Portugal)',
    'lang.es': 'Espanhol',
    'lang.fr': 'Francês',
    
    // Messages
    'msg.no_data': 'Sem dados disponíveis',
    'msg.loading_error': 'Erro ao carregar dados',
    'msg.save_success': 'Guardado com sucesso',
    'msg.delete_confirm': 'Tem a certeza que pretende eliminar este item?',
    'msg.delete_success': 'Item eliminado com sucesso',
    'msg.update_success': 'Item atualizado com sucesso',
    'msg.create_success': 'Item criado com sucesso',
    
    // Validation
    'validation.required': 'Este campo é obrigatório',
    'validation.email': 'Por favor introduza um endereço de email válido',
    'validation.numeric': 'Por favor introduza um número válido',
    'validation.date': 'Por favor introduza uma data válida',
    
    // Status
    'status.active': 'Ativo',
    'status.inactive': 'Inativo',
    'status.assigned': 'Atribuído',
    'status.unassigned': 'Não Atribuído',
    'status.available': 'Disponível',
    'status.maintenance': 'Em Manutenção',
    'status.retired': 'Retirado',
    'status.damaged': 'Danificado'
  }
};

// Helper function to get translation
function t(key, lang = 'en', params = {}) {
  let translation = translations[lang]?.[key] || translations['en'][key] || key;
  
  // Replace parameters in translation
  Object.keys(params).forEach(param => {
    translation = translation.replace(`{${param}}`, params[param]);
  });
  
  return translation;
}

// Helper function to get user's preferred language
function getUserLanguage(user) {
  return user?.settings?.language || 'en';
}

// Helper function to get available languages
function getAvailableLanguages() {
  return Object.keys(translations);
}

module.exports = {
  translations,
  t,
  getUserLanguage,
  getAvailableLanguages
};

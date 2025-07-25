/**
 * Middleware for handling language preferences and translations
 */

// Define translations
const translations = {
  'en': {
    // General
    'app_name': 'Inventory Manager',
    'dashboard': 'Dashboard',
    'items': 'Items',
    'employees': 'Employees',
    'departments': 'Departments',
    'reports': 'Reports',
    'settings': 'Settings',
    'logout': 'Log Out',
    'search': 'Search',
    'save': 'Save',
    'cancel': 'Cancel',
    'edit': 'Edit',
    'delete': 'Delete',
    'view': 'View',
    'add_new': 'Add New',
    'back': 'Back',

    // Items
    'add_item': 'Add Item',
    'edit_item': 'Edit Item',
    'assign_item': 'Assign Item',
    'unassign_item': 'Unassign Item',
    'item_name': 'Name',
    'item_id': 'ID',
    'item_type': 'Type',
    'item_brand': 'Brand',
    'item_model': 'Model',
    'item_price': 'Price',

    // Employees
    'add_employee': 'Add Employee',
    'edit_employee': 'Edit Employee',
    'employee_name': 'Name',
    'employee_id': 'ID',
    'employee_email': 'Email',
    'employee_department': 'Department',

    // Reports
    'assets_by_employee': 'Assets by Employee',
    'unassigned_assets': 'Unassigned Assets',
    'purchase_history': 'Purchase History',
    'export_csv': 'Export to CSV',
    'asset_details': 'Asset Details',
    'items': 'Items',
    'total_value': 'Total Value',
    'asset_types': 'Asset Types',
    'actions': 'Actions',
    'no_employee_asset_data': 'No employee asset data available',

    // Settings
    'display_settings': 'Display Settings',
    'security_settings': 'Security Settings',
    'language': 'Language',
    'theme': 'Theme',
    'light_mode': 'Light Mode',
    'dark_mode': 'Dark Mode',
    'current_password': 'Current Password',
    'new_password': 'New Password',
    'confirm_password': 'Confirm New Password',
    'password_updated': 'Password updated successfully',
    'settings_updated': 'Settings updated successfully',
    'show_notifications': 'Show desktop notifications'
  },
  'pt-PT': {
    // General
    'app_name': 'Gestor de Inventário',
    'dashboard': 'Painel',
    'items': 'Artigos',
    'employees': 'Funcionários',
    'departments': 'Departamentos',
    'reports': 'Relatórios',
    'settings': 'Configurações',
    'logout': 'Sair',
    'search': 'Pesquisar',
    'save': 'Guardar',
    'cancel': 'Cancelar',
    'edit': 'Editar',
    'delete': 'Eliminar',
    'view': 'Ver',
    'add_new': 'Adicionar Novo',
    'back': 'Voltar',

    // Items
    'add_item': 'Adicionar Artigo',
    'edit_item': 'Editar Artigo',
    'assign_item': 'Atribuir Artigo',
    'unassign_item': 'Remover Atribuição',
    'item_name': 'Nome',
    'item_id': 'ID',
    'item_type': 'Tipo',
    'item_brand': 'Marca',
    'item_model': 'Modelo',
    'item_price': 'Preço',

    // Employees
    'add_employee': 'Adicionar Funcionário',
    'edit_employee': 'Editar Funcionário',
    'employee_name': 'Nome',
    'employee_id': 'ID',
    'employee_email': 'Email',
    'employee_department': 'Departamento',

    // Reports
    'assets_by_employee': 'Ativos por Funcionário',
    'unassigned_assets': 'Ativos Não Atribuídos',
    'purchase_history': 'Histórico de Compras',
    'export_csv': 'Exportar para CSV',
    'asset_details': 'Detalhes do Ativo',
    'items': 'Itens',
    'total_value': 'Valor Total',
    'asset_types': 'Tipos de Ativo',
    'actions': 'Ações',
    'no_employee_asset_data': 'Nenhum dado de ativo de funcionário disponível',

    // Settings
    'display_settings': 'Configurações de Exibição',
    'security_settings': 'Configurações de Segurança',
    'language': 'Idioma',
    'theme': 'Tema',
    'light_mode': 'Modo Claro',
    'dark_mode': 'Modo Escuro',
    'current_password': 'Senha Atual',
    'new_password': 'Nova Senha',
    'confirm_password': 'Confirmar Nova Senha',
    'password_updated': 'Senha atualizada com sucesso',
    'settings_updated': 'Configurações atualizadas com sucesso',
    'show_notifications': 'Mostrar notificações'
  }
};

/**
 * Get translation for a key
 *
 * @param {string} key - The translation key
 * @param {string} lang - Language code
 * @returns {string} - The translated string or key if not found
 */
function translate(key, lang = 'en') {
  const language = translations[lang] || translations.en;
  return language[key] || key;
}

/**
 * Middleware function to set up translations
 */
function languageMiddleware(req, res, next) {
  // Get user's language preference from session
  const userLang = (req.session?.user?.settings?.language) || 'en';

  // Add translation function to response locals
  res.locals.t = (key) => translate(key, userLang);
  res.locals.currentLanguage = userLang;

  // Add supported languages to locals
  res.locals.supportedLanguages = Object.keys(translations);

  next();
}

module.exports = languageMiddleware;

/**
 * Translation utility for multi-language support
 */
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
    'actions': 'Actions',

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
    'serial_number': 'Serial Number',
    'date_acquired': 'Date Acquired',
    'total_items': 'Total Items',

    // Employees
    'add_employee': 'Add Employee',
    'edit_employee': 'Edit Employee',
    'employee_name': 'Name',
    'employee_id': 'ID',
    'employee_email': 'Email',
    'employee_department': 'Department',
    'assign_to': 'Assign To',
    'joined_date': 'Joined Date',
    'left_date': 'Left Date',

    // Reports
    'assets_by_employee': 'Assets by Employee',
    'assets_by_department': 'Assets by Department',
    'unassigned_assets': 'Unassigned Assets',
    'purchase_history': 'Purchase History',
    'export_csv': 'Export to CSV',
    'total_value': 'Total Value',
    'asset_types': 'Asset Types',
    'asset_details': 'Asset Details',
    'items': 'Items',
    'no_employee_asset_data': 'No employee asset data available.',
    'no_items_found': 'No items found.',

    // Settings
    'display_settings': 'Display Settings',
    'notification_settings': 'Notification Settings',
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
    'show_notifications': 'Show notifications'
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
    'actions': 'Ações',

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
    'serial_number': 'Número de Série',
    'date_acquired': 'Data de Aquisição',
    'total_items': 'Total de Itens',

    // Employees
    'add_employee': 'Adicionar Funcionário',
    'edit_employee': 'Editar Funcionário',
    'employee_name': 'Nome',
    'employee_id': 'ID',
    'employee_email': 'Email',
    'employee_department': 'Departamento',
    'assign_to': 'Atribuir a',
    'joined_date': 'Data de Entrada',
    'left_date': 'Data de Saída',

    // Reports
    'assets_by_employee': 'Ativos por Funcionário',
    'assets_by_department': 'Ativos por Departamento',
    'unassigned_assets': 'Ativos Não Atribuídos',
    'purchase_history': 'Histórico de Compras',
    'export_csv': 'Exportar para CSV',
    'total_value': 'Valor Total',
    'asset_types': 'Tipos de Ativos',
    'asset_details': 'Detalhes do Ativo',
    'items': 'Itens',
    'no_employee_asset_data': 'Não existem dados de ativos de funcionários disponíveis.',
    'no_items_found': 'Nenhum item encontrado.',

    // Settings
    'display_settings': 'Configurações de Visualização',
    'notification_settings': 'Configurações de Notificação',
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
 * Get a translation string in the specified language
 *
 * @param {string} key - Translation key
 * @param {string} lang - Language code (en, pt-PT)
 * @returns {string} - Translated string or key if not found
 */
function translate(key, lang = 'en') {
  if (!key) return '';
  const langData = translations[lang] || translations['en'];
  return langData[key] || key;
}

module.exports = {
  translate,
  supportedLanguages: ['en', 'pt-PT']
};

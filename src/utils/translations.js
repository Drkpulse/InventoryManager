/**
 * Enhanced translation utility for multi-language support
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
    'loading': 'Loading...',
    'error': 'Error',
    'success': 'Success',
    'warning': 'Warning',
    'info': 'Information',
    'confirm': 'Confirm',
    'yes': 'Yes',
    'no': 'No',

    // Navigation
    'home': 'Home',
    'profile': 'Profile',
    'administration': 'Administration',
    'user_management': 'User Management',
    'system_settings': 'System Settings',

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
    'assigned_to': 'Assigned To',
    'status': 'Status',
    'location': 'Location',
    'notes': 'Notes',

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
    'active_employees': 'Active Employees',
    'total_employees': 'Total Employees',

    // Software
    'software': 'Software',
    'software_licenses': 'Software Licenses',
    'add_software': 'Add Software',
    'software_name': 'Software Name',
    'version': 'Version',
    'license_type': 'License Type',
    'cost_per_license': 'Cost per License',
    'vendor': 'Vendor',
    'license_key': 'License Key',
    'expiry_date': 'Expiry Date',

    // Reports
    'assets_by_employee': 'Assets by Employee',
    'assets_by_department': 'Assets by Department',
    'unassigned_assets': 'Unassigned Assets',
    'purchase_history': 'Purchase History',
    'export_csv': 'Export to CSV',
    'total_value': 'Total Value',
    'asset_types': 'Asset Types',
    'asset_details': 'Asset Details',
    'no_employee_asset_data': 'No employee asset data available.',
    'no_items_found': 'No items found.',

    // Settings
    'user_settings': 'User Settings',
    'display_settings': 'Display Settings',
    'notification_settings': 'Notification Settings',
    'security_settings': 'Security Settings',
    'language': 'Language',
    'theme': 'Theme',
    'light_mode': 'Light Mode',
    'dark_mode': 'Dark Mode',
    'auto_mode': 'Auto (System)',
    'timezone': 'Timezone',
    'items_per_page': 'Items per Page',
    'current_password': 'Current Password',
    'new_password': 'New Password',
    'confirm_password': 'Confirm New Password',
    'password_updated': 'Password updated successfully',
    'settings_updated': 'Settings updated successfully',
    'show_notifications': 'Show notifications',
    'email_notifications': 'Email Notifications',
    'browser_notifications': 'Browser Notifications',
    'maintenance_alerts': 'Maintenance Alerts',
    'assignment_notifications': 'Assignment Notifications',
    'session_timeout': 'Auto-logout after inactivity',
    'two_factor_auth': 'Two-Factor Authentication',

    // Clients and equipment
    'clients': 'Clients',
    'printers': 'Printers',
    'pdas': 'PDAs',
    'sim_cards': 'SIM Cards',
    'client_name': 'Client Name',
    'client_id': 'Client ID',
    'supplier': 'Supplier',
    'model': 'Model',
    'cost': 'Cost',
    'monthly_cost': 'Monthly Cost',
    'carrier': 'Carrier',
    'sim_number': 'SIM Number',

    // Notifications
    'notifications': 'Notifications',
    'mark_as_read': 'Mark as Read',
    'mark_all_read': 'Mark All as Read',
    'no_notifications': 'No notifications',
    'new_notification': 'New Notification',

    // Time and dates
    'today': 'Today',
    'yesterday': 'Yesterday',
    'last_week': 'Last Week',
    'last_month': 'Last Month',
    'created_at': 'Created At',
    'updated_at': 'Updated At'
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
    'loading': 'A carregar...',
    'error': 'Erro',
    'success': 'Sucesso',
    'warning': 'Aviso',
    'info': 'Informação',
    'confirm': 'Confirmar',
    'yes': 'Sim',
    'no': 'Não',

    // Navigation
    'home': 'Início',
    'profile': 'Perfil',
    'administration': 'Administração',
    'user_management': 'Gestão de Utilizadores',
    'system_settings': 'Configurações do Sistema',

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
    'assigned_to': 'Atribuído a',
    'status': 'Estado',
    'location': 'Localização',
    'notes': 'Notas',

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
    'active_employees': 'Funcionários Ativos',
    'total_employees': 'Total de Funcionários',

    // Software
    'software': 'Software',
    'software_licenses': 'Licenças de Software',
    'add_software': 'Adicionar Software',
    'software_name': 'Nome do Software',
    'version': 'Versão',
    'license_type': 'Tipo de Licença',
    'cost_per_license': 'Custo por Licença',
    'vendor': 'Fornecedor',
    'license_key': 'Chave de Licença',
    'expiry_date': 'Data de Expiração',

    // Reports
    'assets_by_employee': 'Ativos por Funcionário',
    'assets_by_department': 'Ativos por Departamento',
    'unassigned_assets': 'Ativos Não Atribuídos',
    'purchase_history': 'Histórico de Compras',
    'export_csv': 'Exportar para CSV',
    'total_value': 'Valor Total',
    'asset_types': 'Tipos de Ativos',
    'asset_details': 'Detalhes do Ativo',
    'no_employee_asset_data': 'Não existem dados de ativos de funcionários disponíveis.',
    'no_items_found': 'Nenhum item encontrado.',

    // Settings
    'user_settings': 'Configurações do Utilizador',
    'display_settings': 'Configurações de Visualização',
    'notification_settings': 'Configurações de Notificação',
    'security_settings': 'Configurações de Segurança',
    'language': 'Idioma',
    'theme': 'Tema',
    'light_mode': 'Modo Claro',
    'dark_mode': 'Modo Escuro',
    'auto_mode': 'Automático (Sistema)',
    'timezone': 'Fuso Horário',
    'items_per_page': 'Itens por Página',
    'current_password': 'Senha Atual',
    'new_password': 'Nova Senha',
    'confirm_password': 'Confirmar Nova Senha',
    'password_updated': 'Senha atualizada com sucesso',
    'settings_updated': 'Configurações atualizadas com sucesso',
    'show_notifications': 'Mostrar notificações',
    'email_notifications': 'Notificações por Email',
    'browser_notifications': 'Notificações do Navegador',
    'maintenance_alerts': 'Alertas de Manutenção',
    'assignment_notifications': 'Notificações de Atribuição',
    'session_timeout': 'Logout automático após inatividade',
    'two_factor_auth': 'Autenticação de Dois Fatores',

    // Clients and equipment
    'clients': 'Clientes',
    'printers': 'Impressoras',
    'pdas': 'PDAs',
    'sim_cards': 'Cartões SIM',
    'client_name': 'Nome do Cliente',
    'client_id': 'ID do Cliente',
    'supplier': 'Fornecedor',
    'model': 'Modelo',
    'cost': 'Custo',
    'monthly_cost': 'Custo Mensal',
    'carrier': 'Operadora',
    'sim_number': 'Número do SIM',

    // Notifications
    'notifications': 'Notificações',
    'mark_as_read': 'Marcar como Lida',
    'mark_all_read': 'Marcar Todas como Lidas',
    'no_notifications': 'Sem notificações',
    'new_notification': 'Nova Notificação',

    // Time and dates
    'today': 'Hoje',
    'yesterday': 'Ontem',
    'last_week': 'Semana Passada',
    'last_month': 'Mês Passado',
    'created_at': 'Criado em',
    'updated_at': 'Atualizado em'
  },

  'es': {
    // General
    'app_name': 'Gestor de Inventario',
    'dashboard': 'Panel',
    'items': 'Artículos',
    'employees': 'Empleados',
    'departments': 'Departamentos',
    'reports': 'Informes',
    'settings': 'Configuración',
    'logout': 'Cerrar Sesión',
    'search': 'Buscar',
    'save': 'Guardar',
    'cancel': 'Cancelar',
    'edit': 'Editar',
    'delete': 'Eliminar',
    'view': 'Ver',
    'add_new': 'Añadir Nuevo',
    'back': 'Volver',
    'actions': 'Acciones',
    'loading': 'Cargando...',
    'error': 'Error',
    'success': 'Éxito',
    'warning': 'Advertencia',
    'info': 'Información',
    'confirm': 'Confirmar',
    'yes': 'Sí',
    'no': 'No',

    // Navigation
    'home': 'Inicio',
    'profile': 'Perfil',
    'administration': 'Administración',
    'user_management': 'Gestión de Usuarios',
    'system_settings': 'Configuración del Sistema',

    // Settings
    'user_settings': 'Configuración del Usuario',
    'display_settings': 'Configuración de Pantalla',
    'notification_settings': 'Configuración de Notificaciones',
    'security_settings': 'Configuración de Seguridad',
    'language': 'Idioma',
    'theme': 'Tema',
    'light_mode': 'Modo Claro',
    'dark_mode': 'Modo Oscuro',
    'auto_mode': 'Automático (Sistema)',
    'timezone': 'Zona Horaria',
    'items_per_page': 'Elementos por Página',
    'settings_updated': 'Configuración actualizada correctamente'
  },

  'fr': {
    // General
    'app_name': 'Gestionnaire d\'Inventaire',
    'dashboard': 'Tableau de Bord',
    'items': 'Articles',
    'employees': 'Employés',
    'departments': 'Départements',
    'reports': 'Rapports',
    'settings': 'Paramètres',
    'logout': 'Se Déconnecter',
    'search': 'Rechercher',
    'save': 'Sauvegarder',
    'cancel': 'Annuler',
    'edit': 'Modifier',
    'delete': 'Supprimer',
    'view': 'Voir',
    'add_new': 'Ajouter Nouveau',
    'back': 'Retour',
    'actions': 'Actions',
    'loading': 'Chargement...',
    'error': 'Erreur',
    'success': 'Succès',
    'warning': 'Avertissement',
    'info': 'Information',
    'confirm': 'Confirmer',
    'yes': 'Oui',
    'no': 'Non',

    // Navigation
    'home': 'Accueil',
    'profile': 'Profil',
    'administration': 'Administration',
    'user_management': 'Gestion des Utilisateurs',
    'system_settings': 'Paramètres Système',

    // Settings
    'user_settings': 'Paramètres Utilisateur',
    'display_settings': 'Paramètres d\'Affichage',
    'notification_settings': 'Paramètres de Notification',
    'security_settings': 'Paramètres de Sécurité',
    'language': 'Langue',
    'theme': 'Thème',
    'light_mode': 'Mode Clair',
    'dark_mode': 'Mode Sombre',
    'auto_mode': 'Automatique (Système)',
    'timezone': 'Fuseau Horaire',
    'items_per_page': 'Éléments par Page',
    'settings_updated': 'Paramètres mis à jour avec succès'
  }
};

/**
 * Get a translation string in the specified language
 *
 * @param {string} key - Translation key
 * @param {string} lang - Language code (en, pt-PT, es, fr)
 * @returns {string} - Translated string or key if not found
 */
function translate(key, lang = 'en') {
  if (!key) return '';
  const langData = translations[lang] || translations['en'];
  return langData[key] || key;
}

/**
 * Get all translations for a specific language
 *
 * @param {string} lang - Language code
 * @returns {object} - All translations for the language
 */
function getLanguageTranslations(lang = 'en') {
  return translations[lang] || translations['en'];
}

/**
 * Check if a language is supported
 *
 * @param {string} lang - Language code to check
 * @returns {boolean} - Whether the language is supported
 */
function isLanguageSupported(lang) {
  return supportedLanguages.includes(lang);
}

/**
 * Get the language name in its native form
 *
 * @param {string} lang - Language code
 * @returns {string} - Language name
 */
function getLanguageName(lang) {
  const languageNames = {
    'en': 'English',
    'pt-PT': 'Português',
    'es': 'Español',
    'fr': 'Français'
  };
  return languageNames[lang] || lang;
}

/**
 * Format a translation key with parameters
 *
 * @param {string} key - Translation key
 * @param {object} params - Parameters to replace in the translation
 * @param {string} lang - Language code
 * @returns {string} - Formatted translation
 */
function translateWithParams(key, params = {}, lang = 'en') {
  let translation = translate(key, lang);

  // Replace parameters in the format {{param}}
  Object.keys(params).forEach(param => {
    const regex = new RegExp(`{{${param}}}`, 'g');
    translation = translation.replace(regex, params[param]);
  });

  return translation;
}

module.exports = {
  translate,
  getLanguageTranslations,
  isLanguageSupported,
  getLanguageName,
  translateWithParams,
  supportedLanguages: ['en', 'pt-PT', 'es', 'fr']
};

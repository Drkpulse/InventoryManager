# IT Asset Manager - Roles & Permissions System Deployment Guide

## 🚀 Quick Start

### 1. Run the Enhanced Migration

```bash
# Make sure you're in the project root directory
node migrations/run_roles_permissions_migration.js
```

This will:
- Create all necessary tables (permissions, roles, role_permissions, user_roles)
- Add the new **Developer** role with full system access
- Create comprehensive permissions for all modules
- Assign proper roles to existing users
- Set up database functions for permission checking

### 2. Update Your Files

Replace/update these files with the enhanced versions:

- `src/middleware/permissions.js` - Enhanced permission middleware
- `src/controllers/authController.js` - Updated login with permission loading
- `src/controllers/adminController.js` - Complete admin functionality
- `src/views/partials/sidebar.ejs` - Permission-aware sidebar
- `migrations/add_roles_permissions.sql` - Enhanced SQL migration
- `migrations/run_roles_permissions_migration.js` - Enhanced migration script

### 3. Verify Your App.js Setup

Make sure your `src/app.js` includes the permission middleware:

```javascript
const { loadUserPermissions, addPermissionHelpers } = require('./middleware/permissions');

// Add these AFTER session setup but BEFORE routes
app.use(loadUserPermissions);  // Load user permissions into session
app.use(addPermissionHelpers); // Add permission helper functions to templates
```

## 🔐 Role System Overview

### System Roles (Cannot be deleted)

1. **Developer** 🟣
   - Full system access including debug tools
   - Database migrations and console access
   - Performance monitoring
   - All standard admin permissions

2. **Super Administrator** 🔴
   - Full system access (except developer tools)
   - User and role management
   - All business functionality

3. **Administrator** 🟠
   - Most permissions except sensitive ones
   - Cannot delete roles or access database tools

4. **Regular User** 🔵
   - Basic view permissions
   - Standard user access

### Custom Roles

- **Manager** 🟡 - Management level access without delete permissions
- **Viewer** 🟢 - Read-only access to most modules

## 🧪 Testing the System

### 1. Test User Login and Permission Loading

```bash
# Check logs during login to see permissions being loaded
tail -f logs/app.log
```

### 2. Test Permission Functions in Database

```sql
-- Test permission checking
SELECT user_has_permission(1, 'users.view');

-- Get user permissions
SELECT * FROM get_user_permissions(1);

-- Get user roles
SELECT * FROM get_user_roles(1);

-- View comprehensive user summary
SELECT * FROM user_permissions_summary WHERE user_id = 1;
```

### 3. Test Frontend Permission Helpers

In any EJS template, you can now use:

```html
<!-- Check single permission -->
<% if (can('users.create')) { %>
  <button>Create User</button>
<% } %>

<!-- Check multiple permissions (any) -->
<% if (canAny(['users.edit', 'users.delete'])) { %>
  <div>User Actions</div>
<% } %>

<!-- Check if user has role -->
<% if (hasRole('developer')) { %>
  <div>Developer Tools</div>
<% } %>

<!-- Check if user is admin -->
<% if (isAdmin()) { %>
  <div>Admin Panel</div>
<% } %>
```

### 4. Test Route Protection

```javascript
// In your routes
const { hasPermission, hasRole, hasAnyPermission } = require('../middleware/permissions');

// Protect routes with specific permissions
router.get('/users', hasPermission('users.view'), userController.list);
router.post('/users', hasPermission('users.create'), userController.create);

// Protect with role
router.get('/dev-tools', hasRole('developer'), devController.tools);

// Protect with any of multiple permissions
router.get('/reports', hasAnyPermission(['reports.view', 'admin.logs']), reportController.index);
```

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Session secret for security
SESSION_SECRET=your-super-secret-session-key-change-this

# Database connection
DATABASE_URL=postgresql://username:password@localhost:5432/it_asset_manager

# Enable debug mode for developers
DEBUG_MODE=false

# Permission cache timeout (in milliseconds)
PERMISSION_CACHE_TIMEOUT=300000
```

### Admin User Setup

After migration, make sure you have an admin user:

```sql
-- Create first admin user if needed
INSERT INTO users (name, email, password, role)
VALUES ('Admin User', 'admin@example.com', '$2b$10$hashedpassword', 'admin');

-- Assign developer role to specific user (replace email)
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT u.id, r.id, 1
FROM users u, roles r
WHERE u.email = 'your-dev-email@example.com'
AND r.name = 'developer';
```

## 🚨 Troubleshooting

### Common Issues

1. **Permissions not loading**
   ```bash
   # Check if middleware is properly set up
   grep -n "loadUserPermissions" src/app.js
   ```

2. **Database functions missing**
   ```sql
   -- Check if functions exist
   SELECT routine_name FROM information_schema.routines
   WHERE routine_type = 'FUNCTION'
   AND routine_name LIKE '%permission%';
   ```

3. **User roles not assigned**
   ```sql
   -- Check user roles
   SELECT u.name, r.display_name
   FROM users u
   LEFT JOIN user_roles ur ON u.id = ur.user_id
   LEFT JOIN roles r ON ur.role_id = r.id
   ORDER BY u.name;
   ```

4. **Session issues**
   ```javascript
   // Check session configuration in app.js
   app.use(session({
     secret: process.env.SESSION_SECRET || 'change-this-secret',
     resave: false,
     saveUninitialized: false,
     cookie: {
       maxAge: 24 * 60 * 60 * 1000, // 24 hours
       secure: false // Set to true in production with HTTPS
     }
   }));
   ```

### Debug Mode

Enable debug logging by setting `DEBUG_MODE=true` in your environment:

```javascript
// Add to your logging middleware
if (process.env.DEBUG_MODE === 'true') {
  console.log('Permission check:', {
    user: req.session.user?.name,
    permission: permissionName,
    hasPermission: result
  });
}
```

## 📊 Performance Considerations

### Permission Caching

The system caches user permissions for 5 minutes to reduce database queries:

```javascript
// Permissions are reloaded when:
// 1. User logs in
// 2. 5 minutes have passed since last load
// 3. Explicitly refreshed via /auth/refresh-permissions
```

### Database Indexes

The migration creates these indexes for performance:

```sql
-- Indexes created automatically
CREATE INDEX idx_permissions_name ON permissions(name);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
```

## 🔄 Migration Rollback

If you need to rollback the migration:

```sql
-- WARNING: This will remove all roles and permissions data
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP FUNCTION IF EXISTS user_has_permission CASCADE;
DROP FUNCTION IF EXISTS get_user_permissions CASCADE;
DROP FUNCTION IF EXISTS get_user_roles CASCADE;
DROP VIEW IF EXISTS user_permissions_summary CASCADE;
```

## 🎯 Next Steps

1. **Test thoroughly** - Try all admin functions with different user roles
2. **Update your routes** - Add permission checks to all sensitive routes
3. **Customize permissions** - Add/modify permissions as needed for your specific use case
4. **Set up logging** - Implement proper audit logging for permission changes
5. **Add API endpoints** - Create REST API endpoints with permission checking

## 📝 Permission Naming Convention

Follow this pattern for consistent permission naming:

- `module.action` - e.g., `users.view`, `items.create`
- `admin.feature` - e.g., `admin.settings`, `admin.logs`
- `dev.tool` - e.g., `dev.console`, `dev.migrations`

## 🛡️ Security Best Practices

1. **Never store plain text permissions** - Always use the database functions
2. **Check permissions server-side** - Frontend checks are for UX only
3. **Use principle of least privilege** - Give users minimum required permissions
4. **Regular audits** - Review user permissions periodically
5. **Secure sessions** - Use strong session secrets and HTTPS in production

---

🎉 **Congratulations!** Your IT Asset Manager now has a comprehensive role-based permission system with Developer access and enhanced security.

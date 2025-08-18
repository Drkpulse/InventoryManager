const { Pool } = require('pg');
require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'inventory_db',
};

async function initializeDatabase() {
  const pool = new Pool(dbConfig);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- FUNCTIONS ---
    await client.query(`DROP FUNCTION IF EXISTS calculate_warranty_end_date;`);
    await client.query(`
      CREATE FUNCTION calculate_warranty_end_date() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
          IF NEW.warranty_start_date IS NOT NULL AND NEW.warranty_months IS NOT NULL THEN
              NEW.warranty_end_date := NEW.warranty_start_date + (NEW.warranty_months || ' months')::INTERVAL;
          END IF;
          RETURN NEW;
      END;
      $$;
    `);

    await client.query(`DROP FUNCTION IF EXISTS create_default_notification_settings;`);
    await client.query(`
      CREATE FUNCTION create_default_notification_settings() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO notification_settings (user_id, type_id, enabled, email_enabled, browser_enabled)
        SELECT
          NEW.id as user_id,
          nt.id as type_id,
          TRUE as enabled,
          FALSE as email_enabled,
          TRUE as browser_enabled
        FROM notification_types nt;

        INSERT INTO notifications (type_id, user_id, title, message, data) VALUES
        ((SELECT id FROM notification_types WHERE name = 'system_welcome'),
         NEW.id,
         'Welcome to the Inventory System!',
         'Hello ' || NEW.name || '! Welcome to our inventory management system. You can manage your assets and receive important notifications here.',
         jsonb_build_object('welcome_type', 'new_user', 'user_name', NEW.name));

        RETURN NEW;
      END;
      $$;
    `);

    await client.query(`DROP FUNCTION IF EXISTS create_notification_settings_for_new_type;`);
    await client.query(`
      CREATE FUNCTION create_notification_settings_for_new_type() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO notification_settings (user_id, type_id, enabled, email_enabled, browser_enabled)
        SELECT
          u.id as user_id,
          NEW.id as type_id,
          TRUE as enabled,
          FALSE as email_enabled,
          TRUE as browser_enabled
        FROM users u;

        RETURN NEW;
      END;
      $$;
    `);

    await client.query(`DROP FUNCTION IF EXISTS find_user_by_login;`);
    await client.query(`
      CREATE FUNCTION find_user_by_login(login_input text)
      RETURNS TABLE(id integer, name varchar, email varchar, password varchar, role varchar, cep_id varchar, last_login timestamp, created_at timestamp, updated_at timestamp)
      LANGUAGE plpgsql AS $$
      BEGIN
        RETURN QUERY
        SELECT u.id, u.name, u.email, u.password, u.role, u.cep_id, u.last_login, u.created_at, u.updated_at
        FROM users u
        WHERE LOWER(u.email) = LOWER(login_input)
           OR LOWER(u.cep_id) = LOWER(login_input)
        LIMIT 1;
      END;
      $$;
    `);

    await client.query(`DROP FUNCTION IF EXISTS get_user_permissions;`);
    await client.query(`
      CREATE FUNCTION get_user_permissions(user_id_param integer)
      RETURNS TABLE(permission_name varchar, display_name varchar, module varchar)
      LANGUAGE plpgsql AS $$
      BEGIN
        RETURN QUERY
        SELECT DISTINCT p.name, p.display_name, p.module
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = user_id_param
        ORDER BY p.module, p.display_name;
      END;
      $$;
    `);

    await client.query(`DROP FUNCTION IF EXISTS get_user_roles;`);
    await client.query(`
      CREATE FUNCTION get_user_roles(user_id_param integer)
      RETURNS TABLE(role_id integer, role_name varchar, display_name varchar, description text)
      LANGUAGE plpgsql AS $$
      BEGIN
        RETURN QUERY
        SELECT r.id, r.name, r.display_name, r.description
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = user_id_param
        ORDER BY r.display_name;
      END;
      $$;
    `);

    await client.query(`DROP FUNCTION IF EXISTS update_license_updated_at;`);
    await client.query(`
      CREATE FUNCTION update_license_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$;
    `);

    await client.query(`DROP FUNCTION IF EXISTS update_updated_at_column;`);
    await client.query(`
      CREATE FUNCTION update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$;
    `);

    await client.query(`DROP FUNCTION IF EXISTS user_has_permission;`);
    await client.query(`
      CREATE FUNCTION user_has_permission(user_id_param integer, permission_name_param varchar)
      RETURNS bool LANGUAGE plpgsql AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1
          FROM user_roles ur
          JOIN role_permissions rp ON ur.role_id = rp.role_id
          JOIN permissions p ON rp.permission_id = p.id
          WHERE ur.user_id = user_id_param
          AND p.name = permission_name_param
        );
      END;
      $$;
    `);

    await client.query(`DROP FUNCTION IF EXISTS user_has_role;`);
    await client.query(`
      CREATE FUNCTION user_has_role(user_id_param integer, role_name_param varchar)
      RETURNS bool LANGUAGE plpgsql AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = user_id_param
          AND r.name = role_name_param
        );
      END;
      $$;
    `);

    // --- SEQUENCES, TABLES, INDEXES, TRIGGERS, CONSTRAINTS ---
    // For brevity, only a few tables are shown here. Repeat for all tables as in your SQL file.
    // You can copy-paste the DDL from your SQL dump into the appropriate await client.query() calls.

    // Example: users table
    await client.query(`DROP TABLE IF EXISTS users CASCADE; DROP SEQUENCE IF EXISTS users_id_seq;`);
    await client.query(`
      CREATE SEQUENCE users_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;
      CREATE TABLE users (
        id integer DEFAULT nextval('users_id_seq') NOT NULL,
        name varchar(255) NOT NULL,
        email varchar(255) NOT NULL,
        password varchar(255) NOT NULL,
        role varchar(50) DEFAULT 'user',
        last_login timestamp,
        created_at timestamp DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp DEFAULT CURRENT_TIMESTAMP,
        settings jsonb DEFAULT '{}',
        active boolean DEFAULT true,
        cep_id varchar(50) NOT NULL,
        CONSTRAINT users_pkey PRIMARY KEY (id),
        CONSTRAINT check_settings_valid_json CHECK ((settings IS NULL) OR (jsonb_typeof(settings) = 'object'))
      );
      CREATE UNIQUE INDEX users_email_key ON users(email);
      CREATE INDEX idx_users_settings ON users USING gin (settings);
      CREATE INDEX idx_users_active ON users(active);
      CREATE UNIQUE INDEX users_cep_id_key ON users(cep_id);
      CREATE INDEX idx_users_email_lower ON users (lower(email));
      CREATE INDEX idx_users_cep_id_lower ON users (lower(cep_id));
    `);

    // Repeat for all other tables, sequences, and indexes as in your SQL file...

    // Example: license_config
    await client.query(`DROP TABLE IF EXISTS license_config CASCADE; DROP SEQUENCE IF EXISTS license_config_id_seq;`);
    await client.query(`
      CREATE SEQUENCE license_config_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;
      CREATE TABLE license_config (
        id integer DEFAULT nextval('license_config_id_seq') NOT NULL,
        license_key varchar(255) NOT NULL,
        company_name varchar(255),
        valid_until date,
        status varchar(50) DEFAULT 'inactive',
        last_validated timestamp DEFAULT CURRENT_TIMESTAMP,
        validation_attempts integer DEFAULT 0,
        created_at timestamp DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT license_config_pkey PRIMARY KEY (id)
      );
      CREATE UNIQUE INDEX idx_license_key ON license_config(license_key);
    `);

    // ...repeat for all tables, triggers, and indexes...

    // --- TRIGGERS ---
    await client.query(`
      CREATE TRIGGER trigger_create_notification_settings
        AFTER INSERT ON users
        FOR EACH ROW
        EXECUTE FUNCTION create_default_notification_settings();
    `);

    await client.query(`
      CREATE TRIGGER trigger_calculate_warranty_end_date
        BEFORE INSERT OR UPDATE ON items
        FOR EACH ROW
        EXECUTE FUNCTION calculate_warranty_end_date();
    `);

    await client.query(`
      CREATE TRIGGER trigger_license_updated_at
        BEFORE UPDATE ON license_config
        FOR EACH ROW
        EXECUTE FUNCTION update_license_updated_at();
    `);

    // ...repeat for all triggers as in your SQL...

    // --- FOREIGN KEYS ---
    // Add all ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ... statements from your SQL file here.
    // Example:
    await client.query(`ALTER TABLE ONLY activity_logs ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) NOT DEFERRABLE;`);
    // ...repeat for all foreign keys...

    // --- VIEWS ---
    await client.query(`DROP VIEW IF EXISTS user_permissions_summary;`);
    await client.query(`
      CREATE VIEW user_permissions_summary AS
      SELECT u.id AS user_id,
        u.name AS user_name,
        u.email,
        array_agg(DISTINCT r.display_name ORDER BY r.display_name) AS roles,
        array_agg(DISTINCT p.name ORDER BY p.name) AS permissions,
        count(DISTINCT r.id) AS role_count,
        count(DISTINCT p.id) AS permission_count
      FROM ((((users u
        LEFT JOIN user_roles ur ON ((u.id = ur.user_id)))
        LEFT JOIN roles r ON ((ur.role_id = r.id)))
        LEFT JOIN role_permissions rp ON ((r.id = rp.role_id)))
        LEFT JOIN permissions p ON ((rp.permission_id = p.id)))
      GROUP BY u.id, u.name, u.email;
    `);

    await client.query(`DROP VIEW IF EXISTS warranty_status_view;`);
    await client.query(`
      CREATE VIEW warranty_status_view AS
      SELECT i.id,
        i.cep_brc,
        i.name,
        i.warranty_start_date,
        i.warranty_months,
        i.warranty_end_date,
        t.name AS type_name,
        b.name AS brand_name,
        e.name AS employee_name,
        e.id AS employee_id,
        d.name AS department_name,
        CASE
          WHEN (i.warranty_end_date IS NULL) THEN 'no_warranty'
          WHEN (i.warranty_end_date < CURRENT_DATE) THEN 'expired'
          WHEN ((i.warranty_end_date >= CURRENT_DATE) AND (i.warranty_end_date <= (CURRENT_DATE + INTERVAL '30 days'))) THEN 'expiring_soon'
          WHEN ((i.warranty_end_date >= (CURRENT_DATE + INTERVAL '31 days')) AND (i.warranty_end_date <= (CURRENT_DATE + INTERVAL '90 days'))) THEN 'expiring_later'
          ELSE 'active'
        END AS warranty_status,
        CASE
          WHEN (i.warranty_end_date IS NULL) THEN NULL
          WHEN (i.warranty_end_date < CURRENT_DATE) THEN (- (CURRENT_DATE - i.warranty_end_date))
          ELSE (i.warranty_end_date - CURRENT_DATE)
        END AS days_until_expiry
      FROM ((((items i
        LEFT JOIN types t ON ((i.type_id = t.id)))
        LEFT JOIN brands b ON ((i.brand_id = b.id)))
        LEFT JOIN employees e ON ((i.assigned_to = e.id)))
        LEFT JOIN departments d ON ((e.dept_id = d.id)));
    `);

    await client.query('COMMIT');
    console.log('Database initialized successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Database initialization failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { initializeDatabase };

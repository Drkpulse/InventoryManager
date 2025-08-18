-- Adminer 5.3.0 PostgreSQL 17.5 dump

\connect "inventory_db";

DROP FUNCTION IF EXISTS "calculate_warranty_end_date";;
CREATE FUNCTION "calculate_warranty_end_date" () RETURNS trigger LANGUAGE plpgsql AS '
BEGIN
    IF NEW.warranty_start_date IS NOT NULL AND NEW.warranty_months IS NOT NULL THEN
        NEW.warranty_end_date := NEW.warranty_start_date + (NEW.warranty_months || '' months'')::INTERVAL;
    END IF;
    RETURN NEW;
END;
';

DROP FUNCTION IF EXISTS "create_default_notification_settings";;
CREATE FUNCTION "create_default_notification_settings" () RETURNS trigger LANGUAGE plpgsql AS '
      BEGIN
        INSERT INTO notification_settings (user_id, type_id, enabled, email_enabled, browser_enabled)
        SELECT
          NEW.id as user_id,
          nt.id as type_id,
          TRUE as enabled,
          FALSE as email_enabled,
          TRUE as browser_enabled
        FROM notification_types nt;

        -- Create welcome notification for new user
        INSERT INTO notifications (type_id, user_id, title, message, data) VALUES
        ((SELECT id FROM notification_types WHERE name = ''system_welcome''),
         NEW.id,
         ''Welcome to the Inventory System!'',
         ''Hello '' || NEW.name || ''! Welcome to our inventory management system. You can manage your assets and receive important notifications here.'',
         jsonb_build_object(''welcome_type'', ''new_user'', ''user_name'', NEW.name));

        RETURN NEW;
      END;
      ';

DROP FUNCTION IF EXISTS "create_notification_settings_for_new_type";;
CREATE FUNCTION "create_notification_settings_for_new_type" () RETURNS trigger LANGUAGE plpgsql AS '
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
      ';

DROP FUNCTION IF EXISTS "find_user_by_login";;
CREATE FUNCTION "find_user_by_login" (IN "login_input" text, OUT "id" integer, OUT "name" character varying, OUT "email" character varying, OUT "password" character varying, OUT "role" character varying, OUT "cep_id" character varying, OUT "last_login" timestamp without time zone, OUT "created_at" timestamp without time zone, OUT "updated_at" timestamp without time zone) RETURNS record LANGUAGE plpgsql AS '
      BEGIN
        RETURN QUERY
        SELECT u.id, u.name, u.email, u.password, u.role, u.cep_id, u.last_login, u.created_at, u.updated_at
        FROM users u
        WHERE LOWER(u.email) = LOWER(login_input)
           OR LOWER(u.cep_id) = LOWER(login_input)
        LIMIT 1;
      END;
      ';

DROP FUNCTION IF EXISTS "get_user_permissions";;
CREATE FUNCTION "get_user_permissions" (IN "user_id_param" integer, OUT "permission_name" character varying, OUT "display_name" character varying, OUT "module" character varying) RETURNS record LANGUAGE plpgsql AS '
    BEGIN
      RETURN QUERY
      SELECT DISTINCT p.name, p.display_name, p.module
      FROM user_roles ur
      JOIN role_permissions rp ON ur.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = user_id_param
      ORDER BY p.module, p.display_name;
    END;
    ';

DROP FUNCTION IF EXISTS "get_user_roles";;
CREATE FUNCTION "get_user_roles" (IN "user_id_param" integer, OUT "role_id" integer, OUT "role_name" character varying, OUT "display_name" character varying, OUT "description" text) RETURNS record LANGUAGE plpgsql AS '
    BEGIN
      RETURN QUERY
      SELECT r.id, r.name, r.display_name, r.description
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = user_id_param
      ORDER BY r.display_name;
    END;
    ';

DROP FUNCTION IF EXISTS "update_license_updated_at";;
CREATE FUNCTION "update_license_updated_at" () RETURNS trigger LANGUAGE plpgsql AS '
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      ';

DROP FUNCTION IF EXISTS "update_updated_at_column";;
CREATE FUNCTION "update_updated_at_column" () RETURNS trigger LANGUAGE plpgsql AS '
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    ';

DROP FUNCTION IF EXISTS "user_has_permission";;
CREATE FUNCTION "user_has_permission" (IN "user_id_param" integer, IN "permission_name_param" character varying) RETURNS bool LANGUAGE plpgsql AS '
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
    ';

DROP FUNCTION IF EXISTS "user_has_role";;
CREATE FUNCTION "user_has_role" (IN "user_id_param" integer, IN "role_name_param" character varying) RETURNS bool LANGUAGE plpgsql AS '
    BEGIN
      RETURN EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = user_id_param
        AND r.name = role_name_param
      );
    END;
    ';

DROP TABLE IF EXISTS "activity_logs";
DROP SEQUENCE IF EXISTS activity_logs_id_seq;
CREATE SEQUENCE activity_logs_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."activity_logs" (
    "id" integer DEFAULT nextval('activity_logs_id_seq') NOT NULL,
    "user_id" integer,
    "action" character varying(255) NOT NULL,
    "entity_type" character varying(100),
    "entity_id" integer,
    "details" jsonb,
    "ip_address" character varying(50),
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE INDEX idx_activity_logs_user ON public.activity_logs USING btree (user_id);

CREATE INDEX idx_activity_logs_entity ON public.activity_logs USING btree (entity_type, entity_id);


DROP TABLE IF EXISTS "brands";
DROP SEQUENCE IF EXISTS brands_id_seq;
CREATE SEQUENCE brands_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."brands" (
    "id" integer DEFAULT nextval('brands_id_seq') NOT NULL,
    "name" character varying(255) NOT NULL,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX brands_name_key ON public.brands USING btree (name);


DROP TABLE IF EXISTS "client_history";
DROP SEQUENCE IF EXISTS client_history_id_seq;
CREATE SEQUENCE client_history_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."client_history" (
    "id" integer DEFAULT nextval('client_history_id_seq') NOT NULL,
    "client_id" integer,
    "action_type" character varying(50) NOT NULL,
    "action_details" jsonb,
    "performed_by" integer,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_history_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE INDEX idx_client_history_client ON public.client_history USING btree (client_id);


DROP TABLE IF EXISTS "clients";
DROP SEQUENCE IF EXISTS clients_id_seq;
CREATE SEQUENCE clients_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."clients" (
    "id" integer DEFAULT nextval('clients_id_seq') NOT NULL,
    "client_id" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" text,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX clients_client_id_key ON public.clients USING btree (client_id);


DROP TABLE IF EXISTS "contracts";
DROP SEQUENCE IF EXISTS contracts_id_seq;
CREATE SEQUENCE contracts_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."contracts" (
    "id" integer DEFAULT nextval('contracts_id_seq') NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" text,
    "file_path" character varying(500) NOT NULL,
    "file_name" character varying(255) NOT NULL,
    "file_size" bigint,
    "mime_type" character varying(100),
    "entity_type" character varying(50) NOT NULL,
    "entity_id" integer NOT NULL,
    "contract_type" character varying(100),
    "start_date" date,
    "end_date" date,
    "created_by" integer,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE INDEX idx_contracts_entity ON public.contracts USING btree (entity_type, entity_id);

CREATE INDEX idx_contracts_type ON public.contracts USING btree (contract_type);

CREATE INDEX idx_contracts_dates ON public.contracts USING btree (start_date, end_date);

CREATE INDEX idx_contracts_created_by ON public.contracts USING btree (created_by);


DROP TABLE IF EXISTS "contracts_history";
DROP SEQUENCE IF EXISTS contracts_history_id_seq;
CREATE SEQUENCE contracts_history_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."contracts_history" (
    "id" integer DEFAULT nextval('contracts_history_id_seq') NOT NULL,
    "contract_id" integer,
    "action_type" character varying(50) NOT NULL,
    "action_details" jsonb,
    "performed_by" integer,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contracts_history_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE INDEX idx_contracts_history_contract ON public.contracts_history USING btree (contract_id);

CREATE INDEX idx_contracts_history_action ON public.contracts_history USING btree (action_type);


DROP TABLE IF EXISTS "departments";
DROP SEQUENCE IF EXISTS departments_id_seq;
CREATE SEQUENCE departments_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."departments" (
    "id" integer DEFAULT nextval('departments_id_seq') NOT NULL,
    "name" character varying(255) NOT NULL,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX departments_name_key ON public.departments USING btree (name);


DROP TABLE IF EXISTS "employee_history";
DROP SEQUENCE IF EXISTS employee_history_id_seq;
CREATE SEQUENCE employee_history_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."employee_history" (
    "id" integer DEFAULT nextval('employee_history_id_seq') NOT NULL,
    "employee_id" integer,
    "action_type" character varying(50) NOT NULL,
    "action_details" jsonb,
    "performed_by" integer,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_history_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE INDEX idx_employee_history_created_at ON public.employee_history USING btree (created_at);

CREATE INDEX idx_employee_history_employee ON public.employee_history USING btree (employee_id);

CREATE INDEX idx_employee_history_action ON public.employee_history USING btree (action_type);


DROP TABLE IF EXISTS "employee_software";
DROP SEQUENCE IF EXISTS employee_software_id_seq;
CREATE SEQUENCE employee_software_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."employee_software" (
    "id" integer DEFAULT nextval('employee_software_id_seq') NOT NULL,
    "software_id" integer,
    "employee_id" integer,
    "assigned_date" date DEFAULT CURRENT_DATE,
    "notes" text,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "license_key" character varying(255),
    CONSTRAINT "employee_software_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX employee_software_software_id_employee_id_key ON public.employee_software USING btree (software_id, employee_id);

CREATE INDEX idx_employee_software_employee ON public.employee_software USING btree (employee_id);

CREATE INDEX idx_employee_software_software ON public.employee_software USING btree (software_id);

CREATE INDEX idx_employee_software_software_id ON public.employee_software USING btree (software_id);

CREATE INDEX idx_employee_software_employee_id ON public.employee_software USING btree (employee_id);


DROP TABLE IF EXISTS "employees";
DROP SEQUENCE IF EXISTS employees_id_seq;
CREATE SEQUENCE employees_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."employees" (
    "id" integer DEFAULT nextval('employees_id_seq') NOT NULL,
    "name" character varying(255) NOT NULL,
    "cep" character varying(50),
    "email" character varying(255),
    "dept_id" integer,
    "location_id" integer,
    "joined_date" date,
    "left_date" date,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX employees_cep_key ON public.employees USING btree (cep);

CREATE UNIQUE INDEX employees_email_key ON public.employees USING btree (email);

CREATE INDEX idx_employees_dept ON public.employees USING btree (dept_id);

CREATE INDEX idx_employees_location ON public.employees USING btree (location_id);


DROP TABLE IF EXISTS "item_history";
DROP SEQUENCE IF EXISTS item_history_id_seq;
CREATE SEQUENCE item_history_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."item_history" (
    "id" integer DEFAULT nextval('item_history_id_seq') NOT NULL,
    "item_id" integer,
    "action_type" character varying(50) NOT NULL,
    "action_details" jsonb,
    "performed_by" integer,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "item_history_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE INDEX idx_item_history_item ON public.item_history USING btree (item_id);

CREATE INDEX idx_item_history_action ON public.item_history USING btree (action_type);


DROP TABLE IF EXISTS "items";
DROP SEQUENCE IF EXISTS items_id_seq;
CREATE SEQUENCE items_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."items" (
    "id" integer DEFAULT nextval('items_id_seq') NOT NULL,
    "cep_brc" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "type_id" integer,
    "price" numeric(10,2),
    "brand_id" integer,
    "model" character varying(255),
    "serial_cod" character varying(255),
    "receipt" character varying(255),
    "date_assigned" date,
    "assigned_to" integer,
    "status_id" integer,
    "location_id" integer,
    "notes" text,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "description" text,
    "warranty_start_date" date,
    "warranty_end_date" date,
    "warranty_months" integer DEFAULT '12',
    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX items_cep_brc_key ON public.items USING btree (cep_brc);

CREATE INDEX idx_items_warranty_dates ON public.items USING btree (warranty_start_date, warranty_end_date) WHERE (warranty_end_date IS NOT NULL);

CREATE INDEX idx_items_type ON public.items USING btree (type_id);

CREATE INDEX idx_items_brand ON public.items USING btree (brand_id);

CREATE INDEX idx_items_assigned_to ON public.items USING btree (assigned_to);

CREATE INDEX idx_items_status ON public.items USING btree (status_id);

CREATE INDEX idx_items_location ON public.items USING btree (location_id);

CREATE INDEX idx_items_warranty_end_date ON public.items USING btree (warranty_end_date);


DELIMITER ;;

CREATE TRIGGER "trigger_calculate_warranty_end_date" BEFORE INSERT OR UPDATE ON "public"."items" FOR EACH ROW EXECUTE FUNCTION calculate_warranty_end_date();;

DELIMITER ;

DROP TABLE IF EXISTS "license_config";
DROP SEQUENCE IF EXISTS license_config_id_seq;
CREATE SEQUENCE license_config_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."license_config" (
    "id" integer DEFAULT nextval('license_config_id_seq') NOT NULL,
    "license_key" character varying(255) NOT NULL,
    "company_name" character varying(255),
    "valid_until" date,
    "status" character varying(50) DEFAULT 'inactive',
    "last_validated" timestamp DEFAULT CURRENT_TIMESTAMP,
    "validation_attempts" integer DEFAULT '0',
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "license_config_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX idx_license_key ON public.license_config USING btree (license_key);


DELIMITER ;;

CREATE TRIGGER "trigger_license_updated_at" BEFORE UPDATE ON "public"."license_config" FOR EACH ROW EXECUTE FUNCTION update_license_updated_at();;

DELIMITER ;

DROP TABLE IF EXISTS "locations";
DROP SEQUENCE IF EXISTS locations_id_seq;
CREATE SEQUENCE locations_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."locations" (
    "id" integer DEFAULT nextval('locations_id_seq') NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" text,
    "address" text,
    "parent_id" integer,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);


DROP TABLE IF EXISTS "notification_settings";
DROP SEQUENCE IF EXISTS notification_settings_id_seq;
CREATE SEQUENCE notification_settings_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."notification_settings" (
    "id" integer DEFAULT nextval('notification_settings_id_seq') NOT NULL,
    "user_id" integer NOT NULL,
    "type_id" integer NOT NULL,
    "enabled" boolean DEFAULT true,
    "email_enabled" boolean DEFAULT false,
    "browser_enabled" boolean DEFAULT true,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX notification_settings_user_id_type_id_key ON public.notification_settings USING btree (user_id, type_id);

CREATE INDEX idx_notification_settings_user_type ON public.notification_settings USING btree (user_id, type_id);


DROP TABLE IF EXISTS "notification_types";
DROP SEQUENCE IF EXISTS notification_types_id_seq;
CREATE SEQUENCE notification_types_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."notification_types" (
    "id" integer DEFAULT nextval('notification_types_id_seq') NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" text,
    "icon" character varying(50) DEFAULT 'fas fa-bell',
    "color" character varying(20) DEFAULT '#3b82f6',
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_types_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX notification_types_name_key ON public.notification_types USING btree (name);


DROP TABLE IF EXISTS "notifications";
DROP SEQUENCE IF EXISTS notifications_id_seq;
CREATE SEQUENCE notifications_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."notifications" (
    "id" integer DEFAULT nextval('notifications_id_seq') NOT NULL,
    "type_id" integer NOT NULL,
    "user_id" integer,
    "title" character varying(255) NOT NULL,
    "message" text NOT NULL,
    "url" character varying(500),
    "data" jsonb,
    "is_read" boolean DEFAULT false,
    "read_at" timestamp,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);

CREATE INDEX idx_notifications_type_id ON public.notifications USING btree (type_id);

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


DROP TABLE IF EXISTS "pda_history";
DROP SEQUENCE IF EXISTS pda_history_id_seq;
CREATE SEQUENCE pda_history_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."pda_history" (
    "id" integer DEFAULT nextval('pda_history_id_seq') NOT NULL,
    "pda_id" integer,
    "action_type" character varying(50) NOT NULL,
    "action_details" jsonb,
    "performed_by" integer,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pda_history_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE INDEX idx_pda_history_pda ON public.pda_history USING btree (pda_id);


DROP TABLE IF EXISTS "pdas";
DROP SEQUENCE IF EXISTS pdas_id_seq;
CREATE SEQUENCE pdas_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."pdas" (
    "id" integer DEFAULT nextval('pdas_id_seq') NOT NULL,
    "serial_number" character varying(255) NOT NULL,
    "client_id" integer,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "model" character varying(255),
    "cost" numeric(10,2),
    "status_id" integer,
    CONSTRAINT "pdas_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX pdas_serial_number_key ON public.pdas USING btree (serial_number);

CREATE INDEX idx_pdas_client ON public.pdas USING btree (client_id);

CREATE INDEX idx_pdas_status ON public.pdas USING btree (status_id);


DROP TABLE IF EXISTS "permissions";
DROP SEQUENCE IF EXISTS permissions_id_seq;
CREATE SEQUENCE permissions_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."permissions" (
    "id" integer DEFAULT nextval('permissions_id_seq') NOT NULL,
    "name" character varying(100) NOT NULL,
    "display_name" character varying(255) NOT NULL,
    "description" text,
    "module" character varying(100) NOT NULL,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX permissions_name_key ON public.permissions USING btree (name);

CREATE INDEX idx_permissions_module ON public.permissions USING btree (module);

CREATE INDEX idx_permissions_name ON public.permissions USING btree (name);


DELIMITER ;;

CREATE TRIGGER "update_permissions_updated_at" BEFORE UPDATE ON "public"."permissions" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();;

DELIMITER ;

DROP TABLE IF EXISTS "printer_history";
DROP SEQUENCE IF EXISTS printer_history_id_seq;
CREATE SEQUENCE printer_history_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."printer_history" (
    "id" integer DEFAULT nextval('printer_history_id_seq') NOT NULL,
    "printer_id" integer,
    "action_type" character varying(50) NOT NULL,
    "action_details" jsonb,
    "performed_by" integer,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "printer_history_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE INDEX idx_printer_history_printer ON public.printer_history USING btree (printer_id);


DROP TABLE IF EXISTS "printers";
DROP SEQUENCE IF EXISTS printers_id_seq;
CREATE SEQUENCE printers_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."printers" (
    "id" integer DEFAULT nextval('printers_id_seq') NOT NULL,
    "supplier" character varying(255),
    "employee_id" integer,
    "client_id" integer,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "model" character varying(255),
    "cost" numeric(10,2),
    "status_id" integer,
    CONSTRAINT "printers_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE INDEX idx_printers_employee ON public.printers USING btree (employee_id);

CREATE INDEX idx_printers_client ON public.printers USING btree (client_id);

CREATE INDEX idx_printers_status ON public.printers USING btree (status_id);


DROP TABLE IF EXISTS "report_settings";
DROP SEQUENCE IF EXISTS report_settings_id_seq;
CREATE SEQUENCE report_settings_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."report_settings" (
    "id" integer DEFAULT nextval('report_settings_id_seq') NOT NULL,
    "report_name" character varying(100) NOT NULL,
    "settings" jsonb,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "report_settings_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);


DROP TABLE IF EXISTS "role_permissions";
DROP SEQUENCE IF EXISTS role_permissions_id_seq;
CREATE SEQUENCE role_permissions_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."role_permissions" (
    "id" integer DEFAULT nextval('role_permissions_id_seq') NOT NULL,
    "role_id" integer,
    "permission_id" integer,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX role_permissions_role_id_permission_id_key ON public.role_permissions USING btree (role_id, permission_id);

CREATE INDEX idx_role_permissions_role ON public.role_permissions USING btree (role_id);

CREATE INDEX idx_role_permissions_permission ON public.role_permissions USING btree (permission_id);


DROP TABLE IF EXISTS "roles";
DROP SEQUENCE IF EXISTS roles_id_seq;
CREATE SEQUENCE roles_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."roles" (
    "id" integer DEFAULT nextval('roles_id_seq') NOT NULL,
    "name" character varying(100) NOT NULL,
    "display_name" character varying(255) NOT NULL,
    "description" text,
    "is_system_role" boolean DEFAULT false,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name);

CREATE INDEX idx_roles_name ON public.roles USING btree (name);


DELIMITER ;;

CREATE TRIGGER "update_roles_updated_at" BEFORE UPDATE ON "public"."roles" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();;

DELIMITER ;

DROP TABLE IF EXISTS "sales";
CREATE TABLE "public"."sales" (
    "receipt" character varying(255) NOT NULL,
    "supplier" character varying(255),
    "date_acquired" date,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_pkey" PRIMARY KEY ("receipt")
)
WITH (oids = false);


DROP TABLE IF EXISTS "sim_card_history";
DROP SEQUENCE IF EXISTS sim_card_history_id_seq;
CREATE SEQUENCE sim_card_history_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."sim_card_history" (
    "id" integer DEFAULT nextval('sim_card_history_id_seq') NOT NULL,
    "sim_card_id" integer,
    "action_type" character varying(50) NOT NULL,
    "action_details" jsonb,
    "performed_by" integer,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sim_card_history_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE INDEX idx_sim_card_history_sim_card ON public.sim_card_history USING btree (sim_card_id);


DROP TABLE IF EXISTS "sim_cards";
DROP SEQUENCE IF EXISTS sim_cards_id_seq;
CREATE SEQUENCE sim_cards_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."sim_cards" (
    "id" integer DEFAULT nextval('sim_cards_id_seq') NOT NULL,
    "sim_number" character varying(255) NOT NULL,
    "carrier" character varying(255),
    "client_id" integer,
    "pda_id" integer,
    "monthly_cost" numeric(10,2),
    "status_id" integer,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sim_cards_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX sim_cards_sim_number_key ON public.sim_cards USING btree (sim_number);

CREATE INDEX idx_sim_cards_client ON public.sim_cards USING btree (client_id);

CREATE INDEX idx_sim_cards_pda ON public.sim_cards USING btree (pda_id);

CREATE INDEX idx_sim_cards_status ON public.sim_cards USING btree (status_id);


DROP TABLE IF EXISTS "software";
DROP SEQUENCE IF EXISTS software_id_seq;
CREATE SEQUENCE software_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."software" (
    "id" integer DEFAULT nextval('software_id_seq') NOT NULL,
    "name" character varying(255) NOT NULL,
    "version" character varying(100),
    "license_type" character varying(100),
    "cost_per_license" numeric(10,2),
    "vendor" character varying(255),
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "description" text,
    "max_licenses" integer DEFAULT '1',
    CONSTRAINT "software_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE INDEX idx_software_max_licenses ON public.software USING btree (max_licenses);


DROP TABLE IF EXISTS "statuses";
DROP SEQUENCE IF EXISTS statuses_id_seq;
CREATE SEQUENCE statuses_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."statuses" (
    "id" integer DEFAULT nextval('statuses_id_seq') NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" text,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "icon" character varying(50) DEFAULT 'fas fa-tag',
    "color" character varying(20) DEFAULT 'gray',
    "is_active" boolean DEFAULT true,
    "status_order" integer DEFAULT '999',
    CONSTRAINT "statuses_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);


DROP TABLE IF EXISTS "system_settings";
DROP SEQUENCE IF EXISTS system_settings_id_seq;
CREATE SEQUENCE system_settings_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."system_settings" (
    "id" integer DEFAULT nextval('system_settings_id_seq') NOT NULL,
    "setting_key" character varying(100) NOT NULL,
    "setting_value" text,
    "description" text,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "is_editable" boolean DEFAULT true,
    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX system_settings_setting_key_key ON public.system_settings USING btree (setting_key);


DROP TABLE IF EXISTS "types";
DROP SEQUENCE IF EXISTS types_id_seq;
CREATE SEQUENCE types_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."types" (
    "id" integer DEFAULT nextval('types_id_seq') NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" text,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "types_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX types_name_key ON public.types USING btree (name);


DROP VIEW IF EXISTS "user_permissions_summary";
CREATE TABLE "user_permissions_summary" ("user_id" integer, "user_name" character varying(255), "email" character varying(255), "roles" character varying[], "permissions" character varying[], "role_count" bigint, "permission_count" bigint);


DROP TABLE IF EXISTS "user_roles";
DROP SEQUENCE IF EXISTS user_roles_id_seq;
CREATE SEQUENCE user_roles_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."user_roles" (
    "id" integer DEFAULT nextval('user_roles_id_seq') NOT NULL,
    "user_id" integer,
    "role_id" integer,
    "assigned_by" integer,
    "assigned_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX user_roles_user_id_role_id_key ON public.user_roles USING btree (user_id, role_id);

CREATE INDEX idx_user_roles_user ON public.user_roles USING btree (user_id);

CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role_id);


DROP TABLE IF EXISTS "users";
DROP SEQUENCE IF EXISTS users_id_seq;
CREATE SEQUENCE users_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."users" (
    "id" integer DEFAULT nextval('users_id_seq') NOT NULL,
    "name" character varying(255) NOT NULL,
    "email" character varying(255) NOT NULL,
    "password" character varying(255) NOT NULL,
    "role" character varying(50) DEFAULT 'user',
    "last_login" timestamp,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "settings" jsonb DEFAULT '{}',
    "active" boolean DEFAULT true,
    "cep_id" character varying(50) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "check_settings_valid_json" CHECK ((settings IS NULL) OR (jsonb_typeof(settings) = 'object'::text))
)
WITH (oids = false);

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

CREATE INDEX idx_users_settings ON public.users USING gin (settings);

CREATE INDEX idx_users_active ON public.users USING btree (active);

CREATE UNIQUE INDEX users_cep_id_key ON public.users USING btree (cep_id);

CREATE INDEX idx_users_email_lower ON public.users USING btree (lower((email)::text));

CREATE INDEX idx_users_cep_id_lower ON public.users USING btree (lower((cep_id)::text));


DELIMITER ;;

CREATE TRIGGER "trigger_create_notification_settings" AFTER INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION create_default_notification_settings();;

DELIMITER ;

DROP VIEW IF EXISTS "warranty_status_view";
CREATE TABLE "warranty_status_view" ("id" integer, "cep_brc" character varying(255), "name" character varying(255), "warranty_start_date" date, "warranty_months" integer, "warranty_end_date" date, "type_name" character varying(255), "brand_name" character varying(255), "employee_name" character varying(255), "employee_id" integer, "department_name" character varying(255), "warranty_status" text, "days_until_expiry" integer);


ALTER TABLE ONLY "public"."activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."client_history" ADD CONSTRAINT "client_history_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."contracts" ADD CONSTRAINT "contracts_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."contracts_history" ADD CONSTRAINT "contracts_history_contract_id_fkey" FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE NOT DEFERRABLE;
ALTER TABLE ONLY "public"."contracts_history" ADD CONSTRAINT "contracts_history_performed_by_fkey" FOREIGN KEY (performed_by) REFERENCES users(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."employee_software" ADD CONSTRAINT "employee_software_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE NOT DEFERRABLE;
ALTER TABLE ONLY "public"."employee_software" ADD CONSTRAINT "employee_software_software_id_fkey" FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE CASCADE NOT DEFERRABLE;

ALTER TABLE ONLY "public"."employees" ADD CONSTRAINT "employees_dept_id_fkey" FOREIGN KEY (dept_id) REFERENCES departments(id) NOT DEFERRABLE;
ALTER TABLE ONLY "public"."employees" ADD CONSTRAINT "employees_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."item_history" ADD CONSTRAINT "item_history_item_id_fkey" FOREIGN KEY (item_id) REFERENCES items(id) NOT DEFERRABLE;
ALTER TABLE ONLY "public"."item_history" ADD CONSTRAINT "item_history_performed_by_fkey" FOREIGN KEY (performed_by) REFERENCES users(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."items" ADD CONSTRAINT "items_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES employees(id) NOT DEFERRABLE;
ALTER TABLE ONLY "public"."items" ADD CONSTRAINT "items_brand_id_fkey" FOREIGN KEY (brand_id) REFERENCES brands(id) NOT DEFERRABLE;
ALTER TABLE ONLY "public"."items" ADD CONSTRAINT "items_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) NOT DEFERRABLE;
ALTER TABLE ONLY "public"."items" ADD CONSTRAINT "items_receipt_fkey" FOREIGN KEY (receipt) REFERENCES sales(receipt) NOT DEFERRABLE;
ALTER TABLE ONLY "public"."items" ADD CONSTRAINT "items_status_id_fkey" FOREIGN KEY (status_id) REFERENCES statuses(id) NOT DEFERRABLE;
ALTER TABLE ONLY "public"."items" ADD CONSTRAINT "items_type_id_fkey" FOREIGN KEY (type_id) REFERENCES types(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."locations" ADD CONSTRAINT "locations_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES locations(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."notification_settings" ADD CONSTRAINT "notification_settings_type_id_fkey" FOREIGN KEY (type_id) REFERENCES notification_types(id) ON DELETE CASCADE NOT DEFERRABLE;
ALTER TABLE ONLY "public"."notification_settings" ADD CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT DEFERRABLE;

ALTER TABLE ONLY "public"."notifications" ADD CONSTRAINT "notifications_type_id_fkey" FOREIGN KEY (type_id) REFERENCES notification_types(id) ON DELETE CASCADE NOT DEFERRABLE;
ALTER TABLE ONLY "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT DEFERRABLE;

ALTER TABLE ONLY "public"."pda_history" ADD CONSTRAINT "pda_history_pda_id_fkey" FOREIGN KEY (pda_id) REFERENCES pdas(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."pdas" ADD CONSTRAINT "pdas_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) NOT DEFERRABLE;
ALTER TABLE ONLY "public"."pdas" ADD CONSTRAINT "pdas_status_id_fkey" FOREIGN KEY (status_id) REFERENCES statuses(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."printer_history" ADD CONSTRAINT "printer_history_printer_id_fkey" FOREIGN KEY (printer_id) REFERENCES printers(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."printers" ADD CONSTRAINT "printers_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) NOT DEFERRABLE;
ALTER TABLE ONLY "public"."printers" ADD CONSTRAINT "printers_status_id_fkey" FOREIGN KEY (status_id) REFERENCES statuses(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE NOT DEFERRABLE;
ALTER TABLE ONLY "public"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE NOT DEFERRABLE;

ALTER TABLE ONLY "public"."sim_card_history" ADD CONSTRAINT "sim_card_history_performed_by_fkey" FOREIGN KEY (performed_by) REFERENCES users(id) NOT DEFERRABLE;
ALTER TABLE ONLY "public"."sim_card_history" ADD CONSTRAINT "sim_card_history_sim_card_id_fkey" FOREIGN KEY (sim_card_id) REFERENCES sim_cards(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."sim_cards" ADD CONSTRAINT "sim_cards_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) NOT DEFERRABLE;
ALTER TABLE ONLY "public"."sim_cards" ADD CONSTRAINT "sim_cards_pda_id_fkey" FOREIGN KEY (pda_id) REFERENCES pdas(id) NOT DEFERRABLE;
ALTER TABLE ONLY "public"."sim_cards" ADD CONSTRAINT "sim_cards_status_id_fkey" FOREIGN KEY (status_id) REFERENCES statuses(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."user_roles" ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY (assigned_by) REFERENCES users(id) NOT DEFERRABLE;
ALTER TABLE ONLY "public"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE NOT DEFERRABLE;
ALTER TABLE ONLY "public"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT DEFERRABLE;

DROP TABLE IF EXISTS "user_permissions_summary";
CREATE VIEW "user_permissions_summary" AS SELECT u.id AS user_id,
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

DROP TABLE IF EXISTS "warranty_status_view";
CREATE VIEW "warranty_status_view" AS SELECT i.id,
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
            WHEN (i.warranty_end_date IS NULL) THEN 'no_warranty'::text
            WHEN (i.warranty_end_date < CURRENT_DATE) THEN 'expired'::text
            WHEN ((i.warranty_end_date >= CURRENT_DATE) AND (i.warranty_end_date <= (CURRENT_DATE + '30 days'::interval))) THEN 'expiring_soon'::text
            WHEN ((i.warranty_end_date >= (CURRENT_DATE + '31 days'::interval)) AND (i.warranty_end_date <= (CURRENT_DATE + '90 days'::interval))) THEN 'expiring_later'::text
            ELSE 'active'::text
        END AS warranty_status,
        CASE
            WHEN (i.warranty_end_date IS NULL) THEN NULL::integer
            WHEN (i.warranty_end_date < CURRENT_DATE) THEN (- (CURRENT_DATE - i.warranty_end_date))
            ELSE (i.warranty_end_date - CURRENT_DATE)
        END AS days_until_expiry
   FROM ((((items i
     LEFT JOIN types t ON ((i.type_id = t.id)))
     LEFT JOIN brands b ON ((i.brand_id = b.id)))
     LEFT JOIN employees e ON ((i.assigned_to = e.id)))
     LEFT JOIN departments d ON ((e.dept_id = d.id)));

-- 2025-08-11 15:01:04 UTC

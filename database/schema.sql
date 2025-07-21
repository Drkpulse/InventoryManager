-- Database: inventory_db

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS platforms;
DROP TABLE IF EXISTS types;
DROP TABLE IF EXISTS brands;
DROP TABLE IF EXISTS offices;
DROP TABLE IF EXISTS sales;
DROP TABLE IF EXISTS users;

-- Create users table (keeping this for authentication)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create Department table
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(250) NOT NULL UNIQUE
);

-- Create Platform table
CREATE TABLE platforms (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(250) NOT NULL UNIQUE
);

-- Create Office table (software licenses)
CREATE TABLE offices (
  id SERIAL PRIMARY KEY,
  name VARCHAR(250) NOT NULL UNIQUE -- Added UNIQUE constraint
);

-- Create Type table
CREATE TABLE types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(250) NOT NULL UNIQUE
);

-- Create Brand table
CREATE TABLE brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(250) NOT NULL UNIQUE
);

-- Create Sales table
CREATE TABLE sales (
  receipt VARCHAR(250) PRIMARY KEY,
  supplier VARCHAR(250),
  date_acquired DATE NOT NULL
);

-- Create Employee table
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  cep VARCHAR(20) UNIQUE,  -- Employee ID should be unique
  email VARCHAR(250) UNIQUE,
  office_id INTEGER REFERENCES offices(id), -- Changed to reference offices.id instead of name
  platform_id VARCHAR(20) REFERENCES platforms(id),
  dept_id INTEGER REFERENCES departments(id),
  joined_date DATE NOT NULL,
  left_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create Item table
CREATE TABLE items (
  id SERIAL NOT NULL,
  cep_brc VARCHAR(25) NOT NULL,
  name VARCHAR(250) NOT NULL,
  type_id INTEGER REFERENCES types(id),
  price NUMERIC(10, 2),
  brand_id INTEGER REFERENCES brands(id),
  model VARCHAR(250),
  serial_cod VARCHAR(250) UNIQUE,
  receipt VARCHAR(250) REFERENCES sales(receipt),
  date_assigned DATE,
  assigned_to INTEGER REFERENCES employees(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, cep_brc)
);

-- Create an admin user (password: admin123)
INSERT INTO users (name, email, password, role)
VALUES ('Admin User', 'admin@example.com', '$2a$10$rVTD1ySZN5OtNkQ5C62yA.gutjwPM0h.i5.WDG7XyDpnSOGUK3PgW', 'admin');

-- Insert sample data for departments
INSERT INTO departments (name) VALUES
  ('IT'),
  ('HR'),
  ('Finance'),
  ('Marketing'),
  ('Operations');

-- Insert sample data for platforms
INSERT INTO platforms (id, name) VALUES
  ('WIN', 'Windows'),
  ('MAC', 'MacOS'),
  ('LIN', 'Linux'),
  ('AND', 'Android'),
  ('IOS', 'iOS');

-- Insert sample data for types
INSERT INTO types (name) VALUES
  ('Laptop'),
  ('Desktop'),
  ('Monitor'),
  ('Smartphone'),
  ('Tablet'),
  ('Printer');

-- Insert sample data for brands
INSERT INTO brands (name) VALUES
  ('Dell'),
  ('HP'),
  ('Lenovo'),
  ('Apple'),
  ('Samsung');

-- Insert sample data for offices
INSERT INTO offices (name) VALUES
  ('Microsoft Office'),
  ('Google Workspace'),
  ('Adobe Creative Cloud'),
  ('AutoCAD'),
  ('Sketch');

-- Insert sample data for sales
INSERT INTO sales (receipt, supplier, date_acquired) VALUES
  ('INV-2023-001', 'Tech Supplier Inc.', '2023-01-15'),
  ('INV-2023-002', 'Office Equipment Ltd.', '2023-02-20'),
  ('INV-2023-003', 'Computer World', '2023-03-10');

-- Insert sample data for employees
INSERT INTO employees (name, cep, email, office_id, platform_id, dept_id, joined_date) VALUES
  ('John Doe', 'EMP001', 'john.doe@example.com', 1, 'WIN', 1, '2022-01-10'),
  ('Jane Smith', 'EMP002', 'jane.smith@example.com', 3, 'MAC', 4, '2022-03-15'),
  ('Robert Johnson', 'EMP003', 'robert.j@example.com', 2, 'WIN', 3, '2022-05-20');

-- Insert sample data for items
INSERT INTO items (cep_brc, name, type_id, price, brand_id, model, serial_cod, receipt, date_assigned, assigned_to) VALUES
  ('IT001-LAP', 'Development Laptop', 1, 1299.99, 1, 'XPS 15', 'SN12345678', 'INV-2023-001', '2023-01-20', 1),
  ('IT002-MON', 'Monitor 27"', 3, 349.99, 3, 'ThinkVision P27h', 'SN87654321', 'INV-2023-001', '2023-01-20', 1),
  ('MK001-LAP', 'Design Laptop', 1, 1799.99, 4, 'MacBook Pro', 'SN45678901', 'INV-2023-002', '2023-02-25', 2);

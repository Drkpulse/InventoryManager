-- Add description field to departments table
ALTER TABLE departments
ADD COLUMN IF NOT EXISTS description TEXT;

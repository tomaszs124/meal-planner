-- Add notes column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS notes text;

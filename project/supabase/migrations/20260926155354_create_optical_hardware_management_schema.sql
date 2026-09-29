/*
# Optical & Hardware Management System Schema

This migration creates the complete database schema for an optical and hardware store
management system. It is a single-tenant app (no sign-in), so all tables use
anon+authenticated access.

## New Tables

### products
- Inventory items for both optical (eyeglasses, lenses, frames, contact lenses) and
  hardware (screws, tools, hinges, nose pads, etc.) categories.
- `id` (uuid PK)
- `name` (text, not null) — product name
- `category` (text, not null) — 'Optical' or 'Hardware'
- `subcategory` (text) — finer classification (e.g. 'Frames', 'Lenses', 'Tools')
- `sku` (text, unique) — stock keeping unit
- `price` (numeric, not null) — selling price
- `cost` (numeric) — purchase cost for margin tracking
- `stock` (integer, default 0) — current quantity in stock
- `low_stock_threshold` (integer, default 5) — alert threshold
- `supplier` (text) — supplier/vendor name
- `description` (text) — optional product notes
- `created_at` (timestamptz)

### customers
- Customer records for repeat store interactions.
- `id` (uuid PK)
- `name` (text, not null)
- `phone` (text)
- `email` (text)
- `address` (text)
- `notes` (text) — optional customer notes
- `created_at` (timestamptz)

### bills
- Billing transactions linking a customer to a set of purchased products.
- `id` (uuid PK)
- `bill_number` (text, unique) — human-readable bill ID
- `customer_id` (uuid FK -> customers, nullable for walk-in customers)
- `customer_name` (text) — snapshot of customer name (for walk-ins or historical record)
- `subtotal` (numeric, not null) — sum of line items before discount/tax
- `discount` (numeric, default 0) — flat discount amount
- `tax_rate` (numeric, default 0) — tax percentage (e.g. 5 for 5%)
- `total` (numeric, not null) — final amount after discount and tax
- `payment_method` (text) — 'Cash', 'Card', 'UPI', etc.
- `status` (text, default 'completed') — 'completed' or 'voided'
- `notes` (text) — optional bill notes
- `created_at` (timestamptz)

### bill_items
- Individual line items on a bill, each referencing a product.
- `id` (uuid PK)
- `bill_id` (uuid FK -> bills, ON DELETE CASCADE)
- `product_id` (uuid FK -> products, nullable for manual items)
- `product_name` (text, not null) — snapshot of product name at time of billing
- `quantity` (integer, not null, default 1)
- `unit_price` (numeric, not null) — price per unit at time of billing
- `line_total` (numeric, not null) — quantity * unit_price

## Security
- RLS enabled on all tables.
- All tables allow anon+authenticated full CRUD (single-tenant, no auth).
- `USING (true)` / `WITH CHECK (true)` is intentional — the data is shared store data.

## Important Notes
1. bill_items cascade-delete with their parent bill.
2. Product stock is managed in application logic (decrement on bill creation).
3. bill_number is auto-generated in the format BILL-YYYYMMDD-NNN.
4. Snapshots of product_name and customer_name are stored on bills/items so historical
   records remain accurate even if the product or customer is later renamed.
*/

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('Optical', 'Hardware')),
  subcategory text,
  sku text UNIQUE,
  price numeric(10, 2) NOT NULL DEFAULT 0,
  cost numeric(10, 2) DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  low_stock_threshold integer NOT NULL DEFAULT 5,
  supplier text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE
  TO anon, authenticated USING (true);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE
  TO anon, authenticated USING (true);

-- Bills table
CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number text UNIQUE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT 'Walk-in Customer',
  subtotal numeric(10, 2) NOT NULL DEFAULT 0,
  discount numeric(10, 2) NOT NULL DEFAULT 0,
  tax_rate numeric(5, 2) NOT NULL DEFAULT 0,
  total numeric(10, 2) NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'Cash',
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bills" ON bills;
CREATE POLICY "anon_select_bills" ON bills FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_bills" ON bills;
CREATE POLICY "anon_insert_bills" ON bills FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_bills" ON bills;
CREATE POLICY "anon_update_bills" ON bills FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bills" ON bills;
CREATE POLICY "anon_delete_bills" ON bills FOR DELETE
  TO anon, authenticated USING (true);

-- Bill items table
CREATE TABLE IF NOT EXISTS bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10, 2) NOT NULL DEFAULT 0,
  line_total numeric(10, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bill_items" ON bill_items;
CREATE POLICY "anon_select_bill_items" ON bill_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_bill_items" ON bill_items;
CREATE POLICY "anon_insert_bill_items" ON bill_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_bill_items" ON bill_items;
CREATE POLICY "anon_update_bill_items" ON bill_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bill_items" ON bill_items;
CREATE POLICY "anon_delete_bill_items" ON bill_items FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_product_id ON bill_items(product_id);

-- Function to auto-generate bill numbers
CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS text AS $$
DECLARE
  date_part text;
  count_today integer;
  new_number text;
BEGIN
  date_part := to_char(now(), 'YYYYMMDD');
  SELECT count(*) INTO count_today FROM bills WHERE bill_number LIKE 'BILL-' || date_part || '-%';
  new_number := 'BILL-' || date_part || '-' || lpad((count_today + 1)::text, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

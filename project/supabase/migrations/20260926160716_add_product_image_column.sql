/*
# Add image_url column to products

This migration adds an image_url column to the products table so each product
can display a photo in the inventory and billing screens.

## Changes
- products: new column `image_url` (text, nullable) — URL to the product image.

## Security
- No security changes. Existing RLS policies already cover the new column.
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;

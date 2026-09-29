/*
# Add decrement_stock RPC function

This migration adds a stored function that safely decrements product stock
when a bill is created. It prevents stock from going negative.

## New Functions
- `decrement_stock(p_product_id uuid, p_quantity integer)` — decrements the stock
  of the given product by p_quantity, but never below zero.

## Security
- The function is callable by anon and authenticated (single-tenant app).
- SECURITY INVOKER so it runs with the caller's privileges (RLS applies).
*/

CREATE OR REPLACE FUNCTION decrement_stock(p_product_id uuid, p_quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE products
  SET stock = GREATEST(0, stock - p_quantity)
  WHERE id = p_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION decrement_stock(uuid, integer) TO anon, authenticated;

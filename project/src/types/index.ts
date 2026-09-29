export interface Product {
  id: string;
  name: string;
  category: 'Optical' | 'Hardware';
  subcategory: string | null;
  sku: string | null;
  price: number;
  cost: number | null;
  stock: number;
  low_stock_threshold: number;
  supplier: string | null;
  description: string | null;
  image_url: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export interface Bill {
  id: string;
  bill_number: string | null;
  customer_id: string | null;
  customer_name: string;
  subtotal: number;
  discount: number;
  tax_rate: number;
  total: number;
  payment_method: string | null;
  status: 'completed' | 'voided';
  notes: string | null;
  created_at: string;
}

export interface BillItem {
  id: string;
  bill_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface BillWithItems extends Bill {
  bill_items?: BillItem[];
}

export type View = 'dashboard' | 'inventory' | 'customers' | 'billing' | 'bills';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

const supabaseUrl = `https://${projectId}.supabase.co`;

export const supabase = createSupabaseClient(supabaseUrl, publicAnonKey);

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  min_stock: number | null;
  notes: string | null;
  created_at: string;
};

export type Sale = {
  id: string;
  total: number;
  payment_method: 'cash' | 'bank' | 'telebirr';
  discount: number;
  is_reversed: boolean;
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  created_at: string;
};

export type Expense = {
  id: string;
  name: string;
  category: string;
  amount: number;
  notes: string | null;
  created_at: string;
};

export type InventoryAdjustment = {
  id: string;
  product_id: string;
  product_name: string;
  adjustment: number;
  reason: string;
  created_at: string;
};

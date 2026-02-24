export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  company_id: string;
  active?: boolean;
}

export interface Quote {
  id: string;
  title: string;
  status: 'open' | 'closed';
  notes?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  company_id: string;
  profiles?: { name: string }; // For joined data
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  barcode: string;
  product_name: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface ProductCatalog {
  id: string;
  company_id: string;
  barcode: string;
  product_name: string;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

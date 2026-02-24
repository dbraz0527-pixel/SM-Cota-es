export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  companyId: number;
  active?: number;
}

export interface Quote {
  id: number;
  title: string;
  status: 'open' | 'closed';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  userName?: string;
}

export interface QuoteItem {
  id: number;
  quoteId: number;
  barcode: string;
  productName: string;
  quantity: number;
  createdAt: string;
}

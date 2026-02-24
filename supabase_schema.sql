-- SQL Schema for Supabase

-- 1. Companies Table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Profiles Table (Extends Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'employee')) NOT NULL DEFAULT 'employee',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Quotes Table
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Product Catalog Table
CREATE TABLE product_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  product_name TEXT NOT NULL,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, barcode)
);

-- 5. Quote Items Table
CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  updated_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(quote_id, barcode)
);

-- 6. Shares Table
CREATE TABLE shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS (Row Level Security)

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

-- Policies

-- Profiles: Users can read their own profile and admins can read all profiles in their company
CREATE POLICY "Profiles are viewable by company members" ON profiles
  FOR SELECT USING (
    auth.uid() = id OR 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.company_id = profiles.company_id
    )
  );

CREATE POLICY "Admins can update profiles in their company" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.company_id = profiles.company_id
    )
  );

-- Quotes: Employees see their own, Admins see all in company
CREATE POLICY "Quotes viewable by owner or company admin" ON quotes
  FOR SELECT USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.company_id = quotes.company_id
    )
  );

CREATE POLICY "Users can insert quotes" ON quotes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quotes or company admin" ON quotes
  FOR UPDATE USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.company_id = quotes.company_id
    )
  );

CREATE POLICY "Users can delete their own quotes or company admin" ON quotes
  FOR DELETE USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.company_id = quotes.company_id
    )
  );

-- Quote Items
CREATE POLICY "Quote items viewable by quote access" ON quote_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quotes q 
      WHERE q.id = quote_items.quote_id AND (
        q.user_id = auth.uid() OR 
        EXISTS (
          SELECT 1 FROM profiles p 
          WHERE p.id = auth.uid() AND p.role = 'admin' AND p.company_id = q.company_id
        )
      )
    )
  );

CREATE POLICY "Users can manage quote items if quote is open" ON quote_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM quotes q 
      WHERE q.id = quote_items.quote_id AND q.status = 'open' AND (
        q.user_id = auth.uid() OR 
        EXISTS (
          SELECT 1 FROM profiles p 
          WHERE p.id = auth.uid() AND p.role = 'admin' AND p.company_id = q.company_id
        )
      )
    )
  );

-- Product Catalog
CREATE POLICY "Catalog viewable by company members" ON product_catalog
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.company_id = product_catalog.company_id
    )
  );

CREATE POLICY "Admins can manage catalog" ON product_catalog
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.company_id = product_catalog.company_id
    )
  );

-- Trigger for Product Catalog Upsert
CREATE OR REPLACE FUNCTION upsert_product_catalog()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO product_catalog (company_id, barcode, product_name, last_used_at, updated_at)
  VALUES (NEW.company_id, NEW.barcode, NEW.product_name, now(), now())
  ON CONFLICT (company_id, barcode) DO UPDATE SET
    product_name = EXCLUDED.product_name,
    last_used_at = now(),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_quote_item_upsert
  AFTER INSERT OR UPDATE ON quote_items
  FOR EACH ROW
  EXECUTE FUNCTION upsert_product_catalog();

-- Function to handle new user registration (if using Supabase Auth UI or similar)
-- This would typically be an Edge Function or a Trigger on auth.users
-- For this MVP, we assume profiles are created by admins or via a signup flow.

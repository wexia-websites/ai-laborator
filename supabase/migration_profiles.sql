-- Vytvoření tabulky profiles (spusť PŘED migration_rbac.sql)

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role text DEFAULT 'viewer',
  team text,
  email text,
  created_at timestamptz DEFAULT now()
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile insert" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

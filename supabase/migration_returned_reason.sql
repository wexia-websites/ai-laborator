-- Přidá pole returned_reason do use_cases
-- Umožňuje adminovi vrátit use case autorovi s důvodem
-- Spusťte v Supabase SQL editoru

ALTER TABLE use_cases
  ADD COLUMN IF NOT EXISTS returned_reason text DEFAULT NULL;

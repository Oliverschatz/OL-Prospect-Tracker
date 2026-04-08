-- Add ambassador_code to profiles.
-- Each Brand Ambassador can set a personal code that their customers
-- enter at checkout for a discount (and to trigger the ambassador's
-- commission). The code is self-service — ambassadors set and change
-- it themselves in Settings.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ambassador_code TEXT;

-- Case-insensitive uniqueness among non-null codes.
-- Partial unique index: NULLs are ignored (many ambassadors can have
-- no code yet), and "Foo" collides with "foo".
CREATE UNIQUE INDEX IF NOT EXISTS profiles_ambassador_code_ci_key
  ON profiles (LOWER(ambassador_code))
  WHERE ambassador_code IS NOT NULL;

-- Idempotently ensure an UPDATE RLS policy exists so ambassadors can
-- edit their own profile row (covers ambassador_code as well as the
-- existing timezone / daily_email columns).
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

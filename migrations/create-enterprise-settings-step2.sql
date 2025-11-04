-- Step 2: Add RLS policies to enterprise_settings table

-- Enable Row Level Security
ALTER TABLE enterprise_settings ENABLE ROW LEVEL SECURITY;

-- Policy 1: Service role has full access (for admin/backend operations)
CREATE POLICY "Service role full access"
ON enterprise_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy 2: Authenticated users can read their enterprise settings
CREATE POLICY "Users read own enterprise"
ON enterprise_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.enterprise_id = enterprise_settings.enterprise_id 
    AND users."openId" = auth.uid()::text
  )
);

-- Policy 3: Enterprise admins can update their enterprise settings
CREATE POLICY "Admins update enterprise"
ON enterprise_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.enterprise_id = enterprise_settings.enterprise_id 
    AND users."openId" = auth.uid()::text
    AND users.role = 'enterprise_admin'::user_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.enterprise_id = enterprise_settings.enterprise_id 
    AND users."openId" = auth.uid()::text
    AND users.role = 'enterprise_admin'::user_role
  )
);

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'enterprise_settings'
ORDER BY policyname;

SELECT 'RLS policies created successfully!' as status;

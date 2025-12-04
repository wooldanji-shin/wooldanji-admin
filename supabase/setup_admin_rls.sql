-- =====================================================
-- Admin RLS Policies Setup
-- =====================================================
-- This script sets up Row Level Security policies for:
-- 1. home_notifications table
-- 2. home_headers table
-- 3. home-content storage bucket
--
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. home_notifications Table Policies
-- =====================================================

-- Enable RLS on home_notifications
ALTER TABLE home_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Allow admins to SELECT all notifications
CREATE POLICY "Admins can view all notifications"
ON home_notifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles."userId" = auth.uid()
    AND user_roles.role IN ('SUPER_ADMIN', 'APT_ADMIN', 'MANAGER')
  )
);

-- Policy: Allow admins to INSERT notifications
CREATE POLICY "Admins can insert notifications"
ON home_notifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles."userId" = auth.uid()
    AND user_roles.role IN ('SUPER_ADMIN', 'APT_ADMIN', 'MANAGER')
  )
);

-- Policy: Allow admins to UPDATE notifications
CREATE POLICY "Admins can update notifications"
ON home_notifications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles."userId" = auth.uid()
    AND user_roles.role IN ('SUPER_ADMIN', 'APT_ADMIN', 'MANAGER')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles."userId" = auth.uid()
    AND user_roles.role IN ('SUPER_ADMIN', 'APT_ADMIN', 'MANAGER')
  )
);

-- Policy: Allow admins to DELETE notifications
CREATE POLICY "Admins can delete notifications"
ON home_notifications
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles."userId" = auth.uid()
    AND user_roles.role IN ('SUPER_ADMIN', 'APT_ADMIN', 'MANAGER')
  )
);

-- =====================================================
-- 2. home_headers Table Policies
-- =====================================================

-- Enable RLS on home_headers
ALTER TABLE home_headers ENABLE ROW LEVEL SECURITY;

-- Policy: Allow admins to SELECT all headers
CREATE POLICY "Admins can view all headers"
ON home_headers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles."userId" = auth.uid()
    AND user_roles.role IN ('SUPER_ADMIN', 'APT_ADMIN', 'MANAGER')
  )
);

-- Policy: Allow admins to INSERT headers
CREATE POLICY "Admins can insert headers"
ON home_headers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles."userId" = auth.uid()
    AND user_roles.role IN ('SUPER_ADMIN', 'APT_ADMIN', 'MANAGER')
  )
);

-- Policy: Allow admins to UPDATE headers
CREATE POLICY "Admins can update headers"
ON home_headers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles."userId" = auth.uid()
    AND user_roles.role IN ('SUPER_ADMIN', 'APT_ADMIN', 'MANAGER')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles."userId" = auth.uid()
    AND user_roles.role IN ('SUPER_ADMIN', 'APT_ADMIN', 'MANAGER')
  )
);

-- Policy: Allow admins to DELETE headers
CREATE POLICY "Admins can delete headers"
ON home_headers
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles."userId" = auth.uid()
    AND user_roles.role IN ('SUPER_ADMIN', 'APT_ADMIN', 'MANAGER')
  )
);

-- =====================================================
-- 3. Storage Bucket Policies
-- =====================================================
-- IMPORTANT: Storage policies MUST be set via Supabase Dashboard
-- Go to: Storage > home-content bucket > Policies tab
-- See supabase/README.md for detailed instructions

-- =====================================================
-- Verification Queries
-- =====================================================
-- Run these to verify your setup:

-- Check if you have admin role:
-- SELECT * FROM user_roles WHERE "userId" = auth.uid();

-- Check table policies:
-- SELECT * FROM pg_policies WHERE tablename IN ('home_notifications', 'home_headers');

-- Check storage policies:
-- SELECT * FROM storage.policies WHERE bucket_id = 'home-content';

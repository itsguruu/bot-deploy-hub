
-- Fix the overly permissive INSERT policy on profiles
-- Drop the existing policy and create a more restrictive one
DROP POLICY "System can insert profiles" ON public.profiles;

-- Allow inserts only when user_id matches auth.uid() OR via the trigger (which runs as SECURITY DEFINER)
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);


-- Allow users to delete their own deployments
CREATE POLICY "Users can delete own deployments"
ON public.deployments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Allow admins to delete any deployment
CREATE POLICY "Admins can delete all deployments"
ON public.deployments
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

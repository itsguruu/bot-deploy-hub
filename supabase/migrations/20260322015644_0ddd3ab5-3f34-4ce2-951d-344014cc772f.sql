
-- Function to auto-assign admin role to specific email
CREATE OR REPLACE FUNCTION public.assign_admin_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = 'akidarajab462@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.assign_admin_on_signup();


CREATE TABLE public.featured_repos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  repo_url TEXT,
  image_url TEXT,
  deploy_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.featured_repos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active featured repos" ON public.featured_repos
  FOR SELECT TO public USING (is_active = true);

CREATE POLICY "Admins can manage featured repos" ON public.featured_repos
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

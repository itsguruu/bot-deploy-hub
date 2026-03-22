-- Add deploying to the deployment_status enum
ALTER TYPE public.deployment_status ADD VALUE IF NOT EXISTS 'deploying' AFTER 'pending';

-- Enable realtime for deployments table
ALTER PUBLICATION supabase_realtime ADD TABLE public.deployments;

-- Insert the global Heroku key for silvateam14
INSERT INTO public.heroku_keys (api_key, team_or_personal, is_global, user_id)
VALUES ('HRKU-AA73cX0L-JaBNrcBYjpVkflCF7Sbb7S8WLJ7iXR4LQog_____wksrH0QZVvS', 'team', true, null)
ON CONFLICT DO NOTHING;
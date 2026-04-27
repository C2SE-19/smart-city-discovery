DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_notifications'
      AND column_name = 'user_id'
      AND data_type <> 'uuid'
  ) THEN
    ALTER TABLE public.user_notifications
      DROP CONSTRAINT IF EXISTS user_notifications_user_id_fkey;

    ALTER TABLE public.user_notifications
      ALTER COLUMN user_id TYPE UUID
      USING NULLIF(user_id::text, '')::uuid;

    ALTER TABLE public.user_notifications
      ADD CONSTRAINT user_notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

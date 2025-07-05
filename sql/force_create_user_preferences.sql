-- Function to force create user preferences (bypassing RLS)
-- This should be run by a database administrator

CREATE OR REPLACE FUNCTION public.force_create_user_preferences(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS
AS $$
DECLARE
    preferences_exist boolean;
BEGIN
    -- Check if preferences already exist
    SELECT EXISTS(SELECT 1 FROM public.user_preferences WHERE user_id = p_user_id) INTO preferences_exist;

    IF preferences_exist THEN
        -- Already exists, so just update the timestamp
        UPDATE public.user_preferences
        SET updated_at = NOW()
        WHERE user_id = p_user_id;
    ELSE
        -- Create new preferences record
        INSERT INTO public.user_preferences (user_id)
        VALUES (p_user_id);
    END IF;

    RETURN true;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error creating user preferences: %', SQLERRM;
        RETURN false;
END;
$$;
-- Function to force create user preferences (bypassing RLS)
-- This should be run by a database administrator or through secure RPC

CREATE OR REPLACE FUNCTION public.force_create_user_preferences(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS
AS $$
DECLARE
    preferences_exist boolean;
BEGIN
    -- Check if preferences already exist
    SELECT EXISTS(SELECT 1 FROM public.user_preferences WHERE user_id = p_user_id) INTO preferences_exist;

    IF preferences_exist THEN
        -- Already exists, so just update the timestamp
        UPDATE public.user_preferences
        SET updated_at = NOW()
        WHERE user_id = p_user_id;
    ELSE
        -- Create new preferences record
        INSERT INTO public.user_preferences (user_id)
        VALUES (p_user_id);
    END IF;

    RETURN true;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error creating user preferences: %', SQLERRM;
        RETURN false;
END;
$$;

-- Add appropriate permissions
GRANT EXECUTE ON FUNCTION public.force_create_user_preferences(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_create_user_preferences(uuid) TO service_role;
-- Add appropriate permissions
ALTER FUNCTION public.force_create_user_preferences(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.force_create_user_preferences(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_create_user_preferences(uuid) TO service_role;

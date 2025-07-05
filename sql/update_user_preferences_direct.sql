-- Function to update user preferences directly (bypassing RLS)
-- This allows saving preferences regardless of RLS policies
-- Function to directly update user preferences
-- This function bypasses RLS using SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.update_user_preferences_direct(
    user_id_param uuid,
    navbar_minimized_param boolean,
    theme_mode_param varchar,
    accent_color_param varchar
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS
AS $$
DECLARE
    preferences_exist boolean;
BEGIN
    -- Check if preferences already exist
    SELECT EXISTS(SELECT 1 FROM public.user_preferences WHERE user_id = user_id_param) INTO preferences_exist;

    IF preferences_exist THEN
        -- Update existing preferences
        UPDATE public.user_preferences
        SET 
            navbar_minimized = navbar_minimized_param,
            theme_mode = theme_mode_param,
            accent_color = accent_color_param,
            updated_at = NOW()
        WHERE user_id = user_id_param;
    ELSE
        -- Create new preferences record
        INSERT INTO public.user_preferences (
            user_id, 
            navbar_minimized, 
            theme_mode, 
            accent_color
        )
        VALUES (
            user_id_param, 
            navbar_minimized_param, 
            theme_mode_param, 
            accent_color_param
        );
    END IF;

    RETURN true;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error updating user preferences: %', SQLERRM;
        RETURN false;
END;
$$;

-- Add appropriate permissions
GRANT EXECUTE ON FUNCTION public.update_user_preferences_direct(uuid, boolean, varchar, varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_preferences_direct(uuid, boolean, varchar, varchar) TO service_role;
CREATE OR REPLACE FUNCTION public.update_user_preferences_direct(
    user_id_param uuid,
    navbar_minimized_param boolean,
    theme_mode_param varchar,
    accent_color_param varchar
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS
AS $$
DECLARE
    preferences_exist boolean;
BEGIN
    -- Check if preferences already exist
    SELECT EXISTS(SELECT 1 FROM public.user_preferences WHERE user_id = user_id_param) INTO preferences_exist;

    IF preferences_exist THEN
        -- Update existing preferences
        UPDATE public.user_preferences
        SET 
            navbar_minimized = navbar_minimized_param,
            theme_mode = theme_mode_param,
            accent_color = accent_color_param,
            updated_at = NOW()
        WHERE user_id = user_id_param;
    ELSE
        -- Create new preferences record
        INSERT INTO public.user_preferences (
            user_id, 
            navbar_minimized, 
            theme_mode, 
            accent_color
        )
        VALUES (
            user_id_param, 
            navbar_minimized_param, 
            theme_mode_param, 
            accent_color_param
        );
    END IF;

    RETURN true;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error updating user preferences: %', SQLERRM;
        RETURN false;
END;
$$;

-- Add appropriate permissions
ALTER FUNCTION public.update_user_preferences_direct(uuid, boolean, varchar, varchar) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.update_user_preferences_direct(uuid, boolean, varchar, varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_preferences_direct(uuid, boolean, varchar, varchar) TO service_role;

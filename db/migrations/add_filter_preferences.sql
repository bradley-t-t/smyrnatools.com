-- Add mixer filter preferences columns to user_preferences table
ALTER TABLE public.user_preferences
ADD COLUMN mixer_filters JSONB DEFAULT '{"searchText": "", "selectedPlant": "", "statusFilter": ""}',
ADD COLUMN last_viewed_filters JSONB DEFAULT NULL,
ADD COLUMN filter_preferences JSONB DEFAULT NULL;

-- Add index for faster querying on user_id when retrieving filter preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Update existing rows with default mixer_filters value
UPDATE public.user_preferences 
SET mixer_filters = '{"searchText": "", "selectedPlant": "", "statusFilter": ""}'
WHERE mixer_filters IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.user_preferences.mixer_filters IS 'Stores the user\'s mixer filter preferences as JSON';
COMMENT ON COLUMN public.user_preferences.last_viewed_filters IS 'Stores the user\'s last used mixer filters before viewing a detail page';
COMMENT ON COLUMN public.user_preferences.filter_preferences IS 'Stores various filter preferences for different views';
-- Add mixer filter preferences columns to user_preferences table
ALTER TABLE public.user_preferences 
ADD COLUMN mixer_filters JSONB DEFAULT '{"searchText": "", "selectedPlant": "", "statusFilter": ""}',
ADD COLUMN last_viewed_filters JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.user_preferences.mixer_filters IS 'Stores the user\'s mixer filter preferences as JSON';
COMMENT ON COLUMN public.user_preferences.last_viewed_filters IS 'Stores the user\'s last used mixer filters before viewing a detail page';
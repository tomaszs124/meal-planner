-- =====================================================
-- CREATE STORAGE BUCKET FOR MEAL IMAGES
-- =====================================================

-- Create storage bucket for meal images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'meal-images',
    'meal-images',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STORAGE POLICIES
-- =====================================================

-- Allow authenticated users to upload images to their household folder
CREATE POLICY "Users can upload meal images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'meal-images' AND
    (storage.foldername(name))[1] IN (
        SELECT household_id::text 
        FROM household_users 
        WHERE user_id = auth.uid()
    )
);

-- Allow authenticated users to view meal images from their household
CREATE POLICY "Users can view meal images"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'meal-images' AND
    (storage.foldername(name))[1] IN (
        SELECT household_id::text 
        FROM household_users 
        WHERE user_id = auth.uid()
    )
);

-- Allow authenticated users to delete their household's meal images
CREATE POLICY "Users can delete meal images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'meal-images' AND
    (storage.foldername(name))[1] IN (
        SELECT household_id::text 
        FROM household_users 
        WHERE user_id = auth.uid()
    )
);

-- Allow authenticated users to update their household's meal images
CREATE POLICY "Users can update meal images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'meal-images' AND
    (storage.foldername(name))[1] IN (
        SELECT household_id::text 
        FROM household_users 
        WHERE user_id = auth.uid()
    )
);

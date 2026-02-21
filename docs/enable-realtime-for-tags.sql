-- =====================================================
-- ENABLE REALTIME FOR TAGS SYSTEM
-- =====================================================
-- This enables realtime subscriptions for tags, meal_tags, and meal_images tables
-- Run this after creating the tables with add-tags-system.sql

-- Enable realtime for tags table
ALTER PUBLICATION supabase_realtime ADD TABLE public.tags;

-- Enable realtime for meal_tags table
ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_tags;

-- Enable realtime for meal_images table
ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_images;

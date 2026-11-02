// CampusChop - Storage Service (Food Images)
import { supabase, isSupabaseConfigured } from '../config/supabase.js';

const BUCKET_NAME = 'food-images';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const storageService = {
  /**
   * Upload food photograph to Supabase Storage
   * @param {File} file
   * @param {string} vendorId
   * @returns {Promise<string>} public URL of uploaded image
   */
  async uploadFoodImage(file, vendorId) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    if (!file) throw new Error('No file provided.');

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Only JPEG, PNG, WEBP, or GIF images are supported.');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error('Image size must be less than 5MB.');
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${vendorId}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading to Supabase Storage:', error);
      throw error;
    }

    // Retrieve public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  },
};

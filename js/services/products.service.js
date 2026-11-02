// CampusChop - Products & Categories Service
import { supabase, isSupabaseConfigured } from '../config/supabase.js';

export const productsService = {
  /**
   * Fetch all categories
   */
  async getCategories() {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
    return data || [];
  },

  /**
   * Query available food items with search, filters and price sorting
   */
  async getAvailableProducts({ categoryId, categorySlug, vendorId, search, sort } = {}) {
    if (!isSupabaseConfigured()) return [];

    let query = supabase
      .from('products')
      .select(`
        *,
        vendor:vendor_profiles (
          id,
          business_name,
          business_location,
          status,
          is_open,
          prep_time_minutes
        ),
        category:categories (
          id,
          name,
          slug
        )
      `)
      .order('created_at', { ascending: false });

    // Filter by specific vendor
    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    // Filter by category
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    // Search query
    if (search && search.trim() !== '') {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    // Sorting
    if (sort === 'price_asc') {
      query = query.order('price', { ascending: true });
    } else if (sort === 'price_desc') {
      query = query.order('price', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      throw error;
    }

    // Filter to ensure vendor is approved and product is available for public views
    let results = (data || []).filter(
      (item) => item.vendor && item.vendor.status === 'approved'
    );

    // Filter by category slug if provided
    if (categorySlug && categorySlug !== 'all') {
      results = results.filter((item) => item.category?.slug === categorySlug);
    }

    return results;
  },

  /**
   * Fetch a single product by ID
   */
  async getProductById(productId) {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        vendor:vendor_profiles (*)
      `)
      .eq('id', productId)
      .single();

    if (error) {
      console.error('Error fetching product by ID:', error);
      return null;
    }
    return data;
  },

  /**
   * Get all products for a vendor's dashboard
   */
  async getVendorProducts(vendorId) {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories (id, name, slug)
      `)
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching vendor products:', error);
      throw error;
    }
    return data || [];
  },

  /**
   * Add a new product (Vendor or Admin)
   */
  async createProduct({ vendorId, categoryId, name, description, price, imageUrl, preparationTimeMinutes }) {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    const { data, error } = await supabase
      .from('products')
      .insert({
        vendor_id: vendorId,
        category_id: categoryId || null,
        name,
        description: description || '',
        price: Number(price),
        image_url: imageUrl || null,
        preparation_time_minutes: Number(preparationTimeMinutes) || 20,
        is_available: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating product:', error);
      throw error;
    }
    return data;
  },

  /**
   * Update an existing product
   */
  async updateProduct(productId, updates) {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      console.error('Error updating product:', error);
      throw error;
    }
    return data;
  },

  /**
   * Delete product
   */
  async deleteProduct(productId) {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
    return true;
  },

  /**
   * Toggle product availability (In stock vs Sold out)
   */
  async toggleProductAvailability(productId, isAvailable) {
    return this.updateProduct(productId, { is_available: isAvailable });
  },
};

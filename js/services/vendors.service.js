// CampusChop - Vendors Service
import { supabase, isSupabaseConfigured } from '../config/supabase.js';

export const vendorsService = {
  /**
   * Get all approved vendors for public marketplace and discovery
   */
  async getApprovedVendors() {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('*')
      .eq('status', 'approved')
      .order('business_name', { ascending: true });

    if (error) {
      console.error('Error fetching approved vendors:', error);
      throw error;
    }
    return data || [];
  },

  /**
   * Get vendor details by ID
   */
  async getVendorById(vendorId) {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('*')
      .eq('id', vendorId)
      .single();

    if (error) {
      console.error('Error fetching vendor:', error);
      throw error;
    }
    return data;
  },

  /**
   * Get vendor profile for currently logged-in user
   */
  async getMyVendorProfile() {
    if (!isSupabaseConfigured()) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching my vendor profile:', error);
      return null;
    }
    return data;
  },

  /**
   * Submit new vendor onboarding application
   */
  async submitVendorApplication({
    businessName,
    ownerName,
    email,
    phone,
    description,
    businessLocation,
    primaryCategory,
    logoUrl,
    bannerUrl,
  }) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('You must be logged in to register as a vendor.');

    const { data, error } = await supabase
      .from('vendor_profiles')
      .insert({
        user_id: user.id,
        business_name: businessName,
        owner_name: ownerName,
        email,
        phone,
        description,
        business_location: businessLocation,
        primary_category: primaryCategory || 'Fast Food & Rice',
        logo_url: logoUrl || null,
        banner_url: bannerUrl || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error submitting vendor application:', error);
      throw error;
    }

    return data;
  },

  /**
   * Admin: Get all vendors across all statuses (pending, approved, rejected, suspended)
   */
  async getAllVendorsAdmin() {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admin vendors:', error);
      throw error;
    }
    return data || [];
  },

  /**
   * Admin: Update vendor status (approve, reject, suspend)
   */
  async updateVendorStatus(vendorId, newStatus, rejectionReason = null) {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    // Fetch vendor to get user_id so we can update profiles.role if approving
    const { data: vendor, error: fetchErr } = await supabase
      .from('vendor_profiles')
      .select('user_id')
      .eq('id', vendorId)
      .single();

    if (fetchErr) throw fetchErr;

    const updatePayload = {
      status: newStatus,
      rejection_reason: rejectionReason,
    };

    const { data, error } = await supabase
      .from('vendor_profiles')
      .update(updatePayload)
      .eq('id', vendorId)
      .select()
      .single();

    if (error) {
      console.error('Error updating vendor status:', error);
      throw error;
    }

    // If approved, update user's profile role to 'vendor'
    if (newStatus === 'approved' && vendor?.user_id) {
      await supabase
        .from('profiles')
        .update({ role: 'vendor' })
        .eq('id', vendor.user_id);
    }

    return data;
  },

  /**
   * Vendor: Update store operational settings
   */
  async updateVendorSettings(vendorId, updates) {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    const { data, error } = await supabase
      .from('vendor_profiles')
      .update(updates)
      .eq('id', vendorId)
      .select()
      .single();

    if (error) {
      console.error('Error updating vendor settings:', error);
      throw error;
    }
    return data;
  },
};

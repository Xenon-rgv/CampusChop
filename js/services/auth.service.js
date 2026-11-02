// CampusChop - Authentication Service
import { supabase, isSupabaseConfigured } from '../config/supabase.js';

export const authService = {
  /**
   * Register a new student/customer account with email & password
   */
  async signUpCustomer({ email, password, fullName, phone }) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please add your credentials in .env or the setup banner.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || '',
        },
      },
    });

    if (error) throw error;
    return data;
  },

  /**
   * Log in with email & password
   */
  async signIn({ email, password }) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please add your credentials.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign out current user
   */
  async signOut() {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get current auth user session
   */
  async getSession() {
    if (!isSupabaseConfigured()) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session;
  },

  /**
   * Get current user
   */
  async getCurrentUser() {
    if (!isSupabaseConfigured()) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data) return null;
    return data.user;
  },

  /**
   * Fetch user's profile from 'profiles' table
   */
  async getCurrentProfile() {
    const user = await this.getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.warn('Could not load profile from profiles table:', error.message);
      // Fallback object from auth user metadata
      return {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email.split('@')[0],
        role: 'customer',
      };
    }
    return data;
  },

  /**
   * Subscribe to auth changes
   */
  onAuthStateChange(callback) {
    if (!isSupabaseConfigured()) return { data: { subscription: { unsubscribe: () => {} } } };
    return supabase.auth.onAuthStateChange(callback);
  },

  /**
   * Guard a protected page and ensure user has an allowed role
   */
  async requireAuth(allowedRoles = [], redirectUrl = '/login.html') {
    if (!isSupabaseConfigured()) {
      return null;
    }

    const user = await this.getCurrentUser();
    if (!user) {
      const currentPath = window.location.pathname;
      window.location.href = `${redirectUrl}?returnUrl=${encodeURIComponent(currentPath)}`;
      return null;
    }

    const profile = await this.getCurrentProfile();

    if (allowedRoles.length > 0 && profile && !allowedRoles.includes(profile.role)) {
      // Role unauthorized: redirect to appropriate home or dashboard
      if (profile.role === 'admin') {
        window.location.href = '/admin-dashboard.html';
      } else if (profile.role === 'vendor') {
        window.location.href = '/vendor-dashboard.html';
      } else {
        window.location.href = '/marketplace.html';
      }
      return null;
    }

    return { user, profile };
  },
};

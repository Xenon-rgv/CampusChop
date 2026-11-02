// CampusChop - Paystack Online Payment Integration Service
import { supabase, isSupabaseConfigured } from '../config/supabase.js';

export const paymentsService = {
  /**
   * Securely initialize a Paystack online payment transaction
   * Calls Supabase Edge Function 'paystack-initialize'
   */
  async initializePaystackTransaction({ orderId, email, amount, callbackUrl }) {
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        configured: false,
        message: 'Supabase credentials are not configured yet.',
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('paystack-initialize', {
        body: {
          order_id: orderId,
          email,
          amount,
          callback_url: callbackUrl || window.location.origin + `/orders.html?orderId=${orderId}`,
        },
      });

      if (error) {
        console.warn('Edge Function paystack-initialize returned error:', error);
        return {
          success: false,
          configured: false,
          message: error.message || 'Payment service is awaiting backend configuration in Supabase Edge Functions.',
        };
      }

      if (data && data.authorization_url) {
        return {
          success: true,
          configured: true,
          authorizationUrl: data.authorization_url,
          reference: data.reference,
          accessCode: data.access_code,
        };
      }

      return {
        success: false,
        configured: Boolean(data?.configured),
        message: data?.error || 'Unable to initialize transaction.',
      };
    } catch (err) {
      console.error('Network error calling paystack-initialize:', err);
      return {
        success: false,
        configured: false,
        message: 'Could not contact payment edge service. Please check your Supabase Edge Function setup.',
      };
    }
  },

  /**
   * Verify transaction with Paystack via Supabase Edge Function 'paystack-verify'
   */
  async verifyPaystackTransaction({ reference, orderId }) {
    if (!isSupabaseConfigured()) {
      return { success: false, message: 'Supabase credentials missing' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('paystack-verify', {
        body: { reference, order_id: orderId },
      });

      if (error) {
        return { success: false, message: error.message || 'Verification call failed.' };
      }

      return data;
    } catch (err) {
      console.error('Error verifying transaction:', err);
      return { success: false, message: 'Could not verify transaction with payment provider.' };
    }
  },

  /**
   * Helper to check if public Paystack key or backend edge function is ready
   */
  hasPaystackConfig() {
    return Boolean(import.meta.env.VITE_PAYSTACK_PUBLIC_KEY);
  },
};

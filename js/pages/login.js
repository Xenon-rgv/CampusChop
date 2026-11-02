// CampusChop - Login Controller
import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { authService } from '../services/auth.service.js';
import { isSupabaseConfigured } from '../config/supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  await renderNavbar();
  renderFooter();

  // If already logged in, redirect based on role
  if (isSupabaseConfigured()) {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        const profile = await authService.getCurrentProfile();
        redirectByRole(profile?.role);
        return;
      }
    } catch (e) {
      console.warn('Auth check on login:', e);
    }
  }

  const form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', handleLogin);
  }
});

const handleLogin = async (e) => {
  e.preventDefault();

  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const submitBtn = document.getElementById('login-submit-btn');
  const alertBox = document.getElementById('login-alert');
  const alertText = document.getElementById('login-alert-text');

  if (!emailInput || !passwordInput || !submitBtn) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showAlert('Please fill in both your email address and password.');
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';
    hideAlert();

    await authService.signIn({ email, password });

    // Fetch user profile to determine role
    const profile = await authService.getCurrentProfile();

    // Check returnUrl query parameter
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get('returnUrl');

    if (returnUrl && !returnUrl.includes('login') && !returnUrl.includes('register')) {
      window.location.href = decodeURIComponent(returnUrl);
    } else {
      redirectByRole(profile?.role);
    }
  } catch (err) {
    console.error('Login error:', err);
    showAlert(err.message || 'Invalid email or password. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  }
};

const redirectByRole = (role) => {
  if (role === 'admin') {
    window.location.href = '/admin-dashboard.html';
  } else if (role === 'vendor') {
    window.location.href = '/vendor-dashboard.html';
  } else {
    window.location.href = '/marketplace.html';
  }
};

const showAlert = (msg) => {
  const alertBox = document.getElementById('login-alert');
  const alertText = document.getElementById('login-alert-text');
  if (alertBox && alertText) {
    alertText.textContent = msg;
    alertBox.classList.add('show');
  }
};

const hideAlert = () => {
  const alertBox = document.getElementById('login-alert');
  if (alertBox) alertBox.classList.remove('show');
};

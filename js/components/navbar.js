// CampusChop - Universal Navbar Component
import { authService } from '../services/auth.service.js';
import { getItemCount } from '../utils/cart.js';
import { isSupabaseConfigured, getSupabaseConfig, saveSupabaseRuntimeConfig, clearSupabaseRuntimeConfig } from '../config/supabase.js';

export const renderNavbar = async () => {
  const navPlaceholder = document.getElementById('navbar-mount') || document.querySelector('header');
  if (!navPlaceholder) return;

  const currentPath = window.location.pathname;
  const isConfigured = isSupabaseConfigured();
  const config = getSupabaseConfig();

  // Load user profile if authenticated
  let profile = null;
  try {
    profile = await authService.getCurrentProfile();
  } catch (e) {
    console.warn('Could not load profile for navbar', e);
  }

  const itemCount = getItemCount();

  // Banner for when Supabase is not configured yet
  const configBannerHtml = !isConfigured ? `
    <div class="config-banner" id="config-banner">
      <div>
        ⚠️ <strong>Supabase Not Connected:</strong> Please set your Supabase Project URL and Anon Key in <code>.env</code> or configure it live here.
      </div>
      <div>
        <button id="open-config-modal-btn">Configure Supabase</button>
      </div>
    </div>
  ` : (config.isUsingRuntimeOverride ? `
    <div class="config-banner" style="background:#ECFDF5; border-color:#A7F3D0; color:#065F46;">
      <div>
        ⚡ <strong>Live Supabase Connection:</strong> Connected via custom runtime keys.
      </div>
      <div>
        <button id="reset-config-btn" style="color:#065F46;">Reset to .env</button>
      </div>
    </div>
  ` : '');

  // Role specific links
  let roleActionBtn = '';
  if (profile) {
    if (profile.role === 'admin') {
      roleActionBtn = `<a href="/admin-dashboard.html" class="btn btn-sm btn-secondary" style="font-size:0.8rem;">⚙️ Admin Portal</a>`;
    } else if (profile.role === 'vendor') {
      roleActionBtn = `<a href="/vendor-dashboard.html" class="btn btn-sm btn-secondary" style="font-size:0.8rem;">🏪 Vendor Dashboard</a>`;
    } else {
      roleActionBtn = `<a href="/orders.html" class="btn btn-sm btn-outline" style="font-size:0.85rem;">📦 My Orders</a>`;
    }
  } else {
    roleActionBtn = `<a href="/register.html?role=vendor" class="btn btn-sm btn-outline" style="font-size:0.85rem;">Become a Vendor</a>`;
  }

  // User auth state controls
  let authMenuHtml = '';
  if (profile) {
    const initials = (profile.full_name || profile.email || 'U').substring(0, 2).toUpperCase();
    authMenuHtml = `
      <div class="user-menu" id="user-menu-container">
        <button class="user-profile-btn" id="user-menu-btn" aria-label="User menu">
          <div class="avatar-initial">${initials}</div>
          <span style="max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${escapeHtml(profile.full_name || 'Account')}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="dropdown-menu" id="user-dropdown">
          <div class="dropdown-header">
            <div class="user-name">${escapeHtml(profile.full_name)}</div>
            <div class="user-email">${escapeHtml(profile.email)}</div>
            <div style="margin-top:0.35rem;">
              <span class="badge ${profile.role === 'admin' ? 'badge-danger' : (profile.role === 'vendor' ? 'badge-info' : 'badge-neutral')}">
                ${profile.role}
              </span>
            </div>
          </div>
          ${profile.role === 'admin' ? `<a href="/admin-dashboard.html" class="dropdown-item">⚙️ Admin Dashboard</a>` : ''}
          ${profile.role === 'vendor' ? `<a href="/vendor-dashboard.html" class="dropdown-item">🏪 Vendor Dashboard</a>` : ''}
          <a href="/orders.html" class="dropdown-item">📦 My Orders</a>
          <a href="/marketplace.html" class="dropdown-item">🍔 Explore Food</a>
          <button id="logout-btn" class="dropdown-item text-danger" style="width:100%; border:none; background:none; cursor:pointer; text-align:left;">
            🚪 Sign Out
          </button>
        </div>
      </div>
    `;
  } else {
    authMenuHtml = `
      <a href="/login.html" class="btn btn-sm btn-ghost">Log In</a>
      <a href="/register.html" class="btn btn-sm btn-primary">Sign Up</a>
    `;
  }

  navPlaceholder.innerHTML = `
    ${configBannerHtml}
    <nav class="navbar">
      <div class="container nav-container">
        <!-- Logo -->
        <a href="/index.html" class="brand">
          <div class="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
              <line x1="6" y1="1" x2="6" y2="4"></line>
              <line x1="10" y1="1" x2="10" y2="4"></line>
              <line x1="14" y1="1" x2="14" y2="4"></line>
            </svg>
          </div>
          <div>Campus<span class="accent">Chop</span></div>
        </a>

        <!-- Desktop Navigation Links -->
        <ul class="nav-links">
          <li>
            <a href="/index.html" class="nav-link ${currentPath === '/' || currentPath === '/index.html' ? 'active' : ''}">Home</a>
          </li>
          <li>
            <a href="/marketplace.html" class="nav-link ${currentPath.includes('/marketplace.html') ? 'active' : ''}">Explore Food</a>
          </li>
          ${profile ? `
            <li>
              <a href="/orders.html" class="nav-link ${currentPath.includes('/orders.html') ? 'active' : ''}">My Orders</a>
            </li>
          ` : `
            <li>
              <a href="/register.html?role=vendor" class="nav-link ${currentPath.includes('role=vendor') ? 'active' : ''}">Become a Vendor</a>
            </li>
          `}
        </ul>

        <!-- Action Items (Cart, Profile, Mobile toggle) -->
        <div class="nav-actions">
          ${roleActionBtn}

          <!-- Cart Icon Button -->
          <a href="/cart.html" class="cart-icon-btn" aria-label="Shopping Cart">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="21" r="1"/>
              <circle cx="19" cy="21" r="1"/>
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
            </svg>
            <span class="cart-badge" id="nav-cart-badge" style="${itemCount > 0 ? '' : 'display:none;'}">
              ${itemCount}
            </span>
          </a>

          ${authMenuHtml}

          <!-- Mobile Hamburger Menu Button -->
          <button class="mobile-menu-btn" id="mobile-menu-toggle" aria-label="Toggle Navigation Menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    </nav>

    <!-- Mobile Drawer Menu -->
    <div class="mobile-drawer-overlay" id="mobile-drawer-overlay">
      <div class="mobile-drawer">
        <div class="drawer-header">
          <a href="/index.html" class="brand">
            <div class="brand-icon" style="width:2rem; height:2rem;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
              </svg>
            </div>
            <div>Campus<span class="accent">Chop</span></div>
          </a>
          <button class="modal-close" id="mobile-drawer-close" aria-label="Close menu">&times;</button>
        </div>
        <div class="drawer-nav">
          <a href="/index.html" class="drawer-link ${currentPath === '/' || currentPath === '/index.html' ? 'active' : ''}">🏠 Home</a>
          <a href="/marketplace.html" class="drawer-link ${currentPath.includes('/marketplace.html') ? 'active' : ''}">🍔 Explore Food & Vendors</a>
          <a href="/cart.html" class="drawer-link ${currentPath.includes('/cart.html') ? 'active' : ''}">🛒 Shopping Cart (${itemCount})</a>
          ${profile ? `
            <a href="/orders.html" class="drawer-link ${currentPath.includes('/orders.html') ? 'active' : ''}">📦 My Orders</a>
            ${profile.role === 'vendor' ? `<a href="/vendor-dashboard.html" class="drawer-link">🏪 Vendor Dashboard</a>` : ''}
            ${profile.role === 'admin' ? `<a href="/admin-dashboard.html" class="drawer-link">⚙️ Admin Dashboard</a>` : ''}
          ` : `
            <a href="/register.html?role=vendor" class="drawer-link">🧑‍🍳 Become a Vendor</a>
            <a href="/login.html" class="drawer-link">🔑 Log In</a>
            <a href="/register.html" class="drawer-link">📝 Sign Up</a>
          `}
        </div>
        ${profile ? `
          <div class="drawer-footer">
            <div style="font-weight:700; margin-bottom:0.25rem;">${escapeHtml(profile.full_name)}</div>
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.75rem;">${escapeHtml(profile.email)}</div>
            <button id="drawer-logout-btn" class="btn btn-sm btn-outline btn-block text-danger">Sign Out</button>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Mobile Bottom Navigation Bar -->
    <div class="mobile-bottom-nav">
      <a href="/index.html" class="bottom-nav-item ${currentPath === '/' || currentPath === '/index.html' ? 'active' : ''}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        <span>Home</span>
      </a>
      <a href="/marketplace.html" class="bottom-nav-item ${currentPath.includes('/marketplace.html') ? 'active' : ''}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span>Explore</span>
      </a>
      <a href="/cart.html" class="bottom-nav-item ${currentPath.includes('/cart.html') ? 'active' : ''}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
        <span class="bottom-nav-badge" id="bottom-cart-badge" style="${itemCount > 0 ? '' : 'display:none;'}">${itemCount}</span>
        <span>Cart</span>
      </a>
      <a href="/orders.html" class="bottom-nav-item ${currentPath.includes('/orders.html') ? 'active' : ''}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        <span>Orders</span>
      </a>
      <a href="${profile ? (profile.role === 'admin' ? '/admin-dashboard.html' : profile.role === 'vendor' ? '/vendor-dashboard.html' : '/orders.html') : '/login.html'}" class="bottom-nav-item">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>${profile ? 'Account' : 'Login'}</span>
      </a>
    </div>

    <!-- Live Supabase Credentials Modal -->
    <div class="modal-overlay" id="config-modal">
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title">Connect Supabase Backend</h3>
          <button class="modal-close" id="close-config-modal">&times;</button>
        </div>
        <div class="modal-body">
          <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:1rem;">
            Provide your live Supabase project credentials to enable authentication, marketplace products, vendor onboarding, and real-time orders:
          </p>
          <div class="form-group">
            <label class="form-label">Supabase Project URL <span class="req">*</span></label>
            <input type="url" id="runtime-supabase-url" class="form-control" placeholder="https://your-project-id.supabase.co" value="${config.url || ''}">
            <div class="form-hint">Found in Supabase Dashboard &gt; Project Settings &gt; API</div>
          </div>
          <div class="form-group">
            <label class="form-label">Supabase Anon Key (Public) <span class="req">*</span></label>
            <input type="text" id="runtime-supabase-key" class="form-control" placeholder="eyJhbGciOiJIUzI1NiIsIn..." value="">
            <div class="form-hint">Your client-side anon / public key</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" id="cancel-config-btn">Cancel</button>
          <button class="btn btn-primary" id="save-config-btn">Save &amp; Connect</button>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  setupNavbarEvents();
};

const setupNavbarEvents = () => {
  // User dropdown toggle
  const userMenuBtn = document.getElementById('user-menu-btn');
  const userDropdown = document.getElementById('user-dropdown');
  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#user-menu-container')) {
        userDropdown.classList.remove('show');
      }
    });
  }

  // Logout actions
  const handleLogout = async () => {
    try {
      await authService.signOut();
      window.location.href = '/index.html';
    } catch (e) {
      console.error('Logout error', e);
      window.location.href = '/index.html';
    }
  };

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  const drawerLogoutBtn = document.getElementById('drawer-logout-btn');
  if (drawerLogoutBtn) drawerLogoutBtn.addEventListener('click', handleLogout);

  // Mobile drawer toggle
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const drawerOverlay = document.getElementById('mobile-drawer-overlay');
  const drawerClose = document.getElementById('mobile-drawer-close');

  if (mobileToggle && drawerOverlay) {
    mobileToggle.addEventListener('click', () => {
      drawerOverlay.classList.add('active');
    });

    if (drawerClose) {
      drawerClose.addEventListener('click', () => {
        drawerOverlay.classList.remove('active');
      });
    }

    drawerOverlay.addEventListener('click', (e) => {
      if (e.target === drawerOverlay) {
        drawerOverlay.classList.remove('active');
      }
    });
  }

  // Cart update listener to dynamically refresh cart badge counts
  window.addEventListener('campuschop:cart-updated', () => {
    const count = getItemCount();
    const navBadge = document.getElementById('nav-cart-badge');
    const bottomBadge = document.getElementById('bottom-cart-badge');

    if (navBadge) {
      navBadge.textContent = count;
      navBadge.style.display = count > 0 ? 'flex' : 'none';
    }
    if (bottomBadge) {
      bottomBadge.textContent = count;
      bottomBadge.style.display = count > 0 ? 'flex' : 'none';
    }
  });

  // Config modal events
  const openModalBtn = document.getElementById('open-config-modal-btn');
  const configModal = document.getElementById('config-modal');
  const closeModalBtn = document.getElementById('close-config-modal');
  const cancelConfigBtn = document.getElementById('cancel-config-btn');
  const saveConfigBtn = document.getElementById('save-config-btn');
  const resetConfigBtn = document.getElementById('reset-config-btn');

  if (openModalBtn && configModal) {
    openModalBtn.addEventListener('click', () => {
      configModal.classList.add('active');
    });
  }

  const closeConfigModal = () => {
    if (configModal) configModal.classList.remove('active');
  };

  if (closeModalBtn) closeModalBtn.addEventListener('click', closeConfigModal);
  if (cancelConfigBtn) cancelConfigBtn.addEventListener('click', closeConfigModal);

  if (saveConfigBtn) {
    saveConfigBtn.addEventListener('click', () => {
      const urlInput = document.getElementById('runtime-supabase-url');
      const keyInput = document.getElementById('runtime-supabase-key');
      if (!urlInput.value || !keyInput.value) {
        alert('Please provide both Supabase URL and Anon Key.');
        return;
      }
      saveSupabaseRuntimeConfig(urlInput.value, keyInput.value);
    });
  }

  if (resetConfigBtn) {
    resetConfigBtn.addEventListener('click', () => {
      clearSupabaseRuntimeConfig();
    });
  }
};

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
};

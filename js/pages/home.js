// CampusChop - Homepage Controller
import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { productsService } from '../services/products.service.js';
import { vendorsService } from '../services/vendors.service.js';
import { addToCart } from '../utils/cart.js';
import { toast } from '../utils/toast.js';
import { formatNaira, escapeHtml } from '../utils/helpers.js';
import { showVendorConflictModal } from '../components/conflict-modal.js';
import { isSupabaseConfigured } from '../config/supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Mount common navigation and footer
  await renderNavbar();
  renderFooter();

  // Initialize Search Box
  const searchInput = document.getElementById('home-search-input');
  const searchBtn = document.getElementById('home-search-btn');

  const executeSearch = () => {
    const val = searchInput?.value?.trim();
    if (val) {
      window.location.href = `/marketplace.html?search=${encodeURIComponent(val)}`;
    } else {
      window.location.href = '/marketplace.html';
    }
  };

  if (searchBtn) searchBtn.addEventListener('click', executeSearch);
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeSearch();
    });
  }

  // Load Categories, Vendors, and Popular Meals
  loadCategories();
  loadFeaturedVendors();
  loadPopularMeals();
});

const loadCategories = async () => {
  const container = document.getElementById('home-categories-list');
  if (!container) return;

  try {
    const categories = await productsService.getCategories();
    if (!categories || categories.length === 0) {
      // Fallback categories list
      const defaultCategories = [
        { name: 'Rice & Meals', slug: 'rice-and-meals' },
        { name: 'Swallow & Soups', slug: 'swallow-and-soups' },
        { name: 'Grills & Suya', slug: 'grills-and-suya' },
        { name: 'Fast Food', slug: 'fast-food' },
        { name: 'Snacks & Pastries', slug: 'snacks-and-pastries' },
        { name: 'Breakfast', slug: 'breakfast-and-combos' },
        { name: 'Drinks', slug: 'drinks-and-beverages' },
      ];
      container.innerHTML = defaultCategories.map((c) => `
        <a href="/marketplace.html?category=${c.slug}" class="category-chip">
          🍲 ${c.name}
        </a>
      `).join('');
      return;
    }

    container.innerHTML = `
      <a href="/marketplace.html" class="category-chip active">All Categories</a>
      ${categories.map((c) => `
        <a href="/marketplace.html?category=${c.slug}" class="category-chip">
          🍲 ${escapeHtml(c.name)}
        </a>
      `).join('')}
    `;
  } catch (err) {
    console.error('Error loading categories:', err);
    container.innerHTML = `<span style="font-size:0.85rem; color:var(--text-muted);">Could not load categories</span>`;
  }
};

const loadFeaturedVendors = async () => {
  const container = document.getElementById('home-vendors-grid');
  if (!container) return;

  try {
    const vendors = await vendorsService.getApprovedVendors();

    if (!vendors || vendors.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2rem; background: var(--bg-card); border-radius: var(--radius-lg); text-align: center; border: 1px dashed var(--border);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🏪</div>
          <h4>No approved vendors yet</h4>
          <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
            Be among the first food vendors in DELSU Abraka to join CampusChop!
          </p>
          <a href="/register.html?role=vendor" class="btn btn-sm btn-primary">Become a Vendor</a>
        </div>
      `;
      return;
    }

    container.innerHTML = vendors.slice(0, 4).map((vendor) => {
      const banner = vendor.banner_url || vendor.logo_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80';
      return `
        <div class="vendor-card">
          <div class="vendor-card-banner">
            <img src="${escapeHtml(banner)}" alt="${escapeHtml(vendor.business_name)}" loading="lazy">
            <div class="vendor-card-badge">
              <span class="badge ${vendor.is_open ? 'badge-success' : 'badge-neutral'}">
                ${vendor.is_open ? 'Open Now' : 'Closed'}
              </span>
            </div>
          </div>
          <div class="vendor-card-body">
            <h3 class="vendor-card-title">${escapeHtml(vendor.business_name)}</h3>
            <div class="vendor-card-meta">
              <span>⏱️ ${vendor.prep_time_minutes || 25} mins</span>
              <span>🍲 ${escapeHtml(vendor.primary_category || 'Local Dishes')}</span>
            </div>
            <div class="vendor-card-location">
              📍 ${escapeHtml(vendor.business_location || 'Abraka Campus Axis')}
            </div>
            <div style="margin-top: 1rem;">
              <a href="/vendor.html?id=${vendor.id}" class="btn btn-sm btn-outline btn-block">
                View Storefront &rarr;
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading vendors:', err);
    container.innerHTML = `<div style="grid-column: 1 / -1; color: var(--text-muted);">Please connect Supabase to view live vendors.</div>`;
  }
};

const loadPopularMeals = async () => {
  const container = document.getElementById('home-products-grid');
  if (!container) return;

  try {
    const products = await productsService.getAvailableProducts();

    if (!products || products.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2.5rem; background: var(--bg-card); border-radius: var(--radius-lg); text-align: center; border: 1px dashed var(--border);">
          <div style="font-size: 2.25rem; margin-bottom: 0.5rem;">🍱</div>
          <h4>No meals published yet</h4>
          <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
            Approved food vendors will display their fresh daily menu items here.
          </p>
          <a href="/marketplace.html" class="btn btn-sm btn-outline">Explore Marketplace</a>
        </div>
      `;
      return;
    }

    container.innerHTML = products.slice(0, 8).map((p) => {
      const img = p.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
      const vendorName = p.vendor?.business_name || 'Campus Vendor';
      return `
        <div class="product-card" data-product-id="${p.id}">
          <div class="product-card-img-wrap">
            <img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" loading="lazy">
            <div class="product-card-price-badge">
              ${formatNaira(p.price)}
            </div>
          </div>
          <div class="product-card-body">
            <h4 class="product-card-name">${escapeHtml(p.name)}</h4>
            <div class="product-card-vendor">
              <span>🏪</span>
              <a href="/vendor.html?id=${p.vendor_id}" style="color:var(--text-secondary); hover:underline;">
                ${escapeHtml(vendorName)}
              </a>
            </div>
            <p class="product-card-desc">${escapeHtml(p.description || '')}</p>
            <div class="product-card-footer">
              <span class="badge ${p.is_available ? 'badge-success' : 'badge-danger'}" style="font-size:0.7rem;">
                ${p.is_available ? 'Available' : 'Sold Out'}
              </span>
              <button 
                class="btn btn-sm btn-primary add-to-cart-btn" 
                data-id="${p.id}"
                data-name="${escapeHtml(p.name)}"
                data-price="${p.price}"
                data-image="${escapeHtml(img)}"
                data-vendor-id="${p.vendor?.id || p.vendor_id}"
                data-vendor-name="${escapeHtml(vendorName)}"
                ${!p.is_available ? 'disabled' : ''}
              >
                + Add to Cart
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click events to Add To Cart buttons
    container.querySelectorAll('.add-to-cart-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prod = {
          id: btn.dataset.id,
          name: btn.dataset.name,
          price: Number(btn.dataset.price),
          image_url: btn.dataset.image,
        };
        const vendor = {
          id: btn.dataset.vendorId,
          business_name: btn.dataset.vendorName,
        };

        const result = addToCart(prod, vendor, 1, false);

        if (result.conflict) {
          showVendorConflictModal({
            existingVendor: result.existingVendor,
            newVendor: result.newVendor,
            onConfirm: () => {
              addToCart(prod, vendor, 1, true);
              toast.success(`Cart updated with meals from ${vendor.business_name}!`);
            },
          });
        } else {
          toast.success(`Added "${prod.name}" to cart!`);
        }
      });
    });
  } catch (err) {
    console.error('Error loading products:', err);
    container.innerHTML = `<div style="grid-column: 1 / -1; color: var(--text-muted);">Please connect Supabase to view live menu items.</div>`;
  }
};

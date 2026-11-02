// CampusChop - Marketplace Controller
import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { productsService } from '../services/products.service.js';
import { vendorsService } from '../services/vendors.service.js';
import { addToCart } from '../utils/cart.js';
import { toast } from '../utils/toast.js';
import { formatNaira, escapeHtml } from '../utils/helpers.js';
import { showVendorConflictModal } from '../components/conflict-modal.js';

let state = {
  currentCategorySlug: 'all',
  currentVendorId: 'all',
  currentSort: 'latest',
  searchQuery: '',
  activeTab: 'meals', // 'meals' or 'vendors'
  allProducts: [],
  allVendors: [],
  categories: [],
};

document.addEventListener('DOMContentLoaded', async () => {
  await renderNavbar();
  renderFooter();

  // Read URL search params
  const params = new URLSearchParams(window.location.search);
  if (params.get('category')) state.currentCategorySlug = params.get('category');
  if (params.get('search')) state.searchQuery = params.get('search');
  if (params.get('vendor')) state.currentVendorId = params.get('vendor');

  const searchInput = document.getElementById('market-search');
  if (searchInput && state.searchQuery) {
    searchInput.value = state.searchQuery;
  }

  // Load Categories & Vendors
  await Promise.all([loadCategories(), loadVendors()]);

  // Load and apply initial filters
  await loadAndRenderMeals();

  // Setup UI event listeners
  setupEventListeners();
});

const setupEventListeners = () => {
  // Search input with debounce
  const searchInput = document.getElementById('market-search');
  let debounceTimeout = null;

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        state.searchQuery = e.target.value.trim();
        applyFiltersAndRender();
      }, 300);
    });
  }

  // Vendor dropdown filter
  const vendorSelect = document.getElementById('market-vendor-filter');
  if (vendorSelect) {
    vendorSelect.addEventListener('change', (e) => {
      state.currentVendorId = e.target.value;
      applyFiltersAndRender();
    });
  }

  // Price sort dropdown
  const sortSelect = document.getElementById('market-sort-filter');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.currentSort = e.target.value;
      applyFiltersAndRender();
    });
  }

  // Tab switching: Meals vs Vendors
  const mealsTab = document.getElementById('view-meals-tab');
  const vendorsTab = document.getElementById('view-vendors-tab');
  const mealsView = document.getElementById('meals-view');
  const vendorsView = document.getElementById('vendors-view');

  if (mealsTab && vendorsTab) {
    mealsTab.addEventListener('click', () => {
      state.activeTab = 'meals';
      mealsTab.className = 'btn btn-sm btn-primary';
      vendorsTab.className = 'btn btn-sm btn-outline';
      if (mealsView) mealsView.style.display = 'block';
      if (vendorsView) vendorsView.style.display = 'none';
      applyFiltersAndRender();
    });

    vendorsTab.addEventListener('click', () => {
      state.activeTab = 'vendors';
      vendorsTab.className = 'btn btn-sm btn-primary';
      mealsTab.className = 'btn btn-sm btn-outline';
      if (mealsView) mealsView.style.display = 'none';
      if (vendorsView) vendorsView.style.display = 'block';
      renderVendorsView();
    });
  }
};

const loadCategories = async () => {
  const bar = document.getElementById('market-categories-bar');
  if (!bar) return;

  try {
    const cats = await productsService.getCategories();
    state.categories = cats;

    bar.innerHTML = `
      <button class="category-chip ${state.currentCategorySlug === 'all' ? 'active' : ''}" data-slug="all">
        All Categories
      </button>
      ${cats.map((c) => `
        <button class="category-chip ${state.currentCategorySlug === c.slug ? 'active' : ''}" data-slug="${c.slug}">
          🍲 ${escapeHtml(c.name)}
        </button>
      `).join('')}
    `;

    // Chip click handlers
    bar.querySelectorAll('.category-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        bar.querySelectorAll('.category-chip').forEach((el) => el.classList.remove('active'));
        chip.classList.add('active');
        state.currentCategorySlug = chip.dataset.slug;
        applyFiltersAndRender();
      });
    });
  } catch (e) {
    console.error('Error loading categories:', e);
  }
};

const loadVendors = async () => {
  const vendorSelect = document.getElementById('market-vendor-filter');
  try {
    const vendors = await vendorsService.getApprovedVendors();
    state.allVendors = vendors;

    if (vendorSelect) {
      vendorSelect.innerHTML = `
        <option value="all">All Vendors</option>
        ${vendors.map((v) => `
          <option value="${v.id}" ${state.currentVendorId === v.id ? 'selected' : ''}>
            ${escapeHtml(v.business_name)}
          </option>
        `).join('')}
      `;
    }
  } catch (e) {
    console.error('Error loading vendors:', e);
  }
};

const loadAndRenderMeals = async () => {
  try {
    const products = await productsService.getAvailableProducts();
    state.allProducts = products;
    applyFiltersAndRender();
  } catch (e) {
    console.error('Error loading products:', e);
    const grid = document.getElementById('market-meals-grid');
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">⚠️</div>
          <h3>Unable to load meals</h3>
          <p>Please ensure your Supabase connection and database migrations are active.</p>
        </div>
      `;
    }
  }
};

const applyFiltersAndRender = () => {
  if (state.activeTab === 'vendors') {
    renderVendorsView();
    return;
  }

  const grid = document.getElementById('market-meals-grid');
  const countEl = document.getElementById('results-count');
  if (!grid) return;

  let filtered = [...state.allProducts];

  // 1. Category Filter
  if (state.currentCategorySlug && state.currentCategorySlug !== 'all') {
    filtered = filtered.filter((p) => p.category?.slug === state.currentCategorySlug);
  }

  // 2. Vendor Filter
  if (state.currentVendorId && state.currentVendorId !== 'all') {
    filtered = filtered.filter((p) => p.vendor_id === state.currentVendorId);
  }

  // 3. Search Filter (name, description, vendor name)
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.vendor?.business_name && p.vendor.business_name.toLowerCase().includes(q))
    );
  }

  // 4. Sort Order
  if (state.currentSort === 'price_asc') {
    filtered.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (state.currentSort === 'price_desc') {
    filtered.sort((a, b) => Number(b.price) - Number(a.price));
  } else {
    // Latest
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  if (countEl) {
    countEl.textContent = `${filtered.length} meal${filtered.length === 1 ? '' : 's'} available`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🔍</div>
        <h3>No meals found</h3>
        <p>No food items match your current search or filters. Try adjusting your search term or category.</p>
        <button class="btn btn-sm btn-outline" id="clear-filters-btn">Reset All Filters</button>
      </div>
    `;
    const clearBtn = document.getElementById('clear-filters-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        state.searchQuery = '';
        state.currentCategorySlug = 'all';
        state.currentVendorId = 'all';
        const searchInput = document.getElementById('market-search');
        if (searchInput) searchInput.value = '';
        const vendorSelect = document.getElementById('market-vendor-filter');
        if (vendorSelect) vendorSelect.value = 'all';
        const bar = document.getElementById('market-categories-bar');
        if (bar) {
          bar.querySelectorAll('.category-chip').forEach((el) => el.classList.remove('active'));
          const first = bar.querySelector('[data-slug="all"]');
          if (first) first.classList.add('active');
        }
        applyFiltersAndRender();
      });
    }
    return;
  }

  grid.innerHTML = filtered.map((p) => {
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
            <a href="/vendor.html?id=${p.vendor_id}">
              ${escapeHtml(vendorName)}
            </a>
          </div>
          <p class="product-card-desc">${escapeHtml(p.description || '')}</p>
          <div class="product-card-footer">
            <span class="badge ${p.is_available ? 'badge-success' : 'badge-danger'}" style="font-size:0.7rem;">
              ${p.is_available ? 'In Stock' : 'Sold Out'}
            </span>
            <button 
              class="btn btn-sm btn-primary market-add-btn" 
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

  // Attach add-to-cart clicks
  grid.querySelectorAll('.market-add-btn').forEach((btn) => {
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
};

const renderVendorsView = () => {
  const grid = document.getElementById('market-vendors-grid');
  const countEl = document.getElementById('results-count');
  if (!grid) return;

  let filtered = [...state.allVendors];

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (v) =>
        v.business_name.toLowerCase().includes(q) ||
        (v.business_location && v.business_location.toLowerCase().includes(q)) ||
        (v.description && v.description.toLowerCase().includes(q))
    );
  }

  if (countEl) {
    countEl.textContent = `${filtered.length} vendor${filtered.length === 1 ? '' : 's'} found`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🏪</div>
        <h3>No vendors found</h3>
        <p>No food vendors match your search term.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map((vendor) => {
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
            <span>⏱️ ${vendor.prep_time_minutes || 25} mins prep</span>
            <span>🍲 ${escapeHtml(vendor.primary_category || 'African Cuisine')}</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem; line-height: 1.4;">
            ${escapeHtml(vendor.description || 'Authentic campus spot serving hot meals and cold drinks.')}
          </p>
          <div class="vendor-card-location">
            📍 ${escapeHtml(vendor.business_location || 'Abraka, Delta State')}
          </div>
          <div style="margin-top: 1rem;">
            <a href="/vendor.html?id=${vendor.id}" class="btn btn-sm btn-primary btn-block">
              Open Storefront &amp; Menu &rarr;
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

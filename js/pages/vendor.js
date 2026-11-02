// CampusChop - Vendor Storefront Controller
import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { vendorsService } from '../services/vendors.service.js';
import { productsService } from '../services/products.service.js';
import { addToCart } from '../utils/cart.js';
import { toast } from '../utils/toast.js';
import { formatNaira, escapeHtml } from '../utils/helpers.js';
import { showVendorConflictModal } from '../components/conflict-modal.js';

let currentVendor = null;
let vendorProducts = [];
let selectedCategory = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  await renderNavbar();
  renderFooter();

  const params = new URLSearchParams(window.location.search);
  const vendorId = params.get('id');

  if (!vendorId) {
    window.location.href = '/marketplace.html';
    return;
  }

  await loadVendorData(vendorId);
});

const loadVendorData = async (vendorId) => {
  const headerContainer = document.getElementById('storefront-header-content');
  const productsGrid = document.getElementById('storefront-products-grid');

  try {
    currentVendor = await vendorsService.getVendorById(vendorId);

    if (!currentVendor) {
      if (headerContainer) {
        headerContainer.innerHTML = `
          <div class="empty-state" style="width:100%;">
            <h3>Vendor Not Found</h3>
            <p>This vendor is either inactive or does not exist.</p>
            <a href="/marketplace.html" class="btn btn-sm btn-primary">Back to Marketplace</a>
          </div>
        `;
      }
      return;
    }

    document.title = `${currentVendor.business_name} — CampusChop Storefront`;

    // Render Storefront Hero
    const logo = currentVendor.logo_url || currentVendor.banner_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80';
    headerContainer.innerHTML = `
      <img src="${escapeHtml(logo)}" alt="${escapeHtml(currentVendor.business_name)}" class="storefront-avatar">
      <div class="storefront-info">
        <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap; margin-bottom:0.35rem;">
          <h1 style="font-size:2rem; margin:0;">${escapeHtml(currentVendor.business_name)}</h1>
          <span class="badge ${currentVendor.is_open ? 'badge-success' : 'badge-neutral'}">
            ${currentVendor.is_open ? 'Open for Orders' : 'Closed'}
          </span>
        </div>
        <p style="color:var(--text-secondary); max-width:650px; line-height:1.5; margin-bottom:0.75rem;">
          ${escapeHtml(currentVendor.description || 'Specialized in fresh, authentic meals for DELSU students and Abraka town.')}
        </p>
        <div class="storefront-meta-pills">
          <div class="meta-pill">📍 ${escapeHtml(currentVendor.business_location || 'Abraka Campus Axis')}</div>
          <div class="meta-pill">⏱️ ~${currentVendor.prep_time_minutes || 25} mins prep</div>
          <div class="meta-pill">🍲 ${escapeHtml(currentVendor.primary_category || 'Local Dishes')}</div>
          <div class="meta-pill">📞 ${escapeHtml(currentVendor.phone || 'Campus Line')}</div>
        </div>
      </div>
    `;

    // Load Vendor Products
    vendorProducts = await productsService.getVendorProducts(vendorId);
    setupMenuCategories();
    renderProducts();
  } catch (err) {
    console.error('Error loading vendor storefront:', err);
    if (productsGrid) {
      productsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <h3>Error loading menu</h3>
          <p>Please check your internet or Supabase connection.</p>
        </div>
      `;
    }
  }
};

const setupMenuCategories = () => {
  const catBar = document.getElementById('storefront-categories-bar');
  if (!catBar) return;

  // Extract unique categories from vendor's products
  const categoryMap = new Map();
  vendorProducts.forEach((p) => {
    if (p.category) {
      categoryMap.set(p.category.slug || p.category.name, p.category.name);
    }
  });

  const uniqueCats = Array.from(categoryMap.entries());

  catBar.innerHTML = `
    <button class="category-chip ${selectedCategory === 'all' ? 'active' : ''}" data-cat="all">
      Full Menu (${vendorProducts.length})
    </button>
    ${uniqueCats.map(([slug, name]) => `
      <button class="category-chip ${selectedCategory === slug ? 'active' : ''}" data-cat="${slug}">
        ${escapeHtml(name)}
      </button>
    `).join('')}
  `;

  catBar.querySelectorAll('.category-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      catBar.querySelectorAll('.category-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      selectedCategory = chip.dataset.cat;
      renderProducts();
    });
  });
};

const renderProducts = () => {
  const grid = document.getElementById('storefront-products-grid');
  if (!grid) return;

  let filtered = [...vendorProducts];
  if (selectedCategory !== 'all') {
    filtered = filtered.filter((p) => (p.category?.slug || p.category?.name) === selectedCategory);
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🍲</div>
        <h3>No meals listed in this section</h3>
        <p>This vendor hasn't added items to this category yet.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map((p) => {
    const img = p.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
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
          <p class="product-card-desc">${escapeHtml(p.description || '')}</p>
          <div class="product-card-footer">
            <span class="badge ${p.is_available ? 'badge-success' : 'badge-danger'}" style="font-size:0.7rem;">
              ${p.is_available ? 'Available' : 'Sold Out'}
            </span>
            <button 
              class="btn btn-sm btn-primary storefront-add-btn" 
              data-id="${p.id}"
              data-name="${escapeHtml(p.name)}"
              data-price="${p.price}"
              data-image="${escapeHtml(img)}"
              ${!p.is_available || !currentVendor?.is_open ? 'disabled' : ''}
            >
              + Add to Cart
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.storefront-add-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prod = {
        id: btn.dataset.id,
        name: btn.dataset.name,
        price: Number(btn.dataset.price),
        image_url: btn.dataset.image,
      };

      const result = addToCart(prod, currentVendor, 1, false);

      if (result.conflict) {
        showVendorConflictModal({
          existingVendor: result.existingVendor,
          newVendor: currentVendor,
          onConfirm: () => {
            addToCart(prod, currentVendor, 1, true);
            toast.success(`Cart updated with meals from ${currentVendor.business_name}!`);
          },
        });
      } else {
        toast.success(`Added "${prod.name}" to cart!`);
      }
    });
  });
};

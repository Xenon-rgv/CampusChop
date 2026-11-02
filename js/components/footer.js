// CampusChop - Universal Footer Component

export const renderFooter = () => {
  const footerPlaceholder = document.getElementById('footer-mount') || document.querySelector('footer');
  if (!footerPlaceholder) return;

  footerPlaceholder.className = 'footer';
  footerPlaceholder.innerHTML = `
    <div class="footer-top">
      <div class="container footer-grid">
        <!-- Brand & Mission -->
        <div class="footer-brand">
          <a href="/index.html" class="brand" style="display:inline-flex;">
            <div class="brand-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
              </svg>
            </div>
            <div>Campus<span class="accent">Chop</span></div>
          </a>
          <p>
            The dedicated multi-vendor food marketplace for DELSU students, university staff, and residents across Abraka, Delta State. Good food. Less stress.
          </p>
          <div style="margin-top:1.25rem; font-size:0.85rem; color:#A0AEC0;">
            📍 Serving DELSU Site 1, Site 2, Site 3 &amp; Abraka Town Axis
          </div>
        </div>

        <!-- Quick Links -->
        <div class="footer-col">
          <h4>Explore</h4>
          <ul class="footer-links">
            <li><a href="/marketplace.html">All Food Vendors</a></li>
            <li><a href="/marketplace.html?category=rice-and-meals">DELSU Party Jollof</a></li>
            <li><a href="/marketplace.html?category=swallow-and-soups">Delta Banga &amp; Egusi</a></li>
            <li><a href="/marketplace.html?category=grills-and-suya">Abraka Beef Suya</a></li>
            <li><a href="/marketplace.html?category=fast-food">Shawarma &amp; Grills</a></li>
          </ul>
        </div>

        <!-- Student & Vendor -->
        <div class="footer-col">
          <h4>For Community</h4>
          <ul class="footer-links">
            <li><a href="/register.html?role=vendor">Become a Vendor</a></li>
            <li><a href="/login.html">Vendor Login</a></li>
            <li><a href="/orders.html">Track Order Status</a></li>
            <li><a href="/cart.html">View Cart</a></li>
            <li><a href="#support-modal" id="footer-support-link">Student Help Desk</a></li>
          </ul>
        </div>

        <!-- Abraka Service Hours -->
        <div class="footer-col">
          <h4>Campus Delivery</h4>
          <p style="font-size:0.85rem; line-height:1.6; margin-bottom:0.75rem;">
            Order from local spots around Campus Gate, Ekrejeta, Police Station Axis, and Hostel lodges with doorstep delivery.
          </p>
          <div style="font-size:0.85rem; color:#E2E8F0;">
            <strong>Hours:</strong> Mon - Sun: 8:00 AM - 10:30 PM
          </div>
          <div style="margin-top:0.75rem; font-size:0.85rem; color:#A0AEC0;">
            WhatsApp Support: +234 810 000 CHOP
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Copyright -->
    <div class="container footer-bottom">
      <div>
        &copy; ${new Date().getFullYear()} CampusChop Marketplace. Designed for Delta State University (DELSU), Abraka.
      </div>
      <div style="display:flex; gap:1.25rem;">
        <a href="#terms-modal" id="terms-link" style="color:#A0AEC0;">Terms of Service</a>
        <a href="#privacy-modal" id="privacy-link" style="color:#A0AEC0;">Privacy Policy</a>
      </div>
    </div>

    <!-- Student Support Modal -->
    <div class="modal-overlay" id="support-modal">
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title">CampusChop Student Support</h3>
          <button class="modal-close" id="close-support-modal">&times;</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom:1rem; font-size:0.95rem; color:var(--text-secondary);">
            Need assistance with an active order or delivery in Abraka? Our campus team is available to help!
          </p>
          <div style="background:var(--bg-alt); padding:1rem; border-radius:var(--radius-md); margin-bottom:1rem;">
            <div><strong>DELSU Campus Hotline:</strong> +234 (0) 812 345 6789</div>
            <div style="margin-top:0.5rem;"><strong>Email:</strong> support@campuschop.ng</div>
            <div style="margin-top:0.5rem;"><strong>Office:</strong> Student Union Building (SUB), Site 2, DELSU Abraka</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" id="done-support-btn">Got It</button>
        </div>
      </div>
    </div>
  `;

  // Attach modal handlers
  const supportLink = document.getElementById('footer-support-link');
  const supportModal = document.getElementById('support-modal');
  const closeSupportBtn = document.getElementById('close-support-modal');
  const doneSupportBtn = document.getElementById('done-support-btn');

  if (supportLink && supportModal) {
    supportLink.addEventListener('click', (e) => {
      e.preventDefault();
      supportModal.classList.add('active');
    });
  }

  const hideSupportModal = () => {
    if (supportModal) supportModal.classList.remove('active');
  };

  if (closeSupportBtn) closeSupportBtn.addEventListener('click', hideSupportModal);
  if (doneSupportBtn) doneSupportBtn.addEventListener('click', hideSupportModal);
};

// CampusChop - Registration & Vendor Application Controller
import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { authService } from '../services/auth.service.js';
import { vendorsService } from '../services/vendors.service.js';
import { toast } from '../utils/toast.js';

let activeRole = 'customer'; // 'customer' or 'vendor'

document.addEventListener('DOMContentLoaded', async () => {
  await renderNavbar();
  renderFooter();

  // Check URL param for pre-selected role
  const params = new URLSearchParams(window.location.search);
  const roleParam = params.get('role');
  if (roleParam === 'vendor') {
    switchRoleTab('vendor');
  } else {
    switchRoleTab('customer');
  }

  setupEventListeners();
});

const switchRoleTab = (role) => {
  activeRole = role;
  const tabCustomer = document.getElementById('tab-customer');
  const tabVendor = document.getElementById('tab-vendor');
  const customerForm = document.getElementById('customer-register-form');
  const vendorForm = document.getElementById('vendor-register-form');
  const title = document.getElementById('register-title');
  const subtitle = document.getElementById('register-subtitle');

  hideAlert();

  if (role === 'vendor') {
    if (tabCustomer) tabCustomer.classList.remove('active');
    if (tabVendor) tabVendor.classList.add('active');
    if (customerForm) customerForm.style.display = 'none';
    if (vendorForm) vendorForm.style.display = 'block';
    if (title) title.textContent = 'Partner with CampusChop';
    if (subtitle) subtitle.textContent = 'Register your restaurant or food venture in Abraka';
  } else {
    if (tabVendor) tabVendor.classList.remove('active');
    if (tabCustomer) tabCustomer.classList.add('active');
    if (vendorForm) vendorForm.style.display = 'none';
    if (customerForm) customerForm.style.display = 'block';
    if (title) title.textContent = 'Join CampusChop';
    if (subtitle) subtitle.textContent = 'Order delicious meals across DELSU campus & Abraka';
  }
};

const setupEventListeners = () => {
  const tabCustomer = document.getElementById('tab-customer');
  const tabVendor = document.getElementById('tab-vendor');
  const customerForm = document.getElementById('customer-register-form');
  const vendorForm = document.getElementById('vendor-register-form');

  if (tabCustomer) tabCustomer.addEventListener('click', () => switchRoleTab('customer'));
  if (tabVendor) tabVendor.addEventListener('click', () => switchRoleTab('vendor'));

  if (customerForm) customerForm.addEventListener('submit', handleCustomerRegister);
  if (vendorForm) vendorForm.addEventListener('submit', handleVendorRegister);
};

const handleCustomerRegister = async (e) => {
  e.preventDefault();

  const name = document.getElementById('reg-name').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const submitBtn = document.getElementById('customer-submit-btn');

  if (!name || !email || !password) {
    showAlert('Please fill in all required fields.');
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';
    hideAlert();

    await authService.signUpCustomer({
      email,
      password,
      fullName: name,
      phone,
    });

    toast.success('Registration successful! Welcome to CampusChop.');
    setTimeout(() => {
      window.location.href = '/marketplace.html';
    }, 800);
  } catch (err) {
    console.error('Customer registration error:', err);
    showAlert(err.message || 'Unable to register. Please check your credentials.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Customer Account';
  }
};

const handleVendorRegister = async (e) => {
  e.preventDefault();

  const ownerName = document.getElementById('vendor-owner-name').value.trim();
  const phone = document.getElementById('vendor-phone').value.trim();
  const email = document.getElementById('vendor-email').value.trim();
  const password = document.getElementById('vendor-password').value;
  const businessName = document.getElementById('vendor-biz-name').value.trim();
  const category = document.getElementById('vendor-category').value;
  const location = document.getElementById('vendor-location').value.trim();
  const desc = document.getElementById('vendor-desc').value.trim();
  const logoUrl = document.getElementById('vendor-logo-url').value.trim();
  const submitBtn = document.getElementById('vendor-submit-btn');
  const vendorForm = document.getElementById('vendor-register-form');
  const pendingNotice = document.getElementById('vendor-pending-notice');

  if (!ownerName || !email || !password || !businessName || !location) {
    showAlert('Please fill in all required fields.');
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting Application...';
    hideAlert();

    // 1. Create auth user first
    await authService.signUpCustomer({
      email,
      password,
      fullName: ownerName,
      phone,
    });

    // 2. Submit vendor application
    await vendorsService.submitVendorApplication({
      businessName,
      ownerName,
      email,
      phone,
      description: desc,
      businessLocation: location,
      primaryCategory: category,
      logoUrl: logoUrl || null,
    });

    // 3. Show pending approval notice
    if (vendorForm) vendorForm.style.display = 'none';
    if (pendingNotice) pendingNotice.style.display = 'block';

    toast.success('Vendor application submitted! Pending administrator approval.');
  } catch (err) {
    console.error('Vendor registration error:', err);
    showAlert(err.message || 'Error submitting vendor application.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Vendor Application';
  }
};

const showAlert = (msg) => {
  const alertBox = document.getElementById('register-alert');
  const alertText = document.getElementById('register-alert-text');
  if (alertBox && alertText) {
    alertText.textContent = msg;
    alertBox.classList.add('show');
  }
};

const hideAlert = () => {
  const alertBox = document.getElementById('register-alert');
  if (alertBox) alertBox.classList.remove('show');
};

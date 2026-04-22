// API base URL - configured for production/development
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://localhost:8000/api' 
    : '/api';  // Use relative path for production
let adminToken = localStorage.getItem('admin_token') || null;
let currentOrderId = null;
let allOrders = [];
let allProducts = [];
let allCustomers = [];

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Feather Icons
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
    
    // Check for existing admin session
    if (adminToken) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('admin-section').style.display = 'flex';
        loadDashboard();
    }
    
    // Add enter key support for login
    const emailInput = document.getElementById('admin-email');
    const passwordInput = document.getElementById('admin-password');
    
    if (emailInput && passwordInput) {
        emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                passwordInput.focus();
            }
        });
        
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                adminLogin();
            }
        });
    }
    
    // Add event listener for image file input
    const imageInput = document.getElementById('product-images');
    if (imageInput) {
        imageInput.addEventListener('change', handleImageSelection);
    }
});

// ============ ADMIN AUTHENTICATION ============
function showError(message) {
    const errorElement = document.getElementById('login-error');
    errorElement.textContent = message;
    errorElement.classList.add('show');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        errorElement.classList.remove('show');
    }, 5000);
}

function hideError() {
    const errorElement = document.getElementById('login-error');
    errorElement.classList.remove('show');
}

function setLoading(loading) {
    const loginBtn = document.getElementById('login-btn');
    const emailInput = document.getElementById('admin-email');
    const passwordInput = document.getElementById('admin-password');
    
    if (loading) {
        loginBtn.classList.add('loading');
        loginBtn.disabled = true;
        loginBtn.textContent = 'Signing in...';
        emailInput.disabled = true;
        passwordInput.disabled = true;
    } else {
        loginBtn.classList.remove('loading');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login to Admin Panel';
        emailInput.disabled = false;
        passwordInput.disabled = false;
    }
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

async function adminLogin() {
    hideError();
    
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

    // Enhanced validation
    if (!email) {
        showError('Please enter your admin email');
        document.getElementById('admin-email').focus();
        return;
    }
    
    if (!validateEmail(email)) {
        showError('Please enter a valid email address');
        document.getElementById('admin-email').focus();
        return;
    }
    
    if (!password) {
        showError('Please enter your password');
        document.getElementById('admin-password').focus();
        return;
    }
    
    if (password.length < 6) {
        showError('Password must be at least 6 characters long');
        document.getElementById('admin-password').focus();
        return;
    }

    setLoading(true);

    try {
        const response = await fetch(`${API_BASE}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (response.ok) {
            adminToken = data.token;
            localStorage.setItem('admin_token', adminToken);
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('admin-section').style.display = 'flex';
            loadDashboard();
        } else {
            // More specific error messages
            if (response.status === 401) {
                showError('Invalid email or password. Please try again.');
            } else if (response.status === 403) {
                showError('Access denied. You do not have admin privileges.');
            } else if (response.status === 429) {
                showError('Too many login attempts. Please try again later.');
            } else {
                showError(data.detail || 'Login failed. Please try again.');
            }
            
            // Clear password field on error
            document.getElementById('admin-password').value = '';
            document.getElementById('admin-password').focus();
        }
    } catch (error) {
        console.error('Login error:', error);
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showError('Network error. Please check your internet connection.');
        } else {
            showError('An unexpected error occurred. Please try again.');
        }
    } finally {
        setLoading(false);
    }
}

function adminLogout() {
    adminToken = null;
    localStorage.removeItem('admin_token');
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('admin-section').style.display = 'none';
    document.getElementById('admin-email').value = '';
    document.getElementById('admin-password').value = '';
    hideError();
    
    // Clear any sensitive data from memory
    if (performance.clearResourceTimings) {
        performance.clearResourceTimings();
    }
}

function getAuthHeader() {
    return { 'Authorization': `Bearer ${adminToken}` };
}

// ============ NAVIGATION ============
function showAdminSection(sectionId, event) {
    if (event) {
        event.preventDefault();
    }
    
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    if (event && event.target) {
        event.target.classList.add('active');
    }

    if (sectionId === 'dashboard') {
        loadDashboard();
    } else if (sectionId === 'products') {
        loadProducts();
    } else if (sectionId === 'orders') {
        loadOrders();
    } else if (sectionId === 'customers') {
        loadCustomers();
    } else if (sectionId === 'reports') {
        generateReport();
    }
}

// ============ DASHBOARD ============
async function loadDashboard() {
    try {
        const [usersRes, productsRes, ordersRes] = await Promise.all([
            fetch(`${API_BASE}/admin/stats/users`, { headers: getAuthHeader() }),
            fetch(`${API_BASE}/admin/stats/products`, { headers: getAuthHeader() }),
            fetch(`${API_BASE}/admin/stats/orders`, { headers: getAuthHeader() })
        ]);

        const usersData = await usersRes.json();
        const productsData = await productsRes.json();
        const ordersData = await ordersRes.json();

        document.getElementById('stat-users').textContent = usersData.count || 0;
        document.getElementById('stat-products').textContent = productsData.count || 0;
        document.getElementById('stat-orders').textContent = ordersData.count || 0;
        document.getElementById('stat-sales').textContent = `Rs. ${(ordersData.total_sales || 0).toLocaleString()}`;

        // Load recent orders
        const ordersResponse = await fetch(`${API_BASE}/admin/orders?limit=5`, { headers: getAuthHeader() });
        const ordersJson = await ordersResponse.json();
        displayRecentOrders(ordersJson.orders || []);
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function displayRecentOrders(orders) {
    const list = document.getElementById('recent-orders-list');
    if (orders.length === 0) {
        list.innerHTML = '<p>No recent orders</p>';
        return;
    }

    list.innerHTML = orders.map(order => `
        <div class="recent-order-item">
            <div>
                <strong>Order #${order.id}</strong>
                <p>${new Date(order.created_at).toLocaleDateString('ur-PK')}</p>
            </div>
            <div>
                <strong>Rs. ${order.total_amount.toLocaleString()}</strong>
                <span class="order-status status-${order.status.toLowerCase()}">${order.status}</span>
            </div>
        </div>
    `).join('');
}

// ============ PRODUCTS MANAGEMENT ============
function toggleProductForm() {
    const form = document.getElementById('product-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    if (form.style.display === 'block') {
        clearProductForm();
        loadCategories(); // Load categories when form is opened
    }
}

async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/categories`, { headers: getAuthHeader() });
        const data = await response.json();
        
        const categorySelect = document.getElementById('product-category');
        categorySelect.innerHTML = '<option value="">Select Category</option>';
        
        if (data.categories && data.categories.length > 0) {
            data.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.name;
                option.textContent = category.name;
                option.dataset.id = category.id;
                categorySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

function clearProductForm() {
    document.getElementById('product-id').value = '';
    document.getElementById('product-name').value = '';
    document.getElementById('product-description').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-stock').value = '';
    document.getElementById('product-category').value = '';
    const colorInput = document.getElementById('product-color');
    if (colorInput) colorInput.value = '';
    const materialInput = document.getElementById('product-material');
    if (materialInput) materialInput.value = '';
    const sizeInput = document.getElementById('product-size');
    if (sizeInput) sizeInput.value = '';
    const imageInput = document.getElementById('product-images');
    if (imageInput) imageInput.value = '';
    const imgPreview = document.getElementById('image-preview-container');
    if (imgPreview) imgPreview.innerHTML = '';
}

async function loadProducts() {
    try {
        const response = await fetch(`${API_BASE}/products`, { headers: getAuthHeader() });
        const data = await response.json();
        allProducts = data.products || [];
        displayProductsTable(allProducts);
    } catch (error) {
        console.error('Error loading products:', error);
        alert('Error loading products');
    }
}

function displayProductsTable(products) {
    const tbody = document.getElementById('products-table-body');
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No products found</td></tr>';
        return;
    }

    tbody.innerHTML = products.map(product => `
        <tr>
            <td>${product.id}</td>
            <td>${product.name}</td>
            <td>${product.category}</td>
            <td>Rs. ${product.price.toLocaleString()}</td>
            <td>${product.stock}</td>
            <td>
                <button class="action-btn" onclick="editProduct(${product.id})">Edit</button>
                <button class="action-btn delete" onclick="deleteProduct(${product.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function editProduct(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('product-id').value = product.id;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-description').value = product.description;
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-stock').value = product.stock;
    document.getElementById('product-category').value = product.category;
    document.getElementById('product-color').value = product.color || '';
    document.getElementById('product-material').value = product.material || '';
    document.getElementById('product-size').value = product.size || '';
    document.getElementById('product-form').style.display = 'block';
    
    // Load existing images if any
    loadProductImages(productId);
}

// Load existing product images
async function loadProductImages(productId) {
    try {
        const response = await fetch(`${API_BASE}/products/${productId}/images`);
        const data = await response.json();
        
        const container = document.getElementById('image-preview-container');
        container.innerHTML = ''; // Clear existing previews
        
        data.images.forEach(image => {
            const previewItem = document.createElement('div');
            previewItem.className = 'image-preview-item';
            previewItem.innerHTML = `
                <img src="${image.image_url}" alt="Product image">
                <button class="remove-image" onclick="removeProductImage(${productId}, ${image.id})">Ã—</button>
            `;
            container.appendChild(previewItem);
        });
    } catch (error) {
        console.error('Error loading product images:', error);
    }
}

// Remove product image
async function removeProductImage(productId, imageId) {
    if (!confirm('Are you sure you want to delete this image?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/products/${productId}/images/${imageId}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });
        
        if (response.ok) {
            alert('Image deleted successfully');
            loadProductImages(productId); // Reload images
        } else {
            alert('Error deleting image');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Handle image selection for preview
function handleImageSelection(event) {
    const files = event.target.files;
    const container = document.getElementById('image-preview-container');
    
    // Clear existing previews
    container.innerHTML = '';
    
    // Show preview for each selected file
    Array.from(files).forEach((file, index) => {
        if (index >= 5) return; // Limit to 5 images
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const previewItem = document.createElement('div');
            previewItem.className = 'image-preview-item';
            previewItem.innerHTML = `
                <img src="${e.target.result}" alt="Preview ${index + 1}">
                <button class="remove-image" onclick="removeImagePreview(this)">Ã—</button>
            `;
            container.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
}

// Remove image preview
function removeImagePreview(button) {
    const previewItem = button.parentElement;
    previewItem.remove();
}

// Upload product images
async function uploadProductImages(productId) {
    const fileInput = document.getElementById('product-images');
    const files = fileInput.files;
    
    if (files.length === 0) return;
    
    if (files.length > 5) {
        alert('Maximum 5 images allowed per upload');
        return;
    }
    
    // Check file sizes before uploading
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    for (let i = 0; i < files.length; i++) {
        if (files[i].size > maxSize) {
            alert(`File ${i+1}: ${files[i].name} is too large. Maximum size is 5MB.`);
            return;
        }
    }
    
    // Show loading indicator
    const submitBtn = document.querySelector('#product-form .btn-primary');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Uploading...';
    submitBtn.disabled = true;
    
    // Create FormData to send files
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }
    
    try {
        const response = await fetch(`${API_BASE}/products/${productId}/images`, {
            method: 'POST',
            headers: {
                ...getAuthHeader()
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(result.message || `${files.length} images uploaded successfully`);
            // Clear the file input
            fileInput.value = '';
            // Clear preview container
            document.getElementById('image-preview-container').innerHTML = '';
        } else {
            alert('Error uploading images: ' + (result.detail || 'Unknown error'));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        // Restore button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

async function saveProduct() {
    const id = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value.trim();
    const description = document.getElementById('product-description').value.trim();
    const price = parseFloat(document.getElementById('product-price').value);
    const stock = parseInt(document.getElementById('product-stock').value);
    const category = document.getElementById('product-category').value;
    const colorInput = document.getElementById('product-color');
    const color = colorInput ? colorInput.value.trim() : '';
    const materialInput = document.getElementById('product-material');
    const material = materialInput ? materialInput.value.trim() : '';
    const sizeInput = document.getElementById('product-size');
    const size = sizeInput ? sizeInput.value.trim() : '';
    const imageInput = document.getElementById('product-images');
    const imageFiles = imageInput ? imageInput.files : [];
        
    // Convert category name to category_id
    const categorySelect = document.getElementById('product-category');
    const selectedOption = categorySelect.options[categorySelect.selectedIndex];
    const categoryId = selectedOption.dataset.id || categorySelect.value; // Fallback to value if dataset.id not available
        
    if (!name || !description || !price || stock < 0 || !category) {
        alert('All required fields must be filled');
        return;
    }
        
    // Show loading indicator
    const submitBtn = document.querySelector('#product-form .btn-primary');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = id ? 'Updating...' : 'Saving...';
    submitBtn.disabled = true;

    // Create product data without image_url
    const productData = { name, description, price, stock, category, category_id: parseInt(categoryId) || 1, color, material, size };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/products/${id}` : `${API_BASE}/products`;

    try {
        // First, save/update the product
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify(productData)
        });

        if (response.ok) {
            const result = await response.json();
            const productId = id || result.id;
            
            // If there are image files to upload, upload them
            if (imageFiles.length > 0) {
                await uploadProductImages(productId);
            }
            
            alert('Product saved successfully');
            clearProductForm();
            document.getElementById('product-form').style.display = 'none';
            loadProducts();
        } else {
            alert('Error saving product');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        // Restore button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
        const response = await fetch(`${API_BASE}/products/${productId}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });

        if (response.ok) {
            alert('Product deleted successfully');
            loadProducts();
        } else {
            alert('Error deleting product');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// ============ ORDERS MANAGEMENT ============
async function loadOrders() {
    try {
        const response = await fetch(`${API_BASE}/admin/orders`, { headers: getAuthHeader() });
        const data = await response.json();
        allOrders = data.orders || [];
        displayOrdersTable(allOrders);
    } catch (error) {
        console.error('Error loading orders:', error);
        alert('Error loading orders');
    }
}

function displayOrdersTable(orders) {
    const tbody = document.getElementById('orders-table-body');
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No orders found</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.id}</td>
            <td>${order.customer_name}</td>
            <td>Rs. ${order.total_amount.toLocaleString()}</td>
            <td><span class="order-status status-${order.status.toLowerCase()}">${order.status}</span></td>
            <td>${new Date(order.created_at).toLocaleDateString('ur-PK')}</td>
            <td>
                <button class="action-btn" onclick="viewOrderDetails(${order.id})">View</button>
            </td>
        </tr>
    `).join('');
}

function filterOrders() {
    const status = document.getElementById('order-status-filter').value;
    let filtered = allOrders;

    if (status) {
        filtered = allOrders.filter(o => o.status.toLowerCase() === status.toLowerCase());
    }

    displayOrdersTable(filtered);
}

function viewOrderDetails(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    currentOrderId = orderId;
    const itemsHtml = (order.items || []).map(item => `
        <div class="order-detail-item">
            <strong>${item.product_name}</strong>
            <span>Quantity: ${item.quantity} x Rs. ${item.price.toLocaleString()}</span>
        </div>
    `).join('');

    const content = `
        <div class="order-detail-item">
            <strong>Order ID:</strong>
            <span>#${order.id}</span>
        </div>
        <div class="order-detail-item">
            <strong>Customer:</strong>
            <span>${order.customer_name}</span>
        </div>
        <div class="order-detail-item">
            <strong>Phone:</strong>
            <span>${order.customer_phone}</span>
        </div>
        <div class="order-detail-item">
            <strong>Delivery Address:</strong>
            <span>${order.delivery_address}</span>
        </div>
        <div class="order-detail-item">
            <strong>Items:</strong>
        </div>
        ${itemsHtml}
        <div class="order-detail-item">
            <strong>Total Amount:</strong>
            <span>Rs. ${order.total_amount.toLocaleString()}</span>
        </div>
        <div class="order-detail-item">
            <strong>Current Status:</strong>
            <span class="order-status status-${order.status.toLowerCase()}">${order.status}</span>
        </div>
        <div class="order-detail-item">
            <strong>Order Date:</strong>
            <span>${new Date(order.created_at).toLocaleDateString('ur-PK')}</span>
        </div>
    `;

    document.getElementById('order-detail-content').innerHTML = content;
    document.getElementById('order-status-select').value = '';
    document.getElementById('order-detail-modal').style.display = 'flex';
}

async function updateOrderStatus() {
    const newStatus = document.getElementById('order-status-select').value;
    if (!newStatus) {
        alert('Please select a status');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/admin/orders/${currentOrderId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            alert('Order status updated successfully');
            closeOrderModal();
            loadOrders();
        } else {
            alert('Error updating order');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function closeOrderModal() {
    document.getElementById('order-detail-modal').style.display = 'none';
    currentOrderId = null;
}

// ============ CUSTOMERS MANAGEMENT ============
async function loadCustomers() {
    try {
        const response = await fetch(`${API_BASE}/admin/customers`, { headers: getAuthHeader() });
        const data = await response.json();
        allCustomers = data.customers || [];
        displayCustomersTable(allCustomers);
    } catch (error) {
        console.error('Error loading customers:', error);
        alert('Error loading customers');
    }
}

function displayCustomersTable(customers) {
    const tbody = document.getElementById('customers-table-body');
    
    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No customers found</td></tr>';
        return;
    }

    tbody.innerHTML = customers.map(customer => `
        <tr>
            <td>${customer.id}</td>
            <td>${customer.name}</td>
            <td>${customer.email}</td>
            <td>${customer.phone}</td>
            <td>${customer.order_count || 0}</td>
            <td>
                <button class="action-btn delete" onclick="deactivateCustomer(${customer.id})">Deactivate</button>
            </td>
        </tr>
    `).join('');
}

async function deactivateCustomer(customerId) {
    if (!confirm('Are you sure you want to deactivate this customer?')) return;

    try {
        const response = await fetch(`${API_BASE}/admin/customers/${customerId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({ status: 'inactive' })
        });

        if (response.ok) {
            alert('Customer deactivated');
            loadCustomers();
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// ============ REPORTS ============
async function generateReport() {
    const period = document.getElementById('report-period').value;

    try {
        const response = await fetch(`${API_BASE}/admin/reports?period=${period}`, { headers: getAuthHeader() });
        const data = await response.json();

        const totalOrders = data.total_orders || 0;
        const totalRevenue = data.total_revenue || 0;
        const avgValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        document.getElementById('report-total-orders').textContent = totalOrders;
        document.getElementById('report-total-revenue').textContent = `Rs. ${totalRevenue.toLocaleString()}`;
        document.getElementById('report-avg-value').textContent = `Rs. ${avgValue.toLocaleString()}`;

        const tbody = document.getElementById('report-table-body');
        const reportData = data.report_data || [];

        if (reportData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3">No data available</td></tr>';
            return;
        }

        tbody.innerHTML = reportData.map(row => `
            <tr>
                <td>${new Date(row.date).toLocaleDateString('ur-PK')}</td>
                <td>${row.orders}</td>
                <td>Rs. ${row.revenue.toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error generating report:', error);
        alert('Error loading report');
    }
}
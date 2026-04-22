// Enhanced JavaScript for S.S BAGS Template

// Sample Product Data (for demo purposes)
const sampleProducts = [
    {
        id: 1,
        name: "Butterfly Kids School Bag",
        category: "Primary School Bags",
        price: 1500,
        originalPrice: 2000,
        image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=500",
        badge: "sale",
        rating: 4.5,
        reviews: 128,
        description: "Lightweight colorful bag with padded straps for young students"
    },
    {
        id: 2,
        name: "Pro Student Backpack",
        category: "Secondary School Bags",
        price: 2500,
        originalPrice: null,
        image: "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?q=80&w=500",
        badge: "new",
        rating: 4.8,
        reviews: 89,
        description: "Spacious multi-compartment bag for secondary school students"
    },
    {
        id: 3,
        name: "Campus Laptop Backpack",
        category: "College & University Bags",
        price: 4500,
        originalPrice: 5500,
        image: "https://images.unsplash.com/photo-1498557850523-fd3d118b962e?q=80&w=500",
        badge: "sale",
        rating: 4.3,
        reviews: 67,
        description: "Anti-theft backpack with USB charging port and 15.6\" laptop compartment"
    },
    {
        id: 4,
        name: "Kids Trolley School Bag",
        category: "Trolley School Bags",
        price: 2800,
        originalPrice: null,
        image: "https://images.unsplash.com/photo-1581592149-5e687a77e2fe?q=80&w=500",
        badge: "new",
        rating: 4.6,
        reviews: 94,
        description: "Easy-roll trolley bag that converts to backpack for primary students"
    },
    {
        id: 5,
        name: "Zip Pencil Case Set",
        category: "Pencil Cases & Pouches",
        price: 350,
        originalPrice: null,
        image: "https://images.unsplash.com/photo-1588072432836-e10032774350?q=80&w=500",
        badge: null,
        rating: 4.4,
        reviews: 156,
        description: "Matching pencil case with pen holder and eraser pocket"
    },
    {
        id: 6,
        name: "Dino Adventure Primary Bag",
        category: "Primary School Bags",
        price: 1200,
        originalPrice: 1800,
        image: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?q=80&w=500",
        badge: "sale",
        rating: 4.2,
        reviews: 73,
        description: "Fun dinosaur-themed bag perfect for nursery and KG students"
    }
];

// API base URL - configured for production/development
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000/api'
    : '/api';
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let products = [];
let useSampleData = false;

// Load categories for filter dropdown from API
async function loadCategoriesForFilter() {
    const categoryFilter = document.getElementById('category-filter');
    if (!categoryFilter) return;

    try {
        const response = await fetch(`${API_BASE}/categories`);
        const data = await response.json();

        if (data.categories && data.categories.length > 0) {
            while (categoryFilter.options.length > 1) {
                categoryFilter.remove(1);
            }
            data.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.name;
                option.textContent = category.name;
                categoryFilter.appendChild(option);
            });
        }
    } catch(e) {
        console.error('Filter load error:', e);
    }
}

async function loadCategoriesForHome() {
    const categoryGrid = document.querySelector('.category-grid');
    if (!categoryGrid) return;
    try {
        const response = await fetch(`${API_BASE}/categories`);
        const data = await response.json();
        if (data.categories && data.categories.length > 0) {
            categoryGrid.innerHTML = '';
            data.categories.forEach(category => {
                const categoryCard = document.createElement('div');
                categoryCard.className = 'category-card fade-in';
                const imageUrl = category.image_url || `https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=500&q=80`;
                categoryCard.innerHTML = `<img src="${imageUrl}" alt="${category.name}"><div class="cat-info"><h3>${category.name}</h3></div>`;
                categoryCard.onclick = () => {
                    const filter = document.getElementById('category-filter');
                    if (filter) filter.value = category.name;
                    showSection('products');
                    filterProducts();
                };
                categoryGrid.appendChild(categoryCard);
            });
        } else {
            loadDefaultCategories();
        }
    } catch(e) {
        loadDefaultCategories();
    }
}

function loadDefaultCategories() {
    const categoryGrid = document.querySelector('.category-grid');
    if (!categoryGrid) return;

    const defaultCategories = [
        { name: 'Primary School Bags', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=500&q=80' },
        { name: 'Secondary School Bags', image: 'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=500&q=80' },
        { name: 'College & University Bags', image: 'https://images.unsplash.com/photo-1498557850523-fd3d118b962e?auto=format&fit=crop&w=500&q=80' },
        { name: 'Trolley School Bags', image: 'https://images.unsplash.com/photo-1581592149-5e687a77e2fe?auto=format&fit=crop&w=500&q=80' },
        { name: 'Pencil Cases & Pouches', image: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=500&q=80' }
    ];

    categoryGrid.innerHTML = '';

    defaultCategories.forEach(category => {
        const categoryCard = document.createElement('div');
        categoryCard.className = 'cat-card';
        categoryCard.onclick = () => setCategory(category.name);

        categoryCard.innerHTML = `
            <img src="${category.image}" alt="${category.name}">
            <div class="cat-info"><h3>${category.name}</h3></div>
        `;

        categoryGrid.appendChild(categoryCard);
    });
}

// Helper function to generate random image ID for placeholder
function getRandomImageId() {
    const imageIds = [
        '1584917865442-de89df76afd3',
        '1553062407-98eeb64c6a62',
        '1627123424574-724758594e93',
        '1553877522-43269d4ea984',
        '1551698618-1dfe5d97d256',
        '1594633312681-425c7b97ccd1'
    ];
    return imageIds[Math.floor(Math.random() * imageIds.length)];
}

document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    loadCart();
    loadCategoriesForFilter();
    loadCategoriesForHome();

    // Initialize hero slider
    initializeHeroSlider();

    // Icons ko render karne ke liye
    if (typeof feather !== 'undefined') {
        feather.replace();
    }

    // Initialize animations
    initializeAnimations();
});

// Hero Slider Functions
function initializeHeroSlider() {
    let currentSlideIndex = 0;
    const slides = document.querySelectorAll('.hero-slide');

    if (slides.length === 0) return;

    function showSlide(index) {
        const indicators = document.querySelectorAll('.indicator');

        slides.forEach(slide => slide.classList.remove('active'));
        indicators.forEach(indicator => indicator.classList.remove('active'));

        if (slides[index]) {
            slides[index].classList.add('active');
        }
        if (indicators[index]) {
            indicators[index].classList.add('active');
        }
        currentSlideIndex = index;
    }

    function nextSlide() {
        currentSlideIndex = (currentSlideIndex + 1) % slides.length;
        showSlide(currentSlideIndex);
    }

    // Auto-advance slider
    setInterval(nextSlide, 5000);

    // Make functions globally available
    window.currentSlide = showSlide;
}

// Initialize Animations
function initializeAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.6s ease-out forwards';
            }
        });
    }, observerOptions);

    document.querySelectorAll('.product-card, .feature-card, .cat-card').forEach(card => {
        observer.observe(card);
    });
}

// Category filter function
function setCategory(category) {
    showSection('products');
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
        categoryFilter.value = category;
    }
    filterProducts();
    showToast(`Showing ${category} collection`, 'success');
}

// Set Collection
function setCollection(collection) {
    showSection('products');
    showToast(`Showing ${collection} collection`, 'success');
}

// ============ NAVIGATION ============
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active');
    window.scrollTo(0, 0);
}

// ============ PRODUCTS ============
async function fetchProducts() {
    try {
        const response = await fetch(`${API_BASE}/products`);
        const data = await response.json();

        if (data.products && data.products.length > 0) {
            products = data.products;
            displayProducts(products);
        } else {
            // Fallback to sample data
            products = sampleProducts;
            displayProducts(products);
        }
    } catch(error) {
        console.error('Error fetching products:', error);
        products = sampleProducts;
        displayProducts(products);
    }
}

function displayProducts(items) {
    const list = document.getElementById('products-grid');
    if (!list) return;

    if (items.length === 0) {
        list.innerHTML = '<p>No products found</p>';
        return;
    }

    list.innerHTML = items.map(product => `
        <div class="product-card">
            <div class="product-image-wrapper">
                ${product.images && product.images.length > 0 ?
                    `<img src="${product.images[0]}" style="width:100%;height:100%;object-fit:cover;" alt="${product.name}" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\'%3E%3Crect fill=\\'%23ddd\\' width=\\'100\\' height=\\'100\\'/%3E%3Ctext x=\\'50\\' y=\\'50\\' text-anchor=\\'middle\\' dy=\\'.3em\\' fill=\\'%23999\\'%3EProduct%3C/text%3E%3C/svg%3E';">` :
                    (product.image ?
                    `<img src="${product.image}" style="width:100%;height:100%;object-fit:cover;" alt="${product.name}">` :
                    `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' fill='%23999'%3EProduct%3C/text%3E%3C/svg%3E" style="width:100%;height:100%;" alt="${product.name}">`)}
                <div class="add-to-cart-overlay" onclick="addToCart(${product.id})">
                    ADD TO CART
                </div>
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p class="product-price">Rs. ${product.price.toLocaleString()}</p>
            </div>
        </div>
    `).join('');

    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}

// ============ RENDER / FILTER PRODUCTS ============
function renderProducts(categoryName) {
    let filtered = products;
    if (categoryName) {
        filtered = products.filter(p => p.category === categoryName);
    }
    displayProducts(filtered);
}

function filterProducts() {
    const searchEl = document.getElementById('search-input');
    const categoryEl = document.getElementById('category-filter');
    const sortEl = document.getElementById('sort-filter');

    const search = searchEl ? searchEl.value.toLowerCase() : '';
    const category = categoryEl ? categoryEl.value : '';
    const sort = sortEl ? sortEl.value : '';

    let filtered = products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(search) ||
                           (p.description && p.description.toLowerCase().includes(search));
        const matchCategory = !category || p.category === category;
        return matchSearch && matchCategory;
    });

    if (sort === 'price-low') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-high') {
        filtered.sort((a, b) => b.price - a.price);
    } else if (sort === 'newest') {
        filtered.sort((a, b) => b.id - a.id);
    }

    displayProducts(filtered);
}

// ============ ORDERS ============
function displayOrders(orders) {
    const list = document.getElementById('orders-list');
    if (!list) return;

    if (orders.length === 0) {
        list.innerHTML = '<p>No orders yet</p>';
        return;
    }

    list.innerHTML = orders.map(order => `
        <div class="order-card">
            <div class="order-header">
                <span class="order-id">Order #${order.id}</span>
                <span class="order-status status-${order.status.toLowerCase()}">${order.status}</span>
            </div>
            <div class="order-details">
                <div class="order-detail-item">
                    <strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString('ur-PK')}
                </div>
                <div class="order-detail-item">
                    <strong>Total:</strong> Rs. ${order.total_amount.toLocaleString()}
                </div>
                <div class="order-detail-item">
                    <strong>Items:</strong> ${order.items.length} product(s)
                </div>
                <div class="order-detail-item">
                    <strong>Address:</strong> ${order.delivery_address}
                </div>
            </div>
        </div>
    `).join('');
}

// ============ WHATSAPP REDIRECT ============
function redirectToWhatsApp(whatsappUrl, message, totalAmount) {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIPhone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const WHATSAPP_SHOP_NUMBER = '923150024508';

    let finalUrl;

    if (isAndroid || isIPhone) {
        finalUrl = `whatsapp://send?phone=${WHATSAPP_SHOP_NUMBER}&text=${encodeURIComponent(message)}`;
    } else {
        finalUrl = `https://wa.me/${WHATSAPP_SHOP_NUMBER}?text=${encodeURIComponent(message)}`;
    }

    try {
        window.open(finalUrl, '_blank');
    } catch (error) {
        console.error('WhatsApp redirect failed:', error);
        alert('Could not open WhatsApp. Please try again.');
    }
}

// ============ UTILITY FUNCTIONS ============
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOutDown 0.3s ease-out forwards';
        setTimeout(() => {
            if (document.body.contains(toast)) document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

function animateAddToCart() {
    const cartCount = document.querySelector('#cart-count');
    if (!cartCount) return;
    const cartIcon = cartCount.parentElement;
    if (cartIcon) {
        cartIcon.style.animation = 'pulse 0.5s ease-out';
        setTimeout(() => {
            cartIcon.style.animation = '';
        }, 500);
    }
}

function toggleMobileMenu() {
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) navMenu.classList.toggle('active');
}

document.addEventListener('click', function(event) {
    const navMenu = document.querySelector('.nav-menu');
    const menuToggle = document.querySelector('.mobile-menu-toggle');

    if (navMenu && menuToggle && !navMenu.contains(event.target) && !menuToggle.contains(event.target)) {
        navMenu.classList.remove('active');
    }
});

const style = document.createElement('style');
style.textContent = `
    @keyframes slideOutDown {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ============ CART ============
function addToCart(productId) {
    const product = products.find(p => p.id === productId) || sampleProducts.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
    showToast(`${product.name} added to cart!`, 'success');
    animateAddToCart();
}

function loadCart() {
    updateCartUI();
}

function updateCartUI() {
    const cartItems = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');

    if (cartCount) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = totalItems;
    }

    if (!cartItems) return;

    if (cart.length === 0) {
        cartItems.innerHTML = '<p>Your cart is empty</p>';
        const subtotalEl = document.getElementById('subtotal');
        const deliveryEl = document.getElementById('delivery');
        const totalEl = document.getElementById('total');
        if (subtotalEl) subtotalEl.textContent = 'Rs. 0';
        if (deliveryEl) deliveryEl.textContent = 'FREE';
        if (totalEl) totalEl.textContent = 'Rs. 0';
        return;
    }

    cartItems.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">Rs. ${item.price.toLocaleString()}</div>
            </div>
            <div class="cart-item-controls">
                <div class="quantity-controls">
                    <button class="quantity-btn" onclick="updateQuantity(${index}, -1)">
                        <i data-feather="minus"></i>
                    </button>
                    <input type="text" class="quantity-input" value="${item.quantity}" readonly>
                    <button class="quantity-btn" onclick="updateQuantity(${index}, 1)">
                        <i data-feather="plus"></i>
                    </button>
                </div>
                <button class="remove-btn" onclick="removeFromCart(${index})">
                    <i data-feather="trash-2"></i> Remove
                </button>
            </div>
        </div>
    `).join('');

    calculateCartTotal();

    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}

function updateQuantity(index, change) {
    const newQty = cart[index].quantity + change;

    if (newQty <= 0) {
        removeFromCart(index);
        return;
    }

    cart[index].quantity = newQty;
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
    showToast('Item removed from cart', 'error');
}

function calculateCartTotal() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const delivery = subtotal >= 5000 ? 0 : 250;
    const total = subtotal + delivery;

    const subtotalEl = document.getElementById('subtotal');
    const deliveryEl = document.getElementById('delivery');
    const totalEl = document.getElementById('total');

    if (subtotalEl) subtotalEl.textContent = `Rs. ${subtotal.toLocaleString()}`;
    if (deliveryEl) {
        deliveryEl.textContent = delivery === 0 ? 'FREE' : `Rs. ${delivery}`;
        deliveryEl.className = delivery === 0 ? 'free-delivery' : '';
    }
    if (totalEl) totalEl.textContent = `Rs. ${total.toLocaleString()}`;
}
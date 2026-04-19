-- ============ S.S BAGS - SUPABASE (POSTGRESQL) SCHEMA ============

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    reset_token VARCHAR(255) DEFAULT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_email ON users (email);

-- 2. Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_admins_email ON admins (email);

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_categories_name ON categories (name);

-- 4. Products Table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    price DECIMAL(10, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    image_url VARCHAR(1000),
    color VARCHAR(100),
    material VARCHAR(100),
    size VARCHAR(100),
    image_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_products_category ON products (category);
CREATE INDEX idx_products_category_id ON products (category_id);
CREATE INDEX idx_products_status ON products (status);
CREATE INDEX idx_products_name ON products (name);
CREATE INDEX idx_products_color ON products (color);

-- 5. Product Images Table
CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url VARCHAR(1000) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_product_images_product_id ON product_images (product_id);
CREATE INDEX idx_product_images_sort_order ON product_images (sort_order);

-- 6. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    delivery_address TEXT NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'cash_on_delivery',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_created_at ON orders (created_at);

-- 7. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    color VARCHAR(100),
    size VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);

-- 8. Inventory Logs Table
CREATE TABLE IF NOT EXISTS inventory_logs (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    old_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    action VARCHAR(100) NOT NULL,
    admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_inventory_logs_product_id ON inventory_logs (product_id);
CREATE INDEX idx_inventory_logs_created_at ON inventory_logs (created_at);

-- 9. Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_activity_logs_admin_id ON activity_logs (admin_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs (created_at);

-- 10. User Addresses Table
CREATE TABLE IF NOT EXISTS user_addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(10),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_user_addresses_user_id ON user_addresses (user_id);

-- ============ SUPABASE TRIGGERS FOR 'updated_at' ============
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_admins_modtime BEFORE UPDATE ON admins FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_products_modtime BEFORE UPDATE ON products FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============ INSERT INITIAL DATA ============
INSERT INTO categories (name, description, status) 
VALUES
('Primary School Bags', 'Lightweight and colorful school bags for young children (Grade 1-5)', 'active'),
('Secondary School Bags', 'Durable and spacious bags for middle and high school students (Grade 6-10)', 'active'),
('College & University Bags', 'Stylish backpacks with laptop compartments for college and university students', 'active'),
('Trolley School Bags', 'Wheeled trolley bags to reduce back strain for younger students', 'active'),
('Pencil Cases & Pouches', 'Matching pencil cases, pouches and accessories for school', 'active');

INSERT INTO products (name, description, category, category_id, price, stock, color, material, size, status) 
VALUES
('Butterfly Kids School Bag', 'Lightweight colorful bag with padded straps for young students', 'Primary School Bags', 1, 1500.00, 60, 'Pink', 'Polyester', 'Small', 'active'),
('Dino Adventure Primary Bag', 'Fun dinosaur-themed bag perfect for nursery and KG students', 'Primary School Bags', 1, 1200.00, 75, 'Green', 'Polyester', 'Small', 'active'),
('Pro Student Backpack', 'Spacious multi-compartment bag for secondary school students', 'Secondary School Bags', 2, 2500.00, 50, 'Blue', 'Polyester', 'Large', 'active'),
('Heavy Duty School Bag', 'Extra-strong bag with reinforced base and padded back for daily use', 'Secondary School Bags', 2, 3200.00, 40, 'Black', 'Oxford Fabric', 'Large', 'active'),
('Campus Laptop Backpack', 'Anti-theft backpack with USB charging port and 15.6" laptop compartment', 'College & University Bags', 3, 4500.00, 30, 'Grey', 'Canvas', 'XL', 'active'),
('College Premium Bag', 'Stylish backpack with organizer panel for college students', 'College & University Bags', 3, 3800.00, 35, 'Navy Blue', 'Polyester', 'Large', 'active'),
('Kids Trolley School Bag', 'Easy-roll trolley bag that converts to backpack for primary students', 'Trolley School Bags', 4, 2800.00, 25, 'Red', 'ABS & Polyester', 'Medium', 'active'),
('Superhero Trolley Bag', 'Superhero-themed trolley bag for boys with strong wheels', 'Trolley School Bags', 4, 3000.00, 20, 'Blue', 'Polycarbonate', 'Medium', 'active'),
('Zip Pencil Case Set', 'Matching pencil case with pen holder and eraser pocket', 'Pencil Cases & Pouches', 5, 350.00, 150, 'Multi-color', 'Nylon', 'Small', 'active'),
('Large Stationery Pouch', 'Wide capacity pouch for all stationery and art supplies', 'Pencil Cases & Pouches', 5, 500.00, 100, 'Black', 'Canvas', 'Medium', 'active');

-- ============ CREATE VIEWS ============
DROP VIEW IF EXISTS top_selling_bags;
DROP VIEW IF EXISTS customer_order_summary;

CREATE VIEW top_selling_bags AS
SELECT 
    p.id,
    p.name,
    p.category,
    p.color,
    COUNT(oi.id) as sales_count,
    COALESCE(SUM(oi.quantity), 0) as total_quantity_sold,
    COALESCE(SUM(oi.quantity * oi.price), 0) as total_revenue
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id AND o.status IN ('confirmed', 'shipped', 'delivered')
GROUP BY p.id, p.name, p.category, p.color
ORDER BY total_revenue DESC;

CREATE VIEW customer_order_summary AS
SELECT 
    u.id as user_id,
    u.name,
    u.email,
    COUNT(o.id) as total_orders,
    COALESCE(SUM(o.total_amount), 0) as total_spent,
    MAX(o.created_at) as last_order_date
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name, u.email;

-- ============ FUNCTIONS ============
-- Supabase uses Functions instead of Procedures for fetching data sets
CREATE OR REPLACE FUNCTION get_sales_report(report_period VARCHAR)
RETURNS TABLE (
    date DATE,
    total_orders BIGINT,
    revenue NUMERIC
) AS $$
BEGIN
    IF report_period = 'daily' THEN
        RETURN QUERY
        SELECT 
            DATE_TRUNC('day', created_at)::DATE as date,
            COUNT(*) as total_orders,
            SUM(total_amount) as revenue
        FROM orders
        WHERE status IN ('confirmed', 'shipped', 'delivered')
        AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date DESC;
    ELSIF report_period = 'monthly' THEN
        RETURN QUERY
        SELECT 
            DATE_TRUNC('month', created_at)::DATE as date,
            COUNT(*) as total_orders,
            SUM(total_amount) as revenue
        FROM orders
        WHERE status IN ('confirmed', 'shipped', 'delivered')
        AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY date DESC;
    END IF;
END;
$$ LANGUAGE plpgsql;

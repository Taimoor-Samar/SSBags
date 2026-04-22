# Vercel Trigger Commit (Force update!)
from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
import jwt  # PyJWT (NOT the jwt library)
import bcrypt
import psycopg2
from psycopg2 import Error
from psycopg2.pool import SimpleConnectionPool
from psycopg2.extras import RealDictCursor
from typing import List, Optional
import json
import os
import re
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
import uuid
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request

# Load environment variables
load_dotenv()

# ============ CONFIGURATION ============
app = FastAPI(title="PK Shop API")
security = HTTPBearer()

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

def get_db_port():
    port_str = os.getenv('DB_PORT', '5432')
    try:
        return int(port_str) if port_str else 5432
    except ValueError:
        return 5432

# Initialize connection pool globally
db_pool = None
pool_error = None

def init_db_pool():
    global db_pool, pool_error
    if db_pool is not None:
        return db_pool

    try:
        db_url = os.getenv('DATABASE_URL')
        if db_url:
            if "sslmode=" not in db_url:
                db_url = db_url + ("&sslmode=require" if "?" in db_url else "?sslmode=require")
            db_pool = SimpleConnectionPool(1, 10, db_url)
        else:
            db_pool = SimpleConnectionPool(
                1, 10,
                host=os.getenv('DB_HOST', 'localhost').strip(),
                user=os.getenv('DB_USER', 'postgres').strip(),
                password=os.getenv('DB_PASSWORD', 'postgres').strip(),
                dbname=os.getenv('DB_NAME', 'postgres').strip(),
                port=get_db_port()
            )
        pool_error = None
        print("Database connection pool created successfully")
        return db_pool
    except Exception as e: # Catch all exceptions, not just psycopg2.Error
        pool_error = str(e)
        print(f"Error creating connection pool: {e}")
        return None

# Initial attempt to create pool
init_db_pool()

SECRET_KEY = os.getenv('SECRET_KEY', 'your-super-secret-key-change-this-to-a-very-long-random-string-please')
if SECRET_KEY == 'your-super-secret-key-change-this-to-a-very-long-random-string-please' and os.getenv('DEV_MODE', '').lower() != 'true':
    print("WARNING: Default SECRET_KEY is being used in production. Please set SECRET_KEY in the environment properly.")

ALGORITHM = "HS256"

# Allow all origins during development
allowed_origins = [os.getenv('FRONTEND_URL', 'http://localhost:3000')]
if os.getenv('DEV_MODE', 'true').lower() == 'true':
    # By standardizing to true fallback, we ensure dev servers pass CORS checks
    allowed_origins = [
        "http://localhost:8000", "http://127.0.0.1:5500", "http://localhost:5500", 
        "http://127.0.0.1:8000", "null", "http://127.0.0.1:5501", "http://localhost:5501", 
        "http://127.0.0.1:3000", "http://localhost:3000", "*"
    ]
else:
    # If not DEV_MODE, adding the local file execution as fallback
    allowed_origins.extend(["null", "file://"])
    
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods including OPTIONS
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = "/tmp/uploads"
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except OSError as e:
    print(f"Warning: Could not create upload dir: {e}")

try:
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
except Exception:
    pass  # uploads directory may not exist yet

# ============ MODELS ============
from pydantic import BaseModel, EmailStr, validator

class AdminLogin(BaseModel):
    email: EmailStr
    password: str

class Product(BaseModel):
    name: str
    description: str
    price: float
    stock: int
    category: str  # For backward compatibility
    category_id: int  # Foreign key reference to categories table
    color: Optional[str] = None
    material: Optional[str] = None
    size: Optional[str] = None

class OrderItem(BaseModel):
    product_id: int
    quantity: int

class CreateOrder(BaseModel):
    user_id: int
    items: List[OrderItem]
    total_amount: float
    status: str = "pending"

class UpdateOrderStatus(BaseModel):
    status: str

# Wrapper so psycopg2 behaves like mysql-connector w.r.t closing the connection
class PooledConnection:
    def __init__(self, conn, pool):
        self.conn = conn
        self.pool = pool
    def cursor(self, *args, **kwargs):
        return self.conn.cursor(*args, **kwargs)
    def commit(self):
        self.conn.commit()
    def rollback(self):
        self.conn.rollback()
    def close(self):
        self.pool.putconn(self.conn)

# ============ DATABASE CONNECTION ============
def get_db():
    global db_pool, pool_error
    if db_pool is None:
        db_pool = init_db_pool()
        if db_pool is None:
            raise HTTPException(status_code=500, detail=f"Database connection pool not initialized. Reason: {pool_error}")
    
    try:
        conn = db_pool.getconn()
        conn.autocommit = False
        return PooledConnection(conn, db_pool)
    except Error as e:
        raise HTTPException(status_code=500, detail=f"Database connection error: {str(e)}")

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=24)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============ ADMIN AUTH ENDPOINTS ============

@app.options("/api/admin/login")
async def admin_login_options():
    from starlette.responses import Response
    response = Response()
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

@app.post("/api/admin/login")
@limiter.limit("5/minute")
async def admin_login(request: Request, admin: AdminLogin):
    print(f"Admin login attempt for: {admin.email}")  # Debug print
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute("SELECT id, email, password, role FROM admins WHERE email = %s", (admin.email,))
        db_admin = cursor.fetchone()
        
        if not db_admin or not verify_password(admin.password, db_admin['password']):
            raise HTTPException(status_code=401, detail="Invalid admin credentials")
        
        token = create_token({"sub": str(db_admin['id']), "role": db_admin['role']})
        
        return {"token": token, "message": "Admin login successful"}
    except HTTPException:
        raise
    except Error as e:
        print(f"Database error in admin login: {str(e)}")  # Debug print
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

# ============ PRODUCT ENDPOINTS ============
@app.get("/api/products")
async def get_products():
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute(
            "SELECT p.id, p.name, p.description, p.price, p.stock, p.category, p.category_id, p.color, p.material, p.size, p.created_at, (SELECT STRING_AGG(image_url, ',') FROM product_images WHERE product_id = p.id) as image_urls FROM products p WHERE p.stock > 0"
        )
        products = cursor.fetchall()
        
        # Process the results to convert image_urls to an array
        for product in products:
            if product['image_urls']:
                product['images'] = product['image_urls'].split(',')
            else:
                product['images'] = []
            # Remove the temporary image_urls field
            del product['image_urls']
        
        return {"products": products}
    except Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.post("/api/products")
async def create_product(product: Product, credentials: HTTPAuthorizationCredentials = Depends(security)): 
    payload = verify_token(credentials)
    
    # âœ… Simple admin check - only "admin" role allowed
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized - Admin only")
    
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Verify category_id exists
        cursor.execute("SELECT id FROM categories WHERE id = %s", (product.category_id,))
        category_exists = cursor.fetchone()
        if not category_exists:
            raise HTTPException(status_code=400, detail="Category does not exist")
        
        # Get category name based on category_id for backward compatibility
        cursor.execute("SELECT name FROM categories WHERE id = %s", (product.category_id,))
        category_record = cursor.fetchone()
        category_name = category_record['name'] if category_record else product.category
        
        cursor.execute(
            "INSERT INTO products (name, description, price, stock, category, category_id, color, material, size, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (product.name, product.description, product.price, product.stock, category_name, product.category_id, product.color, product.material, product.size, datetime.now())
        )
        product_id = cursor.fetchone()['id']
        conn.commit()
        return {"message": "Product created", "id": product_id}
    except Error as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.put("/api/products/{product_id}")
async def update_product(product_id: int, product: Product, credentials: HTTPAuthorizationCredentials = Depends(security)): 
    payload = verify_token(credentials)
    
    # âœ… Simple admin check - only "admin" role allowed
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized - Admin only")
    
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Verify category_id exists
        cursor.execute("SELECT id FROM categories WHERE id = %s", (product.category_id,))
        category_exists = cursor.fetchone()
        if not category_exists:
            raise HTTPException(status_code=400, detail="Category does not exist")
        
        # Get category name based on category_id for backward compatibility
        cursor.execute("SELECT name FROM categories WHERE id = %s", (product.category_id,))
        category_record = cursor.fetchone()
        category_name = category_record['name'] if category_record else product.category
        
        cursor.execute(
            "UPDATE products SET name = %s, description = %s, price = %s, stock = %s, category = %s, category_id = %s, color = %s, material = %s, size = %s WHERE id = %s",
            (product.name, product.description, product.price, product.stock, category_name, product.category_id, product.color, product.material, product.size, product_id)
        )
        conn.commit()
        return {"message": "Product updated"}
    except Error as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.delete("/api/products/{product_id}")
async def delete_product(product_id: int, credentials: HTTPAuthorizationCredentials = Depends(security)): 
    payload = verify_token(credentials)
    
    # âœ… Simple admin check - only "admin" role allowed
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized - Admin only")
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("DELETE FROM products WHERE id = %s", (product_id,))
        conn.commit()
        return {"message": "Product deleted"}
    except Error as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.post("/api/products/{product_id}/images")
async def upload_product_images(product_id: int, files: List[UploadFile] = File(...), credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    
    # âœ… Simple admin check - only "admin" role allowed
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized - Admin only")
    
    # Check if product exists
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT id FROM products WHERE id = %s", (product_id,))
        product = cursor.fetchone()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
    finally:
        cursor.close()
        conn.close()
    
    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images allowed per upload")
    
    # Validate file sizes (max 5MB each)
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB in bytes
    for i, file in enumerate(files):
        # Seek to end to get file size, then back to start
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Seek back to beginning
        
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File {i+1} is too large. Maximum size is 5MB.")
    
    uploaded_images = []
    conn = get_db()
    cursor = conn.cursor()
    
    ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp'}
    import imghdr

    try:
        for i, file in enumerate(files):
            # Read file contents
            contents = await file.read()
            
            # Validate magic bytes for true file type (not just content-type header)
            image_type = imghdr.what(None, h=contents)
            
            # Validate extension
            ext = file.filename.split('.')[-1].lower()
            if ext not in ALLOWED_EXTENSIONS or image_type not in ALLOWED_EXTENSIONS:
                raise HTTPException(status_code=400, detail=f"File {i+1} is not a valid image. Only JPG, PNG, and WebP are allowed.")
            
            # Generate secure, unique filename
            filename = f"{uuid.uuid4().hex}.{ext}"
            filepath = os.path.join(UPLOAD_DIR, filename)
            
            # Save file to temp directory
            with open(filepath, "wb") as f:
                f.write(contents)
            
            # Store base64 data URL in database so image persists
            import base64
            mime = 'image/jpeg' if ext in ('jpg','jpeg') else f'image/{ext}'
            b64 = base64.b64encode(contents).decode('utf-8')
            image_url = f"data:{mime};base64,{b64}"
            is_primary = (i == 0)  # First image is primary
            
            cursor.execute(
                "INSERT INTO product_images (product_id, image_url, is_primary, sort_order) VALUES (%s, %s, %s, %s)",
                (product_id, image_url, is_primary, i)
            )
            uploaded_images.append(image_url)
        
        # Update image count
        cursor.execute(
            "UPDATE products SET image_count = (SELECT COUNT(*) FROM product_images WHERE product_id = %s) WHERE id = %s",
            (product_id, product_id)
        )
        
        conn.commit()
        return {"message": f"{len(uploaded_images)} images uploaded successfully", "image_urls": uploaded_images}
    
    except Error as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@app.get("/api/products/{product_id}/images")
async def get_product_images(product_id: int):
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute(
            "SELECT id, image_url, is_primary, sort_order FROM product_images WHERE product_id = %s ORDER BY sort_order",
            (product_id,)
        )
        images = cursor.fetchall()
        return {"images": images}
    except Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.delete("/api/products/{product_id}/images/{image_id}")
async def delete_product_image(product_id: int, image_id: int, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    
    # âœ… Simple admin check - only "admin" role allowed
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized - Admin only")
    
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Get image info before deleting
        cursor.execute(
            "SELECT image_url FROM product_images WHERE id = %s AND product_id = %s",
            (image_id, product_id)
        )
        image = cursor.fetchone()
        
        if not image:
            raise HTTPException(status_code=404, detail="Image not found for this product")
        
        # Delete image file from disk
        image_path = os.path.join(os.getcwd(), image['image_url'][1:])  # Remove leading slash
        if os.path.exists(image_path):
            os.remove(image_path)
        
        # Delete record from database
        cursor.execute(
            "DELETE FROM product_images WHERE id = %s AND product_id = %s",
            (image_id, product_id)
        )
        
        # Update image count
        cursor.execute(
            "UPDATE products SET image_count = (SELECT COUNT(*) FROM product_images WHERE product_id = %s) WHERE id = %s",
            (product_id, product_id)
        )
        
        conn.commit()
        return {"message": "Image deleted successfully"}
    except Error as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

# ============ ORDER ENDPOINTS ============
@app.post("/api/orders")
async def create_order(order: CreateOrder, credentials: HTTPAuthorizationCredentials = Depends(security)): 
    payload = verify_token(credentials)
    user_id = int(payload.get("sub"))
    
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # TRANSACTION START
        cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Verify stock availability for all items before creating order
        # Using SELECT ... FOR UPDATE to lock rows during transaction
        for item in order.items:
            cursor.execute("SELECT stock FROM products WHERE id = %s FOR UPDATE", (item.product_id,))
            product = cursor.fetchone()
            if not product or product['stock'] < item.quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for product {item.product_id}. Available: {product['stock'] if product else 0}, Requested: {item.quantity}")
        
        # Insert order
        cursor.execute(
            "INSERT INTO orders (user_id, total_amount, status, delivery_address, created_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (user_id, order.total_amount, order.status, "Pakistan", datetime.now())
        )
        order_id = cursor.fetchone()['id']
        
        # Insert order items and deduct stock
        for item in order.items:
            cursor.execute("SELECT price FROM products WHERE id = %s", (item.product_id,))
            product = cursor.fetchone()
            
            # Insert order item
            cursor.execute(
                "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (%s, %s, %s, %s)",
                (order_id, item.product_id, item.quantity, product['price'])
            )
            
            # Deduct stock from products table
            cursor.execute(
                "UPDATE products SET stock = stock - %s WHERE id = %s",
                (item.quantity, item.product_id)
            )
            
            # Log inventory change
            cursor.execute("SELECT stock FROM products WHERE id = %s", (item.product_id,))
            new_stock = cursor.fetchone()['stock']
            old_stock = new_stock + item.quantity
            
            cursor.execute(
                "INSERT INTO inventory_logs (product_id, old_stock, new_stock, action) VALUES (%s, %s, %s, %s)",
                (item.product_id, old_stock, new_stock, "order_placed")
            )
        
        # Single commit for entire transaction
        conn.commit()
        
        return {"message": "Order created successfully", "order_id": order_id}
    
    except HTTPException:
        conn.rollback()
        raise
    except Error as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@app.get("/api/orders/user/{user_id}")
async def get_user_orders(user_id: int, credentials: HTTPAuthorizationCredentials = Depends(security)): 
    payload = verify_token(credentials)
    token_user_id = int(payload.get("sub"))
    
    # IDOR Protection: User can only see their own orders
    if token_user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden. You can only view your own orders.")

    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute(
            "SELECT id, user_id, total_amount, status, delivery_address, created_at FROM orders WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,)
        )
        orders = cursor.fetchall()
        
        for order in orders:
            cursor.execute(
                "SELECT oi.product_id, p.name as product_name, oi.quantity, p.price FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = %s",
                (order['id'],)
            )
            order['items'] = cursor.fetchall()
        
        return {"orders": orders}
    except Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.get("/api/admin/orders")
async def get_admin_orders(credentials: HTTPAuthorizationCredentials = Depends(security)): 
    payload = verify_token(credentials)
    
    # âœ… Simple admin check - only "admin" role allowed
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized - Admin only")
    
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute(
            "SELECT o.id, o.user_id, u.name as customer_name, u.phone as customer_phone, o.total_amount, o.status, o.delivery_address, o.created_at FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC"
        )
        orders = cursor.fetchall()
        
        for order in orders:
            cursor.execute(
                "SELECT oi.product_id, p.name as product_name, oi.quantity, p.price FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = %s",
                (order['id'],)
            )
            order['items'] = cursor.fetchall()
        
        return {"orders": orders}
    except Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.put("/api/admin/orders/{order_id}")
async def update_order_status(order_id: int, update: UpdateOrderStatus, credentials: HTTPAuthorizationCredentials = Depends(security)): 
    payload = verify_token(credentials)
    
    # âœ… Simple admin check - only "admin" role allowed
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized - Admin only")
    
    conn = get_db()
    cursor = conn.cursor()
    admin_id = int(payload.get("sub"))
    
    try:
        cursor.execute("UPDATE orders SET status = %s, updated_at = %s WHERE id = %s", 
                      (update.status, datetime.now(), order_id))
        
        # Log admin activity
        cursor.execute(
            "INSERT INTO activity_logs (admin_id, action, details) VALUES (%s, %s, %s)",
            (admin_id, f"Order {order_id} status updated", f"New status: {update.status}")
        )
        
        conn.commit()
        return {"message": "Order status updated"}
    except Error as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

# ============ ADMIN STATS ENDPOINTS ============
@app.get("/api/admin/stats/users")
async def get_users_stats(credentials: HTTPAuthorizationCredentials = Depends(security)): 
    payload = verify_token(credentials)
    
    # âœ… Simple admin check - only "admin" role allowed
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized - Admin only")
    
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute("SELECT COUNT(*) as count FROM users")
        result = cursor.fetchone()
        return result
    except Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.get("/api/admin/stats/products")
async def get_products_stats(credentials: HTTPAuthorizationCredentials = Depends(security)): 
    payload = verify_token(credentials)
    
    # âœ… Simple admin check - only "admin" role allowed
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized - Admin only")
    
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute("SELECT COUNT(*) as count FROM products")
        result = cursor.fetchone()
        return result
    except Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.get("/api/admin/stats/orders")
async def get_orders_stats(credentials: HTTPAuthorizationCredentials = Depends(security)): 
    payload = verify_token(credentials)
    
    # âœ… Simple admin check - only "admin" role allowed
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized - Admin only")
    
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Fixed: Include all delivered/shipped/confirmed orders
        cursor.execute("SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total_sales FROM orders WHERE status IN ('confirmed', 'shipped', 'delivered')")
        result = cursor.fetchone()
        return result
    except Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.get("/api/admin/customers")
async def get_customers(credentials: HTTPAuthorizationCredentials = Depends(security)): 
    payload = verify_token(credentials)
    
    # âœ… Simple admin check - only "admin" role allowed
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized - Admin only")
    
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute(
            "SELECT u.id, u.name, u.email, u.phone, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id, u.name, u.email, u.phone"
        )
        customers = cursor.fetchall()
        return {"customers": customers}
    except Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.put("/api/admin/customers/{customer_id}")
async def deactivate_customer(customer_id: int, update: dict, credentials: HTTPAuthorizationCredentials = Depends(security)): 
    payload = verify_token(credentials)
    
    # âœ… Simple admin check - only "admin" role allowed
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized - Admin only")
    
    conn = get_db()
    cursor = conn.cursor()
    admin_id = int(payload.get("sub"))
    
    try:
        cursor.execute("UPDATE users SET status = %s WHERE id = %s", (update.get("status"), customer_id))
        
        cursor.execute(
            "INSERT INTO activity_logs (admin_id, action, details) VALUES (%s, %s, %s)",
            (admin_id, f"Customer {customer_id} deactivated", f"Status: {update.get('status')}")
        )
        
        conn.commit()
        return {"message": "Customer updated"}
    except Error as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.get("/api/admin/reports")
async def get_reports(period: str = "daily", credentials: HTTPAuthorizationCredentials = Depends(security)): 
    payload = verify_token(credentials)
    
    # âœ… Simple admin check - only "admin" role allowed
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized - Admin only")
    
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Fixed: MySQL-compatible DATE_FORMAT instead of PostgreSQL DATE_TRUNC
        if period == "monthly":
            query = """
                SELECT DATE_FORMAT(created_at, '%Y-%m-01') as date, 
                       COUNT(*) as orders, 
                       COALESCE(SUM(total_amount), 0) as revenue 
                FROM orders 
                WHERE status IN ('confirmed', 'shipped', 'delivered')
                AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
                GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                ORDER BY date DESC
            """
        else:  # daily
            query = """
                SELECT DATE(created_at) as date, 
                       COUNT(*) as orders, 
                       COALESCE(SUM(total_amount), 0) as revenue 
                FROM orders 
                WHERE status IN ('confirmed', 'shipped', 'delivered')
                AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            """
        
        cursor.execute(query)
        report_data = cursor.fetchall()
        
        total_orders = sum(r['orders'] for r in report_data)
        total_revenue = sum(float(r['revenue']) for r in report_data)
        
        return {
            "report_data": report_data,
            "total_orders": total_orders,
            "total_revenue": total_revenue
        }
    except Error as e:
        print(f"Report error: {str(e)}")
        return {"report_data": [], "total_orders": 0, "total_revenue": 0}
    finally:
        cursor.close()
        conn.close()

@app.get("/api/categories")
async def get_categories():
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute("SELECT id, name FROM categories WHERE status = 'active' ORDER BY name")
        categories = cursor.fetchall()
        return {"categories": categories}
    except Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.get("/health")
async def health_check():
    return {"status": "API is running"}

@app.get("/api/setup-admin")
async def setup_admin():
    conn = get_db()
    cursor = conn.cursor()
    try:
        email = "raotaimoor652@gmail.com"
        # Pure native Vercel backend hashing
        hashed_pw = hash_password("RaoNisa768")
        
        cursor.execute("SELECT id FROM admins WHERE email = %s", (email,))
        if cursor.fetchone():
            cursor.execute("UPDATE admins SET password = %s WHERE email = %s", (hashed_pw, email))
            msg = "Admin password updated."
        else:
            cursor.execute(
                "INSERT INTO admins (name, email, password, role) VALUES (%s, %s, %s, %s)",
                ("Admin Taimoor", email, hashed_pw, "admin")
            )
            msg = "Admin account created."
        conn.commit()
        return {"status": "success", "message": msg, "email": email, "password": "RaoNisa768"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
import os
import bcrypt
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

# Admin credentials to create
ADMIN_NAME = "Admin Taimoor"
ADMIN_EMAIL = "raotaimoor652@gmail.com"
ADMIN_PASSWORD = "RaoNisa768"

print(f"Bana raha hoon admin: {ADMIN_EMAIL} ...")

try:
    # Connect via DATABASE_URL
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        # Prompt user if missing
        db_url = input("Apna Supabase DATABASE_URL enter karein: ")
        
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    # Check if admin already exists
    cursor.execute("SELECT * FROM admins WHERE email = %s", (ADMIN_EMAIL,))
    if cursor.fetchone():
        print("Admin user pehle se mojood hai!")
    else:
        # Hash password and insert
        hashed_pw = bcrypt.hashpw(ADMIN_PASSWORD.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cursor.execute(
            "INSERT INTO admins (name, email, password, role) VALUES (%s, %s, %s, %s)",
            (ADMIN_NAME, ADMIN_EMAIL, hashed_pw, 'admin')
        )
        conn.commit()
        print("✅ SUCCESS! Admin account ban gaya hai.")
        print(f"Email: {ADMIN_EMAIL}")
        print(f"Password: {ADMIN_PASSWORD}")
        
except Exception as e:
    print("❌ Error aaya:", e)
finally:
    if 'cursor' in locals(): cursor.close()
    if 'conn' in locals(): conn.close()

from flask import Flask, render_template, request, jsonify, Response
import sqlite3
from datetime import datetime
from zoneinfo import ZoneInfo 
from flask_cors import CORS
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)  # Add this after creating your Flask app

# Initialize database
def init_db():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    
    # inventory table
    c.execute('''CREATE TABLE IF NOT EXISTS inventory
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  date TEXT NOT NULL,
                  supplier_name TEXT,
                  supplier_contact TEXT,
                  fish_type TEXT NOT NULL,
                  transaction_type TEXT NOT NULL,
                  quantity REAL NOT NULL,
                  unit_price REAL NOT NULL,
                  total_price REAL NOT NULL,
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    
    # sales table
    c.execute('''CREATE TABLE IF NOT EXISTS sales
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  date TEXT NOT NULL,
                  purchaser_name TEXT NOT NULL,
                  purchaser_contact TEXT NOT NULL,
                  fish_type TEXT NOT NULL,
                  transaction_type TEXT NOT NULL,
                  quantity REAL NOT NULL,
                  unit_price REAL NOT NULL,
                  total_price REAL NOT NULL,
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')

    
    # NEW: Stock tracking table
    c.execute('''CREATE TABLE IF NOT EXISTS stock
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  fish_type TEXT UNIQUE NOT NULL,
                  current_quantity REAL NOT NULL DEFAULT 0,
                  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    
     # Create tables
    c.execute('''
    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS fish_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        current_price REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        bill_date DATE NOT NULL,
        subtotal REAL NOT NULL,
        tax REAL NOT NULL,
        total_amount REAL NOT NULL,
        previous_balance REAL DEFAULT 0,
        amount_paid REAL DEFAULT 0,
        balance_due REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
    ''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS bill_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id INTEGER NOT NULL,
        fish_item_id INTEGER,
        fish_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        FOREIGN KEY (bill_id) REFERENCES bills(id),
        FOREIGN KEY (fish_item_id) REFERENCES fish_items(id)
    )
    ''')
    
    # Insert some initial fish items if they don't exist
    default_fish = [
        ('Pomfret', 350.00),
        ('Salmon', 850.00),
        ('Tuna', 600.00),
        ('Sardine', 200.00),
        ('Mackerel', 250.00)
    ]
    
    c.executemany('''
    INSERT OR IGNORE INTO fish_items (name, current_price) VALUES (?, ?)
    ''', default_fish)

    # finance table
    c.execute('''
    CREATE TABLE IF NOT EXISTS financial_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_type TEXT NOT NULL CHECK(transaction_type IN ('in', 'out')),
        payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'online')),
        amount REAL NOT NULL,
        client_name TEXT,
        client_phone TEXT,
        image_data BLOB,  -- Changed from image_path to store binary data
        image_name TEXT,  -- Store original filename
        image_type TEXT,  -- Store MIME type (e.g., 'image/jpeg')
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    c.execute('''
    CREATE INDEX IF NOT EXISTS idx_transactions_client 
    ON financial_transactions (client_name, client_phone)
    ''')

    c.execute('''
    CREATE TABLE IF NOT EXISTS advance_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        amount REAL,
        fish_type TEXT,
        advance REAL,
        name TEXT,
        contact TEXT
    )
    ''')

    
    conn.commit()
    conn.close()

# API endpoint to save inventory
@app.route('/api/inventory', methods=['POST'])
def save_inventory():
    try:
        print("Received data:", request.json)  # Debug what's being received
        
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Required field validation
        required_fields = ['date', 'supplierName', 'supplierContact', 'fishType', 'type', 'quantity', 'unitPrice']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Calculate total price
        total_price = float(data['quantity']) * float(data['unitPrice'])
        data['totalPrice'] = total_price  # Add to data dict

        conn = sqlite3.connect('database.db')
        c = conn.cursor()

        # Insert inventory record
        c.execute('''INSERT INTO inventory 
                    (date, supplier_name, supplier_contact, fish_type, 
                     transaction_type, quantity, unit_price, total_price)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                 (data['date'], data['supplierName'], data['supplierContact'],
                  data['fishType'], data['type'], data['quantity'],
                  data['unitPrice'], data['totalPrice']))

        # Update stock
        quantity_change = data['quantity'] if data['type'] == 'IN' else -data['quantity']
        c.execute('''INSERT OR IGNORE INTO stock (fish_type, current_quantity)
                     VALUES (?, 0)''', (data['fishType'],))
        c.execute('''UPDATE stock 
                     SET current_quantity = current_quantity + ?
                     WHERE fish_type = ?''',
                 (quantity_change, data['fishType']))

        conn.commit()
        return jsonify({"success": True, "message": "Inventory saved!"})

    except Exception as e:
        print("Error:", str(e))  # Print the error to console
        return jsonify({"error": str(e)}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/salesRecord', methods=['POST'])
def save_sales():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Validate required fields
        required_fields = ['date', 'purchaserName', 'purchaserContact', 
                         'fishType', 'quantity', 'unitPrice']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Calculate total price
        total_price = float(data['quantity']) * float(data['unitPrice'])

        conn = sqlite3.connect('database.db')
        c = conn.cursor()

        # 1. First check stock availability
        c.execute('''SELECT current_quantity FROM stock 
                     WHERE fish_type = ?''', (data['fishType'],))
        stock = c.fetchone()
        
        if not stock or stock[0] < float(data['quantity']):
            return jsonify({
                "error": f"Insufficient stock. Available: {stock[0] if stock else 0}"
            }), 400

        # 2. Record the sale
        c.execute('''INSERT INTO sales 
                    (date, purchaser_name, purchaser_contact, fish_type, transaction_type,
                     quantity, unit_price, total_price)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                 (data['date'], data['purchaserName'], data['purchaserContact'],
                  data['fishType'],data['type'], data['quantity'],
                  data['unitPrice'], total_price))

        # 3. Update stock (deduct quantity)
        c.execute('''UPDATE stock 
                     SET current_quantity = current_quantity - ?,
                         last_updated = CURRENT_TIMESTAMP
                     WHERE fish_type = ?''',
                 (data['quantity'], data['fishType']))

        conn.commit()
        return jsonify({
            "success": True, 
            "message": "Sale recorded successfully!",
            "remaining_stock": stock[0] - float(data['quantity'])
        })

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Inventory list page
@app.route('/inventory')
def inventory_list():
    return render_template('inventory_list.html')

# API endpoint to get all inventory
@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    limit = request.args.get('limit', default=None, type=int)
    
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    
    query = 'SELECT * FROM inventory ORDER BY date DESC'
    if limit:
        query += f' LIMIT {limit}'
    
    c.execute(query)
    rows = c.fetchall()
    conn.close()
    
    inventory = []
    for row in rows:
        inventory.append({
            'id': row[0],
            'date': row[1],
            'supplierName': row[2],
            'supplierContact': row[3],
            'fishType': row[4],
            'type': row[5],
            'quantity': row[6],
            'unitPrice': row[7],
            'totalPrice': row[8],
            'timestamp': row[9]
        })
    
    return jsonify(inventory)

# Add these new routes to your existing app.py

# API for sales summary
@app.route('/api/sales/summary')
def sales_summary():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    
    # Total sales value
    c.execute("SELECT SUM(total_price) FROM sales WHERE transaction_type='OUT'")
    total_sales = c.fetchone()[0] or 0
    
    # Total purchases value
    c.execute("SELECT SUM(total_price) FROM inventory WHERE transaction_type='IN'")
    total_purchases = c.fetchone()[0] or 0
    
    # Profit calculation
    profit = total_sales - total_purchases
    
    # Count of transactions
    c.execute("SELECT COUNT(*) FROM sales")
    sale_transactions = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM inventory")
    purchase_transactions = c.fetchone()[0]

    total_transactions = sale_transactions + purchase_transactions
    
    conn.close()
    
    return jsonify({
        'total_sales': total_sales,
        'total_purchases': total_purchases,
        'profit': profit,
        'total_transactions': total_transactions
    })

# API for fish type sales breakdown
@app.route('/api/sales/by-fish')
def sales_by_fish():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    
    c.execute('''SELECT fish_type, SUM(quantity) as total_quantity, 
                 SUM(total_price) as total_value 
                 FROM sales WHERE transaction_type='OUT' 
                 GROUP BY fish_type''')
    
    fish_data = []
    for row in c.fetchall():
        fish_data.append({
            'fish_type': row[0],
            'total_quantity': row[1],
            'total_value': row[2]
        })
    
    conn.close()
    return jsonify(fish_data)

# API for monthly sales trend
@app.route('/api/sales/monthly-trend')
def monthly_trend():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    
    c.execute('''SELECT strftime('%Y-%m', date) as month, 
                 SUM(CASE WHEN transaction_type='OUT' THEN total_price ELSE 0 END) as sales
                 FROM sales 
                 GROUP BY month ORDER BY month''')
    
    trend_data = []
    for row in c.fetchall():
        trend_data.append({
            'month': row[0],
            'sales': row[1] or 0
        })

    c.execute('''SELECT strftime('%Y-%m', date) as month, 
                 SUM(CASE WHEN transaction_type='IN' THEN total_price ELSE 0 END) as purchases
                 FROM inventory 
                 GROUP BY month ORDER BY month''')
    for row in c.fetchall():
        trend_data.append({
            'month': row[0],
            'purchases': row[1] or 0
        })
    
    conn.close()
    return jsonify(trend_data)

def update_stock(fish_type, quantity_change):
    """Update stock quantity (positive for IN, negative for OUT)"""
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    
    try:
        # Try to update existing record
        c.execute('''UPDATE stock 
                     SET current_quantity = current_quantity + ?,
                         last_updated = CURRENT_TIMESTAMP
                     WHERE fish_type = ?''', 
                 (quantity_change, fish_type))
        
        # If no rows affected, insert new record
        if c.rowcount == 0:
            c.execute('''INSERT INTO stock (fish_type, current_quantity)
                         VALUES (?, ?)''',
                     (fish_type, quantity_change))
        
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

@app.route('/api/stock', methods=['GET'])
def get_stock():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('SELECT * FROM stock ORDER BY fish_type')
    stock = [{'fish_type': row[1], 'quantity': row[2]} for row in c.fetchall()]
    conn.close()
    return jsonify(stock)

# Get fish types for dropdown
@app.route('/api/fish-types')
def get_fish_types():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("SELECT DISTINCT fish_type FROM stock")
    types = [row[0] for row in c.fetchall()]
    conn.close()
    return jsonify(types)

# Reset all stock to zero
@app.route('/api/stock/reset', methods=['POST'])
def reset_stock():
    try:
        conn = sqlite3.connect('database.db')
        c = conn.cursor()
        c.execute("UPDATE stock SET current_quantity = 0")
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# Filter inventory by type
@app.route('/api/inventory')
def get_filtered_inventory():
    type_filter = request.args.get('type', default=None)
    
    query = "SELECT * FROM inventory"
    if type_filter:
        query += f" WHERE transaction_type = '{type_filter}'"
    query += " ORDER BY date DESC"
    
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute(query)
    rows = c.fetchall()
    conn.close()
    
    inventory = []
    for row in rows:
        inventory.append({
            'id': row[0],
            'date': row[1],
            'fishType': row[4],
            'type': row[5],
            'quantity': row[6],
            'unitPrice': row[7],
            'totalPrice': row[8]
        })
    
    return jsonify(inventory)


# Helper function to get database connection
def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

# API Routes
@app.route('/api/fish_items', methods=['GET'])
def get_fish_items():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM fish_items')
    fish_items = cursor.fetchall()
    conn.close()
    return jsonify([dict(item) for item in fish_items])

@app.route('/api/customers', methods=['GET', 'POST'])
def handle_customers():
    if request.method == 'GET':
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM customers')
        customers = cursor.fetchall()
        conn.close()
        return jsonify([dict(customer) for customer in customers])
    
    elif request.method == 'POST':
        data = request.get_json()
        name = data.get('name')
        phone = data.get('phone')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO customers (name, phone) VALUES (?, ?)
        ''', (name, phone))
        conn.commit()
        customer_id = cursor.lastrowid
        conn.close()
        return jsonify({'id': customer_id, 'name': name, 'phone': phone}), 201

@app.route('/api/bills', methods=['GET', 'POST'])
def handle_bills():
    if request.method == 'GET':
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
        SELECT bills.*, customers.name as customer_name, customers.phone as customer_phone
        FROM bills
        LEFT JOIN customers ON bills.customer_id = customers.id
        ORDER BY bills.bill_date DESC
        ''')
        bills = cursor.fetchall()
        conn.close()
        return jsonify([dict(bill) for bill in bills])
    
    elif request.method == 'POST':
        data = request.get_json()
        
        # Extract bill data
        customer_id = data.get('customer_id')
        customer_name = data.get('customer_name')
        customer_phone = data.get('customer_phone')
        bill_date = data.get('bill_date', datetime.now().date().isoformat())
        items = data.get('items', [])
        subtotal = data.get('subtotal', 0)
        tax = data.get('tax', 0)
        total_amount = data.get('total_amount', 0)
        previous_balance = data.get('previous_balance', 0)
        amount_paid = data.get('amount_paid', 0)
        balance_due = data.get('balance_due', 0)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # If customer doesn't exist, create a new one
        if not customer_id and customer_name:
            cursor.execute('''
            INSERT INTO customers (name, phone) VALUES (?, ?)
            ''', (customer_name, customer_phone))
            customer_id = cursor.lastrowid
        
        # Insert bill
        cursor.execute('''
        INSERT INTO bills (
            customer_id, bill_date, subtotal, tax, total_amount,
            previous_balance, amount_paid, balance_due
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            customer_id, bill_date, subtotal, tax, total_amount,
            previous_balance, amount_paid, balance_due
        ))
        bill_id = cursor.lastrowid
        
        # Insert bill items
        for item in items:
            fish_item_id = item.get('fish_item_id')
            fish_name = item.get('fish_name')
            quantity = item.get('quantity')
            unit_price = item.get('unit_price')
            total_price = item.get('total_price')
            
            cursor.execute('''
            INSERT INTO bill_items (
                bill_id, fish_item_id, fish_name, quantity, unit_price, total_price
            ) VALUES (?, ?, ?, ?, ?, ?)
            ''', (bill_id, fish_item_id, fish_name, quantity, unit_price, total_price))
        
        conn.commit()
        
        # Get the complete bill data to return
        cursor.execute('''
        SELECT bills.*, customers.name as customer_name, customers.phone as customer_phone
        FROM bills
        LEFT JOIN customers ON bills.customer_id = customers.id
        WHERE bills.id = ?
        ''', (bill_id,))
        bill = cursor.fetchone()
        
        cursor.execute('SELECT * FROM bill_items WHERE bill_id = ?', (bill_id,))
        bill_items = cursor.fetchall()
        
        conn.close()
        
        response = dict(bill)
        response['items'] = [dict(item) for item in bill_items]
        return jsonify(response), 201

@app.route('/api/bills/<int:bill_id>', methods=['GET'])
def get_bill(bill_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
    SELECT bills.*, customers.name as customer_name, customers.phone as customer_phone
    FROM bills
    LEFT JOIN customers ON bills.customer_id = customers.id
    WHERE bills.id = ?
    ''', (bill_id,))
    bill = cursor.fetchone()
    
    if not bill:
        conn.close()
        return jsonify({'error': 'Bill not found'}), 404
    
    cursor.execute('SELECT * FROM bill_items WHERE bill_id = ?', (bill_id,))
    items = cursor.fetchall()
    
    conn.close()
    
    response = dict(bill)
    response['items'] = [dict(item) for item in items]
    return jsonify(response)


# Add these new routes to app.py

@app.route('/api/bills/search', methods=['GET'])
def search_bills():
    name = request.args.get('name', '').strip()
    phone = request.args.get('phone', '').strip()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = '''
    SELECT bills.*, customers.name as customer_name, customers.phone as customer_phone
    FROM bills
    LEFT JOIN customers ON bills.customer_id = customers.id
    WHERE 1=1
    '''
    params = []
    
    if name:
        query += ' AND customers.name LIKE ?'
        params.append(f'%{name}%')
    
    if phone:
        query += ' AND customers.phone LIKE ?'
        params.append(f'%{phone}%')
    
    query += ' ORDER BY bills.bill_date DESC'
    
    cursor.execute(query, params)
    bills = cursor.fetchall()
    conn.close()
    
    return jsonify([dict(bill) for bill in bills])

@app.route('/api/customers/search', methods=['GET'])
def search_customers():
    name = request.args.get('name', '').strip()
    phone = request.args.get('phone', '').strip()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = 'SELECT * FROM customers WHERE 1=1'
    params = []
    
    if name:
        query += ' AND name LIKE ?'
        params.append(f'%{name}%')
    
    if phone:
        query += ' AND phone LIKE ?'
        params.append(f'%{phone}%')
    
    cursor.execute(query, params)
    customers = cursor.fetchall()
    conn.close()
    
    return jsonify([dict(customer) for customer in customers])

# Configuration

app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024  # 2MB limit
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(file):
    if not file or file.filename == '':
        return False
    if '.' not in file.filename:
        return False
    ext = file.filename.rsplit('.', 1)[1].lower()
    return (ext in ALLOWED_EXTENSIONS and 
            file.mimetype.startswith('image/'))



@app.route('/api/transactions', methods=['POST'])
def create_transaction():
    try:
        file = request.files.get('receipt_image')
        image_data = image_name = image_type = None
        
        if file:
            if not allowed_file(file):
                return jsonify({'error': 'Invalid file type'}), 400
            image_data = file.stream.read()  # More memory efficient
            image_name = secure_filename(file.filename)
            image_type = file.mimetype
        
        # Validate required fields
        try:
            amount = float(request.form.get('amount'))
            if amount <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid amount'}), 400
            
        transaction_type = request.form.get('transaction_type')
        if transaction_type not in ('in', 'out'):
            return jsonify({'error': 'Invalid transaction type'}), 400
            
        # Save to database
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute('''
            INSERT INTO financial_transactions (
                transaction_type, payment_method, amount, 
                client_name, client_phone, image_data, 
                image_name, image_type, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                transaction_type,
                request.form.get('payment_method'),
                amount,
                request.form.get('client_name'),
                request.form.get('client_phone'),
                image_data,
                image_name,
                image_type,
                request.form.get('notes')
            ))
            conn.commit()
            transaction_id = cursor.lastrowid
        except sqlite3.Error as e:
            conn.rollback()
            return jsonify({'error': 'Database error'}), 500
        finally:
            conn.close()
        
        return jsonify({
            'id': transaction_id,
            'status': 'success',
            'client_name': request.form.get('client_name')
        }), 201
        
    except Exception as e:
        return jsonify({'error': 'Server error'}), 500

@app.route('/api/transactions/<int:tx_id>/receipt')
def get_receipt(tx_id):
    conn = get_db_connection()
    try:
        tx = conn.execute("""
            SELECT image_data, image_type 
            FROM financial_transactions 
            WHERE id = ?
        """, (tx_id,)).fetchone()
        
        if not tx or not tx['image_data']:
            return jsonify({'error': 'Receipt not found'}), 404
            
        return Response(tx['image_data'], mimetype=tx['image_type'])
    finally:
        conn.close()

# Get all transactions
@app.route('/api/transactions', methods=['GET'])
def get_all_transactions():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, transaction_type, payment_method, amount, 
                   client_name, client_phone, image_name,
                   strftime('%Y-%m-%d %H:%M:%S', created_at) as created_at
            FROM financial_transactions
            ORDER BY created_at DESC
            LIMIT 100
        """)
        
        transactions = cursor.fetchall()
        return jsonify([dict(tx) for tx in transactions])
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/transactions/search', methods=['GET'])
def search_transactions():
    conn = None
    try:
        # Get and sanitize search parameters
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()

        conn = get_db_connection()
        cursor = conn.cursor()

        # Build parameterized query
        query = """
        SELECT 
            id,
            transaction_type,
            payment_method,
            amount,
            client_name,
            client_phone,
            image_name,
            image_type,
            notes,
            strftime('%Y-%m-%d %H:%M:%S', created_at) as created_at
        FROM financial_transactions
        WHERE 1=1
        """
        params = []


        # Date filtering
        if start_date:
            query += " AND date(created_at) >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND date(created_at) <= ?"
            params.append(end_date)

        query += " ORDER BY created_at DESC"

        # Execute query
        cursor.execute(query, params)
        transactions = cursor.fetchall()

        # Convert to JSON-serializable format
        results = []
        for tx in transactions:
            tx_dict = dict(tx)
            # Convert Decimal to float if needed
            if 'amount' in tx_dict:
                tx_dict['amount'] = float(tx_dict['amount'])
            # Remove binary data from response
            tx_dict.pop('image_data', None)
            results.append(tx_dict)

        return jsonify(results)

    except sqlite3.Error as e:
        app.logger.error(f"Database error in search: {str(e)}")
        return jsonify({'error': 'Database error', 'details': str(e)}), 500
        
    except Exception as e:
        app.logger.error(f"Unexpected error in search: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500
        
    finally:
        if conn:
            conn.close()

@app.route('/api/transactions/summary', methods=['GET'])
def transaction_summary():
    conn = None
    try:
        date = request.args.get('date', '').strip()
        if not date:
            return jsonify({'error': 'Date parameter is required'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Get summary for the date
        summary_query = """
        SELECT 
            COUNT(*) as total_transactions,
            SUM(amount) as total_amount,
            SUM(CASE WHEN transaction_type = 'in' THEN amount ELSE 0 END) as total_in,
            SUM(CASE WHEN transaction_type = 'out' THEN amount ELSE 0 END) as total_out
        FROM financial_transactions
        WHERE date(created_at) = ?
        """
        cursor.execute(summary_query, (date,))
        summary = cursor.fetchone()

        # Get transactions for the date
        transactions_query = """
        SELECT 
            id,
            transaction_type,
            payment_method,
            amount,
            client_name,
            client_phone,
            strftime('%Y-%m-%d %H:%M:%S', created_at) as created_at
        FROM financial_transactions
        WHERE date(created_at) = ?
        ORDER BY created_at DESC
        """
        cursor.execute(transactions_query, (date,))
        transactions = cursor.fetchall()

        # Convert to JSON-serializable format
        summary_dict = {
            'date': date,
            'total_transactions': summary['total_transactions'],
            'total_amount': float(summary['total_amount']) if summary['total_amount'] else 0,
            'total_in': float(summary['total_in']) if summary['total_in'] else 0,
            'total_out': float(summary['total_out']) if summary['total_out'] else 0,
            'transactions': []
        }

        for tx in transactions:
            tx_dict = dict(tx)
            if 'amount' in tx_dict:
                tx_dict['amount'] = float(tx_dict['amount'])
            summary_dict['transactions'].append(tx_dict)

        return jsonify(summary_dict)

    except sqlite3.Error as e:
        app.logger.error(f"Database error in summary: {str(e)}")
        return jsonify({'error': 'Database error', 'details': str(e)}), 500
        
    except Exception as e:
        app.logger.error(f"Unexpected error in summary: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500
        
    finally:
        if conn:
            conn.close()

# Create a route to save an advance order
@app.route('/api/save_advance_order', methods=['POST'])
def save_advance_order():
    try:
        data = request.get_json()  # Get the JSON data from the frontend
        
        # Extract values from the incoming data
        date = data['date']
        amount = data['amount']
        fish_type = data['fishType']
        advance = data['advance']
        name = data['name']
        contact = data['contact']

        # Insert into the database
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            INSERT INTO advance_orders (date, amount, fish_type, advance, name, contact)
            VALUES (?, ?, ?, ?, ?, ?)
        """
        cursor.execute(query, (date, amount, fish_type, advance, name, contact))
        conn.commit()
        conn.close()

        return jsonify({'message': 'Order saved successfully!'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/get_advance_orders', methods=['GET'])
def get_all_orders():
    try:
        date_filter = request.args.get('date')
        conn = get_db_connection()
        cursor = conn.cursor()

        if date_filter:
            cursor.execute("SELECT * FROM advance_orders WHERE date = ?", (date_filter,))
        else:
            cursor.execute("SELECT * FROM advance_orders ORDER BY date DESC")

        orders = cursor.fetchall()
        conn.close()

        # Convert the result to a JSON-serializable format
        orders_list = []
        for order in orders:
            order_dict = dict(order)
            orders_list.append(order_dict)

        return jsonify(orders_list)

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/delete_order/<int:order_id>', methods=['DELETE'])
def delete_order(order_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if order exists
        cursor.execute("SELECT * FROM advance_orders WHERE id = ?", (order_id,))
        order = cursor.fetchone()

        if not order:
            return jsonify({'error': 'Order not found'}), 404

        # Delete the order
        cursor.execute("DELETE FROM advance_orders WHERE id = ?", (order_id,))
        conn.commit()
        conn.close()

        return jsonify({'message': 'Order deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500



@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/sales')
def sales():
    return render_template('sales.html')

@app.route('/salesChart')
def salesChart():
    return render_template('salesChart.html')

@app.route('/inventorySelect')
def inventorySelect():
    return render_template('inventory.html')

@app.route('/inventoryAdd')
def inventoryAdd():
    return render_template('inventory_form.html')

@app.route('/inventoryView')
def inventoryView():
    return render_template('inventory_list.html')

@app.route('/advanceList')
def advanceList():
    return render_template('advance_list.html')

@app.route('/bill')
def bill():
    return render_template('bill.html')

@app.route('/newBill')
def newBill():
    return render_template('newBill.html')

@app.route('/searchBill')
def searchBill():
    return render_template('searchBill.html')

@app.route('/finance')
def finance():
    return render_template('finance.html')

@app.route('/addFinance')
def addFinance():
    return render_template('addFinance.html')

@app.route('/viewFinance')
def viewFinance():
    return render_template('viewFinance.html')

@app.route('/advanceOrder')
def advanceOrder():
    return render_template('advance.html')

@app.route('/addAdvanceOrder')
def addAdvanceOrder():
    return render_template('advance_orders.html')

@app.route('/viewAdvanceOrder')
def viewAdvanceOrder():
    return render_template('advance_list.html')

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    init_db()
    app.run(debug=False)
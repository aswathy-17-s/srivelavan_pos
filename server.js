const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require('bcryptjs');
const multer = require("multer");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const API_URL = 'http://localhost:5000';
dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static frontend files first
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// New: Check for a local config.json file
let dbConfig = {};
try {
  // Try to read the configuration from a config.json file
  const configFile = path.join(__dirname, 'config.json');
  if (fs.existsSync(configFile)) {
    dbConfig = require(configFile);
    console.log("Using configuration from config.json");
  } else {
    // Fallback to environment variables if no config.json
    dbConfig = {
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASS || "",
      database: process.env.DB_NAME || "srivelavan_crackers",
    };
    console.log("Using configuration from environment variables (.env)");
  }
} catch (err) {
  console.error("Error reading config.json, falling back to .env:", err);
  dbConfig = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "srivelavan_crackers",
  };
}

// MySQL Connection
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "srivelavan_crackers",
    waitForConnections: true,
    connectionLimit: 10,
});

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'uploads/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

async function initializeDatabase() {
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id VARCHAR(50) NOT NULL UNIQUE,
                name VARCHAR(255) NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                category_id INT,
                stock INT DEFAULT 0,
                image_path VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(id)
            )
        `);
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS bills (
                id INT AUTO_INCREMENT PRIMARY KEY,
                bill_no VARCHAR(50) NOT NULL UNIQUE,
                customer_name VARCHAR(255) DEFAULT 'Walk-in Customer',
                customer_phone VARCHAR(20),
                subtotal DECIMAL(10,2) NOT NULL,
                discount DECIMAL(10,2) DEFAULT 0,
                gst_amount DECIMAL(10,2) DEFAULT 0,
                total DECIMAL(10,2) NOT NULL,
                payment_mode VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS bill_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                bill_id INT NOT NULL,
                product_id VARCHAR(50) NOT NULL,
                product_name VARCHAR(255) NOT NULL,
                quantity INT NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                total DECIMAL(10,2) NOT NULL,
                FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
            )
        `);
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS admin (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                gst_number VARCHAR(100),
                gst_rate DECIMAL(5,2) DEFAULT 18,
                enable_gst BOOLEAN DEFAULT false,
                paper_size VARCHAR(10) DEFAULT '58mm',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        const [adminRows] = await pool.execute("SELECT * FROM admin LIMIT 1");
        if (adminRows.length === 0) {
            const hashedPassword = await bcrypt.hash("admin123", 10);
            await pool.execute(
                "INSERT INTO admin (email, password_hash) VALUES (?, ?)",
                ["admin@srivelavancrackers.com", hashedPassword]
            );
        }
        const [settingsRows] = await pool.execute("SELECT * FROM settings LIMIT 1");
        if (settingsRows.length === 0) {
            await pool.execute(
                "INSERT INTO settings (gst_number, gst_rate, enable_gst, paper_size) VALUES (?, ?, ?, ?)",
                ["", 18, false, "58mm"]
            );
        }
        
// Insert wanted categories safely
const wantedCategories = [
    'Sparklers', 'Rockets', 'one sound crackers', 'flowerpots', 
    'twinkling star', 'pencil crackers', 'children special fountains', 
    'fountains and crackling', 'paper bomb', 'bijili crackers', 
    'continuous crackers', 'fancy sky shots', 'night shots multicolour', 
    'roll cap& colour matches', 'special gift box', 'Bombs', 
    'Fountains', 'ground chakkars', 'fancy chakkars'
];

const categoryMap = {}; // will store name -> id mapping

for (const category of wantedCategories) {
    const categoryName = category.trim();
    const [existing] = await pool.execute("SELECT id FROM categories WHERE name = ?", [categoryName]);
    let categoryId;
    if (existing.length === 0) {
        const [result] = await pool.execute("INSERT INTO categories (name) VALUES (?)", [categoryName]);
        categoryId = result.insertId;
    } else {
        categoryId = existing[0].id;
    }
    categoryMap[categoryName] = categoryId;
}

// Corrected addProduct helper function
async function addProduct(product) {
    const { product_id, name, price, category, stock = 0, imagePath = null } = product;
    const categoryId = categoryMap[category.trim()];
    if (!categoryId) {
        console.error(`Category not found for product ${name}`);
        return;
    }
    const pid = product_id || 'P' + Date.now(); // auto-generate if missing
    await pool.execute(
        "INSERT INTO products (product_id, name, price, category_id, stock, image_path) VALUES (?, ?, ?, ?, ?, ?)",
        [pid, name, parseFloat(price), categoryId, parseInt(stock), imagePath]
    );
}


        
        console.log("Database initialized successfully");
    } catch (error) {
        console.error("Error initializing database:", error);
    }
}
initializeDatabase();

// No token authentication

// Login API
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const [rows] = await pool.execute("SELECT * FROM admin WHERE email = ?", [email]);
        if (rows.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const admin = rows[0];
        const validPassword = await bcrypt.compare(password, admin.password_hash);
        if (!validPassword) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        res.json({ message: "Login successful" });
    } catch (error) {
        res.status(500).json({ message: "Login error", error: error.message });
    }
});

// Register API
app.post("/api/register", async (req, res) => {
    try {
        const { email, password } = req.body;
        const [existingAdmin] = await pool.execute("SELECT * FROM admin WHERE email = ?", [email]);
        if (existingAdmin.length > 0) {
            return res.status(409).json({ message: "Email already registered" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.execute(
            "INSERT INTO admin (email, password_hash) VALUES (?, ?)",
            [email, hashedPassword]
        );
        res.json({ message: "Registration successful" });
    } catch (error) {
        res.status(500).json({ message: "Registration error", error: error.message });
    }
});

// Products API
// Products API
app.get("/api/products", async (req, res) => {
    try {
        const { search, category, stock } = req.query;
        let query = `
            SELECT p.*, c.name as category
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
        `;
        const params = [];
        const conditions = [];

        if (search) {
            conditions.push("(p.product_id LIKE ? OR p.name LIKE ?)");
            params.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
            conditions.push("c.name = ?");
            params.push(category);
        }

        if (stock === 'low') {
            conditions.push("p.stock < 10");
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY p.name";

        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Error fetching products", error: error.message });
    }
});
app.post("/api/products", upload.single("image"), async (req, res) => {
    try {
        // Multer gives fields in req.body
        const product_id = req.body.product_id?.trim() || 'P' + Date.now();
        const name = req.body.name?.trim();
        const price = parseFloat(req.body.price);
        const categoryName = req.body.category?.trim();
        const stock = parseInt(req.body.stock) || 0;
        const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

        if (!name || !price || !categoryName) {
            return res.status(400).json({ message: "Name, price, and category are required" });
        }

        // Lookup category
        const [categoryRows] = await pool.execute(
            "SELECT id FROM categories WHERE name = ?",
            [categoryName]
        );
        if (categoryRows.length === 0) {
            return res.status(400).json({ message: `Category '${categoryName}' not found` });
        }
        const categoryId = categoryRows[0].id;

        // Insert product
        await pool.execute(
            "INSERT INTO products (product_id, name, price, category_id, stock, image_path) VALUES (?, ?, ?, ?, ?, ?)",
            [product_id, name, price, categoryId, stock, imagePath]
        );

        res.json({ message: "Product added successfully" });
    } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).json({ message: "Error adding product", error: error.message });
    }
});


app.put("/api/products/:id", upload.single("image"), async (req, res) => {
    try {
        const productId = req.params.id;
        const { name, price, category, stock } = req.body;
        let imagePath = req.file ? `/uploads/${req.file.filename}` : undefined;
        const [categoryRows] = await pool.execute("SELECT id FROM categories WHERE name = ?", [category]);
        if (categoryRows.length === 0) {
            return res.status(400).json({ message: "Invalid category" });
        }
        const categoryId = categoryRows[0].id;
        if (imagePath) {
            const [oldProduct] = await pool.execute("SELECT image_path FROM products WHERE product_id = ?", [productId]);
            await pool.execute(
                "UPDATE products SET name = ?, price = ?, category_id = ?, stock = ?, image_path = ? WHERE product_id = ?",
                [name, parseFloat(price), categoryId, parseInt(stock), imagePath, productId]
            );
            if (oldProduct[0] && oldProduct[0].image_path) {
                const oldImagePath = path.join(__dirname, oldProduct[0].image_path);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
        } else {
            await pool.execute(
                "UPDATE products SET name = ?, price = ?, category_id = ?, stock = ? WHERE product_id = ?",
                [name, parseFloat(price), categoryId, parseInt(stock), productId]
            );
        }
        res.json({ message: "Product updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error updating product", error: error.message });
    }
});

app.delete("/api/products/:id", async (req, res) => {
    try {
        const productId = req.params.id;

        // Get product
        const [product] = await pool.execute(
            "SELECT image_path FROM products WHERE product_id = ?", 
            [productId]
        );

        if (product.length === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Delete product from DB
        await pool.execute("DELETE FROM products WHERE product_id = ?", [productId]);

        // Delete image file if exists
        if (product[0].image_path) {
            const imagePath = path.join(__dirname, product[0].image_path.replace(/^\//, ''));
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        res.json({ message: "Product deleted successfully" });
    } catch (error) {
        console.error("Delete product error:", error);
        res.status(500).json({ message: "Error deleting product", error: error.message });
    }
});

// Function to generate a unique bill number
async function generateBillNo(connection) {
    try {
        const [rows] = await connection.execute(
            "SELECT bill_no FROM bills ORDER BY CAST(SUBSTRING(bill_no, 3) AS UNSIGNED) DESC LIMIT 1"
        );

        let lastBillNo = 'SV0';
        if (rows.length > 0) {
            lastBillNo = rows[0].bill_no;
        }

        const numericPart = parseInt(lastBillNo.replace('SV', '')) || 0;
        const newBillNo = `SV${numericPart + 1}`;
        return newBillNo;

    } catch (error) {
        console.error('Error generating bill number:', error);
        throw new Error('Failed to generate a new bill number.');
    }
}

// Billing API
app.post("/api/bills", async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const { customer_name, customer_phone, items, subtotal, discount, gst_amount, total, payment_mode } = req.body;

        // Step 1: Generate a unique bill number
        const billNo = await generateBillNo(connection);

        // Step 2: Insert the bill with the generated bill_no
        const [result] = await connection.execute(
            "INSERT INTO bills (bill_no, customer_name, customer_phone, subtotal, discount, gst_amount, total, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [billNo, customer_name, customer_phone, parseFloat(subtotal), parseFloat(discount), parseFloat(gst_amount), parseFloat(total), payment_mode]
        );

        const billId = result.insertId;

        // Step 3: Insert bill items and update product stock
        for (const item of items) {
            await connection.execute(
                "INSERT INTO bill_items (bill_id, product_id, product_name, quantity, price, total) VALUES (?, ?, ?, ?, ?, ?)",
                [billId, item.id, item.name, item.quantity, item.price, item.price * item.quantity]
            );
            await connection.execute(
                "UPDATE products SET stock = stock - ? WHERE product_id = ?",
                [item.quantity, item.id]
            );
        }

        await connection.commit();

        // Step 4: Return the bill info
        res.json({ 
            message: "Bill generated successfully", 
            bill: {
                id: billId,
                bill_no: billNo,
                customer_name,
                customer_phone,
                subtotal,
                discount,
                gst_amount,
                total,
                payment_mode,
                items
            }
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Error generating bill:", error);
        res.status(500).json({ message: "Error generating bill", error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/bills", async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = "SELECT * FROM bills ORDER BY created_at DESC";
        let params = [];
        if (startDate && endDate) {
            query = "SELECT * FROM bills WHERE DATE(created_at) BETWEEN ? AND ? ORDER BY created_at DESC";
            params = [startDate, endDate];
        } else if (startDate) {
            // This handles cases where only a start date is provided, like "Today"
            query = "SELECT * FROM bills WHERE DATE(created_at) = ? ORDER BY created_at DESC";
            params = [startDate];
        }
        
        const [bills] = await pool.execute(query, params);
        const billsWithItems = [];
        for (const bill of bills) {
            const [items] = await pool.execute("SELECT product_name AS name, quantity, price FROM bill_items WHERE bill_id = ?", [bill.id]);
            billsWithItems.push({
                ...bill,
                items: items
            });
        }
        res.json(billsWithItems);
    } catch (error) {
        res.status(500).json({ message: "Error fetching bills", error: error.message });
    }
});
// Delete Bill API (with stock restore)
app.delete("/api/bills/:bill_no", async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const { bill_no } = req.params;

        // Find bill
        const [bills] = await connection.execute("SELECT id FROM bills WHERE bill_no = ?", [bill_no]);
        if (bills.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Bill not found" });
        }

        const billId = bills[0].id;

        // Get bill items
        const [items] = await connection.execute("SELECT product_id, quantity FROM bill_items WHERE bill_id = ?", [billId]);

        // Restore stock for each item
        for (const item of items) {
            await connection.execute(
                "UPDATE products SET stock = stock + ? WHERE product_id = ?",
                [item.quantity, item.product_id]
            );
        }

        // Delete bill items (ON DELETE CASCADE also works, but explicit here)
        await connection.execute("DELETE FROM bill_items WHERE bill_id = ?", [billId]);

        // Delete bill
        await connection.execute("DELETE FROM bills WHERE id = ?", [billId]);

        await connection.commit();
        res.json({ message: "Bill deleted successfully and stock restored" });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Error deleting bill:", error);
        res.status(500).json({ message: "Error deleting bill", error: error.message });
    } finally {
        if (connection) connection.release();
    }
});



// Dashboard API
app.get("/api/dashboard", async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const [revenueRows] = await pool.execute(
            "SELECT COALESCE(SUM(total), 0) as revenue FROM bills WHERE DATE(created_at) = ?",
            [today]
        );
        const [ordersRows] = await pool.execute(
            "SELECT COUNT(*) as orders FROM bills WHERE DATE(created_at) = ?",
            [today]
        );
        const [customersRows] = await pool.execute(
            "SELECT COUNT(DISTINCT customer_name) as customers FROM bills WHERE DATE(created_at) = ?",
            [today]
        );
        const [recentOrdersRows] = await pool.execute(
            "SELECT bill_no, customer_name, total, payment_mode, created_at FROM bills ORDER BY created_at DESC LIMIT 5"
        );
        res.json({
            todayRevenue: revenueRows[0].revenue,
            todayOrders: ordersRows[0].orders,
            todayCustomers: customersRows[0].customers,
            recentOrders: recentOrdersRows
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching dashboard data", error: error.message });
    }
});

// Settings API
app.get("/api/settings", async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM settings LIMIT 1");
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: "Error fetching settings", error: error.message });
    }
});

app.put("/api/settings", async (req, res) => {
    try {
        const { gst_number, gst_rate, enable_gst, paper_size } = req.body;
        await pool.execute(
            "UPDATE settings SET gst_number = ?, gst_rate = ?, enable_gst = ?, paper_size = ?",
            [gst_number, parseFloat(gst_rate), enable_gst, paper_size]
        );
        res.json({ message: "Settings updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error updating settings", error: error.message });
    }
});

app.put("/api/admin/credentials", async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.execute(
            "UPDATE admin SET email = ?, password_hash = ? WHERE id = 1",
            [email, hashedPassword]
        );
        res.json({ message: "Credentials updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error updating credentials", error: error.message });
    }
});

const PDFDocument = require("pdfkit");

app.get("/api/download-bill/:billId", async (req, res) => {
    const { billId } = req.params;

    // Fetch bill header
    const [billRows] = await pool.execute("SELECT * FROM bills WHERE bill_no = ?", [billId]);
    if (billRows.length === 0) return res.status(404).send("Bill not found");
    const bill = billRows[0];

    // Fetch bill items
    const [items] = await pool.execute("SELECT * FROM bill_items WHERE bill_id = ?", [bill.id]);

    // Set headers
    res.setHeader("Content-Disposition", `attachment; filename=bill_${billId}.pdf`);
    res.setHeader("Content-Type", "application/pdf");

    const doc = new PDFDocument({ margin: 50, size: 'A4' }); // A4 size
    doc.pipe(res);

    // ---- HEADER ----
    doc.fontSize(22).font("Helvetica-Bold").text("Sri Velavan Crackers", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica")
        .text("D.No: 12/417/3 Rathnapuri Nagar, Meenampatti, SIVAKASI - 626 123", { align: "center" })
        .text("Phone: 80722 50499, 97874 21455", { align: "center" })
        .text("Website: srivelavancrackers.com", { align: "center" });

    doc.moveDown(1.5);
    doc.fontSize(14).font("Helvetica-Bold").text("Invoice / Bill", { align: "center", underline: true });
    doc.moveDown();

    // ---- BILL INFO ----
    doc.fontSize(12).font("Helvetica");
    doc.text(`Bill No: ${bill.bill_no}`);
    doc.text(`Date: ${new Date(bill.created_at).toLocaleDateString("en-IN")}`);
    doc.text(`Customer: ${bill.customer_name || "N/A"}`);
    doc.moveDown(1);

    // ---- TABLE HEADER ----
    const tableX = 50, qtyX = 280, priceX = 360, totalX = 450;
    const rowHeight = 20;
    let y = doc.y;

    function drawTableHeader() {
        doc.rect(tableX - 2, y - 4, 500, 20).fillAndStroke("#f0f0f0", "#000");
        doc.fillColor("#000").fontSize(12).font("Helvetica-Bold");
        doc.text("Product", tableX, y, { width: 220, align: "left" });
        doc.text("Qty", qtyX, y, { width: 60, align: "center" });
        doc.text("Price", priceX, y, { width: 80, align: "right" });
        doc.text("Amount", totalX, y, { width: 90, align: "right" });
        y += rowHeight;
    }

    drawTableHeader();

    doc.font("Helvetica").fontSize(12);
    let grandTotal = 0;

    items.forEach((item, index) => {
        const price = Number(item.price);
        const qty = Number(item.quantity);
        const amount = price * qty;
        grandTotal += amount;

        // Check if we need a new page
        if (y + rowHeight > doc.page.height - 100) { // leave margin for footer
            doc.addPage();
            y = 50;
            drawTableHeader();
        }

        // Draw row borders
        doc.rect(tableX - 2, y - 2, 500, rowHeight).stroke();

        doc.text(item.product_name, tableX, y, { width: 220, align: "left" });
        doc.text(qty.toString(), qtyX, y, { width: 60, align: "center" });
        doc.text(price.toFixed(2), priceX, y, { width: 80, align: "right" });
        doc.text(amount.toFixed(2), totalX, y, { width: 90, align: "right" });

        y += rowHeight;
    });

    // ---- TOTALS ----
    const gstAmount = Number(bill.gst_amount || 0);
    const discountAmount = Number(bill.discount || 0);
    const finalTotal = Number(bill.total);

    y += 10;
    if (y + 60 > doc.page.height - 50) doc.addPage(), y = 50;

    doc.moveTo(tableX - 2, y).lineTo(tableX + 498, y).stroke();
    y += 10;

    doc.font("Helvetica-Bold");
    doc.text(`Grand Total: ${grandTotal.toFixed(2)}`, totalX - 20, y, { width: 110, align: "right" });
    y += 30;
    doc.text(`GST: ${gstAmount.toFixed(2)}`, totalX - 20, y, { width: 110, align: "right" });
    y += 30;
    doc.text(`Discount: ${discountAmount.toFixed(2)}`, totalX - 20, y, { width: 110, align: "right" });
    y += 30;
    doc.text(`Total Payable: ${finalTotal.toFixed(2)}`, totalX - 20, y, { width: 110, align: "right" });

    // ---- FOOTER ----
    if (y + 50 > doc.page.height - 50) doc.addPage();
    doc.moveDown(4);
    doc.fontSize(10).font("Helvetica-Oblique").text("Thank you for your purchase!", { align: "center" });

    doc.end();
});
// GET a single bill and its items
app.get("/api/bills/:billNo", async (req, res) => {
    let connection;
    try {
        const billNo = req.params.billNo;
        connection = await pool.getConnection();

        // Fetch the main bill details
        const [billRows] = await connection.execute("SELECT * FROM bills WHERE bill_no = ?", [billNo]);

        if (billRows.length === 0) {
            return res.status(404).json({ message: "Bill not found." });
        }

        // Convert bill values to numbers
        const bill = {
            ...billRows[0],
            subtotal: parseFloat(billRows[0].subtotal),
            discount: parseFloat(billRows[0].discount),
            gst_amount: parseFloat(billRows[0].gst_amount),
            total: parseFloat(billRows[0].total)
        };

        // Fetch all items associated with that bill
        const [itemRows] = await connection.execute(
            "SELECT product_name, quantity, price, total FROM bill_items WHERE bill_id = ?",
            [bill.id]
        );

        // Convert item values to numbers
        const items = itemRows.map(item => ({
            ...item,
            price: parseFloat(item.price),
            total: parseFloat(item.total)
        }));

        res.json({ bill: bill, items: items });

    } catch (error) {
        console.error("Error fetching bill details:", error);
        res.status(500).json({ message: "Error fetching bill details", error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// This catch-all route should be at the very end.
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// ====== Start Server ======
app.use(express.static(path.join(__dirname, "pos_frontend")));
app.listen(5000, () => console.log("POS Backend running on http://localhost:5000"));
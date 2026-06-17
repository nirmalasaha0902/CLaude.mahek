const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const auth = require('../middleware/auth');

// Setup route to initialize tables and create the first admin
// Remove this after initial setup for security
router.get('/setup', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not connected.' });
    
    try {
        // Create tables if they don't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS records (
                id SERIAL PRIMARY KEY,
                entry_type VARCHAR(50) NOT NULL,
                part_name VARCHAR(255),
                drawing_number VARCHAR(255),
                shape VARCHAR(50),
                material VARCHAR(50),
                length_l NUMERIC,
                width_w NUMERIC,
                diameter NUMERIC,
                parts JSONB,
                holes JSONB,
                order_quantity INTEGER DEFAULT 1,
                pricing JSONB,
                ai_confidence VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        const adminResult = await pool.query('SELECT * FROM admins LIMIT 1');
        if (adminResult.rows.length > 0) {
            return res.status(400).json({ error: 'Setup already completed. Admin exists.' });
        }
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);
        
        await pool.query(
            'INSERT INTO admins (username, password) VALUES ($1, $2)',
            ['admin', hashedPassword]
        );
        
        res.json({ message: 'PostgreSQL tables initialized and Admin created successfully. Username: admin, Password: admin123' });
    } catch (err) {
        console.error('Setup error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin Login
router.post('/login', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not connected.' });

    try {
        const { username, password } = req.body;
        
        const result = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid credentials' });
        
        const admin = result.rows[0];
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
        
        const token = jwt.sign({ id: admin.id }, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '24h' });
        
        res.json({ token, username: admin.username });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all records (Protected)
router.get('/records', auth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not connected.' });

    try {
        const result = await pool.query('SELECT * FROM records ORDER BY created_at DESC');
        
        // Map postgres snake_case to frontend camelCase expectations
        const records = result.rows.map(r => ({
            _id: r.id,
            entryType: r.entry_type,
            partName: r.part_name,
            drawingNumber: r.drawing_number,
            shape: r.shape,
            material: r.material,
            lengthL: r.length_l,
            widthW: r.width_w,
            diameter: r.diameter,
            parts: r.parts,
            holes: r.holes,
            orderQuantity: r.order_quantity,
            pricing: r.pricing,
            aiConfidence: r.ai_confidence,
            createdAt: r.created_at
        }));
        
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a record manually
router.post('/records', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not connected.' });

    try {
        const { entryType, partName, drawingNumber, shape, material, lengthL, widthW, diameter, parts, holes, orderQuantity, pricing, aiConfidence } = req.body;
        
        const result = await pool.query(`
            INSERT INTO records (
                entry_type, part_name, drawing_number, shape, material, 
                length_l, width_w, diameter, parts, holes, 
                order_quantity, pricing, ai_confidence
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `, [
            entryType, partName, drawingNumber, shape, material,
            lengthL, widthW, diameter, JSON.stringify(parts || []), JSON.stringify(holes || []),
            orderQuantity, JSON.stringify(pricing || {}), aiConfidence
        ]);
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a record (Protected)
router.delete('/records/:id', auth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not connected.' });

    try {
        await pool.query('DELETE FROM records WHERE id = $1', [req.params.id]);
        res.json({ message: 'Record deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

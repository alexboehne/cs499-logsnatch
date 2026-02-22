const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto'); // Built-in Node module for MD5

const app = express();

// Middleware
app.use(cors()); 
app.use(express.json());

// MySQL Database Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',       
    password: 'DONTBREAKIn25!', 
    database: 'LogSnatch',
    port: 3306          
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database!!');
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const hashedPass = crypto.createHash('md5').update(password).digest('hex');

    // Change 'id' to 'uid' here
    const sql = 'SELECT uid, username FROM user_creds WHERE username = ? AND md5_pass = ?';
    
    db.query(sql, [username, hashedPass], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, error: 'Server error' });
        }

        if (results.length > 0) {
            res.json({ success: true, message: 'Login successful', user: results[0] });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    });
});

app.post('/api/createUser', (req, res) => {
    const { username, password } = req.body;
    const hashedPass = crypto.createHash('md5').update(password).digest('hex');

    const sql = 'INSERT INTO user_creds (username, md5_pass) VALUES (?, ?)';
    
    db.query(sql, [username, hashedPass], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, error: 'Server error' });
        }

        if (results.length > 0) {
            res.json({ success: true, message: 'User added', userID: results.insertId, username: username });
        } else {
            res.status(401).json({ success: false, message: 'Failed to add user' });
        }
    });
});

// API Endpoint to fetch 
app.get('/api/items', (req, res) => {
    const sql = 'SELECT * FROM items';
    db.query(sql, (err, results) => {
        if (err) {
            res.status(500).json({ error: 'Database query failed' });
        } else {
            res.json(results);
        }
    });
});

// Start  server
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

// API Endpoint to add new item
app.post('/api/items', (req, res) => {
    // Extract the data from frontend
    const { name, description } = req.body;

    if (!name || !description) {
        return res.status(400).json({ error: 'Name and description are required' });
    }

    // Insert with param queries (JS is cool)
    const sql = 'INSERT INTO items (name, description) VALUES (?, ?)';
    
    db.query(sql, [name, description], (err, result) => {
        if (err) {
            console.error('Error inserting data:', err);
            return res.status(500).json({ error: 'Database insertion failed' });
        }
        
        // Send back item
        res.status(201).json({ 
            id: result.insertId, 
            name: name, 
            description: description 
        });
    });
});
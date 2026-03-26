const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MySQL Database Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'DONTBREAKIn25!',
    database: 'logsnatch',
    port: 3306
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database!!');
});

// Path to the trigger file and log directory
const logDir = '/var/log';

// ---------------------------------------------------------------------------
// Token validation middleware
// Expects header:  Authorization: Bearer <token>
// Rejects if token is missing, not in DB, or past its expires_at timestamp.
// ---------------------------------------------------------------------------
function validateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

    if (!token) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const sql = 'SELECT uid FROM user_sessions WHERE token = ? AND expires_at > NOW()';
    db.query(sql, [token], (err, results) => {
        if (err) {
            console.error('Token validation DB error:', err);
            return res.status(500).json({ success: false, error: 'Server error' });
        }
        if (results.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid or expired token' });
        }
        req.uid = results[0].uid; // attach uid for use in downstream handlers
        next();
    });
}

// ---------------------------------------------------------------------------
// Scan helpers (unchanged)
// ---------------------------------------------------------------------------

function triggerScan(scanName) {
    try {
        const triggerFile = `/var/lib/logsnatch/${scanName}-trigger`;
        try {
            fs.utimesSync(triggerFile, new Date(), new Date());
        } catch (utimesErr) {
            fs.appendFileSync(triggerFile, '\n');
            fs.truncateSync(triggerFile, 0);
        }
        console.log(`Scan triggered successfully: ${scanName}`);
    } catch (err) {
        console.error(`Error triggering scan: ${scanName}`, err);
        throw err;
    }
}

function fetchResults() {
    return new Promise((resolve, reject) => {
        fs.readdir(logDir, (err, files) => {
            if (err) return reject(err);

            const scanFiles = files.filter(file => file.startsWith('scan_results') && file.endsWith('.log'));
            if (scanFiles.length === 0) return reject(new Error('No scan results found'));

            const latestFile = scanFiles.sort((a, b) => {
                const statA = fs.statSync(path.join(logDir, a));
                const statB = fs.statSync(path.join(logDir, b));
                return statB.mtime.getTime() - statA.mtime.getTime();
            })[0];

            fs.readFile(path.join(logDir, latestFile), 'utf8', (err, data) => {
                if (err) return reject(err);
                resolve(JSON.parse(data));
            });
        });
    });
}

function insertRTkitResults(scanData, userId, scanName) {
    return new Promise((resolve, reject) => {
        const scanSql = 'INSERT INTO scan_results (scanDateTime, scanPass, scanUser) VALUES (?, ?, ?)';
        const scanValues = [new Date(), scanData.results.includes('INFECTED') ? 0 : 1, userId];

        db.query(scanSql, scanValues, (err, result) => {
            if (err) {
                console.error('Error inserting into scan_results:', err);
                return reject(err);
            }

            const scanId = result.insertId;

            if (scanData.results && scanData.results.includes('INFECTED')) {
                const rtkitSql = 'INSERT INTO results_rtkit (scanID, rtkitInfectedProgram, rtkitLogLocation) VALUES (?, ?, ?)';
                const rtkitValues = [scanId, scanData.results, path.join(logDir, `scan_results${new Date().toISOString()}.log`)];

                db.query(rtkitSql, rtkitValues, (err) => {
                    if (err) {
                        console.error('Error inserting into results_rtkit:', err);
                        return reject(err);
                    }
                    resolve({ success: true, scanId });
                });
            } else {
                resolve({ success: true, scanId });
            }
        });
    });
}

function insertSSHResults(scanData, userId, scanName) {
    return new Promise((resolve, reject) => {
        const scanSql = 'INSERT INTO scan_results (scanDateTime, scanPass, scanUser) VALUES (?, ?, ?)';
        const scanValues = [new Date(), scanData.results.includes('SSH_VIOLATION') ? 0 : 1, userId];

        db.query(scanSql, scanValues, (err, result) => {
            if (err) {
                console.error('Error inserting into scan_results:', err);
                return reject(err);
            }

            const scanId = result.insertId;

            if (scanData.results && scanData.results.includes('SSH_VIOLATION')) {
                const sshSql = 'INSERT INTO results_ssh (scanID, sshViolationType, sshViolationDetails, sshLogLocation) VALUES (?, ?, ?, ?)';
                const sshValues = [scanId, 'SSH_VIOLATION', scanData.results, path.join(logDir, `scan_results${new Date().toISOString()}.log`)];

                db.query(sshSql, sshValues, (err) => {
                    if (err) {
                        console.error('Error inserting into results_ssh:', err);
                        return reject(err);
                    }
                    resolve({ success: true, scanId });
                });
            } else {
                resolve({ success: true, scanId });
            }
        });
    });
}

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const hashedPass = crypto.createHash('md5').update(password).digest('hex');

    const sql = 'SELECT uid, username FROM user_creds WHERE username = ? AND md5_pass = ?';

    db.query(sql, [username, hashedPass], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, error: 'Server error' });
        }

        if (results.length > 0) {
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours from now

            const sessionSql = 'INSERT INTO user_sessions (uid, token, expires_at) VALUES (?, ?, ?)';
            db.query(sessionSql, [results[0].uid, token, expiresAt], (err) => {
                if (err) {
                    console.error('Error saving session token:', err);
                    return res.status(500).json({ success: false, error: 'Server error' });
                }
                res.json({ success: true, message: 'Login successful', user: results[0], token });
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    });
});

app.post('/api/logout', validateToken, (req, res) => {
    const token = req.headers['authorization'].split(' ')[1];
    db.query('DELETE FROM user_sessions WHERE token = ?', [token], (err) => {
        if (err) {
            console.error('Error deleting session:', err);
            return res.status(500).json({ success: false, error: 'Server error' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Used by the dashboard on load to confirm the token is still valid
app.get('/api/validate-token', validateToken, (req, res) => {
    res.json({ success: true });
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

        if (results.affectedRows > 0) {
            res.json({ success: true, message: 'User added', userID: results.insertId, username: username });
        } else {
            res.status(401).json({ success: false, message: 'Failed to add user' });
        }
    });
});

// ---------------------------------------------------------------------------
// Protected scan routes — validateToken middleware runs first
// ---------------------------------------------------------------------------

app.post('/api/trigger-scan', validateToken, async (req, res) => {
    try {
        const { userId, scanName } = req.body;
        if (!userId || !scanName) {
            return res.status(400).json({ success: false, error: 'User ID and scan name are required' });
        }

        triggerScan(scanName);

        setTimeout(async () => {
            try {
                const results = await fetchResults();
                let dbResult;

                if (scanName === 'ssh') {
                    dbResult = await insertSSHResults(results, userId, scanName);
                } else {
                    dbResult = await insertRTkitResults(results, userId, scanName);
                }

                res.status(200).json({ success: true, message: 'Scan triggered and results stored', results, dbResult });
            } catch (err) {
                console.error('Error processing scan results:', err);
                res.status(500).json({ success: false, error: 'Error processing scan results' });
            }
        }, 5000);
    } catch (err) {
        console.error('Error triggering scan:', err);
        res.status(500).json({ success: false, error: 'Error triggering scan' });
    }
});

app.get('/api/fetch-results', validateToken, async (req, res) => {
    try {
        const results = await fetchResults();
        res.status(200).json({ success: true, results });
    } catch (err) {
        console.error('Error fetching results:', err);
        res.status(500).json({ success: false, error: 'Error fetching results' });
    }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

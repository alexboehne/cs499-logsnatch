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
        // Special handling for envcheck since it doesn't have a systemd service
        if (scanName === 'envcheck') {
            const { execSync } = require('child_process');
            try {
                // Run the script directly and capture output to /tmp
                const outputFile = `/tmp/scan-envcheck-${new Date().toISOString()}.log`;
                execSync(`OUTPUT_FILE="${outputFile}" /home/cs-admin/DND-node-root/final-test/cs499-logsnatch/shell-tools/logsnatch-envcheck.sh`);
                return;
            } catch (execErr) {
                console.error(`Error executing envcheck script:`, execErr);
                throw execErr;
            }
        }
        
        const triggerFile = `/var/lib/logsnatch/${scanName}-trigger`;
        
        // Try multiple methods to trigger the scan
        try {
            // Method 1: Update timestamp (preferred)
            fs.utimesSync(triggerFile, new Date(), new Date());
        } catch (utimesErr) {
            try {
                // Method 2: Append and truncate
                fs.appendFileSync(triggerFile, '\n');
                fs.truncateSync(triggerFile, 0);
            } catch (appendErr) {
                // Method 3: Create a temporary trigger file that systemd can watch
                const tempTriggerFile = `/tmp/${scanName}-trigger-temp`;
                fs.writeFileSync(tempTriggerFile, 'trigger');
                
                // Copy to the actual location if possible
                try {
                    fs.copyFileSync(tempTriggerFile, triggerFile);
                    fs.unlinkSync(tempTriggerFile);
                } catch (copyErr) {
                    // If we can't copy, leave the temp file and hope systemd can see it
                    console.warn(`Could not copy trigger file, leaving temp file at ${tempTriggerFile}`);
                }
            }
        }
    } catch (err) {
        console.error(`Error triggering scan: ${scanName}`, err);
        throw err;
    }
}

function fetchResults(scanName) {
    return new Promise((resolve, reject) => {
        // For envcheck, look in /tmp since it doesn't require sudo
        const searchDir = scanName === 'envcheck' ? '/tmp' : logDir;
        
        fs.readdir(searchDir, (err, files) => {
            if (err) return reject(err);

            // Filter files based on scan type
            let filePrefix = 'scan_results';
            if (scanName === 'suid') {
                filePrefix = 'scan-suid';
            } else if (scanName === 'ssh') {
                filePrefix = 'scan-ssh';
            } else if (scanName === 'envcheck') {
                filePrefix = 'scan-envcheck';
            }

            const scanFiles = files.filter(file => file.startsWith(filePrefix) && file.endsWith('.log'));
            if (scanFiles.length === 0) return reject(new Error('No scan results found'));

            const latestFile = scanFiles.sort((a, b) => {
                const statA = fs.statSync(path.join(searchDir, a));
                const statB = fs.statSync(path.join(searchDir, b));
                return statB.mtime.getTime() - statA.mtime.getTime();
            })[0];

            fs.readFile(path.join(searchDir, latestFile), 'utf8', (err, data) => {
                if (err) return reject(err);
                resolve(data);
            });
        });
    });
}

function insertRTkitResults(scanData, userId, scanName) {
    return new Promise((resolve, reject) => {
        try {
            const scanSql = 'INSERT INTO scan_results (scanDateTime, scanPass, scanUser) VALUES (?, ?, ?)';
            // Parse the JSON to check for infections
            const scanDataObj = JSON.parse(scanData);
            const hasInfections = scanDataObj.results && scanDataObj.results.includes('INFECTED');
            const scanValues = [new Date(), hasInfections ? 0 : 1, userId];

            db.query(scanSql, scanValues, (err, result) => {
                if (err) {
                    console.error('Error inserting into scan_results:', err);
                    return reject(err);
                }

                const scanId = result.insertId;
                const logLocation = path.join(logDir, `scan-rtkit-${new Date().toISOString()}.log`);

                if (hasInfections) {
                    const rtkitSql = 'INSERT INTO results_rtkit (scanID, rtkitInfectedProgram, rtkitLogLocation) VALUES (?, ?, ?)';
                    const rtkitValues = [scanId, scanDataObj.results, logLocation];

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
        } catch (parseErr) {
            console.error('Error parsing rootkit scan data:', parseErr);
            console.error('Raw data:', scanData);
            reject(parseErr);
        }
    });
}

function insertSSHResults(scanData, userId, scanName) {
    return new Promise((resolve, reject) => {
        try {
            const scanSql = 'INSERT INTO scan_results (scanDateTime, scanPass, scanUser) VALUES (?, ?, ?)';
            // SSH scan passes if no violations are found
            const hasViolations = Object.keys(JSON.parse(scanData)).length > 0;
            const scanValues = [new Date(), hasViolations ? 0 : 1, userId];

            db.query(scanSql, scanValues, (err, result) => {
                if (err) {
                    console.error('Error inserting into scan_results:', err);
                    return reject(err);
                }

                const scanId = result.insertId;
                const logLocation = path.join(logDir, `scan-ssh-${new Date().toISOString()}.log`);

                if (hasViolations) {
                    const sshSql = 'INSERT INTO results_ssh (scanID, sshViolation, sshViolationLogLocation) VALUES (?, ?, ?)';
                    const sshValues = [scanId, scanData, logLocation];

                    db.query(sshSql, sshValues, (err) => {
                        if (err) {
                            console.error('Error inserting into results_ssh:', err);
                            console.error('SSH values:', sshValues);
                            return reject(err);
                        }
                        resolve({ success: true, scanId });
                    });
                } else {
                    resolve({ success: true, scanId });
                }
            });
        } catch (parseErr) {
            console.error('Error parsing SSH scan data:', parseErr);
            console.error('Raw data:', scanData);
            reject(parseErr);
        }
    });
}

function insertSUIDResults(scanData, userId, scanName) {
    return new Promise((resolve, reject) => {
        const scanSql = 'INSERT INTO scan_results (scanDateTime, scanPass, scanUser) VALUES (?, ?, ?)';
        // SUID scan always passes (just reports files), so scanPass = 1
        const scanValues = [new Date(), 1, userId];

        db.query(scanSql, scanValues, (err, result) => {
            if (err) {
                console.error('Error inserting into scan_results:', err);
                return reject(err);
            }

            const scanId = result.insertId;
            const logLocation = path.join(logDir, `scan-suid-${new Date().toISOString()}.log`);

            // Parse the JSON data from the scan
            try {
                // Handle malformed JSON that's missing outer braces
                let suidFiles;
                if (scanData.trim().startsWith('{')) {
                    // Normal JSON format
                    suidFiles = JSON.parse(scanData);
                } else {
                    // Malformed format - wrap with braces
                    const wrappedData = `{${scanData}}`;
                    suidFiles = JSON.parse(wrappedData);
                }
                
                // Insert each SUID file found - simplified version
                let insertedCount = 0;
                const fileCount = Object.keys(suidFiles).length;
                
                if (fileCount === 0) {
                    resolve({ success: true, scanId });
                    return;
                }
                
                for (const [filePath, fileInfo] of Object.entries(suidFiles)) {
                    const suidSql = 'INSERT INTO results_suid (scanID, suidPath, suidPermissions, suidOwner, suidGroup, suidLogLocation) VALUES (?, ?, ?, ?, ?, ?)';
                    const suidValues = [scanId, filePath, fileInfo.permissions, fileInfo.owner, fileInfo.group, logLocation];
                    
                    db.query(suidSql, suidValues, (err) => {
                        if (err) {
                            console.error('Error inserting SUID file:', err);
                            return reject(err);
                        }
                        insertedCount++;
                        
                        // Resolve when all files are inserted
                        if (insertedCount === fileCount) {
                            resolve({ success: true, scanId });
                        }
                    });
                }
            } catch (parseErr) {
                console.error('Error parsing SUID scan data:', parseErr);
                console.error('Raw data preview:', scanData.substring(0, 200));
                reject(parseErr);
            }
        });
    });
}

function insertEnvCheckResults(scanData, userId, scanName) {
    return new Promise((resolve, reject) => {
        const scanSql = 'INSERT INTO scan_results (scanDateTime, scanPass, scanUser) VALUES (?, ?, ?)';
        // Env check scan passes if no sensitive vars found, otherwise fails
        try {
            const envData = JSON.parse(scanData);
            const hasSensitiveVars = Object.keys(envData.sensitive_environment_variables || {}).length > 0;
            const scanValues = [new Date(), hasSensitiveVars ? 0 : 1, userId];

            db.query(scanSql, scanValues, (err, result) => {
                if (err) {
                    console.error('Error inserting into scan_results:', err);
                    return reject(err);
                }

                const scanId = result.insertId;
                const logLocation = path.join(logDir, `scan-envcheck-${new Date().toISOString()}.log`);

                if (hasSensitiveVars) {
                    const sensitiveVars = envData.sensitive_environment_variables;
                    let insertedCount = 0;
                    const varCount = Object.keys(sensitiveVars).length;
                    
                    if (varCount === 0) {
                        resolve({ success: true, scanId });
                        return;
                    }
                    
                    for (const [varName, varInfo] of Object.entries(sensitiveVars)) {
                        const envSql = 'INSERT INTO results_envcheck (scanID, envVarName, envVarPattern, envVarValueMasked, envCheckLogLocation) VALUES (?, ?, ?, ?, ?)';
                        const envValues = [scanId, varName, varInfo.pattern, varInfo.value, logLocation];
                        
                        db.query(envSql, envValues, (err) => {
                            if (err) {
                                console.error('Error inserting environment variable:', err);
                                return reject(err);
                            }
                            insertedCount++;
                            
                            if (insertedCount === varCount) {
                                resolve({ success: true, scanId });
                            }
                        });
                    }
                } else {
                    resolve({ success: true, scanId });
                }
            });
        } catch (parseErr) {
            console.error('Error parsing environment check scan data:', parseErr);
            console.error('Raw data:', scanData);
            reject(parseErr);
        }
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
                const results = await fetchResults(scanName);
                let dbResult;

                if (scanName === 'ssh') {
                    dbResult = await insertSSHResults(results, userId, scanName);
                } else if (scanName === 'suid') {
                    dbResult = await insertSUIDResults(results, userId, scanName);
                } else if (scanName === 'envcheck') {
                    dbResult = await insertEnvCheckResults(results, userId, scanName);
                } else {
                    dbResult = await insertRTkitResults(results, userId, scanName);
                }

                res.status(200).json({ success: true, message: 'Scan triggered and results stored', results: results.substring(0, 100) + '...', dbResult });
            } catch (err) {
                console.error('Error processing scan results:', err);
                res.status(500).json({ success: false, error: 'Error processing scan results' });
            }
        }, 15000);
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
// Dashboard charts endpoint
// Returns:
//   barChart  — scans per day for the last 7 days (count of scan_results rows)
//   pieChart  — number of violations per scan type across all time
//               rtkit  → results_rtkit
//               ssh    → results_ssh
//               suid   → results_suid
//               envcheck → results_envcheck
// ---------------------------------------------------------------------------
app.get('/api/dashboard-charts', validateToken, (req, res) => {
    // --- Bar chart: scans per day, last 7 days ---
    const barSql = `
        SELECT
            DATE(scanDateTIme) AS day,
            COUNT(*)           AS total
        FROM scan_results
        WHERE scanDateTIme >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(scanDateTIme)
        ORDER BY day ASC
    `;

    // --- Pie chart: violation counts by scan type ---
    const pieSql = `
        SELECT 'Rootkit'  AS label, COUNT(*) AS total FROM results_rtkit
        UNION ALL
        SELECT 'SSH'      AS label, COUNT(*) AS total FROM results_ssh
        UNION ALL
        SELECT 'SUID'     AS label, COUNT(*) AS total FROM results_suid
        UNION ALL
        SELECT 'EnvCheck' AS label, COUNT(*) AS total FROM results_envcheck
    `;

    db.query(barSql, (barErr, barRows) => {
        if (barErr) {
            console.error('Error fetching bar chart data:', barErr);
            return res.status(500).json({ success: false, error: 'Error fetching chart data' });
        }

        db.query(pieSql, (pieErr, pieRows) => {
            if (pieErr) {
                console.error('Error fetching pie chart data:', pieErr);
                return res.status(500).json({ success: false, error: 'Error fetching chart data' });
            }

            // Build a full 7-day label set so days with zero scans still appear
            const dayLabels = [];
            const dayTotals = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const label = d.toLocaleDateString('en-US', { weekday: 'short' }); // e.g. "Mon"
                const iso   = d.toISOString().slice(0, 10);
                const match = barRows.find(r => r.day.toISOString().slice(0, 10) === iso);
                dayLabels.push(label);
                dayTotals.push(match ? Number(match.total) : 0);
            }

            res.json({
                success: true,
                barChart: {
                    labels: dayLabels,
                    datasets: {
                        label: 'Scans Per Day',
                        data: dayTotals,
                    },
                },
                pieChart: {
                    labels: pieRows.map(r => r.label),
                    datasets: {
                        label: 'Violations by Scan Type',
                        backgroundColors: ['info', 'primary', 'dark', 'warning'],
                        data: pieRows.map(r => Number(r.total)),
                    },
                },
            });
        });
    });
});

// ---------------------------------------------------------------------------
// Scan table endpoint
// Returns all rows from scan_results, newest first, with the username of
// the user who triggered the scan.  Log location is reconstructed from the
// scan type column (not stored directly in scan_results, so we derive it from
// which detail table has a matching scanID).
// ---------------------------------------------------------------------------
app.get('/api/scan-table', validateToken, (req, res) => {
    const sql = `
        SELECT
            sr.scanID,
            sr.scanDateTIme   AS scanDateTime,
            sr.scanPass,
            uc.username       AS scanUser,
            -- derive a human-readable scan type by checking which detail table
            -- has a record for this scanID (LEFT JOINs; first non-null wins in app)
            CASE
                WHEN rt.scanID IS NOT NULL THEN 'Rootkit'
                WHEN ssh.scanID IS NOT NULL THEN 'SSH'
                WHEN su.scanID IS NOT NULL THEN 'SUID'
                WHEN ev.scanID IS NOT NULL THEN 'EnvCheck'
                ELSE 'General'
            END AS scanType,
            -- use the log location from whichever detail table matched
            COALESCE(rt.rtkitLogLocation, ssh.sshViolationLogLocation,
                     su.suidLogLocation, ev.envCheckLogLocation, 'N/A') AS logLocation,
            -- count violations attached to this scan
            (
                SELECT COUNT(*) FROM results_rtkit  WHERE scanID = sr.scanID
            ) + (
                SELECT COUNT(*) FROM results_ssh    WHERE scanID = sr.scanID
            ) + (
                SELECT COUNT(*) FROM results_suid   WHERE scanID = sr.scanID
            ) + (
                SELECT COUNT(*) FROM results_envcheck WHERE scanID = sr.scanID
            ) AS warningCount
        FROM scan_results sr
        LEFT JOIN user_creds uc ON uc.uid = sr.scanUser
        LEFT JOIN results_rtkit   rt  ON rt.scanID  = sr.scanID
        LEFT JOIN results_ssh     ssh ON ssh.scanID = sr.scanID
        LEFT JOIN results_suid    su  ON su.scanID  = sr.scanID
        LEFT JOIN results_envcheck ev ON ev.scanID  = sr.scanID
        GROUP BY sr.scanID
        ORDER BY sr.scanDateTIme DESC
        LIMIT 100
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            console.error('Error fetching scan table:', err);
            return res.status(500).json({ success: false, error: 'Error fetching scan data' });
        }

        const scans = rows.map(r => ({
            scanID:       r.scanID,
            scanDateTime: r.scanDateTime,
            scanPass:     r.scanPass,
            scanUser:     r.scanUser || 'Unknown',
            scanType:     r.scanType,
            logLocation:  r.logLocation,
            warningCount: Number(r.warningCount),
        }));

        res.json({ success: true, scans });
    });
});

// ---------------------------------------------------------------------------
// Warnings table endpoint — returns rootkit violations (results_rtkit)
// joined to their parent scan so we have a timestamp and log location.
// ---------------------------------------------------------------------------
app.get('/api/warnings-table', validateToken, (req, res) => {
    const sql = `
        SELECT
            rt.rID,
            sr.scanDateTIme        AS warningTime,
            rt.rtkitInfectedProgram AS warningMessage,
            rt.rtkitLogLocation     AS logLocation
        FROM results_rtkit rt
        JOIN scan_results sr ON sr.scanID = rt.scanID
        ORDER BY sr.scanDateTIme DESC
        LIMIT 200
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            console.error('Error fetching warnings table:', err);
            return res.status(500).json({ success: false, error: 'Error fetching warnings data' });
        }

        const warnings = rows.map(r => ({
            rID:            r.rID,
            warningTime:    r.warningTime,
            warningMessage: r.warningMessage,
            logLocation:    r.logLocation,
        }));

        res.json({ success: true, warnings });
    });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

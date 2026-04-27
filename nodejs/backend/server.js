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
    host: '127.0.0.1',
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
// ---------------------------------------------------------------------------
function validateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

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
        req.uid = results[0].uid;
        next();
    });
}

// ---------------------------------------------------------------------------
// Scan helpers
// ---------------------------------------------------------------------------

function triggerScan(scanName) {
    try {
        if (scanName === 'envcheck') {
            const { execSync } = require('child_process');
            try {
                const outputFile = `/tmp/scan-envcheck-${new Date().toISOString()}.log`;
                //change the following line to the location of your logsnatch-envcheck.sh file
                execSync(`OUTPUT_FILE="${outputFile}" /home/cs-admin/DND-node-root/final-test/cs499-logsnatch/shell-tools/logsnatch-envcheck.sh`);
                return;
            } catch (execErr) {
                console.error(`Error executing envcheck script:`, execErr);
                throw execErr;
            }
        }

        const triggerFile = `/var/lib/logsnatch/${scanName}-trigger`;

        try {
            fs.utimesSync(triggerFile, new Date(), new Date());
        } catch (utimesErr) {
            try {
                fs.appendFileSync(triggerFile, '\n');
                fs.truncateSync(triggerFile, 0);
            } catch (appendErr) {
                const tempTriggerFile = `/tmp/${scanName}-trigger-temp`;
                fs.writeFileSync(tempTriggerFile, 'trigger');
                try {
                    fs.copyFileSync(tempTriggerFile, triggerFile);
                    fs.unlinkSync(tempTriggerFile);
                } catch (copyErr) {
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
        const searchDir = scanName === 'envcheck' ? '/tmp' : logDir;

        fs.readdir(searchDir, (err, files) => {
            if (err) return reject(err);

            let filePrefix = 'scan_results';
            if (scanName === 'suid') {
                filePrefix = 'scan-suid';
            } else if (scanName === 'ssh') {
                filePrefix = 'scan-ssh';
            } else if (scanName === 'envcheck') {
                filePrefix = 'scan-envcheck';
            } else if (scanName === 'rootkit') {
                filePrefix = 'scan-rtkit';
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

function insertRTkitResults(scanData, userId) {
    return new Promise((resolve, reject) => {
        try {
            const scanSql = 'INSERT INTO scan_results (scanDateTime, scanPass, scanUser) VALUES (?, ?, ?)';
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
                    db.query(rtkitSql, [scanId, scanDataObj.results, logLocation], (err) => {
                        if (err) return reject(err);
                        resolve({ success: true, scanId });
                    });
                } else {
                    resolve({ success: true, scanId });
                }
            });
        } catch (parseErr) {
            reject(parseErr);
        }
    });
}

function insertSSHResults(scanData, userId) {
    return new Promise((resolve, reject) => {
        try {
            const scanSql = 'INSERT INTO scan_results (scanDateTime, scanPass, scanUser) VALUES (?, ?, ?)';
            const hasViolations = Object.keys(JSON.parse(scanData)).length > 0;
            const scanValues = [new Date(), hasViolations ? 0 : 1, userId];

            db.query(scanSql, scanValues, (err, result) => {
                if (err) return reject(err);

                const scanId = result.insertId;
                const logLocation = path.join(logDir, `scan-ssh-${new Date().toISOString()}.log`);

                if (hasViolations) {
                    const sshSql = 'INSERT INTO results_ssh (scanID, sshViolation, sshViolationLogLocation) VALUES (?, ?, ?)';
                    db.query(sshSql, [scanId, scanData, logLocation], (err) => {
                        if (err) return reject(err);
                        resolve({ success: true, scanId });
                    });
                } else {
                    resolve({ success: true, scanId });
                }
            });
        } catch (parseErr) {
            reject(parseErr);
        }
    });
}

function insertSUIDResults(scanData, userId) {
    return new Promise((resolve, reject) => {
        const scanSql = 'INSERT INTO scan_results (scanDateTime, scanPass, scanUser) VALUES (?, ?, ?)';
        db.query(scanSql, [new Date(), 1, userId], (err, result) => {
            if (err) return reject(err);

            const scanId = result.insertId;
            const logLocation = path.join(logDir, `scan-suid-${new Date().toISOString()}.log`);

            try {
                let suidFiles;
                if (scanData.trim().startsWith('{')) {
                    suidFiles = JSON.parse(scanData);
                } else {
                    suidFiles = JSON.parse(`{${scanData}}`);
                }

                const fileCount = Object.keys(suidFiles).length;
                if (fileCount === 0) {
                    resolve({ success: true, scanId });
                    return;
                }

                let insertedCount = 0;
                for (const [filePath, fileInfo] of Object.entries(suidFiles)) {
                    const suidSql = 'INSERT INTO results_suid (scanID, suidPath, suidPermissions, suidOwner, suidGroup, suidLogLocation) VALUES (?, ?, ?, ?, ?, ?)';
                    db.query(suidSql, [scanId, filePath, fileInfo.permissions, fileInfo.owner, fileInfo.group, logLocation], (err) => {
                        if (err) return reject(err);
                        insertedCount++;
                        if (insertedCount === fileCount) resolve({ success: true, scanId });
                    });
                }
            } catch (parseErr) {
                reject(parseErr);
            }
        });
    });
}

function insertEnvCheckResults(scanData, userId) {
    return new Promise((resolve, reject) => {
        try {
            const envData = JSON.parse(scanData);
            const hasSensitiveVars = Object.keys(envData.sensitive_environment_variables || {}).length > 0;

            db.query(
                'INSERT INTO scan_results (scanDateTime, scanPass, scanUser) VALUES (?, ?, ?)',
                [new Date(), hasSensitiveVars ? 0 : 1, userId],
                (err, result) => {
                    if (err) return reject(err);

                    const scanId = result.insertId;
                    const logLocation = path.join(logDir, `scan-envcheck-${new Date().toISOString()}.log`);

                    if (!hasSensitiveVars) {
                        resolve({ success: true, scanId });
                        return;
                    }

                    const sensitiveVars = envData.sensitive_environment_variables;
                    const varCount = Object.keys(sensitiveVars).length;
                    let insertedCount = 0;

                    for (const [varName, varInfo] of Object.entries(sensitiveVars)) {
                        const envSql = 'INSERT INTO results_envcheck (scanID, envVarName, envVarPattern, envVarValueMasked, envCheckLogLocation) VALUES (?, ?, ?, ?, ?)';
                        db.query(envSql, [scanId, varName, varInfo.pattern, varInfo.value, logLocation], (err) => {
                            if (err) return reject(err);
                            insertedCount++;
                            if (insertedCount === varCount) resolve({ success: true, scanId });
                        });
                    }
                }
            );
        } catch (parseErr) {
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

    db.query('SELECT uid, username FROM user_creds WHERE username = ? AND md5_pass = ?', [username, hashedPass], (err, results) => {
        if (err) return res.status(500).json({ success: false, error: 'Server error' });

        if (results.length > 0) {
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

            db.query('INSERT INTO user_sessions (uid, token, expires_at) VALUES (?, ?, ?)', [results[0].uid, token, expiresAt], (err) => {
                if (err) return res.status(500).json({ success: false, error: 'Server error' });
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
        if (err) return res.status(500).json({ success: false, error: 'Server error' });
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

app.get('/api/validate-token', validateToken, (req, res) => {
    res.json({ success: true });
});

// Returns the uid for the currently authenticated token
app.get('/api/me', validateToken, (req, res) => {
    res.json({ success: true, uid: req.uid });
});

app.post('/api/createUser', (req, res) => {
    const { username, password } = req.body;
    const hashedPass = crypto.createHash('md5').update(password).digest('hex');

    db.query('INSERT INTO user_creds (username, md5_pass) VALUES (?, ?)', [username, hashedPass], (err, results) => {
        if (err) return res.status(500).json({ success: false, error: 'Server error' });

        if (results.affectedRows > 0) {
            res.json({ success: true, message: 'User added', userID: results.insertId, username: username });
        } else {
            res.status(401).json({ success: false, message: 'Failed to add user' });
        }
    });
});

// ---------------------------------------------------------------------------
// Protected scan routes
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
                    dbResult = await insertSSHResults(results, userId);
                } else if (scanName === 'suid') {
                    dbResult = await insertSUIDResults(results, userId);
                } else if (scanName === 'envcheck') {
                    dbResult = await insertEnvCheckResults(results, userId);
                } else {
                    dbResult = await insertRTkitResults(results, userId);
                }

                res.status(200).json({ success: true, message: 'Scan triggered and results stored', dbResult });
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
        res.status(500).json({ success: false, error: 'Error fetching results' });
    }
});

// ---------------------------------------------------------------------------
// Dashboard charts endpoint — filtered by logged-in user
// ---------------------------------------------------------------------------
app.get('/api/dashboard-charts', validateToken, (req, res) => {
    const barSql = `
        SELECT
            DATE(scanDateTime) AS day,
            COUNT(*) AS total
        FROM scan_results
        WHERE scanDateTime >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        AND scanUser = ?
        GROUP BY DATE(scanDateTime)
        ORDER BY day ASC
    `;

    const pieSql = `
        SELECT 'Rootkit' AS label, COUNT(*) AS total
        FROM results_rtkit rt
        JOIN scan_results sr ON sr.scanID = rt.scanID
        WHERE sr.scanUser = ?
        UNION ALL
        SELECT 'SSH' AS label, COUNT(*) AS total
        FROM results_ssh ssh
        JOIN scan_results sr ON sr.scanID = ssh.scanID
        WHERE sr.scanUser = ?
        UNION ALL
        SELECT 'SUID' AS label, COUNT(*) AS total
        FROM results_suid su
        JOIN scan_results sr ON sr.scanID = su.scanID
        WHERE sr.scanUser = ?
        UNION ALL
        SELECT 'EnvCheck' AS label, COUNT(*) AS total
        FROM results_envcheck ev
        JOIN scan_results sr ON sr.scanID = ev.scanID
        WHERE sr.scanUser = ?
    `;

    db.query(barSql, [req.uid], (barErr, barRows) => {
        if (barErr) {
            console.error('Error fetching bar chart data:', barErr);
            return res.status(500).json({ success: false, error: 'Error fetching chart data' });
        }

        db.query(pieSql, [req.uid, req.uid, req.uid, req.uid], (pieErr, pieRows) => {
            if (pieErr) {
                console.error('Error fetching pie chart data:', pieErr);
                return res.status(500).json({ success: false, error: 'Error fetching chart data' });
            }

            const dayLabels = [];
            const dayTotals = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const label = d.toLocaleDateString('en-US', { weekday: 'short' });
                const iso = d.toISOString().slice(0, 10);
                const match = barRows.find(r => r.day.toISOString().slice(0, 10) === iso);
                dayLabels.push(label);
                dayTotals.push(match ? Number(match.total) : 0);
            }

            res.json({
                success: true,
                barChart: {
                    labels: dayLabels,
                    datasets: { label: 'Scans Per Day', data: dayTotals },
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
// Scan table endpoint — filtered by logged-in user
// ---------------------------------------------------------------------------
app.get('/api/scan-table', validateToken, (req, res) => {
    const sql = `
        SELECT
            sr.scanID,
            sr.scanDateTime,
            sr.scanPass,
            uc.username AS scanUser,
            CASE
                WHEN MAX(rt.scanID)  IS NOT NULL THEN 'Rootkit'
                WHEN MAX(ssh.scanID) IS NOT NULL THEN 'SSH'
                WHEN MAX(su.scanID)  IS NOT NULL THEN 'SUID'
                WHEN MAX(ev.scanID)  IS NOT NULL THEN 'EnvCheck'
                ELSE 'General'
            END AS scanType,
            COALESCE(
                MAX(rt.rtkitLogLocation),
                MAX(ssh.sshViolationLogLocation),
                MAX(su.suidLogLocation),
                MAX(ev.envCheckLogLocation),
                'N/A'
            ) AS logLocation,
            (
                SELECT COUNT(*) FROM results_rtkit    WHERE scanID = sr.scanID
            ) + (
                SELECT COUNT(*) FROM results_ssh      WHERE scanID = sr.scanID
            ) + (
                SELECT COUNT(*) FROM results_suid     WHERE scanID = sr.scanID
            ) + (
                SELECT COUNT(*) FROM results_envcheck WHERE scanID = sr.scanID
            ) AS warningCount
        FROM scan_results sr
        LEFT JOIN user_creds    uc  ON uc.uid    = sr.scanUser
        LEFT JOIN results_rtkit   rt  ON rt.scanID  = sr.scanID
        LEFT JOIN results_ssh     ssh ON ssh.scanID = sr.scanID
        LEFT JOIN results_suid    su  ON su.scanID  = sr.scanID
        LEFT JOIN results_envcheck ev ON ev.scanID  = sr.scanID
        WHERE sr.scanUser = ?
        GROUP BY sr.scanID, sr.scanDateTime, sr.scanPass, uc.username
        ORDER BY sr.scanDateTime DESC
        LIMIT 100
    `;

    db.query(sql, [req.uid], (err, rows) => {
        if (err) {
            console.error('Error fetching scan table:', err);
            return res.status(500).json({ success: false, error: 'Error fetching scan data' });
        }

        res.json({
            success: true,
            scans: rows.map(r => ({
                scanID:       r.scanID,
                scanDateTime: r.scanDateTime,
                scanPass:     r.scanPass,
                scanUser:     r.scanUser || 'Unknown',
                scanType:     r.scanType,
                logLocation:  r.logLocation,
                warningCount: Number(r.warningCount),
            })),
        });
    });
});

// ---------------------------------------------------------------------------
// Warnings table endpoint — filtered by logged-in user
// ---------------------------------------------------------------------------
app.get('/api/warnings-table', validateToken, (req, res) => {
    const sql = `
        SELECT sr.scanDateTime AS warningTime, 'Rootkit' AS scanType,
            rt.rtkitInfectedProgram AS detail, rt.rtkitLogLocation AS logLocation
        FROM results_rtkit rt
        JOIN scan_results sr ON sr.scanID = rt.scanID
        WHERE sr.scanUser = ?

        UNION ALL

        SELECT sr.scanDateTime, 'SSH',
            ssh.sshViolation, ssh.sshViolationLogLocation
        FROM results_ssh ssh
        JOIN scan_results sr ON sr.scanID = ssh.scanID
        WHERE sr.scanUser = ?

        UNION ALL

        SELECT sr.scanDateTime, 'SUID',
            CONCAT(su.suidPath, ' (', su.suidPermissions, ' ', su.suidOwner, ')'),
            su.suidLogLocation
        FROM results_suid su
        JOIN scan_results sr ON sr.scanID = su.scanID
        WHERE sr.scanUser = ?

        UNION ALL

        SELECT sr.scanDateTime, 'EnvCheck',
            CONCAT(ev.envVarName, ' matched pattern: ', ev.envVarPattern, ' value: ', ev.envVarValueMasked),
            ev.envCheckLogLocation
        FROM results_envcheck ev
        JOIN scan_results sr ON sr.scanID = ev.scanID
        WHERE sr.scanUser = ?

        ORDER BY warningTime DESC
        LIMIT 200
    `;

    db.query(sql, [req.uid, req.uid, req.uid, req.uid], (err, rows) => {
        if (err) {
            console.error('Error fetching warnings table:', err);
            return res.status(500).json({ success: false, error: 'Error fetching warnings data' });
        }

        res.json({
            success: true,
            warnings: rows.map(r => ({
                warningTime: r.warningTime,
                scanType:    r.scanType,
                detail:      r.detail,
                logLocation: r.logLocation,
            })),
        });
    });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

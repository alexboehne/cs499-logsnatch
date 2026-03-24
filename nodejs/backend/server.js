const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto'); // Built-in Node module for MD5
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

// Function to trigger a specific scan
function triggerScan(scanName) {
  try {
    const triggerFile = `/var/lib/logsnatch/${scanName}-trigger`;
    fs.utimesSync(triggerFile, new Date(), new Date()); // Update the timestamp to trigger the scan
    console.log(`Scan triggered successfully: ${scanName}`);
  } catch (err) {
    console.error(`Error triggering scan: ${scanName}`, err);
    throw err;
  }
}

// Function to fetch the latest scan results
function fetchResults() {
  return new Promise((resolve, reject) => {
    // Find the latest scan results file
    fs.readdir(logDir, (err, files) => {
      if (err) return reject(err);

      const scanFiles = files.filter(file => file.startsWith('scan_results') && file.endsWith('.log'));
      if (scanFiles.length === 0) return reject(new Error('No scan results found'));

      // Sort files by modification time to get the latest
      const latestFile = scanFiles.sort((a, b) => {
        const statA = fs.statSync(path.join(logDir, a));
        const statB = fs.statSync(path.join(logDir, b));
        return statB.mtime.getTime() - statA.mtime.getTime();
      })[0];

      // Read and return the JSON content
      fs.readFile(path.join(logDir, latestFile), 'utf8', (err, data) => {
        if (err) return reject(err);
        resolve(JSON.parse(data));
      });
    });
  });
}

// Function to insert scan results into the database
function insertRTkitResults(scanData, userId, scanName) {
  return new Promise((resolve, reject) => {
    // Insert into scan_results table
    const scanSql = 'INSERT INTO scan_results (scanDateTime, scanPass, scanUser) VALUES (?, ?, ?)';
    const scanValues = [new Date(), scanData.results.includes('INFECTED') ? 0 : 1, userId];

    db.query(scanSql, scanValues, (err, result) => {
      if (err) {
        console.error('Error inserting into scan_results:', err);
        return reject(err);
      }

      const scanId = result.insertId;

      // Insert into results_rtkit only if rootkits are detected
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

// Function to insert SSH scan results into the database
function insertSSHResults(scanData, userId, scanName) {
  return new Promise((resolve, reject) => {
    // Insert into scan_results table
    const scanSql = 'INSERT INTO scan_results (scanDateTime, scanPass, scanUser) VALUES (?, ?, ?)';
    const scanValues = [new Date(), scanData.results.includes('SSH_VIOLATION') ? 0 : 1, userId];

    db.query(scanSql, scanValues, (err, result) => {
      if (err) {
        console.error('Error inserting into scan_results:', err);
        return reject(err);
      }

      const scanId = result.insertId;

      // Insert into results_ssh only if SSH violations are detected
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
            //added by claude:
            const token = crypto.randomBytes(32).toString('hex') //checks for token
            res.json({ success: true, message: 'Login successful', user: results[0], token: token});
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

        if (results.affectedRows > 0) {
            res.json({ success: true, message: 'User added', userID: results.insertId, username: username });
        } else {
            res.status(401).json({ success: false, message: 'Failed to add user' });
        }
    });
});

// API Endpoint to trigger a specific scan
app.post('/api/trigger-scan', async (req, res) => {
  try {
    const { userId, scanName } = req.body;
    if (!userId || !scanName) {
      return res.status(400).json({ success: false, error: 'User ID and scan name are required' });
    }

    triggerScan(scanName);

    // Wait for the scan to complete (adjust the delay as needed)
    setTimeout(async () => {
      try {
        const results = await fetchResults();
        let dbResult;
        
        // Use the appropriate insertion function based on the scan type
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
    }, 5000); // Adjust the delay as needed
  } catch (err) {
    console.error('Error triggering scan:', err);
    res.status(500).json({ success: false, error: 'Error triggering scan' });
  }
});

// API Endpoint to fetch the latest scan results
app.get('/api/fetch-results', async (req, res) => {
  try {
    const results = await fetchResults();
    res.status(200).json({ success: true, results });
  } catch (err) {
    console.error('Error fetching results:', err);
    res.status(500).json({ success: false, error: 'Error fetching results' });
  }
});

// Start server
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
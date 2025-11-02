const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = 3000;

// --- 1. Database Initialization ---
// Create or open the SQLite database file
const db = new sqlite3.Database(path.join(__dirname, 'leads.db'), (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
    } else {
        console.log('Connected to the SQLite database: leads.db');
        // Create the 'leads' table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email_address TEXT NOT NULL,
            project_details TEXT,
            submission_date TEXT
        )`);
    }
});

// --- 2. Middleware ---
// Middleware to parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true })); 

// Middleware to serve static files (index.html, leads.html, thank_you.html) 
// from the standard 'public' folder located next to this server.js file.
app.use(express.static(path.join(__dirname, 'public'))); 

// --- 3. Form Submission Handler (Saves Data) ---
app.post('/submit_contact', (req, res) => {
    const { name, email, message } = req.body;
    const submissionDate = new Date().toISOString();

    if (!name || !email || !message) {
        return res.status(400).send('<html><body style="font-family: sans-serif; text-align: center; padding: 50px;">' +
                                    '<h1 style="color: red;">Error: Missing Required Fields!</h1>' +
                                    '<p>Please go back and fill in all fields.</p>' +
                                    '<a href="/">Go Back to Contact Form</a></body></html>');
    }

    const sql = `INSERT INTO leads (full_name, email_address, project_details, submission_date)
                 VALUES (?, ?, ?, ?)`;
    
    db.run(sql, [name, email, message, submissionDate], function(err) {
        if (err) {
            console.error("Database INSERT error:", err.message);
            return res.status(500).send('An internal server error occurred while saving your data.');
        }
        console.log(`A new lead was inserted with ID: ${this.lastID}`);
        
        // Redirect the user to the success page
        res.redirect('/thank_you.html'); 
    });
});

// --- 4. API Endpoint (Delivers Data to the Webpage) ---
// When the /leads.html page asks for data, this route sends the JSON response.
app.get('/api/leads', (req, res) => {
    // Select all columns and order by most recent submission first
    const sql = "SELECT id, full_name, email_address, project_details, submission_date FROM leads ORDER BY submission_date DESC";
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Database SELECT error:", err.message);
            res.status(500).json({ error: "Failed to fetch leads from database" });
            return;
        }
        // Send the database rows as a JSON array
        res.json(rows); 
    });
});


// --- 5. Server Start ---
app.listen(PORT, () => {
    console.log(`Server is READY! Access the site at: http://localhost:${PORT}/`);
    console.log(`View all leads at: http://localhost:${PORT}/leads.html`);
});


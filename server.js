const express = require('express');
// const sqlite3 = require('sqlite3').verbose(); // REMOVE THIS LINE
const mongoose = require('mongoose'); // ADD THIS LINE
const path = require('path');
const app = express();
// Render uses the environment variable PORT, otherwise default to 3000
const PORT = process.env.PORT || 3000; 

// --- 1. Database Initialization (Updated for MongoDB) ---
// Use the MongoDB URI from a secure environment variable (set on Render)
const MONGO_URI = process.env.MONGO_URI; 

if (!MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI is not defined! Application cannot connect to database.");
    process.exit(1);
}

// Connect to MongoDB Atlas
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas successfully!'))
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
        process.exit(1); // Exit if connection fails
    });

// Define the Schema (structure) for the Leads collection
const LeadSchema = new mongoose.Schema({
    full_name: { type: String, required: true },
    email_address: { type: String, required: true },
    project_details: String,
    submission_date: { type: Date, default: Date.now }
});

// Create the Mongoose Model
const Lead = mongoose.model('Lead', LeadSchema);


// --- 2. Middleware (No Change) ---
app.use(express.urlencoded({ extended: true })); 
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public'))); 


// --- 3. Form Submission Handler (Updated for MongoDB) ---
app.post('/submit_contact', async (req, res) => {
    const { name, email, message } = req.body;
    
    if (!name || !email || !message) {
        return res.status(400).send('Missing required fields: Name, Email, and Message are required.');
    }

    try {
        // Create a new Lead document using the Mongoose Model
        const newLead = new Lead({
            full_name: name,
            email_address: email,
            project_details: message,
            submission_date: new Date()
        });
        
        await newLead.save(); // Save the new lead to MongoDB
        console.log(`A new lead was inserted: ${newLead._id}`);
        
        // Redirect the user to the success page
        res.redirect('/thank_you.html'); 
    } catch (err) {
        console.error("MongoDB INSERT error:", err.message);
        return res.status(500).send('Error saving your data. Please try again.');
    }
});


// --- 4. Leads API Endpoint (Updated for MongoDB) ---
app.get('/api/leads', async (req, res) => {
    try {
        // Find all leads, sort by submission_date descending (most recent first)
        const leads = await Lead.find({}).sort({ submission_date: -1 });

        // Map the data to match the format expected by leads.html
        const formattedLeads = leads.map(lead => ({
            id: lead._id, // Use MongoDB ID
            full_name: lead.full_name,
            email_address: lead.email_address,
            project_details: lead.project_details,
            submission_date: lead.submission_date.toISOString() // Ensure date is string format
        }));
        
        // Send the data as JSON
        res.json(formattedLeads);
    } catch (err) {
        console.error("MongoDB SELECT error:", err.message);
        return res.status(500).json({ error: 'Failed to fetch leads from database' });
    }
});


// --- 5. Server Start ---
app.listen(PORT, () => {
    console.log(`Server is READY on port ${PORT}!`);
});

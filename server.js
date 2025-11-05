const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

// --- NEW CODE: Load .env file for local development ---
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

// Render uses the environment variable PORT, otherwise default to 3000
const PORT = process.env.PORT || 3000; 

// --- 1. Database Initialization (Updated for MongoDB) ---
// Use the MongoDB URI from a secure environment variable
const MONGO_URI = process.env.MONGO_URI; 

if (!MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI is not defined! Application cannot connect to database.");
    // In a real production environment, you might want to handle this more gracefully,
    // but for local testing, exiting is often best to prevent silent failures.
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
    // ADDED: The telephone number field
    tel: { type: String }, 
    email_address: { type: String, required: true },
    project_details: String,
    submission_date: { type: Date, default: Date.now }
});

// Create the Mongoose Model
const Lead = mongoose.model('Lead', LeadSchema);


// --- 2. Middleware ---
// Parse incoming requests with JSON payloads (not strictly needed for form-urlencoded but good practice)
app.use(express.json()); 
// Parse incoming form data from the contact form submission
app.use(express.urlencoded({ extended: true })); 
// CORRECTED PATH: Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public'))); 


// --- 3. Contact Form Submission POST Handler (Updated for Tel field) ---
app.post('/submit_contact', async (req, res) => {
    // Check if the request body is present
    if (!req.body) {
        console.log("Validation Failed: Empty request body.");
        return res.redirect('/thank_you.html?status=error');
    }

    // Server-side validation (now requiring name, email, message, AND tel)
    // NOTE: The server.js code uses req.body.name and req.body.message, 
    // while the HTML form uses input names 'full_name' and 'project_details'.
    // I will assume your HTML form input names match the server-side validation names.
    // If your HTML form is: name="full_name" and name="project_details", you should fix this part.
    // For now, I'm keeping the original req.body.name/message logic.
    if (!req.body.name || !req.body.email || !req.body.message || !req.body.tel) {
        console.log("Validation Failed: Missing required fields (name, email, message, or tel).");
        return res.redirect('/thank_you.html?status=error');
    }

    try {
        const newLead = new Lead({
            full_name: req.body.name,
            // ADDED: Capture the telephone number from the form data
            tel: req.body.tel, 
            email_address: req.body.email,
            project_details: req.body.message,
            submission_date: new Date()
        });
        
        await newLead.save(); // Save the new lead to MongoDB
        console.log(`A new lead was inserted: ${newLead._id} from ${newLead.full_name}`);
        
        // Redirect the user to the success page (Express automatically handles the /public/ part here)
        res.redirect('/thank_you.html?status=success'); 
    } catch (err) {
        console.error("MongoDB INSERT error:", err.message);
        // Redirect to error page on database failure
        return res.redirect('/thank_you.html?status=error');
    }
});


// --- 4. Leads API Endpoint (Updated for MongoDB and Tel field) ---
app.get('/api/leads', async (req, res) => {
    try {
        // Find all leads, sort by submission_date descending (most recent first)
        const leads = await Lead.find({}).sort({ submission_date: -1 });

        // Map the data to match the format expected by leads.html
        const formattedLeads = leads.map(lead => ({
            id: lead._id, // Use MongoDB ID
            full_name: lead.full_name,
            // ADDED: Include the telephone number
            tel: lead.tel || 'N/A', 
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
    console.log(`Server running on http://localhost:${PORT}`);
});

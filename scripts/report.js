const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path'); // We need path utility to correctly locate the .env file

// --- 1. Load Environment Variables (FIXED PATH) ---
// We explicitly specify the path to the .env file, assuming it's in the parent directory (../).
dotenv.config({ path: path.resolve(__dirname, '../.env') }); 

const MONGO_URI = process.env.MONGO_URI; 

// --- 2. Database Schema Definition (Must match server.js) ---
const LeadSchema = new mongoose.Schema({
    full_name: { type: String, required: true },
    tel:{ type: String   },
    email_address: { type: String, required: true },
    project_details: String,
    submission_date: { type: Date, default: Date.now }
});

// The model must be compiled only once. We'll check if it already exists.
const Lead = mongoose.models.Lead || mongoose.model('Lead', LeadSchema);

/**
 * Main function to connect, read, and print leads data.
 */
async function printAllLeads() {
    if (!MONGO_URI) {
        console.error("FATAL ERROR: MONGO_URI is not defined.");
        console.error("Please ensure your .env file is in the parent directory (../.env) and contains the MONGO_URI.");
        return;
    }

    try {
        // --- 3. Connect to MongoDB ---
        console.log("Attempting to connect to MongoDB Atlas...");
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connection successful!');

        // --- 4. Read Data (Find all documents) ---
        const leads = await Lead.find({})
            .sort({ submission_date: -1 })
            .lean(); 

        console.log(`\n--- Found ${leads.length} Leads in the Database ---\n`);

        if (leads.length === 0) {
            console.log("The leads collection is empty. Submit a form on http://localhost:3000/ to populate data.");
        } else {
            // --- 5. Print Data to Console ---
            leads.forEach((lead, index) => {
                const dateString = lead.submission_date.toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                });

                console.log(`[#${index + 1}] ID: ${lead._id}`);
                console.log(`    Name: ${lead.full_name}`);
                console.log(`    Tel: ${lead.tel || 'N/A'}`);
                console.log(`    Email: ${lead.email_address}`);
                console.log(`    Submitted: ${dateString}`);
                console.log(`    Details: ${lead.project_details ? lead.project_details.substring(0, 1000) + (lead.project_details.length > 1000 ? '...' : '') : 'N/A'}`);
                console.log('--------------------------------------------------');
            });
        }

    } catch (error) {
        console.error('\n--- ❌ MongoDB Operation Failed ---');
        console.error('Error details:', error.message);
    } finally {
        // --- 6. Close Connection ---
        await mongoose.connection.close();
        console.log('\nConnection closed. Script finished.');
    }
}

// Execute the main function
printAllLeads();

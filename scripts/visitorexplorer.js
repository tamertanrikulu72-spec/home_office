const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path'); 

// --- 1. Load Environment Variables (FIXED PATH) ---
// We explicitly specify the path to the .env file, assuming it's in the parent directory (../).
// NOTE: Depending on where you run this script, you may need to adjust the path to your .env file.
dotenv.config({ path: path.resolve(__dirname, '../.env') }); 

const MONGO_URI = process.env.MONGO_URI; 

// --- 2. Database Schema Definition (Must match server.js) ---
// Define the Schema (structure) for the Visitors collection
const VisitorSchema = new mongoose.Schema({
    ip_address: { type: String, required: true },
    visit_date: { type: Date, default: Date.now },
    path: String,
    country: String,
    city: String,
    latitude: Number,
    longitude: Number,
});

// The model must be compiled only once. We'll check if it already exists.
const Visitor = mongoose.models.Visitor || mongoose.model('Visitor', VisitorSchema, 'visitors'); // Explicitly name collection 'visitors'

/**
 * Main function to connect, read, and print visitor data.
 */
async function printVisitorReport() {
    if (!MONGO_URI) {
        console.error("\n--- ❌ FATAL ERROR: MONGO_URI is not defined. ---");
        console.error("Please ensure your .env file is in the parent directory and contains the MONGO_URI.");
        return;
    }

    try {
        // --- 3. Connect to MongoDB ---
        console.log("Attempting to connect to MongoDB Atlas...");
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connection successful!');

        // --- 4. Fetch and Aggregate Visitor Data ---
        
        // Find total number of visits
        const totalVisits = await Visitor.countDocuments();
        
        // Find unique IP addresses (unique visitors)
        const uniqueIps = await Visitor.distinct('ip_address');
        const uniqueVisitorCount = uniqueIps.length;

        // Aggregate by Country
        const countryCounts = await Visitor.aggregate([
            { $match: { country: { $exists: true, $ne: 'Unknown', $ne: null } } },
            { $group: { _id: '$country', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);

        // Aggregate by City
        const cityCounts = await Visitor.aggregate([
            { $match: { city: { $exists: true, $ne: 'Unknown', $ne: null } } },
            { $group: { _id: '$city', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);

        // Map aggregated results to a simple [key, count] array for reporting
        const sortedCountries = countryCounts.map(item => [item._id, item.count]).slice(0, 5);
        const sortedCities = cityCounts.map(item => [item._id, item.count]).slice(0, 5);


        // --- 5. Print Report to Console ---
        console.log('\n==================================================');
        console.log('       🌐 Visitor Explorer Report 📊');
        console.log('==================================================');
        
        console.log('\n--- 📈 Summary Statistics ---');
        console.log(`- Total Page Views (All Time): ${totalVisits}`);
        console.log(`- Unique Visitor IPs:          ${uniqueVisitorCount}`);
        console.log('--------------------------------------------------');
        
        console.log('\n--- 🌎 Top 5 Visitor Countries ---');
        if (sortedCountries.length === 0) {
            console.log("No country data available. Visit your site to populate data!");
        } else {
            sortedCountries.forEach(([country, count], index) => {
                console.log(`  #${index + 1}: ${country.padEnd(25)} (${count} visits)`);
            });
        }
        console.log('--------------------------------------------------');

        console.log('\n--- 🏙️ Top 5 Visitor Cities ---');
        if (sortedCities.length === 0) {
            console.log("No city data available. Visit your site to populate data!");
        } else {
            sortedCities.forEach(([city, count], index) => {
                console.log(`  #${index + 1}: ${city.padEnd(25)} (${count} visits)`);
            });
        }
        console.log('==================================================');
        

    } catch (error) {
        console.error('\n--- ❌ MongoDB Operation Failed ---');
        console.error('Error details:', error.message);
    } finally {
        // --- 6. Close Connection ---
        await mongoose.connection.close();
        console.log('\nConnection closed. Script finished. Run the script again to see new data.');
    }
}

// Execute the main function
printVisitorReport();

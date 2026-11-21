const express = require('express');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve robots.txt and sitemap.xml explicitly for search engine crawlers
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send(
        'User-agent: *\n' +
        'Allow: /\n\n' +
        'Sitemap: https://yenimakinetasarim.com/sitemap.xml\n' +
        'Sitemap: https://yenimakinetasarim.com.tr/sitemap.xml\n'
    );
});

app.get('/sitemap.xml', (req, res) => {
    res.type('application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://yenimakinetasarim.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://yenimakinetasarim.com.tr/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
});

app.use(express.static(__dirname));

// Find pictures folder (checks ../pictures first, then ./pictures)
const parentPictures = path.join(__dirname, '..', 'pictures');
const localPictures = path.join(__dirname, 'pictures');
const picturesPath = fs.existsSync(parentPictures) ? parentPictures : localPictures;

app.use('/pictures', express.static(picturesPath));

app.get('/api/pictures', (req, res) => {
    fs.readdir(picturesPath, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Could not read pictures folder', path: picturesPath });
        }
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const images = files.filter(file =>
            imageExtensions.some(ext => file.toLowerCase().endsWith(ext))
        );
        res.json(images);
    });
});

// MongoDB Atlas Configuration
const mongoUri = process.env.MONGODB_URI || '';
const mongoDbName = process.env.MONGODB_DB_NAME || 'home_office';
const mongoCollectionName = process.env.MONGODB_COLLECTION || 'contact_messages';
const messagesReadKey = process.env.MESSAGES_READ_KEY || '';

let contactCollection = null;

async function getContactCollection() {
    if (!mongoUri) {
        return null;
    }
    if (contactCollection) {
        return contactCollection;
    }
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(mongoDbName);
    contactCollection = db.collection(mongoCollectionName);
    return contactCollection;
}

// Local JSON Fallback (used if MONGODB_URI is not configured)
const messagesFile = path.join(__dirname, 'messages.json');

function saveMessageLocally(entry) {
    let messages = [];
    if (fs.existsSync(messagesFile)) {
        try {
            const raw = fs.readFileSync(messagesFile, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                messages = parsed;
            }
        } catch (err) {
            console.error('Error reading messages.json:', err);
        }
    }

    messages.push(entry);
    fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2), 'utf8');
}

app.post('/api/contact', async (req, res) => {
    const senderEmail = (req.body.email || '').trim();
    const phone = (req.body.phone || '').trim();
    const message = (req.body.message || '').trim();

    if (!senderEmail || !message) {
        return res.status(400).json({ ok: false, error: 'Email and message are required.' });
    }

    const entry = {
        id: Date.now(),
        email: senderEmail,
        phone: phone,
        message: message,
        receivedAt: new Date().toISOString()
    };

    try {
        const collection = await getContactCollection();
        if (collection) {
            await collection.insertOne(entry);
            return res.json({ ok: true, storage: 'mongodb' });
        }

        saveMessageLocally(entry);
        return res.json({ ok: true, storage: 'local-file' });
    } catch (err) {
        console.error('Error saving contact message to MongoDB:', err);
        return res.status(500).json({ ok: false, error: 'Failed to save message.' });
    }
});

app.get('/api/messages', async (req, res) => {
    const providedKey = String(req.headers['x-read-key'] || req.query.key || '').trim();

    if (!messagesReadKey) {
        return res.status(403).json({
            ok: false,
            error: 'MESSAGES_READ_KEY is not configured on the server.'
        });
    }

    if (providedKey !== messagesReadKey) {
        return res.status(401).json({ ok: false, error: 'Unauthorized.' });
    }

    try {
        const collection = await getContactCollection();
        if (collection) {
            const docs = await collection
                .find({})
                .sort({ id: -1 })
                .toArray();
            return res.json({ ok: true, storage: 'mongodb', messages: docs });
        }

        let messages = [];
        if (fs.existsSync(messagesFile)) {
            const raw = fs.readFileSync(messagesFile, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                messages = parsed.slice().reverse();
            }
        }
        return res.json({ ok: true, storage: 'local-file', messages });
    } catch (err) {
        console.error('Error reading messages:', err);
        return res.status(500).json({ ok: false, error: 'Failed to load messages.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Serving pictures from: ${picturesPath}`);
    console.log(`Contact storage mode: ${mongoUri ? `MongoDB Atlas (${mongoDbName}.${mongoCollectionName})` : 'Local messages.json'}`);
});

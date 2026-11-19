const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
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

// Store Contact Messages in Local JSON File
const messagesFile = path.join(__dirname, 'messages.json');

app.post('/api/contact', (req, res) => {
    const senderEmail = (req.body.email || '').trim();
    const message = (req.body.message || '').trim();

    if (!senderEmail || !message) {
        return res.status(400).json({ ok: false, error: 'Email and message are required.' });
    }

    const entry = {
        id: Date.now(),
        email: senderEmail,
        message: message,
        receivedAt: new Date().toISOString()
    };

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

    try {
        fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2), 'utf8');
        res.json({ ok: true });
    } catch (err) {
        console.error('Error writing messages.json:', err);
        res.status(500).json({ ok: false, error: 'Failed to save message.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Serving pictures from: ${picturesPath}`);
});

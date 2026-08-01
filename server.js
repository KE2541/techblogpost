const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { getDB } = require('./db');
const postsRouter = require('./routes/posts');
const uploadsRouter = require('./routes/uploads');

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- Middleware --------------------
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------- Helpers --------------------
function readJSON(filePath, defaultData = []) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }

        const data = fs.readFileSync(filePath, 'utf8');

        return data ? JSON.parse(data) : defaultData;
    } catch (err) {
        console.error(`Error reading ${filePath}:`, err.message);
        return defaultData;
    }
}

function writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const subscribersPath = path.join(__dirname, 'subscribers.json');
const adsPath = path.join(__dirname, 'ads.json');

// -------------------- Routes --------------------
app.use('/api/posts', postsRouter);
app.use('/api/uploads', uploadsRouter);

// Analytics
app.get('/api/analytics', (req, res) => {
    const db = getDB();

    const totalViews = db.posts.reduce((sum, p) => sum + (p.views || 0), 0);
    const totalLikes = db.posts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = db.posts.reduce(
        (sum, p) => sum + (p.comments?.length || 0),
        0
    );

    res.json({
        totalPosts: db.posts.length,
        totalViews,
        totalLikes,
        totalComments
    });
});

// Newsletter Subscribe
app.post('/api/newsletter', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({
            error: 'Email is required'
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
        return res.status(400).json({
            error: 'Invalid email address'
        });
    }

    const subscribers = readJSON(subscribersPath);

    const exists = subscribers.some(
        s => s.email.toLowerCase() === email.toLowerCase()
    );

    if (exists) {
        return res.json({
            message: 'Already subscribed'
        });
    }

    subscribers.push({
        email: email.toLowerCase(),
        subscribedAt: new Date().toISOString()
    });

    writeJSON(subscribersPath, subscribers);

    res.json({
        message: 'Subscribed successfully'
    });
});

// Newsletter List
app.get('/api/newsletter', (req, res) => {
    res.json(readJSON(subscribersPath));
});

// Ads
app.get('/api/ads', (req, res) => {
    const defaults = {
        enabled: true,
        header: {
            code: '',
            active: false
        },
        sidebar: {
            code: '',
            active: false
        },
        inline: {
            code: '',
            active: false
        },
        footer: {
            code: '',
            active: false
        },
        popup: {
            code: '',
            active: false
        }
    };

    const ads = readJSON(adsPath, defaults);

    res.json(ads);
});

// Save Ads
app.post('/api/ads', (req, res) => {
    writeJSON(adsPath, req.body);

    res.json({
        message: 'Ad configuration saved successfully.'
    });
});

// -------------------- Frontend --------------------
// Express 5 compatible wildcard route
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -------------------- Error Handling --------------------
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found'
    });
});

app.use((err, req, res, next) => {
    console.error(err);

    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error'
    });
});

// -------------------- Start Server --------------------
app.listen(PORT, () => {
    console.log(`✅ Blog server running on http://localhost:${PORT}`);
});
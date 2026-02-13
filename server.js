const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Basic route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API example - get all items from database
app.get('/api/items', (req, res) => {
  try {
    const items = db.getAllItems();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API example - add item to database
app.post('/api/items', (req, res) => {
  try {
    const { name, description } = req.body;
    const result = db.addItem(name, description);
    res.json({ id: result.lastInsertRowid, name, description });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ratings for a song
app.get('/api/ratings/:songKey', (req, res) => {
  try {
    const { songKey } = req.params;
    const ratings = db.getSongRatings(songKey);
    res.json(ratings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a rating for a song
app.post('/api/ratings', (req, res) => {
  try {
    const { songKey, artist, title, ratingType, userId } = req.body;

    if (!songKey || !artist || !title || !ratingType || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (ratingType !== 'up' && ratingType !== 'down') {
      return res.status(400).json({ error: 'Invalid rating type' });
    }

    const result = db.addOrUpdateRating(songKey, artist, title, ratingType, userId);

    if (result.error) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if user has rated a song
app.get('/api/ratings/:songKey/user/:userId', (req, res) => {
  try {
    const { songKey, userId } = req.params;
    const rating = db.getUserRating(songKey, userId);
    res.json({ hasRated: !!rating, ratingType: rating });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const Database = require('better-sqlite3');
const path = require('path');

// Create or open database
const db = new Database(path.join(__dirname, 'database.db'));

// Initialize database schema
function initDB() {
  const createItemsTable = `
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createRatingsTable = `
    CREATE TABLE IF NOT EXISTS song_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_key TEXT NOT NULL UNIQUE,
      artist TEXT NOT NULL,
      title TEXT NOT NULL,
      thumbs_up INTEGER DEFAULT 0,
      thumbs_down INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createUserRatingsTable = `
    CREATE TABLE IF NOT EXISTS user_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_key TEXT NOT NULL,
      user_id TEXT NOT NULL,
      rating_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(song_key, user_id)
    )
  `;

  db.exec(createItemsTable);
  db.exec(createRatingsTable);
  db.exec(createUserRatingsTable);
  console.log('Database initialized');
}

// Initialize on module load
initDB();

// Database functions
const getAllItems = () => {
  const stmt = db.prepare('SELECT * FROM items ORDER BY created_at DESC');
  return stmt.all();
};

const addItem = (name, description) => {
  const stmt = db.prepare('INSERT INTO items (name, description) VALUES (?, ?)');
  return stmt.run(name, description);
};

const getItemById = (id) => {
  const stmt = db.prepare('SELECT * FROM items WHERE id = ?');
  return stmt.get(id);
};

const deleteItem = (id) => {
  const stmt = db.prepare('DELETE FROM items WHERE id = ?');
  return stmt.run(id);
};

// Song rating functions
const getSongRatings = (songKey) => {
  const stmt = db.prepare('SELECT * FROM song_ratings WHERE song_key = ?');
  return stmt.get(songKey) || { thumbs_up: 0, thumbs_down: 0 };
};

const addOrUpdateRating = (songKey, artist, title, ratingType, userId) => {
  // Check if user has already rated this song
  const userRatingStmt = db.prepare('SELECT * FROM user_ratings WHERE song_key = ? AND user_id = ?');
  const existingRating = userRatingStmt.get(songKey, userId);

  if (existingRating) {
    return { error: 'User has already rated this song' };
  }

  // Start transaction
  const transaction = db.transaction(() => {
    // Get or create song rating record
    let songRating = db.prepare('SELECT * FROM song_ratings WHERE song_key = ?').get(songKey);

    if (!songRating) {
      const insertStmt = db.prepare(`
        INSERT INTO song_ratings (song_key, artist, title, thumbs_up, thumbs_down)
        VALUES (?, ?, ?, 0, 0)
      `);
      insertStmt.run(songKey, artist, title);
      songRating = { song_key: songKey, thumbs_up: 0, thumbs_down: 0 };
    }

    // Update the rating count
    const field = ratingType === 'up' ? 'thumbs_up' : 'thumbs_down';
    const updateStmt = db.prepare(`
      UPDATE song_ratings
      SET ${field} = ${field} + 1, updated_at = CURRENT_TIMESTAMP
      WHERE song_key = ?
    `);
    updateStmt.run(songKey);

    // Record the user's rating
    const userRatingInsertStmt = db.prepare(`
      INSERT INTO user_ratings (song_key, user_id, rating_type)
      VALUES (?, ?, ?)
    `);
    userRatingInsertStmt.run(songKey, userId, ratingType);
  });

  transaction();

  // Return updated ratings
  return getSongRatings(songKey);
};

const getUserRating = (songKey, userId) => {
  const stmt = db.prepare('SELECT rating_type FROM user_ratings WHERE song_key = ? AND user_id = ?');
  const result = stmt.get(songKey, userId);
  return result ? result.rating_type : null;
};

module.exports = {
  db,
  getAllItems,
  addItem,
  getItemById,
  deleteItem,
  getSongRatings,
  addOrUpdateRating,
  getUserRating
};

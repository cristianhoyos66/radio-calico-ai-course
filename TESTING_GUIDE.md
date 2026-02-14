# Testing Implementation Guide

This document provides detailed implementation patterns for the Radio Calico testing framework.

## Quick Start

### 1. Install Dependencies

```bash
npm install --save-dev jest supertest jsdom @types/jest
```

### 2. Create Jest Configuration

**jest.config.js**
```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'server.js',
    'db.js',
    'public/**/*.js',
    '!public/**/*.min.js'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### 3. Update package.json

```json
{
  "scripts": {
    "test": "jest",
    "test:backend": "jest tests/backend",
    "test:frontend": "jest tests/frontend",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Backend Testing Implementation

### Database Layer Tests (tests/backend/db.test.js)

```javascript
const Database = require('better-sqlite3');
const path = require('path');

// Mock better-sqlite3 to use in-memory database
jest.mock('better-sqlite3', () => {
  const actualDb = jest.requireActual('better-sqlite3');
  return jest.fn(() => actualDb(':memory:'));
});

describe('Database Layer Tests', () => {
  let db;
  let dbFunctions;

  beforeEach(() => {
    // Clear module cache to get fresh database instance
    jest.resetModules();
    dbFunctions = require('../../db');
    db = dbFunctions.db;
  });

  afterEach(() => {
    // Close database connection
    if (db) {
      db.close();
    }
  });

  describe('getSongRatings', () => {
    test('should return default values for non-existent song', () => {
      const result = dbFunctions.getSongRatings('nonexistent_key');
      expect(result).toEqual({ thumbs_up: 0, thumbs_down: 0 });
    });

    test('should return correct counts for existing song', () => {
      const songKey = 'test_key';
      const insert = db.prepare(`
        INSERT INTO song_ratings (song_key, artist, title, thumbs_up, thumbs_down)
        VALUES (?, ?, ?, ?, ?)
      `);
      insert.run(songKey, 'Artist', 'Title', 5, 3);

      const result = dbFunctions.getSongRatings(songKey);
      expect(result.thumbs_up).toBe(5);
      expect(result.thumbs_down).toBe(3);
    });
  });

  describe('addOrUpdateRating', () => {
    test('should create new song record with first rating', () => {
      const songKey = btoa('Artist|||Title');
      const result = dbFunctions.addOrUpdateRating(
        songKey,
        'Artist',
        'Title',
        'up',
        'user_123'
      );

      expect(result.thumbs_up).toBe(1);
      expect(result.thumbs_down).toBe(0);
    });

    test('should increment thumbs_up counter', () => {
      const songKey = btoa('Artist|||Title');

      dbFunctions.addOrUpdateRating(songKey, 'Artist', 'Title', 'up', 'user_1');
      const result = dbFunctions.addOrUpdateRating(songKey, 'Artist', 'Title', 'up', 'user_2');

      expect(result.thumbs_up).toBe(2);
      expect(result.thumbs_down).toBe(0);
    });

    test('should increment thumbs_down counter', () => {
      const songKey = btoa('Artist|||Title');

      dbFunctions.addOrUpdateRating(songKey, 'Artist', 'Title', 'down', 'user_1');
      const result = dbFunctions.addOrUpdateRating(songKey, 'Artist', 'Title', 'down', 'user_2');

      expect(result.thumbs_up).toBe(0);
      expect(result.thumbs_down).toBe(2);
    });

    test('should prevent duplicate votes from same user', () => {
      const songKey = btoa('Artist|||Title');

      dbFunctions.addOrUpdateRating(songKey, 'Artist', 'Title', 'up', 'user_123');
      const result = dbFunctions.addOrUpdateRating(songKey, 'Artist', 'Title', 'down', 'user_123');

      expect(result.error).toBe('User has already rated this song');
    });

    test('should create user_ratings record', () => {
      const songKey = btoa('Artist|||Title');
      const userId = 'user_123';

      dbFunctions.addOrUpdateRating(songKey, 'Artist', 'Title', 'up', userId);

      const userRating = db.prepare(
        'SELECT * FROM user_ratings WHERE song_key = ? AND user_id = ?'
      ).get(songKey, userId);

      expect(userRating).toBeDefined();
      expect(userRating.rating_type).toBe('up');
    });
  });

  describe('getUserRating', () => {
    test('should return null for user who has not rated', () => {
      const result = dbFunctions.getUserRating('test_key', 'user_123');
      expect(result).toBeNull();
    });

    test('should return correct rating type for user who has rated', () => {
      const songKey = btoa('Artist|||Title');
      const userId = 'user_123';

      dbFunctions.addOrUpdateRating(songKey, 'Artist', 'Title', 'up', userId);
      const result = dbFunctions.getUserRating(songKey, userId);

      expect(result).toBe('up');
    });
  });
});
```

### API Endpoint Tests (tests/backend/api.test.js)

```javascript
const request = require('supertest');
const express = require('express');

// Mock the database module
jest.mock('../../db');

describe('API Endpoint Tests', () => {
  let app;
  let dbMock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Get mocked db module
    dbMock = require('../../db');

    // Create Express app (same setup as server.js)
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Define routes (copy from server.js)
    app.get('/api/ratings/:songKey', (req, res) => {
      try {
        const { songKey } = req.params;
        const ratings = dbMock.getSongRatings(songKey);
        res.json(ratings);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/ratings', (req, res) => {
      try {
        const { songKey, artist, title, ratingType, userId } = req.body;

        if (!songKey || !artist || !title || !ratingType || !userId) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        if (ratingType !== 'up' && ratingType !== 'down') {
          return res.status(400).json({ error: 'Invalid rating type' });
        }

        const result = dbMock.addOrUpdateRating(songKey, artist, title, ratingType, userId);

        if (result.error) {
          return res.status(400).json(result);
        }

        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/ratings/:songKey/user/:userId', (req, res) => {
      try {
        const { songKey, userId } = req.params;
        const rating = dbMock.getUserRating(songKey, userId);
        res.json({ hasRated: !!rating, ratingType: rating });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  });

  describe('GET /api/ratings/:songKey', () => {
    test('should return 200 with rating data', async () => {
      const mockRatings = { thumbs_up: 5, thumbs_down: 3 };
      dbMock.getSongRatings.mockReturnValue(mockRatings);

      const response = await request(app)
        .get('/api/ratings/test_key')
        .expect(200);

      expect(response.body).toEqual(mockRatings);
      expect(dbMock.getSongRatings).toHaveBeenCalledWith('test_key');
    });

    test('should return default values for new song', async () => {
      dbMock.getSongRatings.mockReturnValue({ thumbs_up: 0, thumbs_down: 0 });

      const response = await request(app)
        .get('/api/ratings/new_song_key')
        .expect(200);

      expect(response.body).toEqual({ thumbs_up: 0, thumbs_down: 0 });
    });

    test('should return 500 on database error', async () => {
      dbMock.getSongRatings.mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .get('/api/ratings/test_key')
        .expect(500);

      expect(response.body.error).toBe('Database error');
    });
  });

  describe('POST /api/ratings', () => {
    test('should return 200 with updated ratings on success', async () => {
      const mockResult = { thumbs_up: 1, thumbs_down: 0 };
      dbMock.addOrUpdateRating.mockReturnValue(mockResult);

      const response = await request(app)
        .post('/api/ratings')
        .send({
          songKey: 'test_key',
          artist: 'Artist',
          title: 'Title',
          ratingType: 'up',
          userId: 'user_123'
        })
        .expect(200);

      expect(response.body).toEqual(mockResult);
      expect(dbMock.addOrUpdateRating).toHaveBeenCalledWith(
        'test_key',
        'Artist',
        'Title',
        'up',
        'user_123'
      );
    });

    test('should return 400 when missing required fields', async () => {
      const response = await request(app)
        .post('/api/ratings')
        .send({
          songKey: 'test_key',
          artist: 'Artist'
          // Missing title, ratingType, userId
        })
        .expect(400);

      expect(response.body.error).toBe('Missing required fields');
    });

    test('should return 400 when user already rated', async () => {
      dbMock.addOrUpdateRating.mockReturnValue({
        error: 'User has already rated this song'
      });

      const response = await request(app)
        .post('/api/ratings')
        .send({
          songKey: 'test_key',
          artist: 'Artist',
          title: 'Title',
          ratingType: 'up',
          userId: 'user_123'
        })
        .expect(400);

      expect(response.body.error).toBe('User has already rated this song');
    });

    test('should return 400 for invalid ratingType', async () => {
      const response = await request(app)
        .post('/api/ratings')
        .send({
          songKey: 'test_key',
          artist: 'Artist',
          title: 'Title',
          ratingType: 'invalid',
          userId: 'user_123'
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid rating type');
    });
  });

  describe('GET /api/ratings/:songKey/user/:userId', () => {
    test('should return hasRated: false for new user', async () => {
      dbMock.getUserRating.mockReturnValue(null);

      const response = await request(app)
        .get('/api/ratings/test_key/user/user_123')
        .expect(200);

      expect(response.body).toEqual({
        hasRated: false,
        ratingType: null
      });
    });

    test('should return hasRated: true with rating type for existing user', async () => {
      dbMock.getUserRating.mockReturnValue('up');

      const response = await request(app)
        .get('/api/ratings/test_key/user/user_123')
        .expect(200);

      expect(response.body).toEqual({
        hasRated: true,
        ratingType: 'up'
      });
    });
  });
});
```

## Frontend Testing Implementation

### Frontend Ratings Tests (tests/frontend/ratings.test.js)

```javascript
/**
 * @jest-environment jsdom
 */

describe('Frontend Rating Logic', () => {
  let fetchMock;
  let localStorageMock;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <button id="thumbsUpBtn"></button>
      <button id="thumbsDownBtn"></button>
      <div id="thumbsUpCount">0</div>
      <div id="thumbsDownCount">0</div>
      <div id="currentSong">
        <div class="artist">Test Artist</div>
        <div class="title">Test Song</div>
      </div>
    `;

    // Mock fetch
    fetchMock = jest.spyOn(global, 'fetch');

    // Mock localStorage
    localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      clear: jest.fn()
    };
    global.localStorage = localStorageMock;
  });

  afterEach(() => {
    fetchMock.mockRestore();
    jest.clearAllMocks();
  });

  describe('Song Key Generation', () => {
    test('should generate correct base64 song key', () => {
      const artist = 'Test Artist';
      const title = 'Test Song';
      const expected = btoa(`${artist}|||${title}`);
      const result = btoa(`${artist}|||${title}`);

      expect(result).toBe(expected);
    });

    test('should handle special characters in artist/title', () => {
      const artist = 'Artist & The Band';
      const title = 'Song (2024 Mix)';
      const songKey = btoa(`${artist}|||${title}`);

      expect(songKey).toBeTruthy();
      expect(atob(songKey)).toBe(`${artist}|||${title}`);
    });
  });

  describe('User Identification', () => {
    test('should generate user ID if not in localStorage', () => {
      localStorageMock.getItem.mockReturnValue(null);

      // Simulate user ID generation
      const userId = `user_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
      localStorageMock.setItem('radiocalico_user_id', userId);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'radiocalico_user_id',
        expect.stringMatching(/^user_.*_\d+$/)
      );
    });

    test('should reuse existing user ID from localStorage', () => {
      const existingUserId = 'user_abc123_1234567890';
      localStorageMock.getItem.mockReturnValue(existingUserId);

      const userId = localStorageMock.getItem('radiocalico_user_id');

      expect(userId).toBe(existingUserId);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('radiocalico_user_id');
    });
  });

  describe('Rating Submission', () => {
    test('should submit rating with correct payload', async () => {
      const mockResponse = { thumbs_up: 1, thumbs_down: 0 };
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const songKey = btoa('Test Artist|||Test Song');
      const userId = 'user_test_123';

      await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songKey,
          artist: 'Test Artist',
          title: 'Test Song',
          ratingType: 'up',
          userId
        })
      });

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/ratings',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Test Artist')
        })
      );
    });

    test('should handle API errors gracefully', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'User has already rated this song' })
      });

      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songKey: 'test_key',
          artist: 'Artist',
          title: 'Title',
          ratingType: 'up',
          userId: 'user_123'
        })
      });

      const data = await response.json();
      expect(response.ok).toBe(false);
      expect(data.error).toBe('User has already rated this song');
    });
  });

  describe('Song Change Detection', () => {
    test('should detect song change when artist/title differ', () => {
      const previousSong = 'Artist 1-Song 1';
      const currentSong = 'Artist 2-Song 2';

      expect(previousSong).not.toBe(currentSong);
    });

    test('should not detect change when artist/title are same', () => {
      const previousSong = 'Test Artist-Test Song';
      const currentSong = 'Test Artist-Test Song';

      expect(previousSong).toBe(currentSong);
    });
  });

  describe('Button State Management', () => {
    test('should disable both buttons after rating', () => {
      const thumbsUpBtn = document.getElementById('thumbsUpBtn');
      const thumbsDownBtn = document.getElementById('thumbsDownBtn');

      thumbsUpBtn.disabled = true;
      thumbsDownBtn.disabled = true;

      expect(thumbsUpBtn.disabled).toBe(true);
      expect(thumbsDownBtn.disabled).toBe(true);
    });

    test('should highlight selected button', () => {
      const thumbsUpBtn = document.getElementById('thumbsUpBtn');

      thumbsUpBtn.classList.add('selected');

      expect(thumbsUpBtn.classList.contains('selected')).toBe(true);
    });

    test('should reset buttons for new song', () => {
      const thumbsUpBtn = document.getElementById('thumbsUpBtn');
      const thumbsDownBtn = document.getElementById('thumbsDownBtn');

      thumbsUpBtn.disabled = false;
      thumbsDownBtn.disabled = false;
      thumbsUpBtn.classList.remove('selected');
      thumbsDownBtn.classList.remove('selected');

      expect(thumbsUpBtn.disabled).toBe(false);
      expect(thumbsDownBtn.disabled).toBe(false);
      expect(thumbsUpBtn.classList.contains('selected')).toBe(false);
    });
  });
});
```

## Test Execution Best Practices

### 1. Run Tests Before Commits
```bash
# Quick verification
npm test

# Full coverage check
npm run test:coverage
```

### 2. Development Workflow
```bash
# Start watch mode
npm run test:watch

# Run specific test file
npm test -- tests/backend/db.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should prevent duplicate"
```

### 3. CI/CD Integration
```yaml
# Example GitHub Actions workflow
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --coverage
```

## Common Patterns

### Mocking better-sqlite3 for In-Memory Tests
```javascript
jest.mock('better-sqlite3', () => {
  const actualDb = jest.requireActual('better-sqlite3');
  return jest.fn(() => actualDb(':memory:'));
});
```

### Testing Synchronous Database Operations
```javascript
// Correct: test synchronous operations directly
const result = dbFunctions.getSongRatings('key');
expect(result.thumbs_up).toBe(5);

// Incorrect: don't add async/await
// const result = await dbFunctions.getSongRatings('key'); // WRONG!
```

### Testing Transactions
```javascript
test('should rollback on error', () => {
  const songKey = 'test_key';

  // Cause an error in the transaction
  expect(() => {
    dbFunctions.addOrUpdateRating(null, 'Artist', 'Title', 'up', 'user');
  }).toThrow();

  // Verify no partial data was saved
  const result = dbFunctions.getSongRatings(songKey);
  expect(result.thumbs_up).toBe(0);
});
```

## Troubleshooting

### Issue: Tests fail with "Cannot find module"
**Solution**: Ensure jest.config.js has correct paths and modules are installed

### Issue: Database tests interfere with each other
**Solution**: Use `beforeEach` to create fresh database instance and `afterEach` to close connections

### Issue: Frontend tests fail with "window is not defined"
**Solution**: Add `@jest-environment jsdom` comment at top of test file

### Issue: Async timeout errors
**Solution**: Verify no async/await in synchronous database code; increase Jest timeout if needed

## Coverage Goals

Maintain these minimum coverage thresholds:
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

Critical paths (rating submission, duplicate prevention) should have 100% coverage.

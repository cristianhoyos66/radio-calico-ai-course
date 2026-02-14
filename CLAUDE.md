# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Radio Calico is a web-based HLS audio stream player with real-time metadata display and song rating functionality. It streams audio from CloudFront, displays current track information, and allows users to rate songs with thumbs up/down.

## Commands

**Start the server:**
```bash
npm start
```
The server runs on http://localhost:3000 by default (configurable via PORT environment variable).

**Install dependencies:**
```bash
npm install
```

**Run tests:**
```bash
npm test                  # Run all tests
npm run test:backend      # Run backend tests only
npm run test:frontend     # Run frontend tests only
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage report
```

## Architecture

### Stack
- **Backend**: Node.js with Express 5.x
- **Database**: SQLite with better-sqlite3 (synchronous API)
- **Frontend**: Vanilla JavaScript with HLS.js for stream playback
- **Stream Source**: CloudFront HLS stream at `https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8`
- **Metadata Source**: External JSON endpoint at `https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json`

### Style Guide

**Design Assets**
- Style guide document: `RadioCalicoStyle/RadioCalico_Style_Guide.txt`
- Logo files: `RadioCalicoStyle/RadioCalicoLogoTM.png`, `RadioCalicoStyle/RadioCalicoLayout.png`

**Color Palette**
- **Mint** `#D8F2D5` - Logo circle, background fills, accents
- **Forest Green** `#1F4E23` - Logo border, primary buttons, headings
- **Teal** `#38A29D` - Headphone ear-cups, nav bar, hover states
- **Calico Orange** `#EFA63C` - Call-to-action accents
- **Charcoal** `#231F20` - Body text, icon outlines
- **Cream** `#F5EADA` - Secondary backgrounds, cards
- **White** `#FFFFFF` - Text on dark, backgrounds

**Typography**
- **Headings**: Montserrat (sans-serif), weights 500-700
- **Body**: Open Sans (sans-serif), weight 400
- **Fallback**: `"Montserrat", "Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

**UI Components**
- **Primary Buttons**: Forest Green background (#1F4E23), white text, 4px border-radius, uppercase
  - Hover: Teal background (#38A29D)
- **Secondary Buttons**: Transparent background, Forest Green border (2px), Forest Green text
  - Hover: Mint background (#D8F2D5)
- **Form Inputs**: 1px border, 4px border-radius, teal focus state with shadow
- **Audio Controls**: Circular buttons ≥40px, Charcoal icons on Cream/Mint backgrounds

**Layout**
- Max content width: 1200px (center-aligned)
- Grid: 12-column with 8px baseline
- Gutters: 24px between columns
- Vertical rhythm: Multiples of 16px for padding/margin

**Logo Usage**
- Clear space: 50% of logo diameter around all sides
- Minimum size: 40px diameter on screen
- Backgrounds: White or Mint only
- No stretching, skewing, rotating, recoloring, or effects

### Key Components

**server.js** - Express application entry point
- Serves static files from `public/` directory
- Provides REST API endpoints for song ratings
- All database operations use synchronous better-sqlite3 methods

**db.js** - Database layer
- Uses better-sqlite3's synchronous API exclusively (no async/await)
- Manages three tables: `items` (legacy), `song_ratings`, `user_ratings`
- All database functions are synchronous and use transactions for multi-step operations
- Song keys are base64-encoded artist+title combinations

**public/index.html** - Single-page frontend application
- HLS.js for stream playback (with Safari native HLS fallback)
- Polls metadata endpoint every 2 seconds to detect song changes
- Uses localStorage for persistent user identification
- Rating state management prevents duplicate votes

### Database Schema

**song_ratings**
- `song_key`: Unique identifier (base64 encoded artist|||title)
- `artist`, `title`: Track information
- `thumbs_up`, `thumbs_down`: Aggregate counts

**user_ratings**
- Tracks individual user votes
- `UNIQUE(song_key, user_id)` constraint enforces one vote per user per song
- User IDs are generated client-side and stored in localStorage

### API Endpoints

- `GET /api/ratings/:songKey` - Get rating counts for a song
- `POST /api/ratings` - Submit a new rating (validates no duplicate votes)
- `GET /api/ratings/:songKey/user/:userId` - Check if user has rated a song
- `GET /api/items`, `POST /api/items` - Legacy endpoints (unused by frontend)

## Key Behaviors

**Song Change Detection**
- Frontend polls metadatav2.json every 2 seconds
- Compares `${artist}-${title}` to detect changes
- Triggers fade animation and fetches ratings for new song

**Rating Flow**
1. User clicks thumbs up/down button
2. Frontend creates song key via `btoa(artist|||title)`
3. POST to `/api/ratings` with songKey, artist, title, ratingType, userId
4. Backend checks `user_ratings` table for existing vote (returns error if found)
5. Backend uses transaction to update `song_ratings` and insert `user_ratings` record
6. Frontend disables both buttons and highlights the selected one

**User Identification**
- User IDs are random strings stored in localStorage as `radiocalico_user_id`
- Format: `user_{random}_{timestamp}`
- No server-side user management or authentication

## File Structure

```
radiocalico/
├── server.js              # Express server + API routes
├── db.js                  # SQLite database layer (synchronous)
├── database.db            # SQLite database file (auto-created)
├── public/
│   └── index.html         # Complete frontend SPA
├── tests/
│   ├── backend/
│   │   ├── db.test.js     # Database layer tests
│   │   └── api.test.js    # API endpoint tests
│   └── frontend/
│       └── ratings.test.js # Frontend ratings logic tests
├── package.json
└── jest.config.js         # Jest configuration
```

## Testing

### Testing Framework

**Stack**
- **Test Runner**: Jest (unified for backend and frontend)
- **API Testing**: Supertest for HTTP endpoint testing
- **Frontend Testing**: jsdom for DOM environment simulation
- **Database Testing**: In-memory SQLite (`:memory:`) for isolated tests
- **Mocking**: Jest's built-in mocking for fetch and external dependencies

### Test Organization

**Backend Tests** (`tests/backend/`)
- `db.test.js` - Database layer unit tests
- `api.test.js` - API endpoint integration tests

**Frontend Tests** (`tests/frontend/`)
- `ratings.test.js` - Rating logic, song detection, localStorage handling

### Testing Principles

When creating tests, ALWAYS follow these guidelines:

1. **Backend Database Tests**
   - Use in-memory database (`:memory:`) for isolation
   - Create fresh database instance for each test suite
   - Test synchronous operations (no async/await in db.js)
   - Verify transaction integrity for multi-step operations
   - Test edge cases: duplicate votes, missing data, invalid inputs

2. **Backend API Tests**
   - Use Supertest for endpoint testing
   - Mock database layer to isolate API logic
   - Test all HTTP status codes: 200, 400, 500
   - Verify request validation (missing fields, invalid types)
   - Test error handling and error messages

3. **Frontend Tests**
   - Use jsdom for DOM environment
   - Mock fetch API calls to backend
   - Mock localStorage for user ID persistence
   - Test rating button state management
   - Test song change detection logic
   - Verify base64 encoding consistency (btoa for song keys)

4. **Test Structure**
   - Use descriptive test names: `it('should prevent duplicate votes from same user')`
   - Group related tests with `describe` blocks
   - Use `beforeEach`/`afterEach` for setup/teardown
   - Keep tests independent (no shared state between tests)

5. **Coverage Requirements**
   - Aim for >80% code coverage
   - Critical paths (rating submission) must have 100% coverage
   - Test both success and failure scenarios
   - Test boundary conditions and edge cases

### Key Test Scenarios

**Database Layer Tests (db.test.js)**
```javascript
describe('getSongRatings', () => {
  // Test: returns default values for non-existent song
  // Test: returns correct counts for existing song
})

describe('addOrUpdateRating', () => {
  // Test: creates new song record with first rating
  // Test: increments correct counter (thumbs_up vs thumbs_down)
  // Test: prevents duplicate votes from same user
  // Test: creates user_ratings record
  // Test: transaction rollback on error
})

describe('getUserRating', () => {
  // Test: returns null for user who hasn't rated
  // Test: returns correct rating type for user who has rated
})
```

**API Endpoint Tests (api.test.js)**
```javascript
describe('GET /api/ratings/:songKey', () => {
  // Test: returns 200 with rating data
  // Test: returns default values for new song
})

describe('POST /api/ratings', () => {
  // Test: returns 201 with updated ratings on success
  // Test: returns 400 when missing required fields
  // Test: returns 400 when user already rated
  // Test: returns 400 for invalid ratingType
  // Test: returns 500 on database error
})

describe('GET /api/ratings/:songKey/user/:userId', () => {
  // Test: returns hasRated: false for new user
  // Test: returns hasRated: true with rating type for existing user
})
```

**Frontend Tests (ratings.test.js)**
```javascript
describe('Rating Logic', () => {
  // Test: generates correct song key (base64 encoding)
  // Test: submits rating with correct payload
  // Test: disables buttons after rating submission
  // Test: highlights selected button
  // Test: handles API errors gracefully
})

describe('Song Change Detection', () => {
  // Test: detects song change when artist/title differ
  // Test: fetches ratings for new song
  // Test: resets rating buttons for new song
})

describe('User Identification', () => {
  // Test: generates user ID if not in localStorage
  // Test: reuses existing user ID from localStorage
  // Test: uses correct localStorage key (radiocalico_user_id)
})
```

### Test Data

**Standard Test Song**
```javascript
const TEST_SONG = {
  artist: 'Test Artist',
  title: 'Test Song',
  songKey: btoa('Test Artist|||Test Song'), // "VGVzdCBBcnRpc3R8fHxUZXN0IFNvbmc="
  userId: 'user_test_1234567890'
};
```

### Running Tests

- Tests must pass before commits
- Use watch mode during development: `npm run test:watch`
- Check coverage before submitting PRs: `npm run test:coverage`
- Backend and frontend tests can run in parallel

### Dependencies

Required dev dependencies:
```json
{
  "jest": "^29.7.0",
  "supertest": "^7.0.0",
  "jsdom": "^25.0.0",
  "@types/jest": "^29.5.0"
}
```

## Important Notes

- The database uses better-sqlite3's synchronous API - do not add async/await to database functions
- All user identification happens client-side via localStorage - there is no authentication
- The stream and metadata are hosted externally on CloudFront - this server only handles ratings
- Song keys must remain consistent between rating submission and retrieval (use the same base64 encoding)
- The `items` table is legacy/example code and not used by the radio player functionality

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
└── package.json
```

## Important Notes

- The database uses better-sqlite3's synchronous API - do not add async/await to database functions
- All user identification happens client-side via localStorage - there is no authentication
- The stream and metadata are hosted externally on CloudFront - this server only handles ratings
- Song keys must remain consistent between rating submission and retrieval (use the same base64 encoding)
- The `items` table is legacy/example code and not used by the radio player functionality

# Radio Calico™

A web-based HLS audio stream player with real-time metadata display and interactive song rating functionality.

## Features

- 🎵 **Live HLS Audio Streaming** - Plays live radio stream using HLS.js with Safari native HLS fallback
- 📻 **Real-time Metadata** - Displays current track information (artist, title, album art) updated every 2 seconds
- 👍👎 **Song Ratings** - Users can rate songs with thumbs up/down, stored persistently in SQLite
- 🎨 **Custom Brand Design** - Follows Radio Calico style guide with Mint, Forest Green, and Teal color palette
- 💾 **Persistent User IDs** - Client-side user identification via localStorage (no authentication required)

## Quick Start

### Installation

```bash
npm install
```

### Run the Server

```bash
npm start
```

The server runs on **http://localhost:3000** (configurable via `PORT` environment variable).

## Technology Stack

### Backend
- **Node.js** with Express 5.x
- **SQLite** database using better-sqlite3 (synchronous API)
- RESTful API for rating management

### Frontend
- **Vanilla JavaScript** - No frameworks
- **HLS.js** - For HLS stream playback
- Responsive design following Radio Calico style guide

### External Services
- **Stream Source**: CloudFront HLS stream (`https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8`)
- **Metadata Source**: JSON endpoint (`https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json`)

## Project Structure

```
radiocalico/
├── server.js              # Express server + API routes
├── db.js                  # SQLite database layer (synchronous)
├── database.db            # SQLite database file (auto-created)
├── public/
│   └── index.html         # Complete frontend SPA
├── RadioCalicoStyle/      # Brand assets and style guide
│   ├── RadioCalico_Style_Guide.txt
│   ├── RadioCalicoLogoTM.png
│   └── RadioCalicoLayout.png
├── package.json
└── CLAUDE.md              # Development guide for Claude Code
```

## API Endpoints

### Ratings
- `GET /api/ratings/:songKey` - Get thumbs up/down counts for a song
- `POST /api/ratings` - Submit a rating (prevents duplicate votes per user)
  ```json
  {
    "songKey": "base64_encoded_artist|||title",
    "artist": "Artist Name",
    "title": "Song Title",
    "ratingType": "up" | "down",
    "userId": "user_id_from_localstorage"
  }
  ```
- `GET /api/ratings/:songKey/user/:userId` - Check if user has already rated a song

### Legacy (Unused)
- `GET /api/items` - Get all items
- `POST /api/items` - Add new item

## Database Schema

### song_ratings
Stores aggregate rating counts for each song.
```sql
- song_key TEXT PRIMARY KEY  -- base64(artist|||title)
- artist TEXT
- title TEXT
- thumbs_up INTEGER
- thumbs_down INTEGER
```

### user_ratings
Tracks individual user votes (prevents duplicate ratings).
```sql
- song_key TEXT
- user_id TEXT
- rating_type TEXT ('up' or 'down')
- UNIQUE(song_key, user_id)
```

## How It Works

1. **Stream Playback**: Frontend loads HLS stream using HLS.js (or native Safari HLS)
2. **Metadata Polling**: Every 2 seconds, frontend fetches metadata JSON to detect song changes
3. **Song Change Detection**: When artist/title changes, UI fades and fetches ratings for new song
4. **Rating Submission**:
   - User clicks thumbs up/down
   - Frontend creates song key: `btoa(artist + "|||" + title)`
   - POST to `/api/ratings` with user ID from localStorage
   - Backend validates no duplicate vote, updates counts in transaction
   - Frontend disables buttons and highlights selected rating

## User Identification

- User IDs are randomly generated client-side: `user_{random}_{timestamp}`
- Stored in localStorage as `radiocalico_user_id`
- No server-side authentication or user management
- Enables vote tracking without requiring login

## Design System

Radio Calico follows a cohesive brand identity:

### Colors
- **Mint** `#D8F2D5` - Background accents
- **Forest Green** `#1F4E23` - Primary buttons, headings
- **Teal** `#38A29D` - Nav bar, hover states
- **Calico Orange** `#EFA63C` - Call-to-action accents
- **Charcoal** `#231F20` - Body text
- **Cream** `#F5EADA` - Secondary backgrounds

### Typography
- **Headings**: Montserrat (500-700 weight)
- **Body**: Open Sans (400 weight)

See `RadioCalicoStyle/RadioCalico_Style_Guide.txt` for complete design specifications.

## Development Notes

- Database uses **synchronous** better-sqlite3 API (no async/await in db.js)
- Song keys must use consistent base64 encoding: `btoa(artist + "|||" + title)`
- Stream and metadata are hosted externally - this server only handles ratings
- Frontend is a single-page app in `public/index.html` (all JS/CSS inline)

## License

© Radio Calico™ - All rights reserved

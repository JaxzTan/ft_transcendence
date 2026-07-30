# API List

Complete reference of all HTTP and WebSocket APIs in the project. Updated 24th Jul 2026

---

## Legend

| Icon | Meaning |
|---|---|
| 🔒 | Requires JWT in `token` cookie (set by login/register) |
| 🌐 | WebSocket event (Socket.IO) |
| 🤖 | Called by ludo-engine (backend-to-backend) |

> **Auth note:** All 🔒 endpoints authenticate via the `token` httpOnly cookie set automatically by `POST /api/auth/login` and `POST /api/auth/register`. No `Authorization: Bearer` header is used.

---

## Table of Contents

### HTTP APIs — Backend (NestJS)

1. [Auth](#1-auth) — User registration, login, logout, session check, and OAuth (Google, GitHub, 42)
   - [`POST /api/auth/register`](#post-apiauthregister) — Create a new user account
   - [`POST /api/auth/login`](#post-apiauthlogin) — Authenticate and receive JWT cookie
   - [`POST /api/auth/logout`](#post-apiauthlogout) — Clear the auth cookie
   - [`GET /api/auth/me`](#get-apiauthme) — Get current user from token
   - [`GET /api/auth/google`](#get-apiauthgoogle) — Redirect to Google OAuth
   - [`GET /api/auth/google/callback`](#get-apiauthgooglecallback) — Google OAuth callback
   - [`GET /api/auth/github`](#get-apiauthgithub) — Redirect to GitHub OAuth
   - [`GET /api/auth/github/callback`](#get-apiauthgithubcallback) — GitHub OAuth callback
   - [`GET /api/auth/42`](#get-apiauth42) — Redirect to 42 OAuth
   - [`GET /api/auth/42/callback`](#get-apiauth42callback) — 42 OAuth callback

2. [User](#2-user) — Public profiles, game history, and avatar management
   - [`GET /api/user/:username`](#get-apiuserusername) — Get public profile by username
   - [`GET /api/user/:username/games`](#get-apiuserusernamgames) — Get paginated game history
   - [`POST /api/user/avatar`](#post-apiuseravatar) — Upload avatar image
   - [`GET /api/user/:username/avatar`](#get-apiuserusernameavatar) — Retrieve avatar image
   - [`DELETE /api/user/avatar`](#delete-apiuseravatar) — Delete current user's avatar

3. [Match](#3-match) — Matchmaking, invites, PvE, and rematch
   - [`POST /api/match/pvp/random`](#post-apimatchpvprandom) — Find or create random PvP match
   - [`POST /api/match/pvp/invite`](#post-apimatchpvpinvite) — Create invite game with shareable code
   - [`POST /api/match/join/:code`](#post-apimatchjoincode) — Join PvP game by invite code
   - [`POST /api/match/pve`](#post-apimatchpve) — Start PvE (vs bot) game
   - [`POST /api/match/create`](#post-apimatchcreate) — Unified match creation (pvp/pve/hotseat)
   - [`POST /api/match/rematch/:gameId`](#post-apimatchrematchgameid) — Request rematch after game ends
   - [`POST /api/match/cleanup`](#post-apimatchcleanup) — Clean up stale match data

4. [Game Actions](#4-game-actions) — In-game lifecycle actions
   - [`POST /api/game/:id/ready`](#post-apigameidready) — Signal player ready
   - [`POST /api/game/:id/resign`](#post-apigameidresign) — Forfeit the game
   - [`POST /api/game/:id/exit`](#post-apigameidexit) — Acknowledge leaving ended game
   - [`POST /api/game/:id/abort`](#post-apigameidabort) — Cancel unstarted game
   - [`GET /api/games/active`](#get-apigamesactive) — List active games
   - [`POST /api/games/:id/spectate`](#post-apigamesidspectate) — Get spectator token for active game

5. [Game End (engine callback)](#5-game-end-engine-callback) — Backend-to-backend result submission
   - [`POST /api/game/end`](#post-apigameend) — Submit game results (called by ludo-engine)

6. [Leaderboard](#6-leaderboard) — Ranked player listings
   - [`GET /api/leaderboard`](#get-apileaderboard) — Get paginated leaderboard rankings

7. [Achievements](#7-achievements) — Achievement badges and evaluation
   - [`GET /api/achievements`](#get-apiachievements) — Get all achievement booleans
   - [`POST /api/achievements/check`](#post-apiachievementscheck) — Force re-evaluate achievements

8. [Stats](#8-stats) — Aggregate player statistics
   - [`GET /api/stats`](#get-apistats) — Get stats for current user

9. [Friends](#9-friends) — Friend request lifecycle and blocking
   - [`POST /api/friends/request/:userId`](#post-apifriendsrequestuserid) — Send friend request
   - [`POST /api/friends/accept/:requestId`](#post-apifriendsacceptrequestid) — Accept pending request
   - [`POST /api/friends/decline/:requestId`](#post-apifriendsdeclinerequestid) — Decline pending request
   - [`DELETE /api/friends/remove/:friendId`](#delete-apifriendsremovefriendid) — Remove friend
   - [`GET /api/friends`](#get-apifriends) — List friends
   - [`GET /api/friends/requests`](#get-apifriendsrequests) — List pending friend requests
   - [`POST /api/friends/block/:userId`](#post-apifriendsblockuserid) — Block a user

10. [Health](#10-health) — Database connectivity check
    - [`GET /health`](#get-health) — Health check endpoint

### WebSocket APIs — Ludo Engine

11. [Connection](#11-connection) — Socket.IO connection and authentication
    - [Authentication](#authentication) — JWT handshake auth for WebSocket

12. [Client → Server Events](#12-client--server-events-emit) — Events emitted by the client
    - [`join_game`](#join_game) — Join or create a game room
    - [`roll_dice`](#roll_dice) — Roll the dice for current turn
    - [`move_piece`](#move_piece) — Move a piece to a legal position
    - [`clash_input`](#clash_input) — Record key press during clash minigame
    - [`reconnect_clash`](#reconnect_clash) — Re-join clash after disconnect
    - [`resign`](#resign) — Forfeit the game voluntarily
    - [`rematch`](#rematch) — Vote for rematch after game ends
    - [`exit_post_game`](#exit_post_game) — Leave post-game lobby
    - [`disconnect`](#disconnect) — Handle connection loss

13. [Server → Client Events](#13-server--client-events-on) — Events received by the client
    - [`game_joined`](#game_joined) — Full game state after joining
    - [`dice_rolled`](#dice_rolled) — Dice value and legal moves
    - [`piece_moved`](#piece_moved) — Piece movement result
    - [`game_started`](#game_started) — Game transitions to active
    - [`game_ended`](#game_ended) — Game finished with winner
    - [`game_timeout`](#game_timeout) — Post-game lobby expired
    - [`game_created`](#game_created) — Rematch quorum reached
    - [`game_expired`](#game_expired) — Lobby game expired
    - [`player_exited`](#player_exited) — Player disconnected/resigned
    - [`clash_start`](#clash_start) — Clash minigame initiated
    - [`clash_frozen`](#clash_frozen) — Clash paused due to disconnect
    - [`clash_result`](#clash_result) — Clash resolved with winner
    - [`clash_press_registered`](#clash_press_registered) — Press count during clash
    - [`state_update`](#state_update) — Generic game state update
    - [`error`](#error) — Error message on invalid action

14. [End-to-End Flow](#14-end-to-end-flow) — Complete game lifecycle from login to rematch

---

## HTTP APIs — Backend (NestJS)

Base URL: `http://localhost:3000` (or `http://backend:3000` from Docker)

All endpoints return JSON. The backend runs on port 3000.

Auth is handled via an **httpOnly cookie** named `token`. It is set automatically by `POST /api/auth/register` and `POST /api/auth/login`, and cleared by `POST /api/auth/logout`. No manual `Authorization` header is needed for cookie-authenticated requests.

---

### 1. Auth

#### `POST /api/auth/register`

Create a new user account.

**Headers:** None  
**Body:**
```json
{
  "username": "string (required, min 3 chars, alphanumeric + underscore only)",
  "email": "string (optional, valid email)",
  "password": "string (required, min 8 chars, must contain letter + number)"
}
```

**Response:** Sets `token` cookie. Returns:
```json
{
  "user": {
    "id": "uuid",
    "username": "string"
  }
}
```

**Errors:** 409 if username exists, 400 if validation fails.

---

#### `POST /api/auth/login`

Authenticate and receive a JWT token in an httpOnly cookie.

**Headers:** None  
**Body:**
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

**Response:** Sets `token` cookie (7-day expiry). Returns:
```json
{
  "user": {
    "id": "uuid",
    "username": "string"
  }
}
```

**Errors:** 401 if invalid credentials.

---

#### `POST /api/auth/logout`

Clear the auth cookie.

**Headers:** None  
**Body:** None  
**Response:**
```json
{
  "ok": true
}
```

---

#### `GET /api/auth/me`

Get the currently authenticated user's profile.

**Headers:** 🔒 (requires `token` cookie)  
**Response:**
```json
{
  "user": {
    "id": "uuid",
    "username": "string"
  }
}
```

---

#### `GET /api/auth/google`

Redirect to Google OAuth consent screen.

**Headers:** None  
**Response:** 302 redirect → Google → callback → redirects to `FRONTEND_URL` with `token` cookie set.

---

#### `GET /api/auth/google/callback`

Google OAuth callback. Do not call directly.

**Headers:** None  
**Response:** 302 redirect to `FRONTEND_URL` with `token` cookie set.

---

#### `GET /api/auth/github`

Redirect to GitHub OAuth consent screen.

**Headers:** None  
**Response:** 302 redirect → GitHub → callback → redirects to `FRONTEND_URL` with `token` cookie set.

---

#### `GET /api/auth/github/callback`

GitHub OAuth callback. Do not call directly.

**Headers:** None  
**Response:** 302 redirect to `FRONTEND_URL` with `token` cookie set.

---

#### `GET /api/auth/42`

Redirect to 42 (intra) OAuth consent screen.

**Headers:** None  
**Response:** 302 redirect → 42 → callback → redirects to `FRONTEND_URL` with `token` cookie set.

---

#### `GET /api/auth/42/callback`

42 OAuth callback. Do not call directly.

**Headers:** None  
**Response:** 302 redirect to `FRONTEND_URL` with `token` cookie set.

---

### 2. User

#### `GET /api/user/:username`

Get a user's public profile.

**Headers:** None  
**Path:** `:username` = username string  
**Response:**
```json
{
  "id": "uuid",
  "username": "string",
  "avatarStyle": "string",
  "rating": 0,
  "highestRating": 0,
  "wins": 0,
  "losses": 0,
  "winStreak": 0,
  "bestWinStreak": 0,
  "botWins": 0,
  "humanWins": 0,
  "daysActive": 0,
  "loginStreak": 0,
  "createdAt": "ISO-date-string"
}
```

**Errors:** 404 if user not found.

---

#### `GET /api/user/:username/games`

Get a user's game history.

**Headers:** None  
**Path:** `:username` = username string  
**Query Params:**
| Param | Type | Default | Max |
|---|---|---|---|
| `page` | integer | `1` | — |
| `limit` | integer | `20` | `100` |

**Response:**
```json
{
  "games": [
    {
      "gameId": "uuid",
      "status": "COMPLETED | ABANDONED",
      "color": "RED | GREEN | YELLOW | BLUE",
      "rank": 1,
      "piecesCaptured": 3,
      "piecesInGoal": 4,
      "startedAt": "ISO-date-string",
      "endedAt": "ISO-date-string",
      "participants": [
        {
          "username": "string",
          "avatarStyle": "bottts",
          "color": "RED",
          "rank": 1,
          "piecesInGoal": 4
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

**Errors:** 404 if user not found.

---

### 3. Match

All match endpoints return `{ gameId, token, engineUrl }`.

- `gameId`: UUID of the new/pending match
- `token`: JWT to use when connecting to ludo-engine via Socket.IO
- `engineUrl`: WebSocket URL (`ws://ludo-engine:3001`)

To connect to the engine:
```js
const io = require('socket.io-client');
const socket = io('ws://ludo-engine:3001', {
  auth: { token: '<token-from-response>' }
});
```

---

#### `POST /api/match/pvp/random`

Find or create a random PvP match.

**Headers:** 🔒 (requires `token` cookie)  
**Body:**
```json
{
  "clashEnabled": "boolean (optional, default: true)",
  "color": "'red'|'green'|'yellow'|'blue' (optional)"
}
```

**Response:**
```json
{
  "gameId": "uuid",
  "token": "jwt-string",
  "engineUrl": "ws://ludo-engine:3001"
}
```

**Notes:**
- If a WAITING PvP game with an open slot exists, joins it immediately.
- Otherwise, creates a new WAITING game. Game stays in waiting until all players click "ready" in the engine.

---

#### `POST /api/match/pvp/invite`

Create a PvP invite game with a shareable code.

**Headers:** 🔒 (requires `token` cookie)  
**Body:**
```json
{
  "clashEnabled": "boolean (optional, default: true)",
  "color": "'red'|'green'|'yellow'|'blue' (optional)"
}
```

**Response:**
```json
{
  "gameId": "uuid",
  "inviteCode": "ABCD12",
  "token": "jwt-string",
  "engineUrl": "ws://ludo-engine:3001"
}
```

**Notes:**
- Share `inviteCode` via chat/friend list.
- Recipient joins via `POST /api/match/join/:code`.

---

#### `POST /api/match/join/:code`

Join a PvP game by invite code.

**Headers:** 🔒 (requires `token` cookie)  
**Path:** `:code` = 6-char invite code  
**Body:**
```json
{
  "color": "'red'|'green'|'yellow'|'blue' (optional)"
}
```

**Response:**
```json
{
  "gameId": "uuid",
  "token": "jwt-string",
  "engineUrl": "ws://ludo-engine:3001"
}
```

**Errors:** 404 if code not found/expired, 403 if game already started, 400 if joining own invite.

---

#### `POST /api/match/pve`

Start a PvE (vs bot) game.

**Headers:** 🔒 (requires `token` cookie)  
**Body:**
```json
{
  "playerCount": "2|4 (required)",
  "clashEnabled": "boolean (optional, default: true)",
  "color": "'red'|'green'|'yellow'|'blue' (optional)"
}
```

**Response:**
```json
{
  "gameId": "uuid",
  "token": "jwt-string",
  "engineUrl": "ws://ludo-engine:3001"
}
```

**Notes:**
- Game is `ACTIVE` immediately — no waiting for ready state.
- Bots fill remaining slots automatically.

---

#### `POST /api/match/create`

Unified match creation — supports PvP, PvE, and hotseat modes.

**Headers:** 🔒 (requires `token` cookie)  
**Body:**
```json
{
  "mode": "'pvp'|'pve'|'hotseat' (required)",
  "playerCount": "number (required)",
  "botCount": "number (optional)",
  "clashEnabled": "boolean (optional, default: true)",
  "color": "'red'|'green'|'yellow'|'blue' (optional)"
}
```

**Response:**
```json
{
  "gameId": "uuid",
  "token": "jwt-string",
  "engineUrl": "ws://ludo-engine:3001"
}
```

---

#### `POST /api/match/rematch/:gameId`

Request a rematch after game ends.

**Headers:** 🔒 (requires `token` cookie)  
**Path:** `:gameId` = original game ID  
**Response:**
```json
{
  "gameId": "uuid (new game ID)",
  "token": "jwt-string",
  "engineUrl": "ws://ludo-engine:3001"
}
```

**or (waiting for more players):**
```json
{
  "message": "Waiting for more players",
  "confirmed": 1,
  "required": 2
}
```

**Notes:**
- Minimum 2 confirmations required to start rematch.
- Uses Redis set `rematch:{gameId}` with 24h TTL.

---

#### `POST /api/match/cleanup`

Clean up old match data and expired moves.

**Headers:** 🔒 (requires `token` cookie)  
**Body:** None  
**Response:** Depends on backend implementation.

---

### 4. Game Actions

#### `POST /api/game/:id/ready`

Signal that the current player is ready.

**Headers:** 🔒 (requires `token` cookie)  
**Path:** `:id` = gameId  
**Body:** None  
**Response:**
```json
{
  "message": "Player ready",
  "gameId": "uuid"
}
```

**Notes:**
- The actual ready logic is handled by the ludo-engine via WebSocket `join_game` which auto-transitions the game from `waiting` to `active` once all players have joined.
- This endpoint exists for tracking/logging purposes.

---

#### `POST /api/game/:id/resign`

Forfeit the game.

**Headers:** 🔒 (requires `token` cookie)  
**Path:** `:id` = gameId  
**Body:** None  
**Response:**
```json
{
  "message": "Game cancelled",
  "gameId": "uuid"
}
```

---

#### `POST /api/game/:id/exit`

Acknowledge leaving the game (after game has ended).

**Headers:** 🔒 (requires `token` cookie)  
**Path:** `:id` = gameId  
**Body:** None  
**Response:**
```json
{
  "message": "Exited game",
  "gameId": "uuid"
}
```

---

#### `POST /api/game/:id/abort`

Cancel an unstarted game (while still in WAITING state).

**Headers:** 🔒 (requires `token` cookie)  
**Path:** `:id` = gameId  
**Body:** None  
**Response:**
```json
{
  "message": "Game cancelled",
  "gameId": "uuid"
}
```

**Errors:** 404 if game not found, 403 if user is not a player.

---

#### `GET /api/games/active`

List all currently active games.

**Headers:** 🔒 (requires `token` cookie)  
**Response:** Array of active game summaries.

---

#### `POST /api/games/:id/spectate`

Get a spectator JWT token for watching an active game.

**Headers:** 🔒 (requires `token` cookie)  
**Path:** `:id` = gameId  
**Body:** None  
**Response:**
```json
{
  "gameId": "uuid",
  "token": "jwt-string (role: spectator)",
  "engineUrl": "ws://ludo-engine:3001"
}
```

**Errors:** 404 if game not found, 403 if game not active.

**Connection:**
```js
const socket = io('ws://ludo-engine:3001', {
  auth: { token: '<spectator-token>' }
});
socket.emit('join_game', gameId, 'red'); // color is ignored for spectators
// spectator receives state_update broadcasts only
// cannot send: roll_dice, move_piece, clash_input, resign
```

---

### 5. Game End (engine callback)

#### `POST /api/game/end`

Called by ludo-engine when a game finishes. 🤖 Does not require JWT — authenticated via internal trust.

**Body:**
```json
{
  "gameId": "uuid",
  "participants": [
    {
      "userId": "string (or 'ludo-bot')",
      "color": "'RED'|'GREEN'|'YELLOW'|'BLUE'",
      "rank": 1,
      "piecesCaptured": 3,
      "piecesInGoal": 4
    }
  ]
}
```

**Response:**
```json
{
  "message": "Game processed",
  "gameId": "uuid"
}
```

**Errors:** 400 if `participants` missing or < 2 entries.

**Side effects:**
- Writes `game` + `game_participant` rows to Postgres
- Updates `user.rating`, `winStreak`, etc.
- Evaluates achievements for all participants
- Updates Redis `leaderboard:global` sorted set
- Deletes `match:{gameId}` from Redis

---

### 6. Leaderboard

#### `GET /api/leaderboard`

Get global leaderboard rankings.

**Headers:** 🔒 optional (if `token` cookie is present, user is highlighted)  
**Query Params:**
| Param | Type | Default | Max |
|---|---|---|---|
| `mode` | `global` \| `ranked` \| `casual` \| `bot` | `global` | — |
| `page` | integer | `1` | — |
| `limit` | integer | `20` | `100` |

**Response:**
```json
{
  "entries": [
    {
      "username": "string",
      "rating": 1500,
      "rank": 1,
      "gamesPlayed": 42,
      "wins": 30,
      "losses": 12,
      "draws": 0,
      "winRate": 71.4,
      "avatarStyle": "bottts"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20,
  "source": "postgres"
}
```

---

### 7. Achievements

#### `GET /api/achievements`

Get all achievement booleans for the current user.

**Headers:** 🔒 (requires `token` cookie)  
**Response:**
```json
{
  "achFirstBlood": false,
  "achOnFire": false,
  "achDiceMaster": false,
  "achBabySteps": false,
  "achTheDiceLoveMe": false,
  "achTactician": false,
  "achMaster": false,
  "achGrandBotMaster": false,
  "achWorldChampion": false,
  "achLoveTheMachine": false,
  "achft_Transcendence": false,
  "achUnstoppable": false,
  "achCleanSweep": false,
  "achLastLaugh": false,
  "achSpeedDemon": false
}
```

**Achievement reference:**

| Field | Display Name | Condition |
|---|---|---|
| `achFirstBlood` | First Blood | Win 1 game |
| `achOnFire` | On Fire | 3 consecutive wins |
| `achDiceMaster` | Dice Master | 50 wins |
| `achBabySteps` | Baby Steps | Win 1st game vs bots |
| `achTheDiceLoveMe` | The Dice Love Me | Win 10 games vs bots |
| `achTactician` | Tactician | 100 wins |
| `achMaster` | Master | 250 wins |
| `achGrandBotMaster` | Grand Bot Master | 500 wins |
| `achWorldChampion` | World Champion | 1000 wins |
| `achLoveTheMachine` | Love The Machine | 100 games played |
| `achft_Transcendence` | FT Transcendence | 100 wins vs humans |
| `achUnstoppable` | Unstoppable | Capture 3 pieces in a single game |
| `achCleanSweep` | Clean Sweep | Win with 4 pieces, opponents have 0 |
| `achLastLaugh` | Last Laugh | Win while all opponents have ≥1 piece |
| `achSpeedDemon` | Speed Demon | Win in under 30 minutes |

---

#### `POST /api/achievements/check`

Force re-evaluate achievements for the current user.

**Headers:** 🔒 (requires `token` cookie)  
**Body:** None  
**Response:**
```json
{
  "unlocked": ["First Blood"]
}
```

The `unlocked` array contains the display names of any achievements newly unlocked by this evaluation.

---

### 8. Stats

#### `GET /api/stats`

Get player statistics for the current user.

**Headers:** 🔒 (requires `token` cookie)  
**Response:**
```json
{
  "totalGames": 42,
  "wins": 20,
  "losses": 22,
  "totalCaptures": 85,
  "totalPiecesInGoal": 168,
  "avgCapturesPerGame": 2.0
}
```

---

### 9. Friends

All friend endpoints require JWT auth via cookie.

#### `POST /api/friends/request/:userId`

Send a friend request.

**Headers:** 🔒 (requires `token` cookie)  
**Path:** `:userId` = target user ID  
**Body:** None  
**Response:** Returns the full friendship object with user and friend details.

**Errors:** 400 if already friends, request pending, or blocked; 403 if blocked by target; 404 if target user not found.

---

#### `POST /api/friends/accept/:requestId`

Accept a friend request.

**Headers:** 🔒 (requires `token` cookie)  
**Path:** `:requestId` = request UUID  
**Body:** None  
**Response:** Returns the updated friendship object with user and friend details.

**Errors:** 404 if request not found, 403 if not addressed to current user.

---

#### `POST /api/friends/decline/:requestId`

Decline a friend request.

**Headers:** 🔒 (requires `token` cookie)  
**Path:** `:requestId` = request UUID  
**Body:** None  
**Response:** `{ "message": "Friend request declined" }`

**Errors:** 404 if request not found.

---

#### `DELETE /api/friends/remove/:friendId`

Remove a friend.

**Headers:** 🔒 (requires `token` cookie)  
**Path:** `:friendId` = friend's user ID  
**Body:** None  
**Response:** `{ "message": "Friend removed" }`

---

#### `GET /api/friends`

Get the current user's friends list.

**Headers:** 🔒 (requires `token` cookie)  
**Response:**
```json
[
  {
    "id": "user-id",
    "username": "string",
    "avatarStyle": "bottts",
    "rating": 1200,
    "friendsSince": "ISO-date-string"
  }
]
```

---

#### `GET /api/friends/requests`

Get pending friend requests (both sent and received).

**Headers:** 🔒 (requires `token` cookie)  
**Response:**
```json
{
  "sent": [
    {
      "id": "request-uuid",
      "userId": "friend-user-id",
      "username": "string",
      "avatarStyle": "bottts",
      "createdAt": "ISO-date-string"
    }
  ],
  "received": [
    {
      "id": "request-uuid",
      "userId": "sender-user-id",
      "username": "string",
      "avatarStyle": "bottts",
      "createdAt": "ISO-date-string"
    }
  ]
}
```

---

#### `POST /api/friends/block/:userId`

Block a user.

**Headers:** 🔒 (requires `token` cookie)  
**Path:** `:userId` = user ID to block  
**Body:** None  
**Response:** Returns the blocked friendship object with user and friend details.

---

### 10. Health

#### `GET /health`

Simple health check that verifies database connectivity.

**Headers:** None  
**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-07-23T10:14:51.664Z"
}
```

On DB error:
```json
{
  "status": "error",
  "timestamp": "2026-07-23T10:14:51.664Z"
}
```

---

## WebSocket APIs — Ludo Engine

### 11. Connection

Base URL: `ws://localhost:3001` (or `ws://ludo-engine:3001` from Docker)

Connection requires JWT in handshake auth:
```js
const socket = io('ws://ludo-engine:3001', {
  auth: { token: '<token-from-match-endpoint>' }
});
```

JWT payload structure:
```json
{
  "gameId": "uuid",
  "sub": "user-id",
  "userId": "user-id",
  "role": "player1" | "player" | "spectator",
  "clashEnabled": true,
  "color": "red"
}
```

**Health endpoint on the engine:** `GET http://localhost:3001/health` returns `{ "status": "ok", "uptime": 12345.67 }`.

---

### 12. Client → Server Events (emit)

#### `join_game`

Join or create a game room. If all players have joined, transitions game from `waiting` to `active` automatically.

```js
socket.emit('join_game', gameId, playerColor, userId?);
```

| Param | Type | Notes |
|---|---|---|
| `gameId` | string | Match UUID |
| `playerColor` | `'red'` \| `'green'` \| `'yellow'` \| `'blue'` | Your chosen color |
| `userId` | string | (optional) Override for bots |

**Response:** `game_joined` event with full `GameState`

**Errors:** `error` event with message.

---

#### `roll_dice`

Roll the dice for the current turn. Rejected if it is not your turn.

```js
socket.emit('roll_dice');
```

**Response:** `dice_rolled` event (broadcast to all in room)

**Errors:** `error` if not your turn, wrong phase, or player exited.

---

#### `move_piece`

Move a piece using a legal pieceId.

```js
socket.emit('move_piece', pieceId);
```

| Param | Type | Notes |
|---|---|---|
| `pieceId` | string | e.g. `"red-0"` |

**Response:** `piece_moved` event (broadcast to all in room)

**Errors:** `error` if piece not in current legal moves.

---

#### `clash_input`

Record a key press during a clash minigame. The first player to hit **42 presses** wins instantly. If neither reaches 42 within 5 seconds, the player with more presses wins.

```js
socket.emit('clash_input', key);
```

| Param | Type | Notes |
|---|---|---|
| `key` | string | Attacker uses one of: `u`, `i`, `o`, `h`, `j`, `k`, `b`, `n`, `m`; Defender uses one of: `q`, `w`, `e`, `a`, `s`, `d`, `z`, `x`, `c` |

**Response:** `clash_press_registered` event (to sender only), or `clash_result` if the player hits 42 presses and wins early.

**Errors:** Silently ignored if no clash active or wrong key.

---

#### `reconnect_clash`

Re-join a clash after disconnect (within grace period).

```js
socket.emit('reconnect_clash');
```

**Response:** None (clash state restored)

---

#### `resign`

Forfeit the game voluntarily.

```js
socket.emit('resign');
```

**Response:** `player_exited` event (broadcast to all)

---

#### `rematch`

Vote for a rematch after the game has ended. At least 2 player votes are required to trigger a rematch.

```js
socket.emit('rematch');
```

**Response:** `game_created` event with new `gameId` (broadcast when quorum reached), or `game_timeout` if insufficient votes.

---

#### `exit_post_game`

Acknowledge the end of a game and leave the post-game lobby. Removes rematch vote if present.

```js
socket.emit('exit_post_game');
```

**Response:** None — socket leaves the post-game state. May trigger `game_timeout` if quorum is broken.

---

#### `disconnect`

Automatically handled when the WebSocket connection drops. Marks player as disconnected, freezes any active clash, and broadcasts `player_exited` after a timeout.

```js
// Socket.IO handles this automatically on connection loss
```

**Response:** `player_exited` event (broadcast to room), `clash_frozen` if clash was active.

---

### 13. Server → Client Events (on)

| Event | Payload | When |
|---|---|---|
| `game_joined` | `GameState` (full state) | After `join_game` |
| `dice_rolled` | `{ value, legalMoves, bonusRoll }` | After dice rolled |
| `piece_moved` | `MoveResult` | After piece moved |
| `game_started` | `{ gameId }` | Game transitions from waiting → active |
| `game_ended` | `{ winner, resultDetail }` | Game finished |
| `game_timeout` | none | Post-game lobby expired (60s) or rematch quorum broken |
| `game_created` | `newGameId` (string) | Rematch quorum reached — broadcast to new game room |
| `game_expired` | none | Lobby game expired (1 hour inactivity) |
| `player_exited` | `{ color }` | Player disconnected/resigned |
| `clash_start` | `{ attackerKey, defenderKey, target, duration, attacker, defender }` | Clash initiated — attacker uses `attackerKey`, defender uses `defenderKey` |
| `clash_frozen` | `{ reason, disconnectedPlayer, reconnectDeadline }` | Player disconnected during clash |
| `clash_result` | `{ winner, loser, winnerPresses, loserPresses }` | Clash resolved |
| `clash_press_registered` | `number` (press count) | After valid `clash_input` |
| `state_update` | `any` (parsed JSON) | Generic catch-all for any Redis pub/sub message |
| `error` | `string` | On invalid action |

---

### 14. End-to-End Flow

```
1. POST /api/auth/login
   → { user: { id, username } }
   ← Set-Cookie: token=<jwt> (httpOnly)

2. POST /api/match/pvp/random (or /pve, /invite, /create)
   → { gameId, token, engineUrl }

3. Connect to engine:
   io(engineUrl, { auth: { token } })

4. socket.emit('join_game', gameId, 'red')
   ← socket.on('game_joined', state)

5. Play game:
   socket.emit('roll_dice')
   ← socket.on('dice_rolled', {...})
   socket.emit('move_piece', 'red-0')
   ← socket.on('piece_moved', {...})
   (clash events may occur during gameplay)

6. Game end:
   ← socket.on('game_ended', {...})
   (engine calls POST /api/game/end automatically)

7. Post-game:
   socket.emit('rematch')          // vote for rematch
   socket.emit('exit_post_game')   // leave lobby (no rematch)
   ← socket.on('game_timeout')     // lobby expired
   ← socket.on('game_created')     // rematch started
```

---

## Notes

- **Auth:** All 🔒 endpoints use an httpOnly cookie named `token`. Set automatically by login/register, cleared by logout. No `Authorization: Bearer` header is used.
- **JWT expiration:** 7 days for auth tokens, 24 hours for match tokens. If a game lasts longer, re-authenticate.
- **Spectator tokens:** `playerId` is `null`, `role` is `'spectator'`.
- **Bot tokens:** `playerId` is `'ludo-bot'`, `role` is `'player'` / `'player1'`.
- **CORS:** Backend allows all origins by default in development.
- **Rate limiting:** Auth endpoints (`register`, `login`) have throttler guard enabled.
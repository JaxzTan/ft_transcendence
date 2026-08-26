*This project has been created as part of the 42 curriculum by chtan, bleow, liyu-her, hang, jow.*

# ft_transcendence

## Description

A browser-based multiplayer Ludo platform. Players register or sign in through an external
provider, join a lobby, and play server-authoritative matches against remote opponents, a
local hotseat partner, or an AI. Results feed a persistent profile, a leaderboard, and an
achievement system, and the whole interface is available in multiple languages.

### Key features

- **Server-authoritative Ludo** — dice rolls, turn order, captures, safe squares and home
  entry are all resolved on the server; the client renders, it does not decide
- **Match formats** — 2-seat duel, 4-seat classic, local hotseat, and an AI opponent
- **Real-time play** — WebSocket transport with live board updates, presence, and reconnect
- **User management** — profiles, avatars, friends, live online status
- **Authentication** — local accounts, OAuth 2.0 sign-in, and two-factor authentication
- **Progression** — match history, statistics, leaderboard, and achievements
- **Multilingual UI**
- **Notifications, file upload, game customization, and extended browser support**

## Instructions

### Prerequisites

- **Docker** and **Docker Compose** (the only runtime requirement).
- **make** (to use the provided build commands).
- A restored `secrets/` directory (see [Secrets](#secrets) below). The stack refuses to start if a required secret file is missing.
- OAuth client IDs and secrets for Google, GitHub, and 42 — **optional**. Local sign-up and login work without them.
- At least one free port: `8443` (HTTPS). Ports `3000`, `3001`, `5432`, `5555`, `6479` are used inside/for debugging.


### Secrets

The project stores configuration in plain-text files under `secrets/`, one value per file, named after the variable in lowercase (for example `JWT_SECRET` → `secrets/jwt_secret.txt`). The directory is mounted read-only into the containers. **Never commit this folder to git** (it is already ignored).

- `make secrets` generates and seeds everything that can be derived.
- OAuth credentials must be obtained from the provider consoles (Google Cloud, GitHub, 42 intra) and placed manually.

### Running

```bash
git clone https://github.com/JaxzTan/ft_transcendence.git
cd ft_transcendence
make
```

Then open the app in your browser.

## Team Information

| Login | Role(s) | Responsibilities |
|---|---|---|
| `chtan` | Product Owner, Developer | Product vision, backlog and feature priorities, validating completed work, stakeholder communication — plus feature development |
| `bleow` | Tech Lead, Developer | Technical architecture, stack decisions, code quality and review of critical changes — plus feature development |
| `liyu-her` | Project Manager, Developer | Planning sessions, progress and deadline tracking, risk and blocker management — plus feature development |
| `hang` | Developer | Feature implementation, code review, testing, documentation |
| `jow` | Project Manager, Developer | Planning sessions, progress and deadline tracking, risk and blocker management — plus feature development |

## Project Management

- **Tools** — Discord and Lark for coordination and task tracking
- **Communication** — Discord for day-to-day, plus in-person working sessions on campus

## Technical Stack

### Frontend

| Technology | Purpose |
|---|---|
| React | Component model, routing, client state |
| Tailwind CSS | Styling |
| Socket.IO client | Real-time transport |

### Backend

| Technology | Purpose |
|---|---|
| NestJS | HTTP API, dependency injection, module structure |
| Socket.IO | WebSocket gateway and room fan-out |
| Prisma | ORM, schema and migrations |
| nginx | Reverse proxy and TLS termination |

### Data

| Technology | Purpose |
|---|---|
| PostgreSQL | Durable data — users, friendships, match history, achievements |
| Redis | Live game state — board, dice, turn pointer, matchmaking queue, presence |

### Justification for major technical choices

**Why Redis alongside it.** A running match is high-frequency, short-lived state — board
position, current dice value, whose turn it is, who is queued for matchmaking. Writing that
to Postgres on every move would put transactional write load on the database for data that
becomes worthless the moment the game ends. Redis holds it in memory; only the durable
outcome — result, opponents, duration, rating delta — is written to Postgres. Redis also
backs the Socket.IO adapter so broadcasts reach every client regardless of which backend
instance holds the socket.

**Why a server-authoritative game loop.** The client never decides a dice value or validates
a move. Every action is a request the server accepts or rejects against its own copy of the
board, which is what makes the multiplayer and remote-player modules defensible rather than
merely functional.

## Database Schema

![Database schema](frontend/public/schema.png)

## Modules

### Major modules

| # | Module | Owner | How it was implemented |
|---|---|---|---|
| 1 | Framework for frontend and backend | `chtan` | React on the client, NestJS on the server — framework routing, state and dependency injection rather than hand-rolled equivalents |
| 2 | Real-time features | `bleow` | Socket.IO gateway with a Redis adapter for cross-instance broadcast; live board updates, presence, and reconnect |
| 3 | Standard user management | `hang` | Profiles, avatar upload, friend requests, live online status |
| 4 | AI opponent | `bleow` | Heuristic move selection — no external model, no black-box library |
| 5 | Web-based game | `bleow` | Server-authoritative Ludo: dice RNG, turn order, captures, safe squares and exact-count home entry all resolved server-side |
| 6 | Remote players | `chtan` | Two players on separate machines over the network, with reconnect inside a grace window |
| 7 | Multiplayer, more than two players | `chtan` | Four concurrent seats with server-enforced turn order and seat identity derived from the session |

### Minor modules

| # | Module | Owner | How it was implemented |
|---|---|---|---|
| 1 | ORM | `jow` | Prisma — schema, relations and committed migration history |
| 2 | Multiple languages | `liyu-her` | Session-based language switching across English, Malay and French |
| 3 | Game statistics and match history | `bleow` | Wins, losses, rating and leaderboard, reconciled against match records |
| 4 | Remote authentication | `jow` | OAuth 2.0 sign-in via Google, GitHub, and 42 Intra |
| 5 | Two-factor authentication | `jow` | |
| 6 | Gamification | `bleow` | Achievements, badges and leaderboards |
| 7 | User activity analytics | `chtan` | Insights dashboard |
| 8 | Notification system | `hang` | Notifications on create, update and delete actions |
| 9 | File upload and management | `liyu-her` | Validation, secure storage, preview and delete |
| 10 | Game customization options | `liyu-her` | Power-ups, maps and settings |
| 11 | Custom minor module | `chtan` | Ngrok tunneling for exposing the local stack for remote testing |
| 12 | Additional browser support | All | Verified on Chrome, Firefox and Brave |

## Individual Contributions

### `chtan`
- **Built:**
- **Challenges:**

### `bleow`
- **Built:**
- **Challenges:**

### `liyu-her`
- **Built:**
- **Challenges:**

### `hang`
- **Built:**
- **Challenges:**

### `jow`
- **Built:**
- **Challenges:**

## Resources

- NestJS documentation
- React documentation
- Prisma documentation
- Socket.IO documentation

### Use of AI

The team used **Claude** and **ChatGPT** during development, in the following areas:

- **Test planning** — deriving an evaluation test plan from the module list, then structuring
  it into per-module test cases and tracking execution against it.
- **Debugging** — narrowing down defects.
- **UI and styling**.

No AI tool was used to generate a complete module or feature end to end; all generated
material was reviewed and adapted by the team member responsible for that area.

## Known Limitations

None outstanding at submission.
*This project has been created as part of the 42 curriculum by chtan, bleow, liyu-her, hang, jow.*

# ft_transcendence

<!-- TODO: the subject asks for "a clear name for the project". "ft_transcendence" is the
     assignment name, not a product name. Consider a real title here and keep
     ft_transcendence as a subtitle. -->

## Description

<!-- TODO: one paragraph — what this is and who it's for. Draft below, rewrite freely. -->

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
- **Multilingual UI** <!-- TODO: name the locales that actually ship -->
- **Notifications, file upload, game customization, and extended browser support**

## Instructions

### Prerequisites

<!-- TODO: fill in real versions. "Docker" is not a prerequisite; "Docker Engine 24+" is.
     Check with: docker -v, docker compose version, node -v, make -v -->

| Requirement | Version |
|---|---|
| Docker Engine | TODO |
| Docker Compose | TODO |
| GNU Make | TODO |

### Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Fill in the required values:

<!-- TODO: list every variable in .env.example with a one-line description.
     Expected groups based on the module set:
       - Database:  POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, DATABASE_URL
       - Cache:     REDIS_URL
       - Auth:      JWT_SECRET, JWT_EXPIRES_IN
       - OAuth:     GOOGLE_CLIENT_ID / SECRET, GITHUB_CLIENT_ID / SECRET, FT_CLIENT_ID / SECRET
       - 2FA mail:  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
     Confirm against the actual file before submission. -->

### Running

```bash
git clone <TODO: repository URL>
cd ft_transcendence
cp .env.example .env      # then fill in the values above
make
```

Then open <!-- TODO: the URL, e.g. https://localhost:8443 --> in your browser.

<!-- TODO: if `make` wraps something other than `docker compose up --build`, say what it
     does. Evaluators will want to see a single command bring the whole stack up. -->

## Team Information

| Member | Login | Role(s) | Responsibilities |
|---|---|---|---|
| TODO | `chtan` | Product Owner, Developer | Product vision, backlog and feature priorities, validating completed work, stakeholder communication — plus feature development |
| TODO | `bleow` | Tech Lead, Developer | Technical architecture, stack decisions, code quality and review of critical changes — plus feature development |
| TODO | `liyu-her` | Project Manager, Developer | Planning sessions, progress and deadline tracking, risk and blocker management — plus feature development |
| TODO | `hang` | Developer | Feature implementation, code review, testing, documentation |
| TODO | `jow` | Project Manager, Developer | Planning sessions, progress and deadline tracking, risk and blocker management — plus feature development |

<!-- TODO: replace the name column. Every login above needs a real name. -->

## Project Management

- **Work split** — <!-- TODO: how the fourteen-plus modules were divided across the five of
     you. The module plan below is written as a two-way "Student 1 / Student 2" split, which
     doesn't match a five-person team; reconcile it. -->
- **Tools** — Discord and Lark for coordination and task tracking
- **Communication** — Discord for day-to-day, plus in-person working sessions on campus
- **Cadence** — <!-- TODO: how often you met, and what a typical sync covered -->

## Technical Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | TODO | Component model, routing, client state |
| Tailwind CSS | TODO | Styling |
| Socket.IO client | TODO | Real-time transport |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| NestJS | TODO | HTTP API, dependency injection, module structure |
| Socket.IO | TODO | WebSocket gateway and room fan-out |
| Prisma | TODO | ORM, schema and migrations |
| nginx | TODO | Reverse proxy and TLS termination |

### Data

| Technology | Version | Purpose |
|---|---|---|
| PostgreSQL | TODO | Durable data — users, friendships, match history, achievements |
| Redis | TODO | Live game state — board, dice, turn pointer, matchmaking queue, presence |

<!-- TODO: add anything significant that's missing — auth libraries, i18n libraries,
     validation, mailer, testing tools. -->

### Justification for major technical choices

**Why PostgreSQL.** <!-- TODO: the subject explicitly asks why this database was chosen.
     Points worth making: the domain is relational (users, friendships, matches, achievements
     all reference each other), foreign keys and transactions matter for match results and
     rating updates, and Prisma's Postgres support is first-class. -->

**Why Redis alongside it.** A running match is high-frequency, short-lived state — board
position, current dice value, whose turn it is, who is queued for matchmaking. Writing that
to Postgres on every move would put transactional write load on the database for data that
becomes worthless the moment the game ends. Redis holds it in memory; only the durable
outcome — result, opponents, duration, rating delta — is written to Postgres. Redis also
backs the Socket.IO adapter so broadcasts reach every client regardless of which backend
instance holds the socket.

**Why NestJS and React.** <!-- TODO -->

**Why a server-authoritative game loop.** The client never decides a dice value or validates
a move. Every action is a request the server accepts or rejects against its own copy of the
board, which is what makes the multiplayer and remote-player modules defensible rather than
merely functional.

## Database Schema

<!-- TODO: the subject asks for a visual representation. Export the ERD from dbdiagram.io as
     PNG, commit it under docs/, and embed it here:
     ![Database schema](docs/schema.png) -->

| Table | Purpose | Key fields | Relations |
|---|---|---|---|
| TODO | | | |

<!-- TODO: also note any deliberate design trade-offs — for example denormalised aggregate
     statistics on the user record, kept for read performance on the leaderboard at the cost
     of write complexity. Evaluators reward a justified trade-off far more than a silent one. -->

## Features List

| Feature | Owner | Description |
|---|---|---|
| TODO | | |

<!-- TODO: one row per implemented feature, with the login of whoever built it. -->

## Modules

**Total: 26 points** — required minimum: 14. Major = 2 points, Minor = 1 point.

<!-- TODO: see the note at the end of this file about how points above the minimum are
     counted. Confirm this figure is how you want to present it. -->

### Major modules — 7 × 2 = 14 points

| # | Module | Owner | How it was implemented | Why chosen |
|---|---|---|---|---|
| 1 | Framework for frontend and backend | TODO | React on the client, NestJS on the server — framework routing, state and dependency injection rather than hand-rolled equivalents | TODO |
| 2 | Real-time features | TODO | Socket.IO gateway with a Redis adapter for cross-instance broadcast; live board updates, presence, and reconnect | TODO |
| 3 | Standard user management | TODO | Profiles, avatar upload, friend requests, live online status | TODO |
| 4 | AI opponent | TODO | Heuristic move selection — no external model, no black-box library | TODO |
| 5 | Web-based game | TODO | Server-authoritative Ludo: dice RNG, turn order, captures, safe squares and exact-count home entry all resolved server-side | TODO |
| 6 | Remote players | TODO | Two players on separate machines over the network, with reconnect inside a grace window | TODO |
| 7 | Multiplayer, more than two players | TODO | Four concurrent seats with server-enforced turn order and seat identity derived from the session | TODO |

### Minor modules — 12 × 1 = 12 points

| # | Module | Owner | How it was implemented | Why chosen |
|---|---|---|---|---|
| 1 | ORM | TODO | Prisma — schema, relations and committed migration history | TODO |
| 2 | Multiple languages | TODO | TODO — name the three-plus locales | TODO |
| 3 | Game statistics and match history | TODO | Wins, losses, rating and leaderboard, reconciled against match records | TODO |
| 4 | Remote authentication | TODO | OAuth 2.0 — TODO: name the providers | TODO |
| 5 | Two-factor authentication | TODO | TODO — name the delivery method | TODO |
| 6 | Gamification | TODO | Achievements, badges and leaderboards — TODO: name the three-plus mechanics | TODO |
| 7 | User activity analytics | TODO | Insights dashboard | TODO |
| 8 | Notification system | TODO | Notifications on create, update and delete actions | TODO |
| 9 | File upload and management | TODO | Validation, secure storage, preview and delete | TODO |
| 10 | Game customization options | TODO | Power-ups, maps and settings | TODO |
| 11 | Custom minor module | TODO | TODO | TODO — see below |
| 12 | Additional browser support | TODO | TODO — name the two-plus additional browsers | TODO |

<!-- TODO: module 11 is a "module of choice". Chapter IV.10 requires a justification in this
     README covering: why you chose it, what technical challenge it addresses, how it adds
     value to the project, and why it merits minor status. Without that, it can be rejected. -->

## Individual Contributions

### `chtan`
- **Built:** TODO
- **Challenges:** TODO

### `bleow`
- **Built:** TODO
- **Challenges:** TODO

### `liyu-her`
- **Built:** TODO
- **Challenges:** TODO

### `hang`
- **Built:** TODO
- **Challenges:** TODO

### `jow`
- **Built:** TODO
- **Challenges:** TODO

<!-- TODO: the subject asks specifically for challenges faced and how they were overcome.
     Candidates from this build: keeping four seats consistent when a player drops mid-turn;
     splitting live board state into Redis so a restart can't corrupt match history;
     validating Ludo lap geometry symmetrically across all four colours. -->

## Resources

<!-- TODO: list the documentation, articles and tutorials the team actually used. -->

- NestJS documentation
- React documentation
- Prisma documentation
- Socket.IO documentation

### Use of AI

The team used **Claude** and **ChatGPT** during development, in the following areas:

- **Test planning** — deriving an evaluation test plan from the module list, then structuring
  it into per-module test cases and tracking execution against it.
- **Debugging** — narrowing down defects in <!-- TODO: name the areas, e.g. the WebSocket
  reconnect path, the Ludo path geometry, the achievement threshold logic -->.
- **UI and styling** — <!-- TODO: name what, e.g. component layout, Tailwind class structure,
  responsive behaviour of the board -->.

No AI tool was used to generate a complete module or feature end to end; all generated
material was reviewed and adapted by the team member responsible for that area.

<!-- TODO: if AI also helped draft project documentation — including this README — add
     "documentation" to the list above. The subject grades honesty here. -->

## Known Limitations

<!-- TODO: currently declared as none. See the note below before you finalise this. -->

None outstanding at submission.
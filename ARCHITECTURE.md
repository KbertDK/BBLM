# Blood Bowl League Manager — Architecture Document

> This document describes the full architecture of the BBLM application. It is intended to give another agent enough detail to rebuild or extend the system without reading source code.

---

## 1. Overview

**Blood Bowl League Manager (BBLM)** is a full-stack web application for running Blood Bowl tabletop sports leagues. It covers team management, match scheduling, standings, race/player masterdata, and administrative tools, all themed around the grimdark Blood Bowl universe.

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, React 19) |
| Language | TypeScript 5.6 (strict) |
| Styling | Tailwind CSS 3.4 with custom Blood Bowl theme |
| ORM | Prisma 5.22 |
| Database | PostgreSQL |
| Auth | JWT (jose), bcryptjs password hashing |
| Fonts | Cinzel (headings), Inter (body) |

---

## 2. Environment Variables

```
DATABASE_URL=postgresql://user:password@host:port/dbname
AUTH_SECRET=<random 32+ character string for JWT signing>
```

---

## 3. Database Schema

### 3.1 Enums

```prisma
enum CoachRole      { ADMIN COMMISH COACH }
enum LeagueStatus   { READY ACTIVE ENDED }
enum GameType       { BLOOD_BOWL DUNGEON_BOWL BB7 }
enum RuleSetStatus  { ACTIVE INACTIVE }
enum SkillCategory  { G A P S M E }   // General/Agility/Passing/Strength/Mutation/Extraordinary
enum PlayerStatus   { ACTIVE MNG DEAD SACKED }
enum MatchStatus    { SCHEDULED LIVE COMPLETED }
```

### 3.2 Models

#### RuleSet
League ruleset configuration.

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| name | String | e.g. "Standard BB2024" |
| startIncome | Int | Initial gold (e.g. 1,000,000) |
| gameType | GameType enum | BLOOD_BOWL / DUNGEON_BOWL / BB7 |
| status | RuleSetStatus | ACTIVE / INACTIVE |
| numberOfPlayers | Int (default 16) | Max squad size |
| pointsWin | Int (default 3) | League points for a win |
| pointsDraw | Int (default 1) | League points for a draw |
| pointsLoss | Int (default 0) | League points for a loss |
| createdAt | DateTime | Auto |
| **leagues** | League[] | Relation |

#### League
Top-level container for a league season.

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| name | String | e.g. "Reikland Rumble League" |
| season | Int | Season number |
| isHidden | Boolean (false) | Visibility toggle |
| status | LeagueStatus | READY / ACTIVE / ENDED |
| ruleSetId | String? | FK → RuleSet (nullable) |
| createdAt | DateTime | Auto |
| **divisions** | Division[] | Relation |
| **matches** | Match[] | Relation |
| **teams** | Team[] | Relation |
| **primaryCoaches** | Coach[] | Coaches with this as primary league |
| **ruleSet** | RuleSet? | Relation |

#### Division
Sub-group within a league for standings and tournament organisation.

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| name | String | e.g. "Champions Division" |
| leagueId | String | FK → League |
| isHidden | Boolean (false) | |
| createdAt | DateTime | Auto |
| **league** | League | Relation |
| **teams** | Team[] | Relation |
| **tournaments** | Tournament[] | M2M |

#### Tournament
Groups matches within or across divisions.

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| name | String | e.g. "Summer Smash" |
| crossDivision | Boolean (false) | Can span multiple divisions |
| createdAt | DateTime | Auto |
| **divisions** | Division[] | M2M |
| **matches** | Match[] | Relation |

#### Coach
A user account. One coach can own multiple teams.

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| name | String | Full name (private) |
| email | String (unique) | Login credential |
| passwordHash | String? | bcrypt hash; null = admin-managed |
| role | CoachRole | ADMIN / COMMISH / COACH |
| isActive | Boolean (true) | Account enabled flag |
| alias | String? (unique) | Public display name |
| address, city, zip, phone | String? | Contact info |
| primaryLeagueId | String? | FK → League (SetNull on delete) |
| createdAt | DateTime | Auto |
| **teams** | Team[] | Relation |
| **newsPost** | NewsPost[] | Relation |
| **primaryLeague** | League? | Relation |

#### Race
Playable faction (Orcs, High Elves, Undead, etc.).

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| name | String (unique) | Race name |
| rosterSource | String | e.g. "CRP/LRB6 core" |
| rerollPrice | Int | Cost per reroll in gp |
| hasApothecary | Boolean | Can hire an apothecary |
| tier | String (default "1") | Power tier: 1 / 1.5 / 2 / 3 |
| tierDescription | String? | Explanatory text |
| **playerTypes** | PlayerType[] | Relation |
| **teams** | Team[] | Relation |
| **mdStarPlayers** | MdStarPlayer[] | M2M via "StarPlayerToRace" |

#### PlayerType
Position template within a race (Lineman, Blitzer, Catcher, etc.).

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| raceId | String | FK → Race |
| name | String | Position name |
| cost | Int | Gold cost to hire |
| maxCount | Int | Max roster slots for this position |
| isJourneyman | Boolean (false) | Auto-hired when squad below minimum |
| ma, st, ag, av | Int | Movement / Strength / Agility / Armour |
| skillRollNormal | String | e.g. "3+" |
| skillRollDouble | String | e.g. "5+" |
| **race** | Race | Relation |
| **startingSkills** | Skill[] | M2M |
| **teamPlayers** | TeamPlayer[] | Relation |
| **matchMercs** | MatchMerc[] | Relation |

#### Skill
Individual skill or ability (Block, Dodge, Catch, etc.).

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| skillId | Int (unique) | Rulebook reference ID |
| name | String (unique) | e.g. "Block" |
| category | SkillCategory | G / A / P / S / M / E |
| skillRule | String | Rule text |
| **playerTypes** | PlayerType[] | M2M |
| **mdStarPlayers** | MdStarPlayer[] | M2M via "StarPlayerToSkill" |

#### Team
A league team owned by a coach.

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| name | String | Team name |
| raceId | String | FK → Race |
| coachId | String | FK → Coach |
| leagueId | String | FK → League |
| divisionId | String? | FK → Division (nullable) |
| wins, losses, draws | Int (0) | Match record |
| createdAt | DateTime | Auto |
| apothecary | Int | 0 or 1 |
| assistantCoaches | Int | Count |
| cheerleaders | Int | Count |
| fanFactor | Int | Fan factor rating |
| rerolls | Int | Reroll count |
| treasury | Int (0) | Gold balance |
| isActive | Boolean (true) | Shown in standings |
| **race** | Race | Relation |
| **coach** | Coach | Relation |
| **league** | League | Relation |
| **division** | Division? | Relation |
| **players** | TeamPlayer[] | Relation |
| **homeMatches** | Match[] | Relation |
| **awayMatches** | Match[] | Relation |

#### TeamPlayer
An individual player on a team roster.

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| teamId | String | FK → Team (Cascade delete) |
| playerTypeId | String | FK → PlayerType |
| number | Int | Jersey number 1–99, unique per team |
| name | String? | Custom player name |
| status | PlayerStatus | ACTIVE / MNG / SACKED / DEAD |
| touchdowns, completePasses, interceptions, casualties, mvp | Int | Career stats |
| ssp | Int | Career Star Player Points |
| niggling | String (default "") | Injury description |
| value | Int (0) | Custom value override (0 = use playerType.cost) |
| teamGamesAtSack | Int? | Used for reinstatement window |
| createdAt | DateTime | Auto |
| **playerType** | PlayerType | Relation |
| **team** | Team | Relation |

#### Match
A scheduled league game.

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| leagueId | String | FK → League |
| homeTeamId, awayTeamId | String | FK → Team |
| tournamentId | String? | FK → Tournament (nullable) |
| round | Int | Gameday round number |
| status | MatchStatus | SCHEDULED / LIVE / COMPLETED |
| scheduledAt | DateTime? | Kickoff time |
| homeScore, awayScore | Int? | Score (null until completed) |
| homeTeamValue, awayTeamValue | Int? | Pre-match team value snapshot |
| homeTeamFanFactor, awayTeamFanFactor | Int? | Pre-match fan factor snapshot |
| createdAt | DateTime | Auto |
| **homeTeam, awayTeam** | Team | Relations |
| **league** | League | Relation |
| **tournament** | Tournament? | Relation |
| **events** | MatchEvent[] | Relation |
| **mercs** | MatchMerc[] | Relation |
| **starPlayers** | MatchStarPlayer[] | Relation |

#### MatchEvent
Play-by-play event record.

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| matchId | String | FK → Match (Cascade delete) |
| mdMatchEventId | String? | FK → MdMatchEvent (nullable) |
| type | String | e.g. "TD", "CASUALTY", "INTERCEPTION" |
| label | String | Human-readable description |
| scoringTeam | String? | "home" or "away" for TD events |
| createdAt | DateTime | Auto |

#### MatchMerc
Mercenary player hired for a single match.

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| matchId | String | FK → Match (Cascade delete) |
| playerTypeId | String | FK → PlayerType |
| side | String | "home" or "away" |
| cost | Int | Hiring cost for this match |
| createdAt | DateTime | Auto |

#### MatchStarPlayer
Star Player hired for a single match.

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| matchId | String | FK → Match (Cascade delete) |
| starPlayerId | String | FK → MdStarPlayer |
| side | String | "home" or "away" |
| price | Int | Hiring cost |
| isCompanion | Boolean (false) | Is a companion star player |
| createdAt | DateTime | Auto |

#### MdStarPlayer
Star Player masterdata (~100 entries).

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| name | String (unique) | |
| price | Int? | Hiring cost; null = companion (included with another) |
| includedWithId | String? | FK → MdStarPlayer (self-ref, companion relation) |
| ma, st, ag, av | Int | Base stats |
| notes | String? | Special rules text |
| createdAt | DateTime | Auto |
| **skills** | Skill[] | M2M via "StarPlayerToSkill" |
| **races** | Race[] | M2M via "StarPlayerToRace" |
| **companions** | MdStarPlayer[] | Self-ref: companion players |
| **includedWith** | MdStarPlayer? | Self-ref: parent player |
| **matchStarPlayers** | MatchStarPlayer[] | Relation |

#### MdMatchEvent
Match event masterdata / templates.

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| name | String | Event name |
| eventType | String | Classification |
| causesCasualty | Boolean (false) | |
| dieRoll, ssp | Int? | Rule modifiers |
| description | String? | |
| createdAt | DateTime | Auto |
| **matchEvents** | MatchEvent[] | Relation |

#### NewsPost
League news and announcements.

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| title, body | String | Article content |
| authorId | String | FK → Coach |
| teamId | String? | FK → Team (nullable) |
| playerId | String? | FK → TeamPlayer (nullable) |
| coachNote | String (default "") | Admin-only note |
| createdAt, updatedAt | DateTime | Auto |
| **author** | Coach | Relation |

---

## 4. File & Directory Structure

```
/
├── app/                          Next.js App Router pages
│   ├── layout.tsx                Root layout: Navbar, Footer, DiceRoller (global)
│   ├── page.tsx                  Home/dashboard
│   ├── globals.css               Tailwind base + custom keyframes
│   ├── auth/login/
│   │   ├── page.tsx              Login form
│   │   └── actions.ts            loginAction, logoutAction
│   ├── teams/
│   │   ├── page.tsx              League teams table
│   │   ├── new/
│   │   │   ├── page.tsx          Team creation wizard
│   │   │   ├── actions.ts        createTeam server action
│   │   │   └── TeamCreatorForm.tsx  Client form component
│   │   └── [id]/
│   │       ├── page.tsx          Team detail (4 tabs)
│   │       └── actions.ts        Player/team CRUD actions
│   ├── matches/[id]/
│   │   ├── page.tsx              Match report
│   │   └── game/
│   │       ├── page.tsx          Match entry interface
│   │       ├── actions.ts        pushMatchEvent, deleteLastMatchEvent, completeMatch
│   │       └── GameOnClient.tsx  Live match client UI
│   ├── standings/page.tsx        Standings with division grouping
│   ├── schedule/page.tsx         Match schedule (league/tournament/round view)
│   ├── scoreboard/page.tsx       Live match ticker wrapper
│   ├── races/
│   │   ├── page.tsx              Race list with tier filter
│   │   └── [id]/page.tsx         Race detail: player types + star players
│   ├── rules/page.tsx            PDF downloads (LRB6, CRP1)
│   ├── profile/
│   │   ├── page.tsx              Coach profile editor
│   │   └── actions.ts            updateProfile
│   ├── league-management/
│   │   ├── page.tsx              Admin dashboard (3 tabs)
│   │   ├── actions.ts            League/Division/Tournament CRUD
│   │   ├── coach-actions.ts      User management
│   │   ├── match-actions.ts      Match scheduling
│   │   ├── tournament-actions.ts Tournament management
│   │   ├── ruleset-actions.ts    RuleSet CRUD
│   │   └── MatchesTab.tsx        Client component for match table
│   └── data-manager/
│       ├── page.tsx              Table overview (admin only)
│       └── [table]/
│           ├── page.tsx          Paginated data browser for one model
│           ├── actions.ts        createRow, updateRow, deleteRow
│           └── DataTable.tsx     Client component for table UI
│
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx            Top nav + auth state
│   │   └── Footer.tsx            Static footer
│   ├── matches/
│   │   ├── MatchesPanel.tsx      Home: 3-column upcoming/live/results
│   │   ├── UpcomingMatches.tsx   Next 5 fixtures
│   │   ├── LiveMatches.tsx       Live match cards with score + CAS counts
│   │   └── LatestResults.tsx     5 most recent completed matches
│   ├── news/
│   │   ├── NewsSection.tsx       News feed layout
│   │   └── NewsCard.tsx          Single article card
│   ├── teams/
│   │   ├── TeamQuickAccess.tsx   "My Teams" home widget
│   │   └── TeamCard.tsx          Team summary card
│   ├── scoreboard/
│   │   └── SportBarScoreboard.tsx  Live match detail + event ticker
│   ├── adverts/
│   │   └── SponsorBanner.tsx     Sponsor ad carousel (marquee)
│   ├── ui/
│   │   ├── SectionHeading.tsx    Reusable title + divider
│   │   ├── GrimdarkCard.tsx      Theme card container
│   │   └── LiveBadge.tsx         Animated "LIVE" pill
│   ├── DiceRoller.tsx            Floating global dice roller
│   └── LeagueFilter.tsx          League selector dropdown
│
├── lib/
│   ├── prisma.ts                 Prisma singleton (dev HMR safe)
│   ├── auth.ts                   JWT session functions
│   ├── types.ts                  Shared TypeScript interfaces
│   ├── race-logo.ts              Race name → /race-logos/*.png map
│   ├── data-manager-dmmf.ts      Prisma DMMF introspection
│   ├── data-manager-meta.ts      Table labels & descriptions
│   └── queries/
│       ├── teams.ts              Team queries
│       ├── matches.ts            Match queries
│       ├── races.ts              Race queries
│       └── news.ts               News queries
│
├── prisma/
│   ├── schema.prisma             Full DB schema
│   ├── seed.ts                   Races, player types, skills
│   ├── seed-md-star-players.ts   ~100 star players
│   └── seed-md-match-events.ts   Match event templates
│
├── public/
│   ├── LRB6.pdf                  Living Rulebook 6 (24.7 MB)
│   ├── CRP1.pdf                  Competition Rules Pack 1 (5.3 MB)
│   ├── race-logos/               28 race icon PNGs
│   ├── Sound/                    Sound effects
│   └── adverts/                  Sponsor images
│
├── middleware.ts                 JWT auth guard for protected routes
├── tailwind.config.ts            Custom BB theme colours + animations
├── next.config.mjs               Minimal Next.js config
└── tsconfig.json                 Strict TS, @/* path alias
```

---

## 5. Routing & Pages

### Public routes (no auth required)

| Route | Purpose |
|---|---|
| `/` | Home dashboard: news, live matches, upcoming fixtures, latest results, "My Teams" (if logged in), league filter |
| `/auth/login` | Email + password login form |
| `/teams` | League teams table sorted by W-D-L record |
| `/teams/[id]` | Team detail: Roster / Schedule / Standing / News tabs |
| `/matches/[id]` | Match report: score, event log by half |
| `/standings` | League standings; division filter when league selected |
| `/schedule` | Match schedule; tournament → round grouping when league selected |
| `/scoreboard` | Live match ticker |
| `/races` | Races list with tier filter |
| `/races/[id]` | Race detail: player types table, star players table |

### Protected routes

| Route | Minimum role | Purpose |
|---|---|---|
| `/rules` | COACH | Rulebook PDFs (LRB6 download + in-browser view, CRP1 same) |
| `/teams/new` | COACH | Team creation wizard |
| `/profile` | COACH | Edit alias, contact info, primary league |
| `/matches/[id]/game` | Match participant* | Live match event recording UI |
| `/league-management` | COMMISH | Leagues, divisions, tournaments, matches, users |
| `/data-manager` | ADMIN | Raw table browser / editor for all Prisma models |

*Match participant = home coach OR away coach OR COMMISH OR ADMIN.

### Middleware auth guard

`middleware.ts` intercepts all requests to `/teams/*`, `/league-management`, `/profile`, `/rules`, `/data-manager`. Reads `bb_session` JWT cookie. Role-based: `/league-management` requires COMMISH+, `/data-manager` requires ADMIN. Unauthenticated requests redirect to `/auth/login?redirect=<original>`.

---

## 6. Authentication

### Session

JWT signed with `AUTH_SECRET`, stored as `bb_session` HTTP-only cookie (7-day expiry).

```typescript
interface SessionPayload {
  coachId: string
  name: string
  alias: string | null
  email: string
  role: 'ADMIN' | 'COMMISH' | 'COACH'
}
```

### lib/auth.ts functions

| Function | Description |
|---|---|
| `hashPassword(plain)` | bcrypt hash |
| `verifyPassword(plain, hash)` | boolean |
| `createSession(payload)` | Signs JWT, sets cookie |
| `getSession()` | Reads + verifies cookie → SessionPayload or null |
| `destroySession()` | Clears cookie |

### Login flow

1. `POST /auth/login` → `loginAction`
2. Finds coach by email (case-insensitive)
3. `verifyPassword` check
4. Checks `isActive`
5. `createSession` → cookie
6. Redirect to `/` or referrer

---

## 7. Key Server Actions

### `/app/teams/new/actions.ts`
- `createTeam(formData)` — Creates Team + initial TeamPlayers (one of each position up to min roster), deducts gold from treasury.

### `/app/teams/[id]/actions.ts`
- `updatePlayer(id, {number, name})` — Edit jersey number / name
- `buyPlayer(teamId, playerTypeId)` — Recruit new player, deduct gold
- `sackPlayer(playerId)` — Status → SACKED
- `reinstatePlayer(playerId)` — Status → ACTIVE (within reinstatement window)
- `updateTeamInfo(teamId, data)` — Treasury, rerolls, staff, fan factor
- `createTeamNewsPost(teamId, {title, body})` — Post team news
- `deactivateTeam / activateTeam / deleteTeam` — Visibility / removal
- `assignTeam(teamId, leagueId, divisionId)` — Admin reassignment

### `/app/matches/[id]/game/actions.ts`
- `pushMatchEvent(matchId, type, label, scoringTeam?)` — Records event; if type=TD, increments homeScore/awayScore on Match
- `deleteLastMatchEvent(matchId)` — Undo; if last event was TD, decrements score
- `completeMatchFull(matchId, homeScore, awayScore, mvp, ...)` — Finalises match, writes stats to TeamPlayer rows, updates Team W/L/D

### `/app/league-management/actions.ts`
Full CRUD for: RuleSet, League, Division, Tournament, Match scheduling.

### `/app/league-management/coach-actions.ts`
Create/edit/delete Coach accounts. Role changes. Primary league assignment.

---

## 8. Key Query Functions

### `lib/queries/teams.ts`
- `getTeamsByCoach(coachId)` → TeamSummary[] for home "My Teams" widget
- `getAllTeams()` → all active teams
- `getTeamById(id)` → full Team with race, coach, division, players (with playerType + startingSkills)
- `getLeagueTeams()` → TeamListEntry[] with team value, coach alias

### `lib/queries/matches.ts`
- `getUpcomingMatches(leagueId?)` → 5 next SCHEDULED matches
- `getLiveMatches(leagueId?)` → LIVE matches with events; computes CAS/kill counts from event labels
- `getLatestResults(leagueId?)` → 5 most recent COMPLETED matches
- `getMatchesByLeague(leagueId)` → all matches in a league
- `getMatchReport(matchId)` → full match with ordered event log

### `lib/queries/races.ts`
- `getAllRaces()` → RaceSummary[] (name, tier, reroll price, apothecary, team count)
- `getRaceById(id)` → RaceDetail with playerTypes[] and starPlayers[]

### `lib/queries/news.ts`
- `getLatestNews()` → 4 most recent posts
- `getTeamNews(teamId)` → all posts for a team

---

## 9. Styling System

### Custom Tailwind colours (`tailwind.config.ts`)

| Token | Hex | Use |
|---|---|---|
| `bb-navy` | #0d0d1a | Page backgrounds |
| `bb-dark` | #12121f | Card backgrounds |
| `bb-darker` | #0a0a14 | Table headers, header bars |
| `bb-gold` | #c9a227 | Primary accent, headings |
| `bb-gold-dim` | #a07d1c | Dimmed gold |
| `bb-crimson` | #8b0000 | Crimson accent |
| `bb-crimson-bright` | #c0392b | Error / danger states |
| `bb-muted` | #6b7280 | Secondary text |
| `bb-border` | #1e1e3a | Borders, dividers |

### Custom animations

| Name | Duration | Description |
|---|---|---|
| `marquee` | 120s | Infinite horizontal scroll (sponsor banner) |
| `td-blast` | 0.45s | Scale + opacity pop-in for dice/score reveal |
| `td-fade-out` | 0.5s | Scale + fade-out |
| `pulse-live` | 1.5s | Pulsing glow for LIVE badge |

### Typography

- **Headings** (`font-heading`): Cinzel serif — `uppercase tracking-widest font-black`
- **Body** (`font-body`): Inter sans-serif
- Common heading pattern: `font-heading text-lg font-bold text-bb-gold tracking-widest uppercase`

### Card pattern

```html
<div class="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-hidden shadow-xl shadow-black/50">
  <div class="bg-bb-darker border-b border-bb-border px-4 py-3"><!-- header --></div>
  <!-- content -->
</div>
```

---

## 10. Components Detail

### DiceRoller (`components/DiceRoller.tsx`)

Floating global tool (bottom-right). Supports:
- Numeric dice: D3, D6, 2D6, D8, D16
- Block dice: ×1, ×2, ×3

Block die faces: Push Back (×2), Defender Stumbles, Attacker Down, Both Down, Defender Down. Each face has a custom SVG icon and colour class. Results displayed with animated pop-in.

### GameOnClient (`app/matches/[id]/game/GameOnClient.tsx`)

Client component managing the entire live match state machine:

```typescript
type Phase = 'PRE' | 'ACTIVE' | 'POST'

interface GameState {
  phase: Phase
  turn: number              // 1–16; derives half (< 9 = 1st, ≥ 9 = 2nd)
  lineup: { home: string[]; away: string[] }
  events: MatchEvent[]
  mvp: { home: string | null; away: string | null }
  winnings: { home: number; away: number }
  injuryOverrides: Record<string, 'BH' | 'MNG' | 'DEAD'>
}
```

SSP is computed live per player from events (TD=3, completion=1, interception=2, casualty=2, MVP=5). Level thresholds: Rookie(0–5) → Experienced(6–15) → Veteran(16–30) → Emerging Star(31–50) → Star(51–75) → Super Star(76–175) → Legend(176+).

### SportBarScoreboard (`components/scoreboard/SportBarScoreboard.tsx`)

Client component for the `/scoreboard` route. Displays live match details and event ticker.

### Navbar (`components/layout/Navbar.tsx`)

Nav links: Home / Teams / Races / Schedule / Standings / Rules.
Role-gated links: League Management (COMMISH+), Data Manager (ADMIN).
Auth state: shows alias + logout when signed in; Coach Login button when signed out.

---

## 11. Data Manager (Admin Tool)

Route `/data-manager` lists all 15 Prisma models with row counts. `/data-manager/[table]` shows paginated rows with inline edit and delete. Powered by Prisma DMMF introspection (`lib/data-manager-dmmf.ts`) — no hardcoded model list needed.

---

## 12. Race Logos

`lib/race-logo.ts` maps 28 race names to `/race-logos/*.png`. File names are lowercase with no spaces (e.g. `High Elves` → `highelf.png`). Used on team detail pages, race list, race detail header.

---

## 13. Seed Data

Run once after schema creation:

```bash
npx prisma db seed                     # races, player types, skills
ts-node prisma/seed-md-star-players.ts # ~100 star players
ts-node prisma/seed-md-match-events.ts # match event templates
```

The `seed.ts` uses `upsert` on unique fields so it is safe to run repeatedly.

---

## 14. Build & Run

```bash
npm install
npx prisma migrate deploy   # apply schema
npm run prisma db seed      # seed masterdata
npm run dev                 # development (localhost:3000)
npm run build && npm start  # production
```

---

## 15. Key Design Decisions

- **Server Components by default**: all pages are `async` server components. Client components (`'use client'`) are only used where interactivity is needed (forms, live match UI, dice roller).
- **Server Actions** replace REST endpoints: mutations happen via `action={serverAction}` on forms or `startTransition` in client components.
- **No API routes** (`app/api/`): everything is either SSR data fetching or server actions.
- **Prisma direct in server components**: no service layer — queries are called directly in page components and server actions.
- **Soft delete via `isActive`**: Teams and Coach accounts are deactivated rather than deleted to preserve relational integrity.
- **Match scores kept in sync**: TD events written via `pushMatchEvent` immediately increment `Match.homeScore` / `Match.awayScore` so the front page live ticker shows current scores without waiting for match completion.
- **Star player companions**: `MdStarPlayer` has a self-referential relation (`includedWith` / `companions`). A companion has `price = null` and `includedWithId` pointing to its parent. The UI shows `+ [companion name]` under the parent and `Included with [parent]` under the companion row.
- **Skill category colours**: consistent across player types and star players — G=blue, A=green, P=yellow, S=red, M=purple, E=crimson.

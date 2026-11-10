# Pax History

A browser-based, AI-driven alternate-history grand strategy game. Pick a nation and a start date, write your orders in plain language ("remilitarise the Rhineland", "propose an alliance with Japan"), and an LLM game master decides how the world reacts. The map redraws to match.

Two scenarios ship with it:

- **World, 2026** (default): the present day, built around war. It has a research tree, a **division designer**, **tank and jet designers**, production, and land battles with air support on the map. The fighting is simulated by code, and the AI narrator only reports it. See [Military layer](#military-layer-world-2026).
- **Europe, 1936**: the original diplomacy-first sandbox.

- **Map:** Natural Earth borders, coloured by owner, rendered with MapLibre GL. Click a region to see its owner.
- **Turns:** each **End Turn** resolves your orders, generates 1–3 moves by AI nations, and advances one month.
- **Diplomacy:** chat with any nation's leader in character. Concluded talks are summarised into the event log.
- **Rules engine:** the AI proposes changes; code validates each one before applying it (unknown provinces and nonexistent nations are rejected and shown to you).
- **Memory:** once the log passes 30 events, older events are folded into a "history so far" paragraph.
- **Save/load:** SQLite. Every turn is autosaved, and you can make named saves.
- **Works offline:** with no API key, a mock engine is used, so you can try the whole loop for free. The military layer needs no AI at all.

![Pax History — Germany, April 1936](docs/screenshot.png)

## Quick start

Requirements: **Node.js 20.6+** (22 LTS recommended) and npm.

```bash
git clone <this repo> && cd Pax-history-s-
npm install                 # installs root + server + client workspaces
cp .env.example .env        # then edit .env (see below)
npm run dev                 # server on :3001, client on :5173
```

Open **http://localhost:5173**.

### `.env`

```ini
OPENROUTER_API_KEY=sk-or-...          # from https://openrouter.ai/keys  (server-side only)
OPENROUTER_MODEL=openai/gpt-4o-mini   # any OpenRouter model slug that handles JSON well
```

| Variable | Default | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` | *(empty)* | No key means the **offline mock engine** is used. |
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | e.g. `anthropic/claude-sonnet-4.5`, `google/gemini-2.5-flash`, `deepseek/deepseek-chat` |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Any OpenAI-compatible endpoint works. |
| `AI_MOCK` | `0` | `1` forces the mock engine even if a key is set. |
| `AI_TIMEOUT_MS` | `60000` | Per-request timeout. |
| `PORT` | `3001` | API server port. |
| `DATABASE_PATH` | `./data/pax.sqlite` | Relative to `server/`. |

The key is read only by the Express server (`server/src/config.ts`) and used only in `server/src/ai/client.ts`. The browser calls `/api/*` on your own server and never receives the key. Vite only exposes `VITE_*` variables to the client, so don't rename it to that.

### Other commands

```bash
npm test             # rule-validation unit tests (node:test)
npm run typecheck    # server + client
npm run build        # production build of the client
npm start            # serve API + built client on :3001
npm run geo          # rebuild the province layer from Natural Earth (outputs are committed)
npm run province-geo -w server   # rebuild areas / border distances / sea links for the military layer
npm run prompts      # regenerate docs/PROMPTS.md from the prompt source
```

## How to play

1. **New game**: pick *Europe, 1936*, a start month, and any of 33 playable nations.
2. **Orders** (right, top): describe what your government does this month. Be as specific or as bold as you like. The engine judges plausibility, so a Baltic state can't conquer the USSR in a month.
3. **End Turn**: read the report (narrative, foreign reactions, and the mechanics applied or rejected). The map and event log update.
4. **Diplomacy** (right, bottom): pick a nation, or click it on the map and choose *Open talks*. Make concrete offers. Leaders act in their own interest. Press **Conclude talks** to record agreements in the log. Open talks are concluded automatically at End Turn.
5. **Save game** in the top bar. **Menu → Load game** lists named saves and autosaved games.

## Military layer (World, 2026)

![Division designer](docs/military-divisions.png)

Open it with **⚔ Military** in the top bar. All of it is deterministic code in `shared/military` and `server/src/military`. The AI narrator only describes battles; it cannot change their results or hand over land between nations at war.

### Start of the game

There are 30 playable nations with present-day leaders, alignments and abstracted force sizes:

- A *division* is roughly 10–20k troops.
- *Factories* measure defense-industrial capacity.
- Jets are counted in combat aircraft.

The **Russia–Ukraine war is already running**: Russia holds about 19% of Ukraine, and most of its army is on the front. Nations start with research matching their tech tier. For example, the US, China and a few others already have 5th-generation stealth airframes.

### Research

There are 6 trees with about 60 technologies, dated 2020–2034: Infantry, Armor, Artillery & AD, Air, Doctrine and Industry.

- Each nation has 2–6 research slots.
- Research speed scales with the economy.
- Researching a technology **ahead of its year** costs +50% per year early.
- Techs unlock battalions, tank and jet modules, and airframes, or give global bonuses (for example, *Network-Centric Warfare*: +10% attack).

### Tank designer

![Tank designer](docs/military-tanks.png)

Pick a **chassis**: wheeled, light, main battle tank, or next-gen heavy MBT. Then fit:

- a main gun (30 mm autocannon up to a 140 mm electrothermal gun; bigger guns need bigger chassis)
- a turret (manned, autoloader, or unmanned with crew capsule)
- an engine (diesel, gas turbine, hybrid-electric)
- armor (rolled steel, composite, heavy ERA, nanoceramic)
- fire control
- up to 4 special modules: soft- and hard-kill APS, a remote weapon station, gun-launched ATGMs, anti-drone cage armor, a tethered recon drone, and more

Stats update live, compared against the design you started from:

- soft attack, hard attack
- piercing, armor
- defense, breakthrough
- speed, reliability
- cost

A battalion fields 40 tanks of the chosen design. Changing a design that's already in use saves a new variant instead.

### Jet designer

Pick an **airframe**: light fighter, multirole, heavy strike, 4.5-gen, 5th-gen stealth, 6th-gen adaptive, or a combat drone. Then fit:

- an engine, up to adaptive-cycle
- a radar: pulse-Doppler, AESA or GaN AESA
- up to 6 weapon stations: short-range, BVR and ramjet AAMs; rocket pods; guided bombs; stand-off and hypersonic missiles
- specials: RAM coating, an EW suite, conformal tanks, a targeting pod, helmet cueing

Stealth airframes carry weapons internally. The *External Hardpoints* special adds 2 weapon stations but costs most of the stealth.

### Division designer

Build templates on a **5×5 combat grid** plus **5 support companies**:

| Combat battalions | Support companies |
|---|---|
| Infantry, motorized, mechanized, special forces, air assault, marines | Recon drones, engineers, signals & EW, logistics |
| Armored (uses any of your tank designs) | Counter-battery, field hospital |
| Self-propelled artillery, rocket artillery, anti-tank missiles, air defense | Loitering munitions, SHORAD |

The stats panel shows:

- width, manpower, HP, organisation
- soft and hard attack, defense, breakthrough
- armor, piercing, hardness
- air defense, speed
- equipment cost, and the equipment list against your stockpile

Editing a template updates every division that uses it.

### Production and recruiting

- Factories are assigned to production lines: infantry kit, IFVs, guns, rocket launchers, ATGMs, air defense, drones, helicopters, or any tank or jet design.
- Output depends on research, economy and stability.
- New divisions need a full equipment set and manpower, and train for 2 turns.
- Damaged divisions reinforce from the stockpile (up to 25% strength per month).

### Orders and battles

![Battle report](docs/military-battle.png)

![Naval invasion of Taiwan](docs/military-map.png)

**Giving orders.** Click a province, tick divisions, and choose a target from the list, or press **Pick on map**.

- Moving into enemy land attacks it.
- ⛴ marks a naval landing. Landings are only possible across a real sea crossing of ≤ 600 km between coasts, computed from the map.
- Troops can enter foreign land only at war, or with military access (relation ≥ 50).
- Declaring war pulls in the target's close friends (relation ≥ 70).

**Combat.** At End Turn, every province where warring armies meet has a battle of 12 rounds:

- **Frontage** comes from terrain: 60 for mountains and jungle, 90 for plains. It grows on long fronts in big provinces and with attacks from several directions. Divisions deploy until the width is full, and reserves rotate in as front divisions lose organisation.
- **Damage:** attacks are `soft × (1 − hardness) + hard × hardness`. They are blocked by the target's defense (when defending) or breakthrough (when attacking). Blocked hits do little damage.
- **Armor vs piercing:** armor above the enemy's piercing halves damage taken and adds shock. Piercing below the enemy's armor costs attack. Forest, urban and mountain terrain blunt armor.
- **Modifiers:** terrain penalties, entrenchment, initiative (recon), enemy EW, counter-battery, and amphibious penalties. Landings take −50% in the first battle and −20% while supplied over the beaches.
- **Air:** air-superiority wings in range fight for the sky. Ground-support wings add damage scaled by sky control and blunted by enemy air defense. Planes are lost to fighters and AA.

**Outcome.** The result moves the province's **occupation progress**:

- Bigger provinces take longer: Ukraine needs many won battles, Russia far more.
- A big army in reserve slows the enemy down.
- At 100% the province changes hands. Defenders that can't retreat to friendly ground are **encircled and destroyed**.

**Aftermath.** Casualties wear down stability (war exhaustion). Battle reports show:

- each division's strength and organisation before and after, and its fate
- casualties, equipment and aircraft lost
- an organisation-per-round chart

### AI nations

Every other nation runs on code-based AI:

- It researches and redesigns its tanks and jets as tech unlocks better parts.
- It reallocates its factories and recruits when threatened.
- It reinforces battles it is losing and attacks where it has the odds.
- It launches naval invasions when there is no land front.
- It accepts peace when losing.

The LLM narrator may also start or end wars between AI nations (`declare_war` / `make_peace`). It can never start or end a war for the player.

## Project structure

```
.
├── shared/
│   ├── types.ts                 # World-state schema + AI contract + API DTOs (types only)
│   └── military/
│       ├── catalog.ts           # techs, battalions, equipment, tank/jet modules, terrain, standard designs
│       └── stats.ts             # design/division stat calculators (used by server AND designers)
├── server/                      # Node + Express + TypeScript (run with tsx)
│   ├── data/provinces.json      # generated: province ids, names, centroids, neighbours
│   ├── data/province-geo.json   # generated: areas, border distances, coast-to-coast sea links
│   ├── scripts/
│   │   ├── build-geo.ts         # Natural Earth -> provinces.geojson + provinces.json
│   │   ├── build-province-geo.ts # GeoJSON -> province-geo.json (npm run province-geo -w server)
│   │   └── dump-prompts.ts      # writes docs/PROMPTS.md
│   └── src/
│       ├── index.ts             # Express app (also serves client/dist in production)
│       ├── config.ts            # env -> config (API key stays here)
│       ├── routes/api.ts        # HTTP routes (thin)
│       ├── services/gameService.ts  # turn loop, diplomacy, memory, saves
│       ├── state/
│       │   ├── world.ts         # pure state helpers (relations, dates, lookups)
│       │   ├── summary.ts       # compact world summary for prompts
│       │   └── provinces.ts     # loads province metadata
│       ├── military/
│       │   ├── init.ts          # starting forces, research, air wings, wars
│       │   ├── combat.ts        # battle resolution (land + air)
│       │   ├── turn.ts          # monthly phase: research, production, AI, movement, battles, recovery
│       │   ├── ai.ts            # AI research, auto-designs, production, recruiting, front moves, peace
│       │   ├── commands.ts      # validated player commands (designers, orders, war/peace)
│       │   ├── world.ts         # geography, sides, access rules, stat cache
│       │   └── summary.ts       # military situation for the narrator prompt
│       ├── scenarios/
│       │   ├── world2026.ts     # present-day scenario (military layer)
│       │   ├── europe1936.ts    # the 1936 scenario
│       │   └── index.ts         # scenario registry + initial-state builder
│       ├── ai/
│       │   ├── client.ts        # OpenRouter client, retry/backoff, JSON repair
│       │   ├── prompts.ts       # ALL prompts (engine, diplomacy, summaries, memory)
│       │   ├── engine.ts        # resolveTurn, summarizeHistory
│       │   ├── diplomacy.ts     # chatReply, summarizeTalks
│       │   └── mock.ts          # offline engine with the same JSON contract
│       ├── validation/
│       │   ├── changes.ts       # zod shape check + rule validation/application
│       │   └── changes.test.ts
│       └── db/database.ts       # SQLite (games + saves tables)
├── client/                      # React + Vite + TypeScript + MapLibre GL
│   ├── public/geo/provinces.geojson
│   └── src/
│       ├── App.tsx, main.tsx, styles.css
│       ├── lib/api.ts, lib/format.ts
│       └── components/
│           ├── MainMenu.tsx      # scenario setup + load screen
│           ├── GameScreen.tsx    # layout + request orchestration
│           ├── MapView.tsx       # MapLibre map
│           ├── ProvincePanel.tsx # click-a-region details
│           ├── EventLog.tsx      # left column
│           ├── ActionPanel.tsx   # orders + turn report
│           ├── DiplomacyPanel.tsx
│           ├── TopBar.tsx
│           └── military/         # Military screen: Army, Battles, Research, Division/Tank/Jet designers, Production
└── docs/PROMPTS.md              # exact prompts, generated
```

## World-state schema

The entire game is one JSON object (`shared/types.ts`):

```ts
interface WorldState {
  schemaVersion: 1;
  scenarioId: string;
  date: string;                 // "1936-03-01", always the 1st of a month
  turn: number;
  playerNation: NationId;
  nations: Record<NationId, Nation>;
  provinces: Record<ProvinceId, { id; name; owner: NationId }>;
  events: GameEvent[];          // recent log, oldest first
  nextEventId: number;
  historySummary: string;       // "history so far" (memory)
  archivedEventCount: number;
  chats: Record<NationId, ChatThread>;
  lastReport: TurnReport | null;
}

interface Nation {
  id; name; leader; government; capital;
  color: string;                         // flag colour on the map
  relations: Record<NationId, number>;   // -100..100, sparse, kept symmetric
  stability: number; economy: number;    // 0..100
  goals: string[]; persona?: string;     // feed the diplomacy persona
  playable: boolean; minor: boolean; alive: boolean;
}
```

## AI contract and validation

The engine must return:

```json
{
  "narrative": "string",
  "nation_reactions": [{ "nation": "string", "reaction": "string" }],
  "state_changes": [
    { "type": "transfer_province", "province": "string", "to": "string" },
    { "type": "relation_change", "a": "string", "b": "string", "delta": 0 },
    { "type": "stat_change", "nation": "string", "stat": "stability", "delta": 0 },
    { "type": "new_event", "text": "string" }
  ]
}
```

`stat_change` is one addition to the base contract. Without it, nothing in the game could ever move stability or economy.

The reply goes through two layers:

1. **Shape** (zod, `validation/changes.ts`): the reply must be a JSON object with a `narrative` and an array of changes. If it isn't, the call is retried. Retries run up to 3 attempts in total, with exponential backoff (1 s, 2 s, plus jitter). The model is shown its bad output and told exactly what was wrong. HTTP 429/5xx and timeouts are also retried. 401/402/400 fail fast.
2. **Rules** (applied one change at a time, in order, against the live state):
   - `transfer_province`: the province and target nation must exist. The province can't already belong to the target. At most 6 transfers per turn.
   - `relation_change`: both nations must exist and be different, and the delta must be numeric. The delta is clamped to ±40 and the result to −100..100. Relations stay symmetric.
   - `stat_change`: the nation must exist and the stat must be `stability` or `economy`. The delta is clamped to ±15 and the result to 0..100.
   - `new_event`: the text can't be empty. It is capped at 400 characters, and at most 6 events are allowed per turn.
   - Unknown change types are rejected.
   - A nation that loses its last province is marked defunct. It can be revived if it regains land.

IDs and names are both accepted, case- and diacritic-insensitively ("germany", "GER" and "Bohemia-Moravia" all resolve). Rejected changes are never applied. They appear, struck through in red, under **Mechanics** in the turn report, so you can see when the AI tried something impossible.

The exact prompts are in **[docs/PROMPTS.md](docs/PROMPTS.md)**, rendered with real example data. The source is `server/src/ai/prompts.ts`.

## Design decisions

- **One JSON blob per game.** Saving and loading become trivial, the AI sees the same data the UI does, and moving to PostgreSQL means changing the column type to `JSONB` and rewriting the ~10 functions in `db/database.ts`.
- **Provinces = modern admin-0 countries (1:110m).** These are small (180 KB) and fast, and they map cleanly onto 1936 owners: Czechia and Slovakia become Czechoslovakia, the seven Yugoslav successors become Yugoslavia, colonies go to their empires. Russia's Kaliningrad exclave is carved out as *East Prussia* so Germany's 1936 shape is recognisable. Any unassigned country becomes its own minor nation automatically. Finer provinces (admin-1) can be added later without touching the engine.
- **One engine call per turn.** That one call resolves the player's orders and generates the AI nations' moves, so the world's reaction stays coherent with the player's move, at half the latency and token cost of two calls.
- **Compact prompt.** The world is sent as a pipe-separated table rather than JSON (~2.8k tokens for the full 1936 world). Minor nations get one line. Relations are listed only where they matter.
- **Diplomacy is two-step.** The persona chats freely in plain text. A separate, low-temperature "record-keeper" call decides what was actually agreed. This keeps the role-play natural and keeps the bookkeeping honest. An agreement records a commitment but moves no borders. Land changes hands only through the engine.
- **Memory.** When the log passes 30 events, everything except the newest 15 is merged into a ≤220-word history. If that call fails, the turn still succeeds and compaction is retried next turn.
- **Mock engine.** It follows the same contract as the real model, so every code path can be developed and tested without spending tokens.
- **Concurrency guard.** There is one in-flight AI operation per game, so double-clicking End Turn can't resolve a month twice.
- **Map labels as HTML markers.** This avoids an external glyph server, so the map works fully offline.

## Next steps

- **Scenario editor:** paint province ownership on the map, edit nations, leaders, goals and relations, then export the result as a scenario JSON. The scenario format (`server/src/scenarios/types.ts`) is already data-only.
- **Finer provinces:** switch to Natural Earth admin-1 or custom historical provinces (Sudetenland, Danzig, Alsace-Lorraine) and add adjacency-based rules (no conquering non-bordering land without naval access).
- **Multiplayer:** several human nations in one world, with simultaneous order submission and a turn resolved when all players are ready. Add WebSocket push for map and log updates. This needs accounts and moving to PostgreSQL.
- **Community sharing:** publish scenarios and finished timelines, browse and fork others' games, rate them. Make game replays from the event log.
- **Token/credit system:** meter AI usage per user (prompt and completion tokens from OpenRouter's `usage` field), with free daily turns and paid credit packs. Route cheap calls (memory, talks summary) to a cheaper model.
- **Quality:** stream narratives token by token, give AI nations long-term plans that persist between turns, and add an "advisor" that suggests orders.
- **Military:** navies and convoys, sub-national provinces for real front lines, supply lines, lend-lease between allies, and nuclear deterrence.

## License / data

Borders: [Natural Earth](https://www.naturalearthdata.com/) (public domain).

# MGS Getaway

An endless top-down police-chase driving game that runs in any browser.
Steal the road, outrun the heat, never stop.

Built with plain HTML5 Canvas and vanilla JavaScript — **no frameworks, no build
step, no install**. Open `index.html` and it plays.

**Everything is unlocked by driving. No ads, no purchases, no paywalls, ever.**

---

## How to run it

| Method | What to do |
|---|---|
| Simplest | Double-click `index.html` |
| Local server | `npx http-server .` then open the printed URL |
| Online | See "Deploy to GitHub Pages" below |

A local server is only needed if your browser blocks `localStorage` on
`file://` — the game still runs either way, it just will not save progress.

## Controls

| Key | Action |
|---|---|
| `←` / `A` | Steer left |
| `→` / `D` | Steer right |
| `↑` / `W` | Boost |
| `↓` / `S` | Brake / reverse |
| `P` / `Esc` | Pause |
| `M` | Mute |

The car accelerates on its own — you only steer. **Turning bleeds speed**, so the
racing line matters. On a touchscreen, tap the left or right half of the screen.

## How the game works

**Your score is seconds survived.** Nothing else adds to it — so your score is
literally how long you lasted. Everything else pays in **cash**, which is the
only currency and the only way to unlock cars.

Heat climbs on a timer and never cools down:

| Seconds | Heat | What comes after you |
|---|---|---|
| 0 | 1 | 2 police cars |
| 40 | 2 | 4 police, a helicopter, roadblocks |
| 90 | 3 | SWAT 4x4s, the pack starts boxing you in |
| 150 | 4 | More SWAT, tighter roadblocks |
| 220 | 5 | Army jeeps, helicopter starts shooting (red square = incoming) |
| 300 | 6 | Tanks firing explosive shells |

Pursuers are deliberately **slower than almost every player car** — they win by
numbers, roadblocks and boxing you in, not by out-running you.

You die by running out of hull (`WASTED`), driving into water (`WASTED`), or
sitting still with police on top of you (`BUSTED`).

### Four ways to earn cash

| Source | Pays |
|---|---|
| Green cash notes on the road | 1 each (× your car's multiplier) |
| Wrecking a pursuer | $8 |
| **Objectives** — three live at a time, shown top-left | $50–$180 each |
| Some cars earn passively (City Cab's meter, Drift King's slides) | varies |

Objectives rotate: clear one and a fresh one replaces it immediately. They ask
for things like *hold one drift for 6s*, *smash through a roadblock*, *drown a
pursuer in water*, *hit 3 ramps*, *go 20s without taking a hit*.

### Power-up crates

Blue crates sit on the roads. Drive over one for a **temporary** boost — these
are never bought, only found. `?` crates roll a random one.

| Crate | Effect |
|---|---|
| OVERDRIVE | +45% top speed |
| INVULNERABLE | Nothing can hurt you |
| DRIFT MODE | Grip drops through the floor — slide everywhere |
| GUNNER | Auto-fires at pursuers |
| MAGNET | Hoovers up cash from 4× further away |
| FREEZE | Every pursuer crawls |
| PHASE | Drive straight through police cars |

### Every car has its own power

All **28 cars** have a unique ability *and* a unique animation — no two are the
same. A few examples:

| Car | Power |
|---|---|
| Site Pickup | Slowly repairs its own hull as you drive |
| City Cab | Meter running — earns cash every second |
| Micro Bus | Recharging shield soaks one hit at a time |
| Boxer Van | EMP shockwave that spins out everyone nearby |
| Camper Cruiser | Drops a decoy the police chase instead of you |
| Hover Pod | Floats straight over water |
| Dune Crawler | Climbs over walls instead of crashing into them |
| Nightshade | Vanishes from police radar every few seconds |
| Crusher | Ram anything and it dies, not you |
| Chrono | Slows the entire world down while you drive full speed |

Check the garage — every card lists its power.

### Things worth knowing

- **Bright blue water kills you instantly** — but pursuers drown in it too.
- Ramps launch you over everything, including buildings and roadblocks.
- Traffic explodes on contact and blocks whoever is behind you.
- The **radar bottom-right** shows roads, cash, crates, water and every pursuer.

## Deploy to GitHub Pages

1. Go to the repo's **Settings → Pages**.
2. Under **Source**, pick **Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)`. Click **Save**.
4. Wait about a minute, then open the URL it shows you.

No build step, so whatever is on `main` is what goes live.

## Project layout

```
index.html              markup + the script load order
style.css               menus, garage, slot machine, results
game.js                 main loop, fixed timestep, game state
src/
  core/utils.js         config dials, maths, seeded RNG, object pool
  core/input.js         keyboard + touch
  core/audio.js         all sound, synthesized with the Web Audio API
  data/vehicles.js      the 28-car roster  <-- balance the game here
  systems/economy.js    cash, ownership, localStorage, missions
  systems/effects.js    particles, explosions, screen shake
  systems/hazards.js    oil, ice, fire, mines, decoys dropped on the road
  systems/abilities.js  all 28 car powers
  systems/powerups.js   the temporary crate power-ups
  systems/objectives.js rotating in-run cash challenges
  systems/wanted.js     score (= seconds), the 6 heat levels, BUSTED meter
  world/world.js        infinite chunked world, biomes, roads, crates, props
  entities/player.js    car physics
  entities/traffic.js   civilian cars
  entities/pursuit.js   police AI, tanks, helicopter, roadblocks, shells
  render/carAnims.js    wheels, body roll, and 28 unique car animations
  render/renderer.js    all drawing, the faux-3D block look, HUD, radar
  ui/ui.js              menu / garage / slot machine / results screens
```

## Tweaking it

**Car stats and powers — `src/data/vehicles.js`**

```js
car('hot_rodder', 'Hot Rodder', 'common', [455, 330, 2.6, 85], [...], {
  ability: 'nitro', anim: 'exhaust'
})
//                                         ^     ^    ^    ^
//                               topSpeed ─┘     │    │    └─ hull (hp)
//                                  accel ───────┘    └────── grip
```

`grip` is the interesting one: **low grip = drifty**, high grip = on rails.

To add a car: give it an `ability` (add a `case` in `src/systems/abilities.js`
and an entry in that file's `INFO` table) and an `anim` (add a `case` in
`src/render/carAnims.js`). Both are switch statements — copy an existing case.

**Difficulty — `src/systems/wanted.js`**

```js
var THRESHOLDS = [0, 40, 90, 150, 220, 300];  // seconds until each heat level
var BUST_TIME  = 2.2;                         // seconds cornered before BUSTED
```

`LEVELS` in `src/entities/pursuit.js` controls how many pursuers each heat level
allows and which types spawn. `TYPES` in the same file sets their speeds — raise
`top` there if you want them to actually keep up.

**Feel — `src/entities/player.js`**

```js
var BASE_TURN    = 3.0;   // how sharply the car turns at full speed
var CRASH_SPEED  = 150;   // impact below this is a harmless bump
var CRASH_DAMAGE = 0.13;  // how much a real crash hurts
```

If steering feels *on rails*, lower `grip` on the cars. If it feels like *a bar
of soap on ice*, raise it. Those are the two dials that control the arcade feel.

**Objectives and payouts — `src/systems/objectives.js`** (the `POOL` array)
**Power-up durations — `src/systems/powerups.js`** (the `TYPES` table)

**World size — `src/core/utils.js`** (`CONFIG`)

`ROAD_EVERY` sets how big city blocks are. `CHUNK_TILES` must stay a multiple of
`ROAD_EVERY`, or blocks will straddle chunk boundaries and generate twice.

## Performance notes

The game targets 60fps on a laptop and gets there by:

- running physics on a **fixed timestep** with an accumulator, so a 144Hz monitor
  and a 60Hz laptop simulate identically
- **object pooling** every pursuer, traffic car, shell, hazard and particle, so
  nothing is allocated mid-run for the garbage collector to trip over
- generating the world in **chunks** around the player and throwing away the rest
- **culling** everything outside the viewport before drawing

If you add a lot more entities and the frame rate drops, add a spatial grid to
collision checks before adding more content.

---

Fan-made student project. Not affiliated with, endorsed by, or connected to
Bearbit Studios B.V. Game mechanics are not copyrightable; the name, logo and
artwork of any commercial game are. Everything here — name, art, code, sound —
is original.

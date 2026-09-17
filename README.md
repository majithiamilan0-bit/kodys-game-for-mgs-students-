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

1. **Survive.** Score climbs while you drive. Smashing a pursuer is worth +30.
2. **Heat climbs with score** and never cools down:

   | Score | Heat | What comes after you |
   |---|---|---|
   | 0 | 1 | 2 police cars |
   | 30 | 2 | 4 police, a helicopter, roadblocks |
   | 80 | 3 | SWAT 4x4s, the pack starts boxing you in |
   | 150 | 4 | More SWAT, tighter roadblocks |
   | 250 | 5 | Army jeeps, helicopter starts shooting (red square = incoming) |
   | 400 | 6 | Tanks firing explosive shells |

3. **Grab cash** (green notes on the road). Junctions and rare walled compounds
   have clusters of it.
4. **Die** by running out of hull (`WASTED`), driving into water (`WASTED`), or
   sitting still with police on top of you (`BUSTED`).
5. **Spend cash in the garage** on any of 24 cars. Three are earned by
   completing missions instead.

### Things worth knowing

- Water kills you instantly — but pursuers drown in it too. Lure them in.
- Ramps launch you over everything, including buildings and roadblocks.
- Traffic explodes on contact and makes a great obstacle for whoever is behind you.
- Legendary cars have abilities: ram-through, 5× cash, oil slicks, auto-rockets.

## Deploy to GitHub Pages

1. Go to the repo's **Settings → Pages**.
2. Under **Source**, pick **Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)`. Click **Save**.
4. Wait about a minute, then open the URL it shows you.

No build step, so whatever is on `main` is what goes live.

## Project layout

```
index.html              markup + the script load order
style.css               menus, garage, results screens
game.js                 main loop, fixed timestep, game state
src/
  core/utils.js         config dials, maths, seeded RNG, object pool
  core/input.js         keyboard + touch
  core/audio.js         all sound, synthesized with the Web Audio API
  data/vehicles.js      the 24-car roster  <-- balance the game here
  systems/economy.js    cash, ownership, localStorage, missions
  systems/effects.js    particles, explosions, oil slicks, screen shake
  systems/wanted.js     score, the 6 heat levels, the BUSTED meter
  world/world.js        infinite chunked world, biomes, roads, props
  entities/player.js    car physics
  entities/traffic.js   civilian cars
  entities/pursuit.js   police AI, tanks, helicopter, roadblocks, shells
  render/renderer.js    all drawing, including the faux-3D block look
  ui/ui.js              menu / garage / results screens
```

## Tweaking it

Everything you would normally want to change lives in three places.

**Car stats — `src/data/vehicles.js`**

```js
car('hot_rodder', 'Hot Rodder', 'common', [455, 330, 2.6, 85], [...])
//                                         ^     ^    ^    ^
//                               topSpeed ─┘     │    │    └─ hull (hp)
//                                  accel ───────┘    └────── grip
```

`grip` is the interesting one: **low grip = drifty**, high grip = on rails.
Prices are set per rarity by the `PRICE` object at the top of the same file.

**Difficulty — `src/systems/wanted.js`**

```js
var THRESHOLDS = [0, 30, 80, 150, 250, 400];  // score needed for each heat level
var BUST_TIME  = 2.2;                         // seconds cornered before BUSTED
```

Also `LEVELS` in `src/entities/pursuit.js` controls how many pursuers each heat
level allows and which types spawn.

**Feel — `src/entities/player.js`**

```js
var BASE_TURN    = 3.0;   // how sharply the car turns at full speed
var CRASH_SPEED  = 150;   // impact below this is a harmless bump
var CRASH_DAMAGE = 0.13;  // how much a real crash hurts
```

If steering feels *on rails*, lower `grip` on the cars. If it feels like *a bar
of soap on ice*, raise it. Those are the two dials that control the whole arcade
feel.

**World size — `src/core/utils.js`** (`CONFIG`)

`ROAD_EVERY` sets how big city blocks are. `CHUNK_TILES` must stay a multiple of
`ROAD_EVERY`, or blocks will straddle chunk boundaries and generate twice.

## Performance notes

The game targets 60fps on a laptop and gets there by:

- running physics on a **fixed timestep** with an accumulator, so a 144Hz monitor
  and a 60Hz laptop simulate identically
- **object pooling** every pursuer, traffic car, shell and particle, so nothing
  is allocated mid-run for the garbage collector to trip over
- generating the world in **chunks** around the player and throwing away the rest
- **culling** everything outside the viewport before drawing

If you add a lot more entities and the frame rate drops, add a spatial grid to
collision checks before adding more content.

---

Fan-made student project. Not affiliated with, endorsed by, or connected to
Bearbit Studios B.V. Game mechanics are not copyrightable; the name, logo and
artwork of any commercial game are. Everything here — name, art, code, sound —
is original.

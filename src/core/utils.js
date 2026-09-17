/* Shared config, maths, seeded randomness and object pooling.
   Everything hangs off one global (MGS) so the game runs from file:// with no build step. */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  // Tuning dials. CHUNK_TILES must stay a multiple of ROAD_EVERY so city blocks
  // never straddle a chunk boundary (that would generate them twice).
  var CONFIG = {
    TILE: 120,
    CHUNK_TILES: 10,
    ROAD_EVERY: 5,
    VIEW_CHUNK_RADIUS: 2,
    FIXED_STEP: 1 / 60,
    MAX_STEPS: 5,
    VIEW_HEIGHT: 950,
    DESPAWN_RADIUS: 2600
  };
  CONFIG.CHUNK = CONFIG.TILE * CONFIG.CHUNK_TILES;

  var TAU = Math.PI * 2;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function lerp(a, b, t) { return a + (b - a) * t; }

  /* Frame-rate independent approach rate: pulls `a` toward `b` by `rate` per second. */
  function damp(a, b, rate, dt) { return lerp(a, b, 1 - Math.exp(-rate * dt)); }

  function angleDiff(a, b) {
    var d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  }

  function dist2(ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    return dx * dx + dy * dy;
  }

  /* Circle-vs-axis-aligned-rect overlap. Rects are {x,y,w,h} with x/y at top-left. */
  function circleRect(cx, cy, r, rect) {
    var nx = clamp(cx, rect.x, rect.x + rect.w);
    var ny = clamp(cy, rect.y, rect.y + rect.h);
    return dist2(cx, cy, nx, ny) < r * r;
  }

  /* Pushes a circle out of a rect and returns the surface normal it hit. */
  function resolveCircleRect(cx, cy, r, rect) {
    var nx = clamp(cx, rect.x, rect.x + rect.w);
    var ny = clamp(cy, rect.y, rect.y + rect.h);
    var dx = cx - nx, dy = cy - ny;
    var d = Math.hypot(dx, dy);
    if (d > r) return null;
    if (d > 0.0001) return { nx: dx / d, ny: dy / d, push: r - d };
    // Centre is inside the rect: eject along the shallowest axis.
    var left = cx - rect.x, right = rect.x + rect.w - cx;
    var top = cy - rect.y, bottom = rect.y + rect.h - cy;
    var m = Math.min(left, right, top, bottom);
    if (m === left) return { nx: -1, ny: 0, push: left + r };
    if (m === right) return { nx: 1, ny: 0, push: right + r };
    if (m === top) return { nx: 0, ny: -1, push: top + r };
    return { nx: 0, ny: 1, push: bottom + r };
  }

  /* --- Seeded randomness -------------------------------------------------- */

  /* xorshift32. Same seed always replays the same world. */
  function Rng(seed) {
    this.s = (seed | 0) || 0x9e3779b9;
  }
  Rng.prototype.next = function () {
    var x = this.s;
    x ^= x << 13; x |= 0;
    x ^= x >>> 17;
    x ^= x << 5; x |= 0;
    this.s = x;
    return (x >>> 0) / 4294967296;
  };
  Rng.prototype.range = function (lo, hi) { return lo + this.next() * (hi - lo); };
  Rng.prototype.int = function (lo, hi) { return Math.floor(this.range(lo, hi + 1)); };
  Rng.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
  Rng.prototype.chance = function (p) { return this.next() < p; };

  /* Stable hash of two integers -> [0,1). Lets any chunk be generated on demand
     without remembering what was generated before. */
  function hash2(x, y, seed) {
    var h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 2147483647;
    h = (h ^ (h >>> 13)) | 0;
    h = Math.imul(h, 1274126177) | 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  }

  function smoothstep(t) { return t * t * (3 - 2 * t); }

  /* Cheap value noise for biome blobs. */
  function noise2(x, y, seed) {
    var x0 = Math.floor(x), y0 = Math.floor(y);
    var fx = smoothstep(x - x0), fy = smoothstep(y - y0);
    var a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
    var c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  }

  /* --- Object pool -------------------------------------------------------- */

  /* Recycles objects instead of allocating them mid-run, so the garbage
     collector never stutters the frame. */
  function Pool(factory, reset) {
    this.factory = factory;
    this.reset = reset;
    this.free = [];
    this.active = [];
  }
  Pool.prototype.spawn = function () {
    var obj = this.free.length ? this.free.pop() : this.factory();
    this.reset(obj);
    obj.alive = true;
    this.active.push(obj);
    return obj;
  };
  Pool.prototype.release = function (obj) {
    obj.alive = false;
  };
  /* Call once per frame: moves dead objects back to the free list in place. */
  Pool.prototype.sweep = function () {
    var w = 0;
    for (var i = 0; i < this.active.length; i++) {
      var o = this.active[i];
      if (o.alive) this.active[w++] = o;
      else this.free.push(o);
    }
    this.active.length = w;
  };
  Pool.prototype.clear = function () {
    for (var i = 0; i < this.active.length; i++) this.free.push(this.active[i]);
    this.active.length = 0;
  };

  MGS.CONFIG = CONFIG;
  MGS.TAU = TAU;
  MGS.util = {
    clamp: clamp,
    lerp: lerp,
    damp: damp,
    angleDiff: angleDiff,
    dist2: dist2,
    circleRect: circleRect,
    resolveCircleRect: resolveCircleRect,
    hash2: hash2,
    noise2: noise2
  };
  MGS.Rng = Rng;
  MGS.Pool = Pool;
})(window.MGS);

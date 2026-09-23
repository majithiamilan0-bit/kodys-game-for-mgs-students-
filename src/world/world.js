/* Infinite, chunk-based world.

   The road grid is a pure function of tile coordinates, so it never has to be
   stored. Everything else (buildings, water, props, cash) is generated per chunk
   from a stable hash of that chunk's coordinates, which means the same seed
   always produces the same city and chunks can be thrown away and rebuilt
   identically when the player drives back. */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var C = MGS.CONFIG;
  var util = MGS.util;
  var TILE = C.TILE;
  var ROAD_SPACING = C.ROAD_EVERY * TILE;
  var HALF_ROAD = TILE / 2;

  var BIOMES = {
    city: { ground: '#48505c', ground2: '#424a55', road: '#2f353e' },
    grass: { ground: '#4f7a44', ground2: '#496f3f', road: '#39414a' },
    desert: { ground: '#c2a163', ground2: '#b8985c', road: '#4a4438' }
  };

  /* Which power-up a crate holds. MYSTERY is deliberately the most common so
     most crates are a surprise. */
  var CRATE_TABLE = [
    'mystery', 'mystery', 'mystery', 'mystery',
    'speed', 'speed', 'shield', 'drift', 'shooter', 'magnet', 'freeze', 'ghost'
  ];

  var chunks = new Map();
  var active = [];
  var seed = 1;

  function key(cx, cy) { return cx + ',' + cy; }

  function isRoadTile(tx, ty) {
    return (tx % C.ROAD_EVERY === 0) || (ty % C.ROAD_EVERY === 0);
  }

  function biomeFor(cx, cy) {
    var n = util.noise2(cx * 0.16, cy * 0.16, seed + 991);
    if (n < 0.44) return 'city';
    if (n < 0.76) return 'grass';
    return 'desert';
  }

  function obstacle(x, y, w, h, kind, color, height, opts) {
    opts = opts || {};
    return {
      x: x, y: y, w: w, h: h,
      kind: kind,
      color: color,
      height: height,
      solid: opts.solid !== false,
      deadly: !!opts.deadly,
      breakable: !!opts.breakable,
      ramp: !!opts.ramp,
      hp: opts.hp || 0,
      alive: true
    };
  }

  /* --- per-biome block filling ------------------------------------------- */

  function fillCityBlock(chunk, rng, bx, by, bw, bh) {
    var cols = rng.int(1, 2);
    var rows = rng.int(1, 2);
    var cw = bw / cols, ch = bh / rows;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (rng.chance(0.12)) continue; // a gap: car park / empty lot
        var pad = 10 + rng.next() * 14;
        var x = bx + c * cw + pad;
        var y = by + r * ch + pad;
        var w = cw - pad * 2;
        var h = ch - pad * 2;
        if (w < 40 || h < 40) continue;
        var shade = rng.int(0, 3);
        var palette = ['#6f7787', '#7d8698', '#5f6674', '#8a8172'];
        chunk.obstacles.push(
          obstacle(x, y, w, h, 'building', palette[shade], 60 + rng.next() * 150, { hp: 0 })
        );
      }
    }
  }

  function fillGrassBlock(chunk, rng, bx, by, bw, bh) {
    if (rng.chance(0.22)) {
      // Pond. Instant death on contact - for you and for anyone chasing you.
      var pw = bw * (0.45 + rng.next() * 0.4);
      var ph = bh * (0.45 + rng.next() * 0.4);
      chunk.obstacles.push(
        obstacle(bx + (bw - pw) / 2, by + (bh - ph) / 2, pw, ph, 'water', '#1a9be0', 0,
          { solid: false, deadly: true })
      );
      return;
    }
    var trees = rng.int(2, 7);
    for (var i = 0; i < trees; i++) {
      var s = 28 + rng.next() * 26;
      chunk.obstacles.push(
        obstacle(bx + rng.next() * (bw - s), by + rng.next() * (bh - s), s, s,
          'tree', '#2f6b32', 46 + rng.next() * 40, { breakable: true, hp: 1 })
      );
    }
    if (rng.chance(0.5)) {
      var horiz = rng.chance(0.5);
      var fw = horiz ? bw : 14;
      var fh = horiz ? 14 : bh;
      chunk.obstacles.push(
        obstacle(bx, by + (horiz ? bh * 0.5 : 0), fw, fh, 'fence', '#9a7d4f', 26,
          { breakable: true, hp: 1 })
      );
    }
  }

  function fillDesertBlock(chunk, rng, bx, by, bw, bh) {
    var rocks = rng.int(2, 6);
    for (var i = 0; i < rocks; i++) {
      var s = 34 + rng.next() * 46;
      chunk.obstacles.push(
        obstacle(bx + rng.next() * (bw - s), by + rng.next() * (bh - s), s, s,
          'rock', '#8d7f6b', 34 + rng.next() * 56)
      );
    }
    for (var j = 0; j < 3; j++) {
      if (!rng.chance(0.5)) continue;
      chunk.obstacles.push(
        obstacle(bx + rng.next() * (bw - 20), by + rng.next() * (bh - 20), 20, 20,
          'cactus', '#3f7a44', 54, { breakable: true, hp: 1 })
      );
    }
  }

  /* A rare walled compound stuffed with cash - the reward for exploring. */
  function buildSecret(chunk, rng, bx, by, bw, bh) {
    var wall = 16;
    chunk.obstacles.push(obstacle(bx, by, bw, wall, 'wall', '#b5b0a2', 44));
    chunk.obstacles.push(obstacle(bx, by + bh - wall, bw, wall, 'wall', '#b5b0a2', 44));
    chunk.obstacles.push(obstacle(bx, by, wall, bh, 'wall', '#b5b0a2', 44));
    chunk.obstacles.push(obstacle(bx, by + bh * 0.62, wall, bh * 0.38, 'wall', '#b5b0a2', 44));
    for (var i = 0; i < 9; i++) {
      chunk.pickups.push({
        x: bx + wall + 30 + rng.next() * (bw - wall * 2 - 60),
        y: by + wall + 30 + rng.next() * (bh - wall * 2 - 60),
        taken: false
      });
    }
    // Every compound is guaranteed a power-up - that is the point of finding one.
    chunk.crates.push({
      x: bx + bw * 0.5, y: by + bh * 0.72,
      type: rng.pick(CRATE_TABLE), taken: false
    });
    chunk.obstacles.push(
      obstacle(bx + bw * 0.4, by + bh * 0.4, 70, 70, 'crate', '#c8a24a', 40,
        { breakable: true, hp: 1 })
    );
  }

  /* --- chunk generation --------------------------------------------------- */

  function generate(cx, cy) {
    var rng = new MGS.Rng(Math.floor(util.hash2(cx, cy, seed) * 0xffffffff) || 1);
    var chunk = {
      cx: cx, cy: cy,
      x: cx * C.CHUNK, y: cy * C.CHUNK,
      biome: biomeFor(cx, cy),
      secret: util.hash2(cx, cy, seed + 4242) < 0.045,
      obstacles: [],
      pickups: [],
      crates: []
    };

    var blocksPerChunk = C.CHUNK_TILES / C.ROAD_EVERY;
    for (var byi = 0; byi < blocksPerChunk; byi++) {
      for (var bxi = 0; bxi < blocksPerChunk; bxi++) {
        // Blocks sit between the roads: skip the road tile on each leading edge.
        var bx = chunk.x + (bxi * C.ROAD_EVERY + 1) * TILE;
        var by = chunk.y + (byi * C.ROAD_EVERY + 1) * TILE;
        var bw = (C.ROAD_EVERY - 1) * TILE;
        var bh = (C.ROAD_EVERY - 1) * TILE;

        if (chunk.secret && bxi === 0 && byi === 0) {
          buildSecret(chunk, rng, bx, by, bw, bh);
        } else if (chunk.biome === 'city') {
          fillCityBlock(chunk, rng, bx, by, bw, bh);
        } else if (chunk.biome === 'grass') {
          fillGrassBlock(chunk, rng, bx, by, bw, bh);
        } else {
          fillDesertBlock(chunk, rng, bx, by, bw, bh);
        }
      }
    }

    // Cash and ramps live on the road surface.
    for (var ty = 0; ty < C.CHUNK_TILES; ty++) {
      for (var tx = 0; tx < C.CHUNK_TILES; tx++) {
        var wtx = cx * C.CHUNK_TILES + tx;
        var wty = cy * C.CHUNK_TILES + ty;
        if (!isRoadTile(wtx, wty)) continue;

        var px = wtx * TILE + TILE / 2;
        var py = wty * TILE + TILE / 2;
        var junction = (wtx % C.ROAD_EVERY === 0) && (wty % C.ROAD_EVERY === 0);

        if (junction && rng.chance(0.3)) {
          for (var k = 0; k < 4; k++) {
            chunk.pickups.push({
              x: px + (k % 2 ? 26 : -26),
              y: py + (k < 2 ? -26 : 26),
              taken: false
            });
          }
        } else if (!junction && rng.chance(0.2)) {
          chunk.pickups.push({ x: px, y: py, taken: false });
        }

        if (!junction && rng.chance(0.02)) {
          chunk.obstacles.push(
            obstacle(px - 44, py - 30, 88, 60, 'ramp', '#c46b2a', 30,
              { solid: false, ramp: true })
          );
        } else if (!junction && rng.chance(0.035)) {
          chunk.crates.push({ x: px, y: py, type: rng.pick(CRATE_TABLE), taken: false });
        }
      }
    }

    return chunk;
  }

  /* --- public API --------------------------------------------------------- */

  var World = {
    BIOMES: BIOMES,
    ROAD_SPACING: ROAD_SPACING,

    reset: function (newSeed) {
      seed = (newSeed | 0) || 1;
      chunks.clear();
      active.length = 0;
    },

    activeChunks: function () { return active; },

    /* Keep a ring of chunks alive around the player; drop the rest. */
    update: function (px, py) {
      var pcx = Math.floor(px / C.CHUNK);
      var pcy = Math.floor(py / C.CHUNK);
      var r = C.VIEW_CHUNK_RADIUS;

      active.length = 0;
      for (var cy = pcy - r; cy <= pcy + r; cy++) {
        for (var cx = pcx - r; cx <= pcx + r; cx++) {
          var k = key(cx, cy);
          var chunk = chunks.get(k);
          if (!chunk) {
            chunk = generate(cx, cy);
            chunks.set(k, chunk);
          }
          active.push(chunk);
        }
      }

      if (chunks.size > (2 * r + 1) * (2 * r + 1) + 16) {
        chunks.forEach(function (chunk, k) {
          if (Math.abs(chunk.cx - pcx) > r + 1 || Math.abs(chunk.cy - pcy) > r + 1) {
            chunks.delete(k);
          }
        });
      }
    },

    biomeAt: function (x, y) {
      return biomeFor(Math.floor(x / C.CHUNK), Math.floor(y / C.CHUNK));
    },

    isRoad: function (x, y) {
      return isRoadTile(Math.floor(x / TILE), Math.floor(y / TILE));
    },

    /* Nearest road centreline position - used to place traffic and roadblocks. */
    snapToRoad: function (x, y, preferVertical) {
      if (preferVertical) {
        var k = Math.round((x - HALF_ROAD) / ROAD_SPACING);
        return { x: k * ROAD_SPACING + HALF_ROAD, y: y, vertical: true };
      }
      var j = Math.round((y - HALF_ROAD) / ROAD_SPACING);
      return { x: x, y: j * ROAD_SPACING + HALF_ROAD, vertical: false };
    },

    /* Collects obstacles whose chunk is near the point. Callers do the precise
       test; this just keeps it to a few dozen candidates instead of thousands. */
    obstaclesNear: function (x, y, out) {
      out.length = 0;
      var pcx = Math.floor(x / C.CHUNK);
      var pcy = Math.floor(y / C.CHUNK);
      for (var i = 0; i < active.length; i++) {
        var chunk = active[i];
        if (Math.abs(chunk.cx - pcx) > 1 || Math.abs(chunk.cy - pcy) > 1) continue;
        var obs = chunk.obstacles;
        for (var j = 0; j < obs.length; j++) {
          if (obs[j].alive) out.push(obs[j]);
        }
      }
      return out;
    },

    /* Cash pickups the player is close enough to hoover up. */
    collectPickups: function (x, y, radius, onTake) {
      var r2 = radius * radius;
      for (var i = 0; i < active.length; i++) {
        var list = active[i].pickups;
        for (var j = 0; j < list.length; j++) {
          var p = list[j];
          if (p.taken) continue;
          if (util.dist2(x, y, p.x, p.y) < r2) {
            p.taken = true;
            onTake(p);
          }
        }
      }
    },

    /* Power-up crates. Never magnetised - you have to actually drive over them. */
    collectCrates: function (x, y, radius, onTake) {
      var r2 = radius * radius;
      for (var i = 0; i < active.length; i++) {
        var list = active[i].crates;
        for (var j = 0; j < list.length; j++) {
          var c = list[j];
          if (c.taken) continue;
          if (util.dist2(x, y, c.x, c.y) < r2) {
            c.taken = true;
            onTake(c);
          }
        }
      }
    }
  };

  MGS.World = World;
})(window.MGS);

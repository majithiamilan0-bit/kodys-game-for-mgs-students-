/* Civilian traffic. Pooled, spawned just outside the view on road centrelines,
   recycled once it falls behind. Smashing one is free chaos - no score, but a
   very satisfying explosion and a good way to block the cops behind you. */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var util = MGS.util;
  var COLORS = ['#b6c2cf', '#d8d3c6', '#7f95ad', '#c98b5a', '#8fae86', '#c4c4c4', '#9a7fae'];
  var TARGET_COUNT = 16;
  var SPAWN_MIN = 900;
  var SPAWN_MAX = 1700;

  function newCar() {
    return { x: 0, y: 0, prevX: 0, prevY: 0, angle: 0, vx: 0, vy: 0,
             w: 48, h: 27, color: '#ccc', hp: 1, alive: false };
  }
  function resetCar(c) {
    c.x = c.y = c.prevX = c.prevY = 0;
    c.angle = 0; c.vx = c.vy = 0;
    c.w = 48; c.h = 27; c.hp = 1;
  }

  var pool = new MGS.Pool(newCar, resetCar);
  var rng = new MGS.Rng(7);
  var scratch = [];

  function spawnOne(player, world) {
    var a = rng.range(0, MGS.TAU);
    var r = rng.range(SPAWN_MIN, SPAWN_MAX);
    var vertical = rng.chance(0.5);
    var snapped = world.snapToRoad(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r, vertical);

    if (util.dist2(snapped.x, snapped.y, player.x, player.y) < SPAWN_MIN * SPAWN_MIN) return;

    var c = pool.spawn();
    c.x = c.prevX = snapped.x;
    c.y = c.prevY = snapped.y;
    var dir = rng.chance(0.5) ? 1 : -1;
    c.angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    var speed = rng.range(110, 210);
    c.vx = Math.cos(c.angle) * speed;
    c.vy = Math.sin(c.angle) * speed;
    c.color = rng.pick(COLORS);
    c.w = rng.chance(0.2) ? 62 : 48;
    c.h = 27;
  }

  var Traffic = {
    pool: pool,

    reset: function (seed) {
      pool.clear();
      rng = new MGS.Rng((seed | 0) || 7);
    },

    update: function (dt, player, world, effects, onSmash) {
      var list = pool.active;
      var i, c;

      for (i = 0; i < list.length; i++) {
        c = list[i];
        c.prevX = c.x;
        c.prevY = c.y;
        c.x += c.vx * dt;
        c.y += c.vy * dt;

        if (util.dist2(c.x, c.y, player.x, player.y) > MGS.CONFIG.DESPAWN_RADIUS * MGS.CONFIG.DESPAWN_RADIUS) {
          pool.release(c);
          continue;
        }

        // Traffic parks itself against walls rather than driving through them.
        var obs = world.obstaclesNear(c.x, c.y, scratch);
        for (var j = 0; j < obs.length; j++) {
          var o = obs[j];
          if (!o.solid || o.ramp) continue;
          if (util.circleRect(c.x, c.y, 18, o)) {
            c.vx *= 0.2;
            c.vy *= 0.2;
            break;
          }
        }

        // Player impact.
        if (!player.dead) {
          var reach = player.radius + 24;
          if (util.dist2(c.x, c.y, player.x, player.y) < reach * reach && player.air <= 0) {
            var rel = Math.hypot(player.vx - c.vx, player.vy - c.vy);
            effects.explosion(c.x, c.y, 0.7);
            MGS.Audio.explosion();
            pool.release(c);
            if (player.vehicle.ability !== 'ram') {
              player.damage(util.clamp(rel * 0.045, 2, 26));
              player.vx *= 0.7;
              player.vy *= 0.7;
            }
            if (onSmash) onSmash(c);
            continue;
          }
        }
      }
      pool.sweep();

      while (pool.active.length < TARGET_COUNT) {
        var before = pool.active.length;
        spawnOne(player, world);
        if (pool.active.length === before) break; // spawn point was rejected
      }
    },

    /* Pursuers use this so they can crash into traffic too. */
    hitTest: function (x, y, r) {
      var list = pool.active;
      var r2 = r * r;
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (util.dist2(x, y, c.x, c.y) < r2) return c;
      }
      return null;
    },

    destroy: function (c, effects) {
      pool.release(c);
      effects.explosion(c.x, c.y, 0.7);
      MGS.Audio.explosion();
    }
  };

  MGS.Traffic = Traffic;
})(window.MGS);

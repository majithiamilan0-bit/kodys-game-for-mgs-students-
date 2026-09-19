/* Everything that is trying to stop you: police, SWAT, army, tanks, the
   helicopter, roadblocks and shells.

   Ground units all use the same "pursue" steering behaviour - aim at where the
   player WILL be, not where they are - with obstacle avoidance layered on top.
   Higher heat levels just swap in tougher unit types and let more of them spawn. */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var util = MGS.util;

  /* Pursuers are deliberately slower than almost every player car - they win by
     numbers, roadblocks and boxing you in, not by out-running you. */
  var TYPES = {
    police: { hp: 3, top: 332, accel: 270, turn: 2.4, w: 48, h: 27,
              body: '#22429b', roof: '#e8edf4', trim: '#12203f', ram: 9 },
    swat:   { hp: 8, top: 326, accel: 250, turn: 2.1, w: 55, h: 31,
              body: '#232d3a', roof: '#39485c', trim: '#0f151d', ram: 14 },
    army:   { hp: 14, top: 318, accel: 235, turn: 1.9, w: 59, h: 34,
              body: '#4e5a33', roof: '#68764a', trim: '#2a3020', ram: 20 },
    tank:   { hp: 34, top: 214, accel: 130, turn: 1.1, w: 64, h: 48,
              body: '#404a2c', roof: '#59653c', trim: '#232a18', ram: 34, shoots: true }
  };

  /* One row per heat level. `max` is how many ground units can be on you at once. */
  var LEVELS = [
    { max: 2, mix: ['police'] },
    { max: 4, mix: ['police'] },
    { max: 5, mix: ['police', 'police', 'swat'] },
    { max: 6, mix: ['police', 'swat', 'swat'] },
    { max: 7, mix: ['swat', 'army', 'army'] },
    { max: 8, mix: ['army', 'army', 'tank'] }
  ];

  var SPAWN_RING = 1250;
  /* Score is seconds survived, so wrecking a pursuer pays in cash instead. */
  var CASH_PER_KILL = 8;

  /* --- pools -------------------------------------------------------------- */

  function newUnit() {
    return { x: 0, y: 0, prevX: 0, prevY: 0, angle: 0, speed: 0, type: 'police',
             hp: 1, maxHp: 1, w: 48, h: 27, blocker: false, spin: 0, fire: 0,
             offsetAngle: 0, hitFlash: 0, alive: false };
  }
  function resetUnit(u) {
    u.x = u.y = u.prevX = u.prevY = 0;
    u.angle = 0; u.speed = 0; u.hp = u.maxHp = 1;
    u.blocker = false; u.spin = 0; u.fire = 0; u.hitFlash = 0;
    u.offsetAngle = Math.random() * MGS.TAU;
  }

  function newShell() {
    return { x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0, life: 0,
             friendly: false, alive: false };
  }
  function resetShell(s) {
    s.x = s.y = s.prevX = s.prevY = s.vx = s.vy = 0;
    s.life = 3;
    s.friendly = false;
  }

  var units = new MGS.Pool(newUnit, resetUnit);
  var shells = new MGS.Pool(newShell, resetShell);
  var rng = new MGS.Rng(11);
  var scratch = [];

  var heli = null;
  var spawnTimer = 0;
  var blockTimer = 0;

  /* --- spawning ----------------------------------------------------------- */

  function makeUnit(type, x, y, blocker) {
    var t = TYPES[type];
    var u = units.spawn();
    u.type = type;
    u.x = u.prevX = x;
    u.y = u.prevY = y;
    u.hp = u.maxHp = t.hp;
    u.w = t.w;
    u.h = t.h;
    u.blocker = !!blocker;
    u.speed = blocker ? 0 : t.top * 0.5;
    u.angle = rng.range(0, MGS.TAU);
    u.fire = rng.range(1.5, 3.5);
    return u;
  }

  function spawnChaser(player, level) {
    var mix = LEVELS[level - 1].mix;
    var type = mix[rng.int(0, mix.length - 1)];
    // Spawn behind the player where possible, so they arrive in the mirror.
    var back = Math.atan2(-player.vy, -player.vx);
    if (!isFinite(back)) back = rng.range(0, MGS.TAU);
    var a = back + rng.range(-1.1, 1.1);
    makeUnit(type, player.x + Math.cos(a) * SPAWN_RING, player.y + Math.sin(a) * SPAWN_RING, false);
  }

  function spawnRoadblock(player, world, level) {
    var speed = Math.hypot(player.vx, player.vy);
    if (speed < 60) return;
    var heading = Math.atan2(player.vy, player.vx);
    var ahead = 1150;
    var px = player.x + Math.cos(heading) * ahead;
    var py = player.y + Math.sin(heading) * ahead;

    // Block the road the player is most likely to be travelling along.
    var vertical = Math.abs(player.vy) > Math.abs(player.vx);
    var spot = world.snapToRoad(px, py, vertical);
    var type = level >= 6 ? 'tank' : (level >= 5 ? 'army' : (level >= 3 ? 'swat' : 'police'));

    for (var i = -1; i <= 1; i++) {
      var ox = vertical ? i * 34 : 0;
      var oy = vertical ? 0 : i * 34;
      var u = makeUnit(type, spot.x + ox, spot.y + oy, true);
      u.angle = vertical ? 0 : Math.PI / 2;
    }
  }

  function ensureHeli(player) {
    if (heli) return;
    heli = {
      x: player.x, y: player.y - 600,
      prevX: player.x, prevY: player.y - 600,
      angle: 0, rotor: 0,
      orbit: Math.random() * MGS.TAU,   // keeps it off the player's own car
      aimTimer: 3.5,
      target: null                      // { x, y, t } while a shot is telegraphed
    };
  }

  /* --- per-unit AI --------------------------------------------------------- */

  function steerUnit(u, dt, player, world, effects, level, slowMult) {
    var t = TYPES[u.type];

    if (u.spin > 0) {
      // Hit oil or ice, or caught an EMP: no control until it wears off.
      u.spin -= dt;
      u.angle += 9 * dt;
      u.speed *= Math.exp(-2.2 * dt);
    } else {
      // Pursue: aim at where the player will be, not where they are.
      var lead = util.clamp(Math.hypot(player.x - u.x, player.y - u.y) / 700, 0.1, 0.9);
      var pred = player.predict(lead);
      var tx = pred.x, ty = pred.y;

      // A dropped decoy pulls them off you entirely.
      var decoy = MGS.Hazards.nearestDecoy(u.x, u.y, 620);
      if (decoy) { tx = decoy.x; ty = decoy.y; }

      // Ghost Protocol / the PHASE power-up: they lose you and scatter.
      if (player.ab.stealth > 0) {
        tx = u.x + Math.cos(u.offsetAngle * 3) * 400;
        ty = u.y + Math.sin(u.offsetAngle * 3) * 400;
      } else if (level >= 3 && !u.blocker) {
        // From heat 3 the pack spreads out and tries to box the player in.
        var ring = 130;
        tx += Math.cos(u.offsetAngle) * ring;
        ty += Math.sin(u.offsetAngle) * ring;
        u.offsetAngle += 0.5 * dt;
      }

      var desired = Math.atan2(ty - u.y, tx - u.x);

      // Obstacle avoidance: probe ahead, and if it is blocked, swing wide.
      var probeDist = 90 + u.speed * 0.35;
      var probeX = u.x + Math.cos(u.angle) * probeDist;
      var probeY = u.y + Math.sin(u.angle) * probeDist;
      var obs = world.obstaclesNear(probeX, probeY, scratch);
      for (var i = 0; i < obs.length; i++) {
        var o = obs[i];
        if ((!o.solid && !o.deadly) || o.ramp) continue;
        if (util.circleRect(probeX, probeY, 30, o)) {
          var away = Math.atan2(u.y - (o.y + o.h / 2), u.x - (o.x + o.w / 2));
          desired = away + (util.angleDiff(away, desired) > 0 ? 0.9 : -0.9);
          break;
        }
      }

      if (u.blocker) {
        u.speed = util.damp(u.speed, 0, 4, dt);
      } else {
        u.angle += util.clamp(util.angleDiff(u.angle, desired), -t.turn * dt, t.turn * dt);
        u.speed = Math.min(t.top, u.speed + t.accel * dt);
      }
    }

    u.prevX = u.x;
    u.prevY = u.y;
    u.x += Math.cos(u.angle) * u.speed * slowMult * dt;
    u.y += Math.sin(u.angle) * u.speed * slowMult * dt;
    u.hitFlash = Math.max(0, u.hitFlash - dt);
  }

  function unitHitsWorld(u, world, effects) {
    var obs = world.obstaclesNear(u.x, u.y, scratch);
    var r = Math.max(u.w, u.h) * 0.4;
    for (var i = 0; i < obs.length; i++) {
      var o = obs[i];
      if (o.ramp) continue;

      if (o.deadly) {
        if (util.circleRect(u.x, u.y, r * 0.6, o)) {
          effects.smoke(u.x, u.y, 10, '#9fd4f2');
          MGS.Audio.crash(0.4);
          return 'drowned';
        }
        continue;
      }
      if (!o.solid) continue;

      var hit = util.resolveCircleRect(u.x, u.y, r, o);
      if (!hit) continue;

      if (o.breakable) {
        o.alive = false;
        effects.debris(o.x + o.w / 2, o.y + o.h / 2, 5, o.color);
        continue;
      }

      u.x += hit.nx * hit.push;
      u.y += hit.ny * hit.push;
      u.speed *= 0.45;
      u.angle += (Math.random() - 0.5) * 0.5;
    }
    return null;
  }

  /* --- module -------------------------------------------------------------- */

  var Pursuit = {
    units: units,
    shells: shells,
    CASH_PER_KILL: CASH_PER_KILL,

    reset: function (seed) {
      units.clear();
      shells.clear();
      rng = new MGS.Rng((seed | 0) || 11);
      heli = null;
      spawnTimer = 1.2;
      blockTimer = 7;
    },

    heli: function () { return heli; },
    count: function () { return units.active.length; },

    /* cb: { onKill(unit), onPlayerHit(amount) } */
    update: function (dt, player, world, effects, level, cb) {
      var list = units.active;
      var i, u;

      // --- spawn pressure ---------------------------------------------------
      var cfg = LEVELS[util.clamp(level, 1, 6) - 1];
      var chasers = 0;
      for (i = 0; i < list.length; i++) if (!list[i].blocker) chasers++;

      spawnTimer -= dt;
      if (spawnTimer <= 0 && chasers < cfg.max && !player.dead) {
        spawnTimer = util.clamp(2.4 - level * 0.22, 0.7, 2.4);
        spawnChaser(player, util.clamp(level, 1, 6));
      }

      if (level >= 2) {
        ensureHeli(player);
        blockTimer -= dt;
        if (blockTimer <= 0 && !player.dead) {
          blockTimer = util.clamp(14 - level * 1.3, 5, 14);
          spawnRoadblock(player, world, level);
        }
      }

      // Time Warp and the FREEZE power-up both just slow everyone else down.
      var slowMult = (player.ab.warp > 0 ? 0.35 : 1) * MGS.Powerups.enemySlow();

      // --- ground units -----------------------------------------------------
      for (i = 0; i < list.length; i++) {
        u = list[i];
        steerUnit(u, dt, player, world, effects, level, slowMult);

        if (unitHitsWorld(u, world, effects) === 'drowned') {
          MGS.Objectives.note('drown');
          Pursuit.kill(u, effects, cb);
          continue;
        }

        // Despawn stragglers so the pool never grows without bound.
        if (util.dist2(u.x, u.y, player.x, player.y) >
            MGS.CONFIG.DESPAWN_RADIUS * MGS.CONFIG.DESPAWN_RADIUS) {
          units.release(u);
          continue;
        }

        // Pursuers plough through traffic too.
        var car = MGS.Traffic.hitTest(u.x, u.y, Math.max(u.w, u.h) * 0.45 + 22);
        if (car) {
          MGS.Traffic.destroy(car, effects);
          u.speed *= 0.6;
          u.hp -= 1;
          if (u.hp <= 0) { Pursuit.kill(u, effects, cb); continue; }
        }

        // Tanks shell the player from range.
        if (TYPES[u.type].shoots && !player.dead && u.spin <= 0) {
          u.fire -= dt;
          if (u.fire <= 0) {
            u.fire = rng.range(2.2, 3.4);
            Pursuit.fireShell(u.x, u.y, player.predict(0.55), 520, false);
            MGS.Audio.cannon();
            effects.smoke(u.x, u.y, 3, '#6b6352');
          }
        }

        // Contact with the player.
        if (!player.dead && player.air <= 0 && !MGS.Powerups.phasing()) {
          var reach = player.radius + Math.max(u.w, u.h) * 0.42;
          if (util.dist2(u.x, u.y, player.x, player.y) < reach * reach) {
            var rel = Math.hypot(player.vx - Math.cos(u.angle) * u.speed,
                                 player.vy - Math.sin(u.angle) * u.speed);

            if (MGS.Abilities.killsOnContact(player)) {
              if (u.blocker) MGS.Objectives.note('blocker');
              Pursuit.kill(u, effects, cb);
              continue;
            }

            // Both sides take it. Hitting them hard and fast wins the trade.
            var dealt = (player.speed > 260 ? 2 : 1) * MGS.Abilities.contactDamageMult(player);
            u.hp -= dealt;
            u.hitFlash = 0.15;
            u.speed *= 0.5;

            if (MGS.Abilities.knocksAside(player)) {
              // The limo flings them clear instead of trading paint.
              var away = Math.atan2(u.y - player.y, u.x - player.x);
              u.x += Math.cos(away) * 46;
              u.y += Math.sin(away) * 46;
              u.spin = 1.4;
              player.damage(util.clamp(TYPES[u.type].ram * 0.25, 1, 10));
            } else {
              player.damage(util.clamp(TYPES[u.type].ram * (0.5 + rel / 700), 3, 40));
            }

            player.vx *= 0.82;
            player.vy *= 0.82;
            effects.debris(player.x, player.y, 5, '#e2dccb');
            effects.shakeBy(7);
            MGS.Audio.crash(util.clamp(rel / 700, 0.2, 1));
            if (cb && cb.onPlayerHit) cb.onPlayerHit();
            if (u.hp <= 0) {
              if (u.blocker) MGS.Objectives.note('blocker');
              Pursuit.kill(u, effects, cb);
              continue;
            }
          }
        }
      }
      units.sweep();

      // --- helicopter --------------------------------------------------------
      if (heli) Pursuit.updateHeli(dt, player, effects, level, cb);

      // --- player rockets ----------------------------------------------------
      if (player.vehicle.ability === 'rockets' && player.rocketTimer <= 0 && !player.dead) {
        var target = Pursuit.nearest(player.x, player.y, 900);
        if (target) {
          player.rocketTimer = 1.7;
          Pursuit.fireShell(player.x, player.y, target, 700, true);
          MGS.Audio.cannon();
        }
      }

      Pursuit.updateShells(dt, player, effects, cb);
    },

    nearest: function (x, y, maxDist) {
      var list = units.active;
      var best = null, bestD = maxDist * maxDist;
      for (var i = 0; i < list.length; i++) {
        var d = util.dist2(x, y, list[i].x, list[i].y);
        if (d < bestD) { bestD = d; best = list[i]; }
      }
      return best;
    },

    fireShell: function (x, y, target, speed, friendly) {
      var s = shells.spawn();
      var a = Math.atan2(target.y - y, target.x - x);
      s.x = s.prevX = x;
      s.y = s.prevY = y;
      s.vx = Math.cos(a) * speed;
      s.vy = Math.sin(a) * speed;
      s.life = 2.6;
      s.friendly = friendly;
    },

    updateShells: function (dt, player, effects, cb) {
      var list = shells.active;
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        s.prevX = s.x; s.prevY = s.y;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt;

        var boom = false;
        if (s.life <= 0) boom = true;

        if (!boom && s.friendly) {
          var hit = Pursuit.nearest(s.x, s.y, 34);
          if (hit) {
            hit.hp -= 6;
            hit.hitFlash = 0.2;
            boom = true;
            if (hit.hp <= 0) Pursuit.kill(hit, effects, cb);
          }
        } else if (!boom && !player.dead) {
          var r = player.radius + 16;
          if (util.dist2(s.x, s.y, player.x, player.y) < r * r) {
            player.damage(26);
            boom = true;
          }
        }

        if (boom) {
          effects.explosion(s.x, s.y, 0.8);
          MGS.Audio.explosion();
          shells.release(s);
        }
      }
      shells.sweep();
    },

    updateHeli: function (dt, player, effects, level, cb) {
      heli.prevX = heli.x;
      heli.prevY = heli.y;
      // Circles the player with a lag, so it swings in and overshoots without
      // ever parking itself on top of the car you are trying to look at.
      heli.orbit += dt * 0.55;
      var lead = player.predict(0.9);
      heli.x = util.damp(heli.x, lead.x + Math.cos(heli.orbit) * 190, 1.5, dt);
      heli.y = util.damp(heli.y, lead.y + Math.sin(heli.orbit) * 190, 1.5, dt);
      heli.rotor += dt * 22;
      heli.angle = Math.atan2(heli.y - heli.prevY, heli.x - heli.prevX) || heli.angle;

      if (level < 5 || player.dead) { heli.target = null; return; }

      if (heli.target) {
        heli.target.t -= dt;
        if (heli.target.t <= 0) {
          effects.explosion(heli.target.x, heli.target.y, 1.1);
          MGS.Audio.explosion();
          var r = 95;
          if (util.dist2(heli.target.x, heli.target.y, player.x, player.y) < r * r) {
            player.damage(30);
            if (cb && cb.onPlayerHit) cb.onPlayerHit();
          }
          heli.target = null;
          heli.aimTimer = 3.2;
        }
      } else {
        heli.aimTimer -= dt;
        if (heli.aimTimer <= 0) {
          var aim = player.predict(1.1);
          heli.target = { x: aim.x, y: aim.y, t: 1.2 };
        }
      }
    },

    kill: function (u, effects, cb) {
      if (!u.alive) return;
      units.release(u);
      effects.explosion(u.x, u.y, u.type === 'tank' ? 1.4 : 1);
      MGS.Audio.explosion();
      effects.popText(u.x, u.y - 20, '+$' + CASH_PER_KILL);
      if (cb && cb.onKill) cb.onKill(u);
    },

    TYPES: TYPES
  };

  MGS.Pursuit = Pursuit;
})(window.MGS);

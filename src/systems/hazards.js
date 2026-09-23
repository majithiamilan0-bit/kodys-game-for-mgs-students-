/* Things the player leaves behind them on the road.

   Oil, ice, fire, mines and decoys all behave differently but share one pooled
   list, so cars that drop stuff never allocate mid-run. */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var util = MGS.util;

  var SPEC = {
    oil:   { r: 46, life: 9,  color: '#12141a' },
    ice:   { r: 44, life: 10, color: '#bfe9ff' },
    fire:  { r: 38, life: 3.5, color: '#ff7a1a' },
    mine:  { r: 22, life: 14, color: '#c8462e' },
    decoy: { r: 30, life: 6,  color: '#e2dccb' }
  };

  function newHazard() {
    return { x: 0, y: 0, r: 40, life: 0, maxLife: 1, kind: 'oil', alive: false };
  }
  function resetHazard(h) {
    h.x = h.y = 0; h.r = 40; h.life = h.maxLife = 1; h.kind = 'oil';
  }

  var pool = new MGS.Pool(newHazard, resetHazard);

  var Hazards = {
    pool: pool,
    SPEC: SPEC,

    reset: function () { pool.clear(); },

    drop: function (kind, x, y) {
      var spec = SPEC[kind];
      var h = pool.spawn();
      h.kind = kind;
      h.x = x;
      h.y = y;
      h.r = spec.r;
      h.life = h.maxLife = spec.life;
      return h;
    },

    /* Pursuit AI steers at the newest decoy instead of the player. */
    nearestDecoy: function (x, y, maxDist) {
      var list = pool.active, best = null, bestD = maxDist * maxDist;
      for (var i = 0; i < list.length; i++) {
        if (list[i].kind !== 'decoy') continue;
        var d = util.dist2(x, y, list[i].x, list[i].y);
        if (d < bestD) { bestD = d; best = list[i]; }
      }
      return best;
    },

    update: function (dt, units, effects, onKill) {
      var list = pool.active;
      for (var i = 0; i < list.length; i++) {
        var h = list[i];
        h.life -= dt;
        if (h.life <= 0) { pool.release(h); continue; }

        if (h.kind === 'decoy') continue; // handled by the AI, not by contact

        for (var j = 0; j < units.length; j++) {
          var u = units[j];
          var reach = h.r + Math.max(u.w, u.h) * 0.4;
          if (util.dist2(h.x, h.y, u.x, u.y) > reach * reach) continue;

          if (h.kind === 'oil') {
            if (u.spin <= 0) {
              u.spin = 2.2;
              effects.smoke(u.x, u.y, 3, '#2a2f38');
            }
          } else if (h.kind === 'ice') {
            if (u.spin <= 0) {
              u.spin = 1.7;
              u.speed *= 0.6;
              effects.debris(u.x, u.y, 4, '#bfe9ff');
            }
          } else if (h.kind === 'fire') {
            u.hp -= 9 * dt;
            u.hitFlash = 0.1;
            if (Math.random() < 0.3) effects.smoke(u.x, u.y, 1, '#ff9f45');
            if (u.hp <= 0) { MGS.Pursuit.kill(u, effects, { onKill: onKill }); }
          } else if (h.kind === 'mine') {
            effects.explosion(h.x, h.y, 1.1);
            MGS.Audio.explosion();
            u.hp -= 14;
            u.hitFlash = 0.2;
            u.speed *= 0.3;
            pool.release(h);
            if (u.hp <= 0) { MGS.Pursuit.kill(u, effects, { onKill: onKill }); }
            break;
          }
        }
      }
      pool.sweep();
    }
  };

  MGS.Hazards = Hazards;
})(window.MGS);

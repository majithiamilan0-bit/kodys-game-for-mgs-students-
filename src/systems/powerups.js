/* Power-up crates you drive over during a run.

   These are temporary and are NEVER bought - they only appear in the world.
   A crate is a blue box on the road; MYSTERY rolls into one of the others the
   instant you touch it. */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var util = MGS.util;

  var TYPES = {
    speed:   { label: 'OVERDRIVE', time: 8,  color: '#ff7a1a', icon: '>>' },
    shield:  { label: 'INVULNERABLE', time: 6, color: '#35c66b', icon: '[]' },
    drift:   { label: 'DRIFT MODE', time: 10, color: '#e0367c', icon: '~' },
    shooter: { label: 'GUNNER', time: 10, color: '#ffc531', icon: '*' },
    magnet:  { label: 'MAGNET', time: 12, color: '#4fa8f5', icon: 'U' },
    freeze:  { label: 'FREEZE', time: 6,  color: '#8beaf2', icon: '#' },
    ghost:   { label: 'PHASE', time: 7,  color: '#b978f0', icon: 'O' }
  };

  var ROLLABLE = ['speed', 'shield', 'drift', 'shooter', 'magnet', 'freeze', 'ghost'];

  var timers = {};      // type -> seconds remaining
  var maxTimers = {};   // type -> the duration it started at
  var shootTimer = 0;

  var Powerups = {
    TYPES: TYPES,
    ROLLABLE: ROLLABLE,

    reset: function () {
      timers = {};
      maxTimers = {};
      shootTimer = 0;
    },

    /* 'mystery' rolls immediately so the player always sees what they got. */
    collect: function (type, player, ctx) {
      var rolled = type === 'mystery'
        ? ROLLABLE[Math.floor(Math.random() * ROLLABLE.length)]
        : type;
      var spec = TYPES[rolled];
      timers[rolled] = spec.time;
      maxTimers[rolled] = spec.time;

      ctx.effects.popText(player.x, player.y - 42, spec.label, spec.color);
      ctx.effects.debris(player.x, player.y, 10, spec.color);
      ctx.effects.shakeBy(5);
      MGS.Audio.unlockJingle();
      return rolled;
    },

    update: function (dt, player, ctx) {
      for (var k in timers) {
        timers[k] -= dt;
        if (timers[k] <= 0) delete timers[k];
      }

      if (timers.ghost && Math.random() < 0.4) {
        ctx.effects.smoke(player.x, player.y, 1, '#b978f0');
      }

      // GUNNER fires on its own, separately from the Salvo's built-in rockets.
      if (timers.shooter) {
        shootTimer -= dt;
        if (shootTimer <= 0) {
          var target = MGS.Pursuit.nearest(player.x, player.y, 950);
          if (target) {
            shootTimer = 0.55;
            MGS.Pursuit.fireShell(player.x, player.y, target, 780, true);
            MGS.Audio.cannon();
          }
        }
      }
    },

    has: function (type) { return !!timers[type]; },

    /* For the HUD strip: [{ type, label, color, icon, frac }] */
    active: function () {
      var out = [];
      for (var k in timers) {
        out.push({
          type: k,
          label: TYPES[k].label,
          color: TYPES[k].color,
          icon: TYPES[k].icon,
          frac: util.clamp(timers[k] / maxTimers[k], 0, 1),
          seconds: Math.ceil(timers[k])
        });
      }
      return out;
    },

    speedMult: function () { return timers.speed ? 1.45 : 1; },
    pickupMult: function () { return timers.magnet ? 4 : 1; },
    invulnerable: function () { return !!(timers.shield || timers.ghost); },
    phasing: function () { return !!timers.ghost; },
    enemySlow: function () { return timers.freeze ? 0.35 : 1; },
    gripOverride: function () { return timers.drift ? 1.0 : null; },
    driftBonus: function () { return timers.drift ? 2.2 : 0; }
  };

  MGS.Powerups = Powerups;
})(window.MGS);

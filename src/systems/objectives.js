/* In-run objectives: small challenges that pay cash.

   Three are live at any time. Clear one and it is instantly replaced by a fresh
   one, so there is always something to chase besides "don't die". */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var util = MGS.util;

  /* event   -> counts up when game code calls Objectives.note(event)
     tick    -> counts up continuously, returns the increment for this frame
     streak  -> progress resets to 0 the moment the condition stops being true */
  var POOL = [
    { id: 'kills5',   text: 'Smash 5 pursuers',          need: 5,  reward: 90,  event: 'kill' },
    { id: 'kills12',  text: 'Smash 12 pursuers',         need: 12, reward: 180, event: 'kill' },
    { id: 'traffic6', text: 'Wreck 6 civilian cars',     need: 6,  reward: 70,  event: 'traffic' },
    { id: 'cash25',   text: 'Collect 25 cash pickups',   need: 25, reward: 80,  event: 'cashpickup' },
    { id: 'ramp',     text: 'Launch off a ramp',         need: 1,  reward: 50,  event: 'ramp' },
    { id: 'ramp3',    text: 'Hit 3 ramps',               need: 3,  reward: 110, event: 'ramp' },
    { id: 'drown',    text: 'Drown a pursuer in water',  need: 1,  reward: 130, event: 'drown' },
    { id: 'power2',   text: 'Grab 2 power-ups',          need: 2,  reward: 90,  event: 'powerup' },
    { id: 'roadblock', text: 'Smash through a roadblock', need: 1, reward: 100, event: 'blocker' },

    { id: 'drift3',   text: 'Hold one drift for 3s',     need: 3,  reward: 80,  streak: true,
      tick: function (dt, p) { return p.drift > 110 ? dt : -1; } },
    { id: 'drift6',   text: 'Hold one drift for 6s',     need: 6,  reward: 170, streak: true,
      tick: function (dt, p) { return p.drift > 110 ? dt : -1; } },
    { id: 'clean20',  text: 'Go 20s without taking a hit', need: 20, reward: 120, streak: true,
      tick: function (dt, p) { return p.hitFlash > 0 ? -1 : dt; } },
    { id: 'fast',     text: 'Reach 90 mph',              need: 1,  reward: 60,
      tick: function (dt, p) { return p.speed / 6 >= 90 ? 1 : 0; } },
    { id: 'faster',   text: 'Reach 110 mph',             need: 1,  reward: 110,
      tick: function (dt, p) { return p.speed / 6 >= 110 ? 1 : 0; } },
    { id: 'airtime',  text: 'Stay airborne for 1.5s',    need: 1.5, reward: 100, streak: true,
      tick: function (dt, p) { return p.air > 0 ? dt : -1; } }
  ];

  var SLOTS = 3;
  var live = [];
  var used = {};
  var cleared = 0;

  function pick() {
    var options = POOL.filter(function (o) {
      if (used[o.id]) return false;
      for (var i = 0; i < live.length; i++) if (live[i].def.id === o.id) return false;
      return true;
    });
    if (!options.length) {
      used = {};   // everything done once - recycle the pool
      options = POOL.slice();
    }
    var def = options[Math.floor(Math.random() * options.length)];
    return { def: def, progress: 0, flash: 0 };
  }

  var Objectives = {
    reset: function () {
      live = [];
      used = {};
      cleared = 0;
      for (var i = 0; i < SLOTS; i++) live.push(pick());
    },

    cleared: function () { return cleared; },

    /* Discrete events from the rest of the game. */
    note: function (event, count) {
      count = count || 1;
      for (var i = 0; i < live.length; i++) {
        if (live[i].def.event === event) live[i].progress += count;
      }
    },

    update: function (dt, player, run, ctx) {
      for (var i = 0; i < live.length; i++) {
        var slot = live[i];
        var def = slot.def;
        slot.flash = Math.max(0, slot.flash - dt);

        if (def.tick) {
          var inc = def.tick(dt, player);
          if (inc < 0) slot.progress = def.streak ? 0 : slot.progress;
          else slot.progress += inc;
        }

        if (slot.progress >= def.need) {
          run.cashExact += def.reward;
          run.objectives = (run.objectives || 0) + 1;
          cleared++;
          used[def.id] = true;
          ctx.effects.popText(player.x, player.y - 58, def.text.toUpperCase() + '  +$' + def.reward, '#ffc531');
          MGS.Audio.unlockJingle();
          live[i] = pick();
          live[i].flash = 1.2;
        }
      }
    },

    /* For the HUD: [{ text, frac, reward, flash }] */
    active: function () {
      return live.map(function (s) {
        return {
          text: s.def.text,
          reward: s.def.reward,
          frac: util.clamp(s.progress / s.def.need, 0, 1),
          flash: s.flash
        };
      });
    }
  };

  MGS.Objectives = Objectives;
})(window.MGS);

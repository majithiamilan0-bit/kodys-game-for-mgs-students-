/* Score, the six-star heat ladder, and the BUSTED meter.

   SCORE IS SECONDS SURVIVED - one point per second, nothing else adds to it.
   That makes the whole game legible: your score is literally how long you lasted,
   and the heat thresholds below are just "how many seconds until it gets worse".

   Heat only ever climbs during a run - surviving longer IS the difficulty curve. */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var util = MGS.util;

  // Seconds survived before each heat level kicks in.
  var THRESHOLDS = [0, 40, 90, 150, 220, 300];
  var LABELS = ['PATROL', 'PURSUIT', 'SWAT', 'LOCKDOWN', 'MILITARY', 'ALL-OUT WAR'];

  var BUST_RADIUS = 210;     // how close a cop has to be to count as cornering you
  var BUST_UNITS = 2;        // how many of them it takes
  var BUST_TIME = 2.2;       // seconds cornered before the run ends

  var Wanted = {
    score: 0,
    level: 1,
    maxLevel: 1,
    kills: 0,
    bust: 0,

    THRESHOLDS: THRESHOLDS,

    reset: function () {
      this.score = 0;
      this.level = 1;
      this.maxLevel = 1;
      this.kills = 0;
      this.bust = 0;
    },

    label: function () { return LABELS[this.level - 1]; },

    addKill: function () { this.kills += 1; },

    levelFor: function (score) {
      var lvl = 1;
      for (var i = 0; i < THRESHOLDS.length; i++) {
        if (score >= THRESHOLDS[i]) lvl = i + 1;
      }
      return lvl;
    },

    /* Seconds remaining until the next heat level, for the HUD countdown. */
    nextIn: function () {
      if (this.level >= 6) return 0;
      return Math.max(0, Math.ceil(THRESHOLDS[this.level] - this.score));
    },

    /* Returns 'busted' when the player has been pinned down long enough. */
    update: function (dt, player, pursuitUnits) {
      this.score += dt;

      var next = this.levelFor(this.score);
      if (next > this.level) {
        this.level = next;
        this.maxLevel = Math.max(this.maxLevel, next);
        MGS.Audio.heat();
        MGS.Effects.popText(player.x, player.y - 46, 'HEAT ' + next, '#ff4b3e');
        MGS.Effects.shakeBy(8);
      }

      // BUSTED: sit still with cops on top of you and it is over.
      var near = 0;
      for (var i = 0; i < pursuitUnits.length; i++) {
        if (util.dist2(pursuitUnits[i].x, pursuitUnits[i].y, player.x, player.y)
            < BUST_RADIUS * BUST_RADIUS) near++;
      }

      if (near >= BUST_UNITS && player.speed < 85) {
        this.bust += dt;
        if (this.bust >= BUST_TIME) return 'busted';
      } else {
        this.bust = Math.max(0, this.bust - dt * 1.6);
      }
      return null;
    },

    bustProgress: function () { return util.clamp(this.bust / BUST_TIME, 0, 1); },

    /* 0..1 progress toward the next star, for the HUD bar. */
    progress: function () {
      if (this.level >= 6) return 1;
      var lo = THRESHOLDS[this.level - 1];
      var hi = THRESHOLDS[this.level];
      return util.clamp((this.score - lo) / (hi - lo), 0, 1);
    }
  };

  MGS.Wanted = Wanted;
})(window.MGS);

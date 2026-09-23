/* One unique power per car.

   Every ability is driven from here so the car physics file stays readable.
   State lives on `player.ab`, which is wiped at the start of every run.

   Abilities fall into four shapes:
     PASSIVE   always on (repair, magnet, turbo_turn, crush...)
     COOLDOWN  fires itself on a timer (nitro, emp, launch, stealth, timewarp...)
     DROPPER   leaves something behind (oil, ice, fire, mines, decoys)
     CONTACT   changes what happens when you hit someone (ram, spikes, sideswipe) */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var util = MGS.util;

  /* label shown in the HUD, and the cooldown length where one applies. */
  var INFO = {
    repair:     { label: 'REPAIRING' },
    magnet:     { label: 'MAGNET' },
    nitro:      { label: 'NITRO', cd: 6, dur: 1.6 },
    turbo_turn: { label: 'RALLY' },
    shield:     { label: 'SHIELD', cd: 8 },
    scavenger:  { label: 'SCAVENGER' },
    fare:       { label: 'METER' },
    boostchain: { label: 'CLEAN RUN' },
    frost:      { label: 'ICE TRAIL' },
    afterburn:  { label: 'AFTERBURN' },
    crush:      { label: 'BULL BAR' },
    sideswipe:  { label: 'SIDESWIPE' },
    spikes:     { label: 'SPIKES' },
    decoy:      { label: 'DECOY', cd: 10 },
    emp:        { label: 'EMP', cd: 9 },
    mine:       { label: 'MINES', cd: 2.6 },
    launch:     { label: 'LAUNCH', cd: 8, dur: 1.2 },
    hover:      { label: 'HOVER' },
    climb:      { label: 'ALL TERRAIN' },
    driftcash:  { label: 'DRIFT BANK' },
    flamer:     { label: 'BACKDRAFT' },
    stealth:    { label: 'GHOST', cd: 12, dur: 3 },
    ram:        { label: 'DEMOLITION' },
    slipstream: { label: 'SLIPSTREAM' },
    cash:       { label: 'PAYLOAD' },
    oil:        { label: 'OIL' },
    rockets:    { label: 'ROCKETS', cd: 1.7 },
    timewarp:   { label: 'TIME WARP', cd: 14, dur: 3 }
  };

  function Abilities() {}

  var A = {
    INFO: INFO,

    reset: function (player) {
      player.ab = {
        cd: 0,          // counts down to the next auto-trigger
        active: 0,      // seconds left of a timed effect
        chain: 0,       // builds for boostchain / slipstream
        shield: 0,      // 1 = a hit is waiting to be absorbed
        drop: 0,        // dropper timer
        stealth: 0,     // pursuers cannot see you while > 0
        warp: 0,        // everything else runs slow while > 0
        empRing: 0      // visual only
      };
      // Cars whose power is instant-on start charged.
      var info = INFO[player.vehicle.ability];
      if (info && info.cd) player.ab.cd = info.cd;
      if (player.vehicle.ability === 'shield') player.ab.shield = 1;
    },

    /* ctx = { effects, hazards, run, pursuit } */
    update: function (dt, player, ctx) {
      var ab = player.ab;
      var id = player.vehicle.ability;
      var info = INFO[id] || {};

      ab.active = Math.max(0, ab.active - dt);
      ab.stealth = Math.max(0, ab.stealth - dt);
      ab.warp = Math.max(0, ab.warp - dt);
      ab.empRing = Math.max(0, ab.empRing - dt);
      if (info.cd) ab.cd -= dt;

      var fx = Math.cos(player.angle), fy = Math.sin(player.angle);
      var behindX = player.x - fx * 32, behindY = player.y - fy * 32;
      var moving = player.speed > 60;

      switch (id) {
        case 'repair':
          player.hp = Math.min(player.maxHp, player.hp + 3.5 * dt);
          break;

        case 'fare':
          ctx.run.cashExact += 0.45 * dt;
          break;

        case 'boostchain':
          ab.chain = Math.min(30, ab.chain + dt);
          break;

        case 'slipstream':
          // Builds while you hold a line, collapses the moment you turn.
          if (Math.abs(player.steerInput) < 0.1) ab.chain = Math.min(20, ab.chain + dt);
          else ab.chain = Math.max(0, ab.chain - dt * 6);
          break;

        case 'driftcash':
          if (player.drift > 110) {
            ctx.run.cashExact += 1.8 * dt;
            if (Math.random() < 0.08) {
              ctx.effects.popText(player.x, player.y - 30, '$', '#e0367c');
            }
          }
          break;

        case 'shield':
          if (!ab.shield && ab.cd <= 0) {
            ab.shield = 1;
            ab.cd = info.cd;
            MGS.Audio.click();
          }
          break;

        case 'oil':
          ab.drop -= dt;
          if (ab.drop <= 0 && moving) { ab.drop = 0.42; ctx.hazards.drop('oil', behindX, behindY); }
          break;

        case 'frost':
          ab.drop -= dt;
          if (ab.drop <= 0 && moving) { ab.drop = 0.5; ctx.hazards.drop('ice', behindX, behindY); }
          break;

        case 'afterburn':
          ab.drop -= dt;
          if (ab.drop <= 0 && player.speed > player.vehicle.topSpeed * 0.55) {
            ab.drop = 0.22;
            ctx.hazards.drop('fire', behindX, behindY);
            ctx.effects.smoke(behindX, behindY, 1, '#ff9f45');
          }
          break;

        case 'mine':
          if (ab.cd <= 0 && moving) {
            ab.cd = info.cd;
            ctx.hazards.drop('mine', behindX, behindY);
          }
          break;

        case 'decoy':
          if (ab.cd <= 0 && moving) {
            ab.cd = info.cd;
            ctx.hazards.drop('decoy', behindX, behindY);
            ctx.effects.smoke(behindX, behindY, 5, '#e2dccb');
            ctx.effects.popText(behindX, behindY - 20, 'DECOY', '#e2dccb');
          }
          break;

        case 'nitro':
          if (ab.cd <= 0) {
            ab.cd = info.cd;
            ab.active = info.dur;
            ctx.effects.smoke(behindX, behindY, 6, '#ffb23f');
            MGS.Audio.click();
          }
          break;

        case 'launch':
          if (ab.cd <= 0) {
            ab.cd = info.cd;
            ab.active = info.dur;
            ctx.effects.debris(behindX, behindY, 8, '#ff7a1a');
            ctx.effects.shakeBy(7);
          }
          break;

        case 'stealth':
          if (ab.cd <= 0) {
            ab.cd = info.cd;
            ab.stealth = info.dur;
            ctx.effects.smoke(player.x, player.y, 8, '#9b7fe0');
            ctx.effects.popText(player.x, player.y - 40, 'VANISHED', '#9b7fe0');
          }
          break;

        case 'timewarp':
          if (ab.cd <= 0) {
            ab.cd = info.cd;
            ab.warp = info.dur;
            ctx.effects.popText(player.x, player.y - 40, 'TIME WARP', '#6ce0ff');
            ctx.effects.shakeBy(6);
          }
          break;

        case 'emp':
          if (ab.cd <= 0) {
            ab.cd = info.cd;
            ab.empRing = 0.5;
            A.empBlast(player, ctx);
          }
          break;

        case 'flamer':
          A.burnBehind(dt, player, ctx);
          break;
      }
    },

    empBlast: function (player, ctx) {
      var units = MGS.Pursuit.units.active;
      var R = 300;
      var hit = 0;
      for (var i = 0; i < units.length; i++) {
        var u = units[i];
        if (util.dist2(u.x, u.y, player.x, player.y) > R * R) continue;
        u.spin = 2.4;
        u.hp -= 3;
        u.hitFlash = 0.2;
        var a = Math.atan2(u.y - player.y, u.x - player.x);
        u.x += Math.cos(a) * 34;
        u.y += Math.sin(a) * 34;
        hit++;
        if (u.hp <= 0) MGS.Pursuit.kill(u, ctx.effects, ctx.callbacks);
      }
      ctx.effects.shakeBy(hit ? 10 : 4);
      MGS.Audio.cannon();
    },

    /* Chili Machine roasts whatever is sitting on your bumper. */
    burnBehind: function (dt, player, ctx) {
      var units = MGS.Pursuit.units.active;
      var bx = player.x - Math.cos(player.angle) * 60;
      var by = player.y - Math.sin(player.angle) * 60;
      for (var i = 0; i < units.length; i++) {
        var u = units[i];
        if (util.dist2(u.x, u.y, bx, by) > 90 * 90) continue;
        u.hp -= 16 * dt;
        u.hitFlash = 0.1;
        if (Math.random() < 0.25) ctx.effects.smoke(u.x, u.y, 1, '#ff7a1a');
        if (u.hp <= 0) MGS.Pursuit.kill(u, ctx.effects, ctx.callbacks);
      }
    },

    /* --- queries the rest of the game asks --------------------------------- */

    topSpeedMult: function (player) {
      var ab = player.ab;
      switch (player.vehicle.ability) {
        case 'nitro': return ab.active > 0 ? 1.4 : 1;
        case 'launch': return ab.active > 0 ? 1.8 : 1;
        case 'boostchain': return 1 + Math.min(0.35, ab.chain * 0.012);
        case 'slipstream': return 1 + Math.min(0.3, ab.chain * 0.016);
        default: return 1;
      }
    },

    turnMult: function (player) {
      if (player.vehicle.ability === 'turbo_turn') return 1.5;
      if (player.vehicle.ability === 'launch' && player.ab.active > 0) return 0.6;
      return 1;
    },

    pickupRadiusMult: function (player) {
      return player.vehicle.ability === 'magnet' ? 3.2 : 1;
    },

    survivesWater: function (player) {
      return player.vehicle.ability === 'hover';
    },

    climbsWalls: function (player) {
      return player.vehicle.ability === 'climb';
    },

    obstacleDamageMult: function (player) {
      return player.vehicle.ability === 'crush' ? 0.25 : 1;
    },

    /* Damage this car deals to a pursuer it hits. */
    contactDamageMult: function (player) {
      if (player.vehicle.ability === 'spikes') return 3;
      if (player.vehicle.ability === 'sideswipe') return 1.5;
      return 1;
    },

    killsOnContact: function (player) {
      return player.vehicle.ability === 'ram';
    },

    knocksAside: function (player) {
      return player.vehicle.ability === 'sideswipe';
    },

    /* Returns how much damage actually lands after shields etc. */
    absorbDamage: function (player, amount) {
      var ab = player.ab;
      if (player.vehicle.ability === 'shield' && ab.shield) {
        ab.shield = 0;
        ab.cd = INFO.shield.cd;
        MGS.Effects.popText(player.x, player.y - 34, 'BLOCKED', '#86d2b9');
        MGS.Effects.shakeBy(5);
        return 0;
      }
      if (player.vehicle.ability === 'boostchain') ab.chain = 0;
      return amount;
    },

    onKill: function (player, unit, ctx) {
      if (player.vehicle.ability === 'scavenger') {
        ctx.run.cashExact += 3;
        ctx.effects.popText(unit.x, unit.y + 16, '+$3', '#35c66b');
      }
    },

    /* For the HUD: name plus a 0..1 charge ring. */
    status: function (player) {
      var id = player.vehicle.ability;
      var info = INFO[id] || { label: '' };
      var ab = player.ab;
      var charge = 1;
      var active = false;

      if (id === 'shield') {
        active = !!ab.shield;
        charge = ab.shield ? 1 : util.clamp(1 - ab.cd / info.cd, 0, 1);
      } else if (info.cd) {
        active = ab.active > 0 || ab.stealth > 0 || ab.warp > 0;
        charge = util.clamp(1 - ab.cd / info.cd, 0, 1);
      } else if (id === 'boostchain' || id === 'slipstream') {
        charge = util.clamp(ab.chain / (id === 'boostchain' ? 30 : 20), 0, 1);
        active = charge > 0.6;
      } else {
        active = true;
      }
      return { label: info.label, charge: charge, active: active };
    }
  };

  MGS.Abilities = A;
})(window.MGS);

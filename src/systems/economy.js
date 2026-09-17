/* Cash, ownership and persistence.

   There is exactly one currency (cash) and exactly one way to get it: driving.
   No purchases, no ads, no watch-a-video button, no timers. */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var KEY = 'mgs-getaway-profile-v1';
  var SPIN_COST = 100;

  var profile = {
    cash: 0,
    best: 0,
    totalCash: 0,
    runs: 0,
    owned: [MGS.STARTING_CAR],
    selected: MGS.STARTING_CAR,
    missions: [],
    muted: false
  };

  function save() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(profile));
    } catch (e) {
      /* Private browsing or a file:// origin with storage disabled - play on, just
         without saving. */
    }
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      for (var k in profile) {
        if (Object.prototype.hasOwnProperty.call(saved, k)) profile[k] = saved[k];
      }
      if (profile.owned.indexOf(MGS.STARTING_CAR) === -1) profile.owned.push(MGS.STARTING_CAR);
      if (!MGS.vehicleById(profile.selected) || !owns(profile.selected)) {
        profile.selected = MGS.STARTING_CAR;
      }
    } catch (e) {
      /* Corrupt save - start clean rather than crash into a black screen. */
    }
  }

  function owns(id) { return profile.owned.indexOf(id) !== -1; }

  function grant(id) {
    if (owns(id)) return false;
    profile.owned.push(id);
    save();
    return true;
  }

  var Economy = {
    SPIN_COST: SPIN_COST,

    init: function () { load(); },

    profile: function () { return profile; },
    cash: function () { return profile.cash; },
    best: function () { return profile.best; },
    owns: owns,

    selected: function () { return MGS.vehicleById(profile.selected); },

    select: function (id) {
      if (!owns(id)) return false;
      profile.selected = id;
      save();
      return true;
    },

    price: function (v) {
      return v.unlock.price != null ? v.unlock.price : null;
    },

    missionLabel: function (v) {
      if (!v.unlock.mission) return '';
      for (var i = 0; i < MGS.MISSIONS.length; i++) {
        if (MGS.MISSIONS[i].id === v.unlock.mission) return MGS.MISSIONS[i].label;
      }
      return '';
    },

    buy: function (id) {
      var v = MGS.vehicleById(id);
      var price = Economy.price(v);
      if (owns(id) || price == null || profile.cash < price) return false;
      profile.cash -= price;
      grant(id);
      profile.selected = id;
      save();
      return true;
    },

    /* Optional flourish: a fixed-price crate that hands over a random car you do
       not own yet. Still bought with driving cash, still no gambling for money. */
    canSpin: function () {
      return profile.cash >= SPIN_COST && Economy.spinPool().length > 0;
    },

    spinPool: function () {
      return MGS.VEHICLES.filter(function (v) {
        return !owns(v.id) && v.unlock.price != null;
      });
    },

    spin: function () {
      if (!Economy.canSpin()) return null;
      profile.cash -= SPIN_COST;
      var pool = Economy.spinPool();
      // Weighted so legendaries stay special, but everything is reachable.
      var weights = { common: 50, rare: 26, epic: 14, legendary: 6 };
      var total = 0, i;
      for (i = 0; i < pool.length; i++) total += weights[pool[i].rarity];
      var roll = Math.random() * total;
      for (i = 0; i < pool.length; i++) {
        roll -= weights[pool[i].rarity];
        if (roll <= 0) { grant(pool[i].id); save(); return pool[i]; }
      }
      var last = pool[pool.length - 1];
      grant(last.id);
      save();
      return last;
    },

    setMuted: function (m) { profile.muted = m; save(); },

    /* Called once at the end of every run. Returns the list of cars just earned. */
    recordRun: function (run) {
      profile.runs += 1;
      profile.cash += run.cash;
      profile.totalCash += run.cash;
      if (run.score > profile.best) profile.best = run.score;

      var unlocked = [];
      MGS.MISSIONS.forEach(function (m) {
        if (profile.missions.indexOf(m.id) !== -1) return;
        if (!m.test(run)) return;
        profile.missions.push(m.id);
        MGS.VEHICLES.forEach(function (v) {
          if (v.unlock.mission === m.id && grant(v.id)) unlocked.push(v);
        });
      });

      save();
      return unlocked;
    }
  };

  MGS.Economy = Economy;
})(window.MGS);

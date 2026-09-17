/* The car roster. This is the file to edit when you want to rebalance the game -
   nothing else needs to change.

   topSpeed  world pixels per second at full tilt
   accel     how hard it pulls toward top speed
   grip      how fast the car stops sliding (low = drifty, high = on rails)
   hp        damage it soaks before it is wrecked
   cashMult  multiplier on every cash pickup
   ability   null | 'ram' | 'cash' | 'oil' | 'rockets'
   unlock    {price:n} to buy with earned cash, or {mission:'id'} to earn it     */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var PRICE = { common: 200, rare: 700, epic: 1800, legendary: 4000 };

  function car(id, name, rarity, stats, colors, extra) {
    var v = {
      id: id,
      name: name,
      rarity: rarity,
      topSpeed: stats[0],
      accel: stats[1],
      grip: stats[2],
      hp: stats[3],
      cashMult: (extra && extra.cashMult) || 1,
      ability: (extra && extra.ability) || null,
      w: (extra && extra.w) || 46,
      h: (extra && extra.h) || 26,
      body: colors[0],
      roof: colors[1],
      trim: colors[2],
      unlock: (extra && extra.mission) ? { mission: extra.mission } : { price: PRICE[rarity] },
      note: (extra && extra.note) || ''
    };
    return v;
  }

  var VEHICLES = [
    /* ---------- COMMON ---------- */
    car('site_pickup', 'Site Pickup', 'common', [400, 290, 3.2, 110], ['#d8632f', '#f0a06a', '#2a3240'],
      { w: 50, h: 27, note: 'The one you start with. Honest and forgettable.' }),
    car('bluebird', 'Bluebird 5', 'common', [430, 300, 3.6, 95], ['#3f8ed0', '#7fc0ee', '#22303c']),
    car('hot_rodder', 'Hot Rodder', 'common', [455, 330, 2.6, 85], ['#b8352f', '#e26a58', '#1d2430'],
      { note: 'Fast, loose, folds like paper.' }),
    car('rally_pup', 'Rally Pup', 'common', [420, 340, 4.4, 90], ['#e0c33c', '#f3e08a', '#2b2f24'],
      { w: 42, h: 25, note: 'Grippy little thing. Great for tight streets.' }),
    car('micro_bus', 'Micro Bus', 'common', [355, 210, 3.4, 175], ['#49a88a', '#86d2b9', '#25332e'],
      { w: 56, h: 30, note: 'Slow, heavy, weirdly hard to kill.' }),
    car('estate', 'Estate Wagon', 'common', [410, 260, 3.5, 130], ['#8c8f96', '#c3c6cc', '#262a31'],
      { w: 52, h: 27 }),
    car('city_cab', 'City Cab', 'common', [425, 295, 3.3, 105], ['#f0b429', '#ffd97a', '#22262e'],
      { cashMult: 1.5, note: 'Still running the meter: +50% cash.' }),
    car('track_day', 'Track Day', 'common', [470, 350, 3.0, 78], ['#f4f1e8', '#ffffff', '#c23b32'],
      { w: 44, h: 24 }),

    /* ---------- RARE ---------- */
    car('velocity_gt', 'Velocity GT', 'rare', [510, 360, 3.1, 100], ['#2f4fd8', '#6f8bf0', '#171d2e'],
      { w: 46, h: 24 }),
    car('ridgeback', 'Ridgeback 4x4', 'rare', [440, 300, 4.6, 190], ['#4a6b3a', '#7ba065', '#222a1e'],
      { w: 52, h: 30, note: 'Shrugs off fences and roadblocks.' }),
    car('stretch', 'Stretch Limo', 'rare', [455, 230, 2.4, 210], ['#14171c', '#3b414c', '#c9a227'],
      { w: 72, h: 26, note: 'Long enough to block a whole lane.' }),
    car('brawler', 'Brawler', 'rare', [430, 310, 3.8, 230], ['#7a3ea8', '#ab74d4', '#241a2e'],
      { w: 50, h: 30, mission: 'm_smash', note: 'Built to trade paint.' }),
    car('camper', 'Camper Cruiser', 'rare', [385, 215, 3.6, 260], ['#e2dccb', '#ffffff', '#3d6b8c'],
      { w: 64, h: 32, cashMult: 2, note: 'Double cash - if you can keep it alive.' }),
    car('boxer_van', 'Boxer Van', 'rare', [445, 280, 4.0, 200], ['#c9502f', '#ee8a63', '#232830'],
      { w: 58, h: 30 }),

    /* ---------- EPIC ---------- */
    car('drag_spec', 'Drag Spec', 'epic', [590, 430, 2.2, 90], ['#111418', '#2d333d', '#ff7a1a'],
      { w: 56, h: 24, note: 'Absurd in a straight line. Corners are a rumour.' }),
    car('hover_pod', 'Hover Pod', 'epic', [500, 380, 1.9, 130], ['#31c6d4', '#8beaf2', '#16323a'],
      { w: 44, h: 32, note: 'Frictionless. Slides forever.' }),
    car('dune_crawler', 'Dune Crawler', 'epic', [470, 330, 5.2, 250], ['#d9a441', '#f2cd80', '#33291a'],
      { w: 54, h: 34, mission: 'm_heat5', note: 'Glued to the ground at any speed.' }),
    car('drift_king', 'Drift King', 'epic', [535, 390, 2.0, 120], ['#e0367c', '#f47aae', '#2a1522'],
      { w: 48, h: 26, note: 'Rewards throttle control. Punishes panic.' }),
    car('chili', 'Chili Machine', 'epic', [545, 400, 3.4, 115], ['#d61f26', '#ff5f54', '#2b1113'],
      { w: 46, h: 26, cashMult: 2.5 }),

    /* ---------- LEGENDARY ---------- */
    car('crusher', 'Crusher', 'legendary', [420, 300, 4.8, 420], ['#4f5a34', '#77855a', '#1e2317'],
      { w: 62, h: 38, ability: 'ram', mission: 'm_heat6',
        note: 'Ram anything and it dies, not you.' }),
    car('apex_gp', 'Apex GP', 'legendary', [680, 470, 3.6, 80], ['#f0f2f5', '#ffffff', '#1f6fd0'],
      { w: 54, h: 22, note: 'By far the fastest car in the game. Paper thin.' }),
    car('vault_van', 'Vault Van', 'legendary', [430, 260, 3.8, 230], ['#2e8b57', '#57c98c', '#1a2a20'],
      { w: 58, h: 32, ability: 'cash', cashMult: 5, note: 'Five times the cash per pickup.' }),
    car('slick_rig', 'Slick Rig', 'legendary', [455, 250, 3.4, 300], ['#37404d', '#5a6879', '#d8b13a'],
      { w: 70, h: 32, ability: 'oil', note: 'Leaves oil slicks that spin out anyone behind you.' }),
    car('salvo', 'Salvo', 'legendary', [480, 330, 4.0, 260], ['#5a4632', '#87664a', '#c8462e'],
      { w: 56, h: 32, ability: 'rockets', note: 'Auto-fires rockets at whoever is closest.' })
  ];

  var BY_ID = {};
  VEHICLES.forEach(function (v) { BY_ID[v.id] = v; });

  /* Free unlocks earned by playing, never bought. */
  var MISSIONS = [
    { id: 'm_smash', label: 'Smash 20 pursuers in a single run',
      test: function (run) { return run.kills >= 20; } },
    { id: 'm_heat5', label: 'Reach heat level 5 in a single run',
      test: function (run) { return run.maxHeat >= 5; } },
    { id: 'm_heat6', label: 'Reach heat level 6 in a single run',
      test: function (run) { return run.maxHeat >= 6; } }
  ];

  /* Bars in the garage are relative to these, so a new car never breaks the UI. */
  var MAX = { topSpeed: 700, accel: 480, grip: 5.5, hp: 430 };

  MGS.VEHICLES = VEHICLES;
  MGS.vehicleById = function (id) { return BY_ID[id] || BY_ID.site_pickup; };
  MGS.MISSIONS = MISSIONS;
  MGS.STAT_MAX = MAX;
  MGS.STARTING_CAR = 'site_pickup';
})(window.MGS);

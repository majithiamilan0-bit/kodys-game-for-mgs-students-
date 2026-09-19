/* The car roster. This is the file to edit when you want to rebalance the game.

   EVERY car has its own ability and its own animation - no two are the same.

   topSpeed  world pixels per second at full tilt
   accel     how hard it pulls toward top speed
   grip      how fast the car stops sliding (low = drifty, high = on rails)
   hp        damage it soaks before it is wrecked
   cashMult  multiplier on every cash pickup
   ability   unique power, driven by src/systems/abilities.js
   anim      unique animated flourish, drawn by src/render/carAnims.js
   unlock    {price:n} to buy with earned cash, or {mission:'id'} to earn it     */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var PRICE = { common: 200, rare: 700, epic: 1800, legendary: 4000 };

  function car(id, name, rarity, stats, colors, extra) {
    extra = extra || {};
    return {
      id: id,
      name: name,
      rarity: rarity,
      topSpeed: stats[0],
      accel: stats[1],
      grip: stats[2],
      hp: stats[3],
      cashMult: extra.cashMult || 1,
      ability: extra.ability,
      anim: extra.anim,
      w: extra.w || 46,
      h: extra.h || 26,
      body: colors[0],
      roof: colors[1],
      trim: colors[2],
      unlock: extra.mission ? { mission: extra.mission } : { price: PRICE[rarity] },
      power: extra.power || '',
      note: extra.note || ''
    };
  }

  var VEHICLES = [
    /* ================= COMMON ================= */
    car('site_pickup', 'Site Pickup', 'common', [400, 290, 3.2, 115], ['#d8632f', '#f0a06a', '#2a3240'], {
      w: 50, h: 27, ability: 'repair', anim: 'toolbox',
      power: 'FIELD REPAIRS', note: 'Slowly welds its own hull back together as you drive.'
    }),
    car('bluebird', 'Bluebird 5', 'common', [430, 300, 3.6, 95], ['#3f8ed0', '#7fc0ee', '#22303c'], {
      ability: 'magnet', anim: 'antenna',
      power: 'CASH MAGNET', note: 'Cash flies to you from much further away.'
    }),
    car('hot_rodder', 'Hot Rodder', 'common', [455, 330, 2.6, 85], ['#b8352f', '#e26a58', '#1d2430'], {
      ability: 'nitro', anim: 'exhaust',
      power: 'NITRO PULSE', note: 'Kicks in a speed burst every few seconds, all on its own.'
    }),
    car('rally_pup', 'Rally Pup', 'common', [420, 340, 4.4, 90], ['#e0c33c', '#f3e08a', '#2b2f24'], {
      w: 42, h: 25, ability: 'turbo_turn', anim: 'mudflap',
      power: 'RALLY STEERING', note: 'Turns far sharper than anything else its size.'
    }),
    car('micro_bus', 'Micro Bus', 'common', [355, 210, 3.4, 180], ['#49a88a', '#86d2b9', '#25332e'], {
      w: 56, h: 30, ability: 'shield', anim: 'bounce',
      power: 'BUMPER SHIELD', note: 'Recharging shield soaks one hit at a time.'
    }),
    car('estate', 'Estate Wagon', 'common', [410, 260, 3.5, 130], ['#8c8f96', '#c3c6cc', '#262a31'], {
      w: 52, h: 27, ability: 'scavenger', anim: 'roofrack',
      power: 'SCAVENGER', note: 'Every pursuer you wreck coughs up cash.'
    }),
    car('city_cab', 'City Cab', 'common', [425, 295, 3.3, 105], ['#f0b429', '#ffd97a', '#22262e'], {
      ability: 'fare', anim: 'tarisign',
      power: 'METER RUNNING', note: 'Earns cash every second you stay alive.'
    }),
    car('track_day', 'Track Day', 'common', [470, 350, 3.0, 78], ['#f4f1e8', '#ffffff', '#c23b32'], {
      w: 44, h: 24, ability: 'boostchain', anim: 'stripes',
      power: 'CLEAN RUN', note: 'Gets faster the longer you go without being hit.'
    }),
    car('milk_float', 'Milk Float', 'common', [340, 240, 4.0, 150], ['#eef2f5', '#ffffff', '#7fb6d9'], {
      w: 50, h: 30, ability: 'frost', anim: 'bottles',
      power: 'ICE TRAIL', note: 'Leaves frozen patches that send pursuers sliding.'
    }),

    /* ================= RARE ================= */
    car('velocity_gt', 'Velocity GT', 'rare', [510, 360, 3.1, 100], ['#2f4fd8', '#6f8bf0', '#171d2e'], {
      w: 46, h: 24, ability: 'afterburn', anim: 'spoiler',
      power: 'AFTERBURN', note: 'Burns a trail of fire behind you at speed.'
    }),
    car('ridgeback', 'Ridgeback 4x4', 'rare', [440, 300, 4.6, 195], ['#4a6b3a', '#7ba065', '#222a1e'], {
      w: 52, h: 30, ability: 'crush', anim: 'lightbar',
      power: 'BULL BAR', note: 'Smashes through scenery and barely feels it.'
    }),
    car('stretch', 'Stretch Limo', 'rare', [455, 230, 2.4, 215], ['#14171c', '#3b414c', '#c9a227'], {
      w: 72, h: 26, ability: 'sideswipe', anim: 'neon',
      power: 'SIDESWIPE', note: 'Long enough to fling police cars clean off the road.'
    }),
    car('brawler', 'Brawler', 'rare', [430, 310, 3.8, 235], ['#7a3ea8', '#ab74d4', '#241a2e'], {
      w: 50, h: 30, mission: 'm_smash', ability: 'spikes', anim: 'spikes',
      power: 'SPIKED HULL', note: 'Anything that touches you takes triple damage.'
    }),
    car('camper', 'Camper Cruiser', 'rare', [385, 215, 3.6, 265], ['#e2dccb', '#ffffff', '#3d6b8c'], {
      w: 64, h: 32, cashMult: 2, ability: 'decoy', anim: 'awning',
      power: 'DECOY DROP', note: 'Drops a decoy the police chase instead of you.'
    }),
    car('boxer_van', 'Boxer Van', 'rare', [445, 280, 4.0, 205], ['#c9502f', '#ee8a63', '#232830'], {
      w: 58, h: 30, ability: 'emp', anim: 'dish',
      power: 'EMP BURST', note: 'Pulses a shockwave that spins out everyone nearby.'
    }),
    car('sapper', 'Sapper', 'rare', [450, 290, 3.9, 190], ['#5c6b3f', '#8a9a63', '#252b1a'], {
      w: 54, h: 30, ability: 'mine', anim: 'hatch',
      power: 'MINE LAYER', note: 'Drops proximity mines out the back.'
    }),

    /* ================= EPIC ================= */
    car('drag_spec', 'Drag Spec', 'epic', [590, 430, 2.2, 90], ['#111418', '#2d333d', '#ff7a1a'], {
      w: 56, h: 24, ability: 'launch', anim: 'parachute',
      power: 'LAUNCH CONTROL', note: 'Absurd straight-line bursts. Corners are a rumour.'
    }),
    car('hover_pod', 'Hover Pod', 'epic', [500, 380, 1.9, 130], ['#31c6d4', '#8beaf2', '#16323a'], {
      w: 44, h: 32, ability: 'hover', anim: 'hoverbob',
      power: 'HOVER DRIVE', note: 'Floats straight over water that kills everyone else.'
    }),
    car('dune_crawler', 'Dune Crawler', 'epic', [470, 330, 5.2, 255], ['#d9a441', '#f2cd80', '#33291a'], {
      w: 54, h: 34, mission: 'm_heat5', ability: 'climb', anim: 'suspension',
      power: 'ALL TERRAIN', note: 'Climbs straight over walls instead of crashing into them.'
    }),
    car('drift_king', 'Drift King', 'epic', [535, 390, 2.0, 120], ['#e0367c', '#f47aae', '#2a1522'], {
      w: 48, h: 26, ability: 'driftcash', anim: 'driftsmoke',
      power: 'DRIFT BANKER', note: 'Prints cash for every second you hold a slide.'
    }),
    car('chili', 'Chili Machine', 'epic', [545, 400, 3.4, 115], ['#d61f26', '#ff5f54', '#2b1113'], {
      w: 46, h: 26, cashMult: 2, ability: 'flamer', anim: 'heatwave',
      power: 'BACKDRAFT', note: 'Roasts anything sitting on your bumper.'
    }),
    car('nightshade', 'Nightshade', 'epic', [520, 370, 3.3, 125], ['#2a2440', '#463c66', '#9b7fe0'], {
      w: 48, h: 26, ability: 'stealth', anim: 'phase',
      power: 'GHOST PROTOCOL', note: 'Vanishes from police radar every few seconds.'
    }),

    /* ================= LEGENDARY ================= */
    car('crusher', 'Crusher', 'legendary', [420, 300, 4.8, 430], ['#4f5a34', '#77855a', '#1e2317'], {
      w: 62, h: 38, mission: 'm_heat6', ability: 'ram', anim: 'tread',
      power: 'DEMOLITION', note: 'Ram anything and it dies, not you.'
    }),
    car('apex_gp', 'Apex GP', 'legendary', [680, 470, 3.6, 80], ['#f0f2f5', '#ffffff', '#1f6fd0'], {
      w: 54, h: 22, ability: 'slipstream', anim: 'wing',
      power: 'SLIPSTREAM', note: 'Keeps gaining speed for as long as you hold a straight line.'
    }),
    car('vault_van', 'Vault Van', 'legendary', [430, 260, 3.8, 235], ['#2e8b57', '#57c98c', '#1a2a20'], {
      w: 58, h: 32, cashMult: 5, ability: 'cash', anim: 'coins',
      power: 'ARMOURED PAYLOAD', note: 'Five times the cash from every single pickup.'
    }),
    car('slick_rig', 'Slick Rig', 'legendary', [455, 250, 3.4, 305], ['#37404d', '#5a6879', '#d8b13a'], {
      w: 70, h: 32, ability: 'oil', anim: 'trailer',
      power: 'OIL SLICKS', note: 'Spins out everyone unlucky enough to be behind you.'
    }),
    car('salvo', 'Salvo', 'legendary', [480, 330, 4.0, 265], ['#5a4632', '#87664a', '#c8462e'], {
      w: 56, h: 32, ability: 'rockets', anim: 'turret',
      power: 'ROCKET TURRET', note: 'Auto-fires rockets at whoever is closest.'
    }),
    car('chrono', 'Chrono', 'legendary', [560, 400, 3.7, 190], ['#1d3a52', '#356b8f', '#6ce0ff'], {
      w: 50, h: 28, mission: 'm_objectives', ability: 'timewarp', anim: 'clock',
      power: 'TIME WARP', note: 'Slows the entire world down while you drive full speed.'
    })
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
      test: function (run) { return run.maxHeat >= 6; } },
    { id: 'm_objectives', label: 'Clear 6 objectives in a single run',
      test: function (run) { return run.objectives >= 6; } }
  ];

  /* Bars in the garage are relative to these, so a new car never breaks the UI. */
  var MAX = { topSpeed: 700, accel: 480, grip: 5.5, hp: 440 };

  MGS.VEHICLES = VEHICLES;
  MGS.vehicleById = function (id) { return BY_ID[id] || BY_ID.site_pickup; };
  MGS.MISSIONS = MISSIONS;
  MGS.STAT_MAX = MAX;
  MGS.STARTING_CAR = 'site_pickup';
})(window.MGS);

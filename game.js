/* Main loop and game state.

   Physics run on a FIXED timestep (1/60s) fed by an accumulator, so the game
   simulates identically on a 60Hz laptop and a 144Hz monitor. Rendering happens
   once per animation frame regardless. */

(function (MGS) {
  'use strict';

  var C = MGS.CONFIG;
  var util = MGS.util;

  var canvas = document.getElementById('game');
  var player = new MGS.Player();
  var camera = { x: 0, y: 0 };

  var mode = 'attract';     // 'attract' | 'playing' | 'paused' | 'dying'
  var deathTimer = 0;
  var attractAngle = 0;

  var run = newRun();

  function newRun() {
    return { score: 0, cash: 0, cashExact: 0, kills: 0, maxHeat: 1, verdict: 'WASTED' };
  }

  /* --- run lifecycle ------------------------------------------------------- */

  function startRun() {
    var seed = (Math.random() * 0xffffff) | 0;
    MGS.World.reset(seed);
    MGS.Traffic.reset(seed + 3);
    MGS.Pursuit.reset(seed + 7);
    MGS.Effects.reset();
    MGS.Wanted.reset();
    run = newRun();

    // Start on a crossroads so the first few seconds are always drivable.
    var spacing = MGS.World.ROAD_SPACING;
    var k = (Math.random() * 60 - 30) | 0;
    var j = (Math.random() * 60 - 30) | 0;
    var sx = k * spacing + C.TILE / 2;
    var sy = j * spacing + C.TILE / 2;

    MGS.World.update(sx, sy);
    player.reset(MGS.Economy.selected(), sx, sy);
    camera.x = sx;
    camera.y = sy;

    deathTimer = 0;
    mode = 'playing';

    MGS.Audio.unlock();
    MGS.Audio.startEngine();
    MGS.Audio.startSiren();
  }

  function endRun() {
    MGS.Audio.stopRunLoops();
    run.score = MGS.Wanted.score;
    run.kills = MGS.Wanted.kills;
    run.maxHeat = MGS.Wanted.maxLevel;
    run.cash = Math.floor(run.cashExact);
    var unlocked = MGS.Economy.recordRun(run);
    mode = 'attract';
    MGS.UI.showResults(run, unlocked);
  }

  function quitToMenu() {
    MGS.Audio.stopRunLoops();
    mode = 'attract';
  }

  /* --- simulation ---------------------------------------------------------- */

  var callbacks = {
    onKill: function () {
      MGS.Wanted.addKill();
    },
    onPlayerHit: function () { /* hook for future feedback */ }
  };

  function stepPlaying(dt) {
    MGS.World.update(player.x, player.y);
    player.update(dt, MGS.Input, MGS.World, MGS.Effects);

    MGS.World.collectPickups(player.x, player.y, player.radius + 26, function () {
      run.cashExact += player.vehicle.cashMult;
      run.cash = Math.floor(run.cashExact);
      MGS.Audio.cash();
    });

    MGS.Traffic.update(dt, player, MGS.World, MGS.Effects, null);
    MGS.Pursuit.update(dt, player, MGS.World, MGS.Effects, MGS.Wanted.level, callbacks);

    var verdict = MGS.Wanted.update(dt, player, MGS.Pursuit.units.active);
    if (verdict === 'busted' && !player.dead) {
      player.dead = true;
      run.verdict = 'BUSTED';
      MGS.Audio.bust();
      MGS.Effects.shakeBy(16);
    }

    MGS.Audio.updateEngine(util.clamp(player.speed / player.vehicle.topSpeed, 0, 1), player.boosting);
    MGS.Audio.updateSiren(MGS.Wanted.level, MGS.Pursuit.count());

    if (player.dead && mode === 'playing') {
      if (run.verdict !== 'BUSTED') run.verdict = 'WASTED';
      if (!player.drowned) {
        MGS.Effects.explosion(player.x, player.y, 1.6);
        MGS.Audio.explosion();
      }
      mode = 'dying';
      deathTimer = 1.5;
    }
  }

  function stepDying(dt) {
    MGS.World.update(player.x, player.y);
    MGS.Traffic.update(dt, player, MGS.World, MGS.Effects, null);
    MGS.Pursuit.update(dt, player, MGS.World, MGS.Effects, MGS.Wanted.level, callbacks);
    MGS.Audio.updateSiren(MGS.Wanted.level, MGS.Pursuit.count());
    deathTimer -= dt;
    if (deathTimer <= 0) endRun();
  }

  /* Slow drift over the city behind the menus. */
  function stepAttract(dt) {
    attractAngle += dt * 0.12;
    camera.x += Math.cos(attractAngle) * 120 * dt;
    camera.y += Math.sin(attractAngle * 0.7) * 120 * dt;
    MGS.World.update(camera.x, camera.y);
    MGS.Effects.update(dt);
  }

  function step(dt) {
    if (mode === 'playing') {
      stepPlaying(dt);
      MGS.Effects.update(dt);
    } else if (mode === 'dying') {
      stepDying(dt);
      MGS.Effects.update(dt);
    } else if (mode === 'attract') {
      stepAttract(dt);
    }

    if (mode === 'playing' || mode === 'dying') {
      // Camera leads the car slightly so you can see what you are about to hit.
      var lead = 0.34;
      var tx = player.x + player.vx * lead;
      var ty = player.y + player.vy * lead;
      camera.x = util.damp(camera.x, tx, 6, dt);
      camera.y = util.damp(camera.y, ty, 6, dt);
    }
  }

  /* --- frame loop ----------------------------------------------------------- */

  var last = 0;
  var acc = 0;

  function frame(now) {
    if (!last) last = now;
    var dt = (now - last) / 1000;
    last = now;
    // Cap it so a tab-switch does not fast-forward the whole chase.
    if (dt > 0.25) dt = 0.25;

    acc += dt;
    var steps = 0;
    while (acc >= C.FIXED_STEP && steps < C.MAX_STEPS) {
      step(C.FIXED_STEP);
      acc -= C.FIXED_STEP;
      steps++;
    }
    if (steps === C.MAX_STEPS) acc = 0;

    MGS.Renderer.setCamera(camera.x, camera.y);
    MGS.Renderer.draw({
      player: mode === 'attract' ? null : player,
      run: run,
      hud: mode === 'playing' || mode === 'dying',
      deathFade: mode === 'dying' ? 1 - Math.max(0, deathTimer / 1.5) : 0
    });

    requestAnimationFrame(frame);
  }

  /* --- boot ------------------------------------------------------------------ */

  function boot() {
    MGS.Economy.init();
    MGS.Renderer.init(canvas);
    MGS.Input.attach(canvas);

    MGS.UI.init({
      onDrive: startRun,
      onQuit: quitToMenu,
      onPause: function () { if (mode === 'playing') mode = 'paused'; },
      onResume: function () { if (mode === 'paused') mode = 'playing'; }
    });

    if (MGS.Economy.profile().muted && !MGS.Audio.isMuted()) {
      MGS.UI.setMuted(MGS.Audio.toggleMute());
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && mode === 'playing') {
        mode = 'paused';
        MGS.UI.show('pause');
      }
    });

    // Seed the attract-mode city.
    MGS.World.reset((Math.random() * 0xffffff) | 0);
    MGS.World.update(0, 0);
    MGS.Traffic.reset(5);
    MGS.UI.show('menu');

    requestAnimationFrame(frame);
  }

  boot();
})(window.MGS);

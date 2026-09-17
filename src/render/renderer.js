/* Drawing.

   The "voxel" look is faked with one trick: every solid thing is drawn twice -
   a flat base rectangle, then the same rectangle again nudged AWAY from the
   centre of the screen by an amount proportional to its height. Joining the two
   with side quads gives blocks that lean outward like a toy city. No 3D, no
   sprites, no external art. */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var C = MGS.CONFIG;
  var util = MGS.util;

  var canvas, ctx;
  var cssW = 0, cssH = 0, dpr = 1;
  var scale = 1;
  var cam = { x: 0, y: 0 };
  var HEIGHT_K = 0.00052;

  var shadeCache = new Map();

  function shade(hex, f) {
    var k = hex + '|' + f;
    var cached = shadeCache.get(k);
    if (cached) return cached;
    var n = parseInt(hex.slice(1), 16);
    var r = util.clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
    var g = util.clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
    var b = util.clamp(Math.round((n & 255) * f), 0, 255);
    var out = 'rgb(' + r + ',' + g + ',' + b + ')';
    shadeCache.set(k, out);
    return out;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    scale = cssH / C.VIEW_HEIGHT;
  }

  /* Extruded block: base rect + two visible side faces + top face. */
  function block(x, y, w, h, height, color) {
    var cxw = x + w / 2, cyw = y + h / 2;
    var k = height * HEIGHT_K;
    var ox = (cxw - cam.x) * k;
    var oy = (cyw - cam.y) * k;
    var side = shade(color, 0.62);

    ctx.fillStyle = side;
    // Only the faces pointing the same way as the offset are visible.
    if (ox !== 0) {
      var sx = ox > 0 ? x + w : x;
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx + ox, y + oy);
      ctx.lineTo(sx + ox, y + oy + h);
      ctx.lineTo(sx, y + h);
      ctx.closePath();
      ctx.fill();
    }
    if (oy !== 0) {
      var sy = oy > 0 ? y + h : y;
      ctx.beginPath();
      ctx.moveTo(x, sy);
      ctx.lineTo(x + ox, sy + oy);
      ctx.lineTo(x + ox + w, sy + oy);
      ctx.lineTo(x + w, sy);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = color;
    ctx.fillRect(x + ox, y + oy, w, h);
  }

  function rotatedRect(x, y, angle, w, h, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  /* A car: ground shadow, dark chassis, then the body lifted by the same
     parallax offset the buildings use so it reads as a solid block. */
  function drawCar(x, y, angle, spec, flash, lift) {
    var w = spec.w, h = spec.h;
    var height = lift == null ? 26 : lift;

    ctx.save();
    ctx.translate(x + 7, y + 9);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();

    rotatedRect(x, y, angle, w, h, shade(spec.body, 0.55));

    var k = height * HEIGHT_K;
    var ox = (x - cam.x) * k;
    var oy = (y - cam.y) * k;

    ctx.save();
    ctx.translate(x + ox, y + oy);
    ctx.rotate(angle);

    ctx.fillStyle = flash > 0 ? '#ffffff' : spec.body;
    ctx.fillRect(-w / 2, -h / 2, w, h);

    // Roof / cabin.
    ctx.fillStyle = flash > 0 ? '#ffd9d9' : spec.roof;
    ctx.fillRect(-w * 0.22, -h * 0.34, w * 0.46, h * 0.68);

    // Windscreen and nose stripe.
    ctx.fillStyle = spec.trim;
    ctx.fillRect(w * 0.24, -h * 0.34, w * 0.1, h * 0.68);
    ctx.fillRect(-w * 0.46, -h * 0.4, w * 0.08, h * 0.8);

    ctx.restore();
  }

  var Renderer = {
    init: function (el) {
      canvas = el;
      ctx = canvas.getContext('2d', { alpha: false });
      resize();
      window.addEventListener('resize', resize);
    },

    camera: cam,
    width: function () { return cssW; },
    height: function () { return cssH; },

    setCamera: function (x, y) { cam.x = x; cam.y = y; },

    /* --- main pass --------------------------------------------------------- */

    draw: function (state) {
      var world = MGS.World;
      var effects = MGS.Effects;
      var player = state.player;

      var shakeAmt = effects.shakeAmount();
      var shx = (Math.random() - 0.5) * shakeAmt;
      var shy = (Math.random() - 0.5) * shakeAmt;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#1b2029';
      ctx.fillRect(0, 0, cssW, cssH);

      ctx.setTransform(dpr * scale, 0, 0, dpr * scale,
        dpr * (cssW / 2 + shx - cam.x * scale),
        dpr * (cssH / 2 + shy - cam.y * scale));

      var halfW = C.VIEW_HEIGHT * (cssW / cssH) / 2 + 80;
      var halfH = C.VIEW_HEIGHT / 2 + 80;
      var view = {
        x0: cam.x - halfW, x1: cam.x + halfW,
        y0: cam.y - halfH, y1: cam.y + halfH
      };

      Renderer.drawGround(world, view);
      Renderer.drawRoads(world, view);
      Renderer.drawSlicks(effects);
      Renderer.drawPickups(world, view);
      Renderer.drawObstacles(world, view, false);

      // Cars sit between the flat world and the tall buildings, so buildings
      // can lean over them convincingly.
      Renderer.drawTraffic(view);
      Renderer.drawUnits(view);
      if (player && (!player.dead || state.deathFade < 0.6)) {
        drawCar(player.x, player.y, player.angle, player.vehicle, player.hitFlash,
          player.air > 0 ? 70 : 26);
      }

      Renderer.drawObstacles(world, view, true);
      Renderer.drawShells();
      Renderer.drawHeli(player);
      Renderer.drawParticles(effects);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var flash = effects.flashAmount();
      if (flash > 0.01) {
        ctx.fillStyle = 'rgba(255,220,150,' + (flash * 0.35).toFixed(3) + ')';
        ctx.fillRect(0, 0, cssW, cssH);
      }

      if (state.hud) Renderer.drawHud(state);
    },

    drawGround: function (world, view) {
      var chunks = world.activeChunks();
      for (var i = 0; i < chunks.length; i++) {
        var c = chunks[i];
        if (c.x > view.x1 || c.x + C.CHUNK < view.x0) continue;
        if (c.y > view.y1 || c.y + C.CHUNK < view.y0) continue;
        var pal = world.BIOMES[c.biome];
        ctx.fillStyle = pal.ground;
        ctx.fillRect(c.x, c.y, C.CHUNK, C.CHUNK);
        // A faint checker so speed is readable even on empty ground.
        ctx.fillStyle = pal.ground2;
        for (var t = 0; t < C.CHUNK_TILES; t += 2) {
          ctx.fillRect(c.x, c.y + t * C.TILE, C.CHUNK, C.TILE);
        }
      }
    },

    drawRoads: function (world, view) {
      var sp = world.ROAD_SPACING;
      var pal = world.BIOMES[world.biomeAt(cam.x, cam.y)];
      ctx.fillStyle = pal.road;

      var kx0 = Math.floor(view.x0 / sp) - 1, kx1 = Math.ceil(view.x1 / sp) + 1;
      var ky0 = Math.floor(view.y0 / sp) - 1, ky1 = Math.ceil(view.y1 / sp) + 1;
      var k;

      for (k = kx0; k <= kx1; k++) ctx.fillRect(k * sp, view.y0, C.TILE, view.y1 - view.y0);
      for (k = ky0; k <= ky1; k++) ctx.fillRect(view.x0, k * sp, view.x1 - view.x0, C.TILE);

      // Lane dividers.
      ctx.fillStyle = '#d9cf9e';
      var dash = 46, gap = 44, step = dash + gap;
      for (k = kx0; k <= kx1; k++) {
        var cx = k * sp + C.TILE / 2 - 3;
        var startY = Math.floor(view.y0 / step) * step;
        for (var y = startY; y < view.y1; y += step) ctx.fillRect(cx, y, 6, dash);
      }
      for (k = ky0; k <= ky1; k++) {
        var cy = k * sp + C.TILE / 2 - 3;
        var startX = Math.floor(view.x0 / step) * step;
        for (var x = startX; x < view.x1; x += step) ctx.fillRect(x, cy, dash, 6);
      }
    },

    drawObstacles: function (world, view, tallPass) {
      var chunks = world.activeChunks();
      for (var i = 0; i < chunks.length; i++) {
        var obs = chunks[i].obstacles;
        for (var j = 0; j < obs.length; j++) {
          var o = obs[j];
          if (!o.alive) continue;
          if (o.x > view.x1 || o.x + o.w < view.x0) continue;
          if (o.y > view.y1 || o.y + o.h < view.y0) continue;

          var tall = o.height > 40;
          if (tall !== tallPass) continue;

          if (o.kind === 'water') {
            ctx.fillStyle = o.color;
            ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.fillStyle = 'rgba(255,255,255,0.14)';
            for (var s = 0; s < o.h; s += 26) {
              ctx.fillRect(o.x + 10 + (s % 52), o.y + s, o.w * 0.35, 5);
            }
            continue;
          }

          if (o.ramp) {
            ctx.fillStyle = o.color;
            ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.fillStyle = '#f0f0e6';
            for (var b = 0; b < o.w; b += 22) ctx.fillRect(o.x + b, o.y, 11, o.h);
            continue;
          }

          block(o.x, o.y, o.w, o.h, o.height, o.color);
        }
      }
    },

    drawPickups: function (world, view) {
      var chunks = world.activeChunks();
      var t = performance.now() * 0.004;
      for (var i = 0; i < chunks.length; i++) {
        var list = chunks[i].pickups;
        for (var j = 0; j < list.length; j++) {
          var p = list[j];
          if (p.taken) continue;
          if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
          var bob = Math.sin(t + p.x * 0.01) * 3;
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(p.x - 11, p.y - 6, 22, 13);
          ctx.fillStyle = '#35c66b';
          ctx.fillRect(p.x - 11, p.y - 7 + bob, 22, 13);
          ctx.fillStyle = '#d8f5e2';
          ctx.fillRect(p.x - 2, p.y - 4 + bob, 4, 7);
        }
      }
    },

    drawSlicks: function (effects) {
      var list = effects.slicks.active;
      ctx.fillStyle = 'rgba(18,20,26,0.72)';
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * Math.min(1, s.life), 0, MGS.TAU);
        ctx.fill();
      }
    },

    drawTraffic: function (view) {
      var list = MGS.Traffic.pool.active;
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.x < view.x0 || c.x > view.x1 || c.y < view.y0 || c.y > view.y1) continue;
        drawCar(c.x, c.y, c.angle,
          { w: c.w, h: c.h, body: c.color, roof: '#2c333d', trim: '#1b2028' }, 0, 22);
      }
    },

    drawUnits: function (view) {
      var list = MGS.Pursuit.units.active;
      for (var i = 0; i < list.length; i++) {
        var u = list[i];
        if (u.x < view.x0 || u.x > view.x1 || u.y < view.y0 || u.y > view.y1) continue;
        var t = MGS.Pursuit.TYPES[u.type];
        drawCar(u.x, u.y, u.angle,
          { w: u.w, h: u.h, body: t.body, roof: t.roof, trim: t.trim },
          u.hitFlash, u.type === 'tank' ? 34 : 26);

        // Flashing light bar.
        if (u.type === 'police' || u.type === 'swat') {
          var on = Math.floor(performance.now() * 0.006) % 2 === 0;
          ctx.fillStyle = on ? '#ff3b30' : '#2f7bff';
          ctx.save();
          ctx.translate(u.x, u.y);
          ctx.rotate(u.angle);
          ctx.fillRect(-4, -u.h * 0.5 - 4, 8, u.h + 8);
          ctx.restore();
        }
        if (u.type === 'tank') {
          ctx.save();
          ctx.translate(u.x, u.y);
          ctx.rotate(u.angle);
          ctx.fillStyle = '#2b3220';
          ctx.fillRect(0, -5, u.w * 0.75, 10);
          ctx.restore();
        }
      }
    },

    drawShells: function () {
      var list = MGS.Pursuit.shells.active;
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        ctx.fillStyle = s.friendly ? '#7fe3ff' : '#ffb23f';
        ctx.fillRect(s.x - 5, s.y - 5, 10, 10);
        ctx.fillStyle = 'rgba(255,180,60,0.35)';
        ctx.fillRect(s.prevX - 3, s.prevY - 3, 6, 6);
      }
    },

    drawHeli: function (player) {
      var h = MGS.Pursuit.heli();
      if (!h) return;

      if (h.target) {
        var pulse = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() * 0.012));
        ctx.strokeStyle = 'rgba(255,60,50,' + pulse.toFixed(2) + ')';
        ctx.lineWidth = 5;
        ctx.strokeRect(h.target.x - 60, h.target.y - 60, 120, 120);
        ctx.fillStyle = 'rgba(255,60,50,0.12)';
        ctx.fillRect(h.target.x - 60, h.target.y - 60, 120, 120);
      }

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(h.x - 26, h.y - 14, 52, 28);

      var lift = 260;
      var k = lift * HEIGHT_K;
      var hx = h.x + (h.x - cam.x) * k;
      var hy = h.y + (h.y - cam.y) * k;

      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(h.angle);
      ctx.fillStyle = '#2d3b4d';
      ctx.fillRect(-26, -13, 52, 26);
      ctx.fillStyle = '#4a5f7a';
      ctx.fillRect(-6, -9, 22, 18);
      ctx.fillStyle = '#1d2733';
      ctx.fillRect(-46, -4, 24, 8);
      // Rotor.
      ctx.rotate(h.rotor);
      ctx.fillStyle = 'rgba(210,225,240,0.5)';
      ctx.fillRect(-58, -3, 116, 6);
      ctx.fillRect(-3, -58, 6, 116);
      ctx.restore();
    },

    drawParticles: function (effects) {
      var list = effects.particles.active;
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var a = util.clamp(p.life / p.maxLife, 0, 1);

        if (p.kind === 'text') {
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          ctx.font = 'bold ' + p.size + 'px Trebuchet MS, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(p.text, p.x, p.y);
          ctx.globalAlpha = 1;
          continue;
        }

        if (p.kind === 'smoke') {
          ctx.globalAlpha = a * 0.5;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, MGS.TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
          continue;
        }

        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        if (p.kind === 'box') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        } else {
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;
      }
    },

    /* --- HUD ---------------------------------------------------------------- */

    drawHud: function (state) {
      var w = cssW, player = state.player, wanted = MGS.Wanted;

      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, w, 86);

      ctx.fillStyle = '#f4f1e8';
      ctx.font = 'bold 40px Trebuchet MS, sans-serif';
      ctx.fillText(Math.floor(wanted.score), 22, 52);

      ctx.font = 'bold 12px Trebuchet MS, sans-serif';
      ctx.fillStyle = 'rgba(244,241,232,0.55)';
      ctx.fillText('SCORE', 24, 70);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#35c66b';
      ctx.font = 'bold 34px Trebuchet MS, sans-serif';
      ctx.fillText('$' + state.run.cash, w - 22, 48);
      ctx.fillStyle = 'rgba(244,241,232,0.55)';
      ctx.font = 'bold 12px Trebuchet MS, sans-serif';
      ctx.fillText('THIS RUN', w - 22, 68);

      // Heat sirens.
      var count = 6, size = 16, gapS = 9;
      var total = count * size + (count - 1) * gapS;
      var x0 = (w - total) / 2;
      for (var i = 0; i < count; i++) {
        var lit = i < wanted.level;
        ctx.fillStyle = lit
          ? (Math.floor(performance.now() * 0.006) % 2 === 0 ? '#ff4b3e' : '#ff8a80')
          : 'rgba(244,241,232,0.16)';
        ctx.beginPath();
        ctx.arc(x0 + i * (size + gapS) + size / 2, 26, size / 2, 0, MGS.TAU);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(244,241,232,0.2)';
      ctx.fillRect(x0, 46, total, 5);
      ctx.fillStyle = '#ffc531';
      ctx.fillRect(x0, 46, total * wanted.progress(), 5);

      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(244,241,232,0.7)';
      ctx.font = 'bold 12px Trebuchet MS, sans-serif';
      ctx.fillText(wanted.label(), w / 2, 70);

      // Hull bar.
      var barW = 260, barH = 16, bx = 22, by = cssH - 42;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(bx - 4, by - 4, barW + 8, barH + 8);
      var hp01 = util.clamp(player.hp / player.maxHp, 0, 1);
      ctx.fillStyle = hp01 > 0.5 ? '#35c66b' : (hp01 > 0.25 ? '#ffc531' : '#ff4b3e');
      ctx.fillRect(bx, by, barW * hp01, barH);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(244,241,232,0.75)';
      ctx.font = 'bold 11px Trebuchet MS, sans-serif';
      ctx.fillText('HULL', bx, by - 9);

      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(244,241,232,0.5)';
      ctx.fillText(player.vehicle.name.toUpperCase() + '   ' +
        Math.round(player.speed / 6) + ' MPH', cssW - 22, cssH - 24);

      // BUSTED meter.
      var bust = wanted.bustProgress();
      if (bust > 0.02) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,75,62,' + (0.55 + bust * 0.45).toFixed(2) + ')';
        ctx.font = 'bold 26px Trebuchet MS, sans-serif';
        ctx.fillText('GET MOVING', cssW / 2, cssH * 0.72);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(cssW / 2 - 120, cssH * 0.72 + 14, 240, 10);
        ctx.fillStyle = '#ff4b3e';
        ctx.fillRect(cssW / 2 - 120, cssH * 0.72 + 14, 240 * bust, 10);
      }
    },

    /* --- garage thumbnails ---------------------------------------------------- */

    carSprite: function (vehicle, width, height) {
      var c = document.createElement('canvas');
      var d = Math.min(window.devicePixelRatio || 1, 2);
      c.width = width * d;
      c.height = height * d;
      c.style.width = width + 'px';
      c.style.height = height + 'px';
      var g = c.getContext('2d');
      g.setTransform(d, 0, 0, d, 0, 0);

      var s = Math.min(width / (vehicle.w + 26), height / (vehicle.h + 26));
      g.translate(width / 2, height / 2);
      g.scale(s, s);

      var w = vehicle.w, h = vehicle.h;
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(-w / 2 + 5, -h / 2 + 7, w, h);
      g.fillStyle = shade(vehicle.body, 0.55);
      g.fillRect(-w / 2, -h / 2, w, h);
      g.fillStyle = vehicle.body;
      g.fillRect(-w / 2 - 3, -h / 2 - 4, w, h);
      g.fillStyle = vehicle.roof;
      g.fillRect(-w * 0.22 - 3, -h * 0.34 - 4, w * 0.46, h * 0.68);
      g.fillStyle = vehicle.trim;
      g.fillRect(w * 0.24 - 3, -h * 0.34 - 4, w * 0.1, h * 0.68);
      g.fillRect(-w * 0.46 - 3, -h * 0.4 - 4, w * 0.08, h * 0.8);
      return c;
    }
  };

  MGS.Renderer = Renderer;
})(window.MGS);

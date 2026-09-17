/* Particles, floating score text, oil slicks and screen shake.
   All pooled - nothing is allocated once a run is under way. */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var util = MGS.util;

  function newParticle() {
    return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 4, rot: 0,
             spin: 0, color: '#fff', kind: 'box', text: '', alive: false };
  }
  function resetParticle(p) {
    p.x = p.y = p.vx = p.vy = 0;
    p.life = p.maxLife = 1;
    p.size = 4; p.rot = 0; p.spin = 0;
    p.color = '#fff'; p.kind = 'box'; p.text = '';
  }

  function newSlick() {
    return { x: 0, y: 0, r: 0, life: 0, alive: false };
  }
  function resetSlick(s) { s.x = s.y = 0; s.r = 46; s.life = 9; }

  var particles = new MGS.Pool(newParticle, resetParticle);
  var slicks = new MGS.Pool(newSlick, resetSlick);

  var shake = 0;
  var flash = 0;

  var Effects = {
    particles: particles,
    slicks: slicks,

    reset: function () {
      particles.clear();
      slicks.clear();
      shake = 0;
      flash = 0;
    },

    shakeBy: function (amount) { shake = Math.min(34, shake + amount); },
    shakeAmount: function () { return shake; },
    flashAmount: function () { return flash; },

    debris: function (x, y, count, color) {
      for (var i = 0; i < count; i++) {
        var p = particles.spawn();
        var a = Math.random() * MGS.TAU;
        var sp = 90 + Math.random() * 320;
        p.kind = 'box';
        p.x = x; p.y = y;
        p.vx = Math.cos(a) * sp;
        p.vy = Math.sin(a) * sp;
        p.maxLife = p.life = 0.45 + Math.random() * 0.6;
        p.size = 3 + Math.random() * 7;
        p.rot = Math.random() * MGS.TAU;
        p.spin = (Math.random() - 0.5) * 14;
        p.color = color || '#c9c3b4';
      }
    },

    smoke: function (x, y, count, color) {
      for (var i = 0; i < count; i++) {
        var p = particles.spawn();
        var a = Math.random() * MGS.TAU;
        p.kind = 'smoke';
        p.x = x; p.y = y;
        p.vx = Math.cos(a) * 40;
        p.vy = Math.sin(a) * 40;
        p.maxLife = p.life = 0.6 + Math.random() * 0.8;
        p.size = 10 + Math.random() * 18;
        p.color = color || '#55606d';
      }
    },

    explosion: function (x, y, scale) {
      scale = scale || 1;
      for (var i = 0; i < 14 * scale; i++) {
        var p = particles.spawn();
        var a = Math.random() * MGS.TAU;
        var sp = 140 + Math.random() * 420 * scale;
        p.kind = 'spark';
        p.x = x; p.y = y;
        p.vx = Math.cos(a) * sp;
        p.vy = Math.sin(a) * sp;
        p.maxLife = p.life = 0.3 + Math.random() * 0.45;
        p.size = 5 + Math.random() * 11 * scale;
        p.color = Math.random() < 0.5 ? '#ffd23f' : '#ff6b35';
      }
      Effects.smoke(x, y, Math.round(7 * scale), '#3c4450');
      Effects.debris(x, y, Math.round(6 * scale), '#7d7466');
      Effects.shakeBy(9 * scale);
      flash = Math.min(1, flash + 0.22 * scale);
    },

    popText: function (x, y, text, color) {
      var p = particles.spawn();
      p.kind = 'text';
      p.x = x; p.y = y;
      p.vx = 0; p.vy = -62;
      p.maxLife = p.life = 0.95;
      p.size = 20;
      p.text = text;
      p.color = color || '#ffd23f';
    },

    dropSlick: function (x, y) {
      var s = slicks.spawn();
      s.x = x; s.y = y;
      s.r = 40 + Math.random() * 16;
      s.life = 9;
    },

    /* Returns true if the point is sitting in oil. */
    slickAt: function (x, y) {
      var list = slicks.active;
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        if (util.dist2(x, y, s.x, s.y) < s.r * s.r) return true;
      }
      return false;
    },

    update: function (dt) {
      var list = particles.active, i, p;
      for (i = 0; i < list.length; i++) {
        p = list[i];
        p.life -= dt;
        if (p.life <= 0) { particles.release(p); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        var drag = p.kind === 'smoke' ? 1.6 : 3.2;
        var k = Math.exp(-drag * dt);
        p.vx *= k;
        p.vy *= k;
        if (p.kind === 'smoke') p.size += 26 * dt;
        if (p.kind === 'text') p.vy += 40 * dt;
      }
      particles.sweep();

      var sl = slicks.active;
      for (i = 0; i < sl.length; i++) {
        sl[i].life -= dt;
        if (sl[i].life <= 0) slicks.release(sl[i]);
      }
      slicks.sweep();

      shake = Math.max(0, shake - shake * 6 * dt - 6 * dt);
      flash = Math.max(0, flash - flash * 7 * dt - 0.3 * dt);
    }
  };

  MGS.Effects = Effects;
})(window.MGS);

/* All sound is synthesized with the Web Audio API - no audio files, nothing
   copyrighted. Browsers block audio until the player interacts, so the context
   is created lazily on the first key press. */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var ctx = null;
  var master = null;
  var noiseBuffer = null;
  var muted = false;

  var engine = null;  // { osc, sub, filter, gain }
  var siren = null;   // { osc, lfo, lfoGain, gain }

  function ensure() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    master.connect(ctx.destination);

    var len = Math.floor(ctx.sampleRate * 1.0);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = noiseBuffer.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function now() { return ctx.currentTime; }

  /* One-shot noise burst: crashes, explosions, screech. */
  function burst(opts) {
    if (!ensure() || muted) return;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    var filter = ctx.createBiquadFilter();
    filter.type = opts.type || 'lowpass';
    filter.frequency.setValueAtTime(opts.from, now());
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.to), now() + opts.dur);
    filter.Q.value = opts.q || 1;

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(opts.vol, now());
    gain.gain.exponentialRampToValueAtTime(0.0001, now() + opts.dur);

    src.connect(filter).connect(gain).connect(master);
    src.start();
    src.stop(now() + opts.dur + 0.02);
  }

  /* One-shot pitched blip: pickups, menu clicks, unlock stingers. */
  function tone(opts) {
    if (!ensure() || muted) return;
    var osc = ctx.createOscillator();
    osc.type = opts.wave || 'square';
    var t = now() + (opts.delay || 0);
    osc.frequency.setValueAtTime(opts.from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.to || opts.from), t + opts.dur);

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(opts.vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);

    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + opts.dur + 0.02);
  }

  var Audio = {
    unlock: function () {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
    },

    isMuted: function () { return muted; },

    toggleMute: function () {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.85;
      return muted;
    },

    /* --- continuous run sounds --- */

    startEngine: function () {
      if (!ensure() || engine) return;
      var osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 60;

      var sub = ctx.createOscillator();
      sub.type = 'square';
      sub.frequency.value = 30;

      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 620;
      filter.Q.value = 3;

      var gain = ctx.createGain();
      gain.gain.value = 0.0;

      osc.connect(filter);
      sub.connect(filter);
      filter.connect(gain).connect(master);
      osc.start();
      sub.start();
      engine = { osc: osc, sub: sub, filter: filter, gain: gain };
    },

    /* speed01 = current speed as a fraction of top speed. */
    updateEngine: function (speed01, boosting) {
      if (!engine) return;
      var f = 48 + speed01 * 130 + (boosting ? 26 : 0);
      engine.osc.frequency.setTargetAtTime(f, now(), 0.06);
      engine.sub.frequency.setTargetAtTime(f * 0.5, now(), 0.06);
      engine.filter.frequency.setTargetAtTime(420 + speed01 * 900, now(), 0.08);
      engine.gain.gain.setTargetAtTime(0.05 + speed01 * 0.05, now(), 0.1);
    },

    startSiren: function () {
      if (!ensure() || siren) return;
      var osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 760;

      var lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.9;

      var lfoGain = ctx.createGain();
      lfoGain.gain.value = 170;
      lfo.connect(lfoGain).connect(osc.frequency);

      var gain = ctx.createGain();
      gain.gain.value = 0;

      osc.connect(gain).connect(master);
      osc.start();
      lfo.start();
      siren = { osc: osc, lfo: lfo, lfoGain: lfoGain, gain: gain };
    },

    /* More pursuers and higher heat = louder, faster wail. */
    updateSiren: function (heat, chaserCount) {
      if (!siren) return;
      var intensity = Math.min(1, chaserCount / 8) * Math.min(1, heat / 6);
      siren.gain.gain.setTargetAtTime(intensity * 0.055, now(), 0.3);
      siren.lfo.frequency.setTargetAtTime(0.8 + heat * 0.22, now(), 0.4);
    },

    stopRunLoops: function () {
      if (engine) {
        engine.gain.gain.setTargetAtTime(0, now(), 0.05);
        var e = engine;
        setTimeout(function () { e.osc.stop(); e.sub.stop(); }, 300);
        engine = null;
      }
      if (siren) {
        siren.gain.gain.setTargetAtTime(0, now(), 0.05);
        var s = siren;
        setTimeout(function () { s.osc.stop(); s.lfo.stop(); }, 300);
        siren = null;
      }
    },

    /* --- one shots --- */

    crash: function (force) {
      var v = Math.min(0.5, 0.12 + force * 0.4);
      burst({ from: 1800, to: 90, dur: 0.32, vol: v });
      tone({ wave: 'sawtooth', from: 150, to: 40, dur: 0.22, vol: v * 0.5 });
    },

    explosion: function () {
      burst({ from: 2400, to: 60, dur: 0.75, vol: 0.5 });
      tone({ wave: 'sine', from: 110, to: 28, dur: 0.6, vol: 0.4 });
    },

    screech: function () {
      burst({ type: 'bandpass', from: 2600, to: 1500, dur: 0.22, vol: 0.09, q: 7 });
    },

    cash: function () {
      tone({ wave: 'square', from: 880, to: 1320, dur: 0.09, vol: 0.14 });
    },

    cannon: function () {
      tone({ wave: 'sawtooth', from: 220, to: 44, dur: 0.4, vol: 0.34 });
      burst({ from: 900, to: 70, dur: 0.5, vol: 0.34 });
    },

    heat: function () {
      tone({ wave: 'square', from: 420, to: 640, dur: 0.14, vol: 0.2 });
      tone({ wave: 'square', from: 640, to: 900, dur: 0.16, vol: 0.2, delay: 0.12 });
    },

    click: function () {
      tone({ wave: 'square', from: 520, to: 660, dur: 0.06, vol: 0.12 });
    },

    unlockJingle: function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        tone({ wave: 'square', from: f, to: f, dur: 0.16, vol: 0.16, delay: i * 0.09 });
      });
    },

    bust: function () {
      tone({ wave: 'sawtooth', from: 400, to: 90, dur: 0.9, vol: 0.3 });
    }
  };

  MGS.Audio = Audio;
})(window.MGS);

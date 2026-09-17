/* Keyboard (and a touch fallback) reduced to three numbers the car cares about:
   steer (-1..1), throttle (boost) and brake. */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var held = Object.create(null);
  var touchSteer = 0;
  var touchBoost = false;
  var listeners = [];

  var MAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'boost', KeyW: 'boost',
    ArrowDown: 'brake', KeyS: 'brake',
    Space: 'boost'
  };

  function onKeyDown(e) {
    var action = MAP[e.code];
    if (action) {
      held[action] = true;
      e.preventDefault();
    }
    for (var i = 0; i < listeners.length; i++) listeners[i](e);
  }

  function onKeyUp(e) {
    var action = MAP[e.code];
    if (action) {
      held[action] = false;
      e.preventDefault();
    }
  }

  function readTouch(e) {
    touchSteer = 0;
    touchBoost = e.touches.length > 1;
    for (var i = 0; i < e.touches.length; i++) {
      var t = e.touches[i];
      if (t.clientY < window.innerHeight * 0.25) continue; // keep the top strip for UI
      touchSteer += t.clientX < window.innerWidth / 2 ? -1 : 1;
    }
    touchSteer = Math.max(-1, Math.min(1, touchSteer));
  }

  function endTouch(e) {
    if (e.touches.length === 0) { touchSteer = 0; touchBoost = false; }
    else readTouch(e);
  }

  var Input = {
    attach: function (canvas) {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', Input.releaseAll);
      canvas.addEventListener('touchstart', function (e) { e.preventDefault(); readTouch(e); }, { passive: false });
      canvas.addEventListener('touchmove', function (e) { e.preventDefault(); readTouch(e); }, { passive: false });
      canvas.addEventListener('touchend', endTouch);
      canvas.addEventListener('touchcancel', endTouch);
    },

    /* Fired for every keydown, so screens can listen for Enter / Escape / M. */
    onKey: function (fn) { listeners.push(fn); },

    releaseAll: function () {
      for (var k in held) held[k] = false;
      touchSteer = 0;
      touchBoost = false;
    },

    steer: function () {
      var s = 0;
      if (held.left) s -= 1;
      if (held.right) s += 1;
      return s || touchSteer;
    },

    boost: function () { return !!held.boost || touchBoost; },
    brake: function () { return !!held.brake; }
  };

  MGS.Input = Input;
})(window.MGS);

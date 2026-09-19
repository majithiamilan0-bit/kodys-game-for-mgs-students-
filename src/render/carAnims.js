/* Car animation.

   Two layers:
     1. WHEELS + BODY ROLL - every car gets these. Wheels spin with speed, front
        wheels steer, and the body leans into corners.
     2. A UNIQUE FLOURISH per car - no two cars share one. Add a car, add a case.

   Everything here draws in the car's own frame: the canvas is already translated
   to the car's centre and rotated so +x points out of the nose. */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var TAU = MGS.TAU;

  function shadeHex(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    var g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    var b = Math.min(255, Math.round((n & 255) * f));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* Four wheels. The moving light band across each one reads as rotation. */
  function drawWheels(ctx, car, st) {
    var w = car.w, h = car.h;
    var ww = Math.max(9, w * 0.2);
    var wh = Math.max(5, h * 0.19);
    var xs = [w * 0.29, -w * 0.29];
    var ys = [-h * 0.5, h * 0.5 - wh];
    var steer = (st.steer || 0) * 0.42;

    for (var i = 0; i < 2; i++) {
      for (var j = 0; j < 2; j++) {
        var front = i === 0;
        ctx.save();
        ctx.translate(xs[i], ys[j] + wh / 2);
        if (front) ctx.rotate(steer);
        ctx.fillStyle = '#14181f';
        ctx.fillRect(-ww / 2, -wh / 2, ww, wh);
        // Spinning band.
        var phase = (st.wheelSpin + (front ? 0.5 : 0)) % 1;
        ctx.fillStyle = 'rgba(210,215,225,0.55)';
        ctx.fillRect(-ww / 2 + phase * (ww - 3), -wh / 2, 3, wh);
        ctx.restore();
      }
    }
  }

  /* The one-of-a-kind bit. `st` carries t (seconds), speed01, drift01, ab. */
  function drawFlourish(ctx, car, st) {
    var w = car.w, h = car.h, t = st.t, s = st.speed01;

    switch (car.anim) {
      /* ---------------- COMMON ---------------- */
      case 'toolbox': {                       // Site Pickup - rattling toolbox
        var j = Math.sin(t * 34) * s * 1.6;
        ctx.fillStyle = '#3d4650';
        ctx.fillRect(-w * 0.42, -h * 0.26 + j, w * 0.2, h * 0.52);
        ctx.fillStyle = '#95a1ad';
        ctx.fillRect(-w * 0.40, -h * 0.05 + j, w * 0.16, 3);
        break;
      }
      case 'antenna': {                       // Bluebird - swaying whip antenna
        var sway = Math.sin(t * 7) * (0.25 + s * 0.7);
        ctx.strokeStyle = '#dfe6ee';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-w * 0.34, 0);
        ctx.quadraticCurveTo(-w * 0.55, sway * 8, -w * 0.72, sway * 16);
        ctx.stroke();
        break;
      }
      case 'exhaust': {                       // Hot Rodder - side pipe flames
        var puff = (Math.sin(t * 22) * 0.5 + 0.5) * s;
        ctx.fillStyle = 'rgba(255,140,40,' + (0.35 + puff * 0.6).toFixed(2) + ')';
        ctx.fillRect(-w * 0.52 - puff * 9, -h * 0.46, 8 + puff * 10, 4);
        ctx.fillRect(-w * 0.52 - puff * 9, h * 0.34, 8 + puff * 10, 4);
        break;
      }
      case 'mudflap': {                       // Rally Pup - flapping mudflaps
        var flap = Math.sin(t * 19) * s * 3;
        ctx.fillStyle = '#20252c';
        ctx.fillRect(-w * 0.5, -h * 0.5 + flap, 5, h * 0.3);
        ctx.fillRect(-w * 0.5, h * 0.2 - flap, 5, h * 0.3);
        break;
      }
      case 'bounce': {                        // Micro Bus - suspension bob
        var b = Math.sin(t * 9) * (1 + s * 2.5);
        ctx.fillStyle = shadeHex(car.roof, 1.05);
        ctx.fillRect(-w * 0.3, -h * 0.3 + b, w * 0.6, h * 0.16);
        break;
      }
      case 'roofrack': {                      // Estate Wagon - wobbling luggage
        var lean = Math.sin(t * 11) * st.drift01 * 3;
        ctx.fillStyle = '#6a5c48';
        ctx.fillRect(-w * 0.12, -h * 0.36 + lean, w * 0.3, h * 0.24);
        ctx.strokeStyle = '#3a3229';
        ctx.lineWidth = 2;
        ctx.strokeRect(-w * 0.12, -h * 0.36 + lean, w * 0.3, h * 0.24);
        break;
      }
      case 'tarisign': {                      // City Cab - blinking roof sign
        var on = Math.floor(t * 2.5) % 2 === 0;
        ctx.fillStyle = on ? '#fff3c4' : '#7a6a2e';
        ctx.fillRect(-w * 0.07, -h * 0.2, w * 0.16, h * 0.4);
        break;
      }
      case 'stripes': {                       // Track Day - scrolling stripes
        var off = (t * (0.4 + s * 3)) % 1;
        ctx.fillStyle = car.trim;
        for (var k = -1; k < 3; k++) {
          ctx.fillRect(-w / 2 + (k + off) * (w / 2.5), -h * 0.12, w * 0.12, h * 0.24);
        }
        break;
      }
      case 'bottles': {                       // Milk Float - rattling crates
        var r = Math.sin(t * 40) * s * 1.3;
        ctx.fillStyle = '#c9d6e0';
        for (var bi = 0; bi < 3; bi++) {
          ctx.fillRect(-w * 0.36 + bi * w * 0.19, -h * 0.3 + r, w * 0.14, h * 0.6);
        }
        break;
      }

      /* ---------------- RARE ---------------- */
      case 'spoiler': {                       // Velocity GT - spoiler lifts at speed
        var lift = s * 4;
        ctx.fillStyle = shadeHex(car.trim, 1.6);
        ctx.fillRect(-w * 0.46 - lift, -h * 0.56, 5, h * 1.12);
        break;
      }
      case 'lightbar': {                      // Ridgeback - sweeping spotlights
        var sweep = Math.sin(t * 2.2);
        ctx.fillStyle = '#1d2317';
        ctx.fillRect(w * 0.02, -h * 0.5, 5, h);
        ctx.fillStyle = 'rgba(255,250,200,0.5)';
        ctx.beginPath();
        ctx.moveTo(w * 0.06, 0);
        ctx.lineTo(w * 0.7, -h * 0.7 + sweep * h);
        ctx.lineTo(w * 0.7, -h * 0.2 + sweep * h);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'neon': {                          // Stretch Limo - pulsing underglow
        var glow = 0.3 + 0.35 * (Math.sin(t * 3) * 0.5 + 0.5);
        ctx.fillStyle = 'rgba(201,162,39,' + glow.toFixed(2) + ')';
        ctx.fillRect(-w * 0.52, -h * 0.62, w * 1.04, 4);
        ctx.fillRect(-w * 0.52, h * 0.48, w * 1.04, 4);
        break;
      }
      case 'spikes': {                        // Brawler - rotating hull spikes
        ctx.fillStyle = '#d5cfe0';
        for (var si = 0; si < 6; si++) {
          var a = t * 2.4 + si * (TAU / 6);
          var rx = Math.cos(a) * w * 0.5;
          var ry = Math.sin(a) * h * 0.62;
          ctx.fillRect(rx - 2.5, ry - 2.5, 5, 5);
        }
        break;
      }
      case 'awning': {                        // Camper - flapping awning
        var fl = Math.sin(t * 6) * (2 + s * 5);
        ctx.fillStyle = '#3d6b8c';
        ctx.beginPath();
        ctx.moveTo(-w * 0.1, h * 0.5);
        ctx.lineTo(w * 0.25, h * 0.5);
        ctx.lineTo(w * 0.25, h * 0.5 + 10 + fl);
        ctx.lineTo(-w * 0.1, h * 0.5 + 10 - fl);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'dish': {                          // Boxer Van - rotating radar dish
        ctx.save();
        ctx.rotate(t * 3.4);
        ctx.fillStyle = '#cfd6de';
        ctx.fillRect(-w * 0.03, -1.5, w * 0.26, 3);
        ctx.fillStyle = '#8f9aa6';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, TAU);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'hatch': {                         // Sapper - rear hatch opening
        var open = (Math.sin(t * 3) * 0.5 + 0.5) * 8;
        ctx.fillStyle = shadeHex(car.body, 0.7);
        ctx.fillRect(-w * 0.5 - open, -h * 0.34, open + 4, h * 0.68);
        break;
      }

      /* ---------------- EPIC ---------------- */
      case 'parachute': {                     // Drag Spec - chute at top speed
        if (s > 0.8) {
          var billow = Math.sin(t * 8) * 3;
          ctx.fillStyle = 'rgba(255,122,26,0.8)';
          ctx.beginPath();
          ctx.arc(-w * 0.85, billow, 13 + s * 4, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-w * 0.5, 0);
          ctx.lineTo(-w * 0.72, billow);
          ctx.stroke();
        }
        break;
      }
      case 'hoverbob': {                      // Hover Pod - floating ring
        var ring = (t * 1.6) % 1;
        ctx.strokeStyle = 'rgba(139,234,242,' + (1 - ring).toFixed(2) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.45 + ring * 22, h * 0.45 + ring * 16, 0, 0, TAU);
        ctx.stroke();
        break;
      }
      case 'suspension': {                    // Dune Crawler - independent travel
        ctx.fillStyle = '#5a4a2c';
        for (var wi = 0; wi < 4; wi++) {
          var px = (wi < 2 ? 1 : -1) * w * 0.3;
          var py = (wi % 2 ? 1 : -1) * h * 0.46;
          var travel = Math.sin(t * 13 + wi * 1.7) * s * 3.5;
          ctx.fillRect(px - 3, py - 3 + travel, 6, 6);
        }
        break;
      }
      case 'driftsmoke': {                    // Drift King - coloured tyre smoke
        if (st.drift01 > 0.25) {
          var puffs = 3;
          for (var di = 0; di < puffs; di++) {
            var age = ((t * 2.2 + di / puffs) % 1);
            ctx.fillStyle = 'rgba(244,122,174,' + ((1 - age) * 0.5).toFixed(2) + ')';
            ctx.beginPath();
            ctx.arc(-w * 0.45 - age * 26, (di - 1) * h * 0.3, 4 + age * 9, 0, TAU);
            ctx.fill();
          }
        }
        break;
      }
      case 'heatwave': {                      // Chili Machine - shimmering heat
        ctx.strokeStyle = 'rgba(255,120,60,0.45)';
        ctx.lineWidth = 2;
        for (var hi = 0; hi < 3; hi++) {
          var yy = -h * 0.3 + hi * h * 0.3;
          ctx.beginPath();
          ctx.moveTo(-w * 0.5, yy);
          ctx.quadraticCurveTo(-w * 0.7, yy + Math.sin(t * 12 + hi) * 5, -w * 0.9, yy);
          ctx.stroke();
        }
        break;
      }
      case 'phase': {                         // Nightshade - fading in and out
        var fade = 0.25 + 0.4 * (Math.sin(t * 4) * 0.5 + 0.5);
        ctx.fillStyle = 'rgba(155,127,224,' + fade.toFixed(2) + ')';
        ctx.fillRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
        break;
      }

      /* ---------------- LEGENDARY ---------------- */
      case 'tread': {                         // Crusher - scrolling tank treads
        var scroll = (st.wheelSpin * 2) % 1;
        ctx.fillStyle = '#1b2016';
        ctx.fillRect(-w / 2, -h * 0.56, w, h * 0.16);
        ctx.fillRect(-w / 2, h * 0.4, w, h * 0.16);
        ctx.fillStyle = '#39422b';
        for (var ti = 0; ti < 7; ti++) {
          var tx = -w / 2 + ((ti + scroll) * (w / 7)) % w;
          ctx.fillRect(tx, -h * 0.56, 4, h * 0.16);
          ctx.fillRect(tx, h * 0.4, 4, h * 0.16);
        }
        break;
      }
      case 'wing': {                          // Apex GP - DRS wing flapping open
        var drs = s > 0.75 ? 1 : 0;
        ctx.fillStyle = '#1f6fd0';
        ctx.save();
        ctx.translate(-w * 0.46, 0);
        ctx.rotate(drs * 0.5);
        ctx.fillRect(-2, -h * 0.7, 4, h * 1.4);
        ctx.restore();
        ctx.fillRect(w * 0.42, -h * 0.55, 3, h * 1.1);
        break;
      }
      case 'coins': {                         // Vault Van - coins spilling out
        for (var ci = 0; ci < 4; ci++) {
          var ca = (t * 1.8 + ci / 4) % 1;
          ctx.fillStyle = 'rgba(255,197,49,' + (1 - ca).toFixed(2) + ')';
          ctx.beginPath();
          ctx.arc(-w * 0.5 - ca * 30, Math.sin(ci * 2.1 + t) * h * 0.4, 3.5, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'trailer': {                       // Slick Rig - articulated trailer
        ctx.save();
        ctx.translate(-w * 0.5, 0);
        ctx.rotate(-(st.steer || 0) * 0.32);
        ctx.fillStyle = shadeHex(car.body, 0.72);
        ctx.fillRect(-w * 0.62, -h * 0.46, w * 0.62, h * 0.92);
        ctx.fillStyle = car.trim;
        ctx.fillRect(-w * 0.58, -h * 0.2, w * 0.5, h * 0.4);
        ctx.restore();
        break;
      }
      case 'turret': {                        // Salvo - turret tracking a target
        ctx.save();
        ctx.rotate(st.turret || 0);
        ctx.fillStyle = '#3b3026';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, TAU);
        ctx.fill();
        ctx.fillStyle = car.trim;
        ctx.fillRect(0, -2.5, w * 0.5, 5);
        ctx.restore();
        break;
      }
      case 'clock': {                         // Chrono - sweeping clock hand
        ctx.strokeStyle = '#6ce0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, h * 0.3, 0, TAU);
        ctx.stroke();
        ctx.save();
        ctx.rotate(-t * 2.6);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(h * 0.28, 0);
        ctx.stroke();
        ctx.restore();
        break;
      }
    }
  }

  MGS.CarAnims = {
    drawWheels: drawWheels,
    drawFlourish: drawFlourish
  };
})(window.MGS);

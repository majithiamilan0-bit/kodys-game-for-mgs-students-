/* The player's car.

   Physics model: velocity is split into a FORWARD component (along the nose) and
   a LATERAL component (sideways). Thrust and braking act on forward; "grip"
   decides how quickly the lateral component dies. Low grip = the car keeps
   sliding = drift. That one split is the whole arcade feel.

   Car abilities and power-ups only ever adjust the numbers going into that
   model - they never bypass it. */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var util = MGS.util;

  var BASE_TURN = 3.0;          // radians/sec at full speed
  var CRASH_SPEED = 150;        // impact below this is a bump, above it hurts
  var CRASH_DAMAGE = 0.13;      // hp lost per pixel/sec of impact over the threshold

  function Player() {
    this.reset(MGS.vehicleById(MGS.STARTING_CAR), 0, 0);
    this._scratch = [];
  }

  Player.prototype.reset = function (vehicle, x, y) {
    this.vehicle = vehicle;
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.speed = 0;
    this.maxHp = vehicle.hp;
    this.hp = vehicle.hp;
    this.radius = Math.max(vehicle.w, vehicle.h) * 0.42;
    this.air = 0;             // seconds left in the air after a ramp
    this.dead = false;
    this.drowned = false;
    this.drift = 0;           // how hard the car is sliding sideways right now
    this.steerInput = 0;
    this.boosting = false;
    this.wheelSpin = 0;       // drives the rotating-wheel animation
    this.bodyRoll = 0;        // drives the lean-into-corners animation
    this.rocketTimer = 0;
    this.hitFlash = 0;
    this.stillTimer = 0;      // how long we have been crawling (feeds BUSTED)
    MGS.Abilities.reset(this);
  };

  Player.prototype.damage = function (amount) {
    if (this.dead) return;
    if (MGS.Powerups.invulnerable()) return;
    amount = MGS.Abilities.absorbDamage(this, amount);
    if (amount <= 0) return;

    this.hp -= amount;
    this.hitFlash = 0.2;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
  };

  Player.prototype.update = function (dt, input, world, effects) {
    if (this.dead) return;

    this.prevX = this.x;
    this.prevY = this.y;

    var v = this.vehicle;
    var steer = input.steer();
    var braking = input.brake();
    this.boosting = input.boost();
    this.steerInput = steer;

    // --- split velocity into forward / lateral -----------------------------
    var fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    var fwd = this.vx * fx + this.vy * fy;
    var lat = -this.vx * fy + this.vy * fx;

    var speedMult = MGS.Abilities.topSpeedMult(this) * MGS.Powerups.speedMult();
    var topSpeed = v.topSpeed * speedMult * (this.boosting ? 1.28 : 1);
    var accel = v.accel * speedMult * (this.boosting ? 1.45 : 1);

    // --- steering: only bites when you are actually moving -----------------
    var speedNow = Math.abs(fwd);
    var gripFactor = util.clamp(speedNow / (v.topSpeed * 0.45), 0, 1);
    if (steer !== 0 && speedNow > 8) {
      var dir = fwd < 0 ? -1 : 1;
      this.angle += steer * BASE_TURN * MGS.Abilities.turnMult(this) * gripFactor * dir * dt;
      // Turning scrubs speed off, exactly like the original.
      fwd *= Math.exp(-0.55 * Math.abs(steer) * dt);
    }
    this.bodyRoll = util.damp(this.bodyRoll, steer * gripFactor, 9, dt);

    // --- throttle / brake ---------------------------------------------------
    if (braking) {
      fwd -= v.accel * 1.5 * dt;
      if (fwd < -v.topSpeed * 0.3) fwd = -v.topSpeed * 0.3;
    } else {
      // The car accelerates on its own - you never hold a "go" key.
      if (fwd < topSpeed) fwd = Math.min(topSpeed, fwd + accel * dt);
    }

    // Rolling resistance, plus extra drag off-road.
    var offRoad = !world.isRoad(this.x, this.y) && this.air <= 0;
    var drag = offRoad ? 1.15 : 0.55;
    fwd *= Math.exp(-drag * dt);

    // --- grip: kill the sideways slide -------------------------------------
    var gripOverride = MGS.Powerups.gripOverride();
    var baseGrip = gripOverride != null ? gripOverride : v.grip;
    var gripRate = this.air > 0 ? baseGrip * 0.25 : baseGrip;
    this.drift = Math.abs(lat);
    lat = util.damp(lat, 0, gripRate, dt);
    if (this.drift > 90) {
      if (Math.random() < 0.4) effects.smoke(this.x, this.y, 1, '#b9b2a4');
      if (Math.random() < 0.12) MGS.Audio.screech();
    }

    this.vx = fx * fwd - fy * lat;
    this.vy = fy * fwd + fx * lat;
    this.speed = Math.hypot(this.vx, this.vy);
    this.wheelSpin += this.speed * dt * 0.09;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // --- world collisions ---------------------------------------------------
    if (this.air > 0) {
      this.air -= dt;
    } else {
      this.collide(world, effects);
    }

    this.stillTimer = this.speed < 90 ? this.stillTimer + dt : 0;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.rocketTimer -= dt;
  };

  Player.prototype.collide = function (world, effects) {
    var list = world.obstaclesNear(this.x, this.y, this._scratch);
    var climbs = MGS.Abilities.climbsWalls(this);

    for (var i = 0; i < list.length; i++) {
      var o = list[i];

      if (o.ramp) {
        if (util.circleRect(this.x, this.y, this.radius, o) && this.speed > 150 && this.air <= 0) {
          this.air = 0.75;
          effects.smoke(this.x, this.y, 4, '#d9cdb6');
          MGS.Objectives.note('ramp');
        }
        continue;
      }

      if (o.deadly) {
        if (MGS.Abilities.survivesWater(this)) continue;
        if (util.circleRect(this.x, this.y, this.radius * 0.6, o)) {
          this.drowned = true;
          this.dead = true;
          effects.smoke(this.x, this.y, 12, '#9fd4f2');
          effects.shakeBy(14);
          return;
        }
        continue;
      }

      if (!o.solid) continue;

      var hit = util.resolveCircleRect(this.x, this.y, this.radius, o);
      if (!hit) continue;

      var impact = Math.abs(this.vx * hit.nx + this.vy * hit.ny);

      if (o.breakable) {
        o.alive = false;
        effects.debris(o.x + o.w / 2, o.y + o.h / 2, 8, o.color);
        MGS.Audio.crash(0.3);
        this.damage(4 * MGS.Abilities.obstacleDamageMult(this));
        this.vx *= 0.88;
        this.vy *= 0.88;
        continue;
      }

      // The Dune Crawler climbs walls instead of hitting them.
      if (climbs && this.speed > 140) {
        this.air = 0.6;
        effects.debris(this.x, this.y, 4, '#f2cd80');
        continue;
      }

      // Push out of the wall and bounce off it.
      this.x += hit.nx * hit.push;
      this.y += hit.ny * hit.push;
      var dot = this.vx * hit.nx + this.vy * hit.ny;
      this.vx -= hit.nx * dot * 1.35;
      this.vy -= hit.ny * dot * 1.35;
      this.vx *= 0.62;
      this.vy *= 0.62;

      if (impact > CRASH_SPEED) {
        var dmg = (impact - CRASH_SPEED) * CRASH_DAMAGE * MGS.Abilities.obstacleDamageMult(this);
        this.damage(dmg);
        effects.debris(this.x, this.y, 6, '#d8d2c4');
        effects.shakeBy(Math.min(16, impact * 0.03));
        MGS.Audio.crash(util.clamp(impact / 600, 0.15, 1));
      }
    }
  };

  /* Where the car will be in `t` seconds - used by pursuers to lead their aim. */
  Player.prototype.predict = function (t) {
    return { x: this.x + this.vx * t, y: this.y + this.vy * t };
  };

  MGS.Player = Player;
})(window.MGS);

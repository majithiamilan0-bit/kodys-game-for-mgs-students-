/* DOM screens: menu, how-to, garage, pause and results.
   The in-run HUD is drawn on the canvas; everything you can click lives here. */

window.MGS = window.MGS || {};

(function (MGS) {
  'use strict';

  var screens = {};
  var current = null;
  var hooks = {};

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function setText(name, value) {
    $$('[data-bind="' + name + '"]').forEach(function (el) { el.textContent = value; });
  }

  function rarityClass(r) { return 'r-' + r; }

  function statBar(label, value, max) {
    var pct = Math.max(4, Math.min(100, Math.round((value / max) * 100)));
    return '<div class="car-bar"><span>' + label + '</span><i><b style="width:' + pct + '%"></b></i></div>';
  }

  var UI = {
    init: function (handlers) {
      hooks = handlers || {};
      ['menu', 'howto', 'garage', 'results', 'pause', 'slot'].forEach(function (name) {
        screens[name] = document.getElementById('screen-' + name);
      });

      document.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-action]') : null;
        if (!btn) return;
        UI.action(btn.getAttribute('data-action'), btn);
      });

      MGS.Input.onKey(function (e) {
        if (e.code === 'KeyM') UI.action('mute');
        if (!current) {
          if (e.code === 'Escape' || e.code === 'KeyP') UI.action('pause');
          return;
        }
        if (e.code === 'Enter') {
          if (current === 'menu' || current === 'results') UI.action('drive');
          else if (current === 'pause') UI.action('resume');
          else if (current === 'slot') {
            var collect = $('[data-action="slot-collect"]');
            if (collect && !collect.disabled) UI.action('slot-collect');
          } else UI.action('menu');
        } else if (e.code === 'Escape') {
          if (current === 'pause') UI.action('resume');
          else if (current === 'slot') { /* let the reels finish */ }
          else if (current !== 'menu') UI.action('menu');
        }
      });

      UI.refresh();
    },

    action: function (name, btn) {
      MGS.Audio.unlock();
      switch (name) {
        case 'drive':
          MGS.Audio.click();
          UI.show(null);
          if (hooks.onDrive) hooks.onDrive();
          break;
        case 'menu':
          MGS.Audio.click();
          if (hooks.onQuit) hooks.onQuit();
          UI.show('menu');
          break;
        case 'garage':
          MGS.Audio.click();
          UI.buildGarage();
          UI.show('garage');
          break;
        case 'howto':
          MGS.Audio.click();
          UI.show('howto');
          break;
        case 'pause':
          if (hooks.onPause) hooks.onPause();
          UI.show('pause');
          break;
        case 'resume':
          MGS.Audio.click();
          UI.show(null);
          if (hooks.onResume) hooks.onResume();
          break;
        case 'mute':
          UI.setMuted(MGS.Audio.toggleMute());
          break;
        case 'spin':
          UI.doSpin();
          break;
        case 'slot-collect':
          MGS.Audio.click();
          UI.buildGarage();
          UI.show('garage');
          break;
        case 'select':
          MGS.Economy.select(btn.getAttribute('data-car'));
          MGS.Audio.click();
          UI.buildGarage();
          UI.refresh();
          break;
        case 'buy':
          if (MGS.Economy.buy(btn.getAttribute('data-car'))) {
            MGS.Audio.unlockJingle();
            UI.buildGarage();
            UI.refresh();
          }
          break;
      }
    },

    setMuted: function (muted) {
      MGS.Economy.setMuted(muted);
      $$('[data-action="mute"]').forEach(function (el) {
        el.textContent = 'SOUND: ' + (muted ? 'OFF' : 'ON');
      });
    },

    show: function (name) {
      current = name;
      Object.keys(screens).forEach(function (k) {
        screens[k].classList.toggle('hidden', k !== name);
      });
      if (name) {
        UI.refresh();
        MGS.Input.releaseAll();
      }
    },

    isOpen: function () { return current !== null; },
    currentScreen: function () { return current; },

    refresh: function () {
      var owned = MGS.Economy.profile().owned.length;
      setText('cash', MGS.Economy.cash());
      setText('best', MGS.Economy.best());
      setText('owned', owned + ' / ' + MGS.VEHICLES.length);
    },

    /* --- garage ------------------------------------------------------------ */

    buildGarage: function () {
      var grid = $('[data-bind="garage-grid"]');
      var selected = MGS.Economy.profile().selected;
      var MAX = MGS.STAT_MAX;
      grid.innerHTML = '';

      MGS.VEHICLES.forEach(function (v) {
        var owns = MGS.Economy.owns(v.id);
        var price = MGS.Economy.price(v);

        var card = document.createElement('div');
        card.className = 'car-card ' + (owns ? '' : 'locked ') + (selected === v.id ? 'selected' : '');
        card.title = v.note || '';

        card.appendChild(MGS.Renderer.carSprite(v, 120, 56));

        var body = document.createElement('div');
        body.innerHTML =
          '<div class="car-name">' + v.name + '</div>' +
          '<div class="car-rarity ' + rarityClass(v.rarity) + '">' + v.rarity + '</div>' +
          '<div class="car-power">' + (v.power || '') + '</div>' +
          '<div class="car-bars">' +
            statBar('SPD', v.topSpeed, MAX.topSpeed) +
            statBar('ACC', v.accel, MAX.accel) +
            statBar('GRIP', v.grip, MAX.grip) +
            statBar('HULL', v.hp, MAX.hp) +
          '</div>';
        card.appendChild(body);

        var btn = document.createElement('button');
        btn.className = 'btn car-action';
        if (owns) {
          if (selected === v.id) {
            btn.classList.add('equipped');
            btn.textContent = 'EQUIPPED';
            btn.disabled = true;
          } else {
            btn.textContent = 'DRIVE THIS';
            btn.setAttribute('data-action', 'select');
            btn.setAttribute('data-car', v.id);
          }
        } else if (price != null) {
          btn.classList.add('buy');
          btn.textContent = '$' + price;
          btn.setAttribute('data-action', 'buy');
          btn.setAttribute('data-car', v.id);
          btn.disabled = MGS.Economy.cash() < price;
        } else {
          btn.classList.add('mission');
          btn.textContent = MGS.Economy.missionLabel(v);
          btn.disabled = true;
        }
        card.appendChild(btn);
        grid.appendChild(card);
      });

      var spinBtn = $('[data-action="spin"]');
      if (spinBtn) {
        spinBtn.disabled = !MGS.Economy.canSpin();
        spinBtn.textContent = 'MYSTERY CRATE — ' + MGS.Economy.SPIN_COST + ' CASH';
      }
    },

    doSpin: function () {
      if (!MGS.Economy.canSpin()) {
        setText('spin-msg', MGS.Economy.spinPool().length
          ? 'Not enough cash — go drive.'
          : 'Every buyable car is already yours.');
        return;
      }
      var won = MGS.Economy.spin();
      if (!won) return;
      setText('spin-msg', '');
      UI.refresh();
      UI.runSlot(won);
    },

    /* The crate result is already decided by Economy.spin(); the reels are pure
       theatre that land on the rarity we know we won. */
    runSlot: function (won) {
      var RARITIES = [
        { id: 'common', label: 'COMMON', color: '#9fb0c2', icon: '■' },
        { id: 'rare', label: 'RARE', color: '#4fa8f5', icon: '◆' },
        { id: 'epic', label: 'EPIC', color: '#b978f0', icon: '✦' },
        { id: 'legendary', label: 'LEGENDARY', color: '#ffc531', icon: '★' }
      ];
      var CELL = 92;
      var REPEATS = 16;
      var targetIndex = 0;
      RARITIES.forEach(function (r, i) { if (r.id === won.rarity) targetIndex = i; });

      var reveal = $('[data-bind="slot-reveal"]');
      reveal.className = 'slot-reveal';
      reveal.innerHTML = '';

      var collect = $('[data-action="slot-collect"]');
      collect.disabled = true;
      collect.textContent = 'SPINNING…';

      var strips = $$('.reel-strip');
      var cells = '';
      for (var r = 0; r < REPEATS; r++) {
        for (var i = 0; i < RARITIES.length; i++) {
          cells += '<div class="reel-cell" style="color:' + RARITIES[i].color + '">' +
            '<b>' + RARITIES[i].icon + '</b>' + RARITIES[i].label + '</div>';
        }
      }
      strips.forEach(function (strip) {
        strip.innerHTML = cells;
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(0px)';
      });

      UI.show('slot');
      MGS.Audio.click();

      var lastDur = 0;
      // Start on the next frame, otherwise the browser skips the transition.
      requestAnimationFrame(function () {
        strips.forEach(function (strip, n) {
          var dur = 1.5 + n * 0.55;
          lastDur = Math.max(lastDur, dur);
          var landing = (REPEATS - 4 + n) * RARITIES.length + targetIndex;
          strip.style.transition = 'transform ' + dur + 's cubic-bezier(.12,.72,.15,1)';
          strip.style.transform = 'translateY(-' + (landing * CELL) + 'px)';
          window.setTimeout(function () { MGS.Audio.heat(); }, dur * 1000);
        });

        window.setTimeout(function () {
          reveal.appendChild(MGS.Renderer.carSprite(won, 150, 62));

          var name = document.createElement('div');
          name.className = 'won-name ' + rarityClass(won.rarity);
          name.textContent = won.name;
          reveal.appendChild(name);

          var power = document.createElement('div');
          power.className = 'won-power';
          power.textContent = won.power || '';
          reveal.appendChild(power);

          reveal.classList.add('shown');
          collect.disabled = false;
          collect.textContent = 'COLLECT';
          MGS.Audio.unlockJingle();
        }, lastDur * 1000 + 350);
      });
    },

    /* --- results ------------------------------------------------------------ */

    showResults: function (run, unlocked) {
      setText('verdict', run.verdict);
      setText('r-score', Math.floor(run.score));
      setText('r-best', MGS.Economy.best());
      setText('r-cash', run.cash);
      setText('r-heat', run.maxHeat);
      setText('r-obj', run.objectives || 0);
      setText('r-unlock', unlocked.length
        ? 'NEW CAR UNLOCKED: ' + unlocked.map(function (v) { return v.name; }).join(', ')
        : '');
      if (unlocked.length) MGS.Audio.unlockJingle();
      UI.show('results');
    }
  };

  MGS.UI = UI;
})(window.MGS);

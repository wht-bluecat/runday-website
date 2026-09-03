/* ============================================================================
   RUNDAY - motion engine v4
   Everything here degrades to a static, fully readable page: no JS, no problem.
   Every effect is skipped wholesale under prefers-reduced-motion.
   ========================================================================== */

(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE    = window.matchMedia('(pointer: fine)').matches;

  /* ------------------------------------------------------------ 1. REVEALS */
  /* One shared observer drives .rise, .draw, .wipe and .proc-step. */

  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      revealObserver.unobserve(e.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });

  function watch(sel) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (el, i) {
      if (REDUCED) { el.classList.add('is-in'); return; }
      if (!el.style.getPropertyValue('--d')) {
        // Stagger siblings inside the same parent, capped so nothing lags.
        var sibs = el.parentElement ? el.parentElement.children : null;
        var idx = 0;
        if (sibs) { for (var k = 0; k < sibs.length; k++) { if (sibs[k] === el) { idx = k; break; } } }
        el.style.setProperty('--d', Math.min(idx, 6) * 0.075 + 's');
      }
      revealObserver.observe(el);
    });
  }
  watch('.rise');
  watch('.draw');
  watch('.wipe');
  watch('.proc-step');

  /* --------------------------------------------------- 2. MASKED LINE REVEAL */
  /* Splits a heading into visual LINES (not words) and slides each up behind
     a mask. Lines are measured after fonts load, so wrapping is real. */

  function splitLines(el) {
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return;
    var words = text.split(' ');
    el.textContent = '';

    var probes = words.map(function (w, i) {
      var s = document.createElement('span');
      s.textContent = w + (i < words.length - 1 ? ' ' : '');
      s.style.display = 'inline';
      el.appendChild(s);
      return s;
    });

    // Group probes by their vertical offset = one visual line.
    var lines = [];
    var lastTop = null;
    probes.forEach(function (s) {
      var top = s.getBoundingClientRect().top;
      if (lastTop === null || Math.abs(top - lastTop) > 4) {
        lines.push([]);
        lastTop = top;
      }
      lines[lines.length - 1].push(s.textContent);
    });

    el.textContent = '';
    lines.forEach(function (words, i) {
      var mask = document.createElement('span');
      mask.className = 'ln';
      var inner = document.createElement('span');
      inner.className = 'ln-i';
      inner.textContent = words.join('').replace(/\s+$/, '');
      inner.style.setProperty('--d', (i * 0.085).toFixed(3) + 's');
      mask.appendChild(inner);
      el.appendChild(mask);
    });
  }

  function initLineReveals() {
    var targets = Array.prototype.slice.call(document.querySelectorAll('[data-split]'));
    if (!targets.length) return;

    if (REDUCED) { targets.forEach(function (t) { t.classList.add('is-revealed'); }); return; }

    targets.forEach(splitLines);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-revealed');
        io.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });

    targets.forEach(function (t) {
      // The hero heading is above the fold: fire it immediately.
      if (t.hasAttribute('data-split-now')) {
        requestAnimationFrame(function () { t.classList.add('is-revealed'); });
      } else {
        io.observe(t);
      }
    });
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(initLineReveals);
    // Never let a font timeout hide the headings.
    setTimeout(function () {
      document.querySelectorAll('[data-split]').forEach(function (t) { t.classList.add('is-revealed'); });
    }, 2600);
  } else {
    window.addEventListener('load', initLineReveals);
  }

  /* ------------------------------------------------------------ 3. THE NAV */
  /* Hides on scroll down, returns on scroll up, gains a rule once off the top. */

  (function () {
    var nav = document.querySelector('.nav');
    if (!nav) return;
    var bar = nav.querySelector('.nav-progress');
    var ghost = document.querySelector('.hero-ghost');
    var last = window.scrollY;
    var ticking = false;

    function update() {
      var y = window.scrollY;
      nav.classList.toggle('is-scrolled', y > 20);
      if (y > 220 && y > last + 4) nav.classList.add('is-hidden');
      else if (y < last - 4 || y < 220) nav.classList.remove('is-hidden');

      if (bar) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0).toFixed(4) + ')';
      }
      // The ghost letter drifts slower than the page: cheap parallax depth.
      if (ghost && !REDUCED && y < window.innerHeight * 1.6) {
        ghost.style.transform = 'translate3d(0,' + (y * 0.16).toFixed(1) + 'px,0)';
      }

      last = y;
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  })();

  /* Mobile nav */
  (function () {
    var toggle = document.querySelector('.nav-toggle');
    var links = document.querySelector('.nav-links');
    if (!toggle || !links) return;
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  })();

  /* ----------------------------------------------- 4. HERO LIFT + MAGNETICS */
  /* One rAF loop drives the cursor-follow glow and every magnetic button. */

  (function () {
    if (REDUCED || !FINE) return;
    var lift = document.querySelector('.hero-lift');
    var magnets = Array.prototype.slice.call(document.querySelectorAll('[data-magnet]'));
    if (!lift && !magnets.length) return;

    var px = -9999, py = -9999;
    var lx = 0, ly = 0;
    var offs = magnets.map(function () { return { x: 0, y: 0 }; });
    var running = false;

    window.addEventListener('pointermove', function (e) {
      px = e.clientX; py = e.clientY;
      if (!running) { running = true; requestAnimationFrame(loop); }
    }, { passive: true });

    function loop() {
      var settled = true;

      if (lift) {
        var hero = lift.parentElement.getBoundingClientRect();
        var tx = px - hero.left, ty = py - hero.top;
        lx += (tx - lx) * 0.07;
        ly += (ty - ly) * 0.07;
        lift.style.transform = 'translate(' + lx.toFixed(1) + 'px,' + ly.toFixed(1) + 'px) translate(-50%,-50%)';
        if (py > 0 && py < hero.bottom) lift.classList.add('is-on');
        else lift.classList.remove('is-on');
        if (Math.abs(tx - lx) > 0.4 || Math.abs(ty - ly) > 0.4) settled = false;
      }

      magnets.forEach(function (el, i) {
        var r = el.getBoundingClientRect();
        var dx = px - (r.left + r.width / 2);
        var dy = py - (r.top + r.height / 2);
        var dist = Math.sqrt(dx * dx + dy * dy);
        var pull = Math.max(0, 1 - dist / 150);
        var gx = dx * 0.2 * pull, gy = dy * 0.28 * pull;
        offs[i].x += (gx - offs[i].x) * 0.16;
        offs[i].y += (gy - offs[i].y) * 0.16;
        el.style.transform = 'translate(' + offs[i].x.toFixed(2) + 'px,' + offs[i].y.toFixed(2) + 'px)';
        if (Math.abs(gx - offs[i].x) > 0.06 || Math.abs(gy - offs[i].y) > 0.06) settled = false;
      });

      if (!settled) requestAnimationFrame(loop);
      else running = false;
    }
  })();

  /* ------------------------------------------------------------ 5. MARQUEE */
  /* Infinite ticker. Base drift plus a scroll-velocity kick, so the band
     visibly reacts to how fast the page is moving. */

  (function () {
    var track = document.querySelector('.mq-track');
    if (!track || REDUCED) return;

    var group = track.querySelector('.mq-group');
    if (!group) return;

    // Duplicate until the track is at least twice the viewport, so the loop
    // never shows a seam on wide screens.
    var guard = 0;
    while (track.scrollWidth < window.innerWidth * 2 && guard < 8) {
      track.appendChild(group.cloneNode(true));
      guard++;
    }
    var unit = group.getBoundingClientRect().width;
    if (!unit) return;

    var x = 0, base = 0.42, boost = 0, lastY = window.scrollY;
    var visible = false, running = false;

    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      boost += (y - lastY) * 0.06;
      lastY = y;
    }, { passive: true });

    function tick() {
      if (!visible || document.hidden) { running = false; return; }
      boost *= 0.92;
      x -= base + boost;
      if (x <= -unit) x += unit;
      if (x > 0) x -= unit;
      track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      requestAnimationFrame(tick);
    }

    function start() {
      if (running || !visible || document.hidden) return;
      running = true;
      requestAnimationFrame(tick);
    }

    // Only animate while the band is actually on screen. An always-on rAF
    // loop keeps the page from ever going idle, which costs battery and
    // blocks anything waiting on a settled frame.
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      start();
    }, { rootMargin: '120px 0px' }).observe(track.parentElement);

    document.addEventListener('visibilitychange', start);
  })();

  /* --------------------------------------------- 6. HORIZONTAL SCROLL TRACK */
  /* A tall track holds a sticky viewport-height stage; vertical scroll inside
     the track translates the rail sideways. Off below 900px (CSS stacks it). */

  (function () {
    var track = document.querySelector('.hs-track');
    var rail  = document.querySelector('.hs-rail');
    if (!track || !rail) return;

    var fill = document.querySelector('.hs-progress i');
    var mq = window.matchMedia('(min-width: 901px)');
    var distance = 0;

    function measure() {
      if (!mq.matches || REDUCED) {
        track.style.height = '';
        rail.style.transform = '';
        return;
      }
      distance = Math.max(0, rail.scrollWidth - window.innerWidth);
      // Slightly more than the horizontal distance so the last panel rests.
      track.style.height = (window.innerHeight + distance * 1.06) + 'px';
      onScroll();
    }

    var ticking = false;
    function onScroll() {
      if (!mq.matches || REDUCED || !distance) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var r = track.getBoundingClientRect();
        var scrollable = track.offsetHeight - window.innerHeight;
        var p = scrollable > 0 ? Math.min(Math.max(-r.top / scrollable, 0), 1) : 0;
        rail.style.transform = 'translate3d(' + (-p * distance).toFixed(2) + 'px,0,0)';
        if (fill) fill.style.transform = 'scaleX(' + Math.max(0.02, p).toFixed(3) + ')';
        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    if (mq.addEventListener) mq.addEventListener('change', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    window.addEventListener('load', measure);
    measure();
  })();

  /* ----------------------------------------------------------- 7. COUNTERS */
  /* data-count="4516" ticks from zero when the number enters view. */

  (function () {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));
    if (!els.length) return;
    if (REDUCED) {
      els.forEach(function (el) { el.textContent = format(el, +el.getAttribute('data-count')); });
      return;
    }

    function format(el, v) {
      var out = Math.round(v).toLocaleString('en-US');
      return (el.getAttribute('data-prefix') || '') + out + (el.getAttribute('data-suffix') || '');
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        io.unobserve(el);
        var target = +el.getAttribute('data-count');
        var dur = 1150, t0 = null;
        function step(t) {
          if (t0 === null) t0 = t;
          var p = Math.min((t - t0) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = format(el, target * eased);
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });

    // The real number stays in the HTML until the animation actually starts,
    // so a failed observer leaves the true value on screen rather than a zero.
    els.forEach(function (el) { io.observe(el); });
  })();

  /* --------------------------------------------------------------- 8. FAQ */

  (function () {
    document.querySelectorAll('.faq-item').forEach(function (item) {
      var btn = item.querySelector('.faq-q');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  })();

  /* ---------------------------------------------------- 9. WORD ROTATOR */
  /* <span data-rotate='["video","web","operations"]'></span> */

  (function () {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-rotate]'));
    if (!els.length) return;

    els.forEach(function (el) {
      var words;
      try { words = JSON.parse(el.getAttribute('data-rotate')); } catch (err) { return; }
      if (!words || !words.length) return;

      el.textContent = words[0];
      if (REDUCED) return;

      el.style.display = 'inline-block';
      el.style.transition = 'opacity .34s ease, transform .34s cubic-bezier(.22,1,.36,1)';
      var i = 0;
      setInterval(function () {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-8px)';
        setTimeout(function () {
          i = (i + 1) % words.length;
          el.textContent = words[i];
          el.style.transform = 'translateY(8px)';
          requestAnimationFrame(function () {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
          });
        }, 340);
      }, 2600);
    });
  })();

  /* ------------------------------------------------------- 10. CONTACT FORM */

  (function () {
    var form = document.querySelector('.contact-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var original = btn ? btn.textContent : '';
      if (btn) { btn.textContent = 'Sending...'; btn.disabled = true; }

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      }).then(function (res) {
        if (res.ok) {
          form.innerHTML =
            '<div class="form-success">' +
              '<p class="kicker">Received</p>' +
              '<h3 class="serif-h">Got it.</h3>' +
              '<p>We reply within one business day. If you sent something to look at, the sample comes back with that reply.</p>' +
            '</div>';
        } else {
          restore(btn, original);
          showError(form);
        }
      }).catch(function () {
        restore(btn, original);
        showError(form);
      });
    });

    function restore(btn, txt) { if (btn) { btn.textContent = txt; btn.disabled = false; } }

    function showError(form) {
      var existing = form.querySelector('.form-error');
      if (existing) existing.remove();
      var err = document.createElement('div');
      err.className = 'form-error';
      err.setAttribute('role', 'alert');
      err.textContent = 'Something went wrong sending that. Email runday.mnl@gmail.com instead and it will reach us.';
      form.appendChild(err);
    }
  })();

})();

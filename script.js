/* === RUNDAY — Shared Scripts === */

(function () {
  // Scroll-fade animations via IntersectionObserver
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.fade-up').forEach(function (el) {
    observer.observe(el);
  });

  // Hero cursor parallax — subtle multi-layer depth (one shared rAF loop).
  // The same loop also drives the magnetic pull on the primary CTA.
  // Skipped for reduced-motion and touch-only devices.
  (function () {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fine = window.matchMedia('(pointer: fine)').matches;
    var layers = Array.prototype.slice.call(document.querySelectorAll('.hero [data-depth]'));
    var magnet = document.querySelector('.hero .btn-primary');
    if (reduce || !fine || (!layers.length && !magnet)) return;

    var tx = 0, ty = 0, x = 0, y = 0, running = false;
    var px = -9999, py = -9999;          // absolute cursor position (for the magnet)
    var mx = 0, my = 0;                  // current magnet offset

    window.addEventListener('pointermove', function (e) {
      tx = (e.clientX / window.innerWidth - 0.5);
      ty = (e.clientY / window.innerHeight - 0.5);
      px = e.clientX;
      py = e.clientY;
      if (!running) { running = true; requestAnimationFrame(loop); }
    });

    function loop() {
      x += (tx - x) * 0.06;
      y += (ty - y) * 0.06;
      for (var i = 0; i < layers.length; i++) {
        var d = parseFloat(layers[i].getAttribute('data-depth')) || 0;
        layers[i].style.transform =
          'translate3d(' + (x * d * 220).toFixed(2) + 'px,' + (y * d * 220).toFixed(2) + 'px,0)';
      }

      // magnetic CTA: within 130px the button leans toward the cursor
      var settled = true;
      if (magnet) {
        var r = magnet.getBoundingClientRect();
        var dx = px - (r.left + r.width / 2);
        var dy = py - (r.top + r.height / 2);
        var dist = Math.sqrt(dx * dx + dy * dy);
        var pull = Math.max(0, 1 - dist / 130);
        var gx = dx * 0.22 * pull, gy = dy * 0.22 * pull;
        mx += (gx - mx) * 0.16;
        my += (gy - my) * 0.16;
        magnet.style.transform = 'translate(' + mx.toFixed(2) + 'px,' + my.toFixed(2) + 'px)';
        settled = Math.abs(gx - mx) < 0.05 && Math.abs(gy - my) < 0.05;
      }

      if (Math.abs(tx - x) > 0.0005 || Math.abs(ty - y) > 0.0005 || !settled) {
        requestAnimationFrame(loop);
      } else {
        running = false;
      }
    }
  })();

  // Nav over the dark hero — translucent dark at the top, cream once scrolled.
  (function () {
    var nav = document.querySelector('.nav.nav-onhero');
    if (!nav) return;
    function update() {
      nav.classList.toggle('is-scrolled', window.scrollY > 40);
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  })();

  // (Hero demo state machine removed 2026-09-03: it cycled four invented
  //  customer scenarios with fabricated names. Its markup is gone too.)

  // Section headlines — big display-scale word reveal on scroll. Each h2's
  // words get wrapped in masked spans that rise in staggered, and the kicker
  // above it grows its underline (via .is-lit on the header's parent).
  // Skipped entirely under reduced motion: no spans, headings render static.
  (function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var heads = Array.prototype.slice.call(document.querySelectorAll('.section h2'));
    if (!heads.length) return;

    heads.forEach(function (h2) {
      var words = h2.textContent.trim().split(/\s+/);
      h2.textContent = '';
      words.forEach(function (w, i) {
        var mask = document.createElement('span');
        mask.className = 'shw-mask';
        var word = document.createElement('span');
        word.className = 'shw';
        word.style.setProperty('--d', (i * 0.07).toFixed(2) + 's');
        word.textContent = w;
        mask.appendChild(word);
        h2.appendChild(mask);
        if (i < words.length - 1) h2.appendChild(document.createTextNode(' '));
      });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('sh-on');
        if (entry.target.parentElement) entry.target.parentElement.classList.add('is-lit');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.35, rootMargin: '0px 0px -60px 0px' });

    heads.forEach(function (h2) { io.observe(h2); });
  })();

  // Mobile nav — close on link click
  document.querySelectorAll('.nav-links a').forEach(function (link) {
    link.addEventListener('click', function () {
      document.querySelector('.nav-links').classList.remove('open');
    });
  });

  // FAQ — independent toggle accordion. Height is animated purely in CSS
  // (grid-template-rows 0fr→1fr), so this just flips the .is-open class.
  // Each item opens/closes on its own — toggling one never affects the others.
  (function () {
    var items = document.querySelectorAll('.rd-faq__item');
    if (!items.length) return;
    items.forEach(function (item) {
      var btn = item.querySelector('.rd-faq__q');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  })();

  // Automation engine — a scroll-PINNED process graph.
  // Desktop: a tall track holds a sticky, viewport-height stage. The page keeps
  // scrolling but the stage stays frozen; scroll progress through the track drives
  // which stage of the graph is active (it doesn't look like the section scrolls —
  // it just advances). Mobile: no pin; an IntersectionObserver lights up each step
  // as it passes the viewport center.
  (function () {
    var section = document.querySelector('.fe-section');
    if (!section) return;
    var track = section.querySelector('.fe-pin-track');
    var steps = Array.prototype.slice.call(section.querySelectorAll('.fe-step'));
    var diagrams = Array.prototype.slice.call(section.querySelectorAll('.fe-diagram'));
    var railFill = section.querySelector('.fe-rail-fill');
    var counter = section.querySelector('.fe-counter');
    var nameEl = section.querySelector('.fe-panel-name');
    var progress = section.querySelector('.fe-progress-fill');
    if (!steps.length) return;

    var total = steps.length;
    var current = -1;
    // Panel header label per stage (n8n / SaaS flavour).
    var titles = ['inbound_pipeline', 'classify_route', 'execute_actions', 'observe_resolve'];
    var mq = window.matchMedia('(min-width: 921px)');

    function pad(n) { return ('0' + n).slice(-2); }

    function setActive(idx, frac) {
      if (idx !== current) {
        current = idx;
        for (var i = 0; i < steps.length; i++) {
          steps[i].classList.toggle('is-active', i === idx);
          steps[i].classList.toggle('is-past', i < idx);
        }
        for (var j = 0; j < diagrams.length; j++) {
          diagrams[j].classList.toggle('is-active', j === idx);
        }
        if (counter) counter.textContent = 'Step ' + pad(idx + 1) + ' / ' + pad(total);
        if (nameEl && titles[idx]) nameEl.textContent = titles[idx];
      }
      // Continuous fill: prefer the scroll fraction, fall back to whole steps.
      var p = (typeof frac === 'number') ? frac : (idx + 1) / total;
      if (progress) progress.style.transform = 'scaleX(' + Math.max(0.04, p) + ')';
      if (railFill) railFill.style.height = (p * 100) + '%';
    }

    // Desktop pin: map scroll position within the track to a stage index.
    // A small lead-in/out buffer holds stage 1 as the section locks and keeps
    // stage 4 on screen before the panel unpins, so it never cuts mid-transition.
    var LEAD = 0.06, TAIL = 0.10;
    function onScroll() {
      if (!mq.matches || !track) return;
      var scrollable = track.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return;
      var raw = Math.min(Math.max(-track.getBoundingClientRect().top, 0), scrollable) / scrollable;
      var p = (raw - LEAD) / (1 - LEAD - TAIL); // remap so stages span the middle
      p = Math.min(1, Math.max(0, p));
      var idx = Math.min(total - 1, Math.floor(p * total));
      setActive(idx, raw);
    }

    // Mobile fallback: light up the step crossing the viewport center.
    var io = new IntersectionObserver(function (entries) {
      if (mq.matches) return;
      entries.forEach(function (e) {
        if (e.isIntersecting) setActive(parseInt(e.target.getAttribute('data-index'), 10) || 0);
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    steps.forEach(function (s) { io.observe(s); });

    function init() {
      current = -1;
      if (mq.matches) onScroll();
      else setActive(0);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', init);
    if (mq.addEventListener) mq.addEventListener('change', init);
    else if (mq.addListener) mq.addListener(init);

    init();
  })();

  // Contact form — success/error handling
  var form = document.querySelector('.contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var original = btn.textContent;
      btn.textContent = 'Sending...';
      btn.disabled = true;

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      }).then(function (res) {
        if (res.ok) {
          form.innerHTML =
            '<div class="form-success">' +
              '<div class="form-success-icon">&#10003;</div>' +
              '<h3>Got it.</h3>' +
              '<p>We reply within one business day. If you sent an episode link, the Short comes back with that reply.</p>' +
            '</div>';
        } else {
          btn.textContent = original;
          btn.disabled = false;
          showFormError(form);
        }
      }).catch(function () {
        btn.textContent = original;
        btn.disabled = false;
        showFormError(form);
      });
    });
  }

  function showFormError(form) {
    var existing = form.querySelector('.form-error');
    if (existing) existing.remove();
    var err = document.createElement('div');
    err.className = 'form-error';
    err.setAttribute('role', 'alert');
    err.textContent = 'Something went wrong sending that. Email runday.mnl@gmail.com instead and it will reach us.';
    form.appendChild(err);
  }
})();

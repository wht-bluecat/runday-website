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

  // Hero demo card — the "back office in action" loop. A tiny state machine
  // cycles four scenarios: inbound arrives → AI thinks → reply types itself
  // out → outcome chip flips in → hold → next. Reduced-motion renders the
  // first scenario fully composed and stops.
  (function () {
    var demo = document.querySelector('.rd-demo');
    if (!demo) return;

    var tabs = Array.prototype.slice.call(demo.querySelectorAll('.rd-tab'));
    var bubbleIn = demo.querySelector('.rd-bubble-in');
    var bubbleAi = demo.querySelector('.rd-bubble-ai');
    var inName = bubbleIn.querySelector('.rd-b-name');
    var inText = bubbleIn.querySelector('.rd-b-text');
    var aiText = bubbleAi.querySelector('.rd-b-text');
    var typing = bubbleAi.querySelector('.rd-typing');
    var status = demo.querySelector('.rd-status');
    var statusText = demo.querySelector('.rd-status-text');
    if (!bubbleIn || !bubbleAi || !status) return;

    var scenes = [
      {
        tab: 0,
        name: 'New message · Instagram',
        inbound: 'Hi! Do you have a slot this Saturday for a family shoot?',
        reply: 'Hi Bea! Yes, Saturday 2 PM is open. I can hold it for you. Just send your name and number to confirm.',
        status: 'Booked · Sat 2:00 PM'
      },
      {
        tab: 1,
        name: 'New review · Google',
        inbound: '5 stars. The photos came out beautiful and the team was so accommodating!',
        reply: 'Thank you so much, Carla! We loved having you. See you at your next shoot.',
        status: 'Review answered'
      },
      {
        tab: 2,
        name: 'Quiet lead · 3 days',
        inbound: 'Miguel asked about pricing on Tuesday, then went quiet.',
        reply: 'Hi Miguel! Just checking in. Next week is filling up fast. Want me to hold a slot for you?',
        status: 'Follow-up sent'
      },
      {
        tab: 3,
        name: 'Content calendar · Monday',
        inbound: 'Promo post due today, 9:00 AM.',
        reply: 'Rainy week ahead. Perfect for a cozy indoor session. Book this week and get a free print.',
        status: 'Post scheduled'
      }
    ];

    function compose(scene) {
      tabs.forEach(function (t, i) { t.classList.toggle('is-active', i === scene.tab); });
      inName.textContent = scene.name;
      inText.textContent = scene.inbound;
      aiText.textContent = scene.reply;
      statusText.textContent = scene.status;
      bubbleIn.classList.add('is-shown');
      bubbleAi.classList.add('is-shown');
      status.classList.add('is-shown');
    }

    // Reduced motion: static finished state of scenario 1, no loop.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      compose(scenes[0]);
      return;
    }

    var idx = 0;
    var timers = [];
    var typeRaf = 0;
    function after(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() {
      while (timers.length) clearTimeout(timers.pop());
      if (typeRaf) { cancelAnimationFrame(typeRaf); typeRaf = 0; }
    }

    // Steady rAF-driven reveal (per-char setTimeout jitter read as choppy).
    // Constant chars-per-ms with a duration cap so long replies never stall
    // the loop; always resolves before the outcome chip is scheduled.
    function typeOut(str, done) {
      bubbleAi.classList.add('is-typing');
      var dur = Math.min(2400, 300 + str.length * 20);
      var start = 0;
      var shown = -1;
      function frame(ts) {
        if (!start) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        var n = Math.round(p * str.length);
        if (n !== shown) {
          shown = n;
          aiText.textContent = str.slice(0, n);
        }
        if (p < 1) {
          typeRaf = requestAnimationFrame(frame);
        } else {
          typeRaf = 0;
          bubbleAi.classList.remove('is-typing');
          done();
        }
      }
      typeRaf = requestAnimationFrame(frame);
    }

    function play() {
      // Fresh cycle: drop every pending timer so scenes can never overlap
      // (overlapping chains were the source of the mid-loop glitches).
      clearTimers();

      // Background tabs throttle timers and fire them in a burst on return,
      // which shredded the choreography. Park the loop instead; the
      // visibilitychange handler below restarts it cleanly.
      if (document.hidden) return;

      var scene = scenes[idx];

      // fade the previous scene out
      bubbleIn.classList.remove('is-shown');
      bubbleAi.classList.remove('is-shown');
      status.classList.remove('is-shown');
      bubbleAi.classList.remove('is-typing');
      typing.classList.remove('is-shown');

      // 520ms > the 450ms fade, so text only changes once fully hidden
      // (swapping it mid-fade is what looked like a "cut")
      after(520, function () {
        tabs.forEach(function (t, i) { t.classList.toggle('is-active', i === scene.tab); });
        inName.textContent = scene.name;
        inText.textContent = scene.inbound;
        aiText.textContent = '';
        statusText.textContent = scene.status;
        bubbleIn.classList.add('is-shown');
      });

      after(1400, function () {
        bubbleAi.classList.add('is-shown');
        typing.classList.add('is-shown');
      });

      after(2350, function () {
        typing.classList.remove('is-shown');
        typeOut(scene.reply, function () {
          after(350, function () { status.classList.add('is-shown'); });
          after(3200, function () {
            idx = (idx + 1) % scenes.length;
            play();
          });
        });
      });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        clearTimers();
        bubbleAi.classList.remove('is-typing');
        typing.classList.remove('is-shown');
      } else {
        play();
      }
    });

    // let the headline land first, then start the show
    after(1400, play);
  })();

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

  // Floating chat buttons
  var fab = document.createElement('div');
  fab.className = 'fab-chat';
  fab.innerHTML =
    '<a href="https://wa.me/639275492649" target="_blank" rel="noopener" class="fab-btn fab-wa" aria-label="Chat on WhatsApp">' +
      '<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zm-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
    '</a>' +
    '<a href="https://m.me/61590141402371" target="_blank" rel="noopener" class="fab-btn fab-msg" aria-label="Chat on Messenger">' +
      '<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.974 12-11.111C24 4.975 18.627 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.733 8.2l3.13 3.259L19.752 8.2l-6.559 6.763z"/></svg>' +
    '</a>';
  document.body.appendChild(fab);

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
              '<h3>Message sent!</h3>' +
              '<p>We\'ll get back to you within 24 hours. If it\'s urgent, message us on WhatsApp.</p>' +
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
    err.textContent = 'Something went wrong. Try messaging us on WhatsApp instead.';
    form.appendChild(err);
  }
})();

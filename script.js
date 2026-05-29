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

  // Mobile nav — close on link click
  document.querySelectorAll('.nav-links a').forEach(function (link) {
    link.addEventListener('click', function () {
      document.querySelector('.nav-links').classList.remove('open');
    });
  });

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

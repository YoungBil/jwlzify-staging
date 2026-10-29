/* ════════════════════════════════════════════════════
   JWLZIFY v2 — shared behaviour for every v2 page:
   nav veil, mobile menu, account UI, inner-page
   reveals, accordions, page-to-page fade, contact
   form (EmailJS disabled on staging).
════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var motionOK = !reduceMotion && docEl.classList.contains('motion-on');

  window.__jwlzV2Booted = true;

  // ── Page fade in ──
  if (motionOK) {
    requestAnimationFrame(function () { document.body.classList.add('page-in'); });
  } else {
    docEl.classList.remove('motion-on');
    document.body.classList.add('page-in');
  }

  // ── Nav veil on scroll (homepage; harmless on inner pages) ──
  (function () {
    var nav = document.getElementById('v2nav');
    if (!nav) return;
    var ticking = false;
    function update() {
      ticking = false;
      nav.classList.toggle('scrolled', (window.scrollY || 0) > 40);
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  })();

  // ── Mobile menu ──
  (function () {
    var menu = document.getElementById('v2menu');
    var openBtn = document.getElementById('menuOpen');
    var closeBtn = document.getElementById('menuClose');
    if (!menu || !openBtn) return;
    function setOpen(open) {
      menu.classList.toggle('open', open);
      openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
      if (open && closeBtn) closeBtn.focus();
      if (!open) openBtn.focus();
    }
    openBtn.addEventListener('click', function () { setOpen(true); });
    if (closeBtn) closeBtn.addEventListener('click', function () { setOpen(false); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) setOpen(false);
    });
  })();

  // ── Account UI (fed by the site's existing Firebase sign-in) ──
  var _signedIn = false;
  window.__jwlzV2AuthUI = function (user) {
    _signedIn = !!user;
    var icon = document.getElementById('accountIcon');
    var label = document.getElementById('accountLabel');
    var initial = document.getElementById('accountInitial');
    var btn = document.getElementById('accountBtn');
    var menuLabel = document.getElementById('menuAccountLabel');
    var name = user ? (user.displayName || user.email || 'Account') : '';
    var letter = name ? name.trim().charAt(0).toUpperCase() : '';
    if (user) {
      if (icon) icon.style.display = 'none';
      if (label) label.style.display = 'none';
      if (initial) { initial.style.display = 'inline-flex'; initial.textContent = letter; }
      if (btn) btn.title = 'Signed in as ' + name;
      if (menuLabel) menuLabel.textContent = 'Signed in as ' + name;
    } else {
      if (icon) icon.style.display = '';
      if (label) { label.style.display = ''; label.textContent = 'Sign in'; }
      if (initial) initial.style.display = 'none';
      if (btn) btn.title = 'Sign in';
      if (menuLabel) menuLabel.textContent = 'Sign in';
    }
  };
  window.__jwlzV2AccountClick = function () {
    if (!_signedIn && typeof window.signInWithGoogle === 'function') window.signInWithGoogle();
  };

  // ── Inner-page reveals (IntersectionObserver + CSS) ──
  (function () {
    var items = document.querySelectorAll('.rv');
    if (!items.length) return;
    if (!motionOK || typeof IntersectionObserver === 'undefined') {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  })();

  // ── Accordions ──
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('.acc-trigger');
    if (!trigger) return;
    var acc = trigger.closest('.acc');
    var open = acc.classList.toggle('open');
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // ── Page-to-page fade ──
  (function () {
    if (!motionOK) return;
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest('a[href]');
      if (!a || a.target || a.hasAttribute('download')) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(https?:|mailto:|tel:)/i.test(href)) return;
      e.preventDefault();
      document.body.classList.add('page-out');
      setTimeout(function () { window.location.href = href; }, 220);
    });
    // restore when returning via bfcache
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) {
        document.body.classList.remove('page-out');
        document.body.classList.add('page-in');
      }
    });
  })();

  // ── firebase-auth.js injects a sign-in modal whose legal link targets the
  //    root page; from /v2/ that path doesn't exist — retarget to v2 terms. ──
  (function () {
    function fix() {
      var a = document.querySelector('#signInModal a[href="legal.html"]');
      if (a) { a.setAttribute('href', 'terms.html'); return true; }
      return false;
    }
    var n = 0;
    var t = setInterval(function () { if (fix() || ++n > 20) clearInterval(t); }, 300);
  })();

  // ── Contact form (staging: EmailJS disabled — nothing is sent) ──
  (function () {
    var form = document.getElementById('contactForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var emailEl = document.getElementById('contactEmail');
      var msgEl = document.getElementById('contactMessage');
      var feedback = document.getElementById('contactMsg');
      var email = (emailEl.value || '').trim();
      var message = (msgEl.value || '').trim();
      function show(text, bad) {
        feedback.textContent = text;
        feedback.style.display = 'block';
        feedback.style.background = bad ? 'rgba(60,100,116,0.06)' : 'rgba(185,226,245,0.25)';
        feedback.style.border = '1px solid rgba(60,100,116,0.3)';
        feedback.style.color = '#3c6474';
      }
      if (!email || !message) { show('Please fill in both fields before sending.', true); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { show('Please enter a valid email address.', true); return; }
      show('Staging environment — message not sent.', false);
    });
  })();
})();

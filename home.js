/* ════════════════════════════════════════════════════
   JWLZIFY — Homepage motion (GSAP + ScrollTrigger +
   SplitText + Lenis). One universal implementation;
   honours prefers-reduced-motion by skipping all
   animation and showing final states.
════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var header = document.getElementById('siteHeader');

  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var hasGsap = typeof window.gsap !== 'undefined';
  var hasST = hasGsap && typeof window.ScrollTrigger !== 'undefined';
  var motionOK = hasGsap && hasST && !reduceMotion;

  // Tells the pre-paint boot script in <head> it can stop worrying.
  window.__jwlzBooted = true;

  // ── Nav: solid after scroll, hide on scroll down, return on scroll up ──
  (function initNav() {
    if (!header) return;
    var lastY = window.scrollY || 0;
    var ticking = false;
    function update() {
      ticking = false;
      var y = window.scrollY || 0;
      header.classList.toggle('nav-solid', y > 40);
      if (y > lastY + 8 && y > 200) header.classList.add('nav-hidden');
      else if (y < lastY - 4 || y <= 200) header.classList.remove('nav-hidden');
      lastY = y;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    // keyboard users must always be able to reach the nav
    header.addEventListener('focusin', function () { header.classList.remove('nav-hidden'); });
    update();
  })();

  if (!motionOK) {
    docEl.classList.remove('motion-on', 'intro-pending');
    var introEl = document.getElementById('intro');
    if (introEl) introEl.remove();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  var hasSplit = typeof window.SplitText !== 'undefined';
  if (hasSplit) gsap.registerPlugin(SplitText);

  // ── Lenis smooth scroll ──
  if (typeof window.Lenis !== 'undefined') {
    var lenis = new Lenis({ lerp: 0.08, duration: 1.4 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // ── Intro overlay (once per session, never blocks > ~1.5s) ──
  var heroDelay = 0.15;
  (function intro() {
    var el = document.getElementById('intro');
    if (!el) return;
    if (!docEl.classList.contains('intro-pending')) { el.remove(); return; }
    try { sessionStorage.setItem('jwlzIntroSeen', '1'); } catch (e) {}
    heroDelay = 0.9;
    gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: function () { el.remove(); docEl.classList.remove('intro-pending'); }
    })
      .fromTo('.intro-mark', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7 }, 0.05)
      .fromTo('.intro-line span', { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'expo.out' }, 0.25)
      .to(el, { opacity: 0, duration: 0.45, ease: 'power2.inOut' }, 0.95);
  })();

  // ── Hero: masked line reveal, then tagline + CTA; video scale-in + parallax ──
  (function hero() {
    var title = document.getElementById('heroTitle');

    function runTitle() {
      var tl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: heroDelay });
      var played = false;
      if (hasSplit && title) {
        try {
          var split = SplitText.create(title, { type: 'lines', mask: 'lines' });
          gsap.set(title, { opacity: 1 });
          tl.from(split.lines, { yPercent: 115, duration: 1.2, stagger: 0.12 }, 0);
          played = true;
        } catch (e) { /* fall back below */ }
      }
      if (!played && title) tl.fromTo(title, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 1.2 }, 0);
      tl.to('.hero-tagline', { opacity: 1, y: 0, duration: 1.1 }, 0.4)
        .to('.hero-cta', { opacity: 1, y: 0, duration: 1.1 }, 0.55);
    }

    // wait for webfonts so SplitText measures real lines — but never longer than 900ms
    var started = false;
    function go() { if (!started) { started = true; runTitle(); } }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
    setTimeout(go, 900);

    gsap.fromTo('#heroVideo', { scale: 1.08 }, { scale: 1, duration: 1.4, ease: 'power2.out', delay: heroDelay });
    gsap.to('#heroVideo', {
      yPercent: 12, ease: 'none',
      scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true }
    });
  })();

  // ── Category marquee: slow continuous drift, eases to a stop on hover ──
  (function marquee() {
    var wrap = document.getElementById('marquee');
    var track = document.getElementById('marqueeTrack');
    if (!wrap || !track) return;
    var drift = gsap.to(track, { xPercent: -50, duration: 48, ease: 'none', repeat: -1 });
    wrap.addEventListener('pointerenter', function () { gsap.to(drift, { timeScale: 0, duration: 0.6, overwrite: true }); });
    wrap.addEventListener('pointerleave', function () { gsap.to(drift, { timeScale: 1, duration: 0.8, overwrite: true }); });
    ScrollTrigger.create({
      trigger: wrap, start: 'top bottom', end: 'bottom top',
      onToggle: function (self) { self.isActive ? drift.play() : drift.pause(); }
    });
  })();

  // ── Section reveals: fade-up with gentle stagger per group ──
  gsap.utils.toArray('[data-rvg]').forEach(function (group) {
    var items = group.querySelectorAll('.rv');
    if (!items.length) return;
    gsap.to(items, {
      opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.09,
      scrollTrigger: { trigger: group, start: 'top 82%', once: true }
    });
  });

  // ── Hairline dividers draw across ──
  gsap.utils.toArray('.hairline-divider span').forEach(function (line) {
    gsap.to(line, {
      scaleX: 1, duration: 1.3, ease: 'expo.out',
      scrollTrigger: { trigger: line, start: 'top 88%', once: true }
    });
  });

  // ── Gallery: clip-path wipe reveal on scroll ──
  gsap.utils.toArray('.gal-frame').forEach(function (frame) {
    gsap.to(frame, {
      clipPath: 'inset(0% 0% 0% 0%)', duration: 1.25, ease: 'expo.out',
      scrollTrigger: { trigger: frame, start: 'top 85%', once: true }
    });
  });

  // ── Brand line: reveal, then a one-time shine sweep ──
  (function brand() {
    var line = document.querySelector('.brand-line');
    if (!line) return;
    var shine = line.querySelector('.brand-shine');
    var tl = gsap.timeline({
      scrollTrigger: { trigger: line, start: 'top 80%', once: true },
      defaults: { ease: 'power3.out' }
    });
    tl.to(line, { opacity: 1, y: 0, duration: 1.1 }, 0);
    if (shine) {
      tl.fromTo(shine,
        { clipPath: 'polygon(-30% 0%, -16% 0%, -26% 100%, -40% 100%)' },
        { clipPath: 'polygon(116% 0%, 130% 0%, 120% 100%, 106% 100%)', duration: 1.4, ease: 'power2.inOut' },
        0.55);
    }
  })();

  // ── Journey: pinned section, steps activate in sequence ──
  (function journey() {
    var section = document.getElementById('journey');
    if (!section) return;
    var steps = gsap.utils.toArray('#journey .j-step');
    var fills = gsap.utils.toArray('#journey .j-fill');
    if (!steps.length) return;
    gsap.set(fills, { transformOrigin: '0 0' });
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: section, start: 'top top', end: '+=1800',
        pin: true, scrub: 0.5, anticipatePin: 1
      },
      defaults: { ease: 'none' }
    });
    steps.forEach(function (step, i) {
      var ring = step.querySelector('.j-ring');
      tl.to(step, { opacity: 1, duration: 0.4 }, i);
      if (ring) tl.to(ring, { opacity: 1, duration: 0.3 }, i + 0.05);
      if (fills[i]) tl.to(fills[i], { scale: 1, duration: 0.5 }, i + 0.42);
    });
    tl.to({}, { duration: 0.35 }); // settle beat before unpinning
  })();

  // ── Magnetic pull on primary buttons (mouse only; tap untouched) ──
  (function magnetic() {
    var MAX = 6;
    document.querySelectorAll('.magnet').forEach(function (wrap) {
      var xTo = gsap.quickTo(wrap, 'x', { duration: 0.5, ease: 'power3.out' });
      var yTo = gsap.quickTo(wrap, 'y', { duration: 0.5, ease: 'power3.out' });
      wrap.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = wrap.getBoundingClientRect();
        var dx = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * MAX;
        var dy = ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * MAX;
        xTo(Math.max(-MAX, Math.min(MAX, dx)));
        yTo(Math.max(-MAX, Math.min(MAX, dy)));
      });
      wrap.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });
  })();

  // ── Footer fade ──
  gsap.fromTo('footer .shell', { opacity: 0 }, {
    opacity: 1, duration: 1, ease: 'power2.out',
    scrollTrigger: { trigger: 'footer', start: 'top 92%', once: true }
  });

  // images settle layout late; keep trigger positions honest
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();

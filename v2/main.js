/* ════════════════════════════════════════════════════
   JWLZIFY v2 — homepage motion.
   Hero (video + intro) is ported from the v1 staging
   homepage; the immersive scenes continue below it.
   GSAP + ScrollTrigger + SplitText + Lenis (CDN).
════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var hasGsap = typeof window.gsap !== 'undefined';
  var hasST = hasGsap && typeof window.ScrollTrigger !== 'undefined';
  var motionOK = hasGsap && hasST && !reduceMotion;

  window.__jwlzV2Booted = true;

  if (!motionOK) {
    docEl.classList.remove('motion-on', 'intro-pending');
    var introEl = document.getElementById('intro');
    if (introEl) introEl.remove();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  var hasSplit = typeof window.SplitText !== 'undefined';
  if (hasSplit) gsap.registerPlugin(SplitText);

  if (typeof window.Lenis !== 'undefined') {
    var lenis = new Lenis({ lerp: 0.08, duration: 1.4 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // ── Intro overlay (once per session — ported from v1) ──
  var heroDelay = 0.15;
  (function intro() {
    var el = document.getElementById('intro');
    if (!el) return;
    if (!docEl.classList.contains('intro-pending')) { el.remove(); return; }
    try { sessionStorage.setItem('jwlzV2IntroSeen', '1'); } catch (e) {}
    heroDelay = 0.9;
    gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: function () { el.remove(); docEl.classList.remove('intro-pending'); }
    })
      .fromTo('.intro-mark', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7 }, 0.05)
      .fromTo('.intro-line span', { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'expo.out' }, 0.25)
      .to(el, { opacity: 0, duration: 0.45, ease: 'power2.inOut' }, 0.95);
  })();

  // Hero video motion (v1 behaviour: slow scale-in + scroll parallax)
  gsap.fromTo('#heroVideo', { scale: 1.08 }, { scale: 1, duration: 1.4, ease: 'power2.out', delay: heroDelay });
  gsap.to('#heroVideo', {
    yPercent: 12, ease: 'none',
    scrollTrigger: { trigger: '#s-hero', start: 'top top', end: 'bottom top', scrub: true }
  });

  // Everything that splits or measures text waits for webfonts (capped at 900ms)
  var booted = false;
  function initScenes() {
    if (booted) return;
    booted = true;
    hero();
    imagine();
    styleScene();
    materials();
    categories();
    closeScene();
    ScrollTrigger.refresh();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(initScenes);
  setTimeout(initScenes, 900);

  // ── Scene 1 · Hero (v1 masked line reveal) ──
  function hero() {
    var slogan = document.getElementById('slogan');
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: heroDelay });
    var split = false;
    if (hasSplit && slogan) {
      try {
        var sp = SplitText.create(slogan, { type: 'lines', mask: 'lines' });
        gsap.set(slogan, { opacity: 1 });
        tl.from(sp.lines, { yPercent: 115, duration: 1.2, stagger: 0.12 }, 0);
        split = true;
      } catch (e) { /* fallback below */ }
    }
    if (!split && slogan) tl.fromTo(slogan, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 1.2 }, 0);
    tl.to('.hero-cta', { opacity: 1, y: 0, duration: 1.1 }, 0.45)
      .to('.scroll-cue', { opacity: 1, duration: 0.8 }, 1.1);
  }

  // ── Scene 2 · Imagine (pinned: thought → typed line → piece resolves) ──
  function imagine() {
    var typeEl = document.getElementById('typeLine');
    var chars = null;
    if (hasSplit && typeEl) {
      try {
        var sp = SplitText.create(typeEl, { type: 'words,chars' });
        chars = sp.chars;
        gsap.set(typeEl, { opacity: 1 });
        gsap.set(chars, { opacity: 0 });
      } catch (e) { chars = null; }
    }
    var sharp = document.querySelector('#s-imagine .resolve-sharp');
    gsap.set(sharp, { scale: 1.06 });

    var tl = gsap.timeline({
      scrollTrigger: { trigger: '#s-imagine', start: 'top top', end: '+=2300', pin: true, scrub: 0.5, anticipatePin: 1 },
      defaults: { ease: 'none' }
    });
    tl.to('#s-imagine .kicker', { opacity: 1, y: 0, duration: 0.45 }, 0)
      .to('#s-imagine .scene-h', { opacity: 1, y: 0, duration: 0.45 }, 0.15);
    if (chars) tl.to(chars, { opacity: 1, duration: 0.05, stagger: 0.03 }, 0.75);
    else if (typeEl) tl.to(typeEl, { opacity: 1, duration: 0.7 }, 0.75);
    tl.to('#s-imagine .resolve-frame', { opacity: 1, y: 0, duration: 0.65 }, 1.1)
      .to(sharp, { opacity: 1, scale: 1, duration: 1.3 }, 2.0)
      .to('#s-imagine .scene-sub', { opacity: 1, y: 0, duration: 0.55 }, 2.8)
      .to({}, { duration: 0.5 });
  }

  // ── Scene 3 · Style My Design (pinned: tones → on-model shots → evening mood) ──
  function styleScene() {
    var layers = gsap.utils.toArray('#s-style .style-layer');
    if (!layers.length) return;
    var tones = gsap.utils.toArray('#s-style .tone i');
    var moodQ = document.querySelector('#s-style .mood-q');
    var moodE = document.querySelector('#s-style .mood-e');
    var evScrim = document.querySelector('#s-style .style-scrim-ev');

    gsap.set(layers, { autoAlpha: 0 });
    gsap.set(layers[0], { autoAlpha: 1 });

    var seg = 1.1;
    var tl = gsap.timeline({
      scrollTrigger: { trigger: '#s-style', start: 'top top', end: '+=3400', pin: true, scrub: 0.5, anticipatePin: 1 },
      defaults: { ease: 'none' }
    });

    tl.to('#s-style .st-s', { opacity: 1, y: 0, duration: 0.5, stagger: 0.08 }, 0);
    tl.fromTo(layers[0].querySelector('img'), { scale: 1.1 }, { scale: 1.02, duration: seg + 0.6 }, 0);
    if (tones[0]) tl.to(tones[0], { opacity: 1, duration: 0.3 }, 0.3);

    // skin tones crossfade on the same piece (layers 1–2), then neck and ear (On Model)
    for (var i = 1; i < layers.length; i++) {
      var t = i * seg + 0.3;
      tl.to(layers[i], { autoAlpha: 1, duration: 0.55 }, t);
      tl.fromTo(layers[i].querySelector('img'), { scale: 1.08 }, { scale: 1.01, duration: seg + 0.6 }, t);
      tl.to(layers[i - 1], { autoAlpha: 0, duration: 0.55 }, t + 0.5);
      if (i === 1 && tones[1]) { tl.to(tones[0], { opacity: 0, duration: 0.3 }, t); tl.to(tones[1], { opacity: 1, duration: 0.3 }, t); }
      if (i === 2 && tones[2]) { tl.to(tones[1], { opacity: 0, duration: 0.3 }, t); tl.to(tones[2], { opacity: 1, duration: 0.3 }, t); }
      if (i === layers.length - 1) {
        // final shot — evening mood
        if (moodQ) tl.to(moodQ, { opacity: 0, duration: 0.4 }, t);
        if (moodE) tl.to(moodE, { opacity: 1, duration: 0.4 }, t);
        tl.to('#s-style .style-tones', { opacity: 0.25, duration: 0.4 }, t);
        if (evScrim) tl.to(evScrim, { opacity: 1, duration: 0.8 }, t);
      }
    }
    tl.to({}, { duration: 0.6 });
  }

  // ── Scene 4 · Materials (pinned catalogue crossfade) ──
  function materials() {
    var panels = gsap.utils.toArray('#s-materials .mat-panel');
    var fill = document.getElementById('matFill');
    if (!panels.length) return;
    gsap.set(panels, { autoAlpha: 0 });
    gsap.set(fill, { scaleX: 0, transformOrigin: '0 50%' });

    var tl = gsap.timeline({
      scrollTrigger: { trigger: '#s-materials', start: 'top top', end: '+=2600', pin: true, scrub: 0.5, anticipatePin: 1 },
      defaults: { ease: 'none' }
    });
    tl.to('#s-materials .st-m', { opacity: 1, y: 0, duration: 0.4, stagger: 0.08 }, 0);
    panels.forEach(function (p, i) {
      var t = 0.5 + i * 1.4;
      tl.to(p, { autoAlpha: 1, duration: 0.45 }, t);
      tl.fromTo(p.querySelector('.mat-media img'), { scale: 1.08 }, { scale: 1, duration: 1.35 }, t);
      tl.fromTo(p.querySelector('.mat-copy'), { y: 26 }, { y: 0, duration: 0.5 }, t);
      tl.to(fill, { scaleX: (i + 1) / panels.length, duration: 1.3 }, t);
      if (i < panels.length - 1) tl.to(p, { autoAlpha: 0, duration: 0.45 }, t + 0.95);
    });
    tl.to({}, { duration: 0.45 });
  }

  // ── Scene 5 · Categories (pinned full-screen sequence) ──
  function categories() {
    var layers = gsap.utils.toArray('#s-categories .cat-layer');
    var names = gsap.utils.toArray('#s-categories .cat-name');
    var ticks = gsap.utils.toArray('#s-categories .cat-ticks span');
    if (!layers.length) return;
    gsap.set(layers, { autoAlpha: 0 });
    gsap.set(names, { autoAlpha: 0, y: 22 });

    var seg = 1.6;
    var tl = gsap.timeline({
      scrollTrigger: { trigger: '#s-categories', start: 'top top', end: '+=4200', pin: true, scrub: 0.5, anticipatePin: 1 },
      defaults: { ease: 'none' }
    });
    tl.to('#s-categories .kicker', { opacity: 1, duration: 0.4 }, 0)
      .to('#s-categories .link-quiet', { opacity: 1, duration: 0.4 }, 0.1)
      .to('#s-categories .cat-ticks', { opacity: 1, duration: 0.4 }, 0.1);

    layers.forEach(function (layer, i) {
      var t = i * seg + 0.15;
      tl.to(layer, { autoAlpha: 1, duration: 0.5 }, t);
      tl.fromTo(layer.querySelector('img'), { scale: 1.1 }, { scale: 1.02, duration: seg + 0.5 }, t);
      if (names[i]) tl.to(names[i], { autoAlpha: 1, y: 0, duration: 0.45 }, t + 0.1);
      if (ticks[i]) tl.to(ticks[i], { opacity: 1, duration: 0.3 }, t + 0.1);
      if (i < layers.length - 1) {
        tl.to(layer, { autoAlpha: 0, duration: 0.5 }, t + seg - 0.3);
        if (names[i]) tl.to(names[i], { autoAlpha: 0, y: -18, duration: 0.4 }, t + seg - 0.35);
        if (ticks[i]) tl.to(ticks[i], { opacity: 0.3, duration: 0.3 }, t + seg - 0.3);
      }
    });
    tl.to({}, { duration: 0.6 });
  }

  // ── Scene 6 · Close ──
  function closeScene() {
    gsap.timeline({
      scrollTrigger: { trigger: '#s-close', start: 'top 70%', once: true },
      defaults: { ease: 'power3.out' }
    }).to('#s-close .st-c', { opacity: 1, y: 0, duration: 1.2, stagger: 0.14 }, 0);
  }

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();

/* ════════════════════════════════════════════════════
   JWLZIFY — Homepage concept v2 motion
   GSAP + ScrollTrigger + SplitText + Lenis (CDN).
   One universal implementation; prefers-reduced-motion
   gets final states with zero animation.
════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var nav = document.getElementById('nav');

  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var hasGsap = typeof window.gsap !== 'undefined';
  var hasST = hasGsap && typeof window.ScrollTrigger !== 'undefined';
  var motionOK = hasGsap && hasST && !reduceMotion;

  window.__jwlzV2Booted = true;

  // ── Nav veil after scroll (always on — it's usability, not decoration) ──
  (function () {
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

  if (!motionOK) {
    docEl.classList.remove('motion-on');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  var hasSplit = typeof window.SplitText !== 'undefined';
  if (hasSplit) gsap.registerPlugin(SplitText);

  if (typeof window.Lenis !== 'undefined') {
    var lenis = new Lenis({ lerp: 0.08, duration: 1.5 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // Hero media motion can start immediately (no text measurement involved)
  gsap.set('#s-hero .btn-wrap', { y: 26 });
  gsap.fromTo('#heroImg', { scale: 1.12 }, { scale: 1.02, duration: 1.6, ease: 'power2.out' });
  gsap.to('#heroImg', {
    yPercent: 10, ease: 'none',
    scrollTrigger: { trigger: '#s-hero', start: 'top top', end: 'bottom top', scrub: true }
  });

  // Everything that splits or measures text waits for webfonts (capped at 900ms)
  var booted = false;
  function initScenes() {
    if (booted) return;
    booted = true;
    hero();
    imagine();
    tryon();
    materials();
    categories();
    closeScene();
    ScrollTrigger.refresh();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(initScenes);
  setTimeout(initScenes, 900);

  // ── Scene 1 · Hero ──
  function hero() {
    var slogan = document.getElementById('slogan');
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    var split = false;
    if (hasSplit && slogan) {
      try {
        var sp = SplitText.create(slogan, { type: 'lines', mask: 'lines' });
        gsap.set(slogan, { opacity: 1 });
        tl.from(sp.lines, { yPercent: 118, duration: 1.4, stagger: 0.14 }, 0.1);
        split = true;
      } catch (e) { /* fallback below */ }
    }
    if (!split && slogan) tl.fromTo(slogan, { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 1.3 }, 0.1);
    tl.to('#s-hero .btn-wrap', { opacity: 1, y: 0, duration: 1.1 }, 0.9)
      .fromTo('.sweep-band', { xPercent: -140 }, { xPercent: 320, duration: 1.6, ease: 'power2.inOut' }, 0.5)
      .to('.scroll-cue', { opacity: 1, duration: 0.8 }, 1.5);
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
    else tl.to(typeEl, { opacity: 1, duration: 0.7 }, 0.75);
    tl.to('#s-imagine .resolve-frame', { opacity: 1, y: 0, duration: 0.65 }, 1.1)
      .to(sharp, { opacity: 1, scale: 1, duration: 1.3 }, 2.0)
      .to('#s-imagine .scene-sub', { opacity: 1, y: 0, duration: 0.55 }, 2.8)
      .to({}, { duration: 0.5 });
  }

  // ── Scene 3 · Try on (viewfinder draws, light sweeps across the piece) ──
  function tryon() {
    gsap.timeline({
      scrollTrigger: { trigger: '#s-tryon', start: 'top 70%', once: true },
      defaults: { ease: 'power3.out' }
    })
      .to('#s-tryon .st-t', { opacity: 1, y: 0, duration: 1.1, stagger: 0.12 }, 0)
      .fromTo('.vf-corner', { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, stagger: 0.08 }, 0.25)
      .fromTo('.vf-media img', { scale: 1.12 }, { scale: 1, duration: 1.6, ease: 'expo.out' }, 0.1);

    gsap.fromTo('.vf-sweep', { xPercent: -160 }, {
      xPercent: 400, duration: 3.4, ease: 'power2.inOut', repeat: -1, repeatDelay: 2.6,
      scrollTrigger: { trigger: '#s-tryon', start: 'top bottom', end: 'bottom top', toggleActions: 'play pause resume pause' }
    });
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

  // ── Scene 6 · Close + footer ──
  function closeScene() {
    gsap.timeline({
      scrollTrigger: { trigger: '#s-close', start: 'top 70%', once: true },
      defaults: { ease: 'power3.out' }
    }).to('#s-close .st-c', { opacity: 1, y: 0, duration: 1.2, stagger: 0.14 }, 0);

    gsap.fromTo('footer .foot-inner', { opacity: 0 }, {
      opacity: 1, duration: 1, ease: 'power2.out',
      scrollTrigger: { trigger: 'footer', start: 'top 95%', once: true }
    });
  }

  // keep trigger positions honest once images/fonts settle
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();

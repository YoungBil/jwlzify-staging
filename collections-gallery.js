/*
 * collections-gallery.js — renders the Collections gallery from
 * window.COLLECTION_ITEMS (collections-data.js). Handles:
 *   - category filtering (sidebar tabs) — every piece in a category renders at once
 *   - lazy images + shimmer + fade-in + branded fallback
 *   - the spec detail modal + its two AI Lab handoffs:
 *       "Buy This Piece"         → sessionStorage jwlz_buy_piece       → AI Lab Quote step
 *       "Customize This Design"  → sessionStorage jwlz_customize_piece → AI Lab Refine step
 */
(function () {
  'use strict';

  var ITEMS = window.COLLECTION_ITEMS || [];
  var grid       = document.getElementById('galleryGrid');
  var filterBtns = document.getElementById('filterBtns');
  if (!grid || !filterBtns) return;

  var FILTER_TO_CATEGORY = {
    'rings': 'ring', 'pendants': 'pendant', 'earrings': 'earring',
    'bracelets': 'bracelet', 'necklace-sets': 'necklace'
  };
  var currentCategory = 'ring';

  // ── Pricing (shared AI Lab formula via pricing.js) + locked metal options ──
  var P = window.JWLZ_PRICING;
  // `phrase` is how each item's desc names its default metal (collections-data.js),
  // so the AI Lab prompt can be re-worded for the metal picked in the modal.
  var METAL_OPTIONS = [
    { code: '925silver', display: '925 Sterling Silver', karat: '925', phrase: '925 sterling silver' },
    { code: '10ctgold',  display: '10k Gold',            karat: '10k', phrase: '10k yellow gold' },
    { code: '14ctgold',  display: '14k Gold',            karat: '14k', phrase: '14k yellow gold' }
  ];
  console.log('[Collections] metal options locked to: 925 silver, 10k gold, 14k gold');

  function metalOf(code) {
    for (var i = 0; i < METAL_OPTIONS.length; i++) if (METAL_OPTIONS[i].code === code) return METAL_OPTIONS[i];
    return METAL_OPTIONS[0];
  }
  // Pricing happens in the calc-price worker (server-side formula). One BATCH
  // request prices a whole category render; results are cached per item+metal so
  // tab flips and modal re-opens don't refetch.
  var _priceCache = {};   // "itemId|metalCode" → { price: USD to the cent, grams: worker-derived }
  function cacheKey(item, metalCode) { return item.id + '|' + metalCode; }
  // Style → chain/structure KEY for the worker's weight model. Names only — the
  // grams-per-cm numbers live in the calc-price worker, never in client code.
  // Keys mirror what the AI Lab sends for the same piece (_pricingGeomFields): every
  // bracelet prices as a 'tennis' band (the AI Lab always sends 'tennis'), a
  // continuous-line necklace as 'tennis', other necklaces as their own chain key
  // (an AI Lab chain-style id) — so the Buy / Customize handoffs quote identically.
  var BRACELET_CHAIN_KEY = 'tennis';
  var NECKLACE_CHAIN_KEY = { 'Tennis': 'tennis', 'Wave Tennis': 'tennis', 'Cuban Link': 'cuban', 'Rope': 'rope' };
  // Pendant plate size = the AI Lab's default pendant size (_pendantDims), so the worker
  // derives pendant grams here exactly as it does for that pendant in the AI Lab.
  var PENDANT_SIZE_MM = { w: 15, h: 20 };
  function specOf(item, metalCode) {
    var s = item.specs || {};
    var o = { metalCode: metalCode || s.metalCode, stoneCode: s.stoneType,
              jewelryType: s.jewelryType, carats: s.carats, stoneCount: s.stoneCount };
    if (item.category === 'bracelet') o.chainStyle = BRACELET_CHAIN_KEY;
    if (item.category === 'necklace') o.chainStyle = NECKLACE_CHAIN_KEY[s.style] || 'cable';
    if (item.category === 'pendant') { o.pendantWidthMm = PENDANT_SIZE_MM.w; o.pendantHeightMm = PENDANT_SIZE_MM.h; }
    return o;
  }
  // Price item+metal pairs in ONE worker request; fills _priceCache. Resolves when done.
  function fetchPrices(pairs) {
    if (!P || !P.priceBatch || !pairs.length) return Promise.resolve();
    return P.priceBatch(pairs.map(function (p) { return specOf(p.item, p.metal); }))
      .then(function (results) {
        pairs.forEach(function (p, i) {
          var r = results[i];
          if (!r || r.error || !isFinite(r.finalPrice)) {
            console.warn('[Collections] price unavailable:', p.item.id, '| metal:', p.metal, '|', r && r.error);
            return;
          }
          // To the cent — the AI Lab quote shows the same worker price to the cent.
          var price = Math.round(r.finalPrice * 100) / 100;
          console.log('[Collections] price | item:', p.item.id, '| metal:', p.metal,
            '| stone:', (p.item.specs || {}).stoneType, '| grams:', r.metalGrams, '| finalPrice:', price);
          if (price < 50 || price > 100000) {
            console.warn('[Collections] price OUT OF SANE RANGE:', p.item.id, '| metal:', p.metal, '| price:', price,
              '| inputs:', JSON.stringify({ grams: r.metalGrams, carats: (p.item.specs || {}).carats }));
          }
          _priceCache[cacheKey(p.item, p.metal)] = { price: price, grams: r.metalGrams };
        });
      })
      .catch(function (e) { console.warn('[Collections] pricing worker unavailable:', e && e.message); });
  }
  function cachedPrice(item, metalCode) {
    var c = _priceCache[cacheKey(item, metalCode)];
    return (c != null) ? c.price : null;
  }
  function cachedGrams(item, metalCode) {
    var c = _priceCache[cacheKey(item, metalCode)];
    return (c != null && c.grams != null) ? c.grams : null;
  }
  function fmtPrice(n) {
    return (n == null) ? '—'
      : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD';
  }

  // ── Sidebar counts -> real number of items per category ──
  Array.prototype.forEach.call(filterBtns.querySelectorAll('.coll-filter-btn'), function (btn) {
    var cat = FILTER_TO_CATEGORY[btn.getAttribute('data-filter')];
    var n = ITEMS.filter(function (it) { return it.category === cat; }).length;
    var span = btn.querySelector('span:last-child');
    if (span) span.textContent = n;
  });

  // ── Image load / error handling ──
  function attachImg(img, wrap) {
    function loaded() {
      img.classList.add('loaded');
      wrap.classList.add('img-ready');
      console.log('[Collections] image loaded:', img.getAttribute('src'));
    }
    if (img.complete && img.naturalWidth > 0) loaded();
    else img.addEventListener('load', loaded);
    img.addEventListener('error', function () {
      wrap.classList.add('img-ready'); // stop shimmer
      wrap.innerHTML =
        '<div class="coll-img-fallback">' +
          '<span class="material-symbols-outlined">diamond</span>' +
          '<span>Jwlzify</span>' +
        '</div>';
    });
  }

  // ── Build one card ──
  function makeCard(item) {
    var card = document.createElement('div');
    card.className = 'col-card';
    card.setAttribute('data-id', item.id);
    card.setAttribute('data-category', item.category);

    var wrap = document.createElement('div');
    wrap.className = 'col-imgwrap';
    var img = document.createElement('img');
    img.className = 'coll-img';
    img.src = 'images/collections/' + item.id + '.jpg';
    img.alt = item.name;
    img.width = 800;
    img.height = 800;
    img.loading = 'lazy';
    wrap.appendChild(img);
    attachImg(img, wrap);

    var body = document.createElement('div');
    body.className = 'col-card-body';
    var title = document.createElement('p');
    title.className = 'col-card-title';
    title.textContent = item.name;
    body.appendChild(title);

    var price = document.createElement('p');
    price.className = 'col-card-price';
    // Cached price shows instantly; otherwise a dash until the batch request lands.
    price.textContent = fmtPrice(cachedPrice(item, item.specs.metalCode));
    body.appendChild(price);

    card.appendChild(wrap);
    card.appendChild(body);
    card.addEventListener('click', function () { openSpecs(item); });
    return card;
  }

  // ── Render a category (every piece at once) ──
  function render(category) {
    currentCategory = category;
    grid.innerHTML = '';
    var items = ITEMS.filter(function (it) { return it.category === category; });
    items.forEach(function (it) { grid.appendChild(makeCard(it)); });

    // ONE batch request for every not-yet-cached price in this category, then fill
    // the card price lines (skipped entirely when the whole category is cached).
    var uncached = items.filter(function (it) { return cachedPrice(it, it.specs.metalCode) == null; });
    if (uncached.length) {
      fetchPrices(uncached.map(function (it) { return { item: it, metal: it.specs.metalCode }; }))
        .then(function () {
          if (currentCategory !== category) return; // superseded by a tab switch
          items.forEach(function (it) {
            var el = grid.querySelector('.col-card[data-id="' + it.id + '"] .col-card-price');
            if (el) el.textContent = fmtPrice(cachedPrice(it, it.specs.metalCode));
          });
        });
    }

    console.log('[Collections] category selected:', category, '| items shown:', items.length);
  }

  // ── Scroll to the top of the collections section (accounts for sticky header) ──
  function scrollToCollectionsTop() {
    var section = grid.closest('section');
    var header = document.getElementById('siteHeader');
    var offset = header ? header.offsetHeight : 0;
    if (section) {
      var top = section.getBoundingClientRect().top + window.pageYOffset - offset - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ── Tabs ──
  filterBtns.addEventListener('click', function (e) {
    var btn = e.target.closest('.coll-filter-btn');
    if (!btn) return;
    Array.prototype.forEach.call(filterBtns.querySelectorAll('.coll-filter-btn'), function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    render(FILTER_TO_CATEGORY[btn.getAttribute('data-filter')]);
    scrollToCollectionsTop();
    console.log('[Collections] category changed, scrolled to top');
  });

  // ── Spec modal ──
  var modal      = document.getElementById('specsModal');
  var mImg       = document.getElementById('specsModalImg');
  var mTitle     = document.getElementById('specsModalTitle');
  var mList      = document.getElementById('specsModalList');
  var mCustomize = document.getElementById('specsCustomizeBtn');
  var mBuy       = document.getElementById('specsBuyBtn');
  var mMetalSel  = document.getElementById('specsMetalSelect');
  var mPrice     = document.getElementById('specsPrice');
  // Material/Karat are driven by the selected metal; price is computed (no static range row).
  var SPEC_ROWS = [
    ['Type', 'type'], ['Material', 'material'], ['Karat / Purity', 'karat'],
    ['Stone', 'stone'], ['Stone Size', 'stoneSize'], ['Style', 'style'], ['Weight', 'weight']
  ];

  var _openItem = null;
  var _openMetal = null;

  function renderSpecList(item, metalCode) {
    var s = item.specs || {};
    var m = metalOf(metalCode);
    mList.innerHTML = SPEC_ROWS.map(function (r) {
      var v;
      if (r[1] === 'material')    v = m.display;
      else if (r[1] === 'karat')  v = m.karat;
      else if (r[1] === 'weight') {
        // Weight comes from the worker's derived metalGrams (varies by metal) —
        // shown once the price response lands, a pending dash until then.
        var g = cachedGrams(item, metalCode);
        v = (g != null) ? (g.toFixed(1) + ' g') : '…';
      }
      else v = s[r[1]];
      if (v === undefined || v === null || v === '') return '';
      return '<li><span class="k">' + r[0] + '</span><span class="v">' + v + '</span></li>';
    }).join('');
  }
  function renderMetalSelect(metalCode) {
    if (!mMetalSel) return;
    mMetalSel.innerHTML = METAL_OPTIONS.map(function (m) {
      return '<button class="specs-metal-btn' + (m.code === metalCode ? ' active' : '') +
        '" data-code="' + m.code + '">' + m.display + '</button>';
    }).join('');
  }
  function renderPrice(item, metalCode) {
    if (!mPrice) return;
    var cached = cachedPrice(item, metalCode);
    if (cached != null) { mPrice.textContent = fmtPrice(cached); return; }
    mPrice.textContent = '…';
    fetchPrices([{ item: item, metal: metalCode }]).then(function () {
      // Only paint if the modal still shows this item + metal (guards stale responses).
      if (_openItem === item && _openMetal === metalCode) {
        mPrice.textContent = fmtPrice(cachedPrice(item, metalCode));
        renderSpecList(item, metalCode); // weight row now has the derived grams
      }
    });
  }

  function openSpecs(item) {
    var s = item.specs || {};
    _openItem = item;
    _openMetal = s.metalCode;
    mImg.setAttribute('src', 'images/collections/' + item.id + '.jpg');
    mImg.setAttribute('alt', item.name);
    mTitle.textContent = item.name;
    // The piece is passed via sessionStorage on click; both links go to the AI Lab.
    if (mCustomize) mCustomize.setAttribute('href', 'ailab.html');
    if (mBuy) mBuy.setAttribute('href', 'ailab.html');
    renderSpecList(item, _openMetal);
    renderMetalSelect(_openMetal);
    renderPrice(item, _openMetal);
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    console.log('[Collections] opened specs for:', item.name);
  }
  function closeSpecs() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
  if (modal) {
    document.getElementById('specsModalClose').addEventListener('click', closeSpecs);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeSpecs(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeSpecs();
    });
  }
  // Switch metal (925 / 10k / 14k) → update material, karat and price live.
  if (mMetalSel) mMetalSel.addEventListener('click', function (e) {
    var b = e.target.closest('.specs-metal-btn');
    if (!b || !_openItem) return;
    _openMetal = b.getAttribute('data-code');
    renderMetalSelect(_openMetal);
    renderSpecList(_openItem, _openMetal);
    renderPrice(_openItem, _openMetal);
  });

  // The open piece (with the metal selected in the modal) as the AI Lab handoff payload.
  // Carries every pricing input the modal price used, so the AI Lab quote re-prices
  // the same spec through the same worker.
  function piecePayload(item, metal) {
    var s = item.specs || {};
    var geo = specOf(item, metal);
    // desc names the default metal; re-word it for the selected one.
    var prompt = item.desc || item.name;
    if (metal !== s.metalCode) prompt = prompt.split(metalOf(s.metalCode).phrase).join(metalOf(metal).phrase);
    return {
      id:         item.id,
      name:       item.name,
      type:       s.jewelryType,                 // ring | pendant | earrings | bracelet | necklace
      material:   metal,                         // 925silver | 10ctgold | 14ctgold (AI Lab codes)
      gem:        s.stoneType,                   // lab_diamond | moissanite_vvsd | none
      style:      s.style,
      imageUrl:   new URL('images/collections/' + item.id + '.jpg', window.location.href).href,
      prompt:     prompt,
      grams:      cachedGrams(item, metal),      // worker-derived metalGrams for this metal
      price:      cachedPrice(item, metal),      // the modal price (Buy: the price shown; Customize: parity log)
      carats:     s.carats,
      stoneCount: s.stoneCount,
      form:       s.form,                        // earrings only: stud | hoop | drop
      chainStyle: geo.chainStyle,                // bracelet / necklace weight key
      pendantWidthMm:  geo.pendantWidthMm,       // pendant plate size
      pendantHeightMm: geo.pendantHeightMm
    };
  }

  // "Buy This Piece" → the ready-made piece goes straight to the AI Lab Quote step
  // (re-priced there through the same worker). Written synchronously before the <a> navigates.
  if (mBuy) mBuy.addEventListener('click', function () {
    if (!_openItem) return;
    var payload = piecePayload(_openItem, _openMetal || _openItem.specs.metalCode);
    payload.readyMade = true;
    try { sessionStorage.setItem('jwlz_buy_piece', JSON.stringify(payload)); } catch (e) {}
    console.log('[Collections] buy → AI Lab order:', _openItem.id, '| metal:', payload.material,
      '| modal price:', payload.price, '| grams:', payload.grams);
  });

  // "Customize This Design" → the piece loads straight into the AI Lab Refine step.
  if (mCustomize) mCustomize.addEventListener('click', function () {
    if (!_openItem) return;
    var payload = piecePayload(_openItem, _openMetal || _openItem.specs.metalCode);
    try { sessionStorage.setItem('jwlz_customize_piece', JSON.stringify(payload)); } catch (e) {}
    console.log('[Collections] customize → AI Lab refine:', _openItem.id, '| metal:', payload.material,
      '| modal price:', payload.price, '| grams:', payload.grams);
  });

  // ── Init ──
  console.log('[Collections] tab theme updated to site palette');
  // Default view: Rings. Prices arrive from the calc-price worker's batch response —
  // no fallback-then-live double render needed (the worker prices with its own live
  // spot on the very first request).
  render('ring');
})();

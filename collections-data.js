/*
 * collections-data.js  —  single source of truth for the Collections gallery.
 * Loaded by BOTH:
 *   - the browser (collections.html) -> window.COLLECTION_ITEMS
 *   - the Node generator (generate-collection-images.js) -> module.exports
 *
 * 5 categories x 6 items = 30 items. Each item:
 *   { id, category, type, name, productOnly, desc, specs:{...} }
 *   id is "<category>-NN"  (ring-01 ... necklace-06) -> image is images/collections/<id>.jpg
 *
 * Only what we sell: 925 sterling silver (renders bright white), 10k / 14k gold
 * (render rich yellow), colourless lab diamond or moissanite VVSD, and earrings
 * as stud / hoop / drop. Every style is one the AI Lab can reproduce, and its
 * stone structure sits on the AI Lab's own spec grids so "Customize This Design"
 * loads it exactly (see STONE_STRUCTURE).
 *
 * Items are built deterministically (no randomness) so the browser and the
 * generator always produce the identical catalogue.
 */
(function (root) {
  'use strict';

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  // ── Metals are LOCKED to exactly these three (matches the AI Lab pricing codes). ──
  // `look` is the explicit colour wording used in descriptions + image prompts.
  var METALS = {
    '925silver': { display: '925 Sterling Silver', karat: '925', look: 'bright polished white sterling silver' },
    '10ctgold':  { display: '10k Gold',            karat: '10k', look: 'rich yellow 10k gold' },
    '14ctgold':  { display: '14k Gold',            karat: '14k', look: 'rich yellow 14k gold' }
  };
  // Default-metal rotation (idx%4 → metal below; switchable in the modal between all
  // three). Each image is rendered in its item's default metal.
  var TONE_PREV = ['Yellow', 'White', 'Rose', 'Platinum']; // old idx%4 tone order
  // LAUNCH GATE (keep in sync with ailab.html REAL_DIAMOND_ENABLED): real diamond
  // has no confirmed per-carat rate yet. While false, pieces whose rotation slot is
  // natural_diamond substitute lab diamond instead — the items still generate, so
  // the 30-item grid, ids, names, images and sidebar counts stay identical. Flip to
  // true to restore natural diamond in the rotation.
  var REAL_DIAMOND_ENABLED = false;

  // Stone types are LOCKED to the AI Lab's three options so each piece maps to a
  // correct profit tier (925+moissanite=150%, gold+natural=70%, otherwise 100%).
  // `noun` is the plain stone name used in descriptions + image prompts.
  var STONE_TYPES = [
    { code: 'lab_diamond',     label: 'Lab Diamond',            noun: 'lab diamond' },
    { code: 'natural_diamond', label: 'Natural Diamond VS/VVS', noun: 'natural diamond' },
    { code: 'moissanite_vvsd', label: 'Moissanite VVSD',        noun: 'moissanite' }
  ];
  var STONE_LOOK = 'colourless, brilliant white'; // the only stone colour we sell

  // Per-category configuration: generator type, product-only framing, label, style pool,
  // name list (6), base weight (g) and base price. Item i gets styles[i] + names[i]; the
  // order is chosen against the metal/stone rotation in buildItem so every category
  // shows all three metals and both stone types (bracelets + necklaces also carry
  // plain pieces via noStoneFor).
  var CATS = {
    ring: {
      type: 'ring', label: 'Ring', weightBase: 3.0, priceBase: 1800,
      styles: ['Solitaire', 'Halo', 'Three-Stone', 'Pavé Eternity', 'Bezel', 'Twist'],
      names: ['Classic Solitaire', 'Radiant Halo', 'Trilogy Ring', 'Eternity Band', 'Modern Bezel', 'Silk Twist']
    },
    pendant: {
      type: 'pendant', label: 'Pendant', weightBase: 4.0, priceBase: 1400,
      styles: ['Solitaire', 'Teardrop', 'Heart', 'Bezel', 'Drop', 'Circle'],
      names: ['Pure Solitaire', 'Soft Teardrop', 'True Heart', 'Clean Bezel', 'Simple Drop', 'Open Circle']
    },
    earring: {
      type: 'earrings', productOnly: true, label: 'Earrings', weightBase: 5.0, priceBase: 1600,
      styles: ['Classic Hoop', 'Solitaire Stud', 'Solitaire Drop', 'Huggie Hoop', 'Bezel Stud', 'Double Drop'],
      names: ['Eternal Hoops', 'Everyday Studs', 'Graceful Drops', 'Petite Huggies', 'Framed Studs', 'Cascade Drops'],
      // Style → the AI Lab earring Form (the only three forms it can make).
      forms: { 'Classic Hoop': 'hoop', 'Solitaire Stud': 'stud', 'Solitaire Drop': 'drop',
               'Huggie Hoop': 'hoop', 'Bezel Stud': 'stud', 'Double Drop': 'drop' }
    },
    bracelet: {
      type: 'bracelet', label: 'Bracelet', weightBase: 14.0, priceBase: 2600,
      styles: ['Tennis', 'Cuff', 'Link', 'Bangle', 'Station', 'Line'],
      names: ['Classic Tennis', 'Sculpted Cuff', 'Signature Link', 'Polished Bangle', 'Spaced Brilliance', 'Bold Line']
    },
    necklace: {
      type: 'necklace', productOnly: true, label: 'Necklace', weightBase: 12.0, priceBase: 3200,
      styles: ['Tennis', 'Station', 'Choker', 'Chain', 'Rivière', 'Rope'],
      names: ['Endless Line', 'Station Chain', 'Fine Choker', 'Classic Cable', 'Grand Statement', 'Twisted Rope']
    }
  };

  var CAT_ORDER = ['ring', 'pendant', 'earring', 'bracelet', 'necklace'];

  /* ══════════════════════════════════════════════════════════════════════════
     STONE STRUCTURE BY STYLE — industry-average PLACEHOLDERS pending real
     supplier figures. Every number a piece's stones derive from lives HERE:
       centreCt      — centre stone carat (0 = no dominant centre)
       accents       — accent/melee stone count
       accentTotalCt — TOTAL carat weight of all accents combined
     Totals: carats = centreCt + accentTotalCt; stoneCount = accents + (centre?1:0).
     Reference points used: halo ≈ 12–16 accents totalling 0.25–0.35ct; three-stone
     sides ≈ 40% of centre each. Styles absent from a category's table fall back
     to DEFAULT_STRUCTURE (1ct solitaire).
     Each entry also sits on the AI Lab's own spec grid for that type, so the
     Customize handoff re-derives exactly these numbers there:
       pendant  — one stone (the AI Lab pendant flow is single-stone)
       earring  — PER PAIR, even count, 1–4 stones per earring, ≥0.25ct each
                  (EARRING_MM_BASE / EARRING_BUCKETS)
       bracelet — calcBraceletStoneCount at its default 7in: 0.10ct or 0.25ct
                  stones in every / every-other / every-fourth setting
       necklace — _necklaceAutoStoneCount at its default 18in: 5 stations or a
                  54-stone continuous line
  ══════════════════════════════════════════════════════════════════════════ */
  var DEFAULT_STRUCTURE = { centreCt: 1.00, accents: 0, accentTotalCt: 0 };
  var STONE_STRUCTURE = {
    ring: {
      'Solitaire':     { centreCt: 1.00, accents: 0,  accentTotalCt: 0 },
      'Halo':          { centreCt: 1.00, accents: 14, accentTotalCt: 0.28 },
      'Three-Stone':   { centreCt: 1.00, accents: 2,  accentTotalCt: 0.80 },
      'Pavé Eternity': { centreCt: 0,    accents: 24, accentTotalCt: 1.20 },
      'Bezel':         { centreCt: 1.00, accents: 0,  accentTotalCt: 0 },
      'Twist':         { centreCt: 0.75, accents: 0,  accentTotalCt: 0 }
    },
    pendant: {
      'Solitaire': { centreCt: 1.00, accents: 0,  accentTotalCt: 0 },
      'Teardrop':  { centreCt: 1.25, accents: 0,  accentTotalCt: 0 },
      'Heart':     { centreCt: 0.75, accents: 0,  accentTotalCt: 0 },
      'Bezel':     { centreCt: 1.00, accents: 0,  accentTotalCt: 0 },
      'Drop':      { centreCt: 1.00, accents: 0,  accentTotalCt: 0 },
      'Circle':    { centreCt: 1.00, accents: 0,  accentTotalCt: 0 }
    },
    earring: { // PER PAIR
      'Classic Hoop':   { centreCt: 0, accents: 8, accentTotalCt: 2.00 },  // 4 per earring × 0.25ct
      'Solitaire Stud': { centreCt: 0, accents: 2, accentTotalCt: 1.00 },  // 1 per earring × 0.50ct
      'Solitaire Drop': { centreCt: 0, accents: 2, accentTotalCt: 1.50 },  // 1 per earring × 0.75ct
      'Huggie Hoop':    { centreCt: 0, accents: 6, accentTotalCt: 1.50 },  // 3 per earring × 0.25ct
      'Bezel Stud':     { centreCt: 0, accents: 2, accentTotalCt: 1.50 },  // 1 per earring × 0.75ct
      'Double Drop':    { centreCt: 0, accents: 4, accentTotalCt: 1.00 }   // 2 per earring × 0.25ct
    },
    bracelet: { // no-stone styles (Cuff, Bangle, …) never reach this table
      'Tennis':  { centreCt: 0, accents: 51, accentTotalCt: 5.10 },  // 0.10ct, every setting
      'Link':    { centreCt: 0, accents: 9,  accentTotalCt: 2.25 },  // 0.25ct, every fourth setting
      'Station': { centreCt: 0, accents: 25, accentTotalCt: 2.50 },  // 0.10ct, every other setting
      'Line':    { centreCt: 0, accents: 38, accentTotalCt: 9.50 }   // 0.25ct, every setting
    },
    necklace: {
      'Tennis':  { centreCt: 0, accents: 54, accentTotalCt: 4.32 },  // continuous line, 0.08ct
      'Station': { centreCt: 0, accents: 5,  accentTotalCt: 1.25 },  // 5 stations, 0.25ct
      'Choker':  { centreCt: 0, accents: 5,  accentTotalCt: 1.25 },  // 5 stations, 0.25ct
      'Rivière': { centreCt: 0, accents: 54, accentTotalCt: 13.50 }  // continuous line, 0.25ct
    }
  };
  function stoneStructureFor(category, style) {
    return (STONE_STRUCTURE[category] && STONE_STRUCTURE[category][style]) || DEFAULT_STRUCTURE;
  }

  // Categories whose plainer styles (chains / metal cuffs) sometimes carry no stone.
  function noStoneFor(category, style) {
    if (category === 'bracelet') return ['Cuff', 'Bangle', 'Hinge Cuff', 'Rope', 'Bolo', 'Mesh'].indexOf(style) !== -1;
    if (category === 'necklace') return ['Chain', 'Rope', 'Collar'].indexOf(style) !== -1;
    if (category === 'ring') return style === 'Signet';
    return false;
  }

  function buildItem(category, i) {
    var cfg = CATS[category];
    var idx = i - 1;
    var name = cfg.names[idx];
    var style = cfg.styles[idx % cfg.styles.length];

    // Default locked metal (switchable in modal): white/platinum tones → 925 silver,
    // yellow → 14k gold, rose → 10k gold. All three options are represented.
    var tone = TONE_PREV[idx % 4];
    var metalCode;
    if (tone === 'White' || tone === 'Platinum') metalCode = '925silver';
    else if (tone === 'Yellow') metalCode = '14ctgold';
    else metalCode = '10ctgold';
    var metal = METALS[metalCode];

    // Metal weight is NOT baked here any more — it was a list-position guess.
    // The calc-price worker derives grams from the piece's specs (style/metal),
    // and collections-gallery.js renders the modal Weight row from that response.

    // Locked stone type → correct profit tier. Plain styles carry no stone.
    var hasStone = !noStoneFor(category, style);
    var stoneType, stoneLabel, stoneSize, gemPhrase, carats, stoneCount, centreCt;
    if (!hasStone) {
      stoneType = 'none'; stoneLabel = 'None'; carats = 0; stoneCount = 0; centreCt = 0; stoneSize = '—';
      gemPhrase = 'a clean all-metal design';
    } else {
      var st = STONE_TYPES[(idx + CAT_ORDER.indexOf(category)) % STONE_TYPES.length];
      // Gate: natural-diamond slots become lab diamond while real diamond is disabled
      // (same rotation position, so every other item is untouched).
      if (!REAL_DIAMOND_ENABLED && st.code === 'natural_diamond') st = STONE_TYPES[0];
      stoneType = st.code; stoneLabel = st.label;
      // Style-driven structure (see STONE_STRUCTURE): totals = centre + accents.
      var struct = stoneStructureFor(category, style);
      carats     = Math.round((struct.centreCt + struct.accentTotalCt) * 100) / 100;
      stoneCount = struct.accents + (struct.centreCt > 0 ? 1 : 0);
      centreCt   = struct.centreCt;
      var isMulti = stoneCount > 1;
      stoneSize = carats.toFixed(2) + ' ct' + (isMulti ? ' total' : '');
      gemPhrase = 'featuring ' + (isMulti ? stoneSize + ' of ' : 'a ' + stoneSize + ' ') + STONE_LOOK + ' ' + st.noun;
    }

    // Plain-English description (the AI Lab's starting prompt on Customize). Colour is
    // always explicit: white silver / yellow gold, colourless brilliant white stones.
    var desc = (category === 'earring' ? 'a pair of ' : 'a ') + style.toLowerCase() + ' ' + cfg.label.toLowerCase() +
      ', the "' + name + '", crafted in ' + metal.look + ', ' + gemPhrase;

    return {
      id: category + '-' + pad2(i),
      category: category,
      type: cfg.type,
      name: name,
      productOnly: !!cfg.productOnly,
      desc: desc,
      specs: {
        type: cfg.label,
        jewelryType: cfg.type,   // ring|pendant|earrings|bracelet|necklace (for pricing)
        material: metal.display, // '925 Sterling Silver' | '10k Gold' | '14k Gold'
        metalCode: metalCode,    // '925silver' | '10ctgold' | '14ctgold'
        karat: metal.karat,      // '925' | '10k' | '14k'
        stone: stoneLabel,       // 'Lab Diamond' | 'Natural Diamond VS/VVS' | 'Moissanite VVSD' | 'None'
        stoneType: stoneType,    // 'lab_diamond' | 'natural_diamond' | 'moissanite_vvsd' | 'none'
        stoneSize: stoneSize,
        carats: carats,          // numeric total carats
        stoneCount: stoneCount,
        centreCt: centreCt,      // centre stone carat (0 = no dominant centre)
        form: cfg.forms ? cfg.forms[style] : undefined, // earrings only: 'stud' | 'hoop' | 'drop'
        style: style
        // weight + price are computed at runtime by the calc-price worker
        // (grams derived from specs; see collections-gallery.js)
      }
    };
  }

  var ITEMS = [];
  CAT_ORDER.forEach(function (category) {
    for (var i = 1; i <= 6; i++) ITEMS.push(buildItem(category, i));
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = ITEMS;
  if (root) root.COLLECTION_ITEMS = ITEMS;
})(typeof window !== 'undefined' ? window : this);

/*
 * collections-data.js  —  single source of truth for the Collections gallery.
 * Loaded by BOTH:
 *   - the browser (collections.html) -> window.COLLECTION_ITEMS
 *   - the Node image script (fetch-collection-images.js) -> module.exports
 *
 * 5 categories x 6 ready-made pieces = 30 items, hand-written below. Each item:
 *   { id, category, type, name, productOnly, sourceUrl, desc, specs:{...} }
 *   id is "<category>-NN"  (ring-01 ... necklace-06) -> image is images/collections/<id>.jpg
 *   sourceUrl is the Paradise Gems product page the photo comes from (used with
 *   permission); the image script fetches <sourceUrl>.json.
 *
 * Only what we sell: metalCode 925silver | 10ctgold | 14ctgold; stoneType
 * lab_diamond | moissanite_vvsd | none (colourless stones only). Each item's
 * default metal is the metal shown in its photo; the modal can re-price it in
 * all three metals.
 *
 * carats    — the source listing's carat weight (pairs for earrings). Where the
 *             listing gives none, an estimate from the photo (marked "est.").
 * stoneCount — the listing's count, else an estimate from the photo. Bracelets
 *             are the exception: the AI Lab derives a bracelet's stone count
 *             deterministically (calcBraceletStoneCount at its default 7in), so
 *             each bracelet's count is that setting count for its carat weight —
 *             Customize / Buy then re-derive the identical total carats and the
 *             AI Lab quote equals the modal price.
 *
 * No randomness, no generated catalogue: what is written here is what renders.
 */
(function (root) {
  'use strict';

  // LAUNCH GATE (keep in sync with ailab.html REAL_DIAMOND_ENABLED): real diamond
  // has no confirmed per-carat rate yet. While false, any natural_diamond piece is
  // listed as lab diamond instead (no current piece uses natural diamond).
  var REAL_DIAMOND_ENABLED = false;

  // Display strings for the locked codes (pricing/AI Lab use the codes only).
  var METALS = {
    '925silver': { material: '925 Sterling Silver', karat: '925' },
    '10ctgold':  { material: '10k Gold',            karat: '10k' },
    '14ctgold':  { material: '14k Gold',            karat: '14k' }
  };
  var STONES = {
    lab_diamond:     'Lab Diamond',
    natural_diamond: 'Natural Diamond VS/VVS',
    moissanite_vvsd: 'Moissanite VVSD',
    none:            'None'
  };
  var CATEGORY = {
    ring:     { type: 'ring',     label: 'Ring' },
    pendant:  { type: 'pendant',  label: 'Pendant' },
    earring:  { type: 'earrings', label: 'Earrings' },
    bracelet: { type: 'bracelet', label: 'Bracelet' },
    necklace: { type: 'necklace', label: 'Necklace' }
  };

  var PG = 'https://theparadisegems.com/products/';

  // ── The 30 pieces ── (p = piece fields; s = per-piece specs)
  var PIECES = [
    // ── RINGS ──
    { id: 'ring-01', name: 'Oval Halo', style: 'Halo', metal: '925silver', stone: 'moissanite_vvsd', carats: 2.00, stoneCount: 33,
      sourceUrl: PG + 'oval-moissanite-halo-engagement-ring-gra-certified',
      desc: 'An oval halo ring in 925 sterling silver set with 2.00 ct total of colourless moissanite: an oval centre stone inside a halo of round stones on a pavé band.' },
    { id: 'ring-02', name: 'Three-Stone Halo', style: 'Three-Stone', metal: '925silver', stone: 'lab_diamond', carats: 2.00, stoneCount: 55,
      sourceUrl: PG + '2ct-emerald-cut-moissanite-three-stone-halo-ring-925-sterling-silver',
      desc: 'A three-stone halo ring in 925 sterling silver set with 2.00 ct total of colourless lab diamond: three emerald-cut stones, each framed by a pavé halo, on a pavé band.' },
    { id: 'ring-03', name: 'Double Row Eternity', style: 'Eternity', metal: '925silver', stone: 'moissanite_vvsd', carats: 1.80, stoneCount: 46,
      sourceUrl: PG + 'moissanite-diamond-full-eternity-band-ring',
      desc: 'A full eternity band in 925 sterling silver set with 1.80 ct total of colourless moissanite in two continuous rows of round stones.' },
    { id: 'ring-04', name: 'Iced Signet', style: 'Signet', metal: '925silver', stone: 'lab_diamond', carats: 4.40, stoneCount: 180,
      sourceUrl: PG + 'mens-moissanite-signet-ring-4ct-fully-iced-out-gra',
      desc: 'A men\'s fully iced signet ring in 925 sterling silver set with 4.40 ct total of colourless lab diamond pavé across the round face and shoulders.' },
    { id: 'ring-05', name: 'Pavé Cluster', style: 'Cluster', metal: '925silver', stone: 'moissanite_vvsd', carats: 1.50, stoneCount: 60,
      sourceUrl: PG + 'moissanite-diamond-round-cluster-ring-pave-band',
      desc: 'A round cluster ring in 925 sterling silver set with 1.50 ct total of colourless moissanite: a round cluster of stones inside a halo on a wide pavé band.' },
    { id: 'ring-06', name: 'Baguette Cross', style: 'Cross', metal: '925silver', stone: 'lab_diamond', carats: 7.20, stoneCount: 160,
      sourceUrl: PG + 'moissanite-mens-moissanite-baguette-cross-ring-7-2ct-925-silver-gra',
      desc: 'A men\'s baguette cross ring in 925 sterling silver set with 7.20 ct total of colourless lab diamond: a cross of baguette stones on a fully pavé-set dome.' },

    // ── PENDANTS ──
    { id: 'pendant-01', name: 'Iced Cross', style: 'Cross', metal: '925silver', stone: 'moissanite_vvsd', carats: 3.31, stoneCount: 11,
      sourceUrl: PG + 'vvs-moissanite-cross-pendant-round-brilliant-925-silver',
      desc: 'A cross pendant in 925 sterling silver set with 3.31 ct total of colourless moissanite: eleven round brilliant stones in a line.' },
    { id: 'pendant-02', name: 'Baguette Heart', style: 'Heart', metal: '925silver', stone: 'lab_diamond', carats: 5.13, stoneCount: 70,
      sourceUrl: PG + 'baguette-vvs-moissanite-heart-pendant-iced-out-925-silver',
      desc: 'An iced heart pendant in 925 sterling silver set with 5.13 ct total of colourless lab diamond: baguette stones inside a border of round pavé.' },
    { id: 'pendant-03', name: 'Lightning Bolt', style: 'Lightning Bolt', metal: '925silver', stone: 'moissanite_vvsd', carats: 5.97, stoneCount: 120,
      sourceUrl: PG + 'vvs-moissanite-lightning-bolt-pendant-iced-out-925-silver',
      desc: 'A lightning bolt pendant in 925 sterling silver fully iced with 5.97 ct total of colourless moissanite pavé.' },
    { id: 'pendant-04', name: 'Lion Head', style: 'Lion', metal: '925silver', stone: 'lab_diamond', carats: 2.23, stoneCount: 150,
      sourceUrl: PG + 'vvs-moissanite-lion-pendant-iced-out-925-sterling-silver',
      desc: 'A lion head pendant in 925 sterling silver iced with 2.23 ct total of colourless lab diamond pavé through the mane and face.' },
    { id: 'pendant-05', name: 'Praying Hands', style: 'Praying Hands', metal: '925silver', stone: 'moissanite_vvsd', carats: 3.97, stoneCount: 130,
      sourceUrl: PG + 'vvs-moissanite-praying-hands-cross-pendant-iced-out-925-silver',
      desc: 'A praying hands cross pendant in 925 sterling silver iced with 3.97 ct total of colourless moissanite pavé.' },
    { id: 'pendant-06', name: 'Iced Leaf', style: 'Leaf', metal: '925silver', stone: 'lab_diamond', carats: 3.60, stoneCount: 140,
      sourceUrl: PG + 'vvs-moissanite-leaf-pendant-iced-out-925-sterling-silver',
      desc: 'A leaf pendant in 925 sterling silver fully iced with 3.60 ct total of colourless lab diamond pavé.' },

    // ── EARRINGS ── (carats + stoneCount are PER PAIR)
    { id: 'earring-01', name: 'Round Solitaire Studs', style: 'Solitaire Stud', form: 'stud', metal: '925silver', stone: 'moissanite_vvsd', carats: 2.00, stoneCount: 2,
      sourceUrl: PG + 'moissanite-solitaire-stud-earrings-for-men-women-0-5-6ct-vvs-d-color-gra-certified-925-silver-screw-back',
      desc: 'A pair of solitaire stud earrings in 925 sterling silver, each set with one round colourless moissanite, 2.00 ct for the pair.' },
    { id: 'earring-02', name: 'Princess Studs', style: 'Princess Stud', form: 'stud', metal: '14ctgold', stone: 'lab_diamond', carats: 1.80, stoneCount: 2,
      sourceUrl: PG + 'moissanite-princess-cut-stud-earrings-men-women-vvs-gra-screw-back',
      desc: 'A pair of princess-cut stud earrings in 14k yellow gold, each set with one square colourless lab diamond in four prongs, 1.80 ct for the pair.' },
    { id: 'earring-03', name: 'Triple Row Hoops', style: 'Triple Row Hoop', form: 'hoop', metal: '14ctgold', stone: 'moissanite_vvsd', carats: 2.00, stoneCount: 64,
      sourceUrl: PG + 'moissanite-triple-row-iced-out-hoop-earrings-14k-gold-vvs-gra',
      desc: 'A pair of triple row hoop earrings in 14k yellow gold, iced with a row of baguettes between two rows of round colourless moissanite, 2.00 ct est. for the pair.' },
    { id: 'earring-04', name: 'Pavé Huggies', style: 'Pavé Huggie', form: 'hoop', metal: '925silver', stone: 'lab_diamond', carats: 1.00, stoneCount: 30,
      sourceUrl: PG + '1-ctw-moissanite-pave-huggie-hoop-earrings-14k-gold-over-925-silver-gra-certified',
      desc: 'A pair of pavé huggie hoop earrings in 925 sterling silver, each with a single row of round colourless lab diamonds, 1.00 ct for the pair.' },
    { id: 'earring-05', name: 'Baguette Halo Studs', style: 'Baguette Halo Stud', form: 'stud', metal: '10ctgold', stone: 'moissanite_vvsd', carats: 1.00, stoneCount: 50,
      sourceUrl: PG + 'moissanite-triple-baguette-halo-earrings-1ct-14k-gold-vvs-gra',
      desc: 'A pair of square halo stud earrings in 10k yellow gold, each with three baguettes and round stones inside a pavé halo of colourless moissanite, 1.00 ct for the pair.' },
    { id: 'earring-06', name: 'Heart Drops', style: 'Heart Drop', form: 'drop', metal: '925silver', stone: 'lab_diamond', carats: 1.50, stoneCount: 120,
      sourceUrl: PG + 'hmoissanite-heart-drop-dangle-earrings-vvs-d-color-gra-925-silver-alt-text-gra-certified-moissanite-heart-drop-dangle-earrings-vvs-d-color',
      desc: 'A pair of heart drop earrings in 925 sterling silver, each a pavé heart of colourless lab diamonds hanging from a pavé huggie, 1.50 ct for the pair.' },

    // ── BRACELETS ── (stoneCount = AI Lab setting count at 7in; see header)
    { id: 'bracelet-01', name: 'Tennis 3mm', style: 'Tennis', metal: '925silver', stone: 'moissanite_vvsd', carats: 6.00, stoneCount: 49,
      sourceUrl: PG + 'moissanite-tennis-bracelet-3mm-6mm-vvs-d-color-iced-out',
      desc: 'A 3mm tennis bracelet in 925 sterling silver with a continuous line of round colourless moissanite, 6.00 ct total.' },
    { id: 'bracelet-02', name: 'Tennis 6mm', style: 'Tennis', metal: '14ctgold', stone: 'lab_diamond', carats: 28.00, stoneCount: 30,
      sourceUrl: PG + 'moissanite-tennis-bracelet-3mm-6mm-vvs-d-color-iced-out',
      desc: 'A bold 6mm tennis bracelet in 14k yellow gold with a continuous line of large round colourless lab diamonds, 28.00 ct total.' },
    { id: 'bracelet-03', name: 'Heart-Cut Tennis', style: 'Heart Tennis', metal: '925silver', stone: 'moissanite_vvsd', carats: 5.00, stoneCount: 51,
      sourceUrl: PG + 'heart-cut-moissanite-tennis-bracelet',
      desc: 'A heart-cut tennis bracelet in 925 sterling silver with a continuous line of heart-shaped colourless moissanite, 5.00 ct total.' },
    { id: 'bracelet-04', name: 'Pavé Love Bangle', style: 'Pavé Bangle', metal: '925silver', stone: 'lab_diamond', carats: 3.20, stoneCount: 51,
      sourceUrl: PG + 'moissanite-love-bracelet',
      desc: 'An oval screw-motif bangle in 925 sterling silver, fully pavé-set with 3.20 ct total of colourless lab diamond.' },
    { id: 'bracelet-05', name: 'Panther Bangle', style: 'Panther Bangle', metal: '925silver', stone: 'moissanite_vvsd', carats: 3.00, stoneCount: 51,
      sourceUrl: PG + 'moissanite-dual-panther-pave-bangle-925-silver',
      desc: 'An open bangle in 925 sterling silver with two facing panther heads pavé-set with colourless moissanite, 3.00 ct est. total.' },
    { id: 'bracelet-06', name: 'Cuban Link 10mm', style: 'Cuban Link', metal: '14ctgold', stone: 'lab_diamond', carats: 6.05, stoneCount: 48,
      sourceUrl: PG + 'moissanite-cuban-link-bracelet-8mm-12mm-vvs-d-color-iced-out',
      desc: 'A 10mm iced Cuban link bracelet in 14k yellow gold, every link prong-set with colourless lab diamonds, 6.05 ct total.' },

    // ── NECKLACES ──
    { id: 'necklace-01', name: 'Cuban 12mm', style: 'Cuban Link', metal: '925silver', stone: 'moissanite_vvsd', carats: 20.00, stoneCount: 1000,
      sourceUrl: PG + 'moissanite-cuban-chain-12mm-925-silver-men-women-vvs-gra',
      desc: 'A 12mm iced Cuban link chain in 925 sterling silver, every link prong-set with colourless moissanite, 20.00 ct total.' },
    { id: 'necklace-02', name: 'Cuban 8mm', style: 'Cuban Link', metal: '14ctgold', stone: 'lab_diamond', carats: 14.00, stoneCount: 900,
      sourceUrl: PG + 'moissanite-cuban-link-chain-8mm-14k-gold-925-silver-men-women-vvs-d-color-gra-certified-passes-diamond-tester',
      desc: 'An 8mm iced Cuban link chain in 14k yellow gold, every link prong-set with colourless lab diamonds, 14.00 ct total.' },
    { id: 'necklace-03', name: 'Tennis 2mm', style: 'Tennis', metal: '925silver', stone: 'moissanite_vvsd', carats: 12.00, stoneCount: 218,
      sourceUrl: PG + 'moissanite-tennis-chain-moissanite-tennis-chain-2mm-925-silver-men-women-vvs-gra',
      desc: 'A fine 2mm tennis chain in 925 sterling silver with a continuous line of round colourless moissanite, 12.00 ct total.' },
    { id: 'necklace-04', name: 'Tennis 4mm', style: 'Tennis', metal: '14ctgold', stone: 'lab_diamond', carats: 27.00, stoneCount: 109,
      sourceUrl: PG + 'moissanite-tennis-chain-4mm-14k-gold-men-women-vvs-gra',
      desc: 'A 4mm tennis chain in 14k yellow gold with a continuous line of round colourless lab diamonds, 27.00 ct total.' },
    { id: 'necklace-05', name: 'Wave Tennis', style: 'Wave Tennis', metal: '14ctgold', stone: 'moissanite_vvsd', carats: 15.00, stoneCount: 160,
      sourceUrl: PG + 'moissanite-wave-tennis-necklace-925-silver-14k-gold-vvs-d-color',
      desc: 'A wave tennis necklace in 14k yellow gold, a continuous line of round colourless moissanite curving in soft waves, 15.00 ct est. total.' },
    { id: 'necklace-06', name: 'Cuban 10mm', style: 'Cuban Link', metal: '10ctgold', stone: 'lab_diamond', carats: 18.00, stoneCount: 1000,
      sourceUrl: PG + 'moissanite-cuban-chain-10mm-14k-gold-925-silver-men-women-vvs-gra',
      desc: 'A 10mm iced Cuban link chain in 10k yellow gold, every link prong-set with colourless lab diamonds, 18.00 ct total.' }
  ];

  function category(id) { return id.slice(0, id.indexOf('-')); }

  var ITEMS = PIECES.map(function (p) {
    var cat = category(p.id);
    var c = CATEGORY[cat];
    var metal = METALS[p.metal];
    var stone = (!REAL_DIAMOND_ENABLED && p.stone === 'natural_diamond') ? 'lab_diamond' : p.stone;
    var plain = stone === 'none';
    var specs = {
      type: c.label,
      jewelryType: c.type,          // ring | pendant | earrings | bracelet | necklace (pricing key)
      material: metal.material,     // '925 Sterling Silver' | '10k Gold' | '14k Gold'
      metalCode: p.metal,           // '925silver' | '10ctgold' | '14ctgold'
      karat: metal.karat,           // '925' | '10k' | '14k'
      stone: STONES[stone],         // 'Lab Diamond' | 'Moissanite VVSD' | 'None'
      stoneType: stone,             // 'lab_diamond' | 'moissanite_vvsd' | 'none'
      stoneSize: plain ? '—' : p.carats.toFixed(2) + ' ct ' + (cat === 'earring' ? 'per pair' : 'total'),
      carats: plain ? 0 : p.carats,
      stoneCount: plain ? 0 : p.stoneCount,
      style: p.style
      // weight + price are computed at runtime by the calc-price worker
    };
    if (cat === 'earring') specs.form = p.form; // 'stud' | 'hoop' | 'drop'
    return {
      id: p.id,
      category: cat,
      type: c.type,
      name: p.name,
      productOnly: cat === 'necklace',
      sourceUrl: p.sourceUrl,
      desc: p.desc,
      specs: specs
    };
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = ITEMS;
  if (root) root.COLLECTION_ITEMS = ITEMS;
})(typeof window !== 'undefined' ? window : this);

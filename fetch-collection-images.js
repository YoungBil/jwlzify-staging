/*
 * fetch-collection-images.js
 * ------------------------------------------------------------------
 * ONE-TIME download of the collections.html gallery photos.
 *
 * Catalogue: collections-data.js  (5 categories x 6 ready-made pieces = 30).
 * One image per item -> images/collections/<id>.jpg
 *
 * SOURCE: each item's sourceUrl is a Paradise Gems (Shopify) product page,
 * used with permission. For every item the script fetches
 *   https://theparadisegems.com/products/<handle>.json
 * and picks ONE product image for the item's metal:
 *   - 925silver          -> an image labelled silver
 *   - 10ctgold / 14ctgold -> an image labelled (yellow) gold
 * The label is the image's linked variant titles first, then its alt text.
 * Images labelled rose gold, two-tone or black are never auto-picked. If no
 * image is labelled for the metal, the first acceptable image is used.
 *
 * OVERRIDES (below) pin an image position (1-based, as Shopify numbers them)
 * and an optional crop, for items whose labels are missing or wrong — every
 * pick was checked by eye: right piece, right metal colour, colourless stones.
 *
 * Every output is resized to max 800px (longest side) and re-encoded JPEG
 * quality 80 on a white background (via Windows System.Drawing).
 *
 * Run:  node fetch-collection-images.js
 *       node fetch-collection-images.js --only ring          (one category)
 *       node fetch-collection-images.js --only ring-04       (one item)
 *       node fetch-collection-images.js --force              (re-download all)
 * ------------------------------------------------------------------
 */

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ITEMS     = require('./collections-data.js');
const OUT_DIR   = path.join(__dirname, 'images', 'collections');
const MAX_SIDE  = 800;
const JPEG_Q    = 80;
const FETCH_W   = 1600;  // CDN width requested before cropping/resizing
const DELAY_MS  = 400;

// ─────────────────────────────────────────────────────────────────
// Per-item overrides: { image: <1-based position>, crop?: {x,y,w,h} as fractions
// of the source image }. Reason noted per entry.
// ─────────────────────────────────────────────────────────────────
const OVERRIDES = {
  'ring-05':     { image: 1 },                                       // clean product shot (unlabelled); the silver-labelled image is a distant hand shot
  'pendant-03':  { image: 1 },                                       // clean product shot (unlabelled); the silver-labelled image is worn on a model
  'pendant-04':  { image: 3 },                                      // front views show coloured (pink) eye stones; this angle shows colourless pavé only
  'pendant-06':  { image: 1 },                                       // clean product shot (unlabelled); the silver-labelled image is worn on a model
  'earring-02':  { image: 3, crop: { x: 0.00, y: 0.125, w: 0.50, h: 0.75 } }, // only gold shot shows gold + silver pairs: crop to the gold pair
  'earring-03':  { image: 3, crop: { x: 0.05, y: 0.25,  w: 0.70, h: 0.467 } }, // the yellow-gold hoop (worn); image 1 is white metal
  'earring-05':  { image: 3, crop: { x: 0.50, y: 0.25,  w: 0.50, h: 0.50 } },  // only gold shot shows silver + gold pairs: crop to the gold pair
  'bracelet-01': { image: 4 },                                       // silver tennis line-up (2–6mm); its alt text wrongly says rose gold
  'bracelet-02': { image: 1 },                                       // yellow-gold tennis stack (no gold 6mm-only photo exists)
  'bracelet-06': { image: 2, crop: { x: 0.45, y: 0.08, w: 0.26, h: 0.54 } },   // multi-colour line-up: crop to the yellow-gold bracelet
  'necklace-05': { image: 2 }                                        // product-only shot (no silver photo exists — piece defaults to gold)
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function handleOf(item) {
  return String(item.sourceUrl || '').replace(/[?#].*$/, '').replace(/\/+$/, '').split('/products/')[1];
}

// ─────────────────────────────────────────────────────────────────
// Image choice by metal label
// ─────────────────────────────────────────────────────────────────
const REJECT = /rose|two[\s-]?tone|2[\s-]?tone|black|with white/i;

// 'silver' | 'gold' | 'mixed' | null (unlabelled) for one label string.
function metalOfLabel(s) {
  if (!s) return null;
  const silver = /silver|white gold/i.test(s);
  const gold   = /gold/i.test(s.replace(/white gold/ig, ''));
  if (silver && gold) return 'mixed';
  return silver ? 'silver' : gold ? 'gold' : null;
}

function imageMetal(img, variantTitle) {
  // Linked to variants of ONE metal → that metal. Linked to several (one shared
  // photo for every colour option) or none → fall through to the alt text.
  const vts = (img.variant_ids || []).map((id) => variantTitle[id]).filter(Boolean);
  const kinds = new Set(vts.map(metalOfLabel).filter(Boolean));
  if (kinds.size === 1) return [...kinds][0];
  const fromAlt = metalOfLabel(img.alt || '');
  return fromAlt === 'mixed' ? null : fromAlt; // "14K gold plated 925 silver" says nothing about the photo
}

function pickImage(item, product) {
  const imgs = (product.images || []).slice().sort((a, b) => a.position - b.position);
  const ov = OVERRIDES[item.id];
  if (ov) {
    const img = imgs.find((i) => i.position === ov.image);
    if (!img) throw new Error('override image ' + ov.image + ' not found');
    return { img, crop: ov.crop || null, why: 'override' };
  }
  const variantTitle = {};
  (product.variants || []).forEach((v) => { variantTitle[v.id] = v.title; });
  const want = item.specs.metalCode === '925silver' ? 'silver' : 'gold';
  const ok = (i) => !REJECT.test((i.alt || '') + ' ' + (i.variant_ids || []).map((id) => variantTitle[id]).join(' '));
  const labelled = imgs.find((i) => ok(i) && imageMetal(i, variantTitle) === want);
  if (labelled) return { img: labelled, crop: null, why: 'labelled ' + want };
  const first = imgs.find(ok) || imgs[0];
  if (!first) throw new Error('product has no images');
  return { img: first, crop: null, why: 'first image (no ' + want + ' label)' };
}

// ─────────────────────────────────────────────────────────────────
// Crop/resize/compress helper (Windows System.Drawing via a temp PowerShell script)
// ─────────────────────────────────────────────────────────────────
const PS_RESIZE = path.join(os.tmpdir(), 'jwlz-resize-' + process.pid + '.ps1');
function writeResizeScript() {
  fs.writeFileSync(PS_RESIZE, [
    'param([string]$In,[string]$Out,[int]$Max=800,[int]$Quality=80,[double]$CX=0,[double]$CY=0,[double]$CW=1,[double]$CH=1)',
    'Add-Type -AssemblyName System.Drawing',
    "$codec=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()|Where-Object{$_.MimeType -eq 'image/jpeg'}",
    '$ep=New-Object System.Drawing.Imaging.EncoderParameters(1)',
    '$ep.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,[long]$Quality)',
    '$img=[System.Drawing.Image]::FromFile($In)',
    '$sx=[int][Math]::Round($img.Width*$CX);$sy=[int][Math]::Round($img.Height*$CY)',
    '$sw=[int][Math]::Round($img.Width*$CW);$sh=[int][Math]::Round($img.Height*$CH)',
    '$scale=[Math]::Min(1.0,$Max/[Math]::Max($sw,$sh))',
    '$nw=[int][Math]::Round($sw*$scale);$nh=[int][Math]::Round($sh*$scale)',
    '$bmp=New-Object System.Drawing.Bitmap($nw,$nh)',
    '$g=[System.Drawing.Graphics]::FromImage($bmp)',
    '$g.Clear([System.Drawing.Color]::White)',
    '$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic',
    '$g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::HighQuality',
    '$g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality',
    '$dst=New-Object System.Drawing.Rectangle(0,0,$nw,$nh)',
    '$src=New-Object System.Drawing.Rectangle($sx,$sy,$sw,$sh)',
    '$g.DrawImage($img,$dst,$src,[System.Drawing.GraphicsUnit]::Pixel)',
    '$g.Dispose();$img.Dispose()',
    '$bmp.Save($Out,$codec,$ep);$bmp.Dispose()',
  ].join('\n'), 'utf8');
}
function saveJpeg(rawBuf, outPath, crop) {
  const tmpRaw = outPath + '.raw';
  fs.writeFileSync(tmpRaw, rawBuf);
  const c = crop || { x: 0, y: 0, w: 1, h: 1 };
  try {
    execFileSync('powershell', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS_RESIZE,
      '-In', tmpRaw, '-Out', outPath, '-Max', String(MAX_SIDE), '-Quality', String(JPEG_Q),
      '-CX', String(c.x), '-CY', String(c.y), '-CW', String(c.w), '-CH', String(c.h),
    ], { stdio: 'pipe' });
  } finally {
    try { fs.unlinkSync(tmpRaw); } catch (e) {}
  }
}

// ─────────────────────────────────────────────────────────────────
async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (jwlzify collections image fetch)' } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  return res.json();
}
async function getImage(src) {
  // Ask the Shopify CDN for a JPEG at a workable size (System.Drawing can't read WebP).
  const url = src + (src.includes('?') ? '&' : '?') + 'width=' + FETCH_W + '&format=jpg';
  const res = await fetch(url, { headers: { 'Accept': 'image/jpeg' } });
  if (!res.ok) throw new Error('image HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5000) throw new Error('image too small (' + buf.length + 'b)');
  return buf;
}

async function main() {
  const args  = process.argv.slice(2);
  const force = args.includes('--force');
  const oi    = args.indexOf('--only');
  const only  = oi !== -1 ? args[oi + 1] : null;
  const items = ITEMS.filter((it) => !only || it.id === only || it.category === only);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  writeResizeScript();
  const done = [], skipped = [], failed = [];
  const productCache = {};

  for (const item of items) {
    const out = path.join(OUT_DIR, item.id + '.jpg');
    if (!force && fs.existsSync(out)) { skipped.push(item.id); continue; }
    try {
      const handle = handleOf(item);
      if (!handle) throw new Error('no product handle in sourceUrl');
      if (!productCache[handle]) {
        productCache[handle] = (await getJson('https://theparadisegems.com/products/' + handle + '.json')).product;
        await sleep(DELAY_MS);
      }
      const pick = pickImage(item, productCache[handle]);
      saveJpeg(await getImage(pick.img.src), out, pick.crop);
      done.push(item.id);
      console.log('[ok]  ', item.id.padEnd(12), '| metal:', item.specs.metalCode.padEnd(9), '| image #' + pick.img.position,
        '(' + pick.why + (pick.crop ? ', cropped' : '') + ')');
      await sleep(DELAY_MS);
    } catch (e) {
      failed.push(item.id);
      console.error('[fail]', item.id, '|', e.message);
    }
  }
  try { fs.unlinkSync(PS_RESIZE); } catch (e) {}

  console.log('\nSummary: saved', done.length, '| skipped (exists)', skipped.length, '| failed', failed.length,
    failed.length ? '(' + failed.join(', ') + ')' : '');
  if (failed.length) process.exitCode = 1;
}

main();

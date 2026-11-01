/*
 * fetch-collection-images.js
 * ------------------------------------------------------------------
 * ONE-TIME download of the collections.html gallery photos.
 *
 * Catalogue: collections-data.js  (5 categories x 6 ready-made pieces = 30).
 * One image per item -> images/collections/<id>.jpg
 *
 * IMAGE RULE (every item): the piece by itself on a white or very light
 * neutral background — no model, ear, neck, wrist or hand, no fabric, no dark
 * or black backdrop, no multi-size line-up.
 *
 * SOURCE: each item's sourceUrl is a Paradise Gems (Shopify) product page,
 * used with permission. For every item the script fetches
 *   https://theparadisegems.com/products/<handle>.json
 * and takes the FIRST product image (Shopify position order) that
 *   - is not labelled with the wrong metal (925silver wants silver, 10k/14k want
 *     yellow gold; rose gold / two-tone / black labels are never used) — the
 *     label is the image's linked variant titles first, then its alt text,
 *   - has no alt text describing a worn shot, model, body part, fabric, dark
 *     backdrop or size line-up, and
 *   - passes a pixel check: its border is white / very light neutral.
 *
 * OVERRIDES (below) pin what was checked by eye: an image position (1-based)
 * plus optional crop, or — when a product has NO image that passes the rule —
 * a generated image: the flux-image worker (fal Flux 2 Pro, square_hd, recorded
 * seed + prompt) from the item's desc as a product shot on white.
 *
 * DETERMINISM: the committed images/collections/*.jpg are canonical. A normal
 * run skips every existing file, so it never changes them. Product photos
 * re-download identically; GENERATED ones do NOT — the deployed flux-image
 * worker returns a different render for the same seed + prompt (checked
 * 2026-11-01) — so after --force on a generated item, re-check it by eye.
 *
 * Every output is resized to max 800px (longest side) and re-encoded JPEG
 * quality 80 on a white background (via Windows System.Drawing).
 *
 * Run:  node fetch-collection-images.js
 *       node fetch-collection-images.js --only ring          (one category)
 *       node fetch-collection-images.js --only ring-04       (one item)
 *       node fetch-collection-images.js --force              (re-download / re-generate all)
 * ------------------------------------------------------------------
 */

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ITEMS       = require('./collections-data.js');
const OUT_DIR     = path.join(__dirname, 'images', 'collections');
const MAX_SIDE    = 800;
const JPEG_Q      = 80;
const FETCH_W     = 1600;  // CDN width requested before cropping/resizing
const CHECK_W     = 400;   // CDN width requested for the background pixel check
const LIGHT_MIN   = 0.92;  // share of border pixels that must be white / very light neutral
const DELAY_MS    = 400;
const FLUX_WORKER = 'https://flux-image.sarkd333.workers.dev';
const ORIGIN      = 'https://jwlzify.com'; // the worker allowlists origins
// Appended to the item's desc for generated images (affirmative wording only — Flux 2 Pro has no negatives).
const GEN_FRAMING = 'Studio product photograph of this one piece on its own, laid flat and centred on a ' +
  'seamless pure white background, seen from directly above, the complete piece fully visible inside the ' +
  'frame with white space all around it, soft even lighting with a gentle natural shadow, crisp focus on ' +
  'every stone, high-end jewelry catalogue photo.';
// Extra shape wording by jewelry type, so a generated chain reads as a necklace, not a bracelet.
const GEN_SHAPE = {
  necklace: 'The full-length necklace is laid out in a long, open U shape, wide at the top and curving down to the bottom of the frame.'
};

// ─────────────────────────────────────────────────────────────────
// Per-item overrides, each checked by eye:
//   { image: <1-based position>, crop?: {x,y,w,h} as fractions of the source image }
//   { generate: { seed, prompt? } }  — no product image passes the rule (or no source
//     product); prompt fixes the exact wording, else item desc + shape + framing
// ─────────────────────────────────────────────────────────────────
const OVERRIDES = {
  'earring-05':  { image: 3, crop: { x: 0.50, y: 0.25,  w: 0.50, h: 0.50 } },  // only gold shot shows silver + gold pairs: crop to the gold pair
  'bracelet-01': { generate: { seed: 2101 } }, // every photo is worn, on fabric, or a 2–6mm line-up
  'bracelet-02': { generate: { seed: 2102 } }, // every photo is worn, on fabric, or a 2–6mm line-up (white-background one is a 4-bracelet stack)
  'bracelet-06': { generate: { seed: 2106 } }, // worn on a dark backdrop, or multi-colour line-ups on a glove
  'necklace-01': { generate: { seed: 2201 } }, // worn on a model, or an 8/10/12mm line-up on a bust
  'necklace-02': { generate: { seed: 2202 } }, // worn on a model, or an 8/10/12mm line-up on a bust
  'necklace-03': { generate: { seed: 2203 } }, // worn on a model, or a 2–6mm line-up
  'necklace-04': { generate: { seed: 2204 } }, // worn on a model, or a 2–6mm line-up
  'necklace-05': { image: 2 },                 // image 1 is worn on a model
  'necklace-06': { generate: { seed: 2266,     // no source product (Paradise Gems sells no rope chain) — fixed prompt
    prompt: 'a single 4mm twisted rope chain necklace in rich polished yellow gold, no stones, laid in an elegant loop, ' +
            'flat-lay product photograph on a seamless white background, studio lighting, sharp focus' } }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function handleOf(item) {
  return String(item.sourceUrl || '').replace(/[?#].*$/, '').replace(/\/+$/, '').split('/products/')[1];
}

// ─────────────────────────────────────────────────────────────────
// Image choice
// ─────────────────────────────────────────────────────────────────
const REJECT_METAL = /rose|two[\s-]?tone|2[\s-]?tone|black|with white/i;
const REJECT_SCENE = /\bworn\b|wearing|\bmodel\b|\b(neck|wrist|hand|finger|ear)\b|woman|\bman\b|bust|close-up|velvet|fabric|(black|dark) (background|backdrop)|comparison|line-?up|\bstack|\bsizes?\b|passing (a |the )?diamond tester/i;

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

async function pickImage(item, product) {
  const imgs = (product.images || []).slice().sort((a, b) => a.position - b.position);
  const ov = OVERRIDES[item.id];
  if (ov && ov.image) {
    const img = imgs.find((i) => i.position === ov.image);
    if (!img) throw new Error('override image ' + ov.image + ' not found');
    return { img, crop: ov.crop || null, why: 'override' };
  }
  const variantTitle = {};
  (product.variants || []).forEach((v) => { variantTitle[v.id] = v.title; });
  const want = item.specs.metalCode === '925silver' ? 'silver' : 'gold';
  const tried = [];
  for (const img of imgs) {
    const label = (img.alt || '') + ' ' + (img.variant_ids || []).map((id) => variantTitle[id]).join(' ');
    const metal = imageMetal(img, variantTitle);
    if (REJECT_METAL.test(label) || (metal && metal !== want)) { tried.push('#' + img.position + ' metal'); continue; }
    if (REJECT_SCENE.test(img.alt || '')) { tried.push('#' + img.position + ' alt'); continue; }
    const light = lightBorderShare(await getImage(img.src, CHECK_W));
    if (light < LIGHT_MIN) { tried.push('#' + img.position + ' bg ' + light.toFixed(2)); continue; }
    return { img, crop: null, why: 'first passing image (bg ' + light.toFixed(2) + (tried.length ? '; skipped ' + tried.join(', ') : '') + ')' };
  }
  throw new Error('no product image passes the image rule (' + tried.join(', ') + ') — add a generate override');
}

// ─────────────────────────────────────────────────────────────────
// System.Drawing helpers (Windows, via temp PowerShell scripts)
// ─────────────────────────────────────────────────────────────────
const PS_RESIZE = path.join(os.tmpdir(), 'jwlz-resize-' + process.pid + '.ps1');
const PS_BORDER = path.join(os.tmpdir(), 'jwlz-border-' + process.pid + '.ps1');
function writePsScripts() {
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
  // Share of pixels on a frame 2% inside the edges that are white / very light
  // neutral (every channel >= 215, channel spread <= 30).
  fs.writeFileSync(PS_BORDER, [
    'param([string]$In)',
    'Add-Type -AssemblyName System.Drawing',
    '$img=New-Object System.Drawing.Bitmap($In)',
    '$w=$img.Width;$h=$img.Height;$n=0;$ok=0',
    '$ix=[int]($w*0.02);$iy=[int]($h*0.02)',
    'function T($c){$lo=[Math]::Min($c.R,[Math]::Min($c.G,$c.B));$hi=[Math]::Max($c.R,[Math]::Max($c.G,$c.B));return ($lo -ge 215 -and ($hi-$lo) -le 30)}',
    'for($x=$ix;$x -lt $w-$ix;$x+=2){foreach($y in @($iy,($h-1-$iy))){$n++;if(T $img.GetPixel($x,$y)){$ok++}}}',
    'for($y=$iy;$y -lt $h-$iy;$y+=2){foreach($x in @($ix,($w-1-$ix))){$n++;if(T $img.GetPixel($x,$y)){$ok++}}}',
    '$img.Dispose()',
    '[Console]::Out.Write(($ok/[Math]::Max(1,$n)).ToString([Globalization.CultureInfo]::InvariantCulture))',
  ].join('\n'), 'utf8');
}
function runPs(script, args) {
  return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script].concat(args),
    { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}
function lightBorderShare(rawBuf) {
  const tmp = path.join(os.tmpdir(), 'jwlz-check-' + process.pid + '.img');
  fs.writeFileSync(tmp, rawBuf);
  try { return parseFloat(runPs(PS_BORDER, ['-In', tmp])) || 0; }
  finally { try { fs.unlinkSync(tmp); } catch (e) {} }
}
function saveJpeg(rawBuf, outPath, crop) {
  const tmpRaw = outPath + '.raw';
  fs.writeFileSync(tmpRaw, rawBuf);
  const c = crop || { x: 0, y: 0, w: 1, h: 1 };
  try {
    runPs(PS_RESIZE, ['-In', tmpRaw, '-Out', outPath, '-Max', String(MAX_SIDE), '-Quality', String(JPEG_Q),
      '-CX', String(c.x), '-CY', String(c.y), '-CW', String(c.w), '-CH', String(c.h)]);
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
async function getImage(src, width) {
  // Ask the Shopify CDN for a JPEG at a workable size (System.Drawing can't read WebP).
  const url = src + (src.includes('?') ? '&' : '?') + 'width=' + (width || FETCH_W) + '&format=jpg';
  const res = await fetch(url, { headers: { 'Accept': 'image/jpeg' } });
  if (!res.ok) throw new Error('image HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2000) throw new Error('image too small (' + buf.length + 'b)');
  return buf;
}
// gen = the override's { seed, prompt? }; without a fixed prompt: item desc + shape + framing.
async function generateImage(item, gen) {
  const prompt = gen.prompt || [item.desc, GEN_SHAPE[item.type], GEN_FRAMING].filter(Boolean).join(' ');
  const res = await fetch(FLUX_WORKER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': ORIGIN },
    body: JSON.stringify({ prompt: prompt, image_size: 'square_hd', seed: gen.seed }),
  });
  if (!res.ok) throw new Error('Flux HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5000) throw new Error('generated image too small (' + buf.length + 'b)');
  return buf;
}

async function main() {
  const args  = process.argv.slice(2);
  const force = args.includes('--force');
  const oi    = args.indexOf('--only');
  const only  = oi !== -1 ? args[oi + 1] : null;
  const items = ITEMS.filter((it) => !only || it.id === only || it.category === only);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  writePsScripts();
  const done = [], skipped = [], failed = [];
  const productCache = {};

  for (const item of items) {
    const out = path.join(OUT_DIR, item.id + '.jpg');
    if (!force && fs.existsSync(out)) { skipped.push(item.id); continue; }
    try {
      const ov = OVERRIDES[item.id];
      if (ov && ov.generate) {
        saveJpeg(await generateImage(item, ov.generate), out, null);
        done.push(item.id);
        console.log('[gen] ', item.id.padEnd(12), '| metal:', item.specs.metalCode.padEnd(9), '| generated, seed', ov.generate.seed);
        await sleep(4500); // the worker allows 15 generations / min / IP
        continue;
      }
      const handle = handleOf(item);
      if (!handle) throw new Error('no product handle in sourceUrl');
      if (!productCache[handle]) {
        productCache[handle] = (await getJson('https://theparadisegems.com/products/' + handle + '.json')).product;
        await sleep(DELAY_MS);
      }
      const pick = await pickImage(item, productCache[handle]);
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
  try { fs.unlinkSync(PS_BORDER); } catch (e) {}

  console.log('\nSummary: saved', done.length, '| skipped (exists)', skipped.length, '| failed', failed.length,
    failed.length ? '(' + failed.join(', ') + ')' : '');
  if (failed.length) process.exitCode = 1;
}

main();

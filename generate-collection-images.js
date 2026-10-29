/*
 * generate-collection-images.js
 * ------------------------------------------------------------------
 * ONE-TIME generation of the collections.html gallery images.
 *
 * Catalogue: collections-data.js  (5 categories x 6 items = 30).
 * One image per item -> images/collections/<id>.jpg
 * (e.g. ring-01.jpg ... necklace-06.jpg)
 *
 * PIPELINE: the flux-image Cloudflare Worker (fal.ai Flux 2 Pro) — the same
 * worker + model the live AI Lab uses (FLUX_WORKER_URL in ailab.html).
 *   Flux worker -> https://flux-image.sarkd333.workers.dev
 *   Body: { prompt, image_size: 'square_hd' } only — Flux 2 Pro has no
 *   negative_prompt / guidance_scale. The worker allowlists origins, so every
 *   request carries  Origin: https://jwlzify.com.
 *   (API keys stay inside the Cloudflare worker — never embedded here.)
 *
 * Prompt = ONE affirmative paragraph, assembled the way ailab.html does:
 *   jewelry type + camera angle → metal → stones → one quality clause.
 *   Head-on rings, a closed single-loop bracelet, product-only flat-lay
 *   earrings (one earring — the AI Lab try-on mirrors it into the pair) and
 *   necklaces, all on a seamless white studio background. Colour is always
 *   explicit: white sterling silver / yellow gold, colourless brilliant white
 *   stones (same wording as the collections-data.js descriptions).
 *
 * Every output is resized to max 800px wide and re-encoded JPEG quality 80
 * (via Windows System.Drawing) so the page loads fast.
 *
 * Behaviour:
 *   - skips items whose image already exists (re-runs are cheap)
 *   - retries each worker call up to 3 times before giving up
 *   - ~1.5s delay between requests (the worker allows 15 req/min per IP)
 *   - end-of-run summary: generated / skipped / failed (+ failed ids) / worker calls
 *
 * Run:  node generate-collection-images.js
 *       node generate-collection-images.js --only ring          (one category)
 *       node generate-collection-images.js --only ring-04       (one item)
 *       node generate-collection-images.js --force              (regenerate all)
 * ------------------------------------------------------------------
 */

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ITEMS       = require('./collections-data.js');
const FLUX_WORKER = 'https://flux-image.sarkd333.workers.dev';
const ORIGIN      = 'https://jwlzify.com';
const IMAGE_SIZE  = 'square_hd';
const OUT_DIR     = path.join(__dirname, 'images', 'collections');
const MAX_WIDTH   = 800;
const JPEG_Q      = 80;
const MAX_RETRIES = 3;
const DELAY_MS    = 1500;

// ─────────────────────────────────────────────────────────────────
// Prompt fragments — colour wording matches the collections-data.js descriptions
// ─────────────────────────────────────────────────────────────────
const METAL_LOOK = {
  '925silver': 'bright polished white sterling silver',
  '10ctgold':  'rich yellow 10k gold',
  '14ctgold':  'rich yellow 14k gold',
};
const STONE_NOUN = { lab_diamond: 'lab diamond', moissanite_vvsd: 'moissanite', natural_diamond: 'natural diamond' };
const STONE_LOOK = 'colourless, brilliant white';

const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
function spell(n) { return NUM_WORDS[n] || String(n); }
function ct(n) { return (+n.toFixed(2)).toString(); }
// How one earring of each AI Lab form lies in the frame (try-on overlays it upright).
const EARRING_FORM_VIEW = {
  stud: 'the stud seen face-on with its stone facing the camera',
  hoop: 'the hoop lying as an upright circle with its closure at the top',
  drop: 'the drop hanging straight down from its ear wire at the top',
};

// Jewelry type + camera angle (one sentence). Head-on ring = the AI Lab's try-on view.
function subjectClause(item) {
  const s = item.specs;
  const style = s.style.toLowerCase();
  switch (item.type) {
    case 'ring':
      return `Professional product photograph of a single ${style} ring in a strict head-on front view, ` +
        `viewed perfectly straight on at eye level, the ${s.centreCt > 0 ? 'center stone facing' : 'set stones facing'} ` +
        `directly toward the viewer in the middle of the frame and the band curving downward symmetrically on the left and right sides.`;
    case 'bracelet':
      return `Professional product photograph of exactly one ${style} bracelet forming a single closed, unbroken loop, ` +
        `a wrist-sized bracelet about 6 centimetres across with a slender band only a few millimetres wide` +
        `${s.carats ? ' made of flexible hinged stone settings joined by a small box clasp' : ''}, ` +
        `standing upright and photographed from the front and slightly above so the whole band reads as one wide ` +
        `horizontal oval, the front of the band facing the camera, perfectly centered and symmetrical.`;
    case 'pendant':
      return `Professional close-up product photograph of a single ${style} pendant on its own, photographed in flat lay ` +
        `from directly above, centered with its bail at the top, slightly taller than it is wide ` +
        `(approximately 15mm wide by 20mm tall including the bail).`;
    case 'earrings':
      return `Professional product photograph of one single ${s.form} earring from a matching pair, shown alone as a ` +
        `product-only flat-lay photographed from directly above, ${EARRING_FORM_VIEW[s.form]}, centered in the frame.`;
    case 'necklace':
      return `Professional product photograph of a single ${style} necklace as a product-only flat-lay, laid flat and ` +
        `photographed from directly above, the chain arranged in a smooth symmetrical U-shape with both ends at the top ` +
        `of the frame, the whole necklace visible and centered.`;
    default:
      return `Professional product photograph of a single ${style} ${item.type}, front-facing and centered.`;
  }
}

// Stones (count stated once). Earrings describe the one rendered earring.
function stonesClause(item) {
  const s = item.specs;
  if (!s.carats) return 'a clean all-metal design with a smooth, highly polished finish';
  const gem = `${STONE_LOOK} ${STONE_NOUN[s.stoneType]}`;
  if (item.type === 'earrings') {
    const per = Math.round(s.stoneCount / 2);
    const each = ct(s.carats / s.stoneCount);
    return per === 1 ? `set with a single ${each} carat ${gem} stone`
      : `set with ${spell(per)} ${gem} stones of ${each} carat each`;
  }
  const accents = s.stoneCount - (s.centreCt > 0 ? 1 : 0);
  if (s.centreCt > 0 && accents === 0) return `set with a single ${ct(s.centreCt)} carat ${gem} center stone`;
  if (s.centreCt > 0) {
    return `set with a ${ct(s.centreCt)} carat ${gem} center stone accompanied by ${spell(accents)} smaller ${gem} accent stones`;
  }
  return `set with ${spell(s.stoneCount)} matching ${gem} stones of ${ct(s.carats / s.stoneCount)} carat each`;
}

function buildPrompt(item) {
  const piece = item.type === 'earrings' ? 'earring' : item.type;
  const look = METAL_LOOK[item.specs.metalCode];
  const oneMetal = item.specs.carats ? `every part including the prongs and settings in the same ${look}, ` : '';
  return `${subjectClause(item)} Crafted entirely in ${look}, ${oneMetal}${stonesClause(item)}. ` +
    `The single ${piece} is the sole subject, isolated on a seamless white studio background, soft even studio ` +
    `lighting, sharp macro focus, photorealistic luxury jewelry product photography.`;
}

// ─────────────────────────────────────────────────────────────────
// Flux worker call — returns raw image Buffer or throws.
// ─────────────────────────────────────────────────────────────────
let workerCalls = 0;
async function callFlux(prompt) {
  workerCalls++;
  const res = await fetch(FLUX_WORKER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': ORIGIN },
    body: JSON.stringify({ prompt: prompt, image_size: IMAGE_SIZE }),
  });
  if (!res.ok) throw new Error('Flux HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5000) throw new Error('blob too small (' + buf.length + 'b)');
  return buf;
}

// ─────────────────────────────────────────────────────────────────
// Resize/compress helper (Windows System.Drawing via a temp PowerShell script)
// ─────────────────────────────────────────────────────────────────
const PS_RESIZE = path.join(os.tmpdir(), 'jwlz-resize-' + process.pid + '.ps1');
function writeResizeScript() {
  fs.writeFileSync(PS_RESIZE, [
    'param([string]$In,[string]$Out,[int]$Max=800,[int]$Quality=80)',
    'Add-Type -AssemblyName System.Drawing',
    "$codec=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()|Where-Object{$_.MimeType -eq 'image/jpeg'}",
    '$ep=New-Object System.Drawing.Imaging.EncoderParameters(1)',
    '$ep.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,[long]$Quality)',
    '$img=[System.Drawing.Image]::FromFile($In)',
    '$w=$img.Width;$h=$img.Height',
    '$scale=[Math]::Min(1.0,$Max/[Math]::Max($w,$h))',
    '$nw=[int][Math]::Round($w*$scale);$nh=[int][Math]::Round($h*$scale)',
    '$bmp=New-Object System.Drawing.Bitmap($nw,$nh)',
    '$g=[System.Drawing.Graphics]::FromImage($bmp)',
    '$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic',
    '$g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::HighQuality',
    '$g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality',
    '$g.DrawImage($img,0,0,$nw,$nh)',
    '$g.Dispose();$img.Dispose()',
    '$bmp.Save($Out,$codec,$ep);$bmp.Dispose()',
  ].join('\n'), 'utf8');
}
function resizeToJpeg(rawBuf, outPath) {
  const tmpRaw = outPath + '.raw';
  fs.writeFileSync(tmpRaw, rawBuf);
  try {
    execFileSync('powershell', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS_RESIZE,
      '-In', tmpRaw, '-Out', outPath, '-Max', String(MAX_WIDTH), '-Quality', String(JPEG_Q),
    ], { stdio: 'pipe' });
  } finally {
    try { fs.unlinkSync(tmpRaw); } catch (e) {}
  }
}

// ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args  = process.argv.slice(2);
  const force = args.includes('--force');
  const onlyIx = args.indexOf('--only');
  const only  = onlyIx !== -1 ? args[onlyIx + 1] : null;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  writeResizeScript();

  let items = ITEMS;
  if (only) {
    items = ITEMS.filter((it) => it.id === only || it.category === only);
    if (!items.length) { console.error('Nothing matches --only ' + only); process.exit(1); }
  }

  const total = items.length;
  let generated = 0, skipped = 0, failed = 0;
  const failedIds = [];

  console.log('Flux generation of ' + total + ' images -> ' + OUT_DIR + '\n');

  let n = 0;
  for (const item of items) {
    n++;
    const outPath = path.join(OUT_DIR, item.id + '.jpg');
    const head = '[gen] ' + item.id + ' (' + n + '/' + total + ')';

    if (!force && fs.existsSync(outPath)) {
      console.log(head + ' ... skipped (already exists)');
      skipped++;
      continue;
    }

    const prompt = buildPrompt(item);
    console.log(head + ' prompt: ' + prompt);
    let raw = null, lastErr = '';
    for (let attempt = 1; attempt <= MAX_RETRIES && !raw; attempt++) {
      try {
        raw = await callFlux(prompt);
      } catch (e) {
        lastErr = e.message;
        console.log(head + ' ... attempt ' + attempt + '/' + MAX_RETRIES + ' failed (' + lastErr + ')');
        if (attempt < MAX_RETRIES) await sleep(2500);
      }
    }

    if (!raw) {
      console.log(head + ' ... FAILED after ' + MAX_RETRIES + ' attempts (' + lastErr + ')');
      failed++; failedIds.push(item.id);
      await sleep(DELAY_MS);
      continue;
    }

    try {
      resizeToJpeg(raw, outPath);
      const kb = Math.round(fs.statSync(outPath).size / 1024);
      console.log(head + ' ... done (' + MAX_WIDTH + 'px, ' + kb + 'kb)');
      generated++;
    } catch (e) {
      console.log(head + ' ... FAILED at resize (' + e.message + ')');
      failed++; failedIds.push(item.id);
    }

    await sleep(DELAY_MS);
  }

  try { fs.unlinkSync(PS_RESIZE); } catch (e) {}

  console.log('\n──────── Summary ────────');
  console.log('Generated: ' + generated);
  console.log('Skipped (already existed): ' + skipped);
  console.log('Failed: ' + failed);
  if (failedIds.length) console.log('Failed ids: ' + failedIds.join(', '));
  console.log('Worker calls this run: ' + workerCalls);
  console.log('Output dir: ' + OUT_DIR);
  process.exit(failed && generated === 0 && skipped === 0 ? 1 : 0);
}

if (require.main === module) main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
module.exports = { buildPrompt };

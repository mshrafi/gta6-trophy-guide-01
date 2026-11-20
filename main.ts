// Leonida Trophy Guide — hand-in program (Node 22, standard library only).
// The guide itself is plain static files in app/ (index.html, style.css, app.js and
// data/trophies.json); it opens in desktop Chrome with the network off and loads
// nothing from outside app/. This program copies app/ and screenshots/ into the
// grader's /output and writes /output/dossier.json with the kit's vendored
// buildDossier, byte for byte the same on every run. It never deletes the output
// directory itself — it only empties what is inside it, so a mounted /output
// survives the run. vendor/makefun-frontend.ts is the kit's copy, unchanged.
//
// Run it outside the grader with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Empty the output directory's contents (never the directory itself), and
// refuse outright if the output directory is the repo root itself.
function emptyOutputDir(dir: string): void {
  if (resolve(dir) === here) {
    throw new Error('MAKEFUN_OUTPUT_DIR must not be the repo root');
  }
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) {
    rmSync(join(dir, name), { recursive: true, force: true });
  }
}

emptyOutputDir(out);
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps: at most 4 screenshots, each at most 256 KiB; app/ at
// most 993 files and directories and 48 MiB. Only text_max_bytes shapes the
// dossier's bytes; the rest refuse an entry the scorer would refuse.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 50331648 }),
);

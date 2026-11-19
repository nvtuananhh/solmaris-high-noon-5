// EMBER COAST — gta6-01 round 14 entrypoint (written fresh this round).
// The game itself is plain static files under game/ (Three.js, offline, no build
// step). This program just hands it in: it copies game/ and screenshots/ beside
// this file into the output directory and writes dossier.json there, using the
// kit's vendored make.fun library for the dossier format.
//
// Local check: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output).
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// Gate limits from the scorer's reference (reference/gate.json): at most 4
// screenshots of at most 256 KiB each, at most 993 files / 48 MiB under game/,
// paths under game/ at most 1000 bytes, dossier text at most 163,840 bytes.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

// Token Radar's build: one sealed snapshot in, one ranked board, one dashboard and one dossier out.
//
//   node main.ts [--input <dir>] [--output <dir>]
//   MAKEFUN_INPUT_DIR / MAKEFUN_OUTPUT_DIR set the same paths.
//
// The input directory holds snapshot.json (DefiLlama's sealed snapshot of every
// protocol it tracks). The output directory gets board.json, data.js, a copy of
// dashboard/, a copy of screenshots/ and dossier.json, all written from the
// snapshot alone, so two runs write the same bytes. A run that cannot pass its
// own checks refuses: a board that misses the watchlist, a screenshot that is
// not a JPEG or PNG of the size the gate allows, or a dossier that does not
// match what the scorer's own buildDossier writes.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-board.ts';
import {
  MODEL,
  MODEL_VERSION,
  boardIssue,
  buildRadar,
  dataScript,
  parseSnapshot,
} from './lib/model.ts';

const REPO = dirname(fileURLToPath(import.meta.url));

/** The value of --name <value>, else process.env[NAME], else `fallback`. */
function arg(name: string, env: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1]!;
  return process.env[env] ?? fallback;
}

/** A file's size in bytes, or 0 when it is not there. */
function sizeOf(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

/** An image's width and height, from its PNG IHDR or its JPEG frame header. */
function imageSize(path: string): { width: number; height: number } | null {
  const b = readFileSync(path);
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) break;
      const marker = b[i + 1]!;
      if (marker === 0xc0 || marker === 0xc2) {
        return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      }
      const len = b.readUInt16BE(i + 2);
      if (len < 2) break;
      i += 2 + len;
    }
  }
  return null;
}

/** A dollar amount in whole dollars with commas. */
const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

/** The whole build. */
function main(): void {
  const inputDir = arg('input', 'MAKEFUN_INPUT_DIR', '/input');
  const outDir = arg('output', 'MAKEFUN_OUTPUT_DIR', 'out');

  const snapshot = parseSnapshot(readFileSync(join(inputDir, 'snapshot.json'), 'utf8'));
  const { board, radar } = buildRadar(snapshot, MODEL);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) throw new Error(`board: ${issue}`);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'board.json'), `${JSON.stringify(board, null, 2)}\n`);
  writeFileSync(join(outDir, 'data.js'), dataScript(radar));

  const dashSrc = join(REPO, 'dashboard');
  const shotsSrc = join(REPO, 'screenshots');
  if (!existsSync(dashSrc)) throw new Error('dashboard/ is missing from the repository');
  cpSync(dashSrc, join(outDir, 'dashboard'), { recursive: true });
  if (!existsSync(shotsSrc)) throw new Error('screenshots/ is missing from the repository');
  cpSync(shotsSrc, join(outDir, 'screenshots'), { recursive: true });

  // The screenshots the gate allows: 3 or 4, each a PNG or JPEG no larger than
  // 512 KiB, long side no more than 1440, short side at least 800.
  const shots = readdirSync(join(outDir, 'screenshots'))
    .filter((f) => !f.startsWith('.'))
    .sort();
  if (shots.length < 3 || shots.length > 4) throw new Error(`screenshots: ${shots.length} images, the gate allows 3 or 4`);
  for (const name of shots) {
    const path = join(outDir, 'screenshots', name);
    const size = sizeOf(path);
    if (size > 512 * 1024) throw new Error(`screenshots/${name} is ${size} bytes, over the 512 KiB the gate allows`);
    const dim = imageSize(path);
    if (dim === null) throw new Error(`screenshots/${name} is neither a PNG nor a JPEG`);
    const long = Math.max(dim.width, dim.height);
    const short = Math.min(dim.width, dim.height);
    if (long > 1440) throw new Error(`screenshots/${name} is ${dim.width}x${dim.height}, its long side is over 1440`);
    if (short < 800) throw new Error(`screenshots/${name} is ${dim.width}x${dim.height}, its short side is under 800`);
  }

  const dossier = buildDossier(outDir, { text_max_bytes: 65_536 });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  // The dossier the gate reads must be byte-identical to what buildDossier
  // writes from this output: build it a second time and compare.
  const again = buildDossier(outDir, { text_max_bytes: 65_536 });
  if (!Buffer.from(dossier).equals(Buffer.from(again))) throw new Error('dossier: a second build differs from the first');
  if (dossier.length > 1_572_864) throw new Error(`dossier: ${dossier.length} bytes, over the 1.5 MiB the gate allows`);

  const dashBytes = readdirSync(join(outDir, 'dashboard')).reduce((n, f) => n + sizeOf(join(outDir, 'dashboard', f)), 0);
  const covered = board.filter((r) => r.watchlist).length;
  console.log(`token radar (${MODEL_VERSION}): ${board.length} rows, watchlist ${covered}/${snapshot.watchlist.length}, as_of ${snapshot.as_of}`);
  for (const r of board.slice(0, 3)) console.log(`  #${r.rank} ${r.name} — ${money(r.implied_value_usd)} implied on ${money(r.tvl_usd)} TVL`);
  console.log(`  total implied value ${money(radar.total_implied_usd)}`);
  console.log(`  board.json ${sizeOf(join(outDir, 'board.json'))} bytes, data.js ${sizeOf(join(outDir, 'data.js'))} bytes`);
  console.log(`  dashboard/ ${dashBytes} bytes, dossier.json ${dossier.length} bytes`);
  for (const name of shots) {
    const dim = imageSize(join(outDir, 'screenshots', name))!;
    console.log(`  screenshots/${name} ${dim.width}x${dim.height}, ${sizeOf(join(outDir, 'screenshots', name))} bytes`);
  }
}

main();

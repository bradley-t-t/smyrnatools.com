#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const fg = require('fast-glob');

async function loadPrettier() {
  try {
    return require('prettier');
  } catch (e) {
    return null;
  }
}

function stripCssComments(input) {
  let out = '';
  let i = 0;
  const n = input.length;
  let inSingle = false;
  let inDouble = false;
  while (i < n) {
    const ch = input[i];
    const next = i + 1 < n ? input[i + 1] : '';
    if ((inSingle || inDouble) && ch === '\\') {
      out += ch;
      if (i + 1 < n) out += input[i + 1];
      i += 2;
      continue;
    }
    if (!inSingle && !inDouble && ch === '/' && next === '*') {
      const start = i;
      i += 2;
      let buf = '/*';
      let preserve = input[i] === '!';
      while (i < n) {
        if (input[i] === '*' && i + 1 < n && input[i + 1] === '/') {
          buf += '*/';
          i += 2;
          break;
        }
        buf += input[i];
        i++;
      }
      if (!preserve && /@license|@preserve/i.test(buf)) preserve = true;
      if (preserve) {
        out += buf;
      }
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      out += ch;
      i++;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      out += ch;
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function normalizeWhitespace(input) {
  const lf = input.replace(/\r\n?|\n/g, '\n');
  const noTrailing = lf
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/g, ''))
    .join('\n');
  return noTrailing.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true });
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry');
  const skipPrettier = args.has('--no-prettier');

  const root = process.cwd();
  const pattern = 'src/**/*.css';
  const files = await fg(pattern, { cwd: root, dot: false, onlyFiles: true, absolute: true });

  if (files.length === 0) {
    console.log('No CSS files found under src');
    process.exit(0);
  }

  const backupRoot = path.join(root, '.backups', `css-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  let changed = 0;

  const prettier = !skipPrettier ? await loadPrettier() : null;
  if (!skipPrettier && !prettier) {
    console.log('Prettier not found, continuing without formatting');
  }

  for (const abs of files) {
    const rel = path.relative(root, abs);
    const original = await fs.promises.readFile(abs, 'utf8');
    let next = original;

    next = stripCssComments(next);
    next = normalizeWhitespace(next);

    if (prettier) {
      try {
        next = prettier.format(next, { parser: 'css' });
      } catch (e) {
        console.warn(`Prettier failed on ${rel}: ${e.message}`);
      }
      next = normalizeWhitespace(next);
    }

    if (next !== original) {
      changed++;
      if (dryRun) {
        console.log(`[DRY] Would clean ${rel}`);
      } else {
        const backupPath = path.join(backupRoot, rel);
        await ensureDir(path.dirname(backupPath));
        await ensureDir(path.dirname(abs));
        await fs.promises.writeFile(backupPath, original, 'utf8');
        await fs.promises.writeFile(abs, next, 'utf8');
        console.log(`Cleaned ${rel}`);
      }
    }
  }

  const summary = dryRun
    ? `Dry run complete. Files that would change: ${changed}/${files.length}`
    : `Cleanup complete. Files changed: ${changed}/${files.length}. Backups at ${backupRoot}`;
  console.log(summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

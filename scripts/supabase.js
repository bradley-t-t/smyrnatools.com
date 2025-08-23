#!/usr/bin/env node
const {spawnSync} = require('child_process')
const {join} = require('path')
const fs = require('fs')

function exists(p) {
    try {
        return fs.existsSync(p)
    } catch (_) {
        return false
    }
}

function which(bin) {
    const r = spawnSync('which', [bin], {encoding: 'utf8'});
    if (r.status === 0) {
        const p = r.stdout.trim();
        if (p) return p
    }
    return null
}

function npmGlobalBin() {
    const r = spawnSync('npm', ['bin', '-g'], {encoding: 'utf8'});
    if (r.status === 0) {
        return r.stdout.trim()
    }
    return null
}

function findSupabase() {
    if (process.env.SUPABASE_BIN && exists(process.env.SUPABASE_BIN)) return process.env.SUPABASE_BIN
    const candidates = [
        '/opt/homebrew/bin/supabase',
        '/usr/local/bin/supabase'
    ]
    for (const c of candidates) {
        if (exists(c)) return c
    }
    const w = which('supabase');
    if (w) return w
    const g = npmGlobalBin();
    if (g) {
        const p = join(g, 'supabase');
        if (exists(p)) return p
    }
    return null
}

function run(bin, args) {
    return spawnSync(bin, args, {stdio: 'inherit', env: process.env})
}

function tryNpx(args) {
    return spawnSync('npx', ['-y', 'supabase', ...args], {stdio: 'inherit', env: process.env})
}

const args = process.argv.slice(2)
let bin = findSupabase()
let result
if (bin) {
    result = run(bin, args)
    if (typeof result.status === 'number') process.exit(result.status)
    process.exit(1)
} else {
    const r = tryNpx(args)
    if (typeof r.status === 'number') process.exit(r.status)
    console.error('Supabase CLI not found. Install with Homebrew or npm: brew install supabase/tap/supabase or npm i -g supabase')
    process.exit(1)
}


const fs = require('fs')
const path = require('path')
let sharp
try {
    sharp = require('sharp')
} catch (e) {
    console.log('sharp not installed')
}
const fg = require('fast-glob')

const srcDir = path.join(__dirname, '..', 'src', 'assets', 'images')
const sizes = [3840, 1920, 1280, 800]
const quality = 60

async function processFile(file) {
    if (!sharp) return
    const ext = path.extname(file).toLowerCase()
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) return
    const base = path.basename(file, ext)
    const dir = path.dirname(file)
    const stat = fs.statSync(file)
    for (const w of sizes) {
        const out = path.join(dir, `${base}@${w}.webp`)
        if (fs.existsSync(out)) {
            const oStat = fs.statSync(out)
            if (oStat.mtimeMs >= stat.mtimeMs) continue
        }
        try {
            const image = sharp(file)
            const meta = await image.metadata()
            if (meta.width && meta.width < w) continue
            await image.resize({width: w}).webp({quality}).toFile(out)
            console.log('generated', out)
        } catch (e) {
            console.log('err', e.message)
        }
    }
    const compressed = path.join(dir, `${base}.webp`)
    if (!fs.existsSync(compressed) || fs.statSync(compressed).mtimeMs < stat.mtimeMs) {
        try {
            await sharp(file).webp({quality: Math.min(75, quality + 10)}).toFile(compressed);
            console.log('generated', compressed)
        } catch (e) {
        }
    }
}

async function run() {
    if (!fs.existsSync(srcDir)) return
    const files = await fg(['**/*.{png,jpg,jpeg}'], {cwd: srcDir, absolute: true})
    for (const f of files) await processFile(f)
}

run()

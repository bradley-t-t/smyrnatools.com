import React, {useEffect, useMemo, useRef, useState} from 'react'
import {createPortal} from 'react-dom'

export default function ParticleBackground() {
    const [colors, setColors] = useState({accent: null, accentLight: null, accentDark: null, textPrimary: null})
    const [mounted, setMounted] = useState(false)
    const canvasRef = useRef(null)
    const rafRef = useRef(0)
    const dustRef = useRef([])
    const specksRef = useRef([])
    const paletteVersionRef = useRef(0)
    const tRef = useRef(0)

    const read = () => {
        const s = getComputedStyle(document.documentElement)
        return {
            accent: s.getPropertyValue('--accent').trim() || null,
            accentLight: s.getPropertyValue('--accent-light').trim() || null,
            accentDark: s.getPropertyValue('--accent-dark').trim() || null,
            textPrimary: s.getPropertyValue('--text-primary').trim() || null
        }
    }

    useEffect(() => {
        setColors(read())
        const observer = new MutationObserver(() => setColors(read()))
        observer.observe(document.documentElement, {attributes: true, attributeFilter: ['class']})
        setMounted(true)
        return () => observer.disconnect()
    }, [])

    const palette = useMemo(() => {
        const arr = [colors.accent, colors.accentLight, colors.accentDark, colors.textPrimary].filter(Boolean);
        return arr.length ? arr : null
    }, [colors])
    useEffect(() => {
        if (palette) paletteVersionRef.current++
    }, [palette])

    const scaleCanvas = (canvas) => {
        const dpr = window.devicePixelRatio || 1
        canvas.width = window.innerWidth * dpr
        canvas.height = window.innerHeight * dpr
        canvas.style.width = window.innerWidth + 'px'
        canvas.style.height = window.innerHeight + 'px'
        const ctx = canvas.getContext('2d')
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(dpr, dpr)
        return {w: window.innerWidth, h: window.innerHeight}
    }

    useEffect(() => {
        if (!mounted || !palette) return
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        let {w, h} = scaleCanvas(canvas)
        const dustCount = Math.min(260, Math.floor((w * h) / 9000))
        const speckCount = Math.min(100, Math.floor((w * h) / 32000))
        const rand = (a, b) => Math.random() * (b - a) + a
        const pick = () => palette[Math.floor(Math.random() * palette.length)]
        const init = () => {
            if (!dustRef.current.length) dustRef.current = Array.from({length: dustCount}).map(() => ({
                x: Math.random() * w,
                y: Math.random() * h,
                r: rand(0.8, 2.2),
                c: pick(),
                pv: paletteVersionRef.current
            }))
            if (!specksRef.current.length) specksRef.current = Array.from({length: speckCount}).map(() => ({
                x: Math.random() * w,
                y: Math.random() * h,
                r: rand(1.6, 3.8),
                c: pick(),
                pv: paletteVersionRef.current
            }))
        }
        init()
        const resize = () => {
            ({w, h} = scaleCanvas(canvas));
            dustRef.current = [];
            specksRef.current = [];
            init()
        }
        window.addEventListener('resize', resize)
        let lastT = performance.now()
        const step = (tn) => {
            const dt = Math.min(50, tn - lastT)
            lastT = tn
            tRef.current += dt * 0.0006
            ctx.clearRect(0, 0, w, h)
            const t = tRef.current
            const pv = paletteVersionRef.current
            const dust = dustRef.current
            for (let i = 0; i < dust.length; i++) {
                const p = dust[i]
                if (p.pv !== pv) {
                    p.c = pick();
                    p.pv = pv
                }
                const fx = Math.cos(p.y * 0.004 + t) * 0.35 + Math.sin(p.x * 0.002 - t * 1.3) * 0.18
                const fy = Math.sin(p.x * 0.003 + t * 0.7) * 0.28 + Math.cos(p.y * 0.002 - t * 1.1) * 0.12
                p.x += fx * dt * 0.6
                p.y += fy * dt * 0.6
                if (p.x < -12) p.x = w + 12; else if (p.x > w + 12) p.x = -12
                if (p.y < -12) p.y = h + 12; else if (p.y > h + 12) p.y = -12
            }
            const specks = specksRef.current
            for (let i = 0; i < specks.length; i++) {
                const s = specks[i]
                if (s.pv !== pv) {
                    s.c = pick();
                    s.pv = pv
                }
                const driftX = Math.cos(s.y * 0.0015 + t * 0.8) * 0.06
                const driftY = 0.03 + Math.sin(s.x * 0.001 + t) * 0.02
                s.x += driftX * dt
                s.y += driftY * dt
                if (s.x < -16) s.x = w + 16; else if (s.x > w + 16) s.x = -16
                if (s.y > h + 16) s.y = -16; else if (s.y < -16) s.y = h + 16
            }
            ctx.globalAlpha = 0.38
            for (let i = 0; i < dust.length; i++) {
                const p = dust[i];
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = p.c;
                ctx.fill()
            }
            ctx.globalAlpha = 0.42
            for (let i = 0; i < specks.length; i++) {
                const s = specks[i];
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = s.c;
                ctx.fill()
            }
            rafRef.current = requestAnimationFrame(step)
        }
        rafRef.current = requestAnimationFrame(step)
        return () => {
            cancelAnimationFrame(rafRef.current);
            window.removeEventListener('resize', resize)
        }
    }, [mounted, palette])

    if (!mounted) return null

    return createPortal(
        <canvas ref={canvasRef} aria-hidden="true" id="site-particles" style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 0,
            pointerEvents: 'none'
        }}/>, document.body
    )
}

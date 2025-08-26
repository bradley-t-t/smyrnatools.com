const ACRONYMS = new Set([
    'USA', 'CAT', 'KOMATSU', 'IT', 'ICS', 'OSHA', 'DOT', 'HVAC', 'PTO', 'ETA', 'ASAP', 'ID', 'API', 'CPU', 'GPU', 'SQL', 'KPI', 'QA', 'QC', 'ERP', 'CRM', 'GPS', 'VIN', 'SKU', 'PO', 'ETD', 'EOD', 'COB', 'FOB', 'RFID', 'HTTP', 'HTTPS', 'UPS', 'PPE', 'QAQC', 'OEM', 'OEE'
])

function normalizeWhitespace(text) {
    if (!text) return ''
    return String(text)
        .replace(/[\u00A0\t]+/g, ' ')
        .replace(/\s*\n\s*/g, '\n')
        .replace(/\s{2,}/g, ' ')
        .trim()
}

function splitIntoSegments(text) {
    if (!text) return []
    const withNormalizedNewlines = text.replace(/\r\n?/g, '\n')
    const parts = []
    let buffer = ''
    for (let i = 0; i < withNormalizedNewlines.length; i++) {
        const ch = withNormalizedNewlines[i]
        buffer += ch
        const isEnd = /[.!?]/.test(ch)
        if (isEnd) {
            const next = withNormalizedNewlines[i + 1] || ''
            if (/[\s\n]/.test(next) || next === '') {
                parts.push(buffer)
                buffer = ''
            }
        } else if (ch === '\n') {
            if (buffer.trim()) parts.push(buffer)
            buffer = ''
        }
    }
    if (buffer.trim()) parts.push(buffer)
    return parts
}

function mostlyUppercase(s) {
    const letters = s.replace(/[^A-Za-z]/g, '')
    if (!letters) return false
    const uppers = (letters.match(/[A-Z]/g) || []).length
    return uppers / letters.length >= 0.7
}

function restoreAcronyms(text) {
    return text.replace(/\b([A-Za-z]{2,6})\b/g, (m, w) => {
        const up = w.toUpperCase()
        if (ACRONYMS.has(up)) return up
        return m
    })
}

function sentenceCase(sentence) {
    let s = sentence.trim()
    if (!s) return ''
    if (mostlyUppercase(s)) s = s.toLowerCase()
    s = s.replace(/\s*([,;:])\s*/g, ' $1 ')
    s = s.replace(/\s{2,}/g, ' ').trim()
    s = s.replace(/\s+(\.)$/g, '$1')
    s = s.replace(/\s+([!?])$/g, '$1')
    s = s.replace(/^(\W*)([a-zA-Z])(.*)$/s, (_, p, c, rest) => p + c.toUpperCase() + rest)
    s = s.replace(/\b([A-Z]{3,})\b/g, w => (ACRONYMS.has(w) ? w : w.toLowerCase()))
    s = s.replace(/\b([A-Z]{2})\b/g, w => (ACRONYMS.has(w) ? w : w.toLowerCase()))
    s = restoreAcronyms(s)
    s = s.replace(/[!?]+$/g, '.')
    s = s.replace(/[,;:]$/g, '.')
    if (!/[.?!]$/.test(s)) s += '.'
    s = s.replace(/\s*\.(\s*\.)+/g, '.')
    return s
}

function cleanText(text) {
    const base = normalizeWhitespace(text)
    if (!base) return ''
    const segments = splitIntoSegments(base)
    return segments.map(sentenceCase).join(' ').replace(/\s{2,}/g, ' ').trim()
}

function cleanDescription(text) {
    return cleanText(text)
}

function cleanComments(text) {
    const t = typeof text === 'string' ? text : ''
    const lines = t.replace(/\r\n?/g, '\n').split('\n')
    const cleanedLines = lines.map(l => cleanText(l))
    return cleanedLines.join('\n').trim()
}

const GrammarUtility = {cleanDescription, cleanComments}

export default GrammarUtility
export {GrammarUtility, cleanText}

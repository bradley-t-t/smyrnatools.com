import {DateUtility} from './DateUtility'

const HistoryUtility = {
    buildChanges(entityId, fields, currentObj, newObj, userId, timestamps = true) {
        if (!entityId || !fields || !currentObj || !newObj) return [];
        const now = new Date().toISOString();
        return fields.reduce((acc, f) => {
            const oldVal = currentObj[f.field];
            const newVal = newObj[f.field];
            let o = oldVal, n = newVal;
            if (f.type === 'date') {
                o = o ? new Date(o).toISOString().split('T')[0] : null;
                n = n ? new Date(n).toISOString().split('T')[0] : null
            } else if (f.type === 'number') {
                o = o != null ? Number(o) : null;
                n = n != null ? Number(n) : null
            } else {
                if (o != null) o = o.toString().trim();
                if (n != null) n = n.toString().trim()
            }
            if (o !== n) {
                acc.push({
                    [f.entityIdColumn || 'equipment_id']: entityId,
                    field_name: f.dbField,
                    old_value: o != null ? o.toString() : null,
                    new_value: n != null ? n.toString() : null,
                    changed_at: timestamps ? now : DateUtility.toISO(now),
                    changed_by: userId || '00000000-0000-0000-0000-000000000000'
                });
            }
            return acc
        }, [])
    },
    areEquivalent(fieldName, oldValue, newValue) {
        const toIsoDay = (date) => date.toISOString().split('T')[0]
        const parseMonth = (name) => {
            const m = name.toLowerCase()
            if (m.startsWith('jan')) return 0
            if (m.startsWith('feb')) return 1
            if (m.startsWith('mar')) return 2
            if (m.startsWith('apr')) return 3
            if (m.startsWith('may')) return 4
            if (m.startsWith('jun')) return 5
            if (m.startsWith('jul')) return 6
            if (m.startsWith('aug')) return 7
            if (m.startsWith('sep')) return 8
            if (m.startsWith('oct')) return 9
            if (m.startsWith('nov')) return 10
            if (m.startsWith('dec')) return 11
            return null
        }
        const normalizeDate = (raw) => {
            if (raw === undefined || raw === null) return null
            let s = typeof raw === 'string' ? raw.trim() : raw
            if (typeof s !== 'string') {
                const d = new Date(s)
                return isNaN(d.getTime()) ? null : toIsoDay(d)
            }
            if (s === '') return null
            s = s.replace(/,/g, ' ')
            s = s.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1')
            if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)
            if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(s)) {
                const parts = s.split(/[/-]/)
                let m = parseInt(parts[0], 10) - 1
                let d = parseInt(parts[1], 10)
                let y = parseInt(parts[2], 10)
                if (y < 100) y += 2000
                const date = new Date(Date.UTC(y, m, d))
                return isNaN(date.getTime()) ? null : toIsoDay(date)
            }
            const mdy = s.match(/([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})/)
            if (mdy) {
                const mIdx = parseMonth(mdy[1])
                const d = parseInt(mdy[2], 10)
                const y = parseInt(mdy[3], 10)
                if (mIdx !== null) {
                    const date = new Date(Date.UTC(y, mIdx, d))
                    return isNaN(date.getTime()) ? null : toIsoDay(date)
                }
            }
            const dflt = new Date(s)
            return isNaN(dflt.getTime()) ? s : toIsoDay(dflt)
        }
        const norm = (field, val) => {
            if (val === undefined || val === null) return null
            let v = typeof val === 'string' ? val.trim() : val
            if (v === '') return null
            const f = String(field || '').toLowerCase()
            if (f.includes('date')) return normalizeDate(v)
            if (f.includes('rating') || f.includes('hours') || f.includes('mileage') || f.includes('year')) {
                const n = Number(v)
                return Number.isFinite(n) ? n : v
            }
            if (f.startsWith('has_') || f.startsWith('is_') || f.includes('verification')) {
                if (v === true || v === 'true' || v === 1 || v === '1') return true
                if (v === false || v === 'false' || v === 0 || v === '0') return false
            }
            if (f.startsWith('assigned_') || f.endsWith('_id') || f.includes('operator') || f.includes('tractor')) {
                if (v === '0' || v === 0) return null
            }
            return v
        }
        const a = norm(fieldName, oldValue)
        const b = norm(fieldName, newValue)
        return a === b
    }
}

export default HistoryUtility
export {HistoryUtility}

const ValidationUtility = {
    isUUID(v) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    }, requireUUID(v, msg = 'Invalid id') {
        if (!this.isUUID(v)) throw new Error(msg);
        return v
    }, requireId(v, msg = 'Id required') {
        if (v === undefined || v === null || v === '') throw new Error(msg);
        return v
    }, requireString(v, msg = 'Value required') {
        if (typeof v !== 'string' || !v.trim()) throw new Error(msg);
        return v.trim()
    }, optionalString(v) {
        return typeof v === 'string' ? v.trim() : v
    }, positiveInt(v, msg = 'Positive integer required') {
        const n = Number(v);
        if (!Number.isInteger(n) || n <= 0) throw new Error(msg);
        return n
    }, sanitizeObject(o, allowed) {
        if (!o || typeof o !== 'object') return {};
        const out = {};
        allowed.forEach(k => {
            if (o[k] !== undefined) out[k] = o[k]
        });
        return out
    }, isVIN(v) {
        if (typeof v !== 'string') return false
        const vin = v.trim().toUpperCase()
        if (vin.length !== 17) return false
        if (/[^A-Z0-9]/.test(vin)) return false
        if (/(NEED|UNKNOWN|PENDING|PLACEHOLDER)/.test(vin)) return false
        if (/^[A-Z0-9]$/.test(vin)) return false
        if (/^(.)\1{16}$/.test(vin)) return false
        return true
    }, requireVIN(v, msg = 'Invalid VIN') {
        if (!this.isVIN(v)) throw new Error(msg)
        return v.trim().toUpperCase()
    }
};
export default ValidationUtility;
export {ValidationUtility}

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
    }
};
export default ValidationUtility;
export {ValidationUtility}


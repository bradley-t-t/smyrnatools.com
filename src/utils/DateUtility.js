const DateUtility = {
    parse(d) {
        if (!d) return null;
        const date = d instanceof Date ? d : new Date(d);
        return isNaN(date.getTime()) ? null : date
    }, toDbTimestamp(d) {
        const date = this.parse(d);
        if (!date) return null;
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return `${y}-${m}-${day} ${h}:${min}:${s}+00`
    }, toISO(d) {
        const date = this.parse(d);
        return date ? date.toISOString() : null
    }, daysSince(d) {
        const date = this.parse(d);
        if (!date) return null;
        return Math.ceil((Date.now() - date.getTime()) / 86400000)
    }, isStale(d, ttlMs) {
        const date = this.parse(d);
        if (!date) return true;
        return Date.now() - date.getTime() > ttlMs
    }, nowDb() {
        return this.toDbTimestamp(new Date())
    }
};
export default DateUtility;
export {DateUtility}


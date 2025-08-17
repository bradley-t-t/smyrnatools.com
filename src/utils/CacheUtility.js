const CacheUtility = {
    caches: {},
    get(key) {
        const entry = this.caches[key]
        if (!entry) return null
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            delete this.caches[key]
            return null
        }
        return entry.value
    },
    set(key, value, ttlMs = 60000) {
        if (!key) throw new Error('Key required')
        const expiresAt = ttlMs > 0 ? Date.now() + ttlMs : 0
        this.caches[key] = { value, expiresAt }
        return value
    },
    has(key) {
        return this.get(key) !== null
    },
    delete(key) {
        delete this.caches[key]
    },
    clear() {
        this.caches = {}
    }
}

export default CacheUtility
export { CacheUtility }


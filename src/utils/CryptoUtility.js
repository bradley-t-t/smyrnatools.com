const HASH_TIMEOUT = 5000

const CryptoUtility = Object.freeze({
    async crypto(data) {
        if (!crypto?.subtle) {
            return CryptoUtility.hash(data)
        }
        try {
            const encoder = new TextEncoder()
            const dataBuffer = encoder.encode(typeof data === 'string' ? data : String(data))
            const hashPromise = crypto.subtle.digest('SHA-256', dataBuffer)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('SHA-256 hash timed out')), HASH_TIMEOUT))
            const hashBuffer = await Promise.race([hashPromise, timeoutPromise])
            return Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
        } catch {
            return CryptoUtility.hash(data)
        }
    },
    hash(data) {
        let hash = 5381
        for (let i = 0; i < data.length; i++) {
            hash = ((hash << 5) + hash) ^ data.charCodeAt(i)
        }
        let hex = (hash >>> 0).toString(16)
        while (hex.length < 64) hex += '0'
        return hex.slice(0, 64)
    },
    generateUUID() {
        return crypto.randomUUID()
    }
})

export default CryptoUtility
export { CryptoUtility }

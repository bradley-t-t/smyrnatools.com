import {CacheUtility} from '../utils/CacheUtility'

const VERSION_TTL = 60000

async function getVersion() {
    const cacheKey = 'app:version'
    const cached = CacheUtility.get(cacheKey)
    if (cached) return cached
    try {
        const res = await fetch('/version.json', {cache: 'no-store'})
        if (!res.ok) throw new Error('failed')
        const data = await res.json()
        const version = data.version || ''
        CacheUtility.set(cacheKey, version, VERSION_TTL)
        return version
    } catch {
        CacheUtility.set(cacheKey, '', VERSION_TTL)
        return ''
    }
}

export const AppService = {getVersion}
export default AppService

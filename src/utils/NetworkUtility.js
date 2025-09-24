const PING_TIMEOUT = 5000

const NetworkUtility = {
    isOnline() {
        return navigator.onLine
    },
    addOnlineListener(callback) {
        if (typeof callback !== 'function') return
        window.addEventListener('online', callback)
    },
    removeOnlineListener(callback) {
        if (typeof callback !== 'function') return
        window.removeEventListener('online', callback)
    },
    addOfflineListener(callback) {
        if (typeof callback !== 'function') return
        window.addEventListener('offline', callback)
    },
    removeOfflineListener(callback) {
        if (typeof callback !== 'function') return
        window.removeEventListener('offline', callback)
    },
    addNetworkListeners(onlineCallback, offlineCallback) {
        if (!onlineCallback || !offlineCallback) throw new Error('Callbacks are required')
        window.addEventListener('online', onlineCallback)
        window.addEventListener('offline', offlineCallback)
        return () => {
            window.removeEventListener('online', onlineCallback)
            window.removeEventListener('offline', offlineCallback)
        }
    },
    async checkConnection() {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT)
        try {
            await fetch('https://clients3.google.com/generate_204', {
                method: 'GET',
                mode: 'no-cors',
                cache: 'no-store',
                signal: controller.signal,
                credentials: 'omit'
            })
            clearTimeout(timeoutId)
            return true
        } catch {
        }
        try {
            const res = await fetch(`/version.json?cb=${Date.now()}`, {
                method: 'GET',
                cache: 'reload',
                signal: controller.signal
            })
            clearTimeout(timeoutId)
            return !!res?.ok
        } catch {
            clearTimeout(timeoutId)
            return false
        }
    }
}

export default NetworkUtility
export {NetworkUtility}

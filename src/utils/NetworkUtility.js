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
        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT)
            const response = await fetch('/ping', {
                method: 'HEAD',
                signal: controller.signal,
                cache: 'no-store'
            })
            clearTimeout(timeoutId)
            return response.ok
        } catch (error) {
            return false
        }
    }
}

export default NetworkUtility
export { NetworkUtility }

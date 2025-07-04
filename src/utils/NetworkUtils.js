/**
 * Network utility functions
 */
export class NetworkUtils {
    /**
     * Check if the device is online
     */
    static isOnline() {
        return navigator.onLine;
    }

    /**
     * Add network status event listeners
     */
    static addNetworkListeners(onlineCallback, offlineCallback) {
        window.addEventListener('online', onlineCallback);
        window.addEventListener('offline', offlineCallback);

        return () => {
            window.removeEventListener('online', onlineCallback);
            window.removeEventListener('offline', offlineCallback);
        };
    }

    /**
     * Check connection with a ping
     */
    static async checkConnection() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch('/ping', {
                method: 'HEAD',
                signal: controller.signal,
                cache: 'no-store'
            });

            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            console.log('Connection check failed:', error.message);
            return false;
        }
    }
}

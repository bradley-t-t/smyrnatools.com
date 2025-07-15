const PING_TIMEOUT = 5000;

export class NetworkUtility {
    static isOnline() {
        return navigator.onLine;
    }

    static addNetworkListeners(onlineCallback, offlineCallback) {
        if (!onlineCallback || !offlineCallback) throw new Error('Callbacks are required');

        window.addEventListener('online', onlineCallback);
        window.addEventListener('offline', offlineCallback);

        return () => {
            window.removeEventListener('online', onlineCallback);
            window.removeEventListener('offline', offlineCallback);
        };
    }

    static async checkConnection() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT);

            const response = await fetch('/ping', {
                method: 'HEAD',
                signal: controller.signal,
                cache: 'no-store'
            });

            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            console.error('Connection check failed:', error.message);
            return false;
        }
    }
}
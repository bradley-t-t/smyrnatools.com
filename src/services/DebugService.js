/**
 * Utility for debugging purposes
 */
export class DebugService {
    static logError(location, message, error) {
        console.error(`[${location}] ${message}`, error);
        // Store errors for debugging
        this.storeDebugInfo('error', location, {message, error});
    }

    static logWarning(location, message, data = {}) {
        console.warn(`[${location}] ${message}`, data);
        this.storeDebugInfo('warning', location, {message, data});
    }

    static logInfo(location, message, data = {}) {
        console.log(`[${location}] ${message}`, data);
        this.storeDebugInfo('info', location, {message, data});
    }

    static storeDebugInfo(level, location, data) {
        try {
            // Initialize debug log in window object if it doesn't exist
            if (!window.appDebugLog) {
                window.appDebugLog = [];
            }

            // Add entry with timestamp and keep only last 100 entries
            window.appDebugLog.push({
                timestamp: new Date().toISOString(),
                level,
                location,
                data
            });

            // Keep log size reasonable
            if (window.appDebugLog.length > 100) {
                window.appDebugLog = window.appDebugLog.slice(-100);
            }
        } catch (e) {
            console.error('Error storing debug info:', e);
        }
    }

    static getDebugLog() {
        return window.appDebugLog || [];
    }

    static clearDebugLog() {
        window.appDebugLog = [];
    }

    static getDebugSummary() {
        try {
            return {
                timestamp: new Date().toISOString(),
                url: window.location.href,
                userAgent: navigator.userAgent,
                screenSize: `${window.innerWidth}x${window.innerHeight}`,
                cachedTractorsCount: localStorage.getItem('cachedTractors') ?
                    JSON.parse(localStorage.getItem('cachedTractors')).length : 0,
                lastTractorDebug: window.lastTractorDebug || null,
                recentLogs: this.getDebugLog().slice(-10) // Last 10 logs
            };
        } catch (e) {
            console.error('Error generating debug summary:', e);
            return {error: e.message};
        }
    }

    static logInfo(location, message, data = null) {
        console.log(`[${location}] ${message}`, data || '');
    }

    static checkServiceAvailability() {
        try {
            const services = {
                // Add all services you want to check
                UserService: require('./UserService').UserService !== undefined,
                UserServiceSingleton: require('./UserServiceSingleton').UserService !== undefined,
            };

            console.log('Service availability check:', services);
            return services;
        } catch (error) {
            console.error('Error checking services:', error);
            return {error: error.message};
        }
    }
}

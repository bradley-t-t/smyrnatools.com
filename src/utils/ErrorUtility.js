const ERROR_LOG_LIMIT = 20

const ErrorUtility = {
    logError(source, error, context = {}) {
        if (!source || !error) throw new Error('Source and error are required')
        const errorId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
        console.error(`[${source}] Error ${errorId}:`, error)
        if (Object.keys(context).length) console.error(`Context for error ${errorId}:`, context)
        try {
            const errorLog = {
                id: errorId,
                timestamp: new Date().toISOString(),
                source,
                message: error.message,
                stack: error.stack,
                context
            }
            const existingLogs = JSON.parse(localStorage.getItem('app_error_logs') || '[]')
            existingLogs.push(errorLog)
            if (existingLogs.length > ERROR_LOG_LIMIT) existingLogs.shift()
            localStorage.setItem('app_error_logs', JSON.stringify(existingLogs))
        } catch (e) {}
        return errorId
    },
    parseSupabaseError(error) {
        if (!error) return {message: 'Unknown error'}
        return {
            message: error.message || 'Unknown error',
            code: error.code,
            details: error.details,
            hint: error.hint,
            formatted: `${error.message}${error.hint ? ` (Hint: ${error.hint})` : ''}`
        }
    },
    getStoredLogs() {
        try {
            return JSON.parse(localStorage.getItem('app_error_logs') || '[]')
        } catch (e) {
            return []
        }
    },
    clearLogs() {
        localStorage.removeItem('app_error_logs')
    }
}

export default ErrorUtility
export { ErrorUtility }

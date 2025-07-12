/**
 * ErrorLogger - Utility for consistent error logging and debugging
 */
export class ErrorLogger {
  /**
   * Log an error with consistent formatting and store for debugging
   * @param {string} source - Where the error occurred
   * @param {Error} error - The error object
   * @param {Object} [context] - Additional context data
   * @returns {string} - Error ID for reference
   */
  static logError(source, error, context = {}) {
    // Generate a unique error ID
    const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    // Format a detailed log
    console.error(`[${source}] Error ${errorId}:`, error);
    if (Object.keys(context).length > 0) {
      console.error(`Context for error ${errorId}:`, context);
    }

    // Store in localStorage for debugging
    try {
      const errorLog = {
        id: errorId,
        timestamp: new Date().toISOString(),
        source,
        message: error.message,
        stack: error.stack,
        context
      };

      // Append to existing logs
      const existingLogs = JSON.parse(localStorage.getItem('app_error_logs') || '[]');
      existingLogs.push(errorLog);

      // Keep only the last 20 errors to avoid filling localStorage
      if (existingLogs.length > 20) {
        existingLogs.shift(); // Remove oldest
      }

      localStorage.setItem('app_error_logs', JSON.stringify(existingLogs));
    } catch (e) {
      console.error('Failed to store error log:', e);
    }

    return errorId;
  }

  /**
   * Extract useful information from a Supabase error
   * @param {Error} error - The error from Supabase
   * @returns {Object} - Structured error details
   */
  static parseSupabaseError(error) {
    if (!error) return { message: 'Unknown error' };

    // Extract the most useful information
    return {
      message: error.message || 'Unknown error',
      code: error.code,
      details: error.details,
      hint: error.hint,
      formatted: `${error.message}${error.hint ? ` (Hint: ${error.hint})` : ''}`
    };
  }

  /**
   * Get all stored error logs
   * @returns {Array} - Array of error log objects
   */
  static getStoredLogs() {
    try {
      return JSON.parse(localStorage.getItem('app_error_logs') || '[]');
    } catch (e) {
      console.error('Failed to retrieve error logs:', e);
      return [];
    }
  }

  /**
   * Clear all stored error logs
   */
  static clearLogs() {
    localStorage.removeItem('app_error_logs');
  }
}

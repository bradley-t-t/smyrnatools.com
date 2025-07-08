/**
 * Utility functions for standardized error handling throughout the application
 */

/**
 * Checks if a UUID string is valid
 * @param {string} id - The UUID to validate
 * @returns {boolean} - Whether the UUID is valid
 */
export function isValidUUID(id) {
  if (!id) return false;

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(id);
}

/**
 * Logs an error with standardized format
 * @param {string} context - Where the error occurred
 * @param {Error|string} error - The error object or message
 * @param {Object} [additionalInfo] - Any additional contextual information
 */
export function logError(context, error, additionalInfo = {}) {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : null;

  console.error(`Error in ${context}: ${errorMessage}`, {
    ...additionalInfo,
    stack: errorStack
  });
}

/**
 * Handles Supabase database errors with standard formatting
 * @param {string} operation - What operation was being performed
 * @param {Object} error - The Supabase error object
 * @param {Object} [metadata] - Additional information about the operation
 * @returns {string} User-friendly error message
 */
export function handleDatabaseError(operation, error, metadata = {}) {
  if (!error) return 'Unknown database error';

  // Log the detailed error for debugging
  console.error(`Database error during ${operation}:`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
    metadata
  });

  // Specific error handling for common cases
  if (error.code === 'PGRST116') {
    return 'The requested record was not found in the database';
  }

  if (error.code === '23505') {
    return 'A record with this information already exists';
  }

  if (error.code === '42P01') {
    return 'System error: Database table not found';
  }

  if (error.code === '42501') {
    return 'You don\'t have permission to perform this operation';
  }

  // Return a user-friendly message
  return `Database error: ${error.message || 'Unknown error'}`;
}

/**
 * Shows a standardized error alert to the user
 * @param {string} message - The error message to display
 * @param {string} [title] - Optional title for the error
 */
export function showErrorAlert(message, title = 'Error') {
  // For now just use alert, but this could be replaced with a modal
  alert(`${title}: ${message}`);
}

/**
 * Checks if a mixer exists in the database
 * @param {string} mixerId - The mixer ID to check
 * @returns {Promise<boolean>} - Whether the mixer exists
 */
export async function checkMixerExists(mixerId, supabase) {
  if (!isValidUUID(mixerId)) return false;

  try {
    const { data, error } = await supabase
      .from('mixers')
      .select('id')
      .eq('id', mixerId)
      .single();

    return !error && data !== null;
  } catch (error) {
    logError('checkMixerExists', error, { mixerId });
    return false;
  }
}

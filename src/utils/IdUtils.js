/**
 * Utilities for working with IDs
 */

/**
 * Generate a 5-digit employee ID from a UUID
 * @param {string} uuid - The UUID to convert
 * @returns {string} - A 5-digit employee ID
 */
export function generateEmployeeIdFromUUID(uuid) {
    if (!uuid) return null;

    // Remove dashes and use as a hash seed
    const cleanUuid = uuid.replace(/-/g, '');

    // Create a simple numeric hash from the UUID
    let hash = 0;
    for (let i = 0; i < cleanUuid.length; i++) {
        const char = cleanUuid.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    // Make sure it's positive and get 5 digits
    hash = Math.abs(hash) % 100000;

    // Pad with leading zeros if needed
    return hash.toString().padStart(5, '0');
}

/**
 * Generate a random 5-digit employee ID
 * @returns {string} - A 5-digit employee ID
 */
export function generateRandomEmployeeId() {
    const randomNumber = Math.floor(Math.random() * 100000);
    return randomNumber.toString().padStart(5, '0');
}

/**
 * Format an employee ID with a specific format (e.g., adding prefix)
 * @param {string} employeeId - The raw employee ID
 * @returns {string} - Formatted employee ID
 */
export function formatEmployeeId(employeeId) {
    if (!employeeId) return '';
    return `EMP${employeeId}`;
}

/**
 * Unformat an employee ID to get just the numeric part
 * @param {string} formattedId - The formatted employee ID
 * @returns {string} - Numeric part of the employee ID
 */
export function unformatEmployeeId(formattedId) {
    if (!formattedId) return '';
    return formattedId.replace(/^EMP/, '');
}

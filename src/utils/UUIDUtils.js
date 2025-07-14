/**
 * UUID generation utility that uses the most secure method available in the environment
 */

/**
 * Generates a RFC 4122 version 4 compliant UUID using the best available method
 * - Uses crypto.randomUUID() if available (modern browsers and Node.js 14.17+)
 * - Falls back to a secure polyfill if crypto.randomUUID is not available
 *
 * @returns {string} A valid UUID v4 string
 */
export function generateUUID() {
    // First choice: Use native crypto.randomUUID if available (most secure)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Second choice: Use crypto.getRandomValues if available
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        // Create typed array of required size
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);

        // Set version bits
        arr[6] = (arr[6] & 0x0f) | 0x40;    // Version 4
        arr[8] = (arr[8] & 0x3f) | 0x80;    // Variant RFC4122

        // Convert to hex string
        return [
            byteToHex(arr[0]), byteToHex(arr[1]),
            byteToHex(arr[2]), byteToHex(arr[3]), '-',
            byteToHex(arr[4]), byteToHex(arr[5]), '-',
            byteToHex(arr[6]), byteToHex(arr[7]), '-',
            byteToHex(arr[8]), byteToHex(arr[9]), '-',
            byteToHex(arr[10]), byteToHex(arr[11]),
            byteToHex(arr[12]), byteToHex(arr[13]),
            byteToHex(arr[14]), byteToHex(arr[15])
        ].join('');
    }

    // Last resort fallback (less secure, only if crypto is completely unavailable)
    console.warn('Secure UUID generation is not available - using fallback method');
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Helper function to convert a byte to a two-character hex string
 */
function byteToHex(byte) {
    return ('0' + byte.toString(16)).slice(-2);
}

/**
 * Validates if a string is a valid UUID v4
 * @param {string} uuid - The UUID string to validate
 * @returns {boolean} True if the UUID is valid
 */
export function isValidUUID(uuid) {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
}

/**
 * Safely handles UUID values for database operations
 * @param {string|null} uuid - The UUID string or empty value
 * @returns {null} Returns null for empty values to ensure proper SQL type compatibility
 */
export function safeUUID(uuid) {
    if (!uuid || uuid === '' || uuid === '0') {
        return null;
    }
    return uuid;
}

export function generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        arr[6] = (arr[6] & 0x0f) | 0x40;
        arr[8] = (arr[8] & 0x3f) | 0x80;
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

    console.warn('Secure UUID generation unavailable, using fallback');
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function byteToHex(byte) {
    return byte.toString(16).padStart(2, '0');
}

export function isValidUUID(uuid) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

export function safeUUID(uuid) {
    return (!uuid || uuid === '' || uuid === '0') ? null : uuid;
}
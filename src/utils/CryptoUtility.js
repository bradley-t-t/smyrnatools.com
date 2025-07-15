const HASH_TIMEOUT = 5000;

export async function sha256Hash(data) {
    if (!crypto?.subtle) {
        console.warn('Web Crypto API unavailable, using fallback');
        return simpleHash(data);
    }

    try {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashPromise = crypto.subtle.digest('SHA-256', dataBuffer);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SHA-256 hash timed out')), HASH_TIMEOUT));
        const hashBuffer = await Promise.race([hashPromise, timeoutPromise]);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    } catch (error) {
        console.error('Error generating SHA-256 hash:', error);
        return simpleHash(data);
    }
}

function simpleHash(data) {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return (hash >>> 0).toString(16).padStart(64, '0');
}

export function generateUUID() {
    return crypto.randomUUID();
}
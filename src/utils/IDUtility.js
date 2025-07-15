export function generateEmployeeIdFromUUID(uuid) {
    if (!uuid) return null;

    const cleanUuid = uuid.replace(/-/g, '');
    let hash = 0;
    for (let i = 0; i < cleanUuid.length; i++) {
        const char = cleanUuid.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash &= hash;
    }

    return Math.abs(hash % 100000).toString().padStart(5, '0');
}

export function generateRandomEmployeeId() {
    return Math.floor(Math.random() * 100000).toString().padStart(5, '0');
}

export function formatEmployeeId(employeeId) {
    return employeeId ? `EMP${employeeId}` : '';
}

export function unformatEmployeeId(formattedId) {
    return formattedId ? formattedId.replace(/^EMP/, '') : '';
}
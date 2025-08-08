const uuidUtility = {
    generateUUID() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID()
        }
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
            const arr = new Uint8Array(16)
            crypto.getRandomValues(arr)
            arr[6] = (arr[6] & 0x0f) | 0x40
            arr[8] = (arr[8] & 0x3f) | 0x80
            return [
                uuidUtility._byteToHex(arr[0]), uuidUtility._byteToHex(arr[1]),
                uuidUtility._byteToHex(arr[2]), uuidUtility._byteToHex(arr[3]), '-',
                uuidUtility._byteToHex(arr[4]), uuidUtility._byteToHex(arr[5]), '-',
                uuidUtility._byteToHex(arr[6]), uuidUtility._byteToHex(arr[7]), '-',
                uuidUtility._byteToHex(arr[8]), uuidUtility._byteToHex(arr[9]), '-',
                uuidUtility._byteToHex(arr[10]), uuidUtility._byteToHex(arr[11]),
                uuidUtility._byteToHex(arr[12]), uuidUtility._byteToHex(arr[13]),
                uuidUtility._byteToHex(arr[14]), uuidUtility._byteToHex(arr[15])
            ].join('')
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
        })
    },

    _byteToHex(byte) {
        return byte.toString(16).padStart(2, '0')
    },

    isValidUUID(uuid) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)
    },

    safeUUID(uuid) {
        return (!uuid || uuid === '' || uuid === '0') ? null : uuid
    }
}

export const generateUUID = uuidUtility.generateUUID
export default uuidUtility

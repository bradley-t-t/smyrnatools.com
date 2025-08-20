import APIUtility from './APIUtility'

const CRYPTO_UTILITY_FUNCTION = '/crypto-utility'

const CryptoUtility = Object.freeze({
    async crypto(data) {
        const {res, json} = await APIUtility.post(`${CRYPTO_UTILITY_FUNCTION}/hash`, { data })
        return res.ok && json.hash ? json.hash : ''
    },
    async generateUUID() {
        const {res, json} = await APIUtility.post(`${CRYPTO_UTILITY_FUNCTION}/uuid`)
        return res.ok && json.uuid ? json.uuid : ''
    },
    async generateSalt(length = 16) {
        const {res, json} = await APIUtility.post(`${CRYPTO_UTILITY_FUNCTION}/generate-salt`, { length })
        return res.ok && json.salt ? json.salt : ''
    },
    async hashPassword(password, salt) {
        const {res, json} = await APIUtility.post(`${CRYPTO_UTILITY_FUNCTION}/hash-password`, { password, salt })
        return res.ok && json.hash ? json.hash : ''
    },
    async batchHash(items) {
        const {res, json} = await APIUtility.post(`${CRYPTO_UTILITY_FUNCTION}/batch-hash`, { items })
        return res.ok && json.results ? json.results : []
    }
})

export default CryptoUtility
export {CryptoUtility}

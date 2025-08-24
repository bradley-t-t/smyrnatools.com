const VerifiedUtility = {
    isVerified(updatedLast, updatedAt, updatedBy) {
        if (!updatedLast || !updatedBy) return false
        try {
            const lastVerified = new Date(updatedLast)
            const lastUpdated = new Date(updatedAt)
            const now = new Date()
            if (lastUpdated > lastVerified) return false
            const getMostRecentMonday5pmCST = (date) => {
                const CST_OFFSET = -6
                const d = new Date(date)
                const utcDay = d.getUTCDay()
                const diff = (utcDay + 6) % 7
                d.setUTCDate(d.getUTCDate() - diff)
                d.setUTCHours(17 - CST_OFFSET, 0, 0, 0)
                if (d > date) d.setUTCDate(d.getUTCDate() - 7)
                return d
            }
            const mostRecentMonday5pmCST = getMostRecentMonday5pmCST(now)
            return lastVerified > mostRecentMonday5pmCST
        } catch {
            return false
        }
    }
}

export default VerifiedUtility


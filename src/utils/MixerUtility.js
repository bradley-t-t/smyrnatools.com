const mixerUtility = {
    isServiceOverdue(serviceDate) {
        if (!serviceDate) return false
        try {
            const service = new Date(serviceDate)
            const today = new Date()
            const diffDays = Math.ceil((today - service) / (1000 * 60 * 60 * 24))
            return diffDays > 30
        } catch (error) {
            return false
        }
    },
    isChipOverdue(chipDate) {
        if (!chipDate) return false
        try {
            const chip = new Date(chipDate)
            const today = new Date()
            const diffDays = Math.ceil((today - chip) / (1000 * 60 * 60 * 24))
            return diffDays > 90
        } catch (error) {
            return false
        }
    },
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
        } catch (error) {
            return false
        }
    },
    formatDate(date) {
        if (!date) return 'Not available'
        try {
            return new Date(date).toLocaleDateString()
        } catch (error) {
            return 'Invalid date'
        }
    },
    getStatusCounts(mixers) {
        if (!Array.isArray(mixers)) return {}
        const counts = {Total: mixers.length, Active: 0, Spare: 0, 'In Shop': 0, Retired: 0}
        mixers.forEach(mixer => {
            const status = mixer.status || 'Unknown'
            if (['Active', 'Spare', 'In Shop', 'Retired'].includes(status)) counts[status]++
        })
        return counts
    },
    getPlantCounts(mixers) {
        if (!Array.isArray(mixers)) return {}
        return mixers.reduce((counts, mixer) => {
            const plant = mixer.assignedPlant || 'Unassigned'
            counts[plant] = (counts[plant] || 0) + 1
            return counts
        }, {})
    },
    getCleanlinessAverage(mixers) {
        if (!Array.isArray(mixers) || !mixers.length) return 'N/A'
        const ratings = mixers
            .filter(m => m.cleanlinessRating != null)
            .map(m => Number(m.cleanlinessRating))
        return ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : 'N/A'
    },
    getNeedServiceCount(mixers) {
        if (!Array.isArray(mixers)) return 0
        return mixers.filter(mixer => mixerUtility.isServiceOverdue(mixer.lastServiceDate)).length
    }
}

export default mixerUtility

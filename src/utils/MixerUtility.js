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
        const useHardcodedDate = false
        const hardcodedToday = new Date('2024-07-30T00:00:00Z')
        if (!updatedLast || !updatedBy) return false
        try {
            const lastVerified = new Date(updatedLast)
            const lastUpdated = new Date(updatedAt)
            const today = useHardcodedDate ? hardcodedToday : new Date()
            if (lastUpdated > lastVerified) return false
            const checkForMonday = (start, end) => {
                const current = new Date(start)
                current.setDate(current.getDate() + 1)
                while (current <= end) {
                    if (current.getDay() === 1) return true
                    current.setDate(current.getDate() + 1)
                }
                return false
            }
            return !checkForMonday(lastVerified, today)
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

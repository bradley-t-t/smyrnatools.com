const TractorUtility = {
    isServiceOverdue(serviceDate) {
        if (!serviceDate) return false
        try {
            const service = new Date(serviceDate)
            const today = new Date()
            const diffDays = Math.ceil((today - service) / (1000 * 60 * 60 * 24))
            return diffDays > 30
        } catch {
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
        } catch {
            return false
        }
    },

    formatDate(date) {
        if (!date) return 'Not available'
        try {
            return new Date(date).toLocaleDateString()
        } catch {
            return 'Invalid date'
        }
    },

    getStatusCounts(tractors) {
        if (!Array.isArray(tractors)) return {}
        const counts = {Total: tractors.length, Active: 0, Spare: 0, 'In Shop': 0, Retired: 0}
        tractors.forEach(tractor => {
            const status = tractor.status || 'Unknown'
            if (['Active', 'Spare', 'In Shop', 'Retired'].includes(status)) counts[status]++
        })
        return counts
    },

    getPlantCounts(tractors) {
        if (!Array.isArray(tractors)) return {}
        return tractors.reduce((counts, tractor) => {
            const plant = tractor.assignedPlant || 'Unassigned'
            counts[plant] = (counts[plant] || 0) + 1
            return counts
        }, {})
    },

    getCleanlinessAverage(tractors) {
        if (!Array.isArray(tractors) || !tractors.length) return 'N/A'
        const ratings = tractors
            .filter(m => m.cleanlinessRating != null)
            .map(m => Number(m.cleanlinessRating))
        return ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : 'N/A'
    },

    getNeedServiceCount(tractors) {
        if (!Array.isArray(tractors)) return 0
        return tractors.filter(tractor => TractorUtility.isServiceOverdue(tractor.lastServiceDate)).length
    }
}

export default TractorUtility
export {TractorUtility}

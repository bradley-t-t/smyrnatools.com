export const TrailerUtility = {
    isVerified(updatedLast, updatedAt, updatedBy, latestHistoryDate = null) {
        if (!updatedLast || !updatedBy) return false;
        const lastVerification = new Date(updatedLast);
        const lastUpdate = new Date(updatedAt);
        const lastHistory = latestHistoryDate ? new Date(latestHistoryDate) : null;
        const now = new Date();
        const lastSunday = new Date(now);
        lastSunday.setDate(now.getDate() - now.getDay());
        lastSunday.setHours(0, 0, 0, 0);
        if (lastHistory && lastHistory > lastVerification) return false;
        return lastUpdate <= lastVerification && lastVerification >= lastSunday;
    },

    isServiceOverdue(lastServiceDate) {
        if (!lastServiceDate) return true;
        const serviceDate = new Date(lastServiceDate);
        const now = new Date();
        const diffDays = Math.ceil((now - serviceDate) / (1000 * 60 * 60 * 24));
        return diffDays > 90;
    },

    getStatusCounts(trailers) {
        const counts = { Total: trailers.length };
        ['Cement', 'End Dump'].forEach(type => {
            counts[type] = trailers.filter(t => t.trailerType === type).length;
        });
        return counts;
    },

    getStatusCountsByStatus(trailers) {
        const statuses = ['Active', 'Spare', 'In Shop', 'Retired'];
        const counts = {};
        statuses.forEach(status => {
            counts[status] = trailers.filter(t => t.status === status).length;
        });
        return counts;
    },

    getPlantCounts(trailers) {
        const counts = {};
        trailers.forEach(trailer => {
            const plant = trailer.assignedPlant || 'Unassigned';
            counts[plant] = (counts[plant] || 0) + 1;
        });
        return counts;
    },

    getCleanlinessAverage(trailers) {
        const ratings = trailers.filter(t => t.cleanlinessRating).map(t => t.cleanlinessRating);
        return ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : 0;
    },

    getNeedServiceCount(trailers) {
        return trailers.filter(t => TrailerUtility.isServiceOverdue(t.lastServiceDate)).length;
    }
};

export default TrailerUtility;
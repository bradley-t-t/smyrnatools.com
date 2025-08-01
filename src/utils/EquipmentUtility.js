export class EquipmentUtility {
    static isServiceOverdue(serviceDate) {
        if (!serviceDate) return false;

        try {
            const service = new Date(serviceDate);
            const today = new Date();
            const diffDays = Math.ceil((today - service) / (1000 * 60 * 60 * 24));
            return diffDays > 30;
        } catch (error) {
            console.error('Error checking service date:', error);
            return false;
        }
    }

    static formatDate(date) {
        if (!date) return 'Not available';

        try {
            return new Date(date).toLocaleDateString();
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Invalid date';
        }
    }

    static getStatusCounts(equipments) {
        if (!Array.isArray(equipments)) return {};

        const counts = { Total: equipments.length, Active: 0, Spare: 0, 'In Shop': 0, Retired: 0 };
        equipments.forEach(equipment => {
            const status = equipment.status || 'Unknown';
            if (['Active', 'Spare', 'In Shop', 'Retired'].includes(status)) counts[status]++;
        });

        return counts;
    }

    static getPlantCounts(equipments) {
        if (!Array.isArray(equipments)) return {};

        return equipments.reduce((counts, equipment) => {
            const plant = equipment.assignedPlant || 'Unassigned';
            counts[plant] = (counts[plant] || 0) + 1;
            return counts;
        }, {});
    }

    static getCleanlinessAverage(equipments) {
        if (!Array.isArray(equipments) || !equipments.length) return 'N/A';

        const ratings = equipments
            .filter(e => e.cleanlinessRating != null)
            .map(e => Number(e.cleanlinessRating));

        return ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : 'N/A';
    }

    static getConditionAverage(equipments) {
        if (!Array.isArray(equipments) || !equipments.length) return 'N/A';

        const ratings = equipments
            .filter(e => e.conditionRating != null)
            .map(e => Number(e.conditionRating));

        return ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : 'N/A';
    }

    static getNeedServiceCount(equipments) {
        if (!Array.isArray(equipments)) return 0;

        return equipments.filter(equipment => this.isServiceOverdue(equipment.lastServiceDate)).length;
    }
}
export class MixerUtility {
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

  static isChipOverdue(chipDate) {
    if (!chipDate) return false;

    try {
      const chip = new Date(chipDate);
      const today = new Date();
      const diffDays = Math.ceil((today - chip) / (1000 * 60 * 60 * 24));
      return diffDays > 90;
    } catch (error) {
      console.error('Error checking chip date:', error);
      return false;
    }
  }

  static isVerified(updatedLast, updatedAt, updatedBy) {
    if (!updatedLast || !updatedBy) return false;

    try {
      const lastVerified = new Date(updatedLast);
      const lastUpdated = new Date(updatedAt);
      const today = new Date();

      if (lastUpdated > lastVerified) return false;
      const checkForTuesday = (start, end) => {
        const current = new Date(start);
        current.setDate(current.getDate() + 1);
        while (current <= end) {
          if (current.getDay() === 2) return true;
          current.setDate(current.getDate() + 1);
        }
        return false;
      };

      return !checkForTuesday(lastVerified, today);
    } catch (error) {
      console.error('Error checking verification status:', error);
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

  static getStatusCounts(mixers) {
    if (!Array.isArray(mixers)) return {};

    const counts = { Total: mixers.length, Active: 0, Spare: 0, 'In Shop': 0, Retired: 0 };
    mixers.forEach(mixer => {
      const status = mixer.status || 'Unknown';
      if (['Active', 'Spare', 'In Shop', 'Retired'].includes(status)) counts[status]++;
    });

    return counts;
  }

  static getPlantCounts(mixers) {
    if (!Array.isArray(mixers)) return {};

    return mixers.reduce((counts, mixer) => {
      const plant = mixer.assignedPlant || 'Unassigned';
      counts[plant] = (counts[plant] || 0) + 1;
      return counts;
    }, {});
  }

  static getCleanlinessAverage(mixers) {
    if (!Array.isArray(mixers) || !mixers.length) return 'N/A';

    const ratings = mixers
        .filter(m => m.cleanlinessRating != null)
        .map(m => Number(m.cleanlinessRating));

    return ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : 'N/A';
  }

  static getNeedServiceCount(mixers) {
    if (!Array.isArray(mixers)) return 0;

    return mixers.filter(mixer => this.isServiceOverdue(mixer.lastServiceDate)).length;
  }
}
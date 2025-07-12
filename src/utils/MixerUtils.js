/**
 * Utility functions for mixer-related operations
 */
export class MixerUtils {
  /**
   * Determine if a service date is overdue (more than 30 days old)
   * @param {string} serviceDate - The service date string
   * @returns {boolean} - True if service is overdue
   */
  static isServiceOverdue(serviceDate) {
    if (!serviceDate) return false;
    try {
      const service = new Date(serviceDate);
      const today = new Date();
      const diffTime = today - service;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 30;
    } catch (e) {
      console.error('Error checking service date:', e);
      return false;
    }
  }

  /**
   * Determine if a chip date is overdue (more than 90 days old)
   * @param {string} chipDate - The chip date string
   * @returns {boolean} - True if chip is overdue
   */
  static isChipOverdue(chipDate) {
    if (!chipDate) return false;
    try {
      const chip = new Date(chipDate);
      const today = new Date();
      const diffTime = today - chip;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 90;
    } catch (e) {
      console.error('Error checking chip date:', e);
      return false;
    }
  }

  /**
   * Check if a mixer is verified based on specific business rules
   * @param {string} updatedLast - Last verification date
   * @param {string} updatedAt - Last update date 
   * @param {string} updatedBy - User ID who verified
   * @returns {boolean} - True if mixer is verified
   */
  static isVerified(updatedLast, updatedAt, updatedBy) {
    // Must have both a verification date and a user who performed the verification
    if (!updatedLast || !updatedBy) return false;

    try {
      const lastVerified = new Date(updatedLast);
      const lastUpdated = new Date(updatedAt);
      const today = new Date();

      // Rule 1: If updated_at is newer than updated_last, the mixer is not verified
      if (lastUpdated > lastVerified) return false;

      // Rule 2: Check if there has been a Sunday between the last verification date and today
      const checkForSunday = (startDate, endDate) => {
        // Clone the start date to avoid modifying the original
        const currentDate = new Date(startDate);
        // Move to the next day to start checking
        currentDate.setDate(currentDate.getDate() + 1);

        // Check each day between start and end dates
        while (currentDate <= endDate) {
          // Sunday is day 0 in JavaScript
          if (currentDate.getDay() === 0) {
            return true; // Found a Sunday
          }
          // Move to the next day
          currentDate.setDate(currentDate.getDate() + 1);
        }
        return false; // No Sunday found
      };

      // If there's been a Sunday between the last verification and today, the mixer is not verified
      if (checkForSunday(lastVerified, today)) return false;

      return true;
    } catch (e) {
      console.error('Error checking verification status:', e);
      return false;
    }
  }

  /**
   * Format a date for display
   * @param {string|Date} date - The date to format
   * @returns {string} - The formatted date string
   */
  static formatDate(date) {
    if (!date) return 'Not available';
    try {
      return new Date(date).toLocaleDateString();
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Invalid date';
    }
  }

  /**
   * Get counts of mixers by status
   * @param {Array} mixers - Array of mixer objects
   * @returns {Object} - Object with status counts
   */
  static getStatusCounts(mixers) {
    if (!Array.isArray(mixers)) return {};

    const counts = {
      Total: mixers.length,
      Active: 0,
      Spare: 0,
      'In Shop': 0,
      Retired: 0
    };

    mixers.forEach(mixer => {
      const status = mixer.status || 'Unknown';
      if (['Active', 'Spare', 'In Shop', 'Retired'].includes(status)) {
        counts[status]++;
      }
    });

    return counts;
  }

  /**
   * Get counts of mixers by plant
   * @param {Array} mixers - Array of mixer objects
   * @returns {Object} - Object with plant counts
   */
  static getPlantCounts(mixers) {
    if (!Array.isArray(mixers)) return {};

    const counts = {};

    mixers.forEach(mixer => {
      const plant = mixer.assignedPlant || 'Unassigned';
      if (!counts[plant]) counts[plant] = 0;
      counts[plant]++;
    });

    return counts;
  }

  /**
   * Get average cleanliness rating of mixers
   * @param {Array} mixers - Array of mixer objects
   * @returns {string} - Formatted average cleanliness rating
   */
  static getCleanlinessAverage(mixers) {
    if (!Array.isArray(mixers) || mixers.length === 0) return 'N/A';

    const ratings = mixers
      .filter(m => m.cleanlinessRating !== undefined && m.cleanlinessRating !== null)
      .map(m => Number(m.cleanlinessRating));

    if (ratings.length === 0) return 'N/A';

    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    return average.toFixed(1);
  }

  /**
   * Get count of mixers that need service
   * @param {Array} mixers - Array of mixer objects
   * @returns {number} - Count of mixers needing service
   */
  static getNeedServiceCount(mixers) {
    if (!Array.isArray(mixers)) return 0;

    return mixers.filter(mixer => this.isServiceOverdue(mixer.lastServiceDate)).length;
  }
}

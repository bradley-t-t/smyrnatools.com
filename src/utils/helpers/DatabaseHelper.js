/**
 * Utility for debugging database operations
 */
export class DatabaseHelper {
  /**
   * Test if a table exists and has expected schema
   * @param {Object} supabase - Supabase client
   * @param {string} tableName - Table to check
   * @returns {Promise<Object>} Result with schema information
   */
  static async checkTableSchema(supabase, tableName) {
    try {
      // First check if the table exists by trying to select a single row
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (error) {
        return {
          exists: false,
          error: error.message,
          columns: null
        };
      }

      // Get column information from data
      let columns = [];
      if (data && data.length > 0) {
        columns = Object.keys(data[0]);
      }

      return {
        exists: true,
        columns: columns,
        sample: data && data.length > 0 ? data[0] : null
      };
    } catch (error) {
      console.error(`Error checking table schema for ${tableName}:`, error);
      return {
        exists: false,
        error: error.message,
        columns: null
      };
    }
  }

  /**
   * Store an object in localStorage with detailed data for debugging
   * @param {string} key - Key to store data under
   * @param {Object} data - Data to store
   */
  static storeDebugData(key, data) {
    try {
      const debugData = {
        timestamp: new Date().toISOString(),
        data: data
      };
      localStorage.setItem(key, JSON.stringify(debugData));
    } catch (e) {
      console.error('Failed to store debug data:', e);
    }
  }

  /**
   * Get the most likely required fields for a table based on schema analysis
   * @param {Object} supabase - Supabase client
   * @param {string} tableName - Table to analyze
   * @returns {Promise<Array<string>>} Likely required fields
   */
  static async getRequiredFields(supabase, tableName) {
    try {
      // This is a best-effort function without direct schema access
      // It might not be 100% accurate without proper introspection
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(10);

      if (error || !data || data.length === 0) {
        console.warn(`Could not determine required fields for ${tableName}`);
        return [];
      }

      // Fields that are non-null in all records are likely required
      const allFields = Object.keys(data[0]);
      const likelyRequired = allFields.filter(field => {
        return data.every(record => record[field] !== null);
      });

      return likelyRequired;
    } catch (error) {
      console.error(`Error analyzing schema for ${tableName}:`, error);
      return [];
    }
  }
}

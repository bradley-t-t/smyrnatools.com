export class DatabaseUtility {
  static async checkTableSchema(supabase, tableName) {
    if (!supabase || !tableName) throw new Error('Supabase client and table name are required');

    try {
      const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

      if (error) {
        console.error(`Error checking table schema for ${tableName}:`, error);
        return { exists: false, error: error.message, columns: null };
      }

      return {
        exists: true,
        columns: data?.length ? Object.keys(data[0]) : [],
        sample: data?.[0] ?? null
      };
    } catch (error) {
      console.error(`Error checking table schema for ${tableName}:`, error);
      return { exists: false, error: error.message, columns: null };
    }
  }

  static storeDebugData(key, data) {
    if (!key || !data) throw new Error('Key and data are required');

    try {
      localStorage.setItem(key, JSON.stringify({
        timestamp: new Date().toISOString(),
        data
      }));
    } catch (error) {
      console.error('Failed to store debug data:', error);
    }
  }

  static async getRequiredFields(supabase, tableName) {
    if (!supabase || !tableName) throw new Error('Supabase client and table name are required');

    try {
      const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(10);

      if (error || !data?.length) {
        console.warn(`Could not determine required fields for ${tableName}:`, error?.message);
        return [];
      }

      const allFields = Object.keys(data[0]);
      return allFields.filter(field => data.every(record => record[field] !== null));
    } catch (error) {
      console.error(`Error analyzing schema for ${tableName}:`, error);
      return [];
    }
  }
}
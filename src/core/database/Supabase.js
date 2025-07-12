import supabase, {
  createPartialTextFilter,
  extractSupabaseErrorMessage,
  formatDateForSupabase,
  getSupabaseErrorDetails,
  isSupabaseConfigured,
  logSupabaseError,
  SupabaseUtils
} from '../clients/SupabaseClient';

export default supabase;
export {
    supabase,
    SupabaseUtils,
    getSupabaseErrorDetails,
    logSupabaseError,
    formatDateForSupabase,
    isSupabaseConfigured,
    extractSupabaseErrorMessage,
    createPartialTextFilter
};

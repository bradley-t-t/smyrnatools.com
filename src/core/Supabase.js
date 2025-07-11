// This file serves as a convenience alias for SupabaseClient.js
// to maintain backward compatibility with existing imports

import supabase, {
  createPartialTextFilter,
  extractSupabaseErrorMessage,
  formatDateForSupabase,
  getSupabaseErrorDetails,
  isSupabaseConfigured,
  logSupabaseError,
  SupabaseUtils
} from './clients/SupabaseClient';

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

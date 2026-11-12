/**
 * Environment Variable Validation
 *
 * Validates that required environment variables are set at app startup.
 * Shows a helpful error screen if configuration is missing.
 */

export interface EnvValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validate that all required environment variables are present
 */
export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Required variables
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    missing.push('EXPO_PUBLIC_SUPABASE_URL');
  }

  if (!supabaseKey) {
    missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }

  // Validate URL format if present
  if (supabaseUrl) {
    try {
      new URL(supabaseUrl);
    } catch {
      warnings.push('EXPO_PUBLIC_SUPABASE_URL does not appear to be a valid URL');
    }

    if (!supabaseUrl.includes('supabase.co') && !supabaseUrl.includes('supabase.in')) {
      warnings.push('EXPO_PUBLIC_SUPABASE_URL does not appear to be a Supabase URL');
    }
  }

  // Validate anon key format if present
  // Supabase anon keys come in two formats:
  // 1. Legacy JWT format: long string with dots (e.g., eyJhbGc...)
  // 2. New sb_publishable format: sb_publishable_XXXXX_YYYYY_ZZZZZ
  if (supabaseKey) {
    const looksLikeJwt = supabaseKey.includes('.');
    const looksLikeSbPublishable = supabaseKey.startsWith('sb_publishable_');
    if (!looksLikeJwt && !looksLikeSbPublishable) {
      warnings.push('EXPO_PUBLIC_SUPABASE_ANON_KEY does not appear to be a valid key (expected JWT format or sb_publishable_ prefix)');
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Get environment info for debugging
 */
export function getEnvironmentInfo(): {
  hasSupabaseUrl: boolean;
  hasSupabaseKey: boolean;
  supabaseUrlHost: string;
} {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  let host = '';

  try {
    const url = new URL(supabaseUrl);
    host = url.host;
  } catch {
    // Invalid URL
  }

  return {
    hasSupabaseUrl: !!process.env.EXPO_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    supabaseUrlHost: host,
  };
}

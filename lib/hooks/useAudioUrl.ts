import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

/**
 * Custom hook to generate authenticated audio URLs from file paths
 * Uses Supabase client to create URLs that respect RLS policies
 * Provides persistent audio access for authenticated users
 */
export function useAudioUrl(filePath: string | null | undefined): string | null {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) {
      setAudioUrl(null);
      return;
    }

    // Generate authenticated URL using Supabase client
    // This respects RLS policies and provides persistent access
    const { data } = supabase.storage
      .from('audio-recordings')
      .getPublicUrl(filePath);

    if (data) {
      setAudioUrl(data.publicUrl);
    }
  }, [filePath]);

  return audioUrl;
}

/**
 * Generate authenticated audio URL synchronously
 * Use this for immediate URL generation without hook
 */
export function getAudioUrl(filePath: string | null | undefined): string | null {
  if (!filePath) {
    return null;
  }

  const { data } = supabase.storage
    .from('audio-recordings')
    .getPublicUrl(filePath);

  return data?.publicUrl || null;
}

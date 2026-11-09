import { create } from 'zustand';
import { User, UserPreferences, ReadingSettings } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

interface AuthState {
  user: User | null;
  profile: User | null;
  session: any;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,

  checkAuth: async () => {
    // If Supabase is not configured, skip auth check entirely
    if (!isSupabaseConfigured()) {
      set({ user: null, profile: null, session: null, isAuthenticated: false, isAdmin: false, isLoading: false });
      return;
    }
    try {
      // Add a timeout to prevent hanging if Supabase is unreachable
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth check timeout')), 5000)
      );
      const sessionResult = await Promise.race([supabase.auth.getSession(), timeout]);
      const { data: { session } } = sessionResult as any;
      if (!session) {
        set({ user: null, profile: null, session: null, isAuthenticated: false, isAdmin: false, isLoading: false });
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      const role = profile?.role || 'reader';
      set({
        user: profile || null,
        profile: profile || null,
        session,
        isAuthenticated: true,
        isAdmin: role === 'admin',
        isLoading: false,
      });
    } catch {
      // On any error (timeout, network, etc.), treat as unauthenticated
      set({ user: null, profile: null, session: null, isAuthenticated: false, isAdmin: false, isLoading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data: { session }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session!.user.id)
        .single();
      
      set({
        user: profile || null,
        profile: profile || null,
        session,
        isAuthenticated: true,
        isAdmin: profile?.role === 'admin',
        isLoading: false,
      });
    } catch (error: any) {
      set({ isLoading: false });
      throw error;
    }
  },

  signUp: async (email: string, password: string, displayName: string) => {
    set({ isLoading: true });
    try {
      const { data: { session }, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
        },
      });
      if (error) throw error;
      
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        set({
          user: profile || null,
          profile: profile || null,
          session,
          isAuthenticated: true,
          isAdmin: profile?.role === 'admin',
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error: any) {
      set({ isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, session: null, isAuthenticated: false, isAdmin: false });
  },

  resetPassword: async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'eodh://auth/reset-password',
      });
      if (error) throw error;
    } catch (error: any) {
      throw error;
    }
  },

  updateProfile: async (data: Partial<User>) => {
    if (!supabase.auth.getUser().then(r => r.data.user)) return;
    const userId = supabase.auth.getUser().then(r => r.data.user?.id);
    // Simplified – in production, await the user id
  },
}));

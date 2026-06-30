import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { Session, User } from '@supabase/supabase-js';

export type UserRole = 'customer' | 'vendor' | 'admin' | 'super_admin';

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  created_at?: string;
  location_id?: string | null;
  address?: string | null;
  phone?: string | null;
  is_visible?: boolean;
  is_blocked?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (emailInput: string, passwordInput: string) => Promise<{ error: any }>;
  signUp: (emailInput: string, passwordInput: string, fullName: string, locationId?: string | null) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to translate inputs
  const formatEmail = (email: string) => {
    const clean = email.trim().toLowerCase();
    if (clean === 'plugus@super_admin') {
      return 'plugus@superadmin.com';
    }
    return clean;
  };

  const fetchProfile = async (currentUser: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error.message);
        throw error;
      }

      if (data) {
        setProfile(data);
        setRole(data.role);
      } else {
        // Profile does not exist yet (first-time login or sign up callback delay)
        // Determine role based on email address
        const isSuperAdmin = currentUser.email?.toLowerCase() === 'plugus@superadmin.com';
        const assignedRole: UserRole = isSuperAdmin ? 'super_admin' : 'customer';

        const newProfile = {
          id: currentUser.id,
          email: currentUser.email || '',
          role: assignedRole,
          name: currentUser.user_metadata?.name || (isSuperAdmin ? 'Super Admin' : ''),
        };

        const { data: inserted, error: insertError } = await supabase
          .from('profiles')
          .upsert(newProfile)
          .select()
          .single();

        if (insertError) {
          console.error('Error auto-creating profile:', insertError.message);
        }

        if (inserted) {
          setProfile(inserted);
          setRole(inserted.role);
        } else {
          // Fallback if upsert failed (e.g. profiles table not setup yet)
          setProfile(newProfile as Profile);
          setRole(assignedRole);
        }
      }
    } catch (err) {
      console.warn('Profiles table sync failed. Falling back to local role mapping.');
      // Offline/Local fallback
      const isSuperAdmin = currentUser.email?.toLowerCase() === 'plugus@superadmin.com';
      const assignedRole: UserRole = isSuperAdmin ? 'super_admin' : 'customer';
      setRole(assignedRole);
      setProfile({
        id: currentUser.id,
        email: currentUser.email || '',
        role: assignedRole,
        name: isSuperAdmin ? 'Super Admin' : '',
      });
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  useEffect(() => {
    // Initial fetch of active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen to authentication status updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        await fetchProfile(currentUser);
      } else {
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (emailInput: string, passwordInput: string) => {
    const formattedEmail = formatEmail(emailInput);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formattedEmail,
        password: passwordInput,
      });
      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signUp = async (emailInput: string, passwordInput: string, fullName: string, locationId?: string | null) => {
    const formattedEmail = formatEmail(emailInput);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formattedEmail,
        password: passwordInput,
        options: {
          data: {
            name: fullName,
            location_id: locationId,
          },
        },
      });
      if (error) throw error;

      if (data.user) {
        // We rely entirely on the Supabase database trigger (handle_new_user)
        // to automatically create the public.profiles record.
        // Attempting an upsert here immediately after signUp often fails with RLS
        // violations because the auth session may not be fully established.
      }

      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

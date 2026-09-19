import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

import { getSupabaseClient } from './supabase';

export type AuthSnapshot = {
  event: AuthChangeEvent | 'INITIAL_SESSION';
  session: Session | null;
};

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

export function listenForAuthChanges(onChange: (snapshot: AuthSnapshot) => void): () => void {
  const { data } = getSupabaseClient().auth.onAuthStateChange((event, session) => {
    onChange({ event, session });
  });
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
  if (!data.session) {
    throw new Error('Supabase no devolvió una sesión tras iniciar sesión.');
  }
  return data.session;
}

export type RegisterInput = {
  email: string;
  password: string;
  displayName: string;
};

export type RegisterResult = {
  session: Session | null;
  user: User | null;
  emailConfirmationRequired: boolean;
};

export async function register(input: RegisterInput): Promise<RegisterResult> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        display_name: input.displayName,
      },
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) {
    throw error;
  }

  return {
    session: data.session,
    user: data.user,
    emailConfirmationRequired: Boolean(data.user && !data.session),
  };
}

export async function requestPasswordRecovery(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}${window.location.pathname}#recovery`;
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    throw error;
  }
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.updateUser({ password });
  if (error) {
    throw error;
  }
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });
  if (error) {
    throw error;
  }
}

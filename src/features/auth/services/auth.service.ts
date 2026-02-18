import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export type AuthError = {
  message: string;
};

export async function signInWithEmail(
  email: string,
  password: string
) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { data: null, error: { message: error.message } as AuthError };
  }

  return { data, error: null };
}

export async function signUpWithEmail(
  email: string,
  password: string
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { data: null, error: { message: error.message } as AuthError };
  }

  return { data, error: null };
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    return { data: null, error: { message: error.message } as AuthError };
  }

  return { data, error: null };
}

export async function signInWithGitHub() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    return { data: null, error: { message: error.message } as AuthError };
  }

  return { data, error: null };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: { message: error.message } as AuthError };
  }

  return { error: null };
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return { session: null, error: { message: error.message } as AuthError };
  }

  return { session: data.session, error: null };
}

export async function getUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return { user: null, error: { message: error.message } as AuthError };
  }

  return { user: data.user, error: null };
}

export function onAuthStateChange(
  callback: (event: string, session: unknown) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}

'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  signUpWithEmail,
  signInWithGoogle,
  signInWithGitHub,
} from '../services/auth.service';

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const result = await signUpWithEmail(email, password);

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    // If email confirmation is required, the user won't have a session yet
    if (result.data?.session) {
      router.push('/dashboard');
      router.refresh();
    } else {
      // Show success message for email confirmation flow
      setError(null);
      setLoading(false);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      alert(
        'Check your email for a confirmation link to complete your signup.'
      );
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    const result = await signInWithGoogle();
    if (result.error) {
      setError(result.error.message);
    }
  }

  async function handleGitHubSignIn() {
    setError(null);
    const result = await signInWithGitHub();
    if (result.error) {
      setError(result.error.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-[var(--label-secondary)]"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="mt-1 block w-full hig-rounded-md bg-[var(--fill-tertiary)] px-3 min-h-[44px] hig-body text-[var(--label-primary)] placeholder-[var(--label-tertiary)] focus:outline-none focus:ring-2 ring-[var(--system-blue)]/40"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-[var(--label-secondary)]"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          className="mt-1 block w-full hig-rounded-md bg-[var(--fill-tertiary)] px-3 min-h-[44px] hig-body text-[var(--label-primary)] placeholder-[var(--label-tertiary)] focus:outline-none focus:ring-2 ring-[var(--system-blue)]/40"
          placeholder="At least 6 characters"
        />
      </div>

      <div>
        <label
          htmlFor="confirm-password"
          className="block text-sm font-medium text-[var(--label-secondary)]"
        >
          Confirm password
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          className="mt-1 block w-full hig-rounded-md bg-[var(--fill-tertiary)] px-3 min-h-[44px] hig-body text-[var(--label-primary)] placeholder-[var(--label-tertiary)] focus:outline-none focus:ring-2 ring-[var(--system-blue)]/40"
          placeholder="Confirm your password"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-[var(--system-red)]/10 p-3 text-sm text-[var(--system-red)]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full hig-rounded-md bg-[var(--system-blue)] px-4 min-h-[44px] text-sm font-medium text-white transition-colors hig-pressable focus:outline-none focus:ring-2 ring-[var(--system-blue)]/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Creating account...' : 'Create account'}
      </button>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--separator)]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[var(--bg-grouped-secondary)] px-2 text-[var(--label-tertiary)]">
            or
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="flex w-full items-center justify-center gap-2 hig-rounded-md bg-[var(--fill-tertiary)] px-4 min-h-[44px] text-sm font-medium text-[var(--label-primary)] transition-colors hig-pressable focus:outline-none focus:ring-2 ring-[var(--system-blue)]/40"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continue with Google
      </button>

      <button
        type="button"
        onClick={handleGitHubSignIn}
        className="flex w-full items-center justify-center gap-2 hig-rounded-md bg-[var(--fill-tertiary)] px-4 min-h-[44px] text-sm font-medium text-[var(--label-primary)] transition-colors hig-pressable focus:outline-none focus:ring-2 ring-[var(--system-blue)]/40"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
        Continue with GitHub
      </button>

      <p className="text-center text-sm text-[var(--label-secondary)]">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-[var(--system-blue)]"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

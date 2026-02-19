import { Suspense } from 'react';
import { LoginForm } from '@/features/auth/components/LoginForm';

export const metadata = {
  title: 'Sign In - CollabBoard',
};

export default function LoginPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-[var(--label-primary)]">
          Sign in to CollabBoard
        </h1>
        <p className="mt-1 text-sm text-[var(--label-secondary)]">
          Welcome back! Sign in to continue.
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}

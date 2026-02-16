import { LoginForm } from '@/features/auth/components/LoginForm';

export const metadata = {
  title: 'Sign In - CollabBoard',
};

export default function LoginPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Sign in to CollabBoard
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Welcome back! Sign in to continue.
        </p>
      </div>
      <LoginForm />
    </>
  );
}

import { SignupForm } from '@/features/auth/components/SignupForm';

export const metadata = {
  title: 'Sign Up - CollabBoard',
};

export default function SignupPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Get started with CollabBoard for free.
        </p>
      </div>
      <SignupForm />
    </>
  );
}

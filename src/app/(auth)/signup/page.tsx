import { SignupForm } from '@/features/auth/components/SignupForm';

export const metadata = {
  title: 'Sign Up - CollabBoard',
};

export default function SignupPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-[var(--label-primary)]">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-[var(--label-secondary)]">
          Get started with CollabBoard for free.
        </p>
      </div>
      <SignupForm />
    </>
  );
}

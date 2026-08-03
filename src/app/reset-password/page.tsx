'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { resetPasswordAction } from '@/server/actions/auth';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      password: formData.get('password') as string,
      confirmPassword: formData.get('confirmPassword') as string,
    };

    try {
      const res = await resetPasswordAction(data);
      if (!res.success) {
        setErrorMessage(res.message || 'Failed to reset password.');
      } else {
        setSuccessMessage(res.message || 'Password reset successfully.');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }
    } catch {
      setErrorMessage('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md space-y-6 p-8 shadow-md">
        <div className="text-center">
          <Badge variant="neutral" className="mb-2">
            Security Update
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            Reset Your Password
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Enter your new password below.
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
            {successMessage} Redirecting to login...
          </div>
        )}

        {!successMessage && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700" htmlFor="password">
                New Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="At least 8 chars, 1 upper, 1 lower, 1 number"
                  className="block w-full rounded-md border border-zinc-300 px-3 py-2 pr-10 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-zinc-500 hover:text-zinc-900"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700" htmlFor="confirmPassword">
                Confirm New Password
              </label>
              <div className="relative mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Repeat your new password"
                  className="block w-full rounded-md border border-zinc-300 px-3 py-2 pr-10 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-zinc-500 hover:text-zinc-900"
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Updating Password...' : 'Reset Password'}
            </Button>
          </form>
        )}

        <div className="text-center text-xs text-zinc-500">
          <Link href="/login" className="font-semibold text-zinc-950 underline">
            Return to Sign In
          </Link>
        </div>
      </Card>
    </div>
  );
}

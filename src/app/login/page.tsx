'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { signInAction } from '@/server/actions/auth';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(urlError);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    };

    try {
      const res = await signInAction(data);
      if (!res.success) {
        setErrorMessage(res.message || 'Login failed.');
      } else {
        router.push('/dashboard');
      }
    } catch {
      setErrorMessage('An unexpected server error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md space-y-6 p-8 shadow-md">
      <div className="text-center">
        <Badge variant="neutral" className="mb-2">
          Welcome Back
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
          Sign In to WSNexa
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter your credentials to access your hospitality OS dashboard.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-700" htmlFor="email">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="owner@restaurant.com"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-zinc-700" htmlFor="password">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-zinc-600 hover:text-zinc-950 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative mt-1">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••••"
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

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing In...' : 'Sign In'}
        </Button>
      </form>

      <div className="text-center text-xs text-zinc-500">
        Don&apos;t have an account yet?{' '}
        <Link href="/register" className="font-semibold text-zinc-950 underline">
          Create Account
        </Link>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4 py-12">
      <Suspense fallback={<Card className="w-full max-w-md p-8 text-center text-sm">Loading login...</Card>}>
        <LoginFormContent />
      </Suspense>
    </div>
  );
}

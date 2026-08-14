'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { signInAction, signInWithGoogleAction } from '@/server/actions/auth';

function LoginFormContent() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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
      }
      // If success, server action redirects automatically to workspace
    } catch {
      setErrorMessage('An unexpected server error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorMessage(null);
    try {
      const res = await signInWithGoogleAction();
      if (res.success && res.data?.url) {
        window.location.href = res.data.url;
      } else {
        setErrorMessage(res.message || 'Google authentication failed.');
      }
    } catch {
      setErrorMessage('Unable to connect to Google authentication.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md space-y-6 p-8 shadow-md border-zinc-200">
      <div className="text-center space-y-2">
        <Badge variant="neutral" className="mb-1 uppercase tracking-widest text-[10px]">
          Welcome Back
        </Badge>
        <h1 className="text-2xl font-black tracking-tight text-zinc-950 uppercase">
          Sign In to WSNexa
        </h1>
        <p className="text-xs text-zinc-500">
          Enter your credentials to access your hospitality OS workspace.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Google OAuth Button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading || loading}
        className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-zinc-800 shadow-2xs hover:bg-zinc-50 transition-all active:scale-95 disabled:opacity-50"
      >
        <svg className="h-4 w-4 mr-2.5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
      </button>

      {/* Divider */}
      <div className="relative flex items-center justify-center">
        <div className="w-full border-t border-zinc-200" />
        <span className="absolute bg-white px-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          OR
        </span>
      </div>

      {/* Email & Password Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-700" htmlFor="email">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="owner@restaurant.com"
            className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-2xs focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-zinc-700" htmlFor="password">
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
              className="block w-full rounded-xl border border-zinc-300 px-3 py-2 pr-10 text-sm text-zinc-900 shadow-2xs focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
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

        <Button
          type="submit"
          className="w-full min-h-[44px] bg-zinc-950 hover:bg-zinc-800 text-xs font-extrabold uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
          disabled={loading || googleLoading}
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </Button>
      </form>

      <div className="text-center text-xs text-zinc-500 pt-2 border-t border-zinc-100">
        Don&apos;t have an account yet?{' '}
        <Link href="/register" className="font-bold text-zinc-950 hover:underline">
          Get Started
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

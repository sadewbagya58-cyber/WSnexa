'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { signUpAction } from '@/server/actions/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setFieldErrors({});
    setInfoMessage(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      confirmPassword: formData.get('confirmPassword') as string,
      termsAccepted: formData.get('termsAccepted') === 'on',
    };

    try {
      const res = await signUpAction(data);
      if (!res.success) {
        setErrorMessage(res.message || 'Registration failed.');
        if (res.errors) {
          setFieldErrors(res.errors);
        }
      } else {
        if (res.message) {
          setInfoMessage(res.message);
        } else {
          router.push('/dashboard');
        }
      }
    } catch {
      setErrorMessage('An unexpected server error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md space-y-6 p-8 shadow-md">
        <div className="text-center">
          <Badge variant="neutral" className="mb-2">
            Create Account
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            Join WSNexa
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Create your account to start managing your hospitality venue.
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        {infoMessage && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-semibold">Verify Your Email</p>
            <p className="mt-1 text-xs">{infoMessage}</p>
            <div className="mt-3">
              <Link href="/login" className="text-xs font-bold underline">
                Proceed to Login
              </Link>
            </div>
          </div>
        )}

        {!infoMessage && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700" htmlFor="firstName">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  placeholder="John"
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                />
                {fieldErrors.firstName && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.firstName[0]}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700" htmlFor="lastName">
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="Doe"
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                />
                {fieldErrors.lastName && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.lastName[0]}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700" htmlFor="email">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="john@restaurant.com"
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.email[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700" htmlFor="password">
                Password <span className="text-red-500">*</span>
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
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.password[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700" htmlFor="confirmPassword">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Repeat your password"
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
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword[0]}</p>
              )}
            </div>

            <div className="flex items-start space-x-2 pt-1">
              <input
                id="termsAccepted"
                name="termsAccepted"
                type="checkbox"
                required
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
              />
              <label htmlFor="termsAccepted" className="text-xs text-zinc-600">
                I accept the WSNexa Terms of Service and Privacy Policy.
              </label>
            </div>
            {fieldErrors.termsAccepted && (
              <p className="text-xs text-red-600">{fieldErrors.termsAccepted[0]}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating Account...' : 'Register Account'}
            </Button>
          </form>
        )}

        <div className="text-center text-xs text-zinc-500">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-zinc-950 underline">
            Sign In
          </Link>
        </div>
      </Card>
    </div>
  );
}

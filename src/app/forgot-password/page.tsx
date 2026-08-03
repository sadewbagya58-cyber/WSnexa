'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { forgotPasswordAction } from '@/server/actions/auth';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get('email') as string,
    };

    try {
      const res = await forgotPasswordAction(data);
      setInfoMessage(
        res.message ||
          'If an account exists with this email, you will receive password reset instructions.'
      );
      setSubmitted(true);
    } catch {
      setInfoMessage('An error occurred. Please try again.');
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md space-y-6 p-8 shadow-md">
        <div className="text-center">
          <Badge variant="neutral" className="mb-2">
            Account Recovery
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            Forgot Password
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Enter your registered email address to receive password reset instructions.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-center">
            <p className="text-xs text-zinc-700">{infoMessage}</p>
            <div className="mt-4">
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Return to Sign In
                </Button>
              </Link>
            </div>
          </div>
        ) : (
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending Instructions...' : 'Send Reset Link'}
            </Button>
          </form>
        )}

        <div className="text-center text-xs text-zinc-500">
          Remember your password?{' '}
          <Link href="/login" className="font-semibold text-zinc-950 underline">
            Sign In
          </Link>
        </div>
      </Card>
    </div>
  );
}

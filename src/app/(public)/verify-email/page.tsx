import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md space-y-6 p-8 text-center shadow-md">
        <Badge variant="warning" className="mx-auto">
          Action Required
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
          Check Your Inbox
        </h1>
        <p className="text-sm text-zinc-600">
          We sent a verification link to your email address. Please click the link to verify your account and activate your WSNexa profile.
        </p>

        <div className="rounded-md bg-zinc-50 p-4 text-xs text-zinc-500">
          Didn&apos;t receive an email? Check your spam folder or contact support.
        </div>

        <div className="pt-2">
          <Link href="/login">
            <Button variant="outline" className="w-full">
              Back to Sign In
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

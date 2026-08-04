import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function OnboardingCompletePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-md space-y-6 p-8 text-center shadow-lg">
        <div className="flex justify-center">
          <Badge variant="success" className="px-3 py-1 text-sm font-bold">
            🎉 Onboarding Complete!
          </Badge>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
          Your Business is Ready
        </h1>

        <p className="text-xs text-zinc-600">
          Congratulations! Your multi-tenant business profile and default branch have been successfully provisioned.
        </p>

        <div className="pt-4">
          <Link href="/dashboard">
            <Button className="w-full py-3 text-sm font-semibold">
              Go to Business Dashboard →
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

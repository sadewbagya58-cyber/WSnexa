import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-extrabold text-zinc-950">404</h1>
      <h2 className="mt-4 text-xl font-bold text-zinc-800">Page Not Found</h2>
      <p className="mt-2 max-w-md text-sm text-zinc-500">
        The page or resource you are looking for does not exist or has been moved.
      </p>
      <div className="mt-6">
        <Link href="/">
          <Button>Return Home</Button>
        </Link>
      </div>
    </div>
  );
}

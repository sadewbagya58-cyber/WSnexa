import { WsnexaCompactLoader } from '@/components/ui/wsnexa-compact-loader';

export default function Loading() {
  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4">
      <WsnexaCompactLoader label="Loading WSNexa..." />
    </div>
  );
}


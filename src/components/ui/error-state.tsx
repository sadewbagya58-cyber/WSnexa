import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  technicalDetails?: string | null;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'An Error Occurred',
  message,
  technicalDetails,
  onRetry,
  className = '',
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Clean technical details from raw DB errors
  const userFriendlyMessage = message
    .replace(/^Error:\s*/i, '')
    .replace(/PGRST\d+:\s*/i, '')
    .replace(/invalid input syntax for type uuid.*/i, 'The requested item identifier is invalid or missing.');

  return (
    <div className={`rounded-2xl border border-rose-200 bg-rose-50/60 p-5 space-y-3 shadow-2xs text-rose-950 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <h4 className="text-sm font-extrabold tracking-tight text-rose-950">{title}</h4>
            <p className="text-xs text-rose-900/90 font-medium mt-0.5 leading-relaxed">{userFriendlyMessage}</p>
          </div>
        </div>

        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} className="text-xs font-bold border-rose-300 text-rose-900 hover:bg-rose-100 shrink-0">
            🔄 Retry
          </Button>
        )}
      </div>

      {technicalDetails && (
        <div>
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-[11px] font-semibold text-rose-700 hover:underline focus:outline-none"
          >
            {showDetails ? 'Hide technical details' : 'Show technical details'}
          </button>

          {showDetails && (
            <pre className="mt-2 text-[10px] font-mono bg-rose-950 text-rose-100 p-3 rounded-xl overflow-x-auto max-h-40">
              {technicalDetails}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface AccessDeniedProps {
  requiredPermission?: string;
  userRole?: string;
  workspaceRoute?: string;
}

export function AccessDenied({
  workspaceRoute = '/dashboard',
}: AccessDeniedProps) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 bg-zinc-50">
      <div className="bg-white border border-zinc-200 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-xl">
        <div className="w-16 h-16 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto text-3xl">
          🔒
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-zinc-950 tracking-tight">
            You don&apos;t have permission to access this area.
          </h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Your staff account does not have authorization to view or manage this section.
            Please contact your Business Owner or Branch Manager if you believe this is an error.
          </p>
        </div>

        <div className="pt-2 border-t border-zinc-100 flex flex-col gap-2">
          <Link href={workspaceRoute} className="w-full">
            <Button variant="primary" className="w-full text-xs h-10">
              ⬅️ Back to My Workspace
            </Button>
          </Link>
          <a
            href="mailto:support@wsnexa.com?subject=Permission%20Access%20Request"
            className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors font-medium"
          >
            Contact Business Administrator
          </a>
        </div>
      </div>
    </div>
  );
}

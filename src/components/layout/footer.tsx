import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-zinc-200 bg-white py-6">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-xs text-zinc-500">
          WSNexa — Smart Hospitality. Simplified. &copy; {new Date().getFullYear()} WSNexa Inc. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

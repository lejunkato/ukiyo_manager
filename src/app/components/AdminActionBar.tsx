import { ReactNode } from "react";

interface AdminActionBarProps {
  children: ReactNode;
}

export default function AdminActionBar({ children }: AdminActionBarProps) {
  return (
    <div className="border-b border-border bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-end gap-2 sm:gap-3 flex-wrap">
        {children}
      </div>
    </div>
  );
}

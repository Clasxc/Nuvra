// src/components/Skeleton.tsx — Loading skeleton primitives
// Use these instead of spinners for a more polished "content is coming" feel.

import { cn } from "@/lib/utils";

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] rounded-lg", className)} />
);

export const CardSkeleton = () => (
  <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
    <Skeleton className="h-5 w-1/3 mb-4" />
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-4/5 mb-2" />
    <Skeleton className="h-4 w-2/3" />
  </div>
);

export const ListSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-1/3 mb-2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    ))}
  </div>
);

export const DashboardSkeleton = () => (
  <div className="space-y-6">
    {/* Stats row */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[0, 1, 2].map(i => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-7 w-12" />
        </div>
      ))}
    </div>
    {/* Two-column area */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <CardSkeleton />
      <CardSkeleton />
    </div>
  </div>
);

export default Skeleton;

"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoginShimmer() {
  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute -left-16 top-10 h-60 w-60 rounded-full bg-cyan-300/25 blur-3xl dark:bg-cyan-500/15" />
      <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/15" />
      <div className="pointer-events-none absolute -right-14 bottom-0 h-72 w-72 rounded-full bg-amber-300/25 blur-3xl dark:bg-amber-500/15" />

      <Card className="modern-surface w-full max-w-md border-0 shadow-xl animate-soft-pop">
        <CardHeader className="items-center text-center">
          <Skeleton className="mb-4 h-16 w-16 rounded-2xl" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <div className="w-full space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-3 pt-1">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="mx-auto h-4 w-44" />
              <Skeleton className="mx-auto h-4 w-36" />
            </div>
            <div className="space-y-2 pt-2">
              <Skeleton className="mx-auto h-4 w-52" />
              <Skeleton className="mx-auto h-4 w-36" />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

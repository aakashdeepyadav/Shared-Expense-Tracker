
"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ChatShimmer() {
  return (
    <div className="flex flex-col h-screen">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <div className="md:hidden">
          <Skeleton className="h-7 w-7" />
        </div>
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center gap-2 ml-auto">
          <Skeleton className="h-10 w-10" />
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 md:p-6">
        <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto">
          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3",
                  i % 2 !== 0 && "justify-end"
                )}
              >
                {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full" />}
                <div
                  className={cn(
                    "max-w-xs md:max-w-md p-3 rounded-lg flex flex-col gap-2",
                    i % 2 !== 0 ? "bg-muted" : "bg-muted"
                  )}
                >
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full" />}
              </div>
            ))}
          </div>

          <div className="py-4 border-t-0 bg-transparent">
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

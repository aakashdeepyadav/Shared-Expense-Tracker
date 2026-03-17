"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useAuth } from "@/context/auth-context";
import { subscribeToAuditLogs } from "@/lib/firestore";
import type { AuditLogEntry } from "@/lib/types";
import { DashboardShimmer } from "@/components/shimmers/dashboard-shimmer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 25;

export default function AuditLogsPage() {
  const { currentUser, isAdmin, isAuthLoading, isAppConfigured } = useAuth();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastLog, setLastLog] = useState<AuditLogEntry | undefined>(undefined);
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }
    if (!isAppConfigured) {
      router.push("/setup");
      return;
    }
    if (!currentUser) {
      router.push("/login");
      return;
    }
    if (!isAdmin) {
      router.push("/");
      return;
    }

    setIsLoading(true);
    const unsubscribe = subscribeToAuditLogs(PAGE_SIZE, (nextLogs) => {
      setLogs(nextLogs);
      setHasMore(nextLogs.length === PAGE_SIZE);
      setLastLog(
        nextLogs.length > 0 ? nextLogs[nextLogs.length - 1] : undefined,
      );
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, isAdmin, isAuthLoading, isAppConfigured, router]);

  const filteredLogs = useMemo(() => {
    const normalized = filterText.trim().toLowerCase();
    if (!normalized) {
      return logs;
    }

    return logs.filter((log) => {
      const metadataText = log.metadata
        ? JSON.stringify(log.metadata).toLowerCase()
        : "";
      return (
        log.action.toLowerCase().includes(normalized) ||
        log.actorId.toLowerCase().includes(normalized) ||
        metadataText.includes(normalized)
      );
    });
  }, [logs, filterText]);

  const handleLoadMore = () => {
    if (!hasMore || isLoadingMore || !lastLog) {
      return;
    }

    setIsLoadingMore(true);
    const unsubscribe = subscribeToAuditLogs(
      PAGE_SIZE,
      (nextLogs) => {
        setLogs((prev) => {
          const existingIds = new Set(prev.map((log) => log.id));
          const uniqueNext = nextLogs.filter((log) => !existingIds.has(log.id));
          return [...prev, ...uniqueNext];
        });
        setHasMore(nextLogs.length === PAGE_SIZE);
        setLastLog(
          nextLogs.length > 0 ? nextLogs[nextLogs.length - 1] : lastLog,
        );
        setIsLoadingMore(false);
        unsubscribe();
      },
      lastLog,
    );
  };

  if (isAuthLoading || !currentUser || !isAdmin || isLoading) {
    return <DashboardShimmer />;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mx-auto w-full space-y-6">
        <header>
          <h1 className="text-2xl font-bold font-headline">Audit Logs</h1>
          <p className="text-muted-foreground">
            Track privileged admin actions for security and operational
            visibility.
          </p>
        </header>

        <Card className="w-full">
          <CardHeader className="gap-3">
            <CardTitle>Activity Feed</CardTitle>
            <CardDescription>
              Showing latest admin actions, newest first.
            </CardDescription>
            <Input
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
              placeholder="Filter by action, actor, or metadata"
            />
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[190px]">Time</TableHead>
                  <TableHead className="w-[220px]">Action</TableHead>
                  <TableHead className="w-[100px]">Actor</TableHead>
                  <TableHead>Metadata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="capitalize">
                        {log.actorId}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.metadata ? (
                          <pre className="whitespace-pre-wrap break-all max-h-24 overflow-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground py-8"
                    >
                      No audit logs found for this filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>

          {hasMore && (
            <CardFooter className="pt-6 justify-center">
              <Button onClick={handleLoadMore} disabled={isLoadingMore}>
                {isLoadingMore ? "Loading..." : "Load More"}
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}

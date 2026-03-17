"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import {
  getMonthArchiveById,
  getMonthArchives,
  subscribeToContributions,
  subscribeToUsers,
} from "@/lib/firestore";
import type { Contribution, MonthArchiveSummary, User } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { HistoryShimmer } from "@/components/shimmers/history-shimmer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";

const PAGE_SIZE = 20;

export default function ContributionHistoryPage() {
  const { currentUser, isAdmin, isAuthLoading, isAppConfigured } = useAuth();
  const router = useRouter();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastContribution, setLastContribution] = useState<
    Contribution | undefined
  >(undefined);
  const [archiveSummaries, setArchiveSummaries] = useState<
    MonthArchiveSummary[]
  >([]);
  const [selectedPeriod, setSelectedPeriod] = useState("current");

  useEffect(() => {
    if (!isAuthLoading && !isAppConfigured) {
      router.push("/setup");
    } else if (!isAuthLoading && !currentUser) {
      router.push("/login");
    } else if (currentUser) {
      setIsLoading(true);
      const unsubContributions =
        selectedPeriod === "current"
          ? subscribeToContributions(PAGE_SIZE, (newContributions) => {
              setContributions(newContributions);
              setHasMore(newContributions.length === PAGE_SIZE);
              if (newContributions.length > 0) {
                setLastContribution(
                  newContributions[newContributions.length - 1],
                );
              }
              setIsLoading(false);
            })
          : () => {};

      if (selectedPeriod !== "current") {
        void (async () => {
          const archive = await getMonthArchiveById(selectedPeriod);
          setContributions(archive?.contributions || []);
          setHasMore(false);
          setLastContribution(undefined);
          setIsLoading(false);
        })();
      }

      void (async () => {
        const summaries = await getMonthArchives();
        setArchiveSummaries(summaries);
      })();

      const unsubUsers = subscribeToUsers((newUsers) => {
        setUsers(newUsers);
      });

      return () => {
        unsubContributions();
        unsubUsers();
      };
    }
  }, [currentUser, isAppConfigured, isAuthLoading, router, selectedPeriod]);

  const handleLoadMore = () => {
    if (selectedPeriod !== "current") return;
    if (!hasMore || isLoadingMore || !lastContribution) return;
    setIsLoadingMore(true);

    // We create a one-time subscription to get the next page
    const unsub = subscribeToContributions(
      PAGE_SIZE,
      (newContributions) => {
        setContributions((prev) => [...prev, ...newContributions]);
        setHasMore(newContributions.length === PAGE_SIZE);
        if (newContributions.length > 0) {
          setLastContribution(newContributions[newContributions.length - 1]);
        }
        setIsLoadingMore(false);
        // Unsubscribe immediately after getting the data
        unsub();
      },
      lastContribution,
    );
  };

  const userMap = new Map(users.map((user) => [user.id, user]));

  const visibleContributions =
    isAdmin || !currentUser
      ? contributions
      : contributions.filter(
          (contribution) => contribution.contributorId === currentUser.id,
        );

  if (isLoading) {
    return (
      <HistoryShimmer
        title="Contribution History"
        description="A list of all recorded wallet contributions."
      />
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <PageHeader />
      <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6 lg:p-8">
        <div className="mx-auto w-full animate-fade-up">
          <header className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight font-headline md:text-3xl lg:text-4xl">
              Contribution History
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {selectedPeriod === "current"
                ? "Showing current live-month contributions."
                : "Showing archived month contributions."}
            </p>
          </header>
          <div className="mb-4 max-w-sm">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current Month</SelectItem>
                {archiveSummaries.map((archive) => (
                  <SelectItem key={archive.id} value={archive.id}>
                    {archive.periodLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card className="modern-surface border-0 animate-soft-pop overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Contributor</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleContributions.length > 0 ? (
                    visibleContributions.map((contribution) => {
                      const contributor = userMap.get(
                        contribution.contributorId,
                      );
                      return (
                        <TableRow key={contribution.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage
                                  src={contributor?.avatarUrl}
                                  alt={contributor?.name}
                                  data-ai-hint="person portrait"
                                />
                                <AvatarFallback>
                                  {contributor?.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">
                                {contributor?.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {format(new Date(contribution.date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(contribution.amount)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center text-muted-foreground py-8"
                      >
                        {isAdmin
                          ? "No contributions found."
                          : "No personal contributions found."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            {isAdmin && selectedPeriod === "current" && hasMore && (
              <CardFooter className="pt-6 justify-center">
                <Button onClick={handleLoadMore} disabled={isLoadingMore}>
                  {isLoadingMore ? "Loading..." : "Load More"}
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}

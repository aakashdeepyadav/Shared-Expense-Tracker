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
import { subscribeToContributions, subscribeToUsers } from "@/lib/firestore";
import type { Contribution, User } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { HistoryShimmer } from "@/components/shimmers/history-shimmer";

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

  useEffect(() => {
    if (!isAuthLoading && !isAppConfigured) {
      router.push("/setup");
    } else if (!isAuthLoading && !currentUser) {
      router.push("/login");
    } else if (currentUser) {
      setIsLoading(true);
      const unsubContributions = subscribeToContributions(
        PAGE_SIZE,
        (newContributions) => {
          setContributions(newContributions);
          setHasMore(newContributions.length === PAGE_SIZE);
          if (newContributions.length > 0) {
            setLastContribution(newContributions[newContributions.length - 1]);
          }
          setIsLoading(false);
        },
      );

      const unsubUsers = subscribeToUsers((newUsers) => {
        setUsers(newUsers);
      });

      return () => {
        unsubContributions();
        unsubUsers();
      };
    }
  }, [currentUser, isAppConfigured, isAuthLoading, router]);

  const handleLoadMore = () => {
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
    <div className="p-4 md:p-6 lg:p-8 animate-fade-up">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight font-headline md:text-3xl lg:text-4xl">
          Contribution History
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Showing all recorded contributions.
        </p>
      </header>
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
                  const contributor = userMap.get(contribution.contributorId);
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
        {isAdmin && hasMore && (
          <CardFooter className="pt-6 justify-center">
            <Button onClick={handleLoadMore} disabled={isLoadingMore}>
              {isLoadingMore ? "Loading..." : "Load More"}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

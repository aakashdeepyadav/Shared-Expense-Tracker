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
  addAdminAuditLog,
  deleteContribution,
  getMonthArchiveById,
  getMonthArchives,
  subscribeToContributions,
  subscribeToUsers,
  updateContribution,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2 } from "lucide-react";

const PAGE_SIZE = 20;

export default function ContributionHistoryPage() {
  const { currentUser, isAdmin, isAuthLoading, isAppConfigured } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
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
  const [editingContribution, setEditingContribution] =
    useState<Contribution | null>(null);
  const [editContributorId, setEditContributorId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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

  const openEditDialog = (contribution: Contribution) => {
    setEditingContribution(contribution);
    setEditContributorId(contribution.contributorId);
    setEditAmount(String(contribution.amount));
    setEditDate(format(new Date(contribution.date), "yyyy-MM-dd"));
  };

  const handleSaveEdit = async () => {
    if (!editingContribution) return;

    const amount = Number(editAmount);
    if (!editContributorId || Number.isNaN(amount) || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid contribution data",
        description: "Contributor and positive amount are required.",
      });
      return;
    }

    const parsedDate = new Date(editDate);
    if (Number.isNaN(parsedDate.getTime())) {
      toast({
        variant: "destructive",
        title: "Invalid date",
        description: "Please select a valid date.",
      });
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateContribution(editingContribution.id, {
        contributorId: editContributorId,
        amount,
        date: parsedDate,
      });
      await addAdminAuditLog({
        action: "contribution.update",
        metadata: { contributionId: editingContribution.id, amount },
      });
      toast({
        title: "Contribution updated",
        description: "Contribution changes saved successfully.",
      });
      setEditingContribution(null);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not update contribution.",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteContribution = async (contribution: Contribution) => {
    const shouldDelete = window.confirm(
      "Delete this contribution? This cannot be undone.",
    );
    if (!shouldDelete) return;

    try {
      await deleteContribution(contribution.id);
      await addAdminAuditLog({
        action: "contribution.delete",
        metadata: {
          contributionId: contribution.id,
          amount: contribution.amount,
        },
      });
      toast({ title: "Contribution deleted" });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not delete contribution.",
      });
    }
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
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader />
      <main className="flex-1 min-h-0 overflow-y-auto p-3 pb-4 md:p-6 md:pb-6 lg:p-8">
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
          <div className="sticky top-2 z-20 mb-4">
            <div className="w-full md:max-w-sm rounded-xl border border-border/60 bg-background/90 p-2 shadow-sm backdrop-blur">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="h-11 w-full bg-background">
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
          </div>
          <Card className="modern-surface border-0 animate-soft-pop overflow-hidden">
            <CardContent className="p-0">
              <div className="md:hidden divide-y divide-border/60">
                {visibleContributions.length > 0 ? (
                  visibleContributions.map((contribution) => {
                    const contributor = userMap.get(contribution.contributorId);
                    return (
                      <div key={contribution.id} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-7 w-7">
                              <AvatarImage
                                src={contributor?.avatarUrl}
                                alt={contributor?.name}
                                data-ai-hint="person portrait"
                              />
                              <AvatarFallback>
                                {contributor?.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {contributor?.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(
                                  new Date(contribution.date),
                                  "dd/MM/yyyy",
                                )}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm font-semibold whitespace-nowrap">
                            {formatCurrency(contribution.amount)}
                          </p>
                        </div>
                        {isAdmin && selectedPeriod === "current" && (
                          <div className="mt-3 flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => openEditDialog(contribution)}
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              className="h-8"
                              onClick={() =>
                                handleDeleteContribution(contribution)
                              }
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    {isAdmin
                      ? "No contributions found."
                      : "No personal contributions found."}
                  </div>
                )}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <Table className="min-w-[480px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contributor</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Date
                      </TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      {isAdmin && selectedPeriod === "current" && (
                        <TableHead className="text-right">Actions</TableHead>
                      )}
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
                              {format(
                                new Date(contribution.date),
                                "dd/MM/yyyy",
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(contribution.amount)}
                            </TableCell>
                            {isAdmin && selectedPeriod === "current" && (
                              <TableCell className="text-right">
                                <div className="inline-flex items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditDialog(contribution)}
                                  >
                                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      handleDeleteContribution(contribution)
                                    }
                                  >
                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                    Delete
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={
                            isAdmin && selectedPeriod === "current" ? 4 : 3
                          }
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
              </div>
            </CardContent>
            {isAdmin && selectedPeriod === "current" && hasMore && (
              <CardFooter className="pt-6 justify-center">
                <Button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="w-full sm:w-auto"
                >
                  {isLoadingMore ? "Loading..." : "Load More"}
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        <Dialog
          open={Boolean(editingContribution)}
          onOpenChange={(open) => {
            if (!open) setEditingContribution(null);
          }}
        >
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Edit Contribution</DialogTitle>
              <DialogDescription>
                Admin can modify or delete any current-month contribution.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Contributor</Label>
                <Select
                  value={editContributorId}
                  onValueChange={setEditContributorId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contributor" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-contribution-amount">Amount</Label>
                  <Input
                    id="edit-contribution-amount"
                    type="number"
                    step="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-contribution-date">Date</Label>
                  <Input
                    id="edit-contribution-date"
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingContribution(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

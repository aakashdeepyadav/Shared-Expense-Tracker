"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth-context";
import {
  listControlGroups,
  updateControlGroupApproval,
} from "@/lib/control-plane";
import { useToast } from "@/hooks/use-toast";

type ControlGroup = {
  groupId: string;
  groupName?: string;
  adminName?: string;
  tenantProjectId?: string | null;
  onboardingStatus?: string;
  otpVerified?: boolean;
};

export default function ControlAdminPage() {
  const { currentUser, isAdmin, isAuthLoading, isAppConfigured } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [groups, setGroups] = useState<ControlGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingGroupId, setUpdatingGroupId] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await listControlGroups();
      setGroups(result as ControlGroup[]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to load control groups",
        description:
          error instanceof Error
            ? error.message
            : "Could not fetch control-plane data.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAuthLoading && !isAppConfigured) {
      router.push("/setup");
      return;
    }
    if (!isAuthLoading && !currentUser) {
      router.push("/login");
      return;
    }
    if (!isAuthLoading && currentUser && !isAdmin) {
      router.push("/");
      return;
    }
    if (!isAuthLoading && currentUser && isAdmin) {
      void loadGroups();
    }
  }, [
    currentUser,
    isAdmin,
    isAuthLoading,
    isAppConfigured,
    router,
    loadGroups,
  ]);

  if (isAuthLoading || !currentUser || !isAdmin) {
    return null;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 animate-fade-up">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Control Admin
        </h1>
        <p className="text-sm text-muted-foreground md:text-base">
          Manage central onboarding state for all groups.
        </p>
      </header>

      <Card className="modern-surface border-0">
        <CardHeader>
          <CardTitle>Control Groups</CardTitle>
          <CardDescription>
            Approve or revoke control-plane onboarding status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading groups...</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No control groups found.
            </p>
          ) : (
            groups.map((group) => {
              const isApproved =
                group.onboardingStatus === "completed" &&
                group.otpVerified === true;
              const isUpdating = updatingGroupId === group.groupId;

              return (
                <div
                  key={group.groupId}
                  className="rounded-xl border border-border/60 bg-background/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {group.groupName || group.groupId}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Group ID: {group.groupId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Admin: {group.adminName || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tenant Project:{" "}
                        {group.tenantProjectId || "Not provided"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={isApproved ? "default" : "secondary"}>
                        {isApproved ? "Approved" : "Pending"}
                      </Badge>
                      <Button
                        size="sm"
                        variant={isApproved ? "outline" : "default"}
                        disabled={isUpdating}
                        onClick={async () => {
                          setUpdatingGroupId(group.groupId);
                          try {
                            await updateControlGroupApproval(
                              group.groupId,
                              !isApproved,
                            );
                            await loadGroups();
                            toast({
                              title: isApproved
                                ? "Approval revoked"
                                : "Group approved",
                              description: `${group.groupName || group.groupId} status updated.`,
                            });
                          } catch (error) {
                            toast({
                              variant: "destructive",
                              title: "Update failed",
                              description:
                                error instanceof Error
                                  ? error.message
                                  : "Could not update approval status.",
                            });
                          } finally {
                            setUpdatingGroupId(null);
                          }
                        }}
                      >
                        {isUpdating
                          ? "Updating..."
                          : isApproved
                            ? "Revoke Approval"
                            : "Approve Group"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

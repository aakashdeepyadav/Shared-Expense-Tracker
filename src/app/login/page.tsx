"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { Logo } from "@/components/icons/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [groupIdInput, setGroupIdInput] = useState("");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  const {
    loginWithCredentials,
    currentUser,
    isAuthLoading,
    isAppConfigured,
    appConfig,
    users,
    activeGroupId,
    selectGroup,
    refreshGroupDirectory,
  } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (!isAuthLoading && currentUser) {
      router.push("/");
    }
  }, [currentUser, isAuthLoading, router]);

  useEffect(() => {
    refreshGroupDirectory();
  }, [refreshGroupDirectory]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    const result = await loginWithCredentials({
      name: loginName,
      password,
    });

    if (!result.success) {
      handleLoginFailure(result);
    }
    setIsLoggingIn(false);
  };

  const handleLoginFailure = (result: {
    success: boolean;
    lockedUntil?: number;
    message?: string;
  }) => {
    if (result.lockedUntil) {
      setLockoutTime(result.lockedUntil);
      setTimeRemaining(Math.ceil((result.lockedUntil - Date.now()) / 1000));
    } else {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: result.message || "An error occurred. Please try again.",
      });
    }
    if (!result.lockedUntil) {
      setPassword("");
    }
  };

  const isLocked = lockoutTime > Date.now();

  const handleSelectGroup = async (groupId: string) => {
    if (!groupId) return;
    const result = await selectGroup(groupId);
    if (result.success) {
      setGroupIdInput("");
      resetLoginFlow();
      toast({
        title: "Group selected",
        description: "You can now log in to this group.",
      });
      return;
    }

    toast({
      variant: "destructive",
      title: "Could not join group",
      description: result.message || "Please check the group ID and try again.",
    });
  };

  const resetLoginFlow = () => {
    setPassword("");
  };

  const getButtonText = () => {
    return isLoggingIn ? "Signing In..." : "Sign In";
  };

  const dotPatternLight = {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Ccircle cx='2' cy='2' r='1' fill='%2394a3b8'/%3E%3C/svg%3E\")",
  };
  const dotPatternDark = {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23475569'/%3E%3C/svg%3E\")",
  };

  const matchedUser = users.find(
    (user) => user.name.toLowerCase() === loginName.trim().toLowerCase(),
  );
  const isAdminName = matchedUser?.id === "admin";
  const credentialLabel = isAdminName ? "Admin Password" : "PIN";
  const credentialPlaceholder = isAdminName
    ? "Type admin password"
    : "Type your 6-digit PIN";

  if (isAuthLoading) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading account...</p>
      </div>
    );
  }

  if (currentUser) {
    return null;
  }

  if (!isAppConfigured) {
    return (
      <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-slate-50 p-4 dark:bg-slate-950">
        <div
          className="pointer-events-none absolute inset-0 opacity-35 dark:hidden"
          style={dotPatternLight}
        />
        <div
          className="pointer-events-none absolute inset-0 hidden opacity-30 dark:block"
          style={dotPatternDark}
        />
        <div className="pointer-events-none absolute left-10 top-10 h-16 w-16 rounded-2xl border border-cyan-200 bg-cyan-100/70 dark:border-cyan-900 dark:bg-cyan-950/40" />
        <div className="pointer-events-none absolute right-12 bottom-12 h-20 w-20 rounded-xl border border-amber-200 bg-amber-100/70 dark:border-amber-900 dark:bg-amber-950/40" />
        <Card className="w-full max-w-md rounded-3xl border border-border/80 bg-card/95 shadow-2xl">
          <CardHeader className="items-center pb-2 text-center">
            <Logo className="mb-3 h-14 w-14" />
            <CardTitle className="text-2xl tracking-tight">
              Welcome to Shared Expense Tracker
            </CardTitle>
            <CardDescription>
              Join an existing group or create a new one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-id-input">Join by group ID</Label>
              <div className="flex gap-2">
                <Input
                  id="group-id-input"
                  value={groupIdInput}
                  onChange={(e) => setGroupIdInput(e.target.value)}
                  placeholder="e.g. flat-2-ab12cd"
                  className="h-11"
                />
                <Button
                  variant="secondary"
                  onClick={() => handleSelectGroup(groupIdInput.trim())}
                  disabled={!groupIdInput.trim()}
                  className="h-11"
                >
                  Join
                </Button>
              </div>
            </div>
            <Button className="h-11 w-full" asChild>
              <Link href="/setup">
                Signup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full"
              onClick={() => refreshGroupDirectory()}
            >
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-slate-50 p-4 dark:bg-slate-950">
      <div
        className="pointer-events-none absolute inset-0 opacity-35 dark:hidden"
        style={dotPatternLight}
      />
      <div
        className="pointer-events-none absolute inset-0 hidden opacity-30 dark:block"
        style={dotPatternDark}
      />
      <div className="pointer-events-none absolute left-10 top-10 h-16 w-16 rounded-2xl border border-cyan-200 bg-cyan-100/70 dark:border-cyan-900 dark:bg-cyan-950/40" />
      <div className="pointer-events-none absolute right-16 top-12 h-14 w-14 rounded-full border border-emerald-200 bg-emerald-100/70 dark:border-emerald-900 dark:bg-emerald-950/40" />
      <div className="pointer-events-none absolute bottom-12 right-14 h-20 w-20 rounded-xl border border-amber-200 bg-amber-100/70 dark:border-amber-900 dark:bg-amber-950/40" />
      <Card className="w-full max-w-md rounded-3xl border border-border/80 bg-card/95 shadow-2xl">
        <CardHeader className="items-center pb-2 text-center">
          <Logo className="mb-3 h-14 w-14" />
          <CardTitle className="text-3xl tracking-tight">
            Sign in to {appConfig?.groupName || "your group"}
          </CardTitle>
          <CardDescription>Secure access to your shared wallet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-5 rounded-2xl border border-border/70 bg-muted/35 p-4 text-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Active group
            </div>
            <div className="mt-1 text-base font-semibold">
              {appConfig?.groupName || activeGroupId}
            </div>
            <div className="mt-1 text-muted-foreground">
              ID: {activeGroupId}
            </div>
          </div>
          {isLocked && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Too Many Failed Attempts</AlertTitle>
              <AlertDescription>
                Please try again in {Math.ceil(timeRemaining / 60)} minute(s)
                and {timeRemaining % 60} seconds.
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-name-input">Name</Label>
                <Input
                  id="login-name-input"
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  placeholder="Type your name"
                  className="h-12 rounded-xl"
                  disabled={isLoggingIn || isLocked}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-input">{credentialLabel}</Label>
                <Input
                  id="password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={credentialPlaceholder}
                  className="h-12 rounded-xl"
                  disabled={isLoggingIn || isLocked}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>
            </div>

            <Button
              onClick={handleLogin}
              className="h-12 w-full rounded-xl text-base"
              disabled={
                isLoggingIn || isLocked || !loginName.trim() || !password.trim()
              }
            >
              {getButtonText()}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

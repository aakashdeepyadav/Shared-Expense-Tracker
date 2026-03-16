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

type LoginStep = "credentials" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [groupIdInput, setGroupIdInput] = useState("");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const { toast } = useToast();
  const {
    loginWithCredentials,
    currentUser,
    isAuthLoading,
    isAppConfigured,
    appConfig,
    verifyOtp,
    activeGroupId,
    selectGroup,
    clearSelectedGroup,
    refreshGroupDirectory,
  } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loginStep, setLoginStep] = useState<LoginStep>("credentials");

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
    if (loginStep === "credentials") {
      const result = await loginWithCredentials({
        name: loginName,
        password,
      });

      if (result.success) {
        if (result.requiresOtp) {
          setLoginStep("otp");
          toast({
            title: "OTP Sent",
            description: "OTP sent to admin mobile number.",
          });
        }
      } else {
        handleLoginFailure(result);
      }
    } else {
      const result = await verifyOtp(otp);
      if (!result.success) {
        handleLoginFailure(result);
      }
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
      setOtp("");
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
    setLoginStep("credentials");
    setPassword("");
    setOtp("");
  };

  const getButtonText = () => {
    if (isLoggingIn) {
      switch (loginStep) {
        case "credentials":
          return "Signing In...";
        case "otp":
          return "Verifying OTP...";
      }
    }
    switch (loginStep) {
      case "credentials":
        return "Sign In";
      case "otp":
        return "Verify OTP & Sign In";
      default:
        return "Sign In";
    }
  };

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
      <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden p-4">
        <div className="pointer-events-none absolute -left-16 top-10 h-60 w-60 rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-500/20" />
        <div className="pointer-events-none absolute -right-12 bottom-0 h-72 w-72 rounded-full bg-amber-300/30 blur-3xl dark:bg-amber-500/20" />
        <Card className="modern-surface w-full max-w-md border-0 shadow-xl">
          <CardHeader className="items-center text-center">
            <Logo className="mb-4 h-16 w-16" />
            <CardTitle>Welcome to Shared Expense Tracker</CardTitle>
            <CardDescription>
              Join an existing group or create a new one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="group-id-input">Join by group ID</Label>
              <div className="flex gap-2">
                <Input
                  id="group-id-input"
                  value={groupIdInput}
                  onChange={(e) => setGroupIdInput(e.target.value)}
                  placeholder="e.g. flat-2-ab12cd"
                />
                <Button
                  variant="secondary"
                  onClick={() => handleSelectGroup(groupIdInput.trim())}
                  disabled={!groupIdInput.trim()}
                >
                  Join
                </Button>
              </div>
            </div>
            <Button className="w-full" asChild>
              <Link href="/setup">
                Signup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              className="w-full"
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
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute -left-16 top-10 h-60 w-60 rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-500/20" />
      <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-emerald-300/25 blur-3xl dark:bg-emerald-500/20" />
      <div className="pointer-events-none absolute -right-14 bottom-0 h-72 w-72 rounded-full bg-amber-300/30 blur-3xl dark:bg-amber-500/20" />
      <Card className="modern-surface w-full max-w-md border-0 shadow-xl">
        <CardHeader className="items-center text-center">
          <Logo className="mb-4 h-16 w-16" />
          <CardTitle className="text-2xl tracking-tight">
            Welcome to {appConfig?.groupName || "Shared Expense Tracker"}
          </CardTitle>
          <CardDescription>Sign in or signup for a new group</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-xl border border-border/70 bg-background/70 p-3 text-sm">
            <div className="font-medium">
              Active group: {appConfig?.groupName || activeGroupId}
            </div>
            <div className="mt-1 text-muted-foreground">
              ID: {activeGroupId}
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await clearSelectedGroup();
                  setLoginName("");
                  resetLoginFlow();
                }}
              >
                Switch Group
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/setup">Create New Group</Link>
              </Button>
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
          <div className="space-y-6">
            {loginStep === "credentials" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-name-input">Name</Label>
                  <Input
                    id="login-name-input"
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    placeholder="Type your name"
                    disabled={isLoggingIn || isLocked}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-input">Password</Label>
                  <Input
                    id="password-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Type your password"
                    disabled={isLoggingIn || isLocked}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                </div>
              </div>
            )}

            {loginStep === "otp" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp-input">Enter OTP</Label>
                  <Input
                    id="otp-input"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    disabled={isLoggingIn}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                </div>
                <Button
                  variant="link"
                  size="sm"
                  onClick={resetLoginFlow}
                  className="p-0 h-auto"
                >
                  Back to login
                </Button>
              </div>
            )}

            <div id="recaptcha-container"></div>

            <Button
              onClick={handleLogin}
              className="w-full"
              disabled={
                isLoggingIn ||
                isLocked ||
                (loginStep === "credentials" &&
                  (!loginName.trim() || !password.trim())) ||
                (loginStep === "otp" && !otp.trim())
              }
            >
              {getButtonText()}
            </Button>
          </div>

          <div className="mt-6 border-t pt-4 text-center text-sm text-muted-foreground">
            Need a new group?{" "}
            <Link
              href="/setup"
              className="text-primary underline underline-offset-4"
            >
              Create Group
            </Link>
            .
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

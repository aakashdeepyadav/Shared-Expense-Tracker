"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type LoginStep = "credentials" | "phoneNumber" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [pin, setPin] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const { toast } = useToast();
  const {
    login,
    currentUser,
    isAuthLoading,
    isAppConfigured,
    appConfig,
    users,
    isDataLoading,
    getLockoutTime,
    verifyPin,
    savePhoneNumberAndSendOtp,
    verifyOtp,
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
    if (!isAppConfigured) {
      setLockoutTime(0);
      setTimeRemaining(0);
      return;
    }

    const checkLockout = () => {
      const lockedUntil = getLockoutTime(role, selectedUserId);
      setLockoutTime(lockedUntil);
    };
    checkLockout();

    const interval = setInterval(() => {
      const lockedUntil = getLockoutTime(role, selectedUserId);
      setLockoutTime(lockedUntil);
      if (lockedUntil > Date.now()) {
        setTimeRemaining(Math.ceil((lockedUntil - Date.now()) / 1000));
      } else {
        setTimeRemaining(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAppConfigured, role, selectedUserId, getLockoutTime]);

  const handleAdminLogin = async () => {
    setIsLoggingIn(true);
    const result = await login("admin", adminPassword);
    if (result.success) {
      toast({
        title: "Admin Login Successful!",
        description: "Welcome, Admin!",
      });
    } else {
      handleLoginFailure(result);
    }
    setIsLoggingIn(false);
  };

  const handleMemberLogin = async () => {
    if (loginStep === "credentials") {
      setIsLoggingIn(true);
      const result = await verifyPin(selectedUserId, pin);

      if (result.success) {
        if (result.needsPhoneNumber) {
          setLoginStep("phoneNumber");
        } else {
          toast({
            title: "OTP Sent",
            description: "An OTP has been sent to your phone.",
          });
          setLoginStep("otp");
        }
      } else {
        handleLoginFailure(result);
      }
      setIsLoggingIn(false);
    } else if (loginStep === "phoneNumber") {
      setIsLoggingIn(true);
      if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
        toast({
          variant: "destructive",
          title: "Invalid Phone Number",
          description: "Please enter a valid 10-digit Indian mobile number.",
        });
        setIsLoggingIn(false);
        return;
      }
      const fullPhoneNumber = `+91${phoneNumber}`;
      const result = await savePhoneNumberAndSendOtp(
        selectedUserId,
        fullPhoneNumber,
      );
      if (result.success) {
        toast({
          title: "Phone Number Saved & OTP Sent",
          description: "An OTP has been sent to your phone.",
        });
        setLoginStep("otp");
      } else {
        handleLoginFailure(result);
      }
      setIsLoggingIn(false);
    } else {
      setIsLoggingIn(true);
      const result = await verifyOtp(otp);
      if (!result.success) {
        handleLoginFailure(result);
      }
      setIsLoggingIn(false);
    }
  };

  const handleLogin = async () => {
    if (role === "admin") {
      await handleAdminLogin();
    } else {
      await handleMemberLogin();
    }
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
      setPin("");
      setAdminPassword("");
      setOtp("");
    }
  };

  const isLocked = lockoutTime > Date.now();

  const resetLoginFlow = () => {
    setLoginStep("credentials");
    setPin("");
    setOtp("");
    setPhoneNumber("");
  };

  const getButtonText = () => {
    if (isLoggingIn) {
      switch (loginStep) {
        case "credentials":
          return "Verifying PIN...";
        case "phoneNumber":
          return "Saving & Sending OTP...";
        case "otp":
          return "Verifying OTP...";
      }
    }
    switch (loginStep) {
      case "credentials":
        return "Sign In";
      case "phoneNumber":
        return "Save & Send OTP";
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
              Create a group once using Signup, then login and use the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" asChild>
              <Link href="/setup">
                Signup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="w-full" disabled>
              Login will be enabled after setup
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
          {isLocked && activeTab === "login" && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Too Many Failed Attempts</AlertTitle>
              <AlertDescription>
                Please try again in {Math.ceil(timeRemaining / 60)} minute(s)
                and {timeRemaining % 60} seconds.
              </AlertDescription>
            </Alert>
          )}
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "login" | "signup")}
          >
            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-slate-100/90 p-1 dark:bg-slate-800/80">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Signup</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-6">
              {loginStep === "credentials" && (
                <>
                  <div className="space-y-2">
                    <Label>Login as</Label>
                    <RadioGroup
                      defaultValue="member"
                      onValueChange={(value: "member" | "admin") =>
                        setRole(value)
                      }
                      className="flex gap-4"
                      disabled={isLocked}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="member" id="r1" />
                        <Label htmlFor="r1">Member</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="admin" id="r2" />
                        <Label htmlFor="r2">Admin</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {role === "member" ? (
                    isDataLoading ? (
                      <div className="text-center text-muted-foreground">
                        Loading users...
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="user-select">Select User</Label>
                          <Select
                            onValueChange={setSelectedUserId}
                            value={selectedUserId}
                            disabled={isLocked}
                          >
                            <SelectTrigger id="user-select">
                              <SelectValue placeholder="Select your name" />
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
                        <div className="space-y-2">
                          <Label htmlFor="pin-input">PIN</Label>
                          <Input
                            id="pin-input"
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            placeholder="Enter your 6-digit PIN"
                            maxLength={6}
                            disabled={
                              isLoggingIn || isLocked || !selectedUserId
                            }
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleLogin()
                            }
                          />
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="admin-password-input">
                        Admin Password
                      </Label>
                      <Input
                        id="admin-password-input"
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Enter Admin Password"
                        disabled={isLoggingIn || isLocked}
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      />
                    </div>
                  )}
                </>
              )}

              {loginStep === "phoneNumber" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone-input">Enter Phone Number</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        +91
                      </span>
                      <Input
                        id="phone-input"
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) =>
                          setPhoneNumber(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder="98765 43210"
                        maxLength={10}
                        className="pl-10"
                        disabled={isLoggingIn}
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      We need your phone number for authentication. You will
                      only be asked for this once.
                    </p>
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
                  (role === "member" &&
                    loginStep === "credentials" &&
                    (isDataLoading || !selectedUserId)) ||
                  isLocked
                }
              >
                {getButtonText()}
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                Create a new group. All data will be stored in this app&apos;s
                Firebase project.
              </div>
              <Button className="w-full" asChild>
                <Link href="/setup">
                  Signup
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </TabsContent>
          </Tabs>

          <div className="mt-6 border-t pt-4 text-center text-sm text-muted-foreground">
            Need a brand-new tracker?{" "}
            <Link
              href="/setup"
              className="text-primary underline underline-offset-4"
            >
              Signup
            </Link>
            .
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


"use client";

import { useState, useEffect } from "react";
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
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";
import { LoginShimmer } from "@/components/shimmers/login-shimmer";

type LoginStep = 'credentials' | 'phoneNumber' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<"member" | "admin">("member");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [pin, setPin] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const { toast } = useToast();
  const { login, currentUser, isAuthLoading, users, isDataLoading, getLockoutTime, verifyPin, savePhoneNumberAndSendOtp, verifyOtp } =
    useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loginStep, setLoginStep] = useState<LoginStep>('credentials');

  useEffect(() => {
    if (!isAuthLoading && currentUser) {
      router.push("/");
    }
  }, [currentUser, isAuthLoading, router]);

  useEffect(() => {
    const checkLockout = () => {
        const lockedUntil = getLockoutTime(role, selectedUserId);
        setLockoutTime(lockedUntil);
    }
    checkLockout();
    
    // Check every second to update the timer
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

  }, [role, selectedUserId, getLockoutTime]);

  const handleAdminLogin = async () => {
    setIsLoggingIn(true);
    const result = await login('admin', adminPassword);
     if (result.success) {
        toast({ title: "Admin Login Successful!", description: "Welcome, Admin!" });
      } else {
        handleLoginFailure(result);
      }
    setIsLoggingIn(false);
  }

  const handleMemberLogin = async () => {
     if (loginStep === 'credentials') {
      setIsLoggingIn(true);
      const result = await verifyPin(selectedUserId, pin);

      if (result.success) {
        if (result.needsPhoneNumber) {
          setLoginStep('phoneNumber');
        } else {
          toast({ title: "OTP Sent", description: "An OTP has been sent to your phone." });
          setLoginStep('otp');
        }
      } else {
        handleLoginFailure(result);
      }
      setIsLoggingIn(false);

    } else if (loginStep === 'phoneNumber') {
      setIsLoggingIn(true);
      // Basic validation for Indian phone number
      if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
        toast({ variant: "destructive", title: "Invalid Phone Number", description: "Please enter a valid 10-digit Indian mobile number." });
        setIsLoggingIn(false);
        return;
      }
      const fullPhoneNumber = `+91${phoneNumber}`;
      const result = await savePhoneNumberAndSendOtp(selectedUserId, fullPhoneNumber);
      if (result.success) {
        toast({ title: "Phone Number Saved & OTP Sent", description: "An OTP has been sent to your phone." });
        setLoginStep('otp');
      } else {
        handleLoginFailure(result);
      }
       setIsLoggingIn(false);

    } else { // 'otp' step
      setIsLoggingIn(true);
      const result = await verifyOtp(otp);
      if (!result.success) {
        handleLoginFailure(result);
      }
      // On success, AuthProvider will handle redirect
       setIsLoggingIn(false);
    }
  }
  
  const handleLogin = async () => {
      if (role === 'admin') {
          await handleAdminLogin();
      } else {
          await handleMemberLogin();
      }
  };
  
  const handleLoginFailure = (result: { success: boolean, lockedUntil?: number, message?: string }) => {
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
     // Don't reset pin/password on lockout, only on other failures.
     if (!result.lockedUntil) {
        setPin("");
        setAdminPassword("");
        setOtp("");
     }
  }
  
  const isLocked = lockoutTime > Date.now();
  
  const resetLoginFlow = () => {
    setLoginStep('credentials');
    setPin('');
    setOtp('');
    setPhoneNumber('');
  }

  const getButtonText = () => {
    if (isLoggingIn) {
      switch (loginStep) {
        case 'credentials': return "Verifying PIN...";
        case 'phoneNumber': return "Saving & Sending OTP...";
        case 'otp': return "Verifying OTP...";
      }
    }
    switch (loginStep) {
      case 'credentials': return "Sign In";
      case 'phoneNumber': return "Save & Send OTP";
      case 'otp': return "Verify OTP & Sign In";
      default: return "Sign In";
    }
  }

  // The global shimmer in RootLayout handles the isAuthLoading case
  if (isAuthLoading || currentUser) {
    return null;
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="items-center text-center">
          <Logo className="mb-4 h-16 w-16" />
          <CardTitle>Welcome to TiFresh</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
           {isLocked && (
            <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Too Many Failed Attempts</AlertTitle>
                <AlertDescription>
                    Please try again in {Math.ceil(timeRemaining / 60)} minute(s) and {timeRemaining % 60} seconds.
                </AlertDescription>
            </Alert>
           )}
          <div className="w-full space-y-6">
            {loginStep === 'credentials' && (
              <>
                 <div className="space-y-2">
                  <Label>Login as</Label>
                  <RadioGroup
                    defaultValue="member"
                    onValueChange={(value: "member" | "admin") => setRole(value)}
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
                        <Select onValueChange={setSelectedUserId} value={selectedUserId} disabled={isLocked}>
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
                          disabled={isLoggingIn || isLocked || !selectedUserId}
                          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                        />
                      </div>
                    </div>
                  )
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="admin-password-input">Admin Password</Label>
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

            {loginStep === 'phoneNumber' && (
              <div className="space-y-4">
                 <div className="space-y-2">
                   <Label htmlFor="phone-input">Enter Phone Number</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">+91</span>
                      <Input
                        id="phone-input"
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="98765 43210"
                        maxLength={10}
                        className="pl-10"
                        disabled={isLoggingIn}
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      />
                    </div>
                     <p className="text-xs text-muted-foreground">We need your phone number for authentication. You will only be asked for this once.</p>
                 </div>
                 <Button variant="link" size="sm" onClick={resetLoginFlow} className="p-0 h-auto">
                    Back to login
                  </Button>
               </div>
            )}
            
            {loginStep === 'otp' && (
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
                  <Button variant="link" size="sm" onClick={resetLoginFlow} className="p-0 h-auto">
                    Back to login
                  </Button>
               </div>
            )}
            
            <div id="recaptcha-container"></div>

            <Button
              onClick={handleLogin}
              className="w-full"
              disabled={isLoggingIn || (role === "member" && loginStep === 'credentials' && (isDataLoading || !selectedUserId)) || isLocked}
            >
              {getButtonText()}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

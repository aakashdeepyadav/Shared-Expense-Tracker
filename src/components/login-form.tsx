"use client";

import { useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

export function LoginForm() {
  const [role, setRole] = useState<"member" | "admin">("member");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const { toast } = useToast();
  const { login, verifyPin, users, isDataLoading } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    if (role === "admin") {
      const result = await login("admin", adminPin);
      if (result.success) {
        toast({
          title: "Admin Login Successful!",
          description: "Welcome, Admin!",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Invalid Admin PIN",
          description: "The PIN you entered is incorrect.",
        });
        setAdminPin("");
      }
    } else {
      if (!selectedUserId) {
        toast({
          variant: "destructive",
          title: "Please select a user.",
        });
        setIsLoggingIn(false);
        return;
      }
      const result = await verifyPin(selectedUserId, pin);
      if (result.success) {
        const userName = users.find((u) => u.id === selectedUserId)?.name;
        toast({
          title: "Login Successful!",
          description: `Welcome back, ${userName}!`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Invalid PIN",
          description: "The PIN you entered is incorrect. Please try again.",
        });
        setPin("");
      }
    }
    setIsLoggingIn(false);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Login as</Label>
        <RadioGroup
          defaultValue="member"
          onValueChange={(value: "member" | "admin") => setRole(value)}
          className="flex gap-4"
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
              <Select onValueChange={setSelectedUserId}>
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
                placeholder="Enter your 4-digit PIN"
                maxLength={4}
                disabled={isLoggingIn}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
          </div>
        )
      ) : (
        <div className="space-y-2">
          <Label htmlFor="admin-pin-input">Admin PIN</Label>
          <Input
            id="admin-pin-input"
            type="password"
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value)}
            placeholder="Enter Admin PIN"
            maxLength={4}
            disabled={isLoggingIn}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
        </div>
      )}

      <Button
        onClick={handleLogin}
        className="w-full"
        disabled={isLoggingIn || (role === "member" && isDataLoading)}
      >
        {isLoggingIn ? "Signing In..." : "Sign In"}
      </Button>
    </div>
  );
}

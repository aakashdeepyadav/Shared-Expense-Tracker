"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { initializeTrackerInstance, isGroupIdAvailable } from "@/lib/firestore";
import { CheckCircle2 } from "lucide-react";
import type { SetupMemberInput, TrackerSetupPayload } from "@/lib/types";

type SetupStep = "group" | "members" | "memberDetails" | "admin" | "review";

const setupSteps: SetupStep[] = [
  "group",
  "members",
  "memberDetails",
  "admin",
  "review",
];
const MAX_IMAGE_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const GROUP_ID_REGEX = /^[a-z0-9-]{3,30}$/;

const defaultMember = (): SetupMemberInput => ({
  name: "",
  pin: "",
  phoneNumber: "",
  avatarUrl: "",
  memberType: "student",
});

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Please upload a valid image file.";
  }
  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    return "Image size must be 2MB or smaller.";
  }
  return null;
}

function normalizeGroupIdInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export default function SetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthLoading, refreshAppSetup } = useAuth();

  const [currentStep, setCurrentStep] = useState<SetupStep>("group");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [groupName, setGroupName] = useState("");
  const [groupImageUrl, setGroupImageUrl] = useState("");
  const [memberTypeLabel, setMemberTypeLabel] = useState("student");
  const [memberCount, setMemberCount] = useState(4);
  const [members, setMembers] = useState<SetupMemberInput[]>(
    Array.from({ length: 4 }, defaultMember),
  );
  const [adminIndex, setAdminIndex] = useState(0);
  const [adminPassword, setAdminPassword] = useState("");
  const [sharedMemberPin, setSharedMemberPin] = useState("");
  const [adminPhoneNumber, setAdminPhoneNumber] = useState("");
  const [isCheckingGroupId, setIsCheckingGroupId] = useState(false);
  const [isGroupIdAvailableState, setIsGroupIdAvailableState] = useState<
    boolean | null
  >(null);

  const stepIndex = setupSteps.indexOf(currentStep);

  const canContinue = useMemo(() => {
    if (currentStep === "group")
      return GROUP_ID_REGEX.test(groupName) && isGroupIdAvailableState === true;
    if (currentStep === "members") return memberCount >= 2;
    if (currentStep === "memberDetails")
      return members.every((m) => m.name.trim().length > 0);
    if (currentStep === "admin")
      return (
        adminIndex >= 0 &&
        adminIndex < members.length &&
        adminPassword.trim().length >= 8 &&
        /^\d{6}$/.test(sharedMemberPin) &&
        /^[6-9]\d{9}$/.test(adminPhoneNumber)
      );
    return true;
  }, [
    currentStep,
    groupName,
    memberCount,
    members,
    adminIndex,
    adminPassword,
    sharedMemberPin,
    adminPhoneNumber,
    isGroupIdAvailableState,
  ]);

  const getStepCompletion = (step: SetupStep): number => {
    if (step === "group") return GROUP_ID_REGEX.test(groupName) ? 1 : 0;
    if (step === "members") return memberCount >= 2 ? 1 : 0;
    if (step === "memberDetails") {
      if (members.length === 0) return 0;
      const completed = members.filter(
        (member) => member.name.trim().length > 0,
      ).length;
      return completed / members.length;
    }
    if (step === "admin") {
      const selectedAdmin =
        adminIndex >= 0 && adminIndex < members.length ? 1 : 0;
      const passwordProgress = Math.min(adminPassword.trim().length / 8, 1);
      const pinProgress = /^\d{6}$/.test(sharedMemberPin) ? 1 : 0;
      const phoneProgress = /^[6-9]\d{9}$/.test(adminPhoneNumber) ? 1 : 0;
      return (
        (selectedAdmin + passwordProgress + pinProgress + phoneProgress) / 4
      );
    }
    return 1;
  };

  const progressValue =
    ((stepIndex + getStepCompletion(currentStep)) / setupSteps.length) * 100;

  const dotPatternLight = {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Ccircle cx='2' cy='2' r='1' fill='%2394a3b8'/%3E%3C/svg%3E\")",
  };
  const dotPatternDark = {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23475569'/%3E%3C/svg%3E\")",
  };

  const stepTitle = useMemo(() => {
    switch (currentStep) {
      case "group":
        return "Group identity";
      case "members":
        return "Member structure";
      case "memberDetails":
        return "Member profiles";
      case "admin":
        return "Admin access";
      case "review":
        return "Review & launch";
      default:
        return "Setup";
    }
  }, [currentStep]);

  const stepDescription = useMemo(() => {
    switch (currentStep) {
      case "group":
        return "Choose a unique group ID (lowercase letters, numbers, hyphens, no spaces).";
      case "members":
        return "Define member count and member type label.";
      case "memberDetails":
        return "Add name, phone and optional profile image.";
      case "admin":
        return "Choose an admin member, set admin password, and one shared member PIN.";
      case "review":
        return "Confirm details and create your group.";
      default:
        return "";
    }
  }, [currentStep]);

  const updateMemberCount = (nextCount: number) => {
    const sanitized = Math.max(2, Math.min(50, nextCount));
    setMemberCount(sanitized);
    setMembers((prev) => {
      if (sanitized === prev.length) return prev;
      if (sanitized < prev.length) return prev.slice(0, sanitized);
      const newEntries = Array.from(
        { length: sanitized - prev.length },
        defaultMember,
      );
      return [...prev, ...newEntries];
    });
    if (adminIndex >= sanitized) setAdminIndex(0);
  };

  const updateMember = (index: number, patch: Partial<SetupMemberInput>) => {
    setMembers((prev) =>
      prev.map((member, idx) =>
        idx === index ? { ...member, ...patch } : member,
      ),
    );
  };

  useEffect(() => {
    const phone = (members[adminIndex]?.phoneNumber || "")
      .replace(/\D/g, "")
      .slice(-10);
    setAdminPhoneNumber(phone);
  }, [adminIndex, members]);

  useEffect(() => {
    const trimmed = groupName.trim();
    if (!trimmed) {
      setIsGroupIdAvailableState(null);
      setIsCheckingGroupId(false);
      return;
    }

    if (!GROUP_ID_REGEX.test(trimmed)) {
      setIsGroupIdAvailableState(false);
      setIsCheckingGroupId(false);
      return;
    }

    setIsCheckingGroupId(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const available = await isGroupIdAvailable(trimmed);
        setIsGroupIdAvailableState(available);
      } catch {
        setIsGroupIdAvailableState(null);
      } finally {
        setIsCheckingGroupId(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [groupName]);

  const handleGroupImageUpload = async (file: File | undefined) => {
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      toast({
        variant: "destructive",
        title: "Invalid group image",
        description: validationError,
      });
      return;
    }
    const dataUrl = await toDataUrl(file);
    setGroupImageUrl(dataUrl);
  };

  const handleMemberImageUpload = async (
    index: number,
    file: File | undefined,
  ) => {
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      toast({
        variant: "destructive",
        title: "Invalid profile image",
        description: validationError,
      });
      return;
    }
    const dataUrl = await toDataUrl(file);
    updateMember(index, { avatarUrl: dataUrl });
  };

  const goToNext = () => {
    const next = setupSteps[stepIndex + 1];
    if (next) setCurrentStep(next);
  };

  const goToPrevious = () => {
    const prev = setupSteps[stepIndex - 1];
    if (prev) setCurrentStep(prev);
  };

  const submitSetup = async () => {
    if (!canContinue) return;

    const payload: TrackerSetupPayload = {
      groupId: groupName,
      groupName,
      groupImageUrl: groupImageUrl || undefined,
      memberTypeLabel,
      members: members.map((member, index) => ({
        ...member,
        pin: sharedMemberPin,
        phoneNumber:
          index === adminIndex ? adminPhoneNumber : member.phoneNumber,
      })),
      adminIndex,
      adminPassword,
    };

    setIsSubmitting(true);
    try {
      await initializeTrackerInstance(payload);
      await refreshAppSetup();
      toast({
        title: "Group created",
        description: "Setup complete. Continue to login.",
      });
      router.push("/login");
    } catch (error: unknown) {
      const errorCode =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : undefined;

      const rawMessage = error instanceof Error ? error.message : "";
      const isPermissionError =
        errorCode === "permission-denied" ||
        /missing or insufficient permissions/i.test(rawMessage);

      toast({
        variant: "destructive",
        title: "Setup failed",
        description: isPermissionError
          ? "Firestore rules blocked setup. Deploy firestore.rules to this Firebase project and try again."
          : error instanceof Error
            ? error.message
            : "Could not create tracker instance.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading) return null;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 p-4 dark:bg-slate-950 md:p-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-35 dark:hidden"
        style={dotPatternLight}
      />
      <div
        className="pointer-events-none absolute inset-0 hidden opacity-30 dark:block"
        style={dotPatternDark}
      />
      <div className="pointer-events-none absolute left-10 top-10 h-20 w-20 rounded-2xl border border-cyan-200 bg-cyan-100/70 dark:border-cyan-900 dark:bg-cyan-950/40" />
      <div className="pointer-events-none absolute right-12 top-24 h-16 w-16 rounded-full border border-emerald-200 bg-emerald-100/70 dark:border-emerald-900 dark:bg-emerald-950/40" />
      <div className="pointer-events-none absolute bottom-12 right-16 h-24 w-24 rounded-xl border border-amber-200 bg-amber-100/70 dark:border-amber-900 dark:bg-amber-950/40" />
      <div className="relative mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Create your group
            </h1>
            <p className="text-muted-foreground">
              Simple setup in your app&apos;s Firebase.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/login")}>
            Back to Login
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="modern-surface border-0 h-fit">
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Setup Progress</CardTitle>
              <CardDescription>
                {Math.round(progressValue)}% complete
              </CardDescription>
              <Progress value={progressValue} className="h-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {setupSteps.map((step, idx) => {
                  const isDone = idx < stepIndex;
                  const isActive = step === currentStep;
                  return (
                    <div
                      key={step}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-xs">
                          {idx + 1}
                        </span>
                      )}
                      <span className="capitalize">
                        {step === "memberDetails" ? "Member details" : step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="modern-surface border-0">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>{stepTitle}</CardTitle>
                  <CardDescription className="mt-1">
                    {stepDescription}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  Step {stepIndex + 1} of {setupSteps.length}
                </Badge>
              </div>
              <Progress value={progressValue} className="h-2" />
            </CardHeader>
            <CardContent className="space-y-6">
              {currentStep === "group" && (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="group-name">Group ID</Label>
                    <Input
                      id="group-name"
                      value={groupName}
                      onChange={(e) =>
                        setGroupName(normalizeGroupIdInput(e.target.value))
                      }
                      placeholder="flat2"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use 3-30 characters: lowercase letters, numbers, and
                      hyphens only.
                    </p>
                    <p
                      className={`text-xs ${
                        isCheckingGroupId
                          ? "text-muted-foreground"
                          : isGroupIdAvailableState === true
                            ? "text-emerald-600"
                            : isGroupIdAvailableState === false &&
                                GROUP_ID_REGEX.test(groupName)
                              ? "text-destructive"
                              : "text-muted-foreground"
                      }`}
                    >
                      {isCheckingGroupId
                        ? "Checking group ID availability..."
                        : isGroupIdAvailableState === true
                          ? "Group ID is available."
                          : isGroupIdAvailableState === false &&
                              GROUP_ID_REGEX.test(groupName)
                            ? "Group ID already exists. Choose another one."
                            : ""}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="group-image">Group image</Label>
                    <Input
                      id="group-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleGroupImageUpload(e.target.files?.[0])
                      }
                    />
                    <p className="text-xs text-muted-foreground">Optional</p>
                    {groupImageUrl && (
                      <Image
                        src={groupImageUrl}
                        alt="Group preview"
                        width={96}
                        height={96}
                        unoptimized
                        className="h-24 w-24 rounded-md object-cover border"
                      />
                    )}
                  </div>
                </div>
              )}

              {currentStep === "members" && (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="member-count">Number of members</Label>
                    <Input
                      id="member-count"
                      type="number"
                      min={2}
                      max={50}
                      value={memberCount}
                      onChange={(e) =>
                        updateMemberCount(Number(e.target.value || 2))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="member-type">Member type label</Label>
                    <Select
                      value={memberTypeLabel}
                      onValueChange={setMemberTypeLabel}
                    >
                      <SelectTrigger id="member-type">
                        <SelectValue placeholder="Select profile type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="professional">
                          Professional
                        </SelectItem>
                        <SelectItem value="family">Family</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {currentStep === "memberDetails" && (
                <div className="space-y-4">
                  {members.map((member, index) => (
                    <Card
                      key={`member-${index}`}
                      className="modern-surface border-0"
                    >
                      <CardHeader>
                        <CardTitle className="text-base">
                          Member {index + 1}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={member.name}
                            onChange={(e) =>
                              updateMember(index, { name: e.target.value })
                            }
                            placeholder={`Member ${index + 1} name`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone (optional)</Label>
                          <Input
                            value={member.phoneNumber || ""}
                            onChange={(e) =>
                              updateMember(index, {
                                phoneNumber: e.target.value.replace(/\D/g, ""),
                              })
                            }
                            placeholder="9876543210"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Profile image</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              handleMemberImageUpload(
                                index,
                                e.target.files?.[0],
                              )
                            }
                          />
                          {member.avatarUrl && (
                            <Image
                              src={member.avatarUrl}
                              alt={`${member.name || `Member ${index + 1}`} avatar`}
                              width={64}
                              height={64}
                              unoptimized
                              className="h-16 w-16 rounded-md object-cover border"
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {currentStep === "admin" && (
                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Choose admin member</Label>
                      <Select
                        value={String(adminIndex)}
                        onValueChange={(value) => setAdminIndex(Number(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select admin" />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((member, index) => (
                            <SelectItem
                              key={`admin-${index}`}
                              value={String(index)}
                            >
                              {member.name || `Member ${index + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-password">Admin password</Label>
                      <Input
                        id="admin-password"
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="At least 8 characters"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shared-member-pin">
                        Shared PIN (non-admin members)
                      </Label>
                      <Input
                        id="shared-member-pin"
                        type="password"
                        value={sharedMemberPin}
                        onChange={(e) =>
                          setSharedMemberPin(e.target.value.replace(/\D/g, ""))
                        }
                        maxLength={6}
                        placeholder="6-digit PIN for non-admin members"
                      />
                    </div>
                  </div>

                  <Card className="modern-surface border-0">
                    <CardHeader>
                      <CardTitle className="text-base">Admin contact</CardTitle>
                      <CardDescription>
                        Add admin mobile number for records and account
                        recovery.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="admin-phone">Admin mobile number</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            +91
                          </span>
                          <Input
                            id="admin-phone"
                            type="tel"
                            value={adminPhoneNumber}
                            onChange={(e) =>
                              setAdminPhoneNumber(
                                e.target.value.replace(/\D/g, ""),
                              )
                            }
                            onBlur={() =>
                              updateMember(adminIndex, {
                                phoneNumber: adminPhoneNumber,
                              })
                            }
                            placeholder="9876543210"
                            maxLength={10}
                            className="pl-10"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {currentStep === "review" && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Group name
                      </p>
                      <p className="font-medium">{groupName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Members</p>
                      <p className="font-medium">{members.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Admin</p>
                      <p className="font-medium">
                        {members[adminIndex]?.name || "Not selected"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={goToPrevious}
                disabled={stepIndex === 0 || isSubmitting}
              >
                Back
              </Button>
              {currentStep === "review" ? (
                <Button
                  onClick={submitSetup}
                  disabled={!canContinue || isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Create Group"}
                </Button>
              ) : (
                <Button onClick={goToNext} disabled={!canContinue}>
                  Continue
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

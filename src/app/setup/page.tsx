"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { initializeTrackerInstance } from "@/lib/firestore";
import { setRuntimeFirebaseConfig } from "@/lib/firebase";
import {
  controlAuth,
  registerGroupControlRecord,
  setActiveControlGroupId,
} from "@/lib/control-plane";
import {
  ConfirmationResult,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
} from "firebase/auth";
import { CheckCircle2, Info } from "lucide-react";
import type {
  FirebaseProjectConfigInput,
  SetupMemberInput,
  TrackerTheme,
  TrackerSetupPayload,
} from "@/lib/types";

type SetupStep =
  | "group"
  | "members"
  | "memberDetails"
  | "admin"
  | "integrations"
  | "review";

const setupSteps: SetupStep[] = [
  "group",
  "members",
  "memberDetails",
  "admin",
  "integrations",
  "review",
];

const MAX_IMAGE_FILE_SIZE_BYTES = 2 * 1024 * 1024;

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

function validateFirebaseProjectConfig(
  config: FirebaseProjectConfigInput | null,
): string | null {
  if (!config) {
    return null;
  }

  const requiredKeys: Array<keyof FirebaseProjectConfigInput> = [
    "apiKey",
    "authDomain",
    "projectId",
    "appId",
  ];

  const missing = requiredKeys.filter((key) => !config[key]?.trim());
  if (missing.length > 0) {
    return `Missing required Firebase keys: ${missing.join(", ")}.`;
  }

  return null;
}

function generateGroupIdForSetup(groupName: string): string {
  const slug = groupName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slug || "group"}-${suffix}`;
}

function normalizeIndianPhoneNumber(phoneNumber?: string): string | null {
  if (!phoneNumber) return null;
  const onlyDigits = phoneNumber.replace(/\D/g, "");
  if (onlyDigits.length === 10) {
    return `+91${onlyDigits}`;
  }
  if (phoneNumber.startsWith("+")) {
    return phoneNumber;
  }
  return null;
}

async function hashSha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export default function SetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthLoading, isAppConfigured, appConfig, refreshAppSetup } =
    useAuth();

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
  const [themePreference, setThemePreference] =
    useState<TrackerTheme>("system");
  const [modelApiKey, setModelApiKey] = useState("");
  const [firebaseProjectConfig, setFirebaseProjectConfig] =
    useState<FirebaseProjectConfigInput | null>(null);
  const [firebaseJsonInput, setFirebaseJsonInput] = useState("");
  const [adminOtp, setAdminOtp] = useState("");
  const [adminOtpSent, setAdminOtpSent] = useState(false);
  const [adminOtpVerified, setAdminOtpVerified] = useState(false);
  const [isSendingAdminOtp, setIsSendingAdminOtp] = useState(false);
  const [isVerifyingAdminOtp, setIsVerifyingAdminOtp] = useState(false);
  const [lastOtpPhone, setLastOtpPhone] = useState<string | null>(null);
  const [adminOtpConfirmation, setAdminOtpConfirmation] =
    useState<ConfirmationResult | null>(null);
  const setupRecaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (!isAuthLoading && isAppConfigured) {
      router.push("/login");
    }
  }, [isAuthLoading, isAppConfigured, router]);

  const stepIndex = setupSteps.indexOf(currentStep);
  const adminPhoneE164 = useMemo(
    () => normalizeIndianPhoneNumber(members[adminIndex]?.phoneNumber),
    [members, adminIndex],
  );

  useEffect(() => {
    setAdminOtpSent(false);
    setAdminOtpVerified(false);
    setAdminOtp("");
    setAdminOtpConfirmation(null);
    setLastOtpPhone(null);
  }, [adminPhoneE164]);

  const canContinue = useMemo(() => {
    if (currentStep === "group") {
      return groupName.trim().length > 1;
    }
    if (currentStep === "members") {
      return memberCount >= 2;
    }
    if (currentStep === "memberDetails") {
      return members.every(
        (m) => m.name.trim() && /^\d{6}$/.test(m.pin.trim()),
      );
    }
    if (currentStep === "admin") {
      return (
        adminIndex >= 0 &&
        adminIndex < members.length &&
        adminPassword.trim().length >= 8 &&
        !!adminPhoneE164 &&
        adminOtpVerified
      );
    }
    if (currentStep === "integrations") {
      return !validateFirebaseProjectConfig(firebaseProjectConfig);
    }
    return true;
  }, [
    currentStep,
    groupName,
    memberCount,
    members,
    adminIndex,
    adminPassword,
    adminPhoneE164,
    adminOtpVerified,
    firebaseProjectConfig,
  ]);

  const getStepCompletion = (step: SetupStep): number => {
    if (step === "group") {
      return groupName.trim().length > 1 ? 1 : 0;
    }
    if (step === "members") {
      return memberCount >= 2 ? 1 : 0;
    }
    if (step === "memberDetails") {
      if (members.length === 0) return 0;
      const completed = members.filter(
        (member) =>
          member.name.trim().length > 0 && /^\d{6}$/.test(member.pin.trim()),
      ).length;
      return completed / members.length;
    }
    if (step === "admin") {
      const selectedAdmin =
        adminIndex >= 0 && adminIndex < members.length ? 1 : 0;
      const passwordProgress = Math.min(adminPassword.trim().length / 8, 1);
      const phoneProgress = adminPhoneE164 ? 1 : 0;
      const otpProgress = adminOtpVerified ? 1 : 0;
      return (
        (selectedAdmin + passwordProgress + phoneProgress + otpProgress) / 4
      );
    }
    if (step === "integrations") {
      return 1;
    }
    return 1;
  };

  const progressValue =
    ((stepIndex + getStepCompletion(currentStep)) / setupSteps.length) * 100;
  const progressLabel = `${Math.round(progressValue)}% complete`;

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
      case "integrations":
        return "Integrations & theme";
      case "review":
        return "Review & launch";
      default:
        return "Setup";
    }
  }, [currentStep]);

  const stepDescription = useMemo(() => {
    switch (currentStep) {
      case "group":
        return "Start with group name and image. This branding will appear in your tracker.";
      case "members":
        return "Define your member count and default profile type.";
      case "memberDetails":
        return "Capture each member's name, PIN, avatar and optional phone.";
      case "admin":
        return "Pick one member as admin and create admin password for full access.";
      case "integrations":
        return "Set theme and optional integrations. You can skip Firebase JSON for a free setup.";
      case "review":
        return "Confirm everything before creating your expense tracker instance.";
      default:
        return "";
    }
  }, [currentStep]);

  const updateMemberCount = (nextCount: number) => {
    const sanitized = Math.max(2, Math.min(20, nextCount));
    setMemberCount(sanitized);
    setMembers((prev) => {
      if (sanitized === prev.length) {
        return prev;
      }
      if (sanitized < prev.length) {
        return prev.slice(0, sanitized);
      }
      const newEntries = Array.from(
        { length: sanitized - prev.length },
        defaultMember,
      );
      return [...prev, ...newEntries];
    });
    if (adminIndex >= sanitized) {
      setAdminIndex(0);
    }
  };

  const updateMember = (index: number, patch: Partial<SetupMemberInput>) => {
    setMembers((prev) =>
      prev.map((member, idx) =>
        idx === index ? { ...member, ...patch } : member,
      ),
    );
  };

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

  const parseFirebaseJson = () => {
    if (!firebaseJsonInput.trim()) {
      setFirebaseProjectConfig(null);
      return;
    }
    try {
      const parsed = JSON.parse(firebaseJsonInput);
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Invalid JSON object");
      }
      setFirebaseProjectConfig(parsed as FirebaseProjectConfigInput);
      toast({
        title: "Firebase config parsed",
        description: "Project config JSON is valid.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Invalid Firebase JSON",
        description: "Please upload or paste a valid JSON object.",
      });
      setFirebaseProjectConfig(null);
    }
  };

  const handleFirebaseFileUpload = async (file: File | undefined) => {
    if (!file) return;
    const content = await file.text();
    setFirebaseJsonInput(content);
    try {
      const parsed = JSON.parse(content);
      setFirebaseProjectConfig(parsed as FirebaseProjectConfigInput);
      toast({
        title: "Firebase file loaded",
        description: "Configuration file has been parsed.",
      });
    } catch {
      setFirebaseProjectConfig(null);
      toast({
        variant: "destructive",
        title: "Could not parse file",
        description: "Uploaded file is not valid JSON.",
      });
    }
  };

  const goToNext = () => {
    const next = setupSteps[stepIndex + 1];
    if (next) {
      setCurrentStep(next);
    }
  };

  const goToPrevious = () => {
    const prev = setupSteps[stepIndex - 1];
    if (prev) {
      setCurrentStep(prev);
    }
  };

  const setupRecaptcha = () => {
    if (setupRecaptchaRef.current) {
      setupRecaptchaRef.current.clear();
      setupRecaptchaRef.current = null;
    }

    const container = document.getElementById("setup-recaptcha-container");
    if (!container) {
      return null;
    }

    setupRecaptchaRef.current = new RecaptchaVerifier(controlAuth, container, {
      size: "invisible",
    });

    return setupRecaptchaRef.current;
  };

  const handleSendAdminOtp = async () => {
    if (!adminPhoneE164) {
      toast({
        variant: "destructive",
        title: "Admin phone required",
        description: "Add a valid admin phone number to verify with OTP.",
      });
      return;
    }

    setIsSendingAdminOtp(true);
    try {
      const verifier = setupRecaptchaRef.current || setupRecaptcha();
      if (!verifier) {
        throw new Error("Recaptcha is not ready. Please try again.");
      }

      const confirmation = await signInWithPhoneNumber(
        controlAuth,
        adminPhoneE164,
        verifier,
      );
      setAdminOtpConfirmation(confirmation);
      setAdminOtpSent(true);
      setAdminOtpVerified(false);
      setLastOtpPhone(adminPhoneE164);
      toast({
        title: "OTP sent",
        description: `OTP sent to ${adminPhoneE164}`,
      });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "OTP failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not send OTP. Check Firebase Auth domain settings.",
      });
    } finally {
      setIsSendingAdminOtp(false);
    }
  };

  const handleVerifyAdminOtp = async () => {
    if (!adminOtpConfirmation || !adminOtp.trim()) {
      toast({
        variant: "destructive",
        title: "OTP required",
        description: "Enter the OTP you received to verify admin.",
      });
      return;
    }

    setIsVerifyingAdminOtp(true);
    try {
      await adminOtpConfirmation.confirm(adminOtp.trim());
      await signOut(controlAuth);
      setAdminOtpVerified(true);
      toast({
        title: "Admin verified",
        description: "Admin phone OTP verification is complete.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Invalid OTP",
        description: "Please check OTP and try again.",
      });
      setAdminOtpVerified(false);
    } finally {
      setIsVerifyingAdminOtp(false);
    }
  };

  const submitSetup = async () => {
    if (!canContinue) {
      return;
    }

    const firebaseValidationError = validateFirebaseProjectConfig(
      firebaseProjectConfig,
    );
    if (firebaseValidationError) {
      toast({
        variant: "destructive",
        title: "Firebase config format issue",
        description:
          "You can skip Firebase JSON and continue, or fix the JSON keys to save it now.",
      });
    }

    const payload: TrackerSetupPayload = {
      groupId: generateGroupIdForSetup(groupName),
      groupName,
      groupImageUrl: groupImageUrl || undefined,
      memberTypeLabel,
      members,
      adminIndex,
      adminPassword,
      themePreference,
      modelApiKey: modelApiKey || undefined,
      firebaseProjectConfig: firebaseValidationError
        ? undefined
        : firebaseProjectConfig || undefined,
    };

    if (payload.firebaseProjectConfig) {
      const switched = setRuntimeFirebaseConfig(payload.firebaseProjectConfig);
      if (!switched) {
        toast({
          variant: "destructive",
          title: "Invalid Firebase config",
          description: "Could not connect to the provided Firebase project.",
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const groupId = await initializeTrackerInstance(payload);

      const tenantConfigHash = await hashSha256(
        JSON.stringify(payload.firebaseProjectConfig || {}),
      );
      const adminPhoneHash = await hashSha256(adminPhoneE164 || "");

      await registerGroupControlRecord({
        groupId,
        groupName: payload.groupName,
        adminName: members[adminIndex]?.name || "Admin",
        adminPhoneHash,
        tenantProjectId: payload.firebaseProjectConfig?.projectId || null,
        tenantConfigHash,
        groupImageUrl: payload.groupImageUrl || null,
      });
      setActiveControlGroupId(groupId);

      await refreshAppSetup();
      toast({
        title: "Tracker instance created",
        description: "Your project is now configured. Continue to login.",
      });
      router.push("/login");
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Setup failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not create tracker instance.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading) {
    return null;
  }

  if (isAppConfigured && appConfig?.initialized) {
    return null;
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden p-4 md:p-8">
      <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl dark:bg-cyan-500/15" />
      <div className="pointer-events-none absolute right-0 top-20 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/15" />
      <div className="pointer-events-none absolute -right-12 bottom-0 h-72 w-72 rounded-full bg-amber-300/25 blur-3xl dark:bg-amber-500/15" />
      <div className="relative mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Create your shared expense tracker
            </h1>
            <p className="text-muted-foreground">
              Guided setup in six steps. No manual coding required.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/login")}>
            Back to Login
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="modern-surface border-0 shadow-xl h-fit">
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Setup Progress</CardTitle>
              <CardDescription>{progressLabel}</CardDescription>
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
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground"
                      }`}
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

          <Card className="modern-surface border-0 shadow-xl">
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
                    <Label htmlFor="group-name">Group name</Label>
                    <Input
                      id="group-name"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Flatmates 23A"
                    />
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
                    <p className="text-xs text-muted-foreground">
                      Optional. Add a logo/photo to personalize your tracker.
                    </p>
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
                      max={20}
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
                      className="modern-surface border-0 shadow-sm"
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
                          <Label>PIN (6 digits)</Label>
                          <Input
                            value={member.pin}
                            maxLength={6}
                            onChange={(e) =>
                              updateMember(index, {
                                pin: e.target.value.replace(/\D/g, ""),
                              })
                            }
                            placeholder="123456"
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
                  </div>

                  <Card className="border border-primary/20 bg-primary/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        Admin OTP Verification
                      </CardTitle>
                      <CardDescription>
                        Admin phone verification is required before setup can be
                        completed.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-sm text-muted-foreground">
                        Selected admin phone:{" "}
                        <strong>{adminPhoneE164 || "Not provided"}</strong>
                      </div>
                      {!adminPhoneE164 && (
                        <p className="text-sm text-destructive">
                          Add a valid 10-digit phone number for the selected
                          admin in Member details.
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleSendAdminOtp}
                          disabled={isSendingAdminOtp || !adminPhoneE164}
                        >
                          {isSendingAdminOtp ? "Sending OTP..." : "Send OTP"}
                        </Button>
                        {adminOtpSent && !adminOtpVerified && (
                          <Badge variant="secondary">OTP sent</Badge>
                        )}
                        {adminOtpVerified && (
                          <Badge className="bg-emerald-600">OTP verified</Badge>
                        )}
                      </div>
                      {adminOtpSent && (
                        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                          <Input
                            value={adminOtp}
                            onChange={(e) => setAdminOtp(e.target.value)}
                            placeholder="Enter 6-digit OTP"
                            maxLength={6}
                          />
                          <Button
                            type="button"
                            onClick={handleVerifyAdminOtp}
                            disabled={isVerifyingAdminOtp || !adminOtp.trim()}
                          >
                            {isVerifyingAdminOtp
                              ? "Verifying..."
                              : "Verify OTP"}
                          </Button>
                        </div>
                      )}
                      {lastOtpPhone && lastOtpPhone !== adminPhoneE164 && (
                        <p className="text-xs text-amber-600">
                          Admin phone changed. Please send OTP again.
                        </p>
                      )}
                      <div id="setup-recaptcha-container" />
                    </CardContent>
                  </Card>
                </div>
              )}

              {currentStep === "integrations" && (
                <div className="space-y-6">
                  <Card className="border border-primary/20 bg-primary/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Info className="h-4 w-4" />
                        Setup Guide: Firebase Keys
                      </CardTitle>
                      <CardDescription>
                        Create a web app in your Firebase project and copy the
                        Firebase SDK config object values here. This step is
                        optional for free setup.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p>1. Open Firebase Console, create/select project.</p>
                      <p>
                        2. Enable Authentication and Firestore for the same
                        project.
                      </p>
                      <p>3. Add a Web App and copy SDK config values.</p>
                      <p>
                        4. If you provide config, include:{" "}
                        <strong>apiKey</strong>, <strong>authDomain</strong>,{" "}
                        <strong>projectId</strong>, <strong>appId</strong>.
                      </p>
                      <p>
                        5. Free mode works on Firebase Spark plan. You can add
                        config later in project settings if needed.
                      </p>
                    </CardContent>
                  </Card>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Theme preference</Label>
                      <Select
                        value={themePreference}
                        onValueChange={(value: TrackerTheme) =>
                          setThemePreference(value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="system">System</SelectItem>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="model-key">
                        Model API key (optional)
                      </Label>
                      <Input
                        id="model-key"
                        type="password"
                        value={modelApiKey}
                        onChange={(e) => setModelApiKey(e.target.value)}
                        placeholder="For report generation"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="firebase-json-file">
                      Upload Firebase JSON (optional)
                    </Label>
                    <Input
                      id="firebase-json-file"
                      type="file"
                      accept="application/json"
                      onChange={(e) =>
                        handleFirebaseFileUpload(e.target.files?.[0])
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="firebase-json-text">
                      Or paste Firebase config JSON (optional)
                    </Label>
                    <Textarea
                      id="firebase-json-text"
                      rows={8}
                      value={firebaseJsonInput}
                      onChange={(e) => setFirebaseJsonInput(e.target.value)}
                      placeholder='{"apiKey":"...","authDomain":"...","projectId":"..."}'
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={parseFirebaseJson}
                    >
                      Validate JSON
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setFirebaseJsonInput("");
                        setFirebaseProjectConfig(null);
                        toast({
                          title: "Using free setup",
                          description:
                            "Firebase JSON skipped. You can complete setup now.",
                        });
                      }}
                    >
                      Skip for now
                    </Button>
                    {firebaseProjectConfig && (
                      <Badge>Firebase config ready</Badge>
                    )}
                  </div>
                  {validateFirebaseProjectConfig(firebaseProjectConfig) && (
                    <p className="text-sm text-destructive">
                      {validateFirebaseProjectConfig(firebaseProjectConfig)}
                    </p>
                  )}
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
                    <div>
                      <p className="text-sm text-muted-foreground">Theme</p>
                      <p className="font-medium capitalize">
                        {themePreference}
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Members to create
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {members.map((member, index) => (
                        <Badge
                          key={`review-${index}`}
                          variant={
                            index === adminIndex ? "default" : "secondary"
                          }
                        >
                          {member.name || `Member ${index + 1}`}{" "}
                          {index === adminIndex ? "(Admin)" : ""}
                        </Badge>
                      ))}
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
                  {isSubmitting
                    ? "Creating tracker..."
                    : "Create Tracker Instance"}
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

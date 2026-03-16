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
import { CheckCircle2 } from "lucide-react";
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

  useEffect(() => {
    if (!isAuthLoading && isAppConfigured) {
      router.push("/login");
    }
  }, [isAuthLoading, isAppConfigured, router]);

  const stepIndex = setupSteps.indexOf(currentStep);

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
        adminPassword.trim().length >= 8
      );
    }
    return true;
  }, [currentStep, groupName, memberCount, members, adminIndex, adminPassword]);

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
      return (selectedAdmin + passwordProgress) / 2;
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
        return "Attach Firebase project config, model API key and preferred theme.";
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

  const submitSetup = async () => {
    if (!canContinue) {
      return;
    }

    const payload: TrackerSetupPayload = {
      groupName,
      groupImageUrl: groupImageUrl || undefined,
      memberTypeLabel,
      members,
      adminIndex,
      adminPassword,
      themePreference,
      modelApiKey: modelApiKey || undefined,
      firebaseProjectConfig: firebaseProjectConfig || undefined,
    };

    setIsSubmitting(true);
    try {
      await initializeTrackerInstance(payload);
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
              )}

              {currentStep === "integrations" && (
                <div className="space-y-6">
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
                      Upload Firebase JSON
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
                      Or paste Firebase config JSON
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
                    {firebaseProjectConfig && (
                      <Badge>Firebase config ready</Badge>
                    )}
                  </div>
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

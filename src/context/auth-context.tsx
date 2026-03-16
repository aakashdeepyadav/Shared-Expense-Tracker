"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type {
  User,
  AppConfig,
  MemberSignupInput,
  GroupDirectoryEntry,
} from "@/lib/types";
import { useRouter, usePathname } from "next/navigation";
import {
  getUser,
  getAdminPassword,
  updateUserCredential as updateUserCredentialInDb,
  updateUserPhoneNumber,
  getAppConfig,
  getAllUsers,
  createMemberFromSignup,
  getGroupDirectory,
  selectGroupById,
  getActiveGroupId,
  setActiveGroupId,
  clearActiveGroupId,
} from "@/lib/firestore";
import { auth } from "@/lib/firebase";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut,
  ConfirmationResult,
} from "firebase/auth";

// --- Types ---
interface AuthContextType {
  currentUser: User | null;
  isAdmin: boolean;
  isAuthLoading: boolean;
  isDataLoading: boolean;
  isAppConfigured: boolean;
  appConfig: AppConfig | null;
  activeGroupId: string | null;
  availableGroups: GroupDirectoryEntry[];
  users: User[];
  loginWithCredentials: (params: {
    name: string;
    password: string;
  }) => Promise<{
    success: boolean;
    requiresOtp?: boolean;
    lockedUntil?: number;
    message?: string;
  }>;
  login: (
    role: "admin",
    credential?: string,
  ) => Promise<{ success: boolean; lockedUntil?: number; message?: string }>;
  verifyPin: (
    userId: string,
    pin: string,
  ) => Promise<{
    success: boolean;
    needsPhoneNumber?: boolean;
    lockedUntil?: number;
    message?: string;
  }>;
  savePhoneNumberAndSendOtp: (
    userId: string,
    phoneNumber: string,
  ) => Promise<{ success: boolean; message?: string }>;
  verifyOtp: (otp: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  updateUserCredential: (newCredential: string) => Promise<boolean>;
  registerMember: (
    payload: MemberSignupInput,
  ) => Promise<{ success: boolean; message?: string }>;
  refreshAppSetup: () => Promise<void>;
  refreshGroupDirectory: () => Promise<void>;
  selectGroup: (
    groupId: string,
  ) => Promise<{ success: boolean; message?: string }>;
  clearSelectedGroup: () => Promise<void>;
  getLockoutTime: (role: "admin" | "member", userId?: string) => number;
  getToken: () => Promise<string | null>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function isPermissionDeniedError(error: unknown): boolean {
  const code = getErrorCode(error);
  return code === "permission-denied" || code === "firestore/permission-denied";
}

// --- Hook ---
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}

const AuthContext = createContext<AuthContextType | null>(null);

// --- Constants ---
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 5;
const LOCAL_USER_ID_KEY = "shared-expense-tracker-userid";

// --- Helper functions (lockout logic) ---
const getAttemptsKey = (role: "admin" | "member", userId?: string) =>
  role === "admin" ? "login-attempts-admin" : `login-attempts-${userId}`;

const getLoginAttempts = (key: string) => {
  try {
    const attempts = localStorage.getItem(key);
    return attempts ? JSON.parse(attempts) : { count: 0, timestamp: 0 };
  } catch {
    return { count: 0, timestamp: 0 };
  }
};

const setLoginAttempts = (key: string, count: number, timestamp: number) => {
  try {
    localStorage.setItem(key, JSON.stringify({ count, timestamp }));
  } catch (error) {
    console.error("Could not write to localStorage", error);
  }
};

const clearLoginAttempts = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Could not clear localStorage", error);
  }
};

// --- Provider ---
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [isAppConfigured, setIsAppConfigured] = useState(false);
  const [activeGroupId, setActiveGroupIdState] = useState<string | null>(
    getActiveGroupId(),
  );
  const [availableGroups, setAvailableGroups] = useState<GroupDirectoryEntry[]>(
    [],
  );

  // State for OTP flow
  const [confirmationResult, setConfirmationResult] =
    useState<ConfirmationResult | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  // --- Setup reCAPTCHA ---
  const setupRecaptcha = useCallback(() => {
    // Only run on client
    if (typeof window === "undefined") return null;

    // Clear previous verifier if it exists
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
    }

    try {
      // Ensure the container is in the DOM before creating the verifier
      const container = document.getElementById("recaptcha-container");
      if (container) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, container, {
          size: "invisible",
          callback: () => {
            // reCAPTCHA solved, allow sign-in
          },
          "expired-callback": () => {
            // Response expired. Ask user to solve reCAPTCHA again.
            console.warn("Recaptcha expired. Please try again.");
            if (pathname === "/login") {
              setupRecaptcha(); // Re-initialize only on login page
            }
          },
        });
        return window.recaptchaVerifier;
      }
    } catch (error) {
      console.error("Recaptcha setup failed", error);
    }
    return null;
  }, [pathname]);

  // --- OTP Sender ---
  const sendOtp = async (phoneNumber: string) => {
    let verifier: RecaptchaVerifier | null | undefined =
      window.recaptchaVerifier;
    if (!verifier) {
      console.log("Recaptcha verifier not initialized, setting up now.");
      verifier = setupRecaptcha();
    }

    if (!verifier) {
      return {
        success: false,
        message: "Recaptcha not ready. Please wait a moment and try again.",
      };
    }

    try {
      const result = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setConfirmationResult(result);
      return { success: true };
    } catch (err: unknown) {
      console.error("OTP send error:", err);
      const errCode = getErrorCode(err);
      // This error is common if the domain is not whitelisted in Firebase console
      if (
        errCode === "auth/captcha-check-failed" ||
        errCode === "auth/invalid-app-credential"
      ) {
        return {
          success: false,
          message: `Please ensure this website's domain is authorized in your Firebase project settings.`,
        };
      }
      // Reset verifier on other errors to allow retry
      if (pathname === "/login") {
        setupRecaptcha();
      }
      return {
        success: false,
        message: `OTP could not be sent. ${errCode ?? "unknown_error"}`,
      };
    }
  };

  const refreshGroupDirectory = useCallback(async () => {
    try {
      const groups = await getGroupDirectory();
      setAvailableGroups(groups);
    } catch (error) {
      if (!isPermissionDeniedError(error)) {
        console.warn("Could not load groups:", getErrorMessage(error));
      }
      setAvailableGroups([]);
    }
  }, []);

  const loadActiveGroupData = useCallback(async (groupId?: string) => {
    const resolvedGroupId = groupId || getActiveGroupId();
    setActiveGroupIdState(resolvedGroupId || null);

    if (!resolvedGroupId) {
      setAppConfig(null);
      setIsAppConfigured(false);
      setUsers([]);
      return;
    }

    const loadedConfig = await getAppConfig(resolvedGroupId);
    setAppConfig(loadedConfig);
    setIsAppConfigured(!!loadedConfig?.initialized);

    if (!loadedConfig?.initialized) {
      setUsers([]);
      return;
    }

    try {
      const fetchedUsers = await getAllUsers();
      setUsers(fetchedUsers);
    } catch (usersError: unknown) {
      if (!isPermissionDeniedError(usersError)) {
        console.warn(
          "Users prefetch skipped during initialization:",
          getErrorMessage(usersError),
        );
      }
      setUsers([]);
    }
  }, []);

  // --- Init app and users ---
  useEffect(() => {
    const initialize = async () => {
      setIsAuthLoading(true);
      setIsDataLoading(true);
      try {
        await refreshGroupDirectory();
        await loadActiveGroupData();
      } catch (error) {
        if (!isPermissionDeniedError(error)) {
          console.error("Initialization error:", error);
        }
        setAppConfig(null);
        setIsAppConfigured(false);
      } finally {
        setIsDataLoading(false);
      }

      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        try {
          // Admin user is handled separately as it doesn't use Firebase Auth.
          const storedAdminId = localStorage.getItem(LOCAL_USER_ID_KEY);
          if (storedAdminId === "admin") {
            const adminUser = await getUser("admin");
            if (adminUser) {
              setCurrentUser(adminUser);
              setIsAdmin(true);
            } else {
              setCurrentUser(null);
              setIsAdmin(false);
              localStorage.removeItem(LOCAL_USER_ID_KEY);
            }
          } else if (firebaseUser) {
            const storedId = localStorage.getItem(LOCAL_USER_ID_KEY);
            if (storedId) {
              const appUser = await getUser(storedId);
              if (appUser) {
                setCurrentUser(appUser);
                setIsAdmin(false);
              } else {
                await signOut(auth); // Mismatch, sign out
              }
            } else {
              await signOut(auth); // No stored ID, sign out
            }
          } else {
            setCurrentUser(null);
            setIsAdmin(false);
            localStorage.removeItem(LOCAL_USER_ID_KEY);
          }
        } catch (authStateError) {
          if (!isPermissionDeniedError(authStateError)) {
            console.warn(
              "Auth state restore skipped due to permissions:",
              getErrorMessage(authStateError),
            );
          }
          setCurrentUser(null);
          setIsAdmin(false);
          localStorage.removeItem(LOCAL_USER_ID_KEY);
        } finally {
          setIsAuthLoading(false);
        }
      });

      return () => unsubscribe();
    };

    initialize();
  }, [loadActiveGroupData, refreshGroupDirectory]);

  const refreshAppSetup = async () => {
    await refreshGroupDirectory();
    await loadActiveGroupData();
  };

  const clearSelectedGroup = async () => {
    clearActiveGroupId();
    setActiveGroupIdState(null);
    setAppConfig(null);
    setIsAppConfigured(false);
    setUsers([]);
    setCurrentUser(null);
    setIsAdmin(false);
    localStorage.removeItem(LOCAL_USER_ID_KEY);
    await signOut(auth).catch(() => {
      // noop
    });
  };

  const selectGroup = async (groupId: string) => {
    try {
      const nextGroupId = groupId.trim();
      if (!nextGroupId) {
        return { success: false, message: "Group ID is required." };
      }

      await signOut(auth).catch(() => {
        // noop
      });
      localStorage.removeItem(LOCAL_USER_ID_KEY);
      setCurrentUser(null);
      setIsAdmin(false);

      const selectedConfig = await selectGroupById(nextGroupId);
      const canonicalGroupId = selectedConfig.groupId || nextGroupId;
      setActiveGroupId(canonicalGroupId);
      setActiveGroupIdState(canonicalGroupId);
      await loadActiveGroupData(canonicalGroupId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: getErrorMessage(error),
      };
    }
  };

  // --- Setup recaptcha only on login page ---
  useEffect(() => {
    if (
      isAppConfigured &&
      pathname === "/login" &&
      !isAuthLoading &&
      !currentUser
    ) {
      if (!window.recaptchaVerifier) {
        setupRecaptcha();
      }
    }
  }, [pathname, isAppConfigured, isAuthLoading, currentUser, setupRecaptcha]);

  // --- Lockout ---
  const getLockoutTime = (
    role: "admin" | "member",
    userId?: string,
  ): number => {
    if (typeof window === "undefined") return 0;
    const key = getAttemptsKey(role, userId);
    const attempts = getLoginAttempts(key);
    if (attempts.count < MAX_ATTEMPTS) return 0;

    const lockoutEnd = attempts.timestamp + LOCKOUT_MINUTES * 60 * 1000;
    if (Date.now() > lockoutEnd) {
      clearLoginAttempts(key);
      return 0;
    }
    return lockoutEnd;
  };

  const recordFailedAttempt = (role: "admin" | "member", userId?: string) => {
    const key = getAttemptsKey(role, userId);
    let attempts = getLoginAttempts(key);
    const now = Date.now();

    if (now > attempts.timestamp + LOCKOUT_MINUTES * 60 * 1000) {
      attempts = { count: 0, timestamp: 0 };
    }

    const count = attempts.count + 1;
    const timestamp = attempts.count === 0 ? now : attempts.timestamp;
    setLoginAttempts(key, count, timestamp);

    if (count >= MAX_ATTEMPTS) {
      return { lockedUntil: timestamp + LOCKOUT_MINUTES * 60 * 1000 };
    }
    return {};
  };

  const loginWithCredentials = async (params: {
    name: string;
    password: string;
  }): Promise<{
    success: boolean;
    requiresOtp?: boolean;
    lockedUntil?: number;
    message?: string;
  }> => {
    if (!isAppConfigured) {
      return {
        success: false,
        message:
          "Setup is not complete yet. Please finish configuration first.",
      };
    }

    const typedName = params.name.trim();
    const typedPassword = params.password.trim();
    if (!typedName || !typedPassword) {
      return {
        success: false,
        message: "Name and password are required.",
      };
    }

    const matchedUser = users.find(
      (user) => user.name.toLowerCase() === typedName.toLowerCase(),
    );

    if (!matchedUser) {
      return {
        success: false,
        message: "Invalid name or password.",
      };
    }

    const isMatchedAdmin = matchedUser.id === "admin";

    if (isMatchedAdmin) {
      const adminLockoutEnd = getLockoutTime("admin");
      if (Date.now() < adminLockoutEnd) {
        return { success: false, lockedUntil: adminLockoutEnd };
      }

      const adminPassword = await getAdminPassword();
      if (!adminPassword || adminPassword !== typedPassword) {
        const failure = recordFailedAttempt("admin");
        return {
          success: false,
          message: "Invalid name or password.",
          ...failure,
        };
      }

      if (!matchedUser.phoneNumber) {
        return {
          success: false,
          message:
            "Admin phone number is not set. Update it from setup/settings first.",
        };
      }

      const otpResult = await sendOtp(matchedUser.phoneNumber);
      if (!otpResult.success) {
        return {
          success: false,
          message: otpResult.message || "Could not send OTP.",
        };
      }

      clearLoginAttempts(getAttemptsKey("admin"));
      setPendingUserId("admin");
      return { success: true, requiresOtp: true };
    }

    const memberLockoutEnd = getLockoutTime("member", matchedUser.id);
    if (Date.now() < memberLockoutEnd) {
      return { success: false, lockedUntil: memberLockoutEnd };
    }

    if (matchedUser.pin !== typedPassword) {
      const failure = recordFailedAttempt("member", matchedUser.id);
      return {
        success: false,
        message: "Invalid name or password.",
        ...failure,
      };
    }

    clearLoginAttempts(getAttemptsKey("member", matchedUser.id));
    localStorage.setItem(LOCAL_USER_ID_KEY, matchedUser.id);
    setCurrentUser(matchedUser);
    setIsAdmin(false);
    router.push("/");
    return { success: true };
  };

  // --- Admin login ---
  const login = async (
    role: "admin",
    credential?: string,
  ): Promise<{ success: boolean; lockedUntil?: number; message?: string }> => {
    if (!isAppConfigured) {
      return {
        success: false,
        message:
          "Setup is not complete yet. Please finish configuration first.",
      };
    }

    const key = getAttemptsKey("admin");
    const lockoutEnd = getLockoutTime("admin");
    if (Date.now() < lockoutEnd)
      return { success: false, lockedUntil: lockoutEnd };

    const adminPassword = await getAdminPassword();
    if (adminPassword && credential === adminPassword) {
      const adminUser = await getUser("admin");
      if (adminUser) {
        localStorage.setItem(LOCAL_USER_ID_KEY, "admin");
        setCurrentUser(adminUser);
        setIsAdmin(true);
        clearLoginAttempts(key);
        router.push("/");
        return { success: true };
      }
    }

    const failure = recordFailedAttempt("admin");
    return { success: false, message: "Invalid admin password.", ...failure };
  };

  // --- Member login step 1: Verify PIN ---
  const verifyPin = async (userId: string, pin: string) => {
    if (!isAppConfigured) {
      return {
        success: false,
        message:
          "Setup is not complete yet. Please finish configuration first.",
      };
    }

    const key = getAttemptsKey("member", userId);
    const lockoutEnd = getLockoutTime("member", userId);
    if (Date.now() < lockoutEnd)
      return { success: false, lockedUntil: lockoutEnd };

    const user = await getUser(userId);
    if (user && user.pin === pin) {
      clearLoginAttempts(key);
      setPendingUserId(userId); // Set pending user for next steps
      if (user.phoneNumber) {
        // Phone number exists, proceed to send OTP
        const otpResult = await sendOtp(user.phoneNumber);
        if (otpResult.success) {
          return { success: true, needsPhoneNumber: false };
        } else {
          return { success: false, message: otpResult.message };
        }
      } else {
        // Phone number does not exist, need to ask user for it
        return { success: true, needsPhoneNumber: true };
      }
    } else {
      const failure = recordFailedAttempt("member", userId);
      return { success: false, message: "Invalid PIN.", ...failure };
    }
  };

  // --- Member login step 2: Save Phone Number & Send OTP ---
  const savePhoneNumberAndSendOtp = async (
    userId: string,
    phoneNumber: string,
  ) => {
    if (userId !== pendingUserId) {
      return {
        success: false,
        message: "User session mismatch. Please start over.",
      };
    }
    try {
      await updateUserPhoneNumber(userId, phoneNumber);
      // Refresh local users array
      setUsers(users.map((u) => (u.id === userId ? { ...u, phoneNumber } : u)));
      return await sendOtp(phoneNumber);
    } catch (error: unknown) {
      return {
        success: false,
        message: getErrorMessage(error) || "Could not save phone number.",
      };
    }
  };

  // --- Member login step 3: Verify OTP ---
  const verifyOtp = async (otp: string) => {
    if (!confirmationResult || !pendingUserId) {
      return { success: false, message: "No OTP request pending." };
    }
    try {
      // confirm the otp
      await confirmationResult.confirm(otp);

      const appUser = await getUser(pendingUserId);
      if (appUser) {
        // Store user ID, set current user state immediately
        localStorage.setItem(LOCAL_USER_ID_KEY, pendingUserId);
        setCurrentUser(appUser);
        setIsAdmin(pendingUserId === "admin");
        router.push("/");
      } else {
        throw new Error("Could not find user data after authentication.");
      }

      // Clean up state
      setConfirmationResult(null);
      setPendingUserId(null);

      return { success: true };
    } catch (err: unknown) {
      console.error("OTP verification error:", err);
      // Don't record this as a lockout failure, just an invalid OTP
      return { success: false, message: `Invalid OTP. Please try again.` };
    }
  };

  // --- Logout ---
  const logout = async () => {
    if (isAdmin) {
      localStorage.removeItem(LOCAL_USER_ID_KEY);
      setCurrentUser(null);
      setIsAdmin(false);
      router.push("/login");
    } else {
      await signOut(auth);
    }
  };

  // --- Get Token ---
  const getToken = async (): Promise<string | null> => {
    if (isAdmin) {
      // For admin, the "token" is just the raw value in local storage.
      return localStorage.getItem(LOCAL_USER_ID_KEY);
    }
    if (auth.currentUser) {
      // For regular users, it's the Firebase ID token.
      return auth.currentUser.getIdToken();
    }
    return null;
  };

  // --- Update credential ---
  const updateUserCredential = async (newCredential: string) => {
    if (!currentUser) return false;
    try {
      await updateUserCredentialInDb(currentUser.id, newCredential, isAdmin);
      return true;
    } catch (err) {
      console.error("Failed to update credential:", err);
      return false;
    }
  };

  const registerMember = async (
    payload: MemberSignupInput,
  ): Promise<{ success: boolean; message?: string }> => {
    if (!isAppConfigured) {
      return {
        success: false,
        message: "Tracker setup is not complete yet.",
      };
    }

    try {
      await createMemberFromSignup(payload);
      const refreshedUsers = await getAllUsers();
      setUsers(refreshedUsers);
      return { success: true };
    } catch (error: unknown) {
      return {
        success: false,
        message: getErrorMessage(error) || "Could not create member account.",
      };
    }
  };

  // --- Context value ---
  const value: AuthContextType = {
    currentUser,
    isAdmin,
    isAuthLoading,
    isDataLoading,
    isAppConfigured,
    appConfig,
    activeGroupId,
    availableGroups,
    users,
    loginWithCredentials,
    login,
    verifyPin,
    savePhoneNumberAndSendOtp,
    verifyOtp,
    logout,
    updateUserCredential,
    registerMember,
    refreshAppSetup,
    refreshGroupDirectory,
    selectGroup,
    clearSelectedGroup,
    getLockoutTime,
    getToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* must exist in DOM for reCAPTCHA */}
      <div id="recaptcha-container" />
    </AuthContext.Provider>
  );
}

// Extend the window interface for the recaptcha verifier
declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

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
import { useRouter } from "next/navigation";
import {
  getUser,
  getAdminPassword,
  updateUserCredential as updateUserCredentialInDb,
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
import { onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";

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
    lockedUntil?: number;
    message?: string;
  }>;
  login: (
    role: "admin",
    credential?: string,
  ) => Promise<{ success: boolean; lockedUntil?: number; message?: string }>;
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

const getStoredUserId = () => {
  if (typeof window === "undefined") return null;
  const sessionUserId = sessionStorage.getItem(LOCAL_USER_ID_KEY);
  if (sessionUserId) return sessionUserId;

  // Clear legacy persistent login so opening a new tab requires credentials.
  const legacyUserId = localStorage.getItem(LOCAL_USER_ID_KEY);
  if (legacyUserId) {
    localStorage.removeItem(LOCAL_USER_ID_KEY);
  }
  return null;
};

const setStoredUserId = (userId: string) => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(LOCAL_USER_ID_KEY, userId);
  localStorage.removeItem(LOCAL_USER_ID_KEY);
};

const clearStoredUserId = () => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(LOCAL_USER_ID_KEY);
  localStorage.removeItem(LOCAL_USER_ID_KEY);
};

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

  const router = useRouter();

  const ensureFirebaseSession = useCallback(async (): Promise<boolean> => {
    if (auth.currentUser) {
      return true;
    }
    try {
      await signInAnonymously(auth);
      return true;
    } catch (error) {
      console.error("Could not establish Firebase session:", error);
      return false;
    }
  }, []);

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

      const unsubscribe = onAuthStateChanged(auth, async () => {
        try {
          const storedUserId = getStoredUserId();
          if (storedUserId) {
            await ensureFirebaseSession();
            const appUser = await getUser(storedUserId);
            if (appUser) {
              setCurrentUser(appUser);
              setIsAdmin(storedUserId === "admin");
            } else {
              setCurrentUser(null);
              setIsAdmin(false);
              clearStoredUserId();
            }
          } else {
            setCurrentUser(null);
            setIsAdmin(false);
            clearStoredUserId();
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
          clearStoredUserId();
        } finally {
          setIsAuthLoading(false);
        }
      });

      return () => unsubscribe();
    };

    initialize();
  }, [ensureFirebaseSession, loadActiveGroupData, refreshGroupDirectory]);

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
    clearStoredUserId();
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
      clearStoredUserId();
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

      clearLoginAttempts(getAttemptsKey("admin"));
      const hasSession = await ensureFirebaseSession();
      if (!hasSession) {
        console.warn(
          "Firebase anonymous session was not created. Continuing with app credentials.",
        );
      }
      setStoredUserId("admin");
      setCurrentUser(matchedUser);
      setIsAdmin(true);
      router.push("/");
      return { success: true };
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
    const hasSession = await ensureFirebaseSession();
    if (!hasSession) {
      console.warn(
        "Firebase anonymous session was not created. Continuing with app credentials.",
      );
    }
    setStoredUserId(matchedUser.id);
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
        const hasSession = await ensureFirebaseSession();
        if (!hasSession) {
          console.warn(
            "Firebase anonymous session was not created. Continuing with app credentials.",
          );
        }
        setStoredUserId("admin");
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

  // --- Logout ---
  const logout = async () => {
    await clearSelectedGroup();
    router.push("/login");
  };

  // --- Get Token ---
  const getToken = async (): Promise<string | null> => {
    if (isAdmin) {
      // For admin, the "token" is just the raw value in local storage.
      return getStoredUserId();
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
      const hasSession = await ensureFirebaseSession();
      if (!hasSession) {
        console.warn(
          "Firebase anonymous session was not created. Proceeding with member registration.",
        );
      }
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

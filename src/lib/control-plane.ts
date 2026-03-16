import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

type RegisterControlGroupInput = {
  groupId: string;
  groupName: string;
  adminName: string;
  adminPhoneHash: string;
  tenantProjectId?: string | null;
  tenantConfigHash: string;
  groupImageUrl?: string | null;
};

type ControlGroupRecord = {
  groupId: string;
  groupName?: string;
  adminName?: string;
  tenantProjectId?: string | null;
  onboardingStatus?: string;
  otpVerified?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const ACTIVE_CONTROL_GROUP_KEY = "active-control-group-id";

const controlFirebaseConfig = {
  projectId: "tifresh-assistant",
  appId: "1:4534943073:web:b578a5e89f0e0e023c9920",
  storageBucket: "tifresh-assistant.firebasestorage.app",
  apiKey: "AIzaSyAgT4tF5p5LPYko9kqsitCLJ3r7n9Y19Lg",
  authDomain: "tifresh-assistant.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "4534943073",
};

const controlAppName = "control-plane";
const controlApp =
  getApps().find((entry) => entry.name === controlAppName) ||
  initializeApp(controlFirebaseConfig, controlAppName);

export const controlDb = getFirestore(controlApp);
export const controlAuth = getAuth(controlApp);

export async function registerGroupControlRecord(
  payload: RegisterControlGroupInput,
): Promise<void> {
  const groupRef = doc(controlDb, "controlGroups", payload.groupId);
  await setDoc(
    groupRef,
    {
      groupId: payload.groupId,
      groupName: payload.groupName,
      adminName: payload.adminName,
      adminPhoneHash: payload.adminPhoneHash,
      tenantProjectId: payload.tenantProjectId || null,
      tenantConfigHash: payload.tenantConfigHash,
      groupImageUrl: payload.groupImageUrl || null,
      onboardingStatus: "completed",
      otpVerified: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getGroupControlRecord(
  groupId: string,
): Promise<ControlGroupRecord | null> {
  const groupRef = doc(controlDb, "controlGroups", groupId);
  const snapshot = await getDoc(groupRef);
  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as ControlGroupRecord;
}

export function setActiveControlGroupId(groupId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(ACTIVE_CONTROL_GROUP_KEY, groupId);
}

export function getActiveControlGroupId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(ACTIVE_CONTROL_GROUP_KEY);
}

export async function listControlGroups(): Promise<ControlGroupRecord[]> {
  const q = query(collection(controlDb, "controlGroups"), orderBy("updatedAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((entry) => entry.data() as ControlGroupRecord);
}

export async function updateControlGroupApproval(
  groupId: string,
  approved: boolean,
): Promise<void> {
  const groupRef = doc(controlDb, "controlGroups", groupId);
  await updateDoc(groupRef, {
    onboardingStatus: approved ? "completed" : "pending",
    otpVerified: approved,
    updatedAt: serverTimestamp(),
  });
}

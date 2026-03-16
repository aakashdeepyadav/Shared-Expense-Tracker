
// src/lib/firebase.ts
import {
  initializeApp,
  getApps,
  getApp,
  FirebaseApp,
  FirebaseOptions,
} from "firebase/app";
import { Firestore, getFirestore } from "firebase/firestore";
import { Auth, getAuth } from "firebase/auth";
import type { FirebaseProjectConfigInput } from "./types";

const RUNTIME_FIREBASE_CONFIG_KEY = "tracker-firebase-config";

const defaultFirebaseConfig: FirebaseOptions = {
  projectId: "tifresh-assistant",
  appId: "1:4534943073:web:b578a5e89f0e0e023c9920",
  storageBucket: "tifresh-assistant.firebasestorage.app",
  apiKey: "AIzaSyAgT4tF5p5LPYko9kqsitCLJ3r7n9Y19Lg",
  authDomain: "tifresh-assistant.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "4534943073",
};

function toFirebaseOptions(
  config?: FirebaseProjectConfigInput | null,
): FirebaseOptions | null {
  if (!config) return null;

  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    return null;
  }

  return {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
    measurementId: config.measurementId,
  };
}

function getRuntimeAppName(projectId: string): string {
  return `tracker-runtime-${projectId}`;
}

let app: FirebaseApp = !getApps().length
  ? initializeApp(defaultFirebaseConfig)
  : getApp();
let db: Firestore = getFirestore(app);
let auth: Auth = getAuth(app);

function setActiveFirebase(options: FirebaseOptions): void {
  const appName = getRuntimeAppName(options.projectId || "default");
  const existing = getApps().find((entry) => entry.name === appName);
  app = existing || initializeApp(options, appName);
  db = getFirestore(app);
  auth = getAuth(app);
}

export function setRuntimeFirebaseConfig(
  config: FirebaseProjectConfigInput,
): boolean {
  const options = toFirebaseOptions(config);
  if (!options) {
    return false;
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(RUNTIME_FIREBASE_CONFIG_KEY, JSON.stringify(config));
  }

  setActiveFirebase(options);
  return true;
}

export function clearRuntimeFirebaseConfig(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(RUNTIME_FIREBASE_CONFIG_KEY);
  }
  setActiveFirebase(defaultFirebaseConfig);
}

export function loadRuntimeFirebaseConfig(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const stored = localStorage.getItem(RUNTIME_FIREBASE_CONFIG_KEY);
    if (!stored) {
      setActiveFirebase(defaultFirebaseConfig);
      return;
    }

    const parsed = JSON.parse(stored) as FirebaseProjectConfigInput;
    const options = toFirebaseOptions(parsed);
    if (options) {
      setActiveFirebase(options);
      return;
    }

    setActiveFirebase(defaultFirebaseConfig);
  } catch {
    setActiveFirebase(defaultFirebaseConfig);
  }
}

if (typeof window !== "undefined") {
  loadRuntimeFirebaseConfig();
}

export { app, db, auth };

    
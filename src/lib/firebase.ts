// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const FIREBASE_AUTH_DOMAIN = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const FIREBASE_STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const FIREBASE_MESSAGING_SENDER_ID = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const FIREBASE_APP_ID = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
const FIREBASE_MEASUREMENT_ID = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

function ensure(value: string | undefined, name: string): string {
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const firebaseConfig = {
  apiKey: ensure(FIREBASE_API_KEY, "NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: ensure(FIREBASE_AUTH_DOMAIN, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: ensure(FIREBASE_PROJECT_ID, "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: ensure(FIREBASE_STORAGE_BUCKET, "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: ensure(FIREBASE_MESSAGING_SENDER_ID, "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: ensure(FIREBASE_APP_ID, "NEXT_PUBLIC_FIREBASE_APP_ID"),
  measurementId: FIREBASE_MEASUREMENT_ID || undefined,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };

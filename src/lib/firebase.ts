
// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  "projectId": "tifresh-assistant",
  "appId": "1:4534943073:web:b578a5e89f0e0e023c9920",
  "storageBucket": "tifresh-assistant.firebasestorage.app",
  "apiKey": "AIzaSyAgT4tF5p5LPYko9kqsitCLJ3r7n9Y19Lg",
  "authDomain": "tifresh-assistant.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "4534943073"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };

    
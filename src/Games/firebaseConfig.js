// ═══════════════════════════════════════════════════
// firebaseConfig.js — Shared Firebase instance
// Both questionPoolFirebase.js and remoteControl.js import from here
// ═══════════════════════════════════════════════════

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDwPyNYx0jSQL9zvB5nGuSPEUBEJPD9sAc",
  authDomain: "system-reboot-sp.firebaseapp.com",
  projectId: "system-reboot-sp",
  storageBucket: "system-reboot-sp.firebasestorage.app",
  messagingSenderId: "715953828725",
  appId: "1:715953828725:web:c1f8dd9905e66a7eb0d93c"
};

// Only initialize once — prevents "Firebase App already exists" error
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export { app, db };
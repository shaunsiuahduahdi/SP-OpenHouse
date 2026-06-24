// remoteControl.js — Firebase remote control (LOW QUOTA usage)
// Only writes on phase changes, reads via single onSnapshot listener
import { db } from './firebaseConfig';
import { doc, setDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createRemoteSession(onCommand) {
  const sessionCode = generateCode();
  const sessionRef = doc(db, 'remote_sessions', sessionCode);

  // 1 write — create session
  await setDoc(sessionRef, {
    sessionCode,
    createdAt: serverTimestamp(),
    controllerConnected: false,
    gamePhase: 'menu',
    gameDist: 0,
    gameLives: 3,
    gamePassed: 0,
    gameHit: 0,
    command: null,
    commandData: {},
    commandTimestamp: null,
  });

  let lastCommandTime = null;

  // 1 persistent listener — reads are free-ish, only fires on changes
  const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    if (data.command && data.commandTimestamp) {
      const cmdTime = data.commandTimestamp?.toMillis?.() || data.commandTimestamp?.seconds * 1000 || 0;
      if (cmdTime !== lastCommandTime) {
        lastCommandTime = cmdTime;
        onCommand(data.command, data.commandData || {});
        // Clear command — 1 write per command received
        updateDoc(sessionRef, { command: null, commandData: {} }).catch(() => {});
      }
    }
  });

  // Track last synced values to avoid redundant writes
  let lastSyncedPhase = 'menu';
  let lastSyncTime = 0;

  // Only writes when phase changes OR every 5 seconds during gameplay
  async function updateGameState(state) {
    const now = Date.now();
    const phaseChanged = state.phase !== lastSyncedPhase;
    const enoughTime = now - lastSyncTime > 5000; // 5 seconds minimum between writes

    if (!phaseChanged && !enoughTime) return; // skip — no need to write

    try {
      lastSyncedPhase = state.phase;
      lastSyncTime = now;
      await updateDoc(sessionRef, {
        gamePhase: state.phase || 'unknown',
        gameDist: state.dist || 0,
        gameLives: state.lives ?? 3,
        gamePassed: state.passed || 0,
        gameHit: state.hit || 0,
      });
    } catch (e) { /* silent */ }
  }

  return { sessionCode, unsubscribe, updateGameState };
}
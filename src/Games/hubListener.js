/**
 * hubListener.js — Connects any game component to the master hub session.
 * 
 * Usage in any game component:
 * 
 *   import { useHubRemote } from './hubListener';
 * 
 *   // Inside your component:
 *   const hubCode = useHubRemote((cmd, data) => {
 *     if (cmd === 'selectMode') startCountdownDirect(data.mode);
 *     if (cmd === 'stop') { ... }
 *     if (cmd === 'restart') { ... }
 *     // RunningMan also handles: setDifficulty, toggleObstacle, startGame
 *   });
 * 
 *   // hubCode is the 4-letter code (or null if not connected via hub)
 *   // If hubCode exists, you can hide the game's own session code UI
 */

import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';

/**
 * Reads hub code from URL (?hub=XXXX) or localStorage.
 * Supports both standard routing (/osu?hub=XXXX) and
 * hash-based routing (#/osu?hub=XXXX).
 */
export function getHubCode() {
  try {
    let code = null;

    // 1. Standard routing — check window.location.search
    const params = new URLSearchParams(window.location.search);
    code = params.get('hub');

    // 2. Hash-based routing — check inside the hash (#/path?hub=XXXX)
    if (!code && window.location.hash.includes('hub=')) {
      const hashParts = window.location.hash.split('?');
      if (hashParts[1]) {
        const hashParams = new URLSearchParams(hashParts[1]);
        code = hashParams.get('hub');
      }
    }

    if (code) {
      localStorage.setItem('__hub_code__', code);
      return code;
    }

    // 3. Fallback to localStorage
    const fromStorage = localStorage.getItem('__hub_code__');
    if (fromStorage) return fromStorage;
    return null;
  } catch {
    return null;
  }
}

/**
 * React hook: listens to hub_sessions/{code} for commands.
 * 
 * @param {function} onCommand - (command: string, data: object) => void
 * @returns {string|null} hubCode — the hub code if connected, null otherwise
 */
export function useHubRemote(onCommand) {
  const [hubCode] = useState(() => getHubCode());
  const cbRef = useRef(onCommand);
  cbRef.current = onCommand;

  useEffect(() => {
    if (!hubCode) return;

    const ref = doc(db, 'hub_sessions', hubCode);
    let lastTs = null;

    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const cmd = data.command;
      const cmdData = data.commandData || {};
      const ts = data.commandTimestamp;

      // Skip if no command or same timestamp (already processed)
      if (!cmd) return;
      const tsMs = ts?.toMillis?.() || ts?.seconds * 1000 || 0;
      if (lastTs && tsMs <= lastTs) return;
      lastTs = tsMs;

      // Clear command after processing (prevents re-fire)
      updateDoc(ref, { command: null }).catch(() => {});

      // Forward to the game's handler
      cbRef.current(cmd, cmdData);
    });

    return () => unsub();
  }, [hubCode]);

  return hubCode;
}

/**
 * Push game state back to the hub (so Flutter can track phase).
 * Call this whenever the game phase changes.
 * 
 * @param {string} hubCode
 * @param {object} state - e.g. { phase: 'play', score: 100 }
 */
export async function updateHubState(hubCode, state) {
  if (!hubCode) return;
  try {
    const ref = doc(db, 'hub_sessions', hubCode);
    await updateDoc(ref, { gameState: state });
  } catch {}
}
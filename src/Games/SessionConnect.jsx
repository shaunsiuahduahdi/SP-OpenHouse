import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, onSnapshot, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";
import "../stylesheets/Home.css";

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let c = "";
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

const SessionConnect = () => {
  const navigate = useNavigate();
  const [hubCode, setHubCode] = useState(null);
  const [flutterConnected, setFlutterConnected] = useState(false);
  const [creating, setCreating] = useState(false);
  const unsubRef = useRef(null);
  const connectedRef = useRef(false);

  // On mount: check localStorage for existing session, or create new
  useEffect(() => {
    let alive = true;

    const setup = async () => {
      // Check if we already have a valid session
      const existing = localStorage.getItem("__hub_code__");
      if (existing) {
        try {
          const snap = await getDoc(doc(db, "hub_sessions", existing));
          if (snap.exists()) {
            // Reuse existing session
            if (alive) {
              setHubCode(existing);
              listenTo(existing);
            }
            return;
          }
        } catch {}
        // Session doesn't exist anymore, clear it
        localStorage.removeItem("__hub_code__");
      }

      // Create a new session
      if (alive) createSession();
    };

    setup();
    return () => { alive = false; if (unsubRef.current) unsubRef.current(); };
  }, []); // eslint-disable-line

  const createSession = async () => {
    setCreating(true);
    const code = genCode();
    const ref = doc(db, "hub_sessions", code);
    try {
      await setDoc(ref, {
        created: serverTimestamp(),
        command: null,
        commandData: {},
        controllerConnected: false,
        currentGame: null,
      });
      localStorage.setItem("__hub_code__", code);
      setHubCode(code);
      listenTo(code);
    } catch (e) {
      console.error("Session create failed:", e);
    }
    setCreating(false);
  };

  const listenTo = (code) => {
    if (unsubRef.current) unsubRef.current();
    const ref = doc(db, "hub_sessions", code);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const nowConnected = !!data.controllerConnected;
      setFlutterConnected(nowConnected);
      // Auto-navigate to game select when Flutter first connects
      if (nowConnected && !connectedRef.current) {
        connectedRef.current = true;
        setTimeout(() => navigate("/home"), 600);
      }
      connectedRef.current = nowConnected;
    });
    unsubRef.current = unsub;
  };

  const resetSession = async () => {
    if (unsubRef.current) unsubRef.current();
    localStorage.removeItem("__hub_code__");
    setHubCode(null);
    setFlutterConnected(false);
    await createSession();
  };

  return (
    <div className="sess">
      <div className="sess-bg" />
      <div className="sess-content">
        <h1 className="sess-title">
          SP <span>Open House</span>
        </h1>
        <p className="sess-sub">Connect the Flutter remote to get started</p>

        <div className="sess-code-card">
          <div className="sess-code-label">SESSION CODE</div>
          {hubCode ? (
            <div className="sess-code">{hubCode}</div>
          ) : (
            <div className="sess-code" style={{ opacity: 0.3 }}>
              {creating ? "..." : "----"}
            </div>
          )}
          <div className="sess-code-hint">
            {flutterConnected ? (
              <span className="sess-connected">✓ Controller Connected</span>
            ) : (
              "Enter this code in the Flutter app"
            )}
          </div>
        </div>

        <button
          className="sess-enter-btn"
          onClick={() => navigate("/home")}
          disabled={!hubCode}
        >
          ENTER →
        </button>

        <button className="sess-reset-btn" onClick={resetSession}>
          Generate New Code
        </button>
      </div>
    </div>
  );
};

export default SessionConnect;
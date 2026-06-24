import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebaseConfig";
import "../stylesheets/Home.css";

const GAMES = [
  { id: "running", title: "RunningMan", sub: "System Reboot", link: "/running", color: "#22c55e", icon: "🏃", bg: "linear-gradient(135deg,#0a2e14,#1a4a28)" },
  { id: "osu", title: "osu!pose", sub: "Rhythm Meets Motion", link: "/osu", color: "#f43f5e", icon: "🎵", bg: "linear-gradient(135deg,#2e0a18,#4a1a2e)" },
  { id: "fruit", title: "LED Fruit Ninja", sub: "Circuit Builder", link: "/fruit", color: "#f59e0b", icon: "⚡", bg: "linear-gradient(135deg,#2e2a0a,#4a3a1a)" },
];

const GameSelect = () => {
  const navigate = useNavigate();
  const [hubCode] = useState(() => localStorage.getItem("__hub_code__"));
  const [flutterConnected, setFlutterConnected] = useState(false);
  const unsubRef = useRef(null);

  // If no session exists, redirect to session page
  useEffect(() => {
    if (!hubCode) {
      navigate("/");
      return;
    }

    // Listen for Flutter commands (selectGame)
    const ref = doc(db, "hub_sessions", hubCode);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setFlutterConnected(!!data.controllerConnected);

      if (data.command === "selectGame" && data.commandData?.game) {
        const game = GAMES.find((g) => g.id === data.commandData.game);
        if (game) {
          setDoc(ref, { command: null, currentGame: data.commandData.game }, { merge: true });
          navigate(`${game.link}?hub=${hubCode}`);
        }
      }
    });
    unsubRef.current = unsub;

    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [hubCode, navigate]);

  const goToGame = (game) => {
    if (hubCode) {
      const ref = doc(db, "hub_sessions", hubCode);
      setDoc(ref, { command: null, currentGame: game.id }, { merge: true });
    }
    navigate(`${game.link}?hub=${hubCode || ""}`);
  };

  return (
    <div className="hub">
      <div className="hub-bg" />
      <div className="hub-content">
        <div className="hub-header">
          <h1 className="hub-title">SP <span>Open House</span></h1>
          <p className="hub-sub">Choose a game to play!</p>
          {hubCode && (
            <div className="hub-code-pill">
              <span className="hub-code-pill-label">SESSION:</span>
              <span className="hub-code-pill-code">{hubCode}</span>
              {flutterConnected && <span className="hub-code-pill-dot" />}
            </div>
          )}
        </div>

        <div className="hub-games">
          {GAMES.map((game) => (
            <div key={game.id} className="hub-card-link" onClick={() => goToGame(game)} style={{ cursor: "pointer" }}>
              <div className="hub-card" style={{ background: game.bg }}>
                <div className="hub-card-glow" style={{ background: game.color }} />
                <div className="hub-card-icon">{game.icon}</div>
                <div className="hub-card-info">
                  <div className="hub-card-title" style={{ color: game.color }}>{game.title}</div>
                  <div className="hub-card-sub">{game.sub}</div>
                </div>
                <div className="hub-card-arrow" style={{ color: game.color }}>▸</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameSelect;
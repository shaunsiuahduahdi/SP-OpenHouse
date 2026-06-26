# SP Open House — Interactive Games Suite

Three pose-estimation games that run in the browser using TensorFlow.js MoveNet. Your webcam tracks your body and hands in real time — no controllers needed.

**🌐 Live:** [sp-open-house.vercel.app](https://sp-open-house.vercel.app/)

---

## Games

| Game | What You Do |
|------|-------------|
| **RunningMan** | Jog on the spot to run through a 3D tunnel. Dodge walls, complete mini-games, answer trivia. |
| **osu!pose** | Hit rhythm notes by swiping your hands in time with music. |
| **LED Fruit Ninja** | Slice electronic components in the correct order to build an LED circuit. |

## Features

- **Session System** — 4-letter code links the web app to the Flutter remote control app
- **Flutter Companion App** — wireless remote for game selection, configuration, start/stop, and trivia question management
- **Online Multiplayer** — peer-to-peer via WebRTC (all 3 games)
- **Dual Split-Screen** — two players, one camera (osu!pose & Fruit Ninja)
- **Leaderboard** — RunningMan scores stored in Supabase
- **Trivia Questions** — AI-generate, import from JSON/CSV/Excel/DOCX, upload to Firebase
- **RunningMan Obstacles** — 8 types: pose walls, trivia, cable repair, virus purge, 67 counter, hold pose, whack jumba, security guard
- **Attacker/Defender Roles** — RunningMan multiplayer with role-specific mini-games

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + HashRouter |
| Pose Detection | TensorFlow.js MoveNet (CDN) |
| 3D | Three.js (RunningMan tunnel) |
| 2D | Canvas API (all games) |
| Remote Control | Firebase Firestore |
| Multiplayer | WebRTC DataChannel |
| Signaling Server | WebSocket on Render |
| Leaderboard | Supabase (Postgres) |
| Deployment | Vercel |
| Mobile App | Flutter + Firebase |

## Quick Start

```bash
git clone https://github.com/shaunsiuahduahdi/SP-OpenHouse.git
cd SP-OpenHouse
npm install
npm run dev
```

Opens at `localhost:5173`. Allow camera access. Use Chrome or Edge.

## Project Structure

```
src/
  App.jsx                  # HashRouter with all routes
  Games/
    SessionConnect.jsx     # / — session code page
    GameSelect.jsx         # /home — game picker
    RunningMan.jsx         # /running — 3D tunnel game
    OsuPose.jsx            # /osu — rhythm game
    LEDFruitNinja.jsx      # /fruit — circuit builder
    hubListener.js         # shared: Firebase command listener
    useWebRTC.js           # shared: WebRTC multiplayer hook
    firebaseConfig.js      # Firebase init
    supabaseClient.js      # Supabase init
    questionPoolFirebase.js # loads trivia from Firestore
  stylesheets/
    run2.css, osu.css, fruit.css
index.html                 # TensorFlow CDN scripts here
```

## Deployment

Vercel auto-builds on push. Make sure `index.html` includes the TensorFlow CDN scripts:

```html
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection"></script>
```

## Related Repos

- **Signaling Server:** [system-reboot-signaling](https://github.com/shaunsiuahduahdi/system-reboot-signaling.git) — WebSocket relay for WebRTC, deployed on Render


## Requirements

- Webcam
- Chrome or Edge
- Well-lit room, 1–2m space in front of camera
- (Optional) Flutter companion app for remote control

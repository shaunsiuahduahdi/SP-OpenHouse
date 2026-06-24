import { useState, useRef, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

export function useWebRTC(signalingUrl) {
  const [roomCode, setRoomCode] = useState(null);
  const [connected, setConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const onMsgRef = useRef(null);
  const roomRef = useRef(null);
  const isHostRef = useRef(false);

  const setupDataChannel = useCallback((ch) => {
    ch.onopen = () => { console.log('DataChannel open'); setConnected(true); };
    ch.onclose = () => { console.log('DataChannel closed'); setConnected(false); };
    ch.onmessage = (e) => {
      try { const d = JSON.parse(e.data); if (onMsgRef.current) onMsgRef.current(d); } catch {}
    };
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ice-candidate', candidate: e.candidate, room: roomRef.current }));
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('PC state:', pc.connectionState);
      if (pc.connectionState === 'connected') setConnected(true);
      else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnected(false);
        setError('Connection lost');
      }
    };

    pc.ondatachannel = (e) => { dcRef.current = e.channel; setupDataChannel(e.channel); };

    return pc;
  }, [setupDataChannel]);

  const handleMsg = useCallback(async (msg) => {
    const pc = pcRef.current;
    if (!pc) return;
    console.log('Signaling msg:', msg.type);
    switch (msg.type) {
      case 'offer':
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        wsRef.current?.send(JSON.stringify({ type: 'answer', sdp: ans, room: roomRef.current }));
        break;
      case 'answer':
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        break;
      case 'ice-candidate':
        if (msg.candidate) await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        break;
      case 'room-created':
        roomRef.current = msg.room;
        setRoomCode(msg.room);
        break;
      case 'peer-joined':
        if (isHostRef.current) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          wsRef.current?.send(JSON.stringify({ type: 'offer', sdp: offer, room: roomRef.current }));
        }
        break;
      case 'error':
        setError(msg.message);
        break;
    }
  }, []);

  const connectWS = useCallback((retries = 3) => {
    return new Promise((resolve, reject) => {
      let attempt = 0;

      const tryConnect = () => {
        attempt++;
        console.log(`WS connect attempt ${attempt}/${retries} to ${signalingUrl}`);
        setError(attempt > 1 ? `Waking server... (attempt ${attempt})` : null);

        const ws = new WebSocket(signalingUrl);
        const timeout = setTimeout(() => {
          ws.close();
          if (attempt < retries) {
            setTimeout(tryConnect, 2000);
          } else {
            setError('Server unreachable — try again');
            reject(new Error('timeout'));
          }
        }, 15000);

        ws.onopen = () => {
          clearTimeout(timeout);
          console.log('WS connected');
          wsRef.current = ws;
          setError(null);
          resolve(ws);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          if (attempt < retries) {
            setTimeout(tryConnect, 2000);
          } else {
            setError('Server unreachable — try again');
            reject(new Error('error'));
          }
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          if (wsRef.current === ws) wsRef.current = null;
        };

        ws.onmessage = async (e) => {
          try { await handleMsg(JSON.parse(e.data)); } catch {}
        };
      };

      tryConnect();
    });
  }, [signalingUrl, handleMsg]);

  const createRoom = useCallback(async () => {
    try {
      setIsHost(true); isHostRef.current = true; setError(null);
      const ws = await connectWS(3);
      const pc = createPeerConnection();
      const dc = pc.createDataChannel('game', { ordered: false, maxRetransmits: 0 });
      dcRef.current = dc;
      setupDataChannel(dc);
      ws.send(JSON.stringify({ type: 'create-room' }));
    } catch { setError('Failed to create room — try again'); }
  }, [connectWS, createPeerConnection, setupDataChannel]);

  const joinRoom = useCallback(async (code) => {
    try {
      setIsHost(false); isHostRef.current = false; roomRef.current = code; setRoomCode(code); setError(null);
      const ws = await connectWS(3);
      createPeerConnection();
      ws.send(JSON.stringify({ type: 'join-room', room: code }));
    } catch { setError('Failed to join room — try again'); }
  }, [connectWS, createPeerConnection]);

  const send = useCallback((data) => {
    if (dcRef.current?.readyState === 'open') dcRef.current.send(JSON.stringify(data));
  }, []);

  const onMessage = useCallback((cb) => { onMsgRef.current = cb; }, []);

  const disconnect = useCallback(() => {
    dcRef.current?.close(); pcRef.current?.close(); wsRef.current?.close();
    dcRef.current = null; pcRef.current = null; wsRef.current = null;
    setConnected(false); setRoomCode(null); setError(null);
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  return { roomCode, connected, isHost, error, createRoom, joinRoom, send, onMessage, disconnect };
}
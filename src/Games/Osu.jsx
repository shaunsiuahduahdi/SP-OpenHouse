import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useWebRTC } from './useWebRTC';
import { createRemoteSession } from './osuRemoteControl';
import { useHubRemote } from './hubListener';
import '../stylesheets/osu.css';

const SIGNAL_URL='wss://system-reboot-signaling.onrender.com';
const MAX_MISSES=15;
const CR=82,HR=105;
const Q_GRAB_R=130;
const Q_LOCK_T=0.12;

const BM={
  title:'System Override',artist:'SP Open House',bpm:162,audioSrc:'/osu-song.mp3',
  ar:1500,hw300:90,hw100:160,hw50:220,
  comboColors:['#ff8844','#44ccdd','#ff66aa','#88dd44','#ddaa44','#aa66ff'],
  notes:[
    {t:2089,x:0.5,y:0.41,type:'c',hand:'any'},{t:3575,x:0.9,y:0.63,type:'c',hand:'R'},
    {t:5085,x:0.27,y:0.28,type:'c',hand:'L'},{t:6571,x:0.65,y:0.22,type:'c',hand:'R'},
    {t:8080,x:0.36,y:0.55,type:'c',hand:'L'},{t:9566,x:0.83,y:0.19,type:'c',hand:'R'},
    {t:10309,x:0.39,y:0.7,type:'c',hand:'L'},{t:11075,x:0.67,y:0.29,type:'c',hand:'R'},
    {t:11818,x:0.14,y:0.37,type:'c',hand:'L'},{t:12561,x:0.77,y:0.45,type:'c',hand:'R'},
    {t:13305,x:0.17,y:0.56,type:'c',hand:'L'},{t:14048,x:0.64,y:0.36,type:'c',hand:'R'},
    {t:14814,x:0.71,y:0.32,type:'s',hand:'R',path:[{x:0.71,y:0.32},{x:0.56,y:0.36},{x:0.58,y:0.4}],dur:1205},
    {t:15557,x:0.85,y:0.3,type:'c',hand:'R'},{t:16300,x:0.24,y:0.55,type:'c',hand:'L'},
    {t:17043,x:0.61,y:0.56,type:'c',hand:'R'},{t:17809,x:0.13,y:0.22,type:'c',hand:'L'},
    {t:18552,x:0.9,y:0.78,type:'c',hand:'R'},{t:19295,x:0.34,y:0.37,type:'c',hand:'L'},
    {t:20200,type:'q',q:"Year SP was founded?",l:"1954",r:"1968",c:"left",dur:4500},
    {t:25286,x:0.33,y:0.76,type:'c',hand:'L'},{t:26029,x:0.89,y:0.55,type:'c',hand:'R'},
    {t:26772,x:0.37,y:0.23,type:'c',hand:'L'},{t:27538,x:0.66,y:0.21,type:'c',hand:'R'},
    {t:28281,x:0.18,y:0.42,type:'c',hand:'L'},{t:29024,x:0.69,y:0.69,type:'c',hand:'R'},
    {t:29767,x:0.2,y:0.39,type:'s',hand:'L',path:[{x:0.2,y:0.39},{x:0.37,y:0.38},{x:0.29,y:0.37}],dur:1221},
    {t:30534,x:0.77,y:0.27,type:'c',hand:'R'},{t:31277,x:0.34,y:0.23,type:'c',hand:'L'},
    {t:32020,x:0.92,y:0.66,type:'c',hand:'R'},{t:32763,x:0.14,y:0.18,type:'c',hand:'L'},
    {t:33529,x:0.86,y:0.62,type:'c',hand:'R'},{t:34272,x:0.31,y:0.66,type:'c',hand:'L'},
    {t:34992,x:0.62,y:0.4,type:'c',hand:'R'},{t:35758,x:0.8,y:0.39,type:'c',hand:'R'},
    {t:37268,x:0.7,y:0.63,type:'c',hand:'R'},{t:37639,x:0.28,y:0.73,type:'c',hand:'L'},
    {t:38011,x:0.75,y:0.25,type:'c',hand:'R'},
    {t:39500,type:'q',q:"SP campus is in?",l:"Dover",r:"Clementi",c:"left",dur:4000},
    {t:44744,x:0.62,y:0.36,type:'c',hand:'R'},{t:45116,x:0.13,y:0.76,type:'c',hand:'L'},
    {t:45487,x:0.86,y:0.57,type:'c',hand:'R'},{t:46625,x:0.36,y:0.68,type:'c',hand:'L'},
    {t:46997,x:0.66,y:0.73,type:'c',hand:'R'},{t:47368,x:0.25,y:0.68,type:'c',hand:'L'},
    {t:48854,x:0.12,y:0.32,type:'c',hand:'L'},{t:49226,x:0.74,y:0.69,type:'c',hand:'R'},
    {t:50735,x:0.76,y:0.44,type:'c',hand:'R'},{t:51107,x:0.15,y:0.25,type:'c',hand:'L'},
    {t:52221,x:0.72,y:0.4,type:'s',hand:'R',path:[{x:0.72,y:0.4},{x:0.61,y:0.37},{x:0.56,y:0.33}],dur:1130},
    {t:52593,x:0.18,y:0.5,type:'c',hand:'L'},{t:54102,x:0.39,y:0.78,type:'c',hand:'L'},
    {t:54474,x:0.68,y:0.49,type:'c',hand:'R'},{t:55588,x:0.76,y:0.21,type:'c',hand:'R'},
    {t:56726,x:0.16,y:0.27,type:'c',hand:'L'},{t:57097,x:0.76,y:0.79,type:'c',hand:'R'},
    {t:58000,type:'q',q:"Nearest MRT to SP?",l:"Dover",r:"Buona Vista",c:"left",dur:4000},
    {t:62717,x:0.14,y:0.61,type:'c',hand:'L'},{t:63088,x:0.72,y:0.76,type:'c',hand:'R'},
    {t:64574,x:0.88,y:0.34,type:'c',hand:'R'},{t:66455,x:0.68,y:0.24,type:'c',hand:'R'},
    {t:67546,x:0.37,y:0.74,type:'c',hand:'L'},{t:68684,x:0.8,y:0.39,type:'c',hand:'R'},
    {t:69822,x:0.19,y:0.63,type:'c',hand:'L'},{t:70936,x:0.89,y:0.73,type:'c',hand:'R'},
    {t:72074,x:0.23,y:0.44,type:'s',hand:'L',path:[{x:0.23,y:0.44},{x:0.35,y:0.43},{x:0.42,y:0.51}],dur:1150},
    {t:73189,x:0.63,y:0.28,type:'c',hand:'R'},{t:74303,x:0.37,y:0.56,type:'c',hand:'L'},
    {t:76000,type:'q',q:"SP was Singapore's first?",l:"Polytechnic",r:"University",c:"left",dur:4000},
    {t:80294,x:0.87,y:0.59,type:'c',hand:'R'},{t:81803,x:0.72,y:0.34,type:'c',hand:'R'},
    {t:83289,x:0.73,y:0.73,type:'c',hand:'R'},{t:84033,x:0.28,y:0.67,type:'c',hand:'L'},
    {t:84799,x:0.65,y:0.37,type:'s',hand:'R',path:[{x:0.65,y:0.37},{x:0.52,y:0.43},{x:0.54,y:0.37}],dur:1295},
    {t:85542,x:0.24,y:0.3,type:'c',hand:'L'},{t:86285,x:0.83,y:0.35,type:'c',hand:'R'},
    {t:87794,x:0.66,y:0.76,type:'c',hand:'R'},{t:89280,x:0.72,y:0.19,type:'c',hand:'R'},
    {t:90766,x:0.35,y:0.36,type:'c',hand:'L'},{t:91904,x:0.7,y:0.29,type:'c',hand:'R'},
    {t:94000,type:'q',q:"Number of schools in SP?",l:"10",r:"7",c:"right",dur:4000},
    {t:98638,x:0.63,y:0.54,type:'c',hand:'R'},{t:99752,x:0.25,y:0.36,type:'c',hand:'L'},
    {t:100124,x:0.79,y:0.2,type:'c',hand:'R'},{t:101633,x:0.77,y:0.66,type:'c',hand:'R'},
    {t:103491,x:0.28,y:0.63,type:'c',hand:'L'},{t:105372,x:0.63,y:0.2,type:'c',hand:'R'},
    {t:106115,x:0.82,y:0.43,type:'c',hand:'R'},{t:107229,x:0.16,y:0.52,type:'c',hand:'L'},
    {t:109000,type:'q',q:"SP logo primary color?",l:"Blue",r:"Orange",c:"right",dur:4000},
    {t:113615,x:0.61,y:0.41,type:'c',hand:'R'},{t:115844,x:0.81,y:0.2,type:'c',hand:'R'},
    {t:117353,x:0.78,y:0.42,type:'c',hand:'R'},{t:118839,x:0.77,y:0.76,type:'c',hand:'R'},
    {t:120349,x:0.64,y:0.64,type:'s',hand:'R',path:[{x:0.64,y:0.64},{x:0.53,y:0.59},{x:0.52,y:0.58}],dur:1265},
    {t:121835,x:0.61,y:0.24,type:'c',hand:'R'},{t:123344,x:0.7,y:0.7,type:'c',hand:'R'},
    {t:125000,type:'q',q:"SP motto ends with?",l:"Better Life",r:"Brighter Future",c:"left",dur:4500},
    {t:130449,x:0.9,y:0.71,type:'c',hand:'R'},{t:132678,x:0.89,y:0.42,type:'c',hand:'R'},
    {t:134931,x:0.74,y:0.36,type:'c',hand:'R'},{t:136811,x:0.24,y:0.22,type:'c',hand:'L'},
    {t:137926,x:0.84,y:0.19,type:'s',hand:'R',path:[{x:0.84,y:0.19},{x:0.69,y:0.2},{x:0.74,y:0.15}],dur:1208},
    {t:139435,x:0.82,y:0.23,type:'c',hand:'R'},{t:139807,x:0.34,y:0.62,type:'c',hand:'L'},
    {t:141000,type:'q',q:"SP's mascot?",l:"Lion",r:"Eagle",c:"right",dur:4000},
    {t:145798,x:0.27,y:0.78,type:'c',hand:'L'},{t:146912,x:0.91,y:0.19,type:'c',hand:'R'},
    {t:149164,x:0.77,y:0.57,type:'c',hand:'R'},{t:150651,x:0.89,y:0.21,type:'c',hand:'R'},
    {t:152903,x:0.71,y:0.54,type:'c',hand:'R'},{t:155898,x:0.83,y:0.56,type:'c',hand:'R'},
    {t:157384,x:0.61,y:0.41,type:'c',hand:'R'},{t:159000,x:0.5,y:0.42,type:'c',hand:'any'},
  ]
};

const mkPS=()=>({ni:0,act:[],combo:0,mxC:0,sc:0,h3:0,h1:0,h5:0,ms:0,hp:100,failed:false,
  judg:[],parts:[],trails:[],bursts:[],hands:[],handPrev:{},
  qActive:false,qNote:null,qSlider:0.5,qTimer:0,qAnswered:false,qResult:null,qResultT:0,
  qGrabbed:false,qGrabHand:null,num:1,ccIdx:0});

export default function OsuGame(){
  const vidRef=useRef(null),canRef=useRef(null),detRef=useRef(null),audioRef=useRef(null);
  const G=useRef({run:false,t0:0,f:0,cw:1280,ch:720,stars:[],players:[]});
  const[ph,setPh]=useState('load');const[cdN,setCdN]=useState(null);
  const[cam,setCam]=useState(false);const[mdl,setMdl]=useState(false);
  const[hud,setHud]=useState([{sc:0,combo:0,acc:100,ms:0},{sc:0,combo:0,acc:100,ms:0}]);
  const[gameMode,setGameMode]=useState(null);const[mpMode,setMpMode]=useState(false);const[joinCode,setJoinCode]=useState('');

  // WebRTC multiplayer
  const{roomCode,connected,error:rtcErr,createRoom,joinRoom,send,onMessage,disconnect}=useWebRTC(SIGNAL_URL);
  const[oppScore,setOppScore]=useState(0);const[oppCombo,setOppCombo]=useState(0);const[oppAcc,setOppAcc]=useState(100);
  const[oppResult,setOppResult]=useState(null);const[oppFailed,setOppFailed]=useState(false);
  const mpRef=useRef({lastSend:0});

  // Flutter remote control
  const[remoteCode,setRemoteCode]=useState(null);
  const[remoteErr,setRemoteErr]=useState(null);
  const remoteRef=useRef({unsubscribe:null,updateGameState:null});

  // ── HUB REMOTE — listen to master hub session if ?hub=XXXX in URL ──
  const hubCode=useHubRemote((cmd,data)=>{
    if(cmd==='selectMode'){
      if(data.mode==='single'){setGameMode('single');setMpMode(false);setPh('cd');setTimeout(()=>startCountdownDirect('single'),50)}
      else if(data.mode==='multi'){setGameMode('multi');setMpMode(true);setPh('menu')}
      else if(data.mode==='dual'){setGameMode('dual');setPh('cd');setTimeout(()=>startCountdownDirect('dual'),50)}
    }
    if(cmd==='stop'){G.current.run=false;if(audioRef.current)audioRef.current.pause();setPh('menu');setMpMode(false)}
    if(cmd==='restart'){G.current.run=false;if(audioRef.current)audioRef.current.pause();setPh('cd');setTimeout(()=>startCountdownDirect(null),50)}
    if(cmd==='backToMenu'){G.current.run=false;if(audioRef.current)audioRef.current.pause();setMpMode(false);setPh('menu')}
    if(cmd==='backToHub'||cmd==='selectGame'){G.current.run=false;if(audioRef.current)audioRef.current.pause();window.location.hash='#/home'}
  });

  // WebRTC message handler
  useEffect(()=>{onMessage((msg)=>{
    if(msg.type==='sync'){setOppScore(msg.sc||0);setOppCombo(msg.combo||0);setOppAcc(msg.acc||100)}
    if(msg.type==='done'){setOppResult(msg)}
    if(msg.type==='failed'){setOppFailed(true);setOppResult(msg);G.current.run=false;if(audioRef.current)audioRef.current.pause();setTimeout(()=>setPh('results'),500)}
    if(msg.type==='start'){startCountdown()}
  })},[onMessage]); // eslint-disable-line

  // ── FLUTTER REMOTE — create session, listen for commands (skipped when hub connected) ──
  useEffect(()=>{
    if(hubCode)return; // commands come from hub_sessions instead
    let mounted=true;
    (async()=>{
      try{
        const{sessionCode,unsubscribe,updateGameState}=await createRemoteSession(
(cmd,data)=>{
  if(!mounted)return;
  console.log('[OsuRemote]',cmd,data);

  if(cmd==='selectMode'){
    if(data.mode==='single'){setGameMode('single');setMpMode(false);setPh('cd');
      setTimeout(()=>{if(mounted)startCountdownDirect('single')},50)}
    else if(data.mode==='multi'){setGameMode('multi');setMpMode(true);setPh('menu')}
    else if(data.mode==='dual'){setGameMode('dual');setPh('cd');
      setTimeout(()=>{if(mounted)startCountdownDirect('dual')},50)}
  }

  if(cmd==='stop'){
    G.current.run=false;if(audioRef.current)audioRef.current.pause();
    setPh('menu');setMpMode(false);
  }

  if(cmd==='restart'){
    G.current.run=false;if(audioRef.current)audioRef.current.pause();
    setPh('cd');
    setTimeout(()=>{if(mounted)startCountdownDirect(null)},50);
  }

  if(cmd==='backToMenu'){
    G.current.run=false;if(audioRef.current)audioRef.current.pause();
    setMpMode(false);setPh('menu');
  }
});
        if(mounted){
          setRemoteCode(sessionCode);
          remoteRef.current.unsubscribe=unsubscribe;
          remoteRef.current.updateGameState=updateGameState;
        }
      }catch(e){console.error('[OsuRemote] Failed:',e);if(mounted)setRemoteErr(e.toString())}
    })();
    return()=>{mounted=false;if(remoteRef.current.unsubscribe)remoteRef.current.unsubscribe()};
  },[]); // eslint-disable-line

  // Sync game phase to Firebase for remote
  useEffect(()=>{
    if(!remoteRef.current.updateGameState)return;
    remoteRef.current.updateGameState({phase:ph});
    const iv=setInterval(()=>{remoteRef.current.updateGameState({phase:ph})},3000);
    return()=>clearInterval(iv);
  },[ph]);

  const sfx=useRef({});
  useEffect(()=>{const mk=(f1,f2,tp,d,v=0.12)=>()=>{try{const c=new(window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g2=c.createGain();o.connect(g2);g2.connect(c.destination);o.type=tp;o.frequency.setValueAtTime(f1,c.currentTime);if(f2)o.frequency.exponentialRampToValueAtTime(f2,c.currentTime+d);g2.gain.setValueAtTime(v,c.currentTime);g2.gain.exponentialRampToValueAtTime(0.01,c.currentTime+d);o.start(c.currentTime);o.stop(c.currentTime+d)}catch{}};sfx.current.hit=mk(800,1200,'sine',0.08,0.15);sfx.current.miss=mk(200,100,'sawtooth',0.15,0.08);sfx.current.tick=mk(600,800,'sine',0.05,0.06);sfx.current.ok=mk(523,784,'sine',0.12,0.15);sfx.current.no=mk(200,80,'sawtooth',0.2,0.1)},[]);
  useEffect(()=>{let s;(async()=>{try{s=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});if(vidRef.current){vidRef.current.srcObject=s;vidRef.current.onloadedmetadata=()=>{vidRef.current.play();setCam(true)}}}catch{}})();return()=>{if(s)s.getTracks().forEach(t=>t.stop())}},[]);
  useEffect(()=>{if(!cam)return;let ok=true;(async()=>{try{await window.tf.setBackend('webgl');await window.tf.ready();const mtype=gameMode==='dual'?window.poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING:window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING;const d=await window.poseDetection.createDetector(window.poseDetection.SupportedModels.MoveNet,{modelType:mtype});if(ok){detRef.current=d;setMdl(true);if(ph==='load')setPh('menu')}}catch(e){console.error(e);try{const d2=await window.poseDetection.createDetector(window.poseDetection.SupportedModels.MoveNet,{modelType:window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING});if(ok){detRef.current=d2;setMdl(true);if(ph==='load')setPh('menu')}}catch{}}})();return()=>{ok=false}},[cam,gameMode]); // eslint-disable-line

  useEffect(()=>{if(!cam||!mdl||!detRef.current)return;let id,busy=false;const loop=async()=>{if(!busy&&vidRef.current?.readyState>=2){busy=true;try{
    const poses=await detRef.current.estimatePoses(vidRef.current);
    const g=G.current,vw=vidRef.current.videoWidth||640,vh=vidRef.current.videoHeight||480;
    const gt=(kps,i)=>{const kp=kps[i];return kp?.score>0.2?{x:1-kp.x/vw,y:kp.y/vh}:null};
    const off=(wr,el)=>{if(!wr)return null;if(!el)return wr;const dx=wr.x-el.x,dy=wr.y-el.y,ln=Math.sqrt(dx*dx+dy*dy);if(ln<0.01)return wr;return{x:wr.x+dx/ln*ln*0.45,y:wr.y+dy/ln*ln*0.45}};
    const sm=(p,n)=>p+(n-p)*0.5;
    const extractHands=(kps,ps)=>{const lw=gt(kps,9),rw=gt(kps,10),le=gt(kps,7),re=gt(kps,8);const lH=off(lw,le),rH=off(rw,re);const hands=[];
      if(lH){const hx=sm(ps._lx||lH.x*g.cw,lH.x*g.cw),hy=sm(ps._ly||lH.y*g.ch,lH.y*g.ch);ps._lx=hx;ps._ly=hy;hands.push({x:hx,y:hy,id:'L'})}
      if(rH){const hx=sm(ps._rx||rH.x*g.cw,rH.x*g.cw),hy=sm(ps._ry||rH.y*g.ch,rH.y*g.ch);ps._rx=hx;ps._ry=hy;hands.push({x:hx,y:hy,id:'R'})}
      ps.hands=hands};
    if(gameMode==='dual'&&poses.length>=2){const withX=poses.filter(p=>p.keypoints[5]?.score>0.15&&p.keypoints[6]?.score>0.15).map(p=>({pose:p,mx:1-((p.keypoints[5].x+p.keypoints[6].x)/2)/vw})).sort((a,b)=>a.mx-b.mx);for(let pi=0;pi<Math.min(2,withX.length);pi++){if(g.players[pi])extractHands(withX[pi].pose.keypoints,g.players[pi])}}
    else if(poses.length>0&&g.players[0])extractHands(poses[0].keypoints,g.players[0]);
  }catch{}busy=false}id=requestAnimationFrame(loop)};id=requestAnimationFrame(loop);return()=>cancelAnimationFrame(id)},[cam,mdl,gameMode]);

  useEffect(()=>{G.current.stars=[];for(let i=0;i<60;i++)G.current.stars.push({x:Math.random(),y:Math.random(),r:0.5+Math.random()*1.5,s:0.1+Math.random()*0.3,a:0.15+Math.random()*0.3,h:Math.random()*360})},[]);

  // Direct countdown — used by remote commands that set gameMode directly
  const startCountdownDirect=useCallback((mode)=>{
    const gm=mode||gameMode||'single';
    const g=G.current;g.players=[];for(let i=0;i<(gm==='dual'?2:1);i++)g.players.push(mkPS());g.run=false;g.f=0;
    setHud([{sc:0,combo:0,acc:100,ms:0},{sc:0,combo:0,acc:100,ms:0}]);setOppScore(0);setOppCombo(0);setOppAcc(100);setOppResult(null);setOppFailed(false);
    if(mode)setGameMode(gm);
    let n=3;setCdN(n);setPh('cd');const iv=setInterval(()=>{n--;if(n>0)setCdN(n);else{clearInterval(iv);setCdN(null);g.run=true;g.t0=Date.now();g.f=0;if(BM.audioSrc){const a=new Audio(BM.audioSrc);a.play();audioRef.current=a}setPh('play')}},1000);
  },[gameMode]);

  const startCountdown=useCallback(()=>{startCountdownDirect(null)},[startCountdownDirect]);
  const startGame=useCallback(()=>{if(gameMode==='multi'&&connected)send({type:'start'});startCountdown()},[gameMode,connected,send,startCountdown]);

  // ═══ GAME LOOP ═══
  useEffect(()=>{
    if(ph!=='play')return;
    const can=canRef.current,ctx=can.getContext('2d'),g=G.current;
    const rsz=()=>{can.width=window.innerWidth;can.height=window.innerHeight;g.cw=can.width;g.ch=can.height};
    rsz();window.addEventListener('resize',rsz);
    const AR=BM.ar,notes=BM.notes,CC=BM.comboColors;
    const pCount=g.players.length,isDual=pCount===2;

    const hudIv=setInterval(()=>{
      setHud(g.players.map(ps=>{const tt=ps.h3+ps.h1+ps.h5+ps.ms;return{sc:Math.floor(ps.sc),combo:ps.combo,acc:tt===0?100:Math.round(((ps.h3*300+ps.h1*100+ps.h5*50)/(tt*300))*10000)/100,ms:ps.ms}}));
      if(gameMode==='multi'){const ps=g.players[0];if(ps&&g.f-mpRef.current.lastSend>8){mpRef.current.lastSend=g.f;const tt=ps.h3+ps.h1+ps.h5+ps.ms;send({type:'sync',sc:Math.floor(ps.sc),combo:ps.combo,acc:tt===0?100:Math.round(((ps.h3*300+ps.h1*100+ps.h5*50)/(tt*300))*10000)/100})}}
    },50);

    let raf;
    const loop=()=>{
      if(!g.run)return;g.f++;
      const w=can.width,ht=can.height,now=Date.now()-g.t0;
      ctx.clearRect(0,0,w,ht);
      ctx.fillStyle='rgba(0,0,0,0.08)';ctx.fillRect(0,0,w,ht);
      g.stars.forEach(s=>{s.y-=s.s*0.0005;if(s.y<-0.02){s.y=1.02;s.x=Math.random();s.h=(s.h+60)%360}const p=0.5+Math.sin(g.f*0.04+s.x*8)*0.5;ctx.fillStyle=`hsla(${s.h},80%,65%,${s.a*p*0.3})`;ctx.beginPath();ctx.arc(s.x*w,s.y*ht,s.r*4,0,Math.PI*2);ctx.fill()});
      if(isDual){ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,ht);ctx.stroke()}

      let allDone=true;
      for(let pi=0;pi<pCount;pi++){
        const ps=g.players[pi];if(ps.failed)continue;
        const pw=isDual?w/2:w,pOff=isDual?pi*pw:0;
        const hands=ps.hands||[];
        ctx.save();if(isDual){ctx.beginPath();ctx.rect(pOff,0,pw,ht);ctx.clip()}

        const doMiss=()=>{ps.ms++;ps.combo=0;ps.hp=Math.max(0,ps.hp-8);sfx.current.miss?.();if(ps.ms>=MAX_MISSES&&!ps.failed){ps.failed=true;if(gameMode==='multi'){const tt=ps.h3+ps.h1+ps.h5+ps.ms;send({type:'failed',sc:Math.floor(ps.sc),acc:tt===0?100:Math.round(((ps.h3*300+ps.h1*100+ps.h5*50)/(tt*300))*10000)/100,mxC:ps.mxC,h3:ps.h3,h1:ps.h1,h5:ps.h5,ms:ps.ms})}}};
        const doHit=(note,diff)=>{const ad=Math.abs(diff);let pts2=0,txt='',col='';
          if(ad<=BM.hw300){pts2=300;txt='300';col='#66ddff';ps.h3++}else if(ad<=BM.hw100){pts2=100;txt='100';col='#66ee66';ps.h1++}else if(ad<=BM.hw50){pts2=50;txt='50';col='#ddaa33';ps.h5++}else{doMiss();ps.judg.push({x:note.px,y:note.py,txt:'\u2715',col:'#ff4477',born:g.f,miss:true});return false}
          ps.combo++;if(ps.combo>ps.mxC)ps.mxC=ps.combo;ps.sc+=pts2*(1+Math.floor(ps.combo/10)*0.1);ps.hp=Math.min(100,ps.hp+2);
          ps.judg.push({x:note.px,y:note.py,txt,col,born:g.f,miss:false});ps.bursts.push({x:note.px,y:note.py,col:note.cc||col,born:g.f});sfx.current.hit?.();return true};

        // ── QUESTION SLIDER ──
        if(ps.qActive&&ps.qNote&&!ps.qAnswered){
          ps.qTimer++;const qn=ps.qNote,cx=pOff+pw/2,tY=ht*0.58,tW=pw*0.72,tX=cx-tW/2;
          const ballX=tX+ps.qSlider*tW;
          if(!ps.qGrabbed){for(const hand of hands){if(Math.sqrt((hand.x-ballX)**2+(hand.y-tY)**2)<Q_GRAB_R){ps.qGrabbed=true;ps.qGrabHand=hand.id;break}}}
          if(ps.qGrabbed){const hand=hands.find(h2=>h2.id===ps.qGrabHand);if(hand){const mapped=(hand.x-tX)/tW;ps.qSlider+=(mapped-ps.qSlider)*0.25;ps.qSlider=Math.max(0,Math.min(1,ps.qSlider));if(Math.abs(hand.y-tY)>ht*0.3){ps.qGrabbed=false;ps.qGrabHand=null}}else{ps.qGrabbed=false;ps.qGrabHand=null}}
          if(!ps.qGrabbed){ps.qSlider+=(0.5-ps.qSlider)*0.03}
          if(ps.qSlider<Q_LOCK_T){ps.qAnswered=true;const ok=qn.c==='left';ps.qResult=ok?'correct':'wrong';ps.qResultT=g.f;if(ok){ps.sc+=200;ps.combo++;sfx.current.ok?.()}else{ps.ms+=3;ps.combo=0;ps.hp=Math.max(0,ps.hp-15);sfx.current.no?.();if(ps.ms>=MAX_MISSES)ps.failed=true}}
          else if(ps.qSlider>1-Q_LOCK_T){ps.qAnswered=true;const ok=qn.c==='right';ps.qResult=ok?'correct':'wrong';ps.qResultT=g.f;if(ok){ps.sc+=200;ps.combo++;sfx.current.ok?.()}else{ps.ms+=3;ps.combo=0;ps.hp=Math.max(0,ps.hp-15);sfx.current.no?.();if(ps.ms>=MAX_MISSES)ps.failed=true}}
          if(!ps.qAnswered&&now>qn.t+(qn.dur||4000)){ps.qAnswered=true;ps.qResult='wrong';ps.qResultT=g.f;ps.ms+=3;ps.combo=0;ps.hp=Math.max(0,ps.hp-15);sfx.current.no?.()}
          // Draw question
          ctx.fillStyle='rgba(5,3,15,0.92)';ctx.fillRect(pOff,0,pw,ht);
          const lg2=ctx.createLinearGradient(pOff,0,cx,0);lg2.addColorStop(0,'rgba(30,80,220,0.25)');lg2.addColorStop(1,'transparent');ctx.fillStyle=lg2;ctx.fillRect(pOff,0,pw/2,ht);
          const rg2=ctx.createLinearGradient(pOff+pw,0,cx,0);rg2.addColorStop(0,'rgba(220,40,40,0.25)');rg2.addColorStop(1,'transparent');ctx.fillStyle=rg2;ctx.fillRect(cx,0,pw/2,ht);
          ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=1;ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(cx,0);ctx.lineTo(cx,ht);ctx.stroke();ctx.setLineDash([]);
          ctx.font=`bold ${isDual?32:56}px 'Bebas Neue',sans-serif`;ctx.textAlign='center';ctx.fillStyle='#fff';ctx.shadowColor='rgba(0,0,0,0.5)';ctx.shadowBlur=8;ctx.fillText(qn.q,cx,ht*0.18);ctx.shadowBlur=0;
          const qPct=Math.max(0,1-ps.qTimer/((qn.dur||4000)/16.67));ctx.fillStyle='rgba(255,255,255,0.06)';ctx.fillRect(cx-pw*0.2,ht*0.23,pw*0.4,6);ctx.fillStyle=qPct>0.3?'#44ccff':'#ff4444';ctx.fillRect(cx-pw*0.2,ht*0.23,pw*0.4*qPct,6);
          const aFS=isDual?28:44,aSubFS=isDual?13:18,laX=pOff+pw*0.18,raX=pOff+pw*0.82,laW=Math.max(pw*0.28,180),laH=isDual?70:100;
          ctx.fillStyle='rgba(20,50,160,0.6)';if(ctx.roundRect){ctx.beginPath();ctx.roundRect(laX-laW/2,ht*0.35,laW,laH,14);ctx.fill();ctx.strokeStyle='rgba(80,140,255,0.7)';ctx.lineWidth=3;ctx.stroke()}else ctx.fillRect(laX-laW/2,ht*0.35,laW,laH);
          ctx.font=`bold ${aFS}px 'Bebas Neue'`;ctx.textAlign='center';ctx.fillStyle='#aaccff';ctx.fillText(qn.l,laX,ht*0.35+laH/2+aFS*0.35);
          ctx.font=`bold ${aSubFS}px 'Share Tech Mono'`;ctx.fillStyle='rgba(100,160,255,0.6)';ctx.fillText('← DRAG LEFT',laX,ht*0.35+laH+aSubFS+8);
          ctx.fillStyle='rgba(160,20,20,0.6)';if(ctx.roundRect){ctx.beginPath();ctx.roundRect(raX-laW/2,ht*0.35,laW,laH,14);ctx.fill();ctx.strokeStyle='rgba(255,100,100,0.7)';ctx.lineWidth=3;ctx.stroke()}else ctx.fillRect(raX-laW/2,ht*0.35,laW,laH);
          ctx.font=`bold ${aFS}px 'Bebas Neue'`;ctx.fillStyle='#ffaaaa';ctx.fillText(qn.r,raX,ht*0.35+laH/2+aFS*0.35);
          ctx.font=`bold ${aSubFS}px 'Share Tech Mono'`;ctx.fillStyle='rgba(255,100,100,0.6)';ctx.fillText('DRAG RIGHT →',raX,ht*0.35+laH+aSubFS+8);
          ctx.lineCap='round';ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=CR*1.8+8;ctx.beginPath();ctx.moveTo(tX,tY);ctx.lineTo(tX+tW,tY);ctx.stroke();
          ctx.strokeStyle='rgba(25,20,40,0.85)';ctx.lineWidth=CR*1.8;ctx.beginPath();ctx.moveTo(tX,tY);ctx.lineTo(tX+tW,tY);ctx.stroke();
          ctx.beginPath();ctx.arc(tX,tY,CR*0.7,0,Math.PI*2);ctx.fillStyle='rgba(30,60,180,0.6)';ctx.fill();ctx.strokeStyle='rgba(80,140,255,0.8)';ctx.lineWidth=4;ctx.stroke();
          ctx.font=`bold ${isDual?18:26}px 'Bebas Neue'`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#aaccff';ctx.fillText(qn.l,tX,tY);
          ctx.beginPath();ctx.arc(tX+tW,tY,CR*0.7,0,Math.PI*2);ctx.fillStyle='rgba(180,30,30,0.6)';ctx.fill();ctx.strokeStyle='rgba(255,100,100,0.8)';ctx.lineWidth=4;ctx.stroke();
          ctx.fillStyle='#ffaaaa';ctx.fillText(qn.r,tX+tW,tY);ctx.textBaseline='alphabetic';
          const bX=tX+ps.qSlider*tW,bCol=ps.qSlider<0.35?'#4488ff':ps.qSlider>0.65?'#ff4466':'#ffffff',bPulse=ps.qGrabbed?1+Math.sin(g.f*0.15)*0.08:1,bR=CR*0.85*bPulse;
          ctx.beginPath();ctx.arc(bX+3,tY+4,bR+3,0,Math.PI*2);ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fill();
          ctx.beginPath();ctx.arc(bX,tY,bR+3,0,Math.PI*2);ctx.strokeStyle=bCol;ctx.lineWidth=5;ctx.shadowColor=bCol;ctx.shadowBlur=ps.qGrabbed?20:10;ctx.stroke();ctx.shadowBlur=0;
          ctx.beginPath();ctx.arc(bX,tY,bR,0,Math.PI*2);ctx.fillStyle='rgba(35,30,50,0.9)';ctx.fill();
          ctx.beginPath();ctx.arc(bX,tY,bR-2,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,0.35)';ctx.lineWidth=2;ctx.stroke();
          if(ps.qGrabbed){ctx.strokeStyle=`${bCol}55`;ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.beginPath();ctx.arc(bX,tY,bR+20,0,Math.PI*2);ctx.stroke();ctx.setLineDash([])}
          ctx.font=`bold ${isDual?20:28}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(255,255,255,0.5)';ctx.fillText('⟵  ⟶',bX,tY);ctx.textBaseline='alphabetic';
          hands.forEach(hd=>{ctx.beginPath();ctx.arc(hd.x,hd.y,28,0,Math.PI*2);ctx.fillStyle=(hd.id==='L'?'#ff4466':'#4488ff');ctx.globalAlpha=0.5;ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.arc(hd.x,hd.y,8,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill()});
          ctx.font=`bold ${isDual?12:16}px 'Share Tech Mono'`;ctx.textAlign='center';ctx.fillStyle='rgba(255,255,255,0.25)';ctx.fillText(ps.qGrabbed?'DRAGGING — slide to your answer!':'Move your hand to the ball to grab it',cx,ht*0.82);
          ctx.restore();allDone=false;continue;
        }
        if(ps.qActive&&ps.qAnswered){const age=g.f-ps.qResultT;if(age<40){ctx.fillStyle='rgba(5,3,15,0.85)';ctx.fillRect(pOff,0,pw,ht);ctx.font=`bold ${isDual?50:80}px 'Bebas Neue'`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=ps.qResult==='correct'?'#44dd88':'#ff3355';ctx.globalAlpha=1-age/40;ctx.fillText(ps.qResult==='correct'?'CORRECT!':'WRONG!',pOff+pw/2,ht/2-20);if(ps.qResult==='correct'){ctx.font=`bold ${isDual?20:30}px 'Bebas Neue'`;ctx.fillStyle='rgba(68,221,136,0.6)';ctx.fillText('+200',pOff+pw/2,ht/2+35)}else{ctx.font=`bold ${isDual?16:22}px 'Share Tech Mono'`;ctx.fillStyle='rgba(255,50,80,0.5)';ctx.fillText('+3 MISSES',pOff+pw/2,ht/2+35)}ctx.globalAlpha=1;ctx.textBaseline='alphabetic';ctx.restore();allDone=false;continue}else{ps.qActive=false;ps.qNote=null;ps.qAnswered=false;ps.qGrabbed=false;ps.qGrabHand=null}}

        // ── ACTIVATE NOTES ──
        while(ps.ni<notes.length){const n=notes[ps.ni];
          if(n.type==='q'){if(now>=n.t&&!ps.qActive){ps.qActive=true;ps.qNote=n;ps.qSlider=0.5;ps.qTimer=0;ps.qAnswered=false;ps.qResult=null;ps.qGrabbed=false;ps.qGrabHand=null;ps.ni++;break}else if(now<n.t){break}else{ps.ni++;continue}}
          if(n.t-AR>now)break;
          const cc=CC[ps.ccIdx%CC.length];if(ps.num>1&&ps.num%10===1)ps.ccIdx++;
          ps.act.push({...n,px:pOff+n.x*pw,py:n.y*ht,num:ps.num,cc,hit:false,judged:false,sp:0,sa:false,sd:false,sb:false,spts:n.path?n.path.map(p2=>({x:pOff+p2.x*pw,y:p2.y*ht})):null,sh:null,st0:0,slp:0});ps.ni++;ps.num++}

        const hittable=[];if(ps.act.length>0){const first=ps.act.find(n=>!n.judged);if(first){const ft=first.t;for(const n of ps.act){if(n.judged)continue;if(n.t===ft)hittable.push(n);else break}}}
        for(let i=0;i<ps.act.length-1;i++){const a=ps.act[i],b=ps.act[i+1];if(a.judged||b.judged||b.t-a.t>1500)continue;const eB=now-(b.t-AR),apB=Math.min(1,eB/AR);if(apB<0.05)continue;ctx.globalAlpha=Math.min(0.3,apB*0.3);ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.setLineDash([6,6]);ctx.beginPath();ctx.moveTo(a.px,a.py);ctx.lineTo(b.px,b.py);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1}
        // Slider paths
        ps.act.forEach(note=>{if(note.type!=='s'||!note.spts||note.judged)return;const pts=note.spts;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.lineWidth=CR*2+6;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.stroke();ctx.strokeStyle='rgba(30,25,40,0.75)';ctx.lineWidth=CR*2-2;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.stroke();const ep=pts[pts.length-1];ctx.beginPath();ctx.arc(ep.x,ep.y,CR*0.45,0,Math.PI*2);ctx.strokeStyle=note.cc;ctx.lineWidth=3;ctx.globalAlpha=0.5;ctx.stroke();ctx.globalAlpha=1;
          if(note.sa&&!note.sd&&!note.sb){const p2=note.sp,tl=pts.length-1,seg=Math.min(Math.floor(p2*tl),tl-1),st=(p2*tl)-seg;const bx=pts[seg].x+(pts[seg+1].x-pts[seg].x)*st,by=pts[seg].y+(pts[seg+1].y-pts[seg].y)*st;ctx.beginPath();ctx.arc(bx,by,CR*0.5,0,Math.PI*2);ctx.fillStyle=`${note.cc}30`;ctx.fill();ctx.beginPath();ctx.arc(bx,by,CR*0.3,0,Math.PI*2);ctx.fillStyle='rgba(200,240,255,0.8)';ctx.fill();ctx.beginPath();ctx.arc(bx,by,CR*0.15,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();if(g.f%2===0)ps.trails.push({x:bx,y:by,born:g.f,col:note.cc})}ctx.restore()});
        ps.trails=ps.trails.filter(t=>g.f-t.born<18);ps.trails.forEach(t=>{const a=(g.f-t.born)/18;ctx.fillStyle=t.col;ctx.globalAlpha=(1-a)*0.4;ctx.beginPath();ctx.arc(t.x,t.y,5*(1-a),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1});
        // Circles + hit
        ps.act.forEach(note=>{if(note.judged)return;const el=now-(note.t-AR),ap=Math.min(1,el/AR);const late=now>note.t+BM.hw50;const isH=hittable.includes(note);
          if(late&&note.type==='c'){note.judged=true;doMiss();ps.judg.push({x:note.px,y:note.py,txt:'\u2715',col:'#ff4477',born:g.f,miss:true});return}
          if(late&&note.type==='s'&&!note.sa){note.judged=true;doMiss();ps.judg.push({x:note.px,y:note.py,txt:'\u2715',col:'#ff4477',born:g.f,miss:true});return}
          const dim=!isH&&!note.sa;ctx.save();if(dim)ctx.globalAlpha=0.35;
          const aR=CR+(CR*2.2)*(1-ap);ctx.save();ctx.globalAlpha=(dim?0.15:1)*(0.3+ap*0.7);ctx.beginPath();ctx.arc(note.px,note.py,aR,0,Math.PI*2);ctx.strokeStyle=note.cc;ctx.lineWidth=3;ctx.shadowColor=note.cc;ctx.shadowBlur=12;ctx.stroke();ctx.shadowBlur=0;ctx.restore();if(dim)ctx.globalAlpha=0.35;
          ctx.beginPath();ctx.arc(note.px+2,note.py+3,CR+2,0,Math.PI*2);ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fill();
          ctx.beginPath();ctx.arc(note.px,note.py,CR+2,0,Math.PI*2);ctx.strokeStyle=note.cc;ctx.lineWidth=5;ctx.shadowColor=note.cc;ctx.shadowBlur=10;ctx.stroke();ctx.shadowBlur=0;
          ctx.beginPath();ctx.arc(note.px,note.py,CR-1,0,Math.PI*2);ctx.fillStyle='rgba(45,40,55,0.88)';ctx.fill();ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=2;ctx.stroke();
          ctx.font="bold 52px 'Bebas Neue',sans-serif";ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(255,255,255,0.85)';ctx.fillText(((note.num-1)%9+1).toString(),note.px,note.py+1);ctx.restore();
          if(isH&&note.type==='c'&&!note.judged){for(const hand of hands){if(note.hand!=='any'&&note.hand!==hand.id)continue;const d=Math.sqrt((hand.x-note.px)**2+(hand.y-note.py)**2);const pk='c'+note.num;const was=ps.handPrev[pk]||false;const isIn=d<HR+CR;ps.handPrev[pk]=isIn;if(isIn&&!was&&ap>0.45){note.hit=true;note.judged=true;doHit(note,now-note.t);break}}}
          if(isH&&note.type==='s'&&!note.judged&&!note.sa){for(const hand of hands){if(note.hand!=='any'&&note.hand!==hand.id)continue;const d=Math.sqrt((hand.x-note.px)**2+(hand.y-note.py)**2);if(d<HR+CR&&ap>0.45){note.sa=true;note.sh=hand.id;note.st0=now;note.slp=g.f;sfx.current.tick?.();break}}}});
        // Slider progress
        ps.act.forEach(note=>{if(note.type!=='s'||!note.sa||note.sd||note.sb||!note.spts)return;const pts=note.spts;const hand=hands.find(hh=>hh.id===note.sh)||hands[0];
          if(!hand){if(g.f-note.slp>25){note.sb=true;note.judged=true;if(note.sp>0.5)doHit(note,50);else{doMiss();ps.judg.push({x:note.px,y:note.py,txt:'\u2715',col:'#ff4477',born:g.f,miss:true})}}return}
          const tp=Math.min(1,(now-note.st0)/(note.dur*1.3));let bP=0,bD=Infinity;const tl=pts.length-1;
          for(let i=0;i<=50;i++){const t=i/50,seg=Math.min(Math.floor(t*tl),tl-1),st=(t*tl)-seg;const px=pts[seg].x+(pts[seg+1].x-pts[seg].x)*st,py=pts[seg].y+(pts[seg+1].y-pts[seg].y)*st;const d=Math.sqrt((hand.x-px)**2+(hand.y-py)**2);if(d<bD){bD=d;bP=t}}
          if(bD<CR*2.5+HR){note.sp=Math.max(note.sp,Math.max(bP,tp)*0.95);note.slp=g.f;if(Math.floor(note.sp*7)>Math.floor((note.sp-0.03)*7))sfx.current.tick?.()}
          else{note.sp=Math.max(note.sp,tp*0.6);if(g.f-note.slp>35){note.sb=true;note.judged=true;if(note.sp>0.4)doHit(note,80);else{doMiss();ps.judg.push({x:pts[0].x,y:pts[0].y,txt:'\u2715',col:'#ff4477',born:g.f,miss:true})}}}
          if(note.sp>=0.9){note.sd=true;note.hit=true;note.judged=true;doHit(note,0);for(let i=0;i<12;i++){const a=(i/12)*Math.PI*2,s=3+Math.random()*5;ps.parts.push({x:pts[pts.length-1].x,y:pts[pts.length-1].y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:2+Math.random()*3,col:'#88ffcc',born:g.f,life:25})}}});
        ps.act=ps.act.filter(n=>!n.judged);
        // Effects
        ps.bursts=ps.bursts.filter(b=>g.f-b.born<24);ps.bursts.forEach(b=>{const a=(g.f-b.born)/24;ctx.beginPath();ctx.arc(b.x,b.y,CR+a*100,0,Math.PI*2);ctx.strokeStyle=b.col;ctx.lineWidth=5*(1-a);ctx.globalAlpha=(1-a)*0.7;ctx.stroke();ctx.globalAlpha=1});
        ps.parts=ps.parts.filter(p2=>g.f-p2.born<p2.life);ps.parts.forEach(p2=>{const a=(g.f-p2.born)/p2.life;p2.x+=p2.vx*(1-a*0.6);p2.y+=p2.vy*(1-a*0.6);ctx.fillStyle=p2.col;ctx.globalAlpha=(1-a)*0.8;ctx.beginPath();ctx.arc(p2.x,p2.y,p2.r*(1-a*0.3),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1});
        ps.judg=ps.judg.filter(j=>g.f-j.born<40);ps.judg.forEach(j=>{const a=(g.f-j.born)/40;ctx.font=`bold ${j.miss?36:44}px 'Bebas Neue'`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=j.col;ctx.globalAlpha=1-a;ctx.fillText(j.txt,j.x,j.y-a*50);ctx.globalAlpha=1;ctx.textBaseline='alphabetic'});
        hands.forEach(hd=>{const col=hd.id==='L'?'#ff4466':'#4488ff';const rp=(g.f%25)/25;ctx.beginPath();ctx.arc(hd.x,hd.y,38+rp*50,0,Math.PI*2);ctx.strokeStyle=`${col}${Math.floor((1-rp)*60).toString(16).padStart(2,'0')}`;ctx.lineWidth=2.5;ctx.stroke();ctx.beginPath();ctx.arc(hd.x,hd.y,28,0,Math.PI*2);const cg=ctx.createRadialGradient(hd.x-6,hd.y-6,3,hd.x,hd.y,28);cg.addColorStop(0,'#fff');cg.addColorStop(0.4,col);cg.addColorStop(1,'rgba(0,0,0,0.5)');ctx.fillStyle=cg;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.arc(hd.x,hd.y,8,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill()});
        if(ps.failed){ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(pOff,0,pw,ht);ctx.font="bold 60px 'Bebas Neue'";ctx.textAlign='center';ctx.fillStyle='#ff3355';ctx.fillText('FAILED',pOff+pw/2,ht/2)}
        if(ps.ni<notes.length||ps.act.length>0||ps.qActive)allDone=false;
        ctx.restore();
      }
      if(allDone||g.players.every(p=>p.failed)){g.run=false;if(audioRef.current)audioRef.current.pause();
        if(gameMode==='multi'){const ps=g.players[0];if(ps){const tt=ps.h3+ps.h1+ps.h5+ps.ms;send({type:ps.failed?'failed':'done',sc:Math.floor(ps.sc),acc:tt===0?100:Math.round(((ps.h3*300+ps.h1*100+ps.h5*50)/(tt*300))*10000)/100,mxC:ps.mxC,h3:ps.h3,h1:ps.h1,h5:ps.h5,ms:ps.ms})}}
        setTimeout(()=>setPh('results'),500)}
      raf=requestAnimationFrame(loop)};
    raf=requestAnimationFrame(loop);
    return()=>{window.removeEventListener('resize',rsz);clearInterval(hudIv);cancelAnimationFrame(raf)};
  },[ph]); // eslint-disable-line

  const getAcc=(ps)=>{if(!ps)return 100;const tt=ps.h3+ps.h1+ps.h5+ps.ms;return tt===0?100:Math.round(((ps.h3*300+ps.h1*100+ps.h5*50)/(tt*300))*10000)/100};
  const getRank=(a)=>{if(a>=95)return{r:'S',c:'#ffcc00'};if(a>=90)return{r:'A',c:'#00cc44'};if(a>=80)return{r:'B',c:'#4488ff'};if(a>=70)return{r:'C',c:'#aa44ff'};return{r:'D',c:'#ff4444'}};

  return(
    <div className="osu">
      <video ref={vidRef} className="osu-vid-bg" playsInline autoPlay muted/>
      <img src="/osu-bg.png" alt="" className="osu-bg-overlay"/>
      <canvas ref={canRef} className="osu-canvas"/>
      {ph==='play'&&(<>{(gameMode==='dual'?[0,1]:[0]).map(pi=>{const h=hud[pi]||{sc:0,combo:0,acc:100,ms:0};return<div key={pi} style={{position:'absolute',top:0,[pi===1?'right':'left']:0,width:gameMode==='dual'?'50%':'100%',zIndex:50,pointerEvents:'none'}}><div style={{display:'flex',justifyContent:'space-between',padding:'8px 16px',alignItems:'center'}}><div style={{color:h.ms>MAX_MISSES*0.7?'#ff4466':'#888',fontSize:13,fontWeight:700,background:'rgba(0,0,0,0.4)',borderRadius:20,padding:'2px 12px'}}>{h.ms}/{MAX_MISSES}</div><div style={{textAlign:'right'}}><div style={{color:'#fff',fontSize:18,fontWeight:900,fontFamily:'monospace'}}>{String(h.sc).padStart(8,'0')}</div><div style={{color:'#aaa',fontSize:11}}>{h.acc.toFixed(1)}%</div></div></div><div style={{position:'absolute',bottom:60,[pi===1?'right':'left']:20}}><span style={{color:'#fff',fontSize:42,fontWeight:900}}>{h.combo}</span><span style={{color:'#fff8',fontSize:20}}>x</span></div>{gameMode==='dual'&&<div style={{position:'absolute',top:40,left:'50%',transform:'translateX(-50%)',color:'rgba(255,255,255,0.3)',fontSize:11,letterSpacing:2}}>P{pi+1}</div>}</div>})}</>)}
      {ph==='play'&&gameMode==='multi'&&<div style={{position:'absolute',top:50,right:20,background:'rgba(0,0,0,0.5)',borderRadius:10,padding:'8px 14px',border:'1px solid rgba(255,100,100,0.3)',zIndex:50}}><div style={{color:'#ff6666',fontSize:11,letterSpacing:2,fontWeight:700}}>OPPONENT</div><div style={{color:'#fff',fontSize:20,fontWeight:900}}>{String(oppScore).padStart(8,'0')}</div><div style={{color:'#aaa',fontSize:12}}>{oppCombo}x • {oppAcc.toFixed(1)}%</div></div>}
      {ph==='load'&&<div className="osu-ov"><div className="osu-spin"/><div className="osu-lt">Loading...</div></div>}
      {ph==='cd'&&cdN!==null&&<div className="osu-ov"><div className="osu-cd">{cdN}</div><div className="osu-cd-sub">GET READY</div></div>}
      {ph==='menu'&&!mpMode&&(<div className="osu-ov"><div className="osu-menu">
        <h1 className="osu-title">osu!<span>pose</span></h1><p className="osu-sub">rhythm meets motion</p>
        {remoteCode&&<div style={{textAlign:'center',margin:'10px 0',padding:'8px 16px',background:'rgba(255,68,102,0.06)',borderRadius:8,border:'1px solid rgba(255,68,102,0.15)'}}><div style={{fontSize:11,color:'#886644',letterSpacing:2,marginBottom:4}}>REMOTE CODE</div><div style={{fontSize:32,fontWeight:900,letterSpacing:8,color:'#ff4466',fontFamily:'monospace'}}>{remoteCode}</div><div style={{fontSize:11,color:'#443355',marginTop:4}}>Enter this code in the Flutter app</div></div>}
        {!remoteCode&&remoteErr&&<div style={{textAlign:'center',margin:'10px 0',padding:'8px',background:'rgba(255,50,50,0.06)',borderRadius:8,border:'1px solid rgba(255,50,50,0.15)',color:'#ff5555',fontSize:11}}>Remote: {remoteErr}</div>}
        <div className="osu-song-info"><div className="osu-song-title">{BM.title}</div><div className="osu-song-artist">{BM.artist}</div><div className="osu-song-meta">{BM.notes.length} notes • {BM.bpm} BPM • {MAX_MISSES} miss limit</div></div>
        <div className="osu-hand-legend"><div className="osu-hand-l"><span className="osu-dot-l"/>Left Hand</div><div className="osu-hand-r"><span className="osu-dot-r"/>Right Hand</div></div>
        <button className="osu-start" onClick={()=>{setGameMode('single');startCountdown()}}>SINGLE PLAYER</button>
        <div style={{display:'flex',gap:8,marginTop:8}}><button className="osu-start" style={{flex:1,background:'linear-gradient(135deg,#ff4466,#ff6644)'}} onClick={()=>{setGameMode('multi');setMpMode(true)}}>ONLINE</button>
        <button className="osu-start" style={{flex:1,background:'linear-gradient(135deg,#8844ff,#4488ff)'}} onClick={()=>{setGameMode('dual');startCountdown()}}>DUAL</button></div>
      </div></div>)}
      {mpMode&&ph==='menu'&&(<div className="osu-ov" style={{zIndex:300}}><div className="osu-menu" style={{maxWidth:360}}><h2 style={{color:'#ff6644',fontSize:24,letterSpacing:3,marginBottom:16}}>MULTIPLAYER</h2>{!connected?(<><button className="osu-start" onClick={createRoom}>CREATE ROOM</button><div style={{color:'#556',margin:'12px 0',fontSize:13}}>or</div><div style={{display:'flex',gap:8}}><input style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'10px 14px',color:'#fff',fontSize:18,letterSpacing:6,textAlign:'center',textTransform:'uppercase'}} placeholder="CODE" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={4}/><button className="osu-start" style={{padding:'10px 20px'}} onClick={()=>joinRoom(joinCode)}>JOIN</button></div>{roomCode&&<div style={{color:'#66ddff',fontSize:28,fontWeight:900,letterSpacing:8,margin:'16px 0'}}>{roomCode}</div>}{rtcErr&&<div style={{color:'#ff4466',fontSize:12,marginTop:8}}>{rtcErr}</div>}</>):(<><div style={{color:'#44dd88',fontSize:16,marginBottom:12}}>OPPONENT CONNECTED ✓</div><button className="osu-start" onClick={startGame}>START</button></>)}<button className="osu-back" onClick={()=>{setMpMode(false);disconnect()}}>CANCEL</button></div></div>)}
      {ph==='results'&&(<div className="osu-ov"><div className="osu-results">
        {gameMode==='dual'?(<><div className="osu-results-title" style={{marginBottom:16}}>{BM.title}</div><div style={{display:'flex',gap:20,width:'100%'}}>{G.current.players.map((ps,pi)=>{const a=getAcc(ps),rk=getRank(a);return<div key={pi} style={{flex:1,background:'rgba(255,255,255,0.03)',borderRadius:12,padding:16,border:`1px solid ${pi===0?'rgba(136,68,255,0.3)':'rgba(68,136,255,0.3)'}`}}><div style={{color:pi===0?'#8844ff':'#4488ff',fontSize:14,letterSpacing:2,fontWeight:700,marginBottom:8}}>PLAYER {pi+1}</div>{ps.failed?<div style={{color:'#ff3355',fontSize:24,fontWeight:900}}>FAILED</div>:<div style={{color:rk.c,fontSize:48,fontWeight:900}}>{rk.r}</div>}<div style={{color:'#fff',fontSize:16,marginTop:8}}>Score: <strong>{Math.floor(ps.sc)}</strong></div><div style={{color:'#aaa',fontSize:13}}>Acc: {a}% • Combo: {ps.mxC}x</div><div style={{color:'#666',fontSize:11,marginTop:4}}>{ps.h3}/300 {ps.h1}/100 {ps.h5}/50 {ps.ms}/miss</div></div>})}</div>{(()=>{const s0=G.current.players[0]?.sc||0,s1=G.current.players[1]?.sc||0,f0=G.current.players[0]?.failed,f1=G.current.players[1]?.failed;const winner=f0&&!f1?'P2':f1&&!f0?'P1':s0>s1?'P1':s1>s0?'P2':'TIE';return<div style={{color:winner==='TIE'?'#ffcc44':'#44dd88',fontSize:28,fontWeight:900,letterSpacing:4,marginTop:16}}>{winner==='TIE'?'TIE!':winner+' WINS!'}</div>})()}</>):(<>
          {G.current.players[0]?.failed&&<div style={{color:'#ff3355',fontSize:36,fontWeight:900,letterSpacing:4,marginBottom:8}}>FAILED</div>}
          {gameMode==='multi'&&(oppFailed||oppResult)&&<div style={{fontSize:36,fontWeight:900,color:oppFailed||(oppResult&&G.current.players[0]?.sc>oppResult.sc)?'#44dd88':oppResult&&G.current.players[0]?.sc<oppResult.sc?'#ff4466':'#ffcc44',letterSpacing:4,marginBottom:8}}>{oppFailed?'OPPONENT FAILED — YOU WIN!':oppResult&&G.current.players[0]?.sc>oppResult.sc?'YOU WIN!':oppResult&&G.current.players[0]?.sc<oppResult.sc?'YOU LOSE':'TIE'}</div>}
          {!G.current.players[0]?.failed&&<div className="osu-rank" style={{color:getRank(getAcc(G.current.players[0])).c}}>{getRank(getAcc(G.current.players[0])).r}</div>}
          <div className="osu-results-title">{BM.title}</div>
          <div className="osu-results-grid"><div className="osu-rg-item"><span className="osu-rg-val" style={{color:'#66ddff'}}>{G.current.players[0]?.h3||0}</span><span className="osu-rg-lbl">300</span></div><div className="osu-rg-item"><span className="osu-rg-val" style={{color:'#66ee66'}}>{G.current.players[0]?.h1||0}</span><span className="osu-rg-lbl">100</span></div><div className="osu-rg-item"><span className="osu-rg-val" style={{color:'#ddaa33'}}>{G.current.players[0]?.h5||0}</span><span className="osu-rg-lbl">50</span></div><div className="osu-rg-item"><span className="osu-rg-val" style={{color:'#ff4477'}}>{G.current.players[0]?.ms||0}</span><span className="osu-rg-lbl">Miss</span></div></div>
          <div className="osu-results-stats"><div>Score: <strong>{Math.floor(G.current.players[0]?.sc||0)}</strong></div><div>Accuracy: <strong>{getAcc(G.current.players[0])}%</strong></div><div>Max Combo: <strong>{G.current.players[0]?.mxC||0}x</strong></div></div>
          {gameMode==='multi'&&oppResult&&<div style={{marginTop:16,padding:'12px 16px',background:'rgba(255,100,100,0.08)',borderRadius:10,border:'1px solid rgba(255,100,100,0.15)'}}><div style={{color:'#ff6666',fontSize:11,letterSpacing:2,marginBottom:6}}>OPPONENT{oppFailed?' (FAILED)':''}</div><div style={{color:'#fff',fontSize:16}}>Score: <strong>{oppResult.sc}</strong> • Acc: <strong>{oppResult.acc}%</strong></div></div>}
        </>)}
        <button className="osu-start" style={{marginTop:16}} onClick={()=>{if(gameMode==='multi'&&connected)startGame();else startCountdown()}}>RETRY</button>
        <button className="osu-back" onClick={()=>{setMpMode(false);disconnect();setPh('menu')}}>Back</button>
      </div></div>)}
    </div>
  );
}
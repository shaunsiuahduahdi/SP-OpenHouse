import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { loadQuestionPool, QUESTION_POOL } from './questionPoolFirebase';
import { supabase } from './supabaseClient';
import { useWebRTC } from './useWebRTC';
import '../stylesheets/run2.css';
import { createRemoteSession } from './remoteControl';
import { useHubRemote } from './hubListener';

const SIGNAL_URL='wss://system-reboot-signaling.onrender.com';

const MAX_LIVES=3,FINISH=800,JOG_DECAY=0.93;
const W_GAP=180,TRIVIA_DIST=50,TECH_DIST=150,VIRUS_DIST=180,C67_DIST=200,POSE_HOLD_DIST=120,JUMBA_DIST=160;
const AV_SC=0.38;
const CABLE_COLORS=['#ef4444','#22c55e','#3b82f6','#fbbf24'];
const CABLE_NAMES=['RED','GREEN','BLUE','YELLOW'];
const WALL_SPAWN=-60,WALL_CHECK=-1.5,WALL_REMOVE=6,WALL_SPD_B=0.15,WALL_SPD_J=0.35;
const TW=14,TH=10,TL=80;
const VIRUS_MAX=15,VIRUS_SPAWN_INT=8,C67_REPS=30;

// Pose checks for cutout walls
const POSES=[
  {id:'ll',lbl:'CORRUPTED BARRIER — LEAN LEFT',ck:k=>k.smx<0.35},
  {id:'lr',lbl:'CORRUPTED BARRIER — LEAN RIGHT',ck:k=>k.smx>0.65},
  {id:'cr',lbl:'CORRUPTED BARRIER — CROUCH',ck:k=>k.hy>0.70},
  {id:'llc',lbl:'CORRUPTED BARRIER — LEFT+CROUCH',ck:k=>k.smx<0.38&&k.hy>0.62},
  {id:'lrc',lbl:'CORRUPTED BARRIER — RIGHT+CROUCH',ck:k=>k.smx>0.62&&k.hy>0.62},
  {id:'cn',lbl:'CORRUPTED BARRIER — STAND STRAIGHT',ck:k=>k.smx>0.44&&k.smx<0.56},
];
const CUTS={ll:{x:0.02,y:0.05,w:0.42,h:0.85},lr:{x:0.56,y:0.05,w:0.42,h:0.85},cr:{x:0.12,y:0.02,w:0.76,h:0.45},llc:{x:0.02,y:0.02,w:0.40,h:0.50},lrc:{x:0.58,y:0.02,w:0.40,h:0.50},cn:{x:0.34,y:0.05,w:0.32,h:0.90}};
const TRIVIA_HOLES=[{x:0.05,y:0.12,w:0.40,h:0.76},{x:0.55,y:0.12,w:0.40,h:0.76}];

// Security Authentication questions
const TRIVIA=[
  {q:"AUTH CHECK: Year SP was founded?",l:"1954",r:"1968",c:"left"},
  {q:"AUTH CHECK: SP's mascot?",l:"Lion",r:"Eagle",c:"right"},
  {q:"AUTH CHECK: Number of SP schools?",l:"7",r:"10",c:"left"},
  {q:"AUTH CHECK: SP location?",l:"Dover",r:"Clementi",c:"left"},
  {q:"AUTH CHECK: SP motto ends with?",l:"Better Life",r:"Brighter Future",c:"left"},
  {q:"AUTH CHECK: Nearest MRT?",l:"Dover",r:"Buona Vista",c:"left"},
  {q:"AUTH CHECK: SP was Singapore's first?",l:"Polytechnic",r:"University",c:"left"},
  {q:"AUTH CHECK: SP logo color?",l:"Blue",r:"Orange",c:"right"},
];

// Hold-the-Pose calibration poses with stickman preview
const HOLD_POSES=[
  {id:'hp_t',lbl:'T-POSE',desc:'Extend both arms horizontally',
    ck:k=>k.ok&&Math.abs(k.lwy-k.sy)<0.10&&Math.abs(k.rwy-k.sy)<0.10&&Math.abs(k.lwx-k.rwx)>0.5,
    draw:(ctx,cx,cy,sz)=>{
      // Head
      ctx.beginPath();ctx.arc(cx,cy-sz*0.8,sz*0.18,0,Math.PI*2);ctx.stroke();
      // Body
      ctx.beginPath();ctx.moveTo(cx,cy-sz*0.62);ctx.lineTo(cx,cy+sz*0.2);ctx.stroke();
      // Arms — straight out
      ctx.beginPath();ctx.moveTo(cx-sz*0.6,cy-sz*0.45);ctx.lineTo(cx,cy-sz*0.5);ctx.lineTo(cx+sz*0.6,cy-sz*0.45);ctx.stroke();
      // Legs
      ctx.beginPath();ctx.moveTo(cx,cy+sz*0.2);ctx.lineTo(cx-sz*0.25,cy+sz*0.8);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,cy+sz*0.2);ctx.lineTo(cx+sz*0.25,cy+sz*0.8);ctx.stroke();
    }},
  {id:'hp_hands_up',lbl:'HANDS UP',desc:'Raise both hands above your head',
    ck:k=>k.ok&&k.lwy<k.sy-0.10&&k.rwy<k.sy-0.10,
    draw:(ctx,cx,cy,sz)=>{
      ctx.beginPath();ctx.arc(cx,cy-sz*0.8,sz*0.18,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,cy-sz*0.62);ctx.lineTo(cx,cy+sz*0.2);ctx.stroke();
      // Arms — both up in V
      ctx.beginPath();ctx.moveTo(cx-sz*0.35,cy-sz*1.1);ctx.lineTo(cx-sz*0.1,cy-sz*0.5);ctx.lineTo(cx,cy-sz*0.5);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx+sz*0.35,cy-sz*1.1);ctx.lineTo(cx+sz*0.1,cy-sz*0.5);ctx.lineTo(cx,cy-sz*0.5);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,cy+sz*0.2);ctx.lineTo(cx-sz*0.25,cy+sz*0.8);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,cy+sz*0.2);ctx.lineTo(cx+sz*0.25,cy+sz*0.8);ctx.stroke();
    }},
  {id:'hp_left_arm',lbl:'LEFT SALUTE',desc:'Raise left arm, keep right low',
    ck:k=>k.ok&&k.lwy<k.sy-0.05&&k.rwy>k.hy-0.05,
    draw:(ctx,cx,cy,sz)=>{
      ctx.beginPath();ctx.arc(cx,cy-sz*0.8,sz*0.18,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,cy-sz*0.62);ctx.lineTo(cx,cy+sz*0.2);ctx.stroke();
      // Left arm — up
      ctx.beginPath();ctx.moveTo(cx-sz*0.3,cy-sz*1.0);ctx.lineTo(cx-sz*0.1,cy-sz*0.5);ctx.lineTo(cx,cy-sz*0.5);ctx.stroke();
      // Right arm — down
      ctx.beginPath();ctx.moveTo(cx,cy-sz*0.5);ctx.lineTo(cx+sz*0.15,cy-sz*0.2);ctx.lineTo(cx+sz*0.35,cy+sz*0.1);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,cy+sz*0.2);ctx.lineTo(cx-sz*0.25,cy+sz*0.8);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,cy+sz*0.2);ctx.lineTo(cx+sz*0.25,cy+sz*0.8);ctx.stroke();
    }},
  {id:'hp_right_arm',lbl:'RIGHT SALUTE',desc:'Raise right arm, keep left low',
    ck:k=>k.ok&&k.rwy<k.sy-0.05&&k.lwy>k.hy-0.05,
    draw:(ctx,cx,cy,sz)=>{
      ctx.beginPath();ctx.arc(cx,cy-sz*0.8,sz*0.18,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,cy-sz*0.62);ctx.lineTo(cx,cy+sz*0.2);ctx.stroke();
      // Left arm — down
      ctx.beginPath();ctx.moveTo(cx,cy-sz*0.5);ctx.lineTo(cx-sz*0.15,cy-sz*0.2);ctx.lineTo(cx-sz*0.35,cy+sz*0.1);ctx.stroke();
      // Right arm — up
      ctx.beginPath();ctx.moveTo(cx+sz*0.3,cy-sz*1.0);ctx.lineTo(cx+sz*0.1,cy-sz*0.5);ctx.lineTo(cx,cy-sz*0.5);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,cy+sz*0.2);ctx.lineTo(cx-sz*0.25,cy+sz*0.8);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,cy+sz*0.2);ctx.lineTo(cx+sz*0.25,cy+sz*0.8);ctx.stroke();
    }},
  {id:'hp_squat',lbl:'SQUAT',desc:'Bend your knees and crouch down',
    ck:k=>k.ok&&k.hy>0.65,
    draw:(ctx,cx,cy,sz)=>{
      // Head lower
      ctx.beginPath();ctx.arc(cx,cy-sz*0.45,sz*0.18,0,Math.PI*2);ctx.stroke();
      // Short body (crouching)
      ctx.beginPath();ctx.moveTo(cx,cy-sz*0.27);ctx.lineTo(cx,cy+sz*0.15);ctx.stroke();
      // Arms out slightly
      ctx.beginPath();ctx.moveTo(cx-sz*0.4,cy-sz*0.1);ctx.lineTo(cx,cy-sz*0.15);ctx.lineTo(cx+sz*0.4,cy-sz*0.1);ctx.stroke();
      // Bent legs
      ctx.beginPath();ctx.moveTo(cx,cy+sz*0.15);ctx.lineTo(cx-sz*0.3,cy+sz*0.35);ctx.lineTo(cx-sz*0.25,cy+sz*0.75);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,cy+sz*0.15);ctx.lineTo(cx+sz*0.3,cy+sz*0.35);ctx.lineTo(cx+sz*0.25,cy+sz*0.75);ctx.stroke();
    }},
];

function startMusic(){
  try{const a=new Audio('/bgm.mp4');a.loop=true;a.volume=0.5;a.play().catch(()=>{});return{stop:()=>{a.pause();a.currentTime=0}}}catch(e){}
  try{const ac=new(window.AudioContext||window.webkitAudioContext)();const notes=[392,440,494,523,494,440,392,330,349,392,440,494,523,587,523,494];let idx=0,iv;const play=()=>{const o=ac.createOscillator(),g=ac.createGain(),f=ac.createBiquadFilter();o.connect(f);f.connect(g);g.connect(ac.destination);o.type='triangle';o.frequency.setValueAtTime(notes[idx],ac.currentTime);f.type='lowpass';f.frequency.setValueAtTime(1200,ac.currentTime);g.gain.setValueAtTime(0,ac.currentTime);g.gain.linearRampToValueAtTime(0.04,ac.currentTime+0.03);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.3);o.start(ac.currentTime);o.stop(ac.currentTime+0.3);idx=(idx+1)%notes.length};play();iv=setInterval(play,380);const bass=ac.createOscillator(),bg=ac.createGain();bass.connect(bg);bg.connect(ac.destination);bass.type='sine';bass.frequency.setValueAtTime(65,ac.currentTime);bg.gain.setValueAtTime(0.025,ac.currentTime);bass.start(ac.currentTime);return{stop:()=>{clearInterval(iv);try{bass.stop()}catch(e){}}}}catch(e){return{stop:()=>{}}}}

function makeCables(w,h,count=4){const padY=h*0.12,gap=(h-padY*2)/(count-1),srcX=w*0.2,tgtX=w*0.8;const srcYs=[];for(let i=0;i<count;i++)srcYs.push(padY+i*gap);const tgtYs=[...srcYs];do{for(let i=tgtYs.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[tgtYs[i],tgtYs[j]]=[tgtYs[j],tgtYs[i]]}}while(tgtYs.every((y,i)=>Math.abs(y-srcYs[i])<5));return srcYs.map((sy,i)=>({color:CABLE_COLORS[i%CABLE_COLORS.length],name:CABLE_NAMES[i%CABLE_NAMES.length],srcX,srcY:sy,tgtX,tgtY:tgtYs[i],grabbed:false,connected:false,grabHand:null,tipX:srcX+80,tipY:sy}))}

// Three.js walls
function makeHole(shape,c){const hx=-TW/2+c.x*TW,hy=-TH/2+c.y*TH,hw=c.w*TW,hh=c.h*TH,r=0.3;const hole=new THREE.Path();hole.moveTo(hx+r,hy);hole.lineTo(hx+hw-r,hy);hole.quadraticCurveTo(hx+hw,hy,hx+hw,hy+r);hole.lineTo(hx+hw,hy+hh-r);hole.quadraticCurveTo(hx+hw,hy+hh,hx+hw-r,hy+hh);hole.lineTo(hx+r,hy+hh);hole.quadraticCurveTo(hx,hy+hh,hx,hy+hh-r);hole.lineTo(hx,hy+r);hole.quadraticCurveTo(hx,hy,hx+r,hy);shape.holes.push(hole)}
function wallShape(){const s=new THREE.Shape();s.moveTo(-TW/2,-TH/2);s.lineTo(TW/2,-TH/2);s.lineTo(TW/2,TH/2);s.lineTo(-TW/2,TH/2);s.lineTo(-TW/2,-TH/2);return s}
function addWallTexture(mesh,col,col2,dz){const s=THREE.DoubleSide;const mk=(w2,h2,x,y,rz,op)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w2,h2),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op||0.35,side:s}));m.position.set(x,y,dz);if(rz)m.rotation.z=rz;mesh.add(m)};
  // Frame border
  const fb=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(TW-0.5,TH-0.5)),new THREE.LineBasicMaterial({color:col,transparent:true,opacity:0.5}));fb.position.z=dz;mesh.add(fb);
  // Outer octagon
  const oR=Math.min(TW,TH)*0.28;for(let i=0;i<8;i++){const a1=(i/8)*Math.PI*2,a2=((i+1)/8)*Math.PI*2;const x1=Math.cos(a1)*oR,y1=Math.sin(a1)*oR,x2=Math.cos(a2)*oR,y2=Math.sin(a2)*oR;const dx=x2-x1,dy=y2-y1;mk(Math.sqrt(dx*dx+dy*dy),0.07,(x1+x2)/2,(y1+y2)/2,Math.atan2(dy,dx),0.4)}
  // Inner octagon — smaller
  const iR=oR*0.55;for(let i=0;i<8;i++){const a1=(i/8)*Math.PI*2+Math.PI/8,a2=((i+1)/8)*Math.PI*2+Math.PI/8;const x1=Math.cos(a1)*iR,y1=Math.sin(a1)*iR,x2=Math.cos(a2)*iR,y2=Math.sin(a2)*iR;const dx=x2-x1,dy=y2-y1;mk(Math.sqrt(dx*dx+dy*dy),0.05,(x1+x2)/2,(y1+y2)/2,Math.atan2(dy,dx),0.25)}
  // Diagonal connectors from corners to outer octagon
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sy])=>{const cx=sx*(TW/2-0.4),cy=sy*(TH/2-0.4),tx=sx*oR*0.75,ty=sy*oR*0.75;const dx=tx-cx,dy=ty-cy;const m=new THREE.Mesh(new THREE.PlaneGeometry(Math.sqrt(dx*dx+dy*dy),0.05),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.22,side:s}));m.position.set((cx+tx)/2,(cy+ty)/2,dz);m.rotation.z=Math.atan2(dy,dx);mesh.add(m)});
  // Horizontal scan lines
  for(let i=-2;i<=2;i++){if(i===0)continue;mk(TW*0.8,0.03,0,i*TH*0.15,0,0.12)}
  // Cross dividers — bright
  mk(TW*0.8,0.05,0,0,0,0.25);const vd=new THREE.Mesh(new THREE.PlaneGeometry(0.05,TH*0.7),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.2,side:s}));vd.position.set(0,0,dz);mesh.add(vd);
  // Corner brackets — neon bright
  [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([sx,sy])=>{const h2=new THREE.Mesh(new THREE.PlaneGeometry(1.6,0.09),new THREE.MeshBasicMaterial({color:col2||col,transparent:true,opacity:0.55,side:s}));h2.position.set(sx*(TW/2-1.1),sy*(TH/2-0.3),dz);mesh.add(h2);const v2=new THREE.Mesh(new THREE.PlaneGeometry(0.09,1.6),new THREE.MeshBasicMaterial({color:col2||col,transparent:true,opacity:0.55,side:s}));v2.position.set(sx*(TW/2-0.3),sy*(TH/2-1.1),dz);mesh.add(v2)})}
function makePoseWall(id,isAtk){const s=wallShape();makeHole(s,CUTS[id]||CUTS.cn);const g=new THREE.ExtrudeGeometry(s,{depth:0.35,bevelEnabled:false});
  const bc=isAtk?0xbb3322:0x1199bb,ec=isAtk?0xff6644:0x55ffff,tc=isAtk?0xff8866:0x88ffff,tc2=isAtk?0xffaa88:0xaaffff;
  const m=new THREE.MeshBasicMaterial({color:bc,transparent:true,opacity:0.8,side:THREE.DoubleSide});const mesh=new THREE.Mesh(g,m);
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g),new THREE.LineBasicMaterial({color:ec,transparent:true,opacity:0.85})));
  addWallTexture(mesh,tc,tc2,0.18);return mesh}
function makeTriviaWall(isAtk){const s=wallShape();TRIVIA_HOLES.forEach(c=>makeHole(s,c));const g=new THREE.ExtrudeGeometry(s,{depth:0.35,bevelEnabled:false});
  const bc=isAtk?0x992211:0x6622cc,ec=isAtk?0xff7755:0xcc88ff,tc=isAtk?0xff9977:0xcc99ff,tc2=isAtk?0xffbb99:0xddaaff;
  const m=new THREE.MeshBasicMaterial({color:bc,transparent:true,opacity:0.8,side:THREE.DoubleSide});const mesh=new THREE.Mesh(g,m);
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g),new THREE.LineBasicMaterial({color:ec,transparent:true,opacity:0.85})));
  addWallTexture(mesh,tc,tc2,0.18);return mesh}
const RunningMan=()=>{
  const vidRef=useRef(null),mountRef=useRef(null),ovRef=useRef(null);
  const detRef=useRef(null),musicRef=useRef(null);
  const jumbaElRef=useRef(null);
  const secGuardRef=useRef(null);
  const T=useRef({scene:null,camera:null,renderer:null,wallMeshes:[],stripes:[]});

  const P=useRef({ok:false,smx:0.5,sy:0.4,hy:0.6,lwy:0.5,rwy:0.5,lwx:0.5,rwx:0.5,wHist:[],kps:null});
  const G=useRef({on:false,lives:MAX_LIVES,dist:0,spd:0,jog:0,walls:[],wcd:80,f:0,t0:0,passed:0,hit:0,tPool:[...TRIVIA],flash:null,ft:0,
    techActive:false,cables:[],techTimer:0,techMaxTime:600,lastTechDist:0,
    virusActive:false,viruses:[],virusSpawnCD:0,virusKilled:0,virusTimer:0,lastVirusDist:0,virusGlitch:0,
    c67Active:false,c67Reps:0,c67LUp:false,c67RUp:false,c67Timer:0,c67MaxTime:1200,lastC67Dist:0,c67LastPop:0,
    holdActive:false,holdPose:null,holdTimer:0,holdMaxTime:300,holdHeld:0,holdTarget:90,lastHoldDist:0,
    jumbaActive:false,jumbaTimer:0,jumbaMaxTime:480,jumbaWhacked:0,jumbaTarget:3,jumbaSpawnCD:0,jumbaPipes:[],jumbaCurrentPipe:-1,jumbaPopTimer:0,jumbaPopDur:8,jumbaState:'hidden',jumbaHitAnim:0,lastJumbaDist:0,
    hLX:0,hLY:0,hRX:0,hRY:0,hLV:false,hRV:false,wallsSinceLastMini:0,
    secActive:false,secTimer:0,secDuration:0,secCaught:false,secCaughtT:0,lastSecDist:0,secBasePos:null,
    // Attacker mini-games
    atkSnapActive:false,atkSnapCables:[],atkSnapTimer:0,atkSnapCut:0,lastAtkSnapDist:0,
    atkVirusPassActive:false,atkVPViruses:[],atkVPTimer:0,atkVPTossed:0,atkVPTarget:0,lastAtkVPDist:0,
    atkFlappyActive:false,atkFlappyTimer:0,atkFlappyY:0.5,atkFlappyVel:0,atkFlappyPipes:[],atkFlappyPassed:0,atkFlappyDead:false,lastAtkFlappyDist:0,
    atkDuelActive:false,atkDuelTimer:0,atkDuelReps:0,atkDuelLUp:false,atkDuelRUp:false,atkDuelTarget:30,atkDuelLastPop:0,atkDuelOppReps:0,atkDuelDone:false,lastAtkDuelDist:0,
    // Defender debuffs
    debuffSlow:0,debuffGlitch:0,debuffDrain:0,
    // Speed orb system
    spdOrb:null,spdOrbCD:0,spdBoost:1,spdBoostTimer:0,spdBoostMult:1,lastOrbBeat:0,
  });

  const[ph,setPh]=useState('loading');const[lm,setLm]=useState('Booting system...');
  const[cam,setCam]=useState(false);const[mdl,setMdl]=useState(false);
  const[hL,setHL]=useState(MAX_LIVES);const[hD,setHD]=useState(0);const[hJ,setHJ]=useState(0);
  const[hWL,setHWL]=useState(null);const[hWT,setHWT]=useState(null);const[hF,setHF]=useState(null);const[hHide,setHHide]=useState(false);
  const[gameMode,setGameMode]=useState(null); // 'single' | 'multi'
  const[mpWinner,setMpWinner]=useState(null); // 'attacker' | 'defender' | null

  // Config state
  const[cfgDiff,setCfgDiff]=useState('hard'); // 'easy' | 'hard'
  const[cfgTrivia,setCfgTrivia]=useState('both'); // 'sp' | 'tech' | 'both'
  const[cfgObs,setCfgObs]=useState({walls:true,trivia:true,cables:true,virus:true,counter:true,hold:true,jumba:true,security:true});
  const[lbScores,setLbScores]=useState([]);const[lbName,setLbName]=useState('');const[lbSubmitted,setLbSubmitted]=useState(false);

  // Multiplayer
  const{roomCode,connected,isHost,error:rtcErr,createRoom,joinRoom,send,onMessage,disconnect}=useWebRTC(SIGNAL_URL);
  const[mpMode,setMpMode]=useState(false);const[joinCode,setJoinCode]=useState('');
  const[oppDist,setOppDist]=useState(0);const[oppLives,setOppLives]=useState(MAX_LIVES);const[oppDone,setOppDone]=useState(false);const[oppName,setOppName]=useState('OPPONENT');
  const[mpRole,setMpRole]=useState(null);const[oppRole,setOppRole]=useState(null);
  const mpRef=useRef({lastSend:0});

  // Remote control
  const[remoteCode,setRemoteCode]=useState(null);
  const[remoteErr,setRemoteErr]=useState(null);
  const[remoteConnected,setRemoteConnected]=useState(false);
  const remoteRef=useRef({unsubscribe:null,updateGameState:null});

  // ── HUB REMOTE — listen to master hub session if ?hub=XXXX in URL ──
  const hubCode=useHubRemote((cmd,data)=>{
    if(cmd==='selectMode'){if(data.mode==='single'){setGameMode('single');setMpMode(false);setMpRole(null);setPh('start')}else if(data.mode==='multi'){setGameMode('multi');setPh('start')}}
    if(cmd==='setDifficulty'&&data.difficulty)setCfgDiff(data.difficulty);
    if(cmd==='toggleObstacle'&&data.obstacle!=null)setCfgObs(prev=>({...prev,[data.obstacle]:data.enabled}));
    if(cmd==='startGame'||cmd==='start'){if(!gameMode)setGameMode('single');setLbSubmitted(false);setLbName('');setPh('cd')}
    if(cmd==='stop'){const g2=G.current;g2.on=false;g2.techActive=false;g2.virusActive=false;g2.c67Active=false;g2.holdActive=false;g2.jumbaActive=false;g2.secActive=false;g2.atkSnapActive=false;g2.atkVirusPassActive=false;g2.atkFlappyActive=false;g2.atkDuelActive=false;if(musicRef.current)musicRef.current.stop();const el=secGuardRef.current;if(el){el.style.display='none';el.style.transform='none'};const el2=jumbaElRef.current;if(el2)el2.style.display='none';setPh('menu')}
    if(cmd==='restart'){if(!gameMode)setGameMode('single');setLbSubmitted(false);setLbName('');setPh('cd')}
    if(cmd==='backToMenu'){const g2=G.current;g2.on=false;if(musicRef.current)musicRef.current.stop();const el=secGuardRef.current;if(el){el.style.display='none';el.style.transform='none'};const el2=jumbaElRef.current;if(el2)el2.style.display='none';setMpMode(false);setPh('menu')}
    if(cmd==='backToHub'||cmd==='selectGame'){const g2=G.current;g2.on=false;if(musicRef.current)musicRef.current.stop();const el=secGuardRef.current;if(el){el.style.display='none'};const el2=jumbaElRef.current;if(el2)el2.style.display='none';window.location.hash='#/home'}
  });

  const fetchLeaderboard=useCallback(async()=>{try{const{data}=await supabase.from('leaderboard').select('*').order('uptime',{ascending:false}).limit(10);if(data)setLbScores(data)}catch(e){}},[]);
  const submitScore=useCallback(async(name,uptime,cleared,errors,pct)=>{if(!name.trim())return;try{await supabase.from('leaderboard').insert([{name:name.trim(),uptime,cleared,errors,charge_pct:pct}]);setLbSubmitted(true);fetchLeaderboard()}catch(e){}},[fetchLeaderboard]);

  // ── REMOTE CONTROL — create own session (skipped when hub connected) ──
  useEffect(()=>{
    if(hubCode)return; // skip — commands come from hub_sessions instead
    let mounted=true;
    (async()=>{
      try{
        const{sessionCode,unsubscribe,updateGameState}=await createRemoteSession((cmd,data)=>{
          if(!mounted)return;
          console.log('[Remote]',cmd,data);
          if(cmd==='selectMode'){
            if(data.mode==='single'){setGameMode('single');setMpMode(false);setMpRole(null);setPh('start')}
            else if(data.mode==='multi'){setGameMode('multi');setPh('start')}
          }
          if(cmd==='configure'){
            if(data.diff)setCfgDiff(data.diff);
            if(data.trivia)setCfgTrivia(data.trivia);
            if(data.obs)setCfgObs(prev=>({...prev,...data.obs}));
          }
          if(cmd==='startGame'){
            // Trigger startG — need to use a ref trick since startG is a callback
            remoteRef.current.pendingStart=true;
          }
          if(cmd==='retry'){remoteRef.current.pendingStart=true}
          if(cmd==='backToMenu'){
            const g=G.current;
            g.on=false;if(musicRef.current)musicRef.current.stop();
            setPh('menu');
          }
          if(cmd==='forceStop'){
            const g=G.current;
            g.on=false;g.lives=0;if(musicRef.current)musicRef.current.stop();
            setPh('go');
          }
        });
        if(mounted){
          setRemoteCode(sessionCode);
          remoteRef.current.unsubscribe=unsubscribe;
          remoteRef.current.updateGameState=updateGameState;
        }
      }catch(e){console.error('[Remote] Failed to create session:',e);if(mounted)setRemoteErr(e.toString())}
    })();
    return()=>{mounted=false;if(remoteRef.current.unsubscribe)remoteRef.current.unsubscribe()};
  },[]); // eslint-disable-line

  // Handle pending remote start commands
  useEffect(()=>{
    if(remoteRef.current.pendingStart){
      remoteRef.current.pendingStart=false;
      if(ph==='start'||ph==='go'||ph==='menu'){
        if(!gameMode)setGameMode('single');
        // Small delay to let state settle
        setTimeout(()=>{
          setLbSubmitted(false);setLbName('');setPh('cd');
        },100);
      }
    }
  });

  // Sync game state to Firebase for remote display — every 5s (low quota)
  useEffect(()=>{
    if(!remoteRef.current.updateGameState)return;
    const iv=setInterval(()=>{
      const g=G.current;
      remoteRef.current.updateGameState({
        phase:ph,
        dist:Math.floor(g.dist),
        lives:g.lives,
        passed:g.passed,
        hit:g.hit,
      });
    },5000);
    // Also sync immediately on phase change
    const g=G.current;
    remoteRef.current.updateGameState({phase:ph,dist:Math.floor(g.dist),lives:g.lives,passed:g.passed,hit:g.hit});
    return()=>clearInterval(iv);
  },[ph]);

  // Multiplayer message handler
  useEffect(()=>{onMessage((msg)=>{
    if(msg.type==='sync'){setOppDist(msg.dist||0);setOppLives(msg.lives??MAX_LIVES)}
    if(msg.type==='done'){setOppDone(true);setOppDist(msg.dist||0);setOppLives(msg.lives??0);
      if(gameMode==='multi'){const g=G.current;
        const oppDied=(msg.lives!==undefined&&msg.lives<=0);
        if(oppDied){setMpWinner(mpRole)}
        else{setMpWinner(msg.role)}
        // Kill ALL active mini-games + game loop
        g.techActive=false;g.virusActive=false;g.c67Active=false;g.holdActive=false;g.jumbaActive=false;g.secActive=false;
        g.atkSnapActive=false;g.atkVirusPassActive=false;g.atkFlappyActive=false;g.atkDuelActive=false;
        g.on=false;if(musicRef.current)musicRef.current.stop();
        const el=secGuardRef.current;if(el){el.style.display='none';el.style.transform='none'}
        const el2=jumbaElRef.current;if(el2)el2.style.display='none';
        setPh('go');
      }
    }
    if(msg.type==='name'){setOppName(msg.name||'OPPONENT')}
    if(msg.type==='role'){setOppRole(msg.role)}
    if(msg.type==='start'){setPh('cd')}
    // 67 Duel — synced mini-game
    if(msg.type==='duel67'){const g=G.current;
      if(!g.atkDuelActive&&!g.techActive&&!g.virusActive&&!g.c67Active&&!g.holdActive&&!g.jumbaActive){
        g.atkDuelActive=true;g.atkDuelTimer=0;g.atkDuelReps=0;g.atkDuelLUp=false;g.atkDuelRUp=false;g.atkDuelTarget=30;g.atkDuelLastPop=0;g.atkDuelOppReps=0;g.atkDuelDone=false;
      }
    }
    if(msg.type==='duel67sync'){const g=G.current;g.atkDuelOppReps=msg.reps||0}
    if(msg.type==='duel67done'){const g=G.current;
      if(g.atkDuelActive&&!g.atkDuelDone){
        // Opponent finished first — I lose a life
        g.atkDuelDone=true;g.lives--;g.hit++;sfx.current.no?.();try{navigator.vibrate&&navigator.vibrate([200,50,200])}catch(e){}
        if(g.lives<=0){g.on=false;if(musicRef.current)musicRef.current.stop();setPh('go')}
        setTimeout(()=>{g.atkDuelActive=false},1500);
      }
    }
    // Attacker's attacks hit the defender
    if(msg.type==='attack'){const g=G.current;
      if(msg.atk==='snapwire'){
        if(!g.techActive&&!g.virusActive&&!g.c67Active&&!g.holdActive&&!g.jumbaActive){
          g.techActive=true;g.cables=makeCables(window.innerWidth,window.innerHeight,msg.count||4);g.techTimer=0;g.techMaxTime=600;
        }
      }
      if(msg.atk==='viruspass'){
        if(!g.techActive&&!g.virusActive&&!g.c67Active&&!g.holdActive&&!g.jumbaActive){
          g.virusActive=true;g.viruses=[];g.virusSpawnCD=20;g.virusKilled=0;g.virusTimer=0;g.virusGlitch=0;g.virusEasy=false;
        }
      }

    }
  })},[onMessage]); // eslint-disable-line

  const sfx=useRef({});
  useEffect(()=>{sfx.current.ok=()=>{try{const a=new(window.AudioContext||window.webkitAudioContext)();[523,659,784].forEach((f,i)=>{const o=a.createOscillator(),g2=a.createGain();o.connect(g2);g2.connect(a.destination);o.type='sine';o.frequency.setValueAtTime(f,a.currentTime);const t2=a.currentTime+i*0.06;g2.gain.setValueAtTime(0,t2);g2.gain.linearRampToValueAtTime(0.15,t2+0.02);g2.gain.exponentialRampToValueAtTime(0.01,t2+0.12);o.start(t2);o.stop(t2+0.12)})}catch{}};sfx.current.no=()=>{try{const a=new(window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g2=a.createGain();o.connect(g2);g2.connect(a.destination);o.type='sawtooth';o.frequency.setValueAtTime(200,a.currentTime);o.frequency.exponentialRampToValueAtTime(80,a.currentTime+0.3);g2.gain.setValueAtTime(0.15,a.currentTime);g2.gain.exponentialRampToValueAtTime(0.01,a.currentTime+0.3);o.start(a.currentTime);o.stop(a.currentTime+0.3)}catch{}};sfx.current.snap=()=>{try{const a=new(window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g2=a.createGain();o.connect(g2);g2.connect(a.destination);o.type='sine';o.frequency.setValueAtTime(880,a.currentTime);o.frequency.exponentialRampToValueAtTime(440,a.currentTime+0.1);g2.gain.setValueAtTime(0.12,a.currentTime);g2.gain.exponentialRampToValueAtTime(0.01,a.currentTime+0.1);o.start(a.currentTime);o.stop(a.currentTime+0.1)}catch{}};sfx.current.pop=()=>{try{const a=new(window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g2=a.createGain();o.connect(g2);g2.connect(a.destination);o.type='square';o.frequency.setValueAtTime(600+Math.random()*400,a.currentTime);o.frequency.exponentialRampToValueAtTime(100,a.currentTime+0.08);g2.gain.setValueAtTime(0.1,a.currentTime);g2.gain.exponentialRampToValueAtTime(0.001,a.currentTime+0.08);o.start(a.currentTime);o.stop(a.currentTime+0.08)}catch{}};sfx.current.siren=()=>{try{const a=new(window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g2=a.createGain();o.connect(g2);g2.connect(a.destination);o.type='sawtooth';o.frequency.setValueAtTime(600,a.currentTime);o.frequency.linearRampToValueAtTime(900,a.currentTime+0.3);o.frequency.linearRampToValueAtTime(600,a.currentTime+0.6);o.frequency.linearRampToValueAtTime(900,a.currentTime+0.9);o.frequency.linearRampToValueAtTime(600,a.currentTime+1.2);o.frequency.linearRampToValueAtTime(900,a.currentTime+1.5);o.frequency.linearRampToValueAtTime(600,a.currentTime+1.8);g2.gain.setValueAtTime(0.04,a.currentTime);g2.gain.setValueAtTime(0.04,a.currentTime+1.6);g2.gain.exponentialRampToValueAtTime(0.001,a.currentTime+2.0);o.start(a.currentTime);o.stop(a.currentTime+2.0)}catch{}};},[]);

  // Camera + MoveNet
  useEffect(()=>{let s;(async()=>{try{s=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});if(vidRef.current){vidRef.current.srcObject=s;vidRef.current.onloadedmetadata=()=>{vidRef.current.play();setCam(true)}}}catch{setLm('Camera access required.')}})();return()=>{if(s)s.getTracks().forEach(t2=>t2.stop())}},[]); // eslint-disable-line
  useEffect(()=>{let a=true;(async()=>{try{setLm('Loading neural interface...');await window.tf.setBackend('webgl');await window.tf.ready();setLm('Calibrating sensors...');const d=await window.poseDetection.createDetector(window.poseDetection.SupportedModels.MoveNet,{modelType:window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING});if(a){detRef.current=d;setMdl(true);setPh('menu')}}catch(e){console.error(e);if(a)setLm('System boot failed.')}})();return()=>{a=false}},[]); // eslint-disable-line
  useEffect(()=>{if(!cam||!mdl||!detRef.current)return;let id,busy=false;const loop=async()=>{if(!busy&&vidRef.current?.readyState>=2){busy=true;try{const poses=await detRef.current.estimatePoses(vidRef.current);const p=P.current,vw=vidRef.current.videoWidth||640,vh=vidRef.current.videoHeight||480;if(poses.length>0){const k=poses[0].keypoints;p.kps=k;const gt=i=>{const kp=k[i];return kp?.score>0.2?{x:1-kp.x/vw,y:kp.y/vh}:null};const ls=gt(5),rs=gt(6),lw=gt(9),rw=gt(10),lh=gt(11),rh=gt(12);p.ok=!!(ls&&rs);if(ls&&rs){p.smx=(ls.x+rs.x)/2;p.sy=(ls.y+rs.y)/2}p.hy=(lh&&rh)?(lh.y+rh.y)/2:0.6;p.lwy=lw?lw.y:0.5;p.rwy=rw?rw.y:0.5;p.lwx=lw?lw.x:0.5;p.rwx=rw?rw.x:0.5;p.wHist.push({l:p.lwy,r:p.rwy});if(p.wHist.length>40)p.wHist.shift()}else{p.ok=false;p.kps=null}}catch{}busy=false}id=requestAnimationFrame(loop)};id=requestAnimationFrame(loop);return()=>cancelAnimationFrame(id)},[cam,mdl]);
  // Load questions from Firebase on mount
  useEffect(() => {
    loadQuestionPool().then(() => {
      console.log('Questions loaded from Firebase');
    }).catch(err => {
      console.warn('Firebase load failed, using fallback:', err);
    });
  }, []);

  const jogDet=useCallback(()=>{const h=P.current.wHist;if(h.length<15)return 0;const r=h.slice(-25),vr=a=>{const av=a.reduce((s,v)=>s+v,0)/a.length;return a.reduce((s,v)=>s+(v-av)**2,0)/a.length};const tv=(vr(r.map(x=>x.l))+vr(r.map(x=>x.r)))/2;let al=0;for(let i=1;i<r.length;i++){const ld=r[i].l-r[i-1].l,rd=r[i].r-r[i-1].r;if((ld>0.005&&rd<-0.005)||(ld<-0.005&&rd>0.005))al++}return Math.min(1,tv*600+(al/(r.length-1))*1.5+Math.abs(P.current.lwy-P.current.rwy)*2)},[]);

  // Three.js scene — role-dependent colors
  useEffect(()=>{if(!mountRef.current)return;const t=T.current,W=window.innerWidth,H=window.innerHeight;
    const isAtk=mpRole==='attacker';
    const fogC=isAtk?0x140608:0x060a14;const bgC=isAtk?0x140608:0x060a14;
    const ambC=isAtk?0xaa4422:0x2266aa;
    const floorC=isAtk?0x180a0a:0x0a0e18;const ceilC=isAtk?0x180c0c:0x080c18;const wallC=isAtk?0x1a0c0c:0x0c1018;
    const neonC=isAtk?0xff4444:0x00ddff;const neonC2=isAtk?0xff6655:0x44eeff;
    const stripC=isAtk?0xdd4444:0x00aadd;const edgeC=isAtk?0xcc3333:0x00bbdd;
    const panelBg=isAtk?0x1a0808:0x0a1420;const panelBord=isAtk?0xff5544:0x00ccff;
    t.scene=new THREE.Scene();t.scene.fog=new THREE.FogExp2(fogC,0.004);t.scene.background=new THREE.Color(bgC);
    t.camera=new THREE.PerspectiveCamera(60,W/H,0.1,200);t.camera.position.set(0,0.5,5);t.camera.lookAt(0,0,-30);
    t.renderer=new THREE.WebGLRenderer({antialias:true});t.renderer.setSize(W,H);t.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));mountRef.current.appendChild(t.renderer.domElement);
    t.scene.add(new THREE.AmbientLight(ambC,3.5));
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(TW,TL),new THREE.MeshBasicMaterial({color:floorC}));
    floor.rotation.x=-Math.PI/2;floor.position.set(0,-TH/2,-TL/2+5);t.scene.add(floor);
    t.stripes=[];
    for(let i=0;i<14;i++){const s2=new THREE.Mesh(new THREE.PlaneGeometry(TW*0.4,0.15),new THREE.MeshBasicMaterial({color:stripC,transparent:true,opacity:0.15}));s2.rotation.x=-Math.PI/2;s2.position.set(0,-TH/2+0.01,-i*4.5+5);t.scene.add(s2);t.stripes.push(s2)}
    const ceil=new THREE.Mesh(new THREE.PlaneGeometry(TW,TL),new THREE.MeshBasicMaterial({color:ceilC}));
    ceil.rotation.x=Math.PI/2;ceil.position.set(0,TH/2,-TL/2+5);t.scene.add(ceil);
    [-1,1].forEach(side=>{const w=new THREE.Mesh(new THREE.PlaneGeometry(TL,TH),new THREE.MeshBasicMaterial({color:wallC}));w.rotation.y=side*Math.PI/2;w.position.set(side*TW/2,0,-TL/2+5);t.scene.add(w)});
    [-1,1].forEach(side=>{
      [[-TH/2+0.3,0.05],[TH/2-0.3,0.05]].forEach(([y,h2])=>{
        const s2=new THREE.Mesh(new THREE.PlaneGeometry(TL,h2),new THREE.MeshBasicMaterial({color:neonC,transparent:true,opacity:0.45}));
        s2.rotation.y=side*Math.PI/2;s2.position.set(side*(TW/2-0.005),y,-TL/2+5);t.scene.add(s2)});
    });
    t.ceilLights=[];
    const archR=TW/2*0.82;
    for(let i=0;i<5;i++){
      const arch=new THREE.Mesh(new THREE.TorusGeometry(archR,0.16,6,24,Math.PI),new THREE.MeshBasicMaterial({color:neonC2,transparent:true,opacity:0.75}));
      arch.position.set(0,TH/2-archR+0.3,-i*9+3);
      t.scene.add(arch);t.ceilLights.push(arch);
    }
    t.wallPanels=[];
    for(let i=0;i<4;i++){[-1,1].forEach(side=>{
      const grp=new THREE.Group();grp.position.set(side*(TW/2-0.01),-TH/2+2.8,-i*9+3);
      const p=new THREE.Mesh(new THREE.PlaneGeometry(2.4,3.0),new THREE.MeshBasicMaterial({color:panelBg,transparent:true,opacity:0.6,side:THREE.DoubleSide}));
      p.rotation.y=side*Math.PI/2;grp.add(p);
      const e=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(2.4,3.0)),new THREE.LineBasicMaterial({color:panelBord,transparent:true,opacity:0.45}));
      e.rotation.y=side*Math.PI/2;grp.add(e);
      t.scene.add(grp);t.wallPanels.push(grp);
    })}
    [-1,1].forEach(side=>{const e2=new THREE.Mesh(new THREE.PlaneGeometry(0.06,TL),new THREE.MeshBasicMaterial({color:edgeC,transparent:true,opacity:0.25}));e2.rotation.x=-Math.PI/2;e2.position.set(side*(TW/2-0.25),-TH/2+0.01,-TL/2+5);t.scene.add(e2)});

    const onRsz=()=>{const w2=window.innerWidth,h2=window.innerHeight;t.camera.aspect=w2/h2;t.camera.updateProjectionMatrix();t.renderer.setSize(w2,h2)};window.addEventListener('resize',onRsz);
    return()=>{window.removeEventListener('resize',onRsz);t.av=null;t.renderer.dispose();if(mountRef.current?.contains(t.renderer.domElement))mountRef.current.removeChild(t.renderer.domElement)};
  },[mpRole]);

  const startG=useCallback(()=>{setLbSubmitted(false);setLbName('');setOppDist(0);setOppLives(MAX_LIVES);setOppDone(false);setMpWinner(null);if(gameMode==='multi'&&connected)send({type:'start'});setPh('cd')},[gameMode,connected,send]);
  const cdDone=useCallback(()=>{const g=G.current,t=T.current;g.on=true;g.lives=MAX_LIVES;g.dist=0;g.spd=0;g.jog=0;g.walls=[];g.wcd=80;g.f=0;g.t0=Date.now();g.passed=0;g.hit=0;g.flash=null;g.ft=0;g.techActive=false;g.cables=[];g.lastTechDist=0;g.virusActive=false;g.viruses=[];g.lastVirusDist=0;g.c67Active=false;g.c67Reps=0;g.c67LUp=false;g.c67RUp=false;g.lastC67Dist=0;g.holdActive=false;g.lastHoldDist=0;g.jumbaActive=false;g.lastJumbaDist=0;g.secActive=false;g.secTimer=0;g.secCaught=false;g.lastSecDist=0;
    g.atkSnapActive=false;g.atkSnapCables=[];g.atkSnapCut=0;g.lastAtkSnapDist=0;
    g.atkVirusPassActive=false;g.atkVPViruses=[];g.atkVPTossed=0;g.lastAtkVPDist=0;
    g.atkFlappyActive=false;g.atkFlappyPipes=[];g.atkFlappyPassed=0;g.lastAtkFlappyDist=0;
    g.atkDuelActive=false;g.atkDuelReps=0;g.atkDuelOppReps=0;g.atkDuelDone=false;g.lastAtkDuelDist=0;
    g.debuffSlow=0;g.debuffGlitch=0;g.debuffDrain=0;
    g.spdOrb=null;g.spdOrbCD=60;g.spdBoost=1;g.spdBoostTimer=0;g.spdBoostMult=1;g.lastOrbBeat=0;
    P.current.wHist=[];t.wallMeshes.forEach(wm=>{t.scene.remove(wm.mesh);wm.mesh.geometry.dispose();wm.mesh.material.dispose()});t.wallMeshes=[];setHL(MAX_LIVES);setHD(0);setHJ(0);setHWL(null);setHWT(null);setHF(null);
    // Store config in G so game loop can read it
    g.cfg={diff:cfgDiff,trivia:cfgTrivia,obs:{...cfgObs}};
    // Build guaranteed mini-game queue — each enabled obstacle appears at least once
    const mq=[];
    if(cfgObs.cables)mq.push('tech');if(cfgObs.virus)mq.push('virus');if(cfgObs.counter)mq.push('67');if(cfgObs.hold)mq.push('hold');if(cfgObs.jumba)mq.push('jumba');
    // Shuffle
    for(let i=mq.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[mq[i],mq[j]]=[mq[j],mq[i]]}
    g.miniQueue=mq;g.miniQueueIdx=0;g.wallsSinceMinigame=0;g.wallsSinceLastMini=0;
    // Build trivia pool — loads ALL categories from Firebase (Flutter app controls the pool)
    const pool=[];
    const isHard=cfgDiff==='hard';
    if(QUESTION_POOL.sp_focused_easy.length>0||QUESTION_POOL.sp_focused_hard.length>0){pool.push(...(isHard?QUESTION_POOL.sp_focused_hard:QUESTION_POOL.sp_focused_easy))}
    if(QUESTION_POOL.tech_focused_easy.length>0||QUESTION_POOL.tech_focused_hard.length>0){pool.push(...(isHard?QUESTION_POOL.tech_focused_hard:QUESTION_POOL.tech_focused_easy))}
    if(QUESTION_POOL.custom?.length>0){pool.push(...QUESTION_POOL.custom)}
    g.tPool=pool.map(q=>{const swap=Math.random()<0.5;return swap?{q:q.q,l:q.r,r:q.l,c:q.c==='left'?'right':'left'}:{q:q.q,l:q.l,r:q.r,c:q.c}});
    if(musicRef.current)musicRef.current.stop();musicRef.current=startMusic();setPh('play');g.mpRole=mpRole},[cfgDiff,cfgTrivia,cfgObs,mpRole]);
  useEffect(()=>()=>{if(musicRef.current)musicRef.current.stop()},[]);
  useEffect(()=>{if(ph==='go'){fetchLeaderboard();if(gameMode==='multi'){
    const g=G.current;const iWon=g.dist>=FINISH;const iDied=g.lives<=0;
    send({type:'done',dist:g.dist,role:mpRole,lives:g.lives});
    if(!mpWinner){if(iDied)setMpWinner(mpRole==='attacker'?'defender':'attacker');else if(iWon)setMpWinner(mpRole)}
  }}},[ph,fetchLeaderboard]); // eslint-disable-line

  // ═══════════════════════════════════════════════════════════════
  //  GAME LOOP
  // ═══════════════════════════════════════════════════════════════
  useEffect(()=>{
    if(ph!=='play')return;
    const g=G.current,p=P.current,t=T.current;
    if(!t.scene||!t.renderer)return;
    const ov=ovRef.current,ctx=ov.getContext('2d');
    const rsz=()=>{ov.width=window.innerWidth;ov.height=window.innerHeight};rsz();window.addEventListener('resize',rsz);

    const hudIv=setInterval(()=>{setHL(g.lives);setHD(Math.floor(g.dist));setHJ(g.jog);
      if(g.techActive){setHWT('tech');setHWL('⚡ EMERGENCY REPAIR — Reconnect circuits!')}
      else if(g.virusActive){setHWT('tech');setHWL('🛡 MALWARE DETECTED — Purge threats!')}
      else if(g.c67Active){setHWT('tech');setHWL(`⚙ OVERCLOCK SEQUENCE — ${g.c67Reps}/${g.c67Target||C67_REPS}`)}
      else if(g.holdActive){setHWT('tech');setHWL('📡 SYSTEM CALIBRATION — Hold the pose!')}
      else if(g.jumbaActive){setHWT('tech');setHWL(`🔨 WHACK JUMBA — ${g.jumbaWhacked}/${g.jumbaTarget} whacked!`)}
      else if(g.atkSnapActive){setHWT('tech');setHWL(`✂️ SNAP THE WIRE — ${g.atkSnapCut}/${g.atkSnapCables.length} cut`)}
      else if(g.atkVirusPassActive){setHWT('tech');setHWL(`☣ VIRUS PASS — ${g.atkVPTossed}/${g.atkVPTarget} tossed`)}
            else if(g.atkDuelActive){setHWT('tech');setHWL(`⚡ 67 DUEL — ${g.atkDuelReps}/${g.atkDuelTarget}`)}
      else{const aw=t.wallMeshes.find(wm=>!wm.data.done&&wm.data.z<WALL_CHECK);if(aw){setHWT(aw.data.tp==='t'?'tri':'pose');setHWL(aw.data.tp==='t'?aw.data.tri.q:aw.data.lbl)}else{setHWL(null);setHWT(null)}}
      if(g.flash&&g.ft>0)setHF(g.flash);else setHF(null);setHHide(g.secActive||g.techActive||g.virusActive||g.c67Active||g.holdActive||g.jumbaActive||g.atkSnapActive||g.atkVirusPassActive||g.atkDuelActive)},80);

    const pickPose=()=>{let pool=g.passed<3?POSES.slice(0,3):POSES;if(g.cfg?.diff==='easy')pool=pool.filter(p=>p.id!=='cr'&&p.id!=='llc'&&p.id!=='lrc');return pool[Math.floor(Math.random()*pool.length)]};

    // SPAWN — walls are the MAIN FOCUS. Mini-games only after 4+ walls.
    const spawn=()=>{
      const obs=g.cfg?.obs||{walls:true,trivia:true,cables:true,virus:true,counter:true,hold:true,jumba:true};
      const atkWall=g.mpRole==='attacker';
      const isAtk=g.mpRole==='attacker';
      const canAtkSnap=isAtk&&g.dist>60&&(g.dist-g.lastAtkSnapDist)>110;
      const canAtkVP=isAtk&&g.dist>60&&(g.dist-g.lastAtkVPDist)>110;
            const canAtkDuel=isAtk&&g.dist>60&&(g.dist-g.lastAtkDuelDist)>110;
      const isMp=gameMode==='multi';
      const canTech=!isAtk&&!isMp&&obs.cables&&g.dist>TECH_DIST&&(g.dist-g.lastTechDist)>160;
      const canVirus=!isAtk&&!isMp&&obs.virus&&g.dist>VIRUS_DIST&&(g.dist-g.lastVirusDist)>170;
      const can67=!isAtk&&!isMp&&obs.counter&&g.dist>C67_DIST&&(g.dist-g.lastC67Dist)>180;
      const canHold=!isAtk&&!isMp&&obs.hold&&g.dist>POSE_HOLD_DIST&&(g.dist-g.lastHoldDist)>160;
      const canJumba=!isAtk&&!isMp&&obs.jumba&&g.dist>JUMBA_DIST&&(g.dist-g.lastJumbaDist)>160;

      let pick=null;
      if(g.wallsSinceLastMini>=2){
        if(isAtk){
          // Equal frequency — round-robin through available attacker games
          const atkPool=[];if(canAtkSnap)atkPool.push('atkSnap');if(canAtkVP)atkPool.push('atkVP');if(canAtkDuel)atkPool.push('atkDuel');
          // Shuffle for fairness
          for(let i=atkPool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[atkPool[i],atkPool[j]]=[atkPool[j],atkPool[i]]}
          if(atkPool.length>0&&Math.random()<0.7)pick=atkPool[0];
        }else if(!isMp){
          if(g.miniQueue&&g.miniQueueIdx<g.miniQueue.length){
            const next=g.miniQueue[g.miniQueueIdx];
            const ready=(next==='tech'&&canTech)||(next==='virus'&&canVirus)||(next==='67'&&can67)||(next==='hold'&&canHold)||(next==='jumba'&&canJumba);
            if(ready){pick=next;g.miniQueueIdx++}
          }
          if(!pick){
            const pool=[];
            if(canTech)pool.push('tech');if(canVirus)pool.push('virus');if(can67)pool.push('67');if(canHold)pool.push('hold');if(canJumba)pool.push('jumba');
            if(pool.length>0&&Math.random()<0.5)pick=pool[Math.floor(Math.random()*pool.length)];
          }
        }
      }

      if(pick){
        g.wallsSinceLastMini=0;
        // Attacker — snap the wire
        if(pick==='atkSnap'){
          const count=3+Math.floor(Math.random()*2);
          g.atkSnapActive=true;g.atkSnapTimer=0;g.atkSnapCut=0;g.lastAtkSnapDist=g.dist;
          const raw=makeCables(ov.width,ov.height,count);
          g.atkSnapCables=raw.map(c=>({...c,cut:false,cutT:0,hp:12+Math.floor(Math.random()*6),maxHp:0}));
          g.atkSnapCables.forEach(c=>{c.maxHp=c.hp});
          return;
        }
        // Attacker — virus pass
        if(pick==='atkVP'){
          const count=4+Math.floor(Math.random()*3);// 4-6 viruses
          g.atkVirusPassActive=true;g.atkVPTimer=0;g.atkVPTossed=0;g.atkVPTarget=count;g.lastAtkVPDist=g.dist;
          g.atkVPViruses=[];
          for(let i=0;i<count;i++){g.atkVPViruses.push({x:ov.width*0.1+Math.random()*ov.width*0.5,y:ov.height*0.15+Math.random()*ov.height*0.65,r:45+Math.random()*20,color:['#ff2266','#ff4488','#cc11aa','#ff0055','#dd33ff'][Math.floor(Math.random()*5)],pulse:Math.random()*Math.PI*2,grabbed:false,grabHand:null,tossed:false,tossT:0,tossVx:0,tossVy:0})}
          return;
        }
        // Attacker — flappy jumba

        // Attacker — 67 duel (triggers on BOTH screens)
        if(pick==='atkDuel'){
          g.atkDuelActive=true;g.atkDuelTimer=0;g.atkDuelReps=0;g.atkDuelLUp=false;g.atkDuelRUp=false;g.atkDuelTarget=30;g.atkDuelLastPop=0;g.atkDuelOppReps=0;g.atkDuelDone=false;g.lastAtkDuelDist=g.dist;
          send({type:'duel67'});
          return;
        }
        // Defender activations (unchanged)
        if(pick==='tech'){g.techActive=true;g.cables=makeCables(ov.width,ov.height,g.cfg?.diff==='easy'?3:4);g.techTimer=0;g.techMaxTime=600;g.lastTechDist=g.dist;return}
        if(pick==='virus'){g.virusActive=true;g.viruses=[];g.virusSpawnCD=g.cfg?.diff==='easy'?60:30;g.virusKilled=0;g.virusTimer=0;g.virusGlitch=0;g.lastVirusDist=g.dist;g.virusEasy=g.cfg?.diff==='easy';return}
        if(pick==='67'){const cEasy=g.cfg?.diff==='easy';g.c67Active=true;g.c67Reps=0;g.c67LUp=false;g.c67RUp=false;g.c67Timer=0;g.c67MaxTime=cEasy?900:1200;g.c67LastPop=0;g.lastC67Dist=g.dist;g.c67Target=cEasy?15:C67_REPS;return}
        if(pick==='hold'){const hp=HOLD_POSES[Math.floor(Math.random()*HOLD_POSES.length)];g.holdActive=true;g.holdPose=hp;g.holdTimer=0;g.holdMaxTime=300;g.holdHeld=0;g.holdTarget=50;g.lastHoldDist=g.dist;return}
        if(pick==='jumba'){const jEasy=g.cfg?.diff==='easy';g.jumbaActive=true;g.jumbaTimer=0;g.jumbaMaxTime=jEasy?600:480;g.jumbaWhacked=0;g.jumbaTarget=3;g.jumbaSpawnCD=25;g.jumbaCurrentPipe=-1;g.jumbaPopTimer=0;g.jumbaPopDur=jEasy?30:8;g.jumbaState='hidden';g.jumbaHitAnim=0;g.lastJumbaDist=g.dist;g.jumbaEasy=jEasy;return}
      }

      // WALL — this is the default, main content
      g.wallsSinceLastMini++; // count walls
      const canWalls=obs.walls;
      const canTrivia=obs.trivia&&g.dist>TRIVIA_DIST&&g.tPool.length>0;
      let wd,mesh;
      if(canTrivia&&canWalls){
        if(Math.random()<0.45){const i=Math.floor(Math.random()*g.tPool.length);wd={tp:'t',z:WALL_SPAWN,tri:g.tPool.splice(i,1)[0],done:false};mesh=makeTriviaWall(atkWall)}
        else{const pw=pickPose();wd={tp:'p',z:WALL_SPAWN,id:pw.id,lbl:pw.lbl,ck:pw.ck,done:false};mesh=makePoseWall(pw.id,atkWall)}
      }else if(canTrivia){
        const i=Math.floor(Math.random()*g.tPool.length);wd={tp:'t',z:WALL_SPAWN,tri:g.tPool.splice(i,1)[0],done:false};mesh=makeTriviaWall(atkWall);
      }else if(canWalls){
        const pw=pickPose();wd={tp:'p',z:WALL_SPAWN,id:pw.id,lbl:pw.lbl,ck:pw.ck,done:false};mesh=makePoseWall(pw.id,atkWall);
      }else{
        const pw=pickPose();wd={tp:'p',z:WALL_SPAWN,id:pw.id,lbl:pw.lbl,ck:pw.ck,done:false};mesh=makePoseWall(pw.id,atkWall);
      }
      // Refill trivia pool when exhausted — loads all from Firebase
      if(g.tPool.length===0){
        const isHard=g.cfg?.diff==='hard';const pool2=[];
        pool2.push(...(isHard?QUESTION_POOL.sp_focused_hard:QUESTION_POOL.sp_focused_easy));
        pool2.push(...(isHard?QUESTION_POOL.tech_focused_hard:QUESTION_POOL.tech_focused_easy));
        if(QUESTION_POOL.custom?.length>0)pool2.push(...QUESTION_POOL.custom);
        g.tPool=pool2.map(q=>{const swap=Math.random()<0.5;return swap?{q:q.q,l:q.r,r:q.l,c:q.c==='left'?'right':'left'}:{q:q.q,l:q.l,r:q.r,c:q.c}});
      }
      mesh.position.z=wd.z;t.scene.add(mesh);t.wallMeshes.push({mesh,data:wd});
    };
    // ══════════════════════════════════════════════════════════
    // HOLOGRAM AVATAR — CUSTOMIZATION GUIDE
    // ══════════════════════════════════════════════════════════
    // AV.SC  = overall size (smaller number = smaller avatar)
    // AV.Z   = depth in tunnel (higher = further from camera)
    //
    // Y POSITION: change 0.32 in py=n=>-(n-0.32)*SC
    //   lower number = avatar higher on screen (e.g. 0.25 = very high)
    //   higher number = avatar lower (e.g. 0.45 = near bottom)
    //
    // SPREAD: controls how far limbs push outward from body center
    //   spread = sw * 0.03  (increase 0.03 for wider stance)
    //   Multipliers per joint: shoulders *0.5, elbows *1.0, wrists *1.2
    //
    // THICKNESS (R): base radius for all joints/beams
    //   R = sw * 0.15  (increase for fatter avatar, decrease for thinner)
    //
    // JOINT SIZES (jR array): multiplier on R for each joint sphere
    //   [head, neck, lSh, rSh, lEl, rEl, lWr, rWr, lHp, rHp, lKn, rKn, lAn, rAn]
    //   [3.0,  1.8,  2.4, 2.4, 1.6, 1.6, 1.4, 1.4, 2.0, 2.0, 1.6, 1.6, 1.2, 1.2]
    //
    // BEAM THICKNESS: the second number in beam() calls
    //   beam(idx, from, to, thickness)
    //   neck=1.7, spine=2.8, upperArm=1.8, forearm=1.4, thigh=2.0, shin=1.6
    //
    // COLORS: change the hex values in cHead, cNeck, cTorso etc.
    //   cHead   = head sphere color
    //   cHand   = hand color (make bright so you can track them)
    //   cTorso  = spine/chest beams
    //   cLeg    = thigh/shin beams
    //   cFoot   = ankle spheres
    //
    // ENERGY CORE: the glowing chest orb
    //   coreR = R*0.8  (size), opacity 0.35 base + 0.15 when running
    //   color: 0xaaffcc — change for different glow
    //
    // SHADOW: ground shadow size
    //   sw*0.55 width, sw*0.35 height, opacity 0.2
    // ══════════════════════════════════════════════════════════
    const AV={SC:2.5,Z:1};

    if(!g.avSm)g.avSm={};
    if(!t.av){
      // Color zones — darker shades for depth, lighter for highlights
      const cHead  =0x55dd99;// head — bright but not white
      const cNeck  =0x228855;// neck — darker, recedes
      const cTorso =0x1a7744;// torso — dark core
      const cShould=0x2a9960;// shoulder area — mid
      const cUArm  =0x33aa66;// upper arm
      const cFArm  =0x1a7744;// forearm — darker
      const cHand  =0x88ffaa;// hands — pop
      const cLeg   =0x116633;// legs — darkest
      const cKnee  =0x1a7744;// knees — slightly lighter
      const cFoot  =0x0a4422;// feet — very dark
      const mk=(c2,op)=>op?new THREE.MeshBasicMaterial({color:c2,transparent:true,opacity:op}):new THREE.MeshBasicMaterial({color:c2});
      // 14 joints — with slight transparency for depth
      const jC=[cHead,cNeck, cShould,cShould, cUArm,cUArm, cHand,cHand, cLeg,cLeg, cKnee,cKnee, cFoot,cFoot];
      const jOp=[0.92,0.85, 0.88,0.88, 0.85,0.85, 0.95,0.95, 0.82,0.82, 0.82,0.82, 0.8,0.8];
      const jts=[];for(let i=0;i<14;i++){
        jts.push(new THREE.Mesh(new THREE.SphereGeometry(1,20,14),mk(jC[i],jOp[i])));
        jts[i].visible=false;t.scene.add(jts[i])}
      // 12 beams
      const bC=[cNeck,cTorso, cUArm,cFArm,cUArm,cFArm, cLeg,cLeg,cLeg,cLeg, cShould,cLeg];
      const bOp=[0.85,0.88, 0.85,0.82,0.85,0.82, 0.8,0.78,0.8,0.78, 0.88,0.8];
      const beams=[];for(let i=0;i<12;i++){
        const g2=new THREE.CylinderGeometry(1,1,1,12,1);g2.translate(0,0.5,0);
        beams.push(new THREE.Mesh(g2,mk(bC[i],bOp[i])));beams[i].visible=false;t.scene.add(beams[i])}
      // Energy core at chest
      const core=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),
        new THREE.MeshBasicMaterial({color:0xaaffcc,transparent:true,opacity:0.5}));
      core.visible=false;t.scene.add(core);
      // Shadow — larger, darker
      const shadow=new THREE.Mesh(new THREE.CircleGeometry(1,16),
        new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0}));
      shadow.rotation.x=-Math.PI/2;shadow.visible=false;t.scene.add(shadow);
      // Outline shadow — slightly offset darker duplicate of torso for depth
      const torsoShadow=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,12,1),
        new THREE.MeshBasicMaterial({color:0x062211,transparent:true,opacity:0.5}));
      torsoShadow.geometry.translate(0,0.5,0);torsoShadow.visible=false;t.scene.add(torsoShadow);
      // Trails
      const trails=[];for(let i=0;i<20;i++){
        const tp=new THREE.Mesh(new THREE.SphereGeometry(0.015,6,4),
          new THREE.MeshBasicMaterial({color:cHand,transparent:true,opacity:0.12}));
        tp.visible=false;t.scene.add(tp);trails.push({mesh:tp,life:0})}
      t.av={jts,beams,core,shadow,torsoShadow,trails,f:0};
    }
    const drawAv=(kps)=>{
      const av=t.av;if(!av)return;
      const hide=()=>{av.jts.forEach(j=>j.visible=false);av.beams.forEach(b=>b.visible=false);
        av.core.visible=false;av.shadow.visible=false;av.torsoShadow.visible=false;
        av.trails.forEach(t2=>t2.mesh.visible=false)};
      if(!kps){hide();return}
      const vid=vidRef.current;if(!vid)return;
      const vw=vid.videoWidth||640,vh=vid.videoHeight||480;
      const gk=i=>{const k=kps[i];return k?.score>0.25?{x:1-k.x/vw,y:k.y/vh}:null};
      const raw={nose:gk(0),lSh:gk(5),rSh:gk(6),lEl:gk(7),rEl:gk(8),lWr:gk(9),rWr:gk(10),
        lHp:gk(11),rHp:gk(12),lKn:gk(13),rKn:gk(14),lAn:gk(15),rAn:gk(16)};
      if(!raw.lSh||!raw.rSh){hide();return}
      const sm=g.avSm;const LP=0.22;
      const sl=(k,pt)=>{if(!pt)return sm[k]||null;if(!sm[k]){sm[k]={x:pt.x,y:pt.y};return sm[k]}sm[k].x+=(pt.x-sm[k].x)*LP;sm[k].y+=(pt.y-sm[k].y)*LP;return sm[k]};
      const N=sl('n',raw.nose),LS=sl('ls',raw.lSh),RS=sl('rs',raw.rSh),
        LE=sl('le',raw.lEl),RE=sl('re',raw.rEl),LW=sl('lw',raw.lWr),RW=sl('rw',raw.rWr),
        LH=sl('lh',raw.lHp),RH=sl('rh',raw.rHp),LK=sl('lk',raw.lKn),RK=sl('rk',raw.rKn),
        LA=sl('la',raw.lAn),RA=sl('ra',raw.rAn);
      const W2=ov.width,H2=ov.height;
      // Hand tracking set AFTER spread — see below
      av.f++;
      const SC=AV.SC,Z=AV.Z;
      const px=n=>(n-0.5)*SC,py=n=>-(n-0.42)*SC;
      const glitchAmt=g.debuffGlitch>0?(g.debuffGlitch/300):0;
      const gOff=glitchAmt>0?(Math.random()-0.5)*glitchAmt*0.15:0;
      const pts={};
      const nk={x:(LS.x+RS.x)/2,y:(LS.y+RS.y)/2};
      const sw=Math.abs(px(LS.x)-px(RS.x));
      const spread=sw*0.5;
      const mp=(key,kp,fb)=>{if(kp)pts[key]={x:px(kp.x)+gOff,y:py(kp.y),z:Z};else if(fb)pts[key]=fb;else pts[key]=null};
      mp('head',N,{x:px(nk.x),y:py(nk.y)+sw*0.2,z:Z});
      mp('neck',nk);
      if(LS)pts.lSh={x:px(LS.x)-spread*0.5,y:py(LS.y),z:Z};else pts.lSh=null;
      if(RS)pts.rSh={x:px(RS.x)+spread*0.5,y:py(RS.y),z:Z};else pts.rSh=null;
      if(LE)pts.lEl={x:px(LE.x)-spread,y:py(LE.y),z:Z};else pts.lEl=null;
      if(RE)pts.rEl={x:px(RE.x)+spread,y:py(RE.y),z:Z};else pts.rEl=null;
      if(LW)pts.lWr={x:px(LW.x)-spread*1.2,y:py(LW.y),z:Z};else pts.lWr=null;
      if(RW)pts.rWr={x:px(RW.x)+spread*1.2,y:py(RW.y),z:Z};else pts.rWr=null;
      // Hand tracking — raw wrist keypoints, no spread, lowered Y
      // hSpread: 0 = exactly at wrist keypoint X. Increase to push outward.
      // Y offset: higher number = markers lower on screen (0.32=high, 0.42=low)
      const hSpread=0;
      const hYoff=0.38;
      if(LW){const hx2=px(LW.x)-hSpread;g.hLX=(hx2/SC+0.5)*W2;g.hLY=(-py(LW.y)/SC+hYoff)*H2;g.hLV=true}else g.hLV=false;
      if(RW){const hx2=px(RW.x)+hSpread;g.hRX=(hx2/SC+0.5)*W2;g.hRY=(-py(RW.y)/SC+hYoff)*H2;g.hRV=true}else g.hRV=false;
      const hipFb=LH&&RH?null:{x:px(nk.x),y:py(nk.y)-sw*0.7,z:Z};
      if(LH)pts.lHp={x:px(LH.x)-spread*0.3,y:py(LH.y),z:Z};
      else pts.lHp=hipFb?{x:hipFb.x-sw*0.06,y:hipFb.y,z:Z}:null;
      if(RH)pts.rHp={x:px(RH.x)+spread*0.3,y:py(RH.y),z:Z};
      else pts.rHp=hipFb?{x:hipFb.x+sw*0.06,y:hipFb.y,z:Z}:null;
      if(LK)pts.lKn={x:px(LK.x)-spread*0.4,y:py(LK.y),z:Z};else pts.lKn=null;
      if(RK)pts.rKn={x:px(RK.x)+spread*0.4,y:py(RK.y),z:Z};else pts.rKn=null;
      if(LA)pts.lAn={x:px(LA.x)-spread*0.3,y:py(LA.y),z:Z};else pts.lAn=null;
      if(RA)pts.rAn={x:px(RA.x)+spread*0.3,y:py(RA.y),z:Z};else pts.rAn=null;
      const R=Math.max(0.022,sw*0.18);
      // ── TORSO SHADOW — dark outline behind spine, offset slightly ──
      if(pts.lHp&&pts.rHp&&pts.neck){
        const hm={x:(pts.lHp.x+pts.rHp.x)/2,y:(pts.lHp.y+pts.rHp.y)/2,z:Z};
        const a=pts.neck,dx=hm.x-a.x,dy=hm.y-a.y,ln=Math.sqrt(dx*dx+dy*dy);
        av.torsoShadow.visible=true;
        av.torsoShadow.position.set(a.x+R*0.3,a.y-R*0.2,Z-0.04);
        av.torsoShadow.scale.set(R*3.0,Math.max(ln,0.01),R*3.0);
        av.torsoShadow.rotation.set(0,0,-Math.atan2(dx,dy));
      }else av.torsoShadow.visible=false;
      // ── JOINTS ──
      const jK=['head','neck','lSh','rSh','lEl','rEl','lWr','rWr','lHp','rHp','lKn','rKn','lAn','rAn'];
      const jR=[3.0,1.8, 2.4,2.4, 1.6,1.6, 1.4,1.4, 2.0,2.0, 1.6,1.6, 1.2,1.2];
      jK.forEach((key,i)=>{const pt=pts[key],j=av.jts[i];
        if(!pt){j.visible=false;return}j.visible=true;
        const r=R*jR[i];j.position.set(pt.x,pt.y,pt.z);j.scale.set(r,r,r)});
      // ── BEAMS ──
      const beam=(idx,k1,k2,thick)=>{
        const b=av.beams[idx],a=pts[k1],b2=pts[k2];
        if(!a||!b2){b.visible=false;return}
        const dx=b2.x-a.x,dy=b2.y-a.y,ln=Math.sqrt(dx*dx+dy*dy);
        if(ln<0.002){b.visible=false;return}
        b.visible=true;b.position.set(a.x,a.y,a.z);
        const r=R*thick;b.scale.set(r,ln,r);
        b.rotation.set(0,0,-Math.atan2(dx,dy))};
      beam(0,'head','neck',1.7);
      if(pts.lHp&&pts.rHp&&pts.neck){
        const hm={x:(pts.lHp.x+pts.rHp.x)/2,y:(pts.lHp.y+pts.rHp.y)/2,z:Z};
        const b=av.beams[1],a=pts.neck,dx=hm.x-a.x,dy=hm.y-a.y,ln=Math.sqrt(dx*dx+dy*dy);
        b.visible=true;b.position.set(a.x,a.y,a.z);b.scale.set(R*3.8,Math.max(ln,0.01),R*2.8);
        b.rotation.set(0,0,-Math.atan2(dx,dy));
      }else av.beams[1].visible=false;
      beam(2,'lSh','lEl',1.8);beam(3,'lEl','lWr',1.4);
      beam(4,'rSh','rEl',1.8);beam(5,'rEl','rWr',1.4);
      beam(6,'lHp','lKn',2.0);beam(7,'lKn','lAn',1.6);
      beam(8,'rHp','rKn',2.0);beam(9,'rKn','rAn',1.6);
      beam(10,'lSh','rSh',1.8);
      if(pts.lHp&&pts.rHp)beam(11,'lHp','rHp',1.8);else av.beams[11].visible=false;
      // ── ENERGY CORE — chest, pulses with running ──
      if(pts.neck&&pts.lHp&&pts.rHp){
        const hm={x:(pts.lHp.x+pts.rHp.x)/2,y:(pts.lHp.y+pts.rHp.y)/2};
        const cx2=(pts.neck.x+hm.x)/2,cy2=(pts.neck.y+hm.y)/2;
        av.core.visible=true;
        const coreR=R*0.8+Math.sin(av.f*0.08)*R*0.12+(g.jog>0.5?R*0.25:0);
        av.core.position.set(cx2,cy2,Z+0.03);av.core.scale.set(coreR,coreR,coreR);
        av.core.material.opacity=0.35+Math.sin(av.f*0.1)*0.1+(g.jog>0.5?0.15:0);
      }else av.core.visible=false;
      // ── TRAILS ──
      [pts.lWr,pts.rWr].forEach((tp,ti)=>{if(!tp)return;
        const pk='_tw'+ti;const spd=sm[pk]?Math.abs(tp.x-sm[pk])+Math.abs(tp.y-(sm['_twy'+ti]||tp.y)):0;
        sm[pk]=tp.x;sm['_twy'+ti]=tp.y;
        if(spd>0.007){const slot=av.trails.find(t2=>t2.life<=0);
          if(slot){slot.life=18;slot.mesh.visible=true;
            slot.mesh.position.set(tp.x+(Math.random()-0.5)*0.02,tp.y+(Math.random()-0.5)*0.02,Z);
            slot.mesh.scale.set(R*0.8,R*0.8,R*0.8)}}});
      av.trails.forEach(t2=>{if(t2.life>0){t2.life--;t2.mesh.material.opacity=t2.life/18*0.15;
        t2.mesh.scale.multiplyScalar(0.93);if(t2.life<=0)t2.mesh.visible=false}});
      // ── GROUND SHADOW — bigger, tracks body ──
      const lowY=Math.min(...jK.map(k=>pts[k]?pts[k].y:99).filter(v=>v<99));
      if(lowY<99){av.shadow.visible=true;av.shadow.position.set(pts.neck?pts.neck.x:0,lowY-R*0.5,Z);
        av.shadow.scale.set(sw*0.55,sw*0.35,1)}else av.shadow.visible=false;
    };

    // ── TECH STOP (Emergency Repair) ──
    const GRAB_R=110,SNAP_R=90;
    const techStop=(w,h)=>{g.techTimer++;const cbs=g.cables;const hands=[];if(g.hLV)hands.push({x:g.hLX,y:g.hLY,id:'L'});if(g.hRV)hands.push({x:g.hRX,y:g.hRY,id:'R'});cbs.forEach(c=>{if(c.connected)return;if(!c.grabbed){for(const hand of hands){if(Math.sqrt((hand.x-c.tipX)**2+(hand.y-c.tipY)**2)<GRAB_R){c.grabbed=true;c.grabHand=hand.id;break}}}if(c.grabbed){const hand=hands.find(h2=>h2.id===c.grabHand);if(hand){c.tipX+=(hand.x-c.tipX)*0.5;c.tipY+=(hand.y-c.tipY)*0.5;if(Math.sqrt((c.tipX-c.tgtX)**2+(c.tipY-c.tgtY)**2)<SNAP_R){c.connected=true;c.grabbed=false;c.tipX=c.tgtX;c.tipY=c.tgtY;sfx.current.snap?.()}}else{c.grabbed=false;c.grabHand=null}}if(!c.grabbed&&!c.connected){c.tipX+=(c.srcX+80-c.tipX)*0.06;c.tipY+=(c.srcY-c.tipY)*0.06}});
      if(cbs.every(c=>c.connected)){g.techActive=false;g.passed++;g.flash='ok';g.ft=25;sfx.current.ok?.();return}if(g.techTimer>g.techMaxTime){g.techActive=false;g.lives--;g.hit++;g.flash='no';g.ft=25;sfx.current.no?.();try{navigator.vibrate&&navigator.vibrate([200,50,200])}catch{};if(g.lives<=0){g.on=false;if(musicRef.current)musicRef.current.stop();setPh('go')}return}
      ctx.fillStyle='rgba(15,10,35,0.85)';ctx.fillRect(0,0,w,h);ctx.font="bold 28px 'Share Tech Mono'";ctx.fillStyle='#ff8844';ctx.textAlign='center';ctx.fillText('⚡ EMERGENCY REPAIR',w/2,38);const pct=1-g.techTimer/g.techMaxTime,bW2=w*0.4,bH2=10,bX=(w-bW2)/2,bY=52;ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(bX,bY,bW2,bH2);ctx.fillStyle=pct>0.3?'#ff6633':'#ff2244';ctx.fillRect(bX,bY,bW2*pct,bH2);
      cbs.forEach(c=>{ctx.beginPath();ctx.arc(c.tgtX,c.tgtY,24,0,Math.PI*2);ctx.strokeStyle=c.connected?'#00ff88':c.color;ctx.lineWidth=5;ctx.stroke();ctx.fillStyle=c.connected?c.color:'#1a1a1a';ctx.beginPath();ctx.arc(c.tgtX,c.tgtY,15,0,Math.PI*2);ctx.fill();ctx.font="bold 14px 'Share Tech Mono'";ctx.fillStyle=c.color;ctx.textAlign='left';ctx.fillText(c.name,c.tgtX+30,c.tgtY+5)});
      cbs.forEach(c=>{ctx.fillStyle=c.color;ctx.fillRect(c.srcX-22,c.srcY-18,44,36);const tx=c.connected?c.tgtX:c.tipX,ty=c.connected?c.tgtY:c.tipY,mx2=(c.srcX+tx)/2;ctx.strokeStyle='rgba(0,0,0,0.2)';ctx.lineWidth=24;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(c.srcX+22,c.srcY+3);ctx.bezierCurveTo(mx2,c.srcY+35,mx2,ty+35,tx,ty+3);ctx.stroke();ctx.strokeStyle=c.color;ctx.lineWidth=20;ctx.beginPath();ctx.moveTo(c.srcX+22,c.srcY);ctx.bezierCurveTo(mx2,c.srcY+30,mx2,ty+30,tx,ty);ctx.stroke();ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(c.srcX+22,c.srcY);ctx.bezierCurveTo(mx2,c.srcY+30,mx2,ty+30,tx,ty);ctx.stroke();if(!c.connected){ctx.fillStyle='#d4a574';ctx.beginPath();ctx.arc(tx,ty,12,0,Math.PI*2);ctx.fill();if(c.grabbed){ctx.strokeStyle='rgba(0,255,136,0.5)';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(tx,ty,22,0,Math.PI*2);ctx.stroke();ctx.setLineDash([])}}});
      hands.forEach((h2,i)=>{ctx.beginPath();ctx.arc(h2.x,h2.y,38,0,Math.PI*2);ctx.fillStyle='rgba(0,255,136,0.12)';ctx.fill();ctx.beginPath();ctx.arc(h2.x,h2.y,24,0,Math.PI*2);ctx.fillStyle=i===0?'#00cc88':'#00aaff';ctx.fill();ctx.beginPath();ctx.arc(h2.x,h2.y,8,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill()});
      const done=cbs.filter(c=>c.connected).length;ctx.font="bold 18px 'Share Tech Mono'";ctx.fillStyle='rgba(0,255,136,0.5)';ctx.textAlign='center';ctx.fillText(`CIRCUITS: ${done}/${cbs.length}`,w/2,h-18)};

    // ── VIRUS PURGE (Malware Scan) ──
    const HIT_R=90;
    const virusPurge=(w,h)=>{g.virusTimer++;g.virusSpawnCD--;const vEasy=g.virusEasy;if(g.virusSpawnCD<=0){g.virusSpawnCD=Math.max(vEasy?40:20,(vEasy?16:VIRUS_SPAWN_INT)-g.virusTimer*(vEasy?0.01:0.03));g.viruses.push({x:w*0.12+Math.random()*w*0.76,y:h*0.12+Math.random()*h*0.76,r:50+Math.random()*30,color:['#ff2266','#ff4488','#cc11aa','#ff0055','#dd33ff'][Math.floor(Math.random()*5)],pulse:Math.random()*Math.PI*2,born:g.f,dying:false,deathFrame:0,vx:(Math.random()-0.5)*(vEasy?0.6:1.2),vy:(Math.random()-0.5)*(vEasy?0.6:1.2)})}
      g.viruses.forEach(v=>{if(v.dying)return;v.x+=v.vx;v.y+=v.vy;if(v.x<v.r||v.x>w-v.r)v.vx*=-1;if(v.y<v.r||v.y>h-v.r)v.vy*=-1;v.x=Math.max(v.r,Math.min(w-v.r,v.x));v.y=Math.max(v.r,Math.min(h-v.r,v.y))});
      const hands=[];if(g.hLV)hands.push({x:g.hLX,y:g.hLY});if(g.hRV)hands.push({x:g.hRX,y:g.hRY});g.viruses.forEach(v=>{if(v.dying)return;for(const hand of hands){if(Math.sqrt((hand.x-v.x)**2+(hand.y-v.y)**2)<v.r+HIT_R){v.dying=true;v.deathFrame=g.f;g.virusKilled++;sfx.current.pop?.();break}}});
      g.viruses=g.viruses.filter(v=>!v.dying||(g.f-v.deathFrame)<15);const active=g.viruses.filter(v=>!v.dying).length;
      if(active>=VIRUS_MAX){g.virusActive=false;g.lives--;g.hit++;g.flash='no';g.ft=25;sfx.current.no?.();try{navigator.vibrate&&navigator.vibrate([200,50,200])}catch{};if(g.lives<=0){g.on=false;if(musicRef.current)musicRef.current.stop();setPh('go')}return}
      if(g.virusTimer>180&&active===0&&g.virusKilled>=5){g.virusActive=false;g.passed++;g.flash='ok';g.ft=25;sfx.current.ok?.();return}if(g.virusTimer>720)g.virusSpawnCD=9999;
      ctx.fillStyle='rgba(12,8,25,0.8)';ctx.fillRect(0,0,w,h);ctx.fillStyle='rgba(255,255,255,0.015)';for(let sy=0;sy<h;sy+=3)ctx.fillRect(0,sy,w,1);
      g.virusGlitch=Math.max(0,g.virusGlitch-0.02);if(Math.random()<0.03+active*0.008)g.virusGlitch=0.3+Math.random()*0.5;if(g.virusGlitch>0.1)for(let i=0;i<3;i++){ctx.fillStyle=`rgba(0,255,200,${g.virusGlitch*0.12})`;ctx.fillRect((Math.random()-0.5)*g.virusGlitch*40,Math.random()*h,w,2+Math.random()*6)}
      ctx.font="bold 26px 'Share Tech Mono'";ctx.textAlign='center';ctx.fillStyle=`rgba(255,60,110,${0.8+Math.sin(g.f*0.08)*0.2})`;ctx.fillText('🛡 MALWARE DETECTED',w/2,36);
      const threat=active/VIRUS_MAX;const bW3=w*0.4,bH3=10,bX2=(w-bW3)/2,bY2=50;ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(bX2,bY2,bW3,bH3);ctx.fillStyle=threat<0.5?'#00ff88':threat<0.75?'#ffaa00':'#ff2244';ctx.fillRect(bX2,bY2,bW3*threat,bH3);ctx.font="12px 'Share Tech Mono'";ctx.fillStyle='rgba(255,255,255,0.3)';ctx.fillText(`THREAT: ${active}/${VIRUS_MAX}`,w/2,bY2+bH3+14);
      g.viruses.forEach(v=>{const age=g.f-v.born,pulse=Math.sin(g.f*0.08+v.pulse)*0.15+0.85;if(v.dying){const dt=g.f-v.deathFrame,expand=1+dt*0.3,alpha=Math.max(0,1-dt/15);ctx.globalAlpha=alpha;ctx.beginPath();ctx.arc(v.x,v.y,v.r*expand*1.5,0,Math.PI*2);ctx.strokeStyle='#00ffaa';ctx.lineWidth=2;ctx.stroke();for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2+dt*0.2,d=v.r*expand*0.8;ctx.fillStyle=v.color;ctx.beginPath();ctx.arc(v.x+Math.cos(a)*d,v.y+Math.sin(a)*d,3,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;return}
        const spawnScale=Math.min(1,age/15),sr=v.r*pulse*spawnScale;ctx.beginPath();ctx.arc(v.x,v.y,sr+14,0,Math.PI*2);ctx.fillStyle=`rgba(255,0,100,${0.1*pulse})`;ctx.fill();const spikes=10+Math.floor(v.r/8);ctx.beginPath();for(let i=0;i<=spikes;i++){const ang=(i/spikes)*Math.PI*2+g.f*0.01,outerR=sr+12+Math.sin(ang*3+g.f*0.05)*4,innerR=sr-4;if(i===0)ctx.moveTo(v.x+Math.cos(ang-Math.PI/spikes*0.4)*innerR,v.y+Math.sin(ang-Math.PI/spikes*0.4)*innerR);ctx.lineTo(v.x+Math.cos(ang)*outerR,v.y+Math.sin(ang)*outerR);ctx.lineTo(v.x+Math.cos(ang+Math.PI/spikes*0.4)*innerR,v.y+Math.sin(ang+Math.PI/spikes*0.4)*innerR)}ctx.closePath();const grad=ctx.createRadialGradient(v.x-sr*0.15,v.y-sr*0.15,sr*0.05,v.x,v.y,sr+12);grad.addColorStop(0,'rgba(255,180,220,0.7)');grad.addColorStop(0.4,v.color);grad.addColorStop(1,'rgba(80,0,40,0.9)');ctx.fillStyle=grad;ctx.fill();ctx.strokeStyle=`rgba(255,80,180,${0.5*pulse})`;ctx.lineWidth=2;ctx.stroke();ctx.font=`bold ${Math.floor(sr*0.35)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillText('☣',v.x,v.y+1)});
      hands.forEach((h2,i)=>{ctx.beginPath();ctx.arc(h2.x,h2.y,40,0,Math.PI*2);ctx.fillStyle='rgba(0,255,180,0.12)';ctx.fill();ctx.beginPath();ctx.arc(h2.x,h2.y,26,0,Math.PI*2);ctx.fillStyle=i===0?'#00ddaa':'#00aaff';ctx.fill();ctx.beginPath();ctx.arc(h2.x,h2.y,9,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill()});ctx.font="14px 'Share Tech Mono'";ctx.fillStyle='rgba(0,255,180,0.4)';ctx.textAlign='center';ctx.fillText(`PURGED: ${g.virusKilled}`,w/2,h-16)};

    // ── 67 COUNTER (Overclock Sequence) ──
    const counter67=(w,h)=>{g.c67Timer++;const p2=P.current;if(p2.ok){const midY=(p2.sy+p2.hy)/2;if(p2.lwy<midY&&!g.c67LUp){g.c67LUp=true;g.c67Reps++;g.c67LastPop=g.f;sfx.current.snap?.()}if(p2.lwy>=midY)g.c67LUp=false;if(p2.rwy<midY&&!g.c67RUp){g.c67RUp=true;g.c67Reps++;g.c67LastPop=g.f;sfx.current.snap?.()}if(p2.rwy>=midY)g.c67RUp=false}
      if(g.c67Reps>=(g.c67Target||C67_REPS)){g.c67Active=false;g.passed++;g.flash='ok';g.ft=25;sfx.current.ok?.();return}if(g.c67Timer>g.c67MaxTime){g.c67Active=false;g.lives--;g.hit++;g.flash='no';g.ft=25;sfx.current.no?.();try{navigator.vibrate&&navigator.vibrate([200,50,200])}catch{};if(g.lives<=0){g.on=false;if(musicRef.current)musicRef.current.stop();setPh('go')}return}
      ctx.fillStyle='rgba(8,12,30,0.82)';ctx.fillRect(0,0,w,h);ctx.strokeStyle='rgba(0,200,255,0.05)';ctx.lineWidth=1;for(let gx=0;gx<w;gx+=60){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,h);ctx.stroke()}for(let gy=0;gy<h;gy+=60){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(w,gy);ctx.stroke()}
      ctx.font="bold 120px 'Bebas Neue'";ctx.textAlign='center';ctx.fillStyle='rgba(0,220,255,0.08)';ctx.fillText('67',w/2,h*0.28);
      ctx.font="bold 48px 'Bebas Neue'";ctx.fillStyle='rgba(0,220,255,0.95)';ctx.fillText('DO THE 67!',w/2,h*0.16);const pct=1-g.c67Timer/g.c67MaxTime,bW4=w*0.5,bH4=12,bX3=(w-bW4)/2,bY3=h*0.19;ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(bX3,bY3,bW4,bH4);ctx.fillStyle=pct>0.3?'#00ccff':'#ef4444';ctx.fillRect(bX3,bY3,bW4*pct,bH4);
      const repProg=g.c67Reps/(g.c67Target||C67_REPS),popScale=(g.f-g.c67LastPop<8)?1.15:1;ctx.save();ctx.translate(w/2,h/2-20);ctx.scale(popScale,popScale);ctx.font="bold 200px 'Bebas Neue'";ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(0,200,255,0.08)';ctx.fillText(g.c67Reps.toString(),3,3);ctx.fillStyle=repProg>0.8?'#00ff88':'#00ddff';ctx.fillText(g.c67Reps.toString(),0,0);ctx.restore();
      ctx.font="bold 44px 'Bebas Neue'";ctx.textAlign='center';ctx.fillStyle='rgba(255,255,255,0.2)';ctx.fillText(`/ ${g.c67Target||C67_REPS}`,w/2,h/2+80);ctx.fillStyle=g.c67LUp?'#00ff88':'rgba(255,255,255,0.12)';ctx.beginPath();ctx.arc(w*0.2,h/2-20,35,0,Math.PI*2);ctx.fill();ctx.fillStyle=g.c67RUp?'#00ff88':'rgba(255,255,255,0.12)';ctx.beginPath();ctx.arc(w*0.8,h/2-20,35,0,Math.PI*2);ctx.fill();ctx.font="bold 16px 'Barlow'";ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText('L',w*0.2,h/2-16);ctx.fillText('R',w*0.8,h/2-16);
      const pbW=w*0.6,pbH=16,pbX=(w-pbW)/2,pbY=h-70;ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(pbX,pbY,pbW,pbH);ctx.fillStyle=repProg>0.8?'#00ff88':'#00ccff';ctx.fillRect(pbX,pbY,pbW*repProg,pbH);
      ctx.font="bold 28px 'Bebas Neue'";ctx.fillStyle='rgba(255,255,255,0.6)';ctx.fillText('DO THE 67!',w/2,h-100);
      ctx.font="bold 18px 'Share Tech Mono'";ctx.fillStyle='rgba(255,255,255,0.3)';ctx.fillText('Pump both arms up and down rapidly!',w/2,h-38)};

    // ── HOLD THE POSE (System Calibration) ──
    const holdPose=(w,h)=>{
      g.holdTimer++;const hp=g.holdPose;if(!hp)return;
      const matching=hp.ck(P.current);
      if(matching){g.holdHeld++}else{g.holdHeld=Math.max(0,g.holdHeld-2)}
      if(g.holdHeld>=g.holdTarget){g.holdActive=false;g.passed++;g.flash='ok';g.ft=25;sfx.current.ok?.();return}
      if(g.holdTimer>g.holdMaxTime){g.holdActive=false;g.lives--;g.hit++;g.flash='no';g.ft=25;sfx.current.no?.();try{navigator.vibrate&&navigator.vibrate([200,50,200])}catch{};if(g.lives<=0){g.on=false;if(musicRef.current)musicRef.current.stop();setPh('go')}return}

      // ── DRAW — clean centered overlay ──
      ctx.fillStyle='rgba(8,12,20,0.82)';ctx.fillRect(0,0,w,h);
      if(matching){const pulseR=(g.f%40)*8;ctx.strokeStyle=`rgba(0,220,255,${0.1-pulseR/320*0.1})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(w/2,h/2,pulseR,0,Math.PI*2);ctx.stroke()}

      // ── TOP — pose name centered ──
      ctx.font="bold 56px 'Bebas Neue'";ctx.textAlign='center';
      ctx.fillStyle='#fff';ctx.fillText(hp.lbl,w/2,h*0.17);
      ctx.font="18px 'Share Tech Mono'";ctx.fillStyle='rgba(255,255,255,0.45)';
      ctx.fillText(hp.desc,w/2,h*0.17+32);
      const pct=1-g.holdTimer/g.holdMaxTime;const bW5=w*0.4,bH5=8,bX4=(w-bW5)/2,bY4=h*0.17+50;
      ctx.fillStyle='rgba(255,255,255,0.06)';ctx.fillRect(bX4,bY4,bW5,bH5);
      ctx.fillStyle=pct>0.3?(matching?'#00ddff':'#6644cc'):'#ff2244';ctx.fillRect(bX4,bY4,bW5*pct,bH5);

      // ── LEFT — simple stickman ──
      const stickX=w*0.32,stickY=h*0.58,stickSz=Math.min(w*0.1,h*0.18);
      const col=matching?'#00ddff':'#4488ff',colDark=matching?'#0099bb':'#2266cc';
      const rW2=stickSz*3.2,rH2=stickSz*3.6,rX=stickX-rW2/2,rY=stickY-rH2/2;
      ctx.fillStyle='rgba(10,14,24,0.92)';
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(rX,rY,rW2,rH2,10);ctx.fill();ctx.strokeStyle=matching?'rgba(0,220,255,0.15)':'rgba(80,80,160,0.1)';ctx.lineWidth=1.5;ctx.stroke()}
      else ctx.fillRect(rX,rY,rW2,rH2);
      ctx.lineCap='round';ctx.lineJoin='round';
      ctx.strokeStyle=colDark;ctx.lineWidth=stickSz*0.14;if(hp.draw)hp.draw(ctx,stickX,stickY,stickSz);
      ctx.strokeStyle=col;ctx.lineWidth=stickSz*0.09;if(hp.draw)hp.draw(ctx,stickX,stickY,stickSz);
      const hdY=stickY-stickSz*0.8,hdR=stickSz*0.2;
      ctx.fillStyle=col;ctx.beginPath();ctx.arc(stickX,hdY,hdR,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=colDark;ctx.lineWidth=2;ctx.beginPath();ctx.arc(stickX,hdY,hdR,0,Math.PI*2);ctx.stroke();
      ctx.font="bold 14px 'Share Tech Mono'";ctx.textAlign='center';ctx.fillStyle='rgba(255,255,255,0.25)';
      ctx.fillText('TARGET POSE',stickX,rY+rH2+18);

      // ── RIGHT — progress ring centered at w*0.68 ──
      const prog=g.holdHeld/g.holdTarget;const ringR=Math.min(75,w*0.065);const ringX=w*0.68,ringY=h*0.58;
      ctx.beginPath();ctx.arc(ringX,ringY,ringR,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,0.05)';ctx.lineWidth=12;ctx.stroke();
      ctx.beginPath();ctx.arc(ringX,ringY,ringR,-Math.PI/2,-Math.PI/2+prog*Math.PI*2);
      const rc2=matching?'#00ddff':'#6644cc';ctx.strokeStyle=rc2;ctx.lineWidth=12;ctx.lineCap='round';ctx.stroke();
      if(prog>0.7){ctx.fillStyle=`rgba(0,220,255,${(prog-0.7)*0.1})`;ctx.beginPath();ctx.arc(ringX,ringY,ringR-6,0,Math.PI*2);ctx.fill()}
      ctx.font="bold 34px 'Bebas Neue'";ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillStyle=matching?'#00ddff':'rgba(255,255,255,0.2)';ctx.fillText(matching?'LOCKED':'ALIGN',ringX,ringY-6);
      ctx.font="bold 18px 'Bebas Neue'";ctx.fillStyle=matching?'rgba(0,220,255,0.5)':'rgba(255,255,255,0.15)';
      ctx.fillText(`${Math.round(prog*100)}%`,ringX,ringY+20);ctx.textBaseline='alphabetic';
    };

    // ── WHACK JUMBA (Intruder Alert) — ARCADE STYLE ──
    const JUMBA_HIT_R=350;
    const whackJumba=(w,h)=>{
      g.jumbaTimer++;
      const pipeCount=4;
      const pipeW=w*0.10;
      const pipeH=h*0.25;
      const pipeGap=(w-pipeW*pipeCount)/(pipeCount+1);
      const pipeY=h-pipeH;
      const pipeBottomY=h;
      const pipes=[];
      for(let i=0;i<pipeCount;i++){const px=pipeGap+(pipeW+pipeGap)*i+pipeW/2;pipes.push({x:px,topY:pipeY,w:pipeW})}

      if(g.jumbaState==='hidden'){g.jumbaSpawnCD--;if(g.jumbaSpawnCD<=0){let np;do{np=Math.floor(Math.random()*pipeCount)}while(np===g.jumbaCurrentPipe&&pipeCount>1);g.jumbaCurrentPipe=np;g.jumbaState='rising';g.jumbaPopTimer=0;g.jumbaPopDur=g.jumbaEasy?Math.max(22,30-g.jumbaWhacked*3):Math.max(4,8-g.jumbaWhacked*2)}}
      if(g.jumbaState==='rising'){g.jumbaPopTimer++;if(g.jumbaPopTimer>=6)g.jumbaState='up'}
      if(g.jumbaState==='up'){g.jumbaPopTimer++;if(g.jumbaPopTimer>=g.jumbaPopDur+6){g.jumbaState='hiding';g.jumbaPopTimer=0}}
      if(g.jumbaState==='hiding'){g.jumbaPopTimer++;if(g.jumbaPopTimer>=6){g.jumbaState='hidden';g.jumbaSpawnCD=8+Math.floor(Math.random()*12)}}
      if(g.jumbaState==='whacked'){g.jumbaHitAnim++;if(g.jumbaHitAnim>=18){g.jumbaState='hidden';g.jumbaSpawnCD=6+Math.floor(Math.random()*10)}}

      if(g.jumbaState==='up'&&g.jumbaCurrentPipe>=0){const ap=pipes[g.jumbaCurrentPipe];const hands=[];if(g.hLV)hands.push({x:g.hLX,y:g.hLY});if(g.hRV)hands.push({x:g.hRX,y:g.hRY});for(const hand of hands){const hitY=ap.topY-pipeH*0.25;if(Math.sqrt((hand.x-ap.x)**2+(hand.y-hitY)**2)<JUMBA_HIT_R){g.jumbaState='whacked';g.jumbaHitAnim=0;g.jumbaWhacked++;sfx.current.pop?.();break}}}

      if(g.jumbaWhacked>=g.jumbaTarget){g.jumbaActive=false;g.passed++;g.flash='ok';g.ft=25;sfx.current.ok?.();if(jumbaElRef.current)jumbaElRef.current.style.display='none';return}
      if(g.jumbaTimer>g.jumbaMaxTime){g.jumbaActive=false;g.lives--;g.hit++;g.flash='no';g.ft=25;sfx.current.no?.();try{navigator.vibrate&&navigator.vibrate([200,50,200])}catch{};if(jumbaElRef.current)jumbaElRef.current.style.display='none';if(g.lives<=0){g.on=false;if(musicRef.current)musicRef.current.stop();setPh('go')}return}

      // ── DRAW — VIBRANT ARCADE ──
      const bgG=ctx.createLinearGradient(0,0,0,h);bgG.addColorStop(0,'rgba(10,5,20,0.5)');bgG.addColorStop(0.5,'rgba(8,4,16,0.45)');bgG.addColorStop(1,'rgba(5,2,12,0.4)');ctx.fillStyle=bgG;ctx.fillRect(0,0,w,h);
      // Animated neon grid
      ctx.strokeStyle='rgba(255,100,50,0.06)';ctx.lineWidth=1;for(let gx=0;gx<w;gx+=50){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,h);ctx.stroke()}for(let gy=0;gy<h;gy+=50){const wave=Math.sin(gy*0.02+g.f*0.02)*2;ctx.beginPath();ctx.moveTo(wave,gy);ctx.lineTo(w+wave,gy);ctx.stroke()}
      // Warning flash
      if(Math.floor(g.f/15)%2===0){ctx.fillStyle='rgba(255,50,0,0.04)';ctx.fillRect(0,0,w,70)}
      // Title
      ctx.font="bold 44px 'Bebas Neue'";ctx.textAlign='center';ctx.fillStyle=`rgba(255,80,30,${0.85+Math.sin(g.f*0.1)*0.15})`;ctx.fillText('\u{1f528} WHACK JUMBA!',w/2,44);
      ctx.font="bold 16px 'Share Tech Mono'";ctx.fillStyle='rgba(255,150,80,0.5)';ctx.fillText('INTRUDER ALERT',w/2,64);
      // Timer bar with glow
      const pct=1-g.jumbaTimer/g.jumbaMaxTime;const bW6=w*0.5,bH6=14,bX5=(w-bW6)/2,bY5=76;ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(bX5,bY5,bW6,bH6);const tc=pct>0.3?'#ff6622':'#ff2244';ctx.fillStyle=tc;ctx.fillRect(bX5,bY5,bW6*pct,bH6);ctx.shadowColor=tc;ctx.shadowBlur=14;ctx.fillRect(bX5,bY5,bW6*pct,bH6);ctx.shadowBlur=0;
      // Score — huge
      ctx.font="bold 90px 'Bebas Neue'";ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText(`${g.jumbaWhacked}`,w/2-35,h*0.27);ctx.font="bold 44px 'Bebas Neue'";ctx.fillStyle='rgba(255,255,255,0.2)';ctx.fillText(`/ ${g.jumbaTarget}`,w/2+45,h*0.27);
      // "WHACKED!" flash
      if(g.jumbaState==='whacked'&&g.jumbaHitAnim<12){ctx.save();ctx.font="bold 64px 'Bebas Neue'";ctx.textAlign='center';ctx.fillStyle=`rgba(255,220,50,${1-g.jumbaHitAnim/12})`;ctx.fillText('WHACKED!',w/2,h*0.40);ctx.restore()}
      // Ground
      const groundY=pipeY+pipeH*0.15;const groundGrad=ctx.createLinearGradient(0,groundY,0,h);groundGrad.addColorStop(0,'#2a1a3e');groundGrad.addColorStop(1,'#1a0e2a');ctx.fillStyle=groundGrad;ctx.fillRect(0,groundY,w,h-groundY);ctx.strokeStyle='rgba(255,100,50,0.15)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,groundY);ctx.lineTo(w,groundY);ctx.stroke();
      // Pipes
      pipes.forEach((pipe,i)=>{const px=pipe.x,pw=pipe.w,pipeLeft=px-pw/2,pipeRight=px+pw/2;const isAct=g.jumbaCurrentPipe===i&&(g.jumbaState==='up'||g.jumbaState==='rising');
        if(isAct){ctx.fillStyle='rgba(255,100,0,0.06)';ctx.beginPath();ctx.arc(px,pipeY,pw*0.8,0,Math.PI*2);ctx.fill()}
        ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(pipeLeft+5,pipeY+10,pw,pipeBottomY-pipeY);
        const pg=ctx.createLinearGradient(pipeLeft,0,pipeRight,0);pg.addColorStop(0,'#1a4a3a');pg.addColorStop(0.15,'#2a7a5a');pg.addColorStop(0.5,'#3aaa7a');pg.addColorStop(0.85,'#2a7a5a');pg.addColorStop(1,'#1a4a3a');ctx.fillStyle=pg;ctx.fillRect(pipeLeft,pipeY,pw,pipeBottomY-pipeY);
        ctx.strokeStyle=isAct?'rgba(255,200,50,0.5)':'rgba(0,255,136,0.15)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pipeLeft,pipeY);ctx.lineTo(pipeLeft,pipeBottomY);ctx.stroke();ctx.beginPath();ctx.moveTo(pipeRight,pipeY);ctx.lineTo(pipeRight,pipeBottomY);ctx.stroke();
        const rimH=20,rimPad=pw*0.15;const rg=ctx.createLinearGradient(pipeLeft-rimPad,0,pipeRight+rimPad,0);rg.addColorStop(0,'#1a5a4a');rg.addColorStop(0.2,'#44cc88');rg.addColorStop(0.5,'#66eebb');rg.addColorStop(0.8,'#44cc88');rg.addColorStop(1,'#1a5a4a');ctx.fillStyle=rg;ctx.fillRect(pipeLeft-rimPad,pipeY-rimH/2,pw+rimPad*2,rimH);
        ctx.strokeStyle=isAct?'rgba(255,200,50,0.6)':'rgba(0,255,136,0.2)';ctx.lineWidth=2;ctx.strokeRect(pipeLeft-rimPad,pipeY-rimH/2,pw+rimPad*2,rimH);
        ctx.fillStyle='#050a08';ctx.beginPath();ctx.ellipse(px,pipeY,pw*0.4,pw*0.18,0,0,Math.PI*2);ctx.fill();
        ctx.font="bold 24px 'Bebas Neue'";ctx.textAlign='center';ctx.fillStyle=isAct?'rgba(255,150,50,0.5)':'rgba(0,255,136,0.25)';ctx.fillText(`${i+1}`,px,pipeBottomY-16);
        // Jumba
        if(g.jumbaCurrentPipe===i){let jumbaY=pipeY,jumbaAlpha=1,jumbaScale=1;
          if(g.jumbaState==='rising'){const tt=g.jumbaPopTimer/6;jumbaY=pipeY+pipeH*0.4*(1-tt)}else if(g.jumbaState==='up'){jumbaY=pipeY-pipeH*0.32}else if(g.jumbaState==='hiding'){const tt=g.jumbaPopTimer/6;jumbaY=pipeY-pipeH*0.32+pipeH*0.5*tt}else if(g.jumbaState==='whacked'){jumbaY=pipeY-pipeH*0.32;jumbaAlpha=Math.max(0,1-g.jumbaHitAnim/18);jumbaScale=1+g.jumbaHitAnim*0.04;for(let s=0;s<8;s++){const sa=s*Math.PI/4+g.jumbaHitAnim*0.2,sd=35+g.jumbaHitAnim*5,pSz=6-g.jumbaHitAnim*0.25;if(pSz>0){ctx.fillStyle=`rgba(255,${180+Math.floor(Math.random()*75)},50,${jumbaAlpha})`;ctx.beginPath();ctx.arc(px+Math.cos(sa)*sd,jumbaY+Math.sin(sa)*sd,pSz,0,Math.PI*2);ctx.fill()}}ctx.font='22px sans-serif';ctx.textAlign='center';for(let s=0;s<4;s++){const sa=s*Math.PI/2+g.jumbaHitAnim*0.3,sd=20+g.jumbaHitAnim*6;ctx.fillStyle=`rgba(255,255,100,${jumbaAlpha*0.9})`;ctx.fillText('\u2726',px+Math.cos(sa)*sd,jumbaY+Math.sin(sa)*sd)}}else{jumbaAlpha=0}
          if(jumbaAlpha>0.01){ctx.save();ctx.globalAlpha=jumbaAlpha;const jW=pw*5.0*jumbaScale,jH=pipeH*2.4*jumbaScale,jX=px-jW/2,jY2=jumbaY-jH*0.5;const el=jumbaElRef.current;if(el){el.style.display='block';el.style.left=`${jX}px`;el.style.top=`${jY2}px`;el.style.width=`${jW}px`;el.style.height=`${jH}px`;el.style.opacity=jumbaAlpha;el.style.transform=`scale(${jumbaScale})`}
            if(g.jumbaState==='up'){const flash=Math.sin(g.f*0.2)*0.5+0.5;ctx.font="bold 40px 'Bebas Neue'";ctx.textAlign='center';ctx.fillStyle=`rgba(255,50,30,${0.7+flash*0.3})`;ctx.fillText('!',px,jumbaY-jH*0.65);ctx.strokeStyle=`rgba(255,50,30,${0.2+flash*0.2})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(px,jumbaY-jH*0.2,jW*0.55+flash*5,0,Math.PI*2);ctx.stroke()}
            ctx.restore()}else{const el=jumbaElRef.current;if(el)el.style.display='none'}}});
      // Redraw rims ON TOP
      pipes.forEach((pipe)=>{const px=pipe.x,pw=pipe.w,pipeLeft=px-pw/2;const rimH=20,rimPad=pw*0.15;const rg=ctx.createLinearGradient(pipeLeft-rimPad,0,pipeLeft+pw+rimPad,0);rg.addColorStop(0,'#1a5a4a');rg.addColorStop(0.2,'#44cc88');rg.addColorStop(0.5,'#66eebb');rg.addColorStop(0.8,'#44cc88');rg.addColorStop(1,'#1a5a4a');ctx.fillStyle=rg;ctx.fillRect(pipeLeft-rimPad,pipeY-rimH/2,pw+rimPad*2,rimH);ctx.fillStyle='#050a08';ctx.beginPath();ctx.ellipse(px,pipeY,pw*0.4,pw*0.18,0,0,Math.PI*2);ctx.fill();const pg2=ctx.createLinearGradient(pipeLeft,0,pipeLeft+pw,0);pg2.addColorStop(0,'#1a4a3a');pg2.addColorStop(0.5,'#3aaa7a');pg2.addColorStop(1,'#1a4a3a');ctx.fillStyle=pg2;ctx.fillRect(pipeLeft,pipeY+rimH/2,pw,pipeBottomY-pipeY-rimH/2)});
      // Hand cursors
      const hands=[];if(g.hLV)hands.push({x:g.hLX,y:g.hLY});if(g.hRV)hands.push({x:g.hRX,y:g.hRY});
      hands.forEach((hand,i)=>{ctx.beginPath();ctx.arc(hand.x,hand.y,50,0,Math.PI*2);ctx.fillStyle='rgba(255,200,50,0.15)';ctx.fill();ctx.beginPath();ctx.arc(hand.x,hand.y,34,0,Math.PI*2);ctx.fillStyle=i===0?'#ff8833':'#ffaa44';ctx.fill();ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.arc(hand.x,hand.y,12,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill()});
      ctx.font="bold 18px 'Share Tech Mono'";ctx.fillStyle='rgba(255,180,80,0.4)';ctx.textAlign='center';ctx.fillText('Smack him when he pops up!',w/2,h*0.46);
    };

    // ═══ ATTACKER MINI-GAME: SNAP THE WIRE ═══
    const ATK_SNAP_R=110;
    const atkSnapWire=(w,h)=>{
      g.atkSnapTimer++;
      const cbs=g.atkSnapCables;
      const hands=[];if(g.hLV)hands.push({x:g.hLX,y:g.hLY});if(g.hRV)hands.push({x:g.hRX,y:g.hRY});
      // Hit detection — hand in cut zone reduces HP
      cbs.forEach(c=>{if(c.cut)return;let hitting=false;
        for(const hand of hands){const mx=(c.srcX+22+c.tgtX)/2,my=(c.srcY+c.tgtY)/2;
          if(Math.sqrt((hand.x-mx)**2+(hand.y-my)**2)<ATK_SNAP_R){hitting=true;break}}
        if(hitting){c.hp--;sfx.current.pop?.();if(c.hp<=0){c.cut=true;c.cutT=g.f;g.atkSnapCut++;sfx.current.snap?.()}}
      });
      // All cut — success
      if(cbs.every(c=>c.cut)){g.atkSnapActive=false;g.passed++;g.flash='ok';g.ft=25;sfx.current.ok?.();
        send({type:'attack',atk:'snapwire',count:cbs.length});return}
      if(g.atkSnapTimer>600){g.atkSnapActive=false;g.hit++;g.flash='no';g.ft=25;sfx.current.no?.();return}
      // ── DRAW — matches defender cable style ──
      ctx.fillStyle='rgba(20,5,8,0.85)';ctx.fillRect(0,0,w,h);
      ctx.font="bold 28px 'Share Tech Mono'";ctx.fillStyle='#ff6644';ctx.textAlign='center';
      ctx.fillText('\u2702\uFE0F SNAP THE WIRE!',w/2,38);
      const pct=1-g.atkSnapTimer/600,bW2=w*0.4,bX=(w-bW2)/2;
      ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(bX,52,bW2,10);
      ctx.fillStyle=pct>0.3?'#ff5533':'#ff2222';ctx.fillRect(bX,52,bW2*pct,10);
      ctx.font="bold 18px 'Share Tech Mono'";ctx.fillStyle='rgba(255,100,80,0.5)';
      ctx.fillText('CUT: '+g.atkSnapCut+'/'+cbs.length,w/2,h-18);
      // Draw target rings (right side) — same as defender
      cbs.forEach(c=>{ctx.beginPath();ctx.arc(c.tgtX,c.tgtY,24,0,Math.PI*2);
        ctx.strokeStyle=c.cut?'#ff4444':c.color;ctx.lineWidth=5;ctx.stroke();
        ctx.fillStyle=c.cut?'#331111':'#1a1a1a';ctx.beginPath();ctx.arc(c.tgtX,c.tgtY,15,0,Math.PI*2);ctx.fill();
        ctx.font="bold 14px 'Share Tech Mono'";ctx.fillStyle=c.color;ctx.textAlign='left';ctx.fillText(c.name,c.tgtX+30,c.tgtY+5)});
      // Draw cables — same bezier style as defender
      cbs.forEach(c=>{const tx=c.tgtX,ty=c.tgtY,mx2=(c.srcX+tx)/2;
        if(c.cut){
          // Snapped — draw two broken halves with sparks
          const age=g.f-c.cutT,spark=Math.sin(age*0.5)*4;
          ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=22;ctx.lineCap='round';
          ctx.beginPath();ctx.moveTo(c.srcX+22,c.srcY+3);ctx.bezierCurveTo(mx2-40,c.srcY+25,mx2-30,ty+20,mx2-20+spark,ty+spark*2+3);ctx.stroke();
          ctx.strokeStyle=c.color;ctx.lineWidth=18;
          ctx.beginPath();ctx.moveTo(c.srcX+22,c.srcY);ctx.bezierCurveTo(mx2-40,c.srcY+20,mx2-30,ty+15,mx2-20+spark,ty+spark*2);ctx.stroke();
          ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=22;
          ctx.beginPath();ctx.moveTo(mx2+20-spark,ty-spark*2+3);ctx.bezierCurveTo(mx2+30,ty+20,mx2+40,ty+25,tx,ty+3);ctx.stroke();
          ctx.strokeStyle=c.color;ctx.lineWidth=18;
          ctx.beginPath();ctx.moveTo(mx2+20-spark,ty-spark*2);ctx.bezierCurveTo(mx2+30,ty+15,mx2+40,ty+20,tx,ty);ctx.stroke();
          // Sparks
          if(age<40){for(let s=0;s<4;s++){const sa=Math.random()*Math.PI*2,sd=12+Math.random()*25;
            ctx.fillStyle='rgba(255,'+(200+Math.floor(Math.random()*55))+',50,'+(1-age/40)+')';
            ctx.beginPath();ctx.arc(mx2+Math.cos(sa)*sd,(c.srcY+ty)/2+Math.sin(sa)*sd,2+Math.random()*2,0,Math.PI*2);ctx.fill()}}
        }else{
          // Connected — full bezier like defender
          ctx.fillStyle=c.color;ctx.fillRect(c.srcX-22,c.srcY-18,44,36);
          ctx.strokeStyle='rgba(0,0,0,0.2)';ctx.lineWidth=24;ctx.lineCap='round';
          ctx.beginPath();ctx.moveTo(c.srcX+22,c.srcY+3);ctx.bezierCurveTo(mx2,c.srcY+35,mx2,ty+35,tx,ty+3);ctx.stroke();
          ctx.strokeStyle=c.color;ctx.lineWidth=20;
          ctx.beginPath();ctx.moveTo(c.srcX+22,c.srcY);ctx.bezierCurveTo(mx2,c.srcY+30,mx2,ty+30,tx,ty);ctx.stroke();
          ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=6;
          ctx.beginPath();ctx.moveTo(c.srcX+22,c.srcY);ctx.bezierCurveTo(mx2,c.srcY+30,mx2,ty+30,tx,ty);ctx.stroke();
          // CUT ZONE — big glowing circle at midpoint
          const czX=mx2,czY=(c.srcY+ty)/2;
          const pulse=Math.sin(g.f*0.06)*0.3+0.7;
          // Outer glow
          ctx.fillStyle='rgba(255,60,30,'+0.06*pulse+')';ctx.beginPath();ctx.arc(czX,czY,ATK_SNAP_R,0,Math.PI*2);ctx.fill();
          // Dashed ring — big and obvious
          ctx.strokeStyle='rgba(255,100,50,'+0.5*pulse+')';ctx.lineWidth=3;ctx.setLineDash([8,6]);
          ctx.beginPath();ctx.arc(czX,czY,ATK_SNAP_R*0.8,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
          // Inner ring
          ctx.strokeStyle='rgba(255,150,80,'+0.3*pulse+')';ctx.lineWidth=2;
          ctx.beginPath();ctx.arc(czX,czY,ATK_SNAP_R*0.5,0,Math.PI*2);ctx.stroke();
          // Crosshair
          ctx.strokeStyle='rgba(255,80,50,'+0.25*pulse+')';ctx.lineWidth=1;
          ctx.beginPath();ctx.moveTo(czX-ATK_SNAP_R*0.6,czY);ctx.lineTo(czX+ATK_SNAP_R*0.6,czY);ctx.stroke();
          ctx.beginPath();ctx.moveTo(czX,czY-ATK_SNAP_R*0.6);ctx.lineTo(czX,czY+ATK_SNAP_R*0.6);ctx.stroke();
          // HP BAR above cut zone
          const hpPct=c.hp/c.maxHp;const hpW=80,hpH=10,hpX=czX-hpW/2,hpY=czY-ATK_SNAP_R*0.8-18;
          ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(hpX-1,hpY-1,hpW+2,hpH+2);
          ctx.fillStyle=hpPct>0.5?c.color:hpPct>0.25?'#ff8833':'#ff3322';
          ctx.fillRect(hpX,hpY,hpW*hpPct,hpH);
          ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1;ctx.strokeRect(hpX,hpY,hpW,hpH);
          // "SLICE!" label
          ctx.font="bold 13px 'Share Tech Mono'";ctx.textAlign='center';
          ctx.fillStyle='rgba(255,120,80,'+0.4*pulse+')';ctx.fillText('SLICE HERE',czX,hpY-6);
        }
      });
      // Hand cursors — red themed
      hands.forEach((h2,i)=>{ctx.beginPath();ctx.arc(h2.x,h2.y,42,0,Math.PI*2);
        ctx.fillStyle='rgba(255,80,50,0.12)';ctx.fill();
        ctx.beginPath();ctx.arc(h2.x,h2.y,28,0,Math.PI*2);
        ctx.fillStyle=i===0?'#ff6633':'#ff8844';ctx.fill();ctx.beginPath();ctx.arc(h2.x,h2.y,10,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill()});
    };

    // ═══ ATTACKER: VIRUS PASS — grab and toss viruses to defender ═══
    const VP_GRAB_R=100,VP_TOSS_X_THRESH=0.82;
    const atkVirusPass=(w,h)=>{
      g.atkVPTimer++;
      const vv=g.atkVPViruses;
      const hands=[];if(g.hLV)hands.push({x:g.hLX,y:g.hLY,id:'L',px:g.hLX,py:g.hLY});if(g.hRV)hands.push({x:g.hRX,y:g.hRY,id:'R',px:g.hRX,py:g.hRY});
      // Grab + drag logic
      vv.forEach(v=>{if(v.tossed)return;
        if(!v.grabbed){for(const hand of hands){if(Math.sqrt((hand.x-v.x)**2+(hand.y-v.y)**2)<v.r+VP_GRAB_R){v.grabbed=true;v.grabHand=hand.id;break}}}
        if(v.grabbed){const hand=hands.find(h2=>h2.id===v.grabHand);
          if(hand){v.x+=(hand.x-v.x)*0.45;v.y+=(hand.y-v.y)*0.45;
            // Tossed to right edge?
            if(v.x/w>VP_TOSS_X_THRESH){v.tossed=true;v.tossT=g.f;v.grabbed=false;g.atkVPTossed++;sfx.current.pop?.()}}
          else{v.grabbed=false;v.grabHand=null}}
      });
      // All tossed — done, NOW send attack to trigger virus purge on defender
      if(vv.every(v=>v.tossed)){g.atkVirusPassActive=false;g.passed++;g.flash='ok';g.ft=25;sfx.current.ok?.();
        send({type:'attack',atk:'viruspass',count:g.atkVPTarget});return}
      if(g.atkVPTimer>720){g.atkVirusPassActive=false;g.hit++;g.flash='no';g.ft=25;sfx.current.no?.();return}
      // ── DRAW — matches defender virus purge style ──
      ctx.fillStyle='rgba(12,8,25,0.82)';ctx.fillRect(0,0,w,h);
      // Scanlines
      ctx.fillStyle='rgba(255,255,255,0.015)';for(let sy=0;sy<h;sy+=3)ctx.fillRect(0,sy,w,1);
      // Title
      ctx.font="bold 28px 'Share Tech Mono'";ctx.textAlign='center';
      ctx.fillStyle=`rgba(255,60,110,${0.8+Math.sin(g.atkVPTimer*0.08)*0.2})`;
      ctx.fillText('☣ VIRUS PASS — Toss to infect!',w/2,36);
      // Timer
      const pct=1-g.atkVPTimer/720;const bW=w*0.4,bX=(w-bW)/2;
      ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(bX,50,bW,10);
      ctx.fillStyle=pct>0.3?'#ff4488':'#ff2244';ctx.fillRect(bX,50,bW*pct,10);
      // Progress
      ctx.font="bold 16px 'Share Tech Mono'";ctx.fillStyle='rgba(255,100,180,0.4)';
      ctx.fillText(`TOSSED: ${g.atkVPTossed}/${g.atkVPTarget}`,w/2,h-18);
      // Right edge — "DEFENDER ZONE" drop target
      const dzX=w*VP_TOSS_X_THRESH;
      ctx.fillStyle=`rgba(255,0,80,${0.04+Math.sin(g.atkVPTimer*0.05)*0.02})`;ctx.fillRect(dzX,0,w-dzX,h);
      ctx.strokeStyle='rgba(255,50,100,0.3)';ctx.lineWidth=2;ctx.setLineDash([10,8]);
      ctx.beginPath();ctx.moveTo(dzX,0);ctx.lineTo(dzX,h);ctx.stroke();ctx.setLineDash([]);
      ctx.save();ctx.translate(dzX+20,h/2);ctx.rotate(-Math.PI/2);
      ctx.font="bold 18px 'Bebas Neue'";ctx.fillStyle='rgba(255,80,120,0.35)';ctx.textAlign='center';
      ctx.fillText('→ DEFENDER ZONE →',0,0);ctx.restore();
      // Draw viruses — same spiky style as defender virus purge
      vv.forEach(v=>{
        if(v.tossed){const age=g.atkVPTimer*60-v.tossT?g.f-v.tossT:0;if(age>20)return;
          const a=1-age/20;ctx.globalAlpha=a;
          ctx.beginPath();ctx.arc(v.x,v.y,v.r*1.3,0,Math.PI*2);ctx.strokeStyle='#ff00aa';ctx.lineWidth=2;ctx.stroke();
          ctx.globalAlpha=1;return}
        const pulse=Math.sin(g.atkVPTimer*0.08+v.pulse)*0.15+0.85;const sr=v.r*pulse;
        // Glow
        ctx.beginPath();ctx.arc(v.x,v.y,sr+14,0,Math.PI*2);ctx.fillStyle=`rgba(255,0,100,${0.1*pulse})`;ctx.fill();
        // Spiky body — same as defender
        const spikes=10+Math.floor(v.r/8);ctx.beginPath();
        for(let i=0;i<=spikes;i++){const ang=(i/spikes)*Math.PI*2+g.atkVPTimer*0.01;const outerR=sr+12+Math.sin(ang*3+g.atkVPTimer*0.05)*4;const innerR=sr-4;
          if(i===0)ctx.moveTo(v.x+Math.cos(ang-Math.PI/spikes*0.4)*innerR,v.y+Math.sin(ang-Math.PI/spikes*0.4)*innerR);
          ctx.lineTo(v.x+Math.cos(ang)*outerR,v.y+Math.sin(ang)*outerR);
          ctx.lineTo(v.x+Math.cos(ang+Math.PI/spikes*0.4)*innerR,v.y+Math.sin(ang+Math.PI/spikes*0.4)*innerR)}
        ctx.closePath();
        const grad=ctx.createRadialGradient(v.x-sr*0.15,v.y-sr*0.15,sr*0.05,v.x,v.y,sr+12);
        grad.addColorStop(0,'rgba(255,180,220,0.7)');grad.addColorStop(0.4,v.color);grad.addColorStop(1,'rgba(80,0,40,0.9)');
        ctx.fillStyle=grad;ctx.fill();ctx.strokeStyle=`rgba(255,80,180,${0.5*pulse})`;ctx.lineWidth=2;ctx.stroke();
        // Biohazard icon
        ctx.font=`bold ${Math.floor(sr*0.35)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillText('☣',v.x,v.y+1);ctx.textBaseline='alphabetic';
        // Grab indicator
        if(v.grabbed){ctx.strokeStyle='rgba(255,200,50,0.5)';ctx.lineWidth=2;ctx.setLineDash([5,5]);
          ctx.beginPath();ctx.arc(v.x,v.y,sr+20,0,Math.PI*2);ctx.stroke();ctx.setLineDash([])}
      });
      // Hand cursors
      hands.forEach((h2,i)=>{ctx.beginPath();ctx.arc(h2.x,h2.y,40,0,Math.PI*2);ctx.fillStyle='rgba(255,100,180,0.12)';ctx.fill();
        ctx.beginPath();ctx.arc(h2.x,h2.y,26,0,Math.PI*2);ctx.fillStyle=i===0?'#ff4488':'#ff66aa';ctx.fill();ctx.beginPath();ctx.arc(h2.x,h2.y,9,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill()});
    };

    // ═══ ATTACKER: FLAPPY JUMBA — head-controlled, fly through pipes ═══
    const FLAPPY_PIPE_W=80,FLAPPY_GAP=200,FLAPPY_SPD=7,FLAPPY_BIRD_SZ=180;
    const jumbaImg=new Image();jumbaImg.src='/sp-lion.png';
    const atkFlappyJumba=(w,h)=>{
      g.atkFlappyTimer++;
      if(g.atkFlappyDead){
        if(g.atkFlappyTimer>60){g.atkFlappyActive=false;g.hit++;g.flash='no';g.ft=25;sfx.current.no?.()}
        // Draw death frame
        ctx.fillStyle='rgba(15,5,5,0.85)';ctx.fillRect(0,0,w,h);
        ctx.font="bold 60px 'Bebas Neue'";ctx.textAlign='center';ctx.fillStyle='#ff3344';ctx.fillText('CRASHED!',w/2,h/2);
        return;
      }
      // Head tracking — map head Y (0=top, 1=bottom) to bird Y
      const targetY=p.ok?p.sy:0.5;
      g.atkFlappyY+=(targetY-g.atkFlappyY)*0.18;
      g.atkFlappyY=Math.max(0.05,Math.min(0.95,g.atkFlappyY));
      const birdY=g.atkFlappyY*h;
      const birdX=w*0.2;
      // Spawn pipes
      // Pre-spawn 3 pipes on first frame only
      if(g.atkFlappyPipes.length===0){
        for(let i=0;i<3;i++){const gapY=h*0.25+Math.random()*h*0.5;g.atkFlappyPipes.push({x:w*0.45+i*w*0.35,gapY,passed:false})}
      }
      // Move pipes
      g.atkFlappyPipes.forEach(pp=>{pp.x-=FLAPPY_SPD});
      g.atkFlappyPipes=g.atkFlappyPipes.filter(pp=>pp.x>-FLAPPY_PIPE_W-10);
      // Collision + pass detection
      g.atkFlappyPipes.forEach(pp=>{
        if(pp.passed)return;
        const inX=birdX+FLAPPY_BIRD_SZ/2>pp.x&&birdX-FLAPPY_BIRD_SZ/2<pp.x+FLAPPY_PIPE_W;
        if(inX){
          const inGap=birdY>pp.gapY-FLAPPY_GAP/2&&birdY<pp.gapY+FLAPPY_GAP/2;
          if(!inGap){g.atkFlappyDead=true;g.atkFlappyTimer=0;sfx.current.no?.();return}
        }
        if(birdX-FLAPPY_BIRD_SZ/2>pp.x+FLAPPY_PIPE_W&&!pp.passed){
          pp.passed=true;g.atkFlappyPassed++;sfx.current.snap?.();
        }
      });
      // Floor/ceiling collision
      if(birdY<FLAPPY_BIRD_SZ/2||birdY>h-FLAPPY_BIRD_SZ/2){g.atkFlappyDead=true;g.atkFlappyTimer=0}
      // Win condition — 3 pipes
      if(g.atkFlappyPassed>=3){g.atkFlappyActive=false;g.passed++;g.flash='ok';g.ft=25;sfx.current.ok?.();
        send({type:'attack',atk:'jumbahit'});return}
      // ── DRAW ──
      ctx.fillStyle='rgba(10,5,18,0.9)';ctx.fillRect(0,0,w,h);
      // Scrolling grid background
      ctx.strokeStyle='rgba(255,50,50,0.04)';ctx.lineWidth=1;
      for(let gx=-g.atkFlappyTimer*2%40;gx<w;gx+=40){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,h);ctx.stroke()}
      for(let gy=0;gy<h;gy+=40){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(w,gy);ctx.stroke()}
      // Title
      ctx.font="bold 36px 'Bebas Neue'";ctx.textAlign='center';
      ctx.fillStyle='rgba(255,80,40,0.8)';ctx.fillText('🐦 FLAPPY JUMBA — Fly through 3 pipes!',w/2,34);
      // Progress
      ctx.font="bold 20px 'Bebas Neue'";ctx.fillStyle='rgba(255,150,80,0.6)';
      ctx.fillText(g.atkFlappyPassed+'/3',w/2,58);
      // Pipes — neon red themed wires/circuits
      g.atkFlappyPipes.forEach(pp=>{
        const topH=pp.gapY-FLAPPY_GAP/2;const botY=pp.gapY+FLAPPY_GAP/2;
        // Top pipe
        const tpGrad=ctx.createLinearGradient(pp.x,0,pp.x+FLAPPY_PIPE_W,0);
        tpGrad.addColorStop(0,'#661818');tpGrad.addColorStop(0.3,'#883030');tpGrad.addColorStop(0.7,'#883030');tpGrad.addColorStop(1,'#661818');
        ctx.fillStyle=tpGrad;ctx.fillRect(pp.x,0,FLAPPY_PIPE_W,topH);
        ctx.strokeStyle='#ff4433';ctx.lineWidth=2;ctx.strokeRect(pp.x,0,FLAPPY_PIPE_W,topH);
        // Pipe rim top
        ctx.fillStyle='#aa3322';ctx.fillRect(pp.x-8,topH-12,FLAPPY_PIPE_W+16,12);
        ctx.strokeStyle='#ff5544';ctx.lineWidth=1;ctx.strokeRect(pp.x-8,topH-12,FLAPPY_PIPE_W+16,12);
        // Bottom pipe
        ctx.fillStyle=tpGrad;ctx.fillRect(pp.x,botY,FLAPPY_PIPE_W,h-botY);
        ctx.strokeStyle='#ff4433';ctx.lineWidth=2;ctx.strokeRect(pp.x,botY,FLAPPY_PIPE_W,h-botY);
        // Pipe rim bottom
        ctx.fillStyle='#aa3322';ctx.fillRect(pp.x-8,botY,FLAPPY_PIPE_W+16,12);
        ctx.strokeStyle='#ff5544';ctx.lineWidth=1;ctx.strokeRect(pp.x-8,botY,FLAPPY_PIPE_W+16,12);
        // Neon gap indicator
        ctx.strokeStyle='rgba(255,100,50,0.2)';ctx.lineWidth=1;ctx.setLineDash([4,4]);
        ctx.beginPath();ctx.moveTo(pp.x-15,pp.gapY);ctx.lineTo(pp.x+FLAPPY_PIPE_W+15,pp.gapY);ctx.stroke();ctx.setLineDash([]);
      });
      // Floor + ceiling lines
      ctx.fillStyle='#441515';ctx.fillRect(0,0,w,4);ctx.fillRect(0,h-4,w,4);
      ctx.strokeStyle='#ff3322';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,4);ctx.lineTo(w,4);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,h-4);ctx.lineTo(w,h-4);ctx.stroke();
      // Bird — sp-lion.png with flap animation
      ctx.save();ctx.translate(birdX,birdY);
      // Flap = slight Y wobble + rotation based on velocity
      const vel=targetY-g.atkFlappyY;const flapAngle=vel*0.4;
      const flapY=Math.sin(g.atkFlappyTimer*0.3)*4;
      const flapScale=1+Math.sin(g.atkFlappyTimer*0.3)*0.06;
      ctx.rotate(flapAngle);ctx.scale(flapScale,1/flapScale);
      // Draw image if loaded, otherwise fallback circle
      if(jumbaImg.complete&&jumbaImg.naturalWidth>0){
        ctx.drawImage(jumbaImg,-FLAPPY_BIRD_SZ/2,-FLAPPY_BIRD_SZ/2+flapY,FLAPPY_BIRD_SZ,FLAPPY_BIRD_SZ);
      }else{
        ctx.fillStyle='#ff6644';ctx.beginPath();ctx.arc(0,flapY,FLAPPY_BIRD_SZ/2,0,Math.PI*2);ctx.fill();
        ctx.font="bold 24px sans-serif";ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText('🦁',0,flapY);ctx.textBaseline='alphabetic';
      }
      // Wing flap lines
      const wingPhase=Math.sin(g.atkFlappyTimer*0.4);
      ctx.strokeStyle='rgba(255,200,100,0.3)';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(-FLAPPY_BIRD_SZ*0.4,flapY);ctx.lineTo(-FLAPPY_BIRD_SZ*0.7,flapY+wingPhase*15);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-FLAPPY_BIRD_SZ*0.35,flapY+8);ctx.lineTo(-FLAPPY_BIRD_SZ*0.6,flapY+8+wingPhase*12);ctx.stroke();
      ctx.restore();
      // Trail particles behind bird
      for(let i=0;i<3;i++){const tx=birdX-20-i*15+Math.random()*6,ty=birdY+Math.random()*10-5;
        ctx.fillStyle=`rgba(255,${100+i*40},50,${0.3-i*0.08})`;ctx.beginPath();ctx.arc(tx,ty,3-i*0.5,0,Math.PI*2);ctx.fill()}
    };

    // ═══ 67 DUEL — synced race to 30, loser loses a life ═══
    const atkDuel67=(w,h)=>{
      g.atkDuelTimer++;const p2=P.current;
      if(!g.atkDuelDone&&p2.ok){const midY=(p2.sy+p2.hy)/2;
        if(p2.lwy<midY&&!g.atkDuelLUp){g.atkDuelLUp=true;g.atkDuelReps++;g.atkDuelLastPop=g.f;sfx.current.snap?.();send({type:'duel67sync',reps:g.atkDuelReps})}
        if(p2.lwy>=midY)g.atkDuelLUp=false;
        if(p2.rwy<midY&&!g.atkDuelRUp){g.atkDuelRUp=true;g.atkDuelReps++;g.atkDuelLastPop=g.f;sfx.current.snap?.();send({type:'duel67sync',reps:g.atkDuelReps})}
        if(p2.rwy>=midY)g.atkDuelRUp=false;
      }
      // Win — I finished first
      if(!g.atkDuelDone&&g.atkDuelReps>=g.atkDuelTarget){
        g.atkDuelDone=true;g.passed++;sfx.current.ok?.();
        send({type:'duel67done'});
        setTimeout(()=>{g.atkDuelActive=false;g.flash='ok';g.ft=25},1000);return;
      }
      // Timeout — both fail, no penalty
      if(g.atkDuelTimer>1200&&!g.atkDuelDone){g.atkDuelActive=false;return}
      // ── DRAW ──
      const isAtk=g.mpRole==='attacker';
      ctx.fillStyle=isAtk?'rgba(15,8,8,0.82)':'rgba(8,12,30,0.82)';ctx.fillRect(0,0,w,h);
      // Grid
      ctx.strokeStyle=isAtk?'rgba(255,80,50,0.05)':'rgba(0,200,255,0.05)';ctx.lineWidth=1;
      for(let gx=0;gx<w;gx+=60){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,h);ctx.stroke()}
      for(let gy=0;gy<h;gy+=60){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(w,gy);ctx.stroke()}
      // Title
      ctx.font="bold 48px 'Bebas Neue'";ctx.textAlign='center';
      ctx.fillStyle=isAtk?'rgba(255,80,50,0.95)':'rgba(0,220,255,0.95)';
      ctx.fillText('⚡ 67 DUEL!',w/2,h*0.12);
      ctx.font="bold 18px 'Share Tech Mono'";ctx.fillStyle='rgba(255,255,255,0.3)';
      ctx.fillText('First to 30 wins — PUMP YOUR ARMS!',w/2,h*0.17);
      // My count — big
      const myProg=g.atkDuelReps/g.atkDuelTarget;const popScale=(g.f-g.atkDuelLastPop<8)?1.15:1;
      ctx.save();ctx.translate(w*0.3,h*0.45);ctx.scale(popScale,popScale);
      ctx.font="bold 140px 'Bebas Neue'";ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillStyle=isAtk?'#ff5533':'#00ddff';ctx.fillText(g.atkDuelReps.toString(),0,0);ctx.restore();
      ctx.font="bold 18px 'Bebas Neue'";ctx.fillStyle='rgba(255,255,255,0.3)';ctx.textAlign='center';
      ctx.fillText('YOU',w*0.3,h*0.62);
      // Opponent count
      ctx.font="bold 100px 'Bebas Neue'";ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillStyle='rgba(255,255,255,0.15)';ctx.fillText(g.atkDuelOppReps.toString(),w*0.7,h*0.45);
      ctx.font="bold 18px 'Bebas Neue'";ctx.fillStyle='rgba(255,255,255,0.15)';ctx.textAlign='center';ctx.textBaseline='alphabetic';
      ctx.fillText('OPPONENT',w*0.7,h*0.62);
      // VS divider
      ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(w/2,h*0.2);ctx.lineTo(w/2,h*0.7);ctx.stroke();
      ctx.font="bold 36px 'Bebas Neue'";ctx.textAlign='center';ctx.fillStyle='rgba(255,255,255,0.12)';ctx.fillText('VS',w/2,h*0.44);
      // Progress bars
      const bW=w*0.25,bH=14,bY=h*0.67;
      ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(w*0.3-bW/2,bY,bW,bH);
      ctx.fillStyle=isAtk?'#ff4433':'#00ccff';ctx.fillRect(w*0.3-bW/2,bY,bW*myProg,bH);
      ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(w*0.7-bW/2,bY,bW,bH);
      ctx.fillStyle='rgba(255,255,255,0.1)';ctx.fillRect(w*0.7-bW/2,bY,bW*(g.atkDuelOppReps/g.atkDuelTarget),bH);
      // Target
      ctx.font="bold 14px 'Share Tech Mono'";ctx.fillStyle='rgba(255,255,255,0.2)';ctx.textAlign='center';
      ctx.fillText(`/ ${g.atkDuelTarget}`,w*0.3,bY+bH+18);ctx.fillText(`/ ${g.atkDuelTarget}`,w*0.7,bY+bH+18);
      // Arm indicators
      ctx.fillStyle=g.atkDuelLUp?(isAtk?'#ff5533':'#00ff88'):'rgba(255,255,255,0.08)';
      ctx.beginPath();ctx.arc(w*0.15,h*0.45,30,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=g.atkDuelRUp?(isAtk?'#ff5533':'#00ff88'):'rgba(255,255,255,0.08)';
      ctx.beginPath();ctx.arc(w*0.45,h*0.45,30,0,Math.PI*2);ctx.fill();
      ctx.font="bold 14px 'Barlow'";ctx.fillStyle='#fff';ctx.textAlign='center';
      ctx.fillText('L',w*0.15,h*0.45+5);ctx.fillText('R',w*0.45,h*0.45+5);
      // Done message
      if(g.atkDuelDone){ctx.font="bold 60px 'Bebas Neue'";ctx.textAlign='center';
        const iWon=g.atkDuelReps>=g.atkDuelTarget;
        ctx.fillStyle=iWon?'#00ff88':'#ff3344';
        ctx.fillText(iWon?'YOU WIN!':'TOO SLOW!',w/2,h*0.85)}
    };

    // ── MAIN LOOP ──
    // Tech particles — floating digital motes
    const techParts=[];
    for(let i=0;i<8;i++)techParts.push({x:Math.random(),y:Math.random(),sz:1+Math.random()*2,spd:0.1+Math.random()*0.35,drift:Math.random()*Math.PI*2,alpha:0.15+Math.random()*0.25,hue:185+Math.random()*25});

    // ── BEAT PULSE SYSTEM — synced to 162 BPM ──
    const BPM=162,BEAT_MS=60000/BPM;// ~370ms per beat
    const beatState={lastBeat:0,intensity:0,hue:0,half:false};
    // Create pulse light meshes in the Three.js scene
    const pulseLights=[];
    const pulseColors=[0xff0066,0x00ffcc,0xff8800,0x8844ff,0x00aaff,0xff4488];
    if(!t._beatLights){
      t._beatLights=[];
      // 6 wall pulse panels — 3 per side, positioned along the tunnel
      for(let i=0;i<6;i++){
        const side=i<3?-1:1;const idx=i%3;
        const pm=new THREE.Mesh(
          new THREE.PlaneGeometry(2.5,3),
          new THREE.MeshBasicMaterial({color:pulseColors[i],transparent:true,opacity:0,side:THREE.DoubleSide})
        );
        pm.rotation.y=side*Math.PI/2;
        pm.position.set(side*(TW/2-0.1),0,-idx*12+2);
        t.scene.add(pm);t._beatLights.push(pm);
      }
      // 2 floor pulse strips
      for(let i=0;i<2;i++){
        const fm=new THREE.Mesh(
          new THREE.PlaneGeometry(TW*0.6,1.5),
          new THREE.MeshBasicMaterial({color:i===0?0x00ffcc:0xff0066,transparent:true,opacity:0})
        );
        fm.rotation.x=-Math.PI/2;
        fm.position.set(0,-TH/2+0.02,-i*15+3);
        t.scene.add(fm);t._beatLights.push(fm);
      }
    }

    let rafId;
    const loop=()=>{if(!g.on)return;g.f++;const w=ov.width,h=ov.height;ctx.clearRect(0,0,w,h);

      // ── TECH PARTICLES overlay — always visible ──
      techParts.forEach(tp=>{
        tp.y-=tp.spd*0.003;tp.x+=Math.sin(g.f*0.01+tp.drift)*0.0003;
        if(tp.y<-0.02){tp.y=1.02;tp.x=Math.random()}
        const px=tp.x*w,py=tp.y*h;
        const pulse=0.6+Math.sin(g.f*0.04+tp.drift)*0.4;
        ctx.fillStyle=`hsla(${tp.hue},80%,70%,${tp.alpha*pulse})`;
        ctx.beginPath();ctx.arc(px,py,tp.sz,0,Math.PI*2);ctx.fill();
      });
      // ── BEAT PULSE — intense party lighting ──
      const now2=Date.now()-g.t0;
      const beatNum=Math.floor(now2/BEAT_MS);
      const halfBeat=Math.floor(now2/(BEAT_MS/2));// double-time for extra energy
      if(beatNum>beatState.lastBeat){
        beatState.lastBeat=beatNum;
        beatState.intensity=1;
        beatState.hue=(beatState.hue+47)%360;
        beatState.half=beatNum%2===0;
      }
      // Half-beat sub-pulse for hi-hat energy
      if(!beatState.lastHalf)beatState.lastHalf=0;
      if(halfBeat>beatState.lastHalf){beatState.lastHalf=halfBeat;if(beatState.intensity<0.4)beatState.intensity=0.4}
      if(beatState.intensity>0){
        beatState.intensity*=0.85;
        if(beatState.intensity<0.015)beatState.intensity=0;
        const bi=beatState.intensity;
        const bH=beatState.hue;
        const bH2=(bH+120)%360;// triadic color
        const bH3=(bH+240)%360;// triadic color 2
        // ── FULL BACKGROUND TINT — tints the whole scene ──
        ctx.fillStyle=`hsla(${bH},100%,50%,${bi*0.12})`;
        ctx.fillRect(0,0,w,h);
        // Second layer — complementary color, lighter
        ctx.fillStyle=`hsla(${bH2},80%,60%,${bi*0.05})`;
        ctx.fillRect(0,0,w,h);
        // ── THICK EDGE GRADIENTS — left, right, top, bottom ──
        const eW=w*0.18;// wide edge band
        // Left — primary color
        const eg1=ctx.createLinearGradient(0,0,eW,0);
        eg1.addColorStop(0,`hsla(${bH},100%,55%,${bi*0.45})`);
        eg1.addColorStop(0.5,`hsla(${bH},100%,55%,${bi*0.15})`);
        eg1.addColorStop(1,'transparent');
        ctx.fillStyle=eg1;ctx.fillRect(0,0,eW,h);
        // Right — triadic color
        const eg2=ctx.createLinearGradient(w,0,w-eW,0);
        eg2.addColorStop(0,`hsla(${bH2},100%,55%,${bi*0.45})`);
        eg2.addColorStop(0.5,`hsla(${bH2},100%,55%,${bi*0.15})`);
        eg2.addColorStop(1,'transparent');
        ctx.fillStyle=eg2;ctx.fillRect(w-eW,0,eW,h);
        // Top — accent
        const eHt=h*0.12;
        const eg3=ctx.createLinearGradient(0,0,0,eHt);
        eg3.addColorStop(0,`hsla(${bH3},100%,60%,${bi*0.3})`);
        eg3.addColorStop(1,'transparent');
        ctx.fillStyle=eg3;ctx.fillRect(0,0,w,eHt);
        // Bottom — warm glow
        const eHb=h*0.15;
        const eg4=ctx.createLinearGradient(0,h,0,h-eHb);
        eg4.addColorStop(0,`hsla(${(bH+60)%360},100%,50%,${bi*0.25})`);
        eg4.addColorStop(1,'transparent');
        ctx.fillStyle=eg4;ctx.fillRect(0,h-eHb,w,eHb);
        // ── CORNER FLARES — radial bursts from corners ──
        if(bi>0.5){
          [[0,0,bH],[w,0,bH2],[0,h,bH3],[w,h,(bH+60)%360]].forEach(([cx2,cy2,ch])=>{
            const cg=ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,w*0.35);
            cg.addColorStop(0,`hsla(${ch},100%,60%,${(bi-0.5)*0.25})`);
            cg.addColorStop(1,'transparent');
            ctx.fillStyle=cg;ctx.fillRect(0,0,w,h);
          });
        }
        // ── CENTER PULSE — radial ring on strong beats ──
        if(bi>0.7){
          const ringR=(1-bi)*w*0.4;
          ctx.strokeStyle=`hsla(${bH},100%,70%,${(bi-0.7)*0.6})`;
          ctx.lineWidth=3+bi*4;
          ctx.beginPath();ctx.arc(w/2,h/2,ringR,0,Math.PI*2);ctx.stroke();
        }
      }
      // ── THREE.JS BEAT LIGHTS — wall + floor panels ──
      if(t._beatLights){
        const bi2=beatState.intensity;
        const ws2=WALL_SPD_B+g.jog*WALL_SPD_J;
        t._beatLights.forEach((lm,li)=>{
          const active=li%2===(beatState.half?0:1);
          const targetOp=active?bi2*0.6:bi2*0.15;
          lm.material.opacity+=(targetOp-lm.material.opacity)*0.3;// smooth fade
          // Cycle the color on each beat
          const hue=(beatState.hue+li*60)%360;
          lm.material.color.setHSL(hue/360,1,0.55);
          lm.position.z+=ws2;
          if(lm.position.z>6)lm.position.z-=(li<6?36:30);
        });
        // Also pulse the arch rings if they exist
        if(t.ceilLights){
          t.ceilLights.forEach((cl,ci)=>{
            const bp=bi2*0.4;
            const archHue=(beatState.hue+ci*72)%360;
            if(bp>0.05)cl.material.color.setHSL(archHue/360,0.8,0.5+bp*0.3);
            else cl.material.color.set(g.mpRole==='attacker'?0xff6655:0x44eeff);// reset to default
          });
        }
      }
      if(!g.techActive&&!g.virusActive&&!g.c67Active&&!g.holdActive&&!g.jumbaActive&&!g.secActive&&!g.atkSnapActive&&!g.atkVirusPassActive&&!g.atkFlappyActive&&!g.atkDuelActive){
        const rj=jogDet();g.jog=Math.max(rj,g.jog*JOG_DECAY);g.spd=g.jog;
        // Defender debuffs
        if(g.debuffSlow>0){g.spd*=0.4;g.debuffSlow--}
        if(g.debuffDrain>0){g.dist=Math.max(0,g.dist-0.08);g.debuffDrain--}
        // Speed boost from orbs
        if(g.spdBoostTimer>0){g.spd*=g.spdBoostMult;g.spdBoostTimer--}
        g.dist+=g.spd*0.5;

        // Security check trigger — passive, random, every ~120-200 dist
        if(!g.secActive&&g.dist>100&&(g.dist-g.lastSecDist)>180+Math.random()*100&&Math.random()<0.004&&(g.cfg?.obs?.security!==false)){
          g.secActive=true;g.secTimer=0;g.secDuration=120;g.secCaught=false;g.secCaughtT=0;g.lastSecDist=g.dist;
          g.secBasePos={smx:p.smx,sy:p.sy,hy:p.hy,lwy:p.lwy,rwy:p.rwy};
          const el=secGuardRef.current;if(el){el.style.display='block';el.style.opacity='1'}
          sfx.current.siren?.();
        }
        g.wcd--;if(g.wcd<=0&&t.wallMeshes.length<3){spawn();g.wcd=Math.max(60,W_GAP-g.dist*0.35)}
        const ws=(WALL_SPD_B+g.jog*WALL_SPD_J);t.wallMeshes.forEach(wm=>{wm.data.z+=ws;wm.mesh.position.z=wm.data.z});
        t.wallMeshes.forEach(wm=>{const d=wm.data;if(d.done||d.z<WALL_CHECK)return;d.done=true;let ok=false;if(d.tp==='p'){ok=p.ok&&d.ck(p)}else{const side=p.smx<0.43?'left':p.smx>0.57?'right':null;ok=side===d.tri.c}if(ok){g.passed++;g.flash='ok';g.ft=25;sfx.current.ok?.();if(d.tp==='t'){g.triviaMsg='CORRECT!';g.triviaMsgT=g.f}}else{g.lives--;g.hit++;g.flash='no';g.ft=25;sfx.current.no?.();try{navigator.vibrate&&navigator.vibrate([200,50,200])}catch{};if(d.tp==='t'){g.triviaMsg='WRONG!';g.triviaMsgT=g.f}if(g.lives<=0){g.on=false;if(musicRef.current)musicRef.current.stop();setPh('go');return}}});
        t.wallMeshes=t.wallMeshes.filter(wm=>{if(wm.data.z>WALL_REMOVE){wm.mesh.children.forEach(c=>{if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose()});t.scene.remove(wm.mesh);wm.mesh.geometry.dispose();wm.mesh.material.dispose();return false}return true});
        t.stripes.forEach(s=>{s.position.z+=ws;if(s.position.z>6)s.position.z-=63});
        // Arch rings + beams scroll
        if(t.ceilLights)t.ceilLights.forEach(cl=>{cl.position.z+=ws;if(cl.position.z>6)cl.position.z-=45});
        // Floor circuit lines scroll with road
        // Wall markers scroll
        // Wall panels scroll
        if(t.wallPanels)t.wallPanels.forEach(wp=>{wp.position.z+=ws;if(wp.position.z>6)wp.position.z-=36});
        // Conveyor belt slats scroll
        // Wall modules scroll
      }
      // ── SECURITY CHECK — freeze gameplay, detect movement ──
      if(g.secActive){
        g.secTimer++;
        if(!g.secCaught&&g.secBasePos&&p.ok&&g.secTimer>60){
          const bp=g.secBasePos;const moved=Math.abs(p.smx-bp.smx)>0.10||Math.abs(p.sy-bp.sy)>0.10||Math.abs(p.lwy-bp.lwy)>0.12||Math.abs(p.rwy-bp.rwy)>0.12;
          if(moved){g.secCaught=true;g.secCaughtT=g.f;g.lives--;g.hit++;sfx.current.no?.();try{navigator.vibrate&&navigator.vibrate([200,50,200])}catch(e){};if(g.lives<=0){g.on=false;g.secActive=false;const el=secGuardRef.current;if(el){el.style.display='none';el.style.transform='none'};if(musicRef.current)musicRef.current.stop();setPh('go')}else{setTimeout(()=>{g.secActive=false;g.secCaught=false;const el2=secGuardRef.current;if(el2){el2.style.display='none';el2.style.transform='none'}},800)}}
        }
        if(g.secTimer>=g.secDuration){g.secActive=false;g.secCaught=false;const el=secGuardRef.current;if(el){el.style.display='none';el.style.transform='none'}}
      }
      if(!g.on)return;
      if(g.ft>0)g.ft--;if(g.dist>=FINISH){g.on=false;if(musicRef.current)musicRef.current.stop();if(gameMode==='multi')send({type:'done',dist:g.dist});setPh('go');return}
      // Multiplayer sync — send state every 6 frames
      if(gameMode==='multi'&&g.f-mpRef.current.lastSend>6){mpRef.current.lastSend=g.f;send({type:'sync',dist:g.dist,lives:g.lives})}
      t.renderer.render(t.scene,t.camera);
      if(!g.on){rafId=requestAnimationFrame(loop);return}
      if(g.techActive){drawAv(p.kps);techStop(w,h)}
      else if(g.virusActive){drawAv(p.kps);virusPurge(w,h)}
      else if(g.c67Active){drawAv(p.kps);counter67(w,h)}
      else if(g.holdActive){drawAv(p.kps);holdPose(w,h)}
      else if(g.jumbaActive){drawAv(p.kps);whackJumba(w,h)}
      else if(g.atkSnapActive){drawAv(p.kps);atkSnapWire(w,h)}
      else if(g.atkVirusPassActive){drawAv(p.kps);atkVirusPass(w,h)}
      else if(g.atkDuelActive){drawAv(p.kps);atkDuel67(w,h)}
      else{drawAv(p.kps);
        t.wallMeshes.forEach(wm=>{if(wm.data.tp!=='t'||wm.data.done)return;const z=wm.data.z;if(z<-20||z>WALL_CHECK)return;const tri=wm.data.tri,closeness=(z+20)/17,alpha=Math.min(1,closeness*1.5);const fs=62;ctx.font=`800 ${fs}px 'Bebas Neue',sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';const lx=w*0.24,rx=w*0.76,py=h*0.42,pillH=fs+28,pp=26;ctx.globalAlpha=alpha;
          const lTW=Math.max(200,ctx.measureText(tri.l).width+pp*2);ctx.fillStyle='rgba(0,0,0,0.9)';if(ctx.roundRect){ctx.beginPath();ctx.roundRect(lx-lTW/2,py-pillH/2,lTW,pillH,10);ctx.fill()}else ctx.fillRect(lx-lTW/2,py-pillH/2,lTW,pillH);ctx.strokeStyle='rgba(0,180,255,0.85)';ctx.lineWidth=3;if(ctx.roundRect){ctx.beginPath();ctx.roundRect(lx-lTW/2,py-pillH/2,lTW,pillH,10);ctx.stroke()}ctx.fillStyle='#66ddff';ctx.fillText(tri.l,lx,py);
          const rTW=Math.max(200,ctx.measureText(tri.r).width+pp*2);ctx.fillStyle='rgba(0,0,0,0.9)';if(ctx.roundRect){ctx.beginPath();ctx.roundRect(rx-rTW/2,py-pillH/2,rTW,pillH,10);ctx.fill()}else ctx.fillRect(rx-rTW/2,py-pillH/2,rTW,pillH);ctx.strokeStyle='rgba(255,80,80,0.85)';ctx.lineWidth=3;if(ctx.roundRect){ctx.beginPath();ctx.roundRect(rx-rTW/2,py-pillH/2,rTW,pillH,10);ctx.stroke()}ctx.fillStyle='#ff8888';ctx.fillText(tri.r,rx,py);
          ctx.font="bold 24px 'Bebas Neue'";ctx.fillStyle='rgba(255,255,255,0.55)';ctx.fillText('← LEFT',lx,py+pillH/2+28);ctx.fillText('RIGHT →',rx,py+pillH/2+28);ctx.globalAlpha=1})
        // ── TRIVIA CONFIRMATION TEXT ──
        if(g.triviaMsg&&g.triviaMsgT){const age=g.f-g.triviaMsgT;if(age<50){const a=age<5?age/5:age>35?1-(age-35)/15:1;const isOk=g.triviaMsg==='CORRECT!';ctx.save();ctx.globalAlpha=a;ctx.font="bold 72px 'Bebas Neue'";ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=isOk?'#00ddff':'#ff3355';ctx.fillText(g.triviaMsg,w/2,h*0.5-age*0.8);ctx.font="bold 20px 'Share Tech Mono'";ctx.fillStyle=isOk?'rgba(0,220,255,0.5)':'rgba(255,50,80,0.5)';ctx.fillText(isOk?'Authentication passed':'Access denied',w/2,h*0.5+40-age*0.8);ctx.restore()}else{g.triviaMsg=null}}
        // Defender glitch debuff overlay
        if(g.debuffGlitch>0){g.debuffGlitch--;const gi=g.debuffGlitch/300;
          for(let i=0;i<Math.ceil(gi*4);i++){ctx.fillStyle=`rgba(255,0,50,${gi*0.08})`;ctx.fillRect(0,Math.random()*h,w,2+Math.random()*4)}
          if(Math.random()<gi*0.3){ctx.fillStyle=`rgba(255,20,20,${gi*0.12})`;ctx.fillRect(0,Math.random()*h,w,10+Math.random()*20)}
          if(g.debuffGlitch>100){ctx.font="bold 16px 'Share Tech Mono'";ctx.fillStyle=`rgba(255,50,50,${gi*0.3})`;ctx.textAlign='center';ctx.fillText('⚠ SYSTEM CORRUPTED',w/2,h*0.92)}
        }
      }
      // ── SPEED ORB SYSTEM — spawns during running (not during mini-games) ──
      const ORB_DURATION=90,ORB_CD_MIN=120,ORB_CD_MAX=300,BOOST_DUR=240;
      const ORB_MULTS=[1.5,1.75,2.0,2.5];
      const miniActive=g.techActive||g.virusActive||g.c67Active||g.holdActive||g.jumbaActive||g.atkSnapActive||g.atkVirusPassActive||g.atkDuelActive;
      // Spawn — only when no mini-game, security check is OK
      if(!g.spdOrb&&!miniActive){
        g.spdOrbCD--;
        if(g.spdOrbCD<=0){
          const mult=ORB_MULTS[Math.floor(Math.random()*ORB_MULTS.length)];
          g.spdOrb={x:0.15+Math.random()*0.7,y:0.12+Math.random()*0.5,mult,timer:ORB_DURATION,born:g.f};
          g.spdOrbCD=ORB_CD_MIN+Math.floor(Math.random()*(ORB_CD_MAX-ORB_CD_MIN));
        }
      }
      // Update + hit + draw orb (always, even with walls approaching)
      if(g.spdOrb){
        g.spdOrb.timer--;
        if(g.spdOrb.timer<=0){g.spdOrb=null}
        else{
          const ox=g.spdOrb.x*w,oy=g.spdOrb.y*h;
          // Hit detection
          const hands3=[];if(g.hLV)hands3.push({x:g.hLX,y:g.hLY});if(g.hRV)hands3.push({x:g.hRX,y:g.hRY});
          for(const hh of hands3){
            if(Math.sqrt((hh.x-ox)**2+(hh.y-oy)**2)<95){
              g.spdBoostMult=g.spdOrb.mult;g.spdBoostTimer=BOOST_DUR;
              sfx.current.ok?.();g.flash='ok';g.ft=25;g.spdOrb=null;break;
            }
          }
          // Draw orb
          if(g.spdOrb){
            const age=g.f-g.spdOrb.born;
            const fadeIn=Math.min(1,age/8);
            const fadeOut=g.spdOrb.timer<15?g.spdOrb.timer/15:1;
            const al=fadeIn*fadeOut;
            const pu=0.9+Math.sin(g.f*0.15)*0.1;
            const oR2=48*pu;
            ctx.save();ctx.globalAlpha=al;
            // Approach ring — shrinks
            const apR=oR2+25*(g.spdOrb.timer/ORB_DURATION);
            ctx.strokeStyle='rgba(255,220,50,0.5)';ctx.lineWidth=3;
            ctx.beginPath();ctx.arc(ox,oy,apR,0,Math.PI*2);ctx.stroke();
            // Outer glow
            const og=ctx.createRadialGradient(ox,oy,oR2*0.2,ox,oy,oR2*1.6);
            og.addColorStop(0,'rgba(255,200,50,0.35)');og.addColorStop(1,'transparent');
            ctx.fillStyle=og;ctx.beginPath();ctx.arc(ox,oy,oR2*1.6,0,Math.PI*2);ctx.fill();
            // Orb body
            const ob=ctx.createRadialGradient(ox-oR2*0.2,oy-oR2*0.2,oR2*0.05,ox,oy,oR2);
            ob.addColorStop(0,'#fff8dd');ob.addColorStop(0.3,'#ffcc22');ob.addColorStop(0.7,'#ff9900');ob.addColorStop(1,'#cc6600');
            ctx.fillStyle=ob;ctx.beginPath();ctx.arc(ox,oy,oR2,0,Math.PI*2);ctx.fill();
            // White ring
            ctx.strokeStyle='rgba(255,255,255,0.7)';ctx.lineWidth=2.5;
            ctx.beginPath();ctx.arc(ox,oy,oR2,0,Math.PI*2);ctx.stroke();
            // Multiplier text
            ctx.font="bold 26px 'Bebas Neue'";ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.fillStyle='#fff';ctx.fillText(g.spdOrb.mult+'x',ox,oy);
            // Sparkles
            for(let sp=0;sp<5;sp++){const sa=(sp/5)*Math.PI*2+g.f*0.1;const sd=oR2+10+Math.sin(g.f*0.14+sp)*5;
              ctx.fillStyle='rgba(255,240,150,0.7)';ctx.beginPath();ctx.arc(ox+Math.cos(sa)*sd,oy+Math.sin(sa)*sd,2.5,0,Math.PI*2);ctx.fill()}
            ctx.restore();
          }
        }
      }
      // Speed boost active indicator
      if(g.spdBoostTimer>0){
        const bHue2=(g.f*8)%360;
        ctx.fillStyle=`hsla(${bHue2},100%,60%,0.06)`;ctx.fillRect(0,0,w,h);
        const bAl=g.spdBoostTimer>30?1:g.spdBoostTimer/30;
        ctx.save();ctx.globalAlpha=bAl;ctx.font="bold 24px 'Bebas Neue'";ctx.textAlign='center';
        ctx.fillStyle=`hsl(${bHue2},100%,65%)`;ctx.fillText(g.spdBoostMult+'x SPEED!',w/2,h*0.9);
        ctx.restore();
      }
      // ── HAND MARKERS — visible when orb is on screen or boost active ──
      if(g.spdOrb||g.spdBoostTimer>0){
        const handAlpha=g.spdOrb?0.8:Math.min(0.4,g.spdBoostTimer/60);
        [[g.hLV,g.hLX,g.hLY,'#44ffaa'],[g.hRV,g.hRX,g.hRY,'#44aaff']].forEach(([vis,hx2,hy2,col])=>{
          if(!vis)return;
          ctx.save();ctx.globalAlpha=handAlpha;
          // Outer pulse ring
          const pr=(g.f%30)/30;
          ctx.strokeStyle=col;ctx.lineWidth=2;ctx.globalAlpha=handAlpha*(1-pr);
          ctx.beginPath();ctx.arc(hx2,hy2,30+pr*20,0,Math.PI*2);ctx.stroke();
          // Glow
          ctx.globalAlpha=handAlpha*0.15;
          ctx.fillStyle=col;ctx.beginPath();ctx.arc(hx2,hy2,40,0,Math.PI*2);ctx.fill();
          // Main circle
          ctx.globalAlpha=handAlpha*0.7;
          ctx.fillStyle=col;ctx.beginPath();ctx.arc(hx2,hy2,22,0,Math.PI*2);ctx.fill();
          // White center
          ctx.globalAlpha=handAlpha;
          ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hx2,hy2,8,0,Math.PI*2);ctx.fill();
          // Crosshair lines
          ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.globalAlpha=handAlpha*0.4;
          ctx.beginPath();ctx.moveTo(hx2-18,hy2);ctx.lineTo(hx2-8,hy2);ctx.stroke();
          ctx.beginPath();ctx.moveTo(hx2+8,hy2);ctx.lineTo(hx2+18,hy2);ctx.stroke();
          ctx.beginPath();ctx.moveTo(hx2,hy2-18);ctx.lineTo(hx2,hy2-8);ctx.stroke();
          ctx.beginPath();ctx.moveTo(hx2,hy2+8);ctx.lineTo(hx2,hy2+18);ctx.stroke();
          ctx.restore();
        });
      }
      // ── SECURITY CHECK OVERLAY — heavy red, guard from right, alarming ──
      if(g.secActive){
        drawAv(p.kps);
        const pulse=Math.sin(g.f*0.12)*0.1;
        // Heavy red tint
        ctx.fillStyle=`rgba(160,10,10,${0.35+pulse})`;ctx.fillRect(0,0,w,h);
        // Flashing red border
        if(Math.floor(g.f/12)%2===0){ctx.strokeStyle='rgba(255,20,20,0.5)';ctx.lineWidth=10;ctx.strokeRect(5,5,w-10,h-10)}
        // Siren lights
        const sirenPulse=Math.sin(g.f*0.15)*0.5+0.5;
        ctx.fillStyle=`rgba(255,0,0,${sirenPulse*0.15})`;ctx.fillRect(0,0,w*0.15,h);
        ctx.fillStyle=`rgba(255,0,0,${(1-sirenPulse)*0.15})`;ctx.fillRect(w*0.85,0,w*0.15,h);
        // Guard sprite — HUGE, from right side, tilted
        const el=secGuardRef.current;
        if(el){const gW=w*0.45,gH=h*0.75;el.style.left=`${w-gW*0.65}px`;el.style.top=`${h*0.08}px`;el.style.width=`${gW}px`;el.style.height=`${gH}px`;el.style.transform='rotate(-12deg)'}
        // DON'T MOVE — massive, centered
        ctx.textAlign='center';
        ctx.font="bold 130px 'Bebas Neue'";
        ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillText("DON'T MOVE!",w/2+3,h*0.48+3);
        ctx.fillStyle=`rgba(255,255,255,${0.9+pulse*0.5})`;ctx.fillText("DON'T MOVE!",w/2,h*0.48);
        // Sub text
        ctx.font="bold 22px 'Share Tech Mono'";ctx.fillStyle='rgba(255,120,120,0.6)';
        ctx.fillText('Security scanning in progress...',w/2,h*0.56);
        // Timer bar — centered
        const secPct=1-g.secTimer/g.secDuration;const bW7=w*0.35,bH7=12,bX6=(w-bW7)/2,bY6=h*0.60;
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(bX6,bY6,bW7,bH7);
        ctx.fillStyle='#ff3333';ctx.fillRect(bX6,bY6,bW7*secPct,bH7);
        // CAUGHT flash
        if(g.secCaught){const age=g.f-g.secCaughtT;if(age<60){const a=age<5?age/5:age>40?1-(age-40)/20:1;ctx.save();ctx.globalAlpha=a;ctx.font="bold 120px 'Bebas Neue'";ctx.textAlign='center';ctx.fillStyle='#ff1122';ctx.fillText('CAUGHT!',w/2,h*0.45);ctx.font="bold 26px 'Share Tech Mono'";ctx.fillStyle='rgba(255,80,80,0.7)';ctx.fillText('Movement detected — life lost!',w/2,h*0.45+55);ctx.restore()}}
      }
      rafId=requestAnimationFrame(loop)};
    rafId=requestAnimationFrame(loop);return()=>{window.removeEventListener('resize',rsz);clearInterval(hudIv);cancelAnimationFrame(rafId)};
  },[ph,jogDet]); // eslint-disable-line

  const jp=Math.min(100,hJ*100),jc=G.current.spdBoostTimer>0?`hsl(${(Date.now()*2)%360},100%,55%)`:jp<30?'#ff3355':jp<60?'#ffaa00':'#00ff88',dp=Math.min(100,(hD/FINISH)*100);
  return(
    <div className="rm"><div className="gc">
      <video ref={vidRef} className="vh" playsInline autoPlay muted/>
      <div ref={mountRef} className="three-mount"/>
      <canvas ref={ovRef} className="ov-canvas"/>
      <img ref={jumbaElRef} src="/sp-lion.png" alt="" className="jumba-sprite"/>
      <img ref={secGuardRef} src="/cc-lion.png" alt="" className="sec-guard-sprite"/>
      {ph==='play'&&(<>{!hHide&&<><div className="hud"><div className="hud-l"><div className="hud-lives">{[0,1,2].map(i=>(<span key={i} className={`hud-h ${i>=G.current.lives?'x':''}`}>{i<G.current.lives?'❤️':'🖤'}</span>))}</div></div><div className="hud-c"><div className="hud-dist">{hD}m</div><div className="hud-dl">CHARGE</div></div><div className="hud-r"></div></div>
        <div className="battery-wrap"><div className={`battery-body ${mpRole==='attacker'?'atk':''}`}><div className="battery-fill" style={{width:`${dp}%`,background:mpRole==='attacker'?'linear-gradient(90deg,#cc3322,#ff4433,#ff6644)':undefined}}/><div className="battery-pct">{Math.round(dp)}%</div></div><div className={`battery-tip ${mpRole==='attacker'?'atk':''}`}/></div>
        <div className="speed-bar-wrap"><div className="speed-val">{Math.round(jp)}%</div><div className="speed-track"><div className="speed-fill" style={{height:`${jp}%`,background:jc}}/></div><div className="speed-label">POWER</div></div>
        {hWL&&(<div className={`banner ${hWT==='tri'?'tri':hWT==='tech'?'tech':'pose'}`}><div className="banner-t">{hWL}</div></div>)}
        {gameMode==='multi'&&<div className="opp-bar"><div className="opp-label">{oppName} — {Math.round(oppDist/FINISH*100)}%{oppDone?' ✓':''}</div><div className="opp-track"><div className="opp-fill" style={{width:`${Math.min(100,oppDist/FINISH*100)}%`}}/></div><div className="opp-lives">{[0,1,2].map(i=>(<span key={i} style={{opacity:i<oppLives?1:0.2}}>❤️</span>))}</div></div>}</>}
        {hF&&!hHide&&<div className={`flash ${hF}`} key={G.current.f}/>}</>)}
      {ph==='loading'&&(<div className="ov"><div className="spin"/><div className="lt">{lm}</div></div>)}
      {ph==='menu'&&(<div className="ov"><div className="sc"><h1 className="st">SYSTEM <span>REBOOT</span></h1><p className="ss">Choose your mode.</p>
        {!hubCode&&remoteCode&&<div style={{textAlign:'center',margin:'10px 0',padding:'8px 16px',background:'rgba(0,220,255,0.06)',borderRadius:8,border:'1px solid rgba(0,220,255,0.15)'}}><div style={{fontSize:11,color:'#4466aa',letterSpacing:2,marginBottom:4}}>REMOTE CODE</div><div style={{fontSize:32,fontWeight:900,letterSpacing:8,color:'#00ddff',fontFamily:'monospace'}}>{remoteCode}</div><div style={{fontSize:11,color:'#334455',marginTop:4}}>Enter this code in the Flutter app</div></div>}
        {!hubCode&&!remoteCode&&remoteErr&&<div style={{textAlign:'center',margin:'10px 0',padding:'8px 16px',background:'rgba(255,50,50,0.06)',borderRadius:8,border:'1px solid rgba(255,50,50,0.15)'}}><div style={{fontSize:11,color:'#ff5555',letterSpacing:1}}>REMOTE FAILED: {remoteErr}</div></div>}
        {!hubCode&&!remoteCode&&!remoteErr&&<div style={{textAlign:'center',margin:'10px 0',padding:'6px',color:'#334455',fontSize:11}}>Connecting to remote service...</div>}
        <div className="mode-btns"><button className="mode-btn" onClick={()=>{setGameMode('single');setMpMode(false);setMpRole(null);setPh('start')}}><span className="mode-icon">🎮</span><span className="mode-label">SINGLE PLAYER</span></button>
        <button className="mode-btn" onClick={()=>{setGameMode('multi');setPh('start')}}><span className="mode-icon">⚔️</span><span className="mode-label">MULTIPLAYER</span></button></div></div></div>)}
      {ph==='start'&&gameMode==='single'&&(<div className="ov"><div className="sc"><h1 className="st">SYSTEM <span>REBOOT</span></h1><p className="ss">Configure your mission parameters.</p>
        {!hubCode&&remoteCode&&<div style={{textAlign:'center',margin:'6px 0',padding:'6px 12px',background:'rgba(0,220,255,0.04)',borderRadius:6,border:'1px solid rgba(0,220,255,0.1)'}}><span style={{fontSize:10,color:'#4466aa',letterSpacing:2}}>REMOTE: </span><span style={{fontSize:18,fontWeight:900,letterSpacing:6,color:'#00ddff',fontFamily:'monospace'}}>{remoteCode}</span></div>}
        <div className="cfg-panel">
          <div className="cfg-row"><span className="cfg-label">DIFFICULTY</span><div className="cfg-toggle"><button className={`cfg-btn ${cfgDiff==='easy'?'active':''}`} onClick={()=>setCfgDiff('easy')}>EASY</button><button className={`cfg-btn ${cfgDiff==='hard'?'active':''}`} onClick={()=>setCfgDiff('hard')}>NORMAL</button></div></div>

          <div className="cfg-row"><span className="cfg-label">OBSTACLES</span><div className="cfg-checks">{[['walls','Pose Walls'],['trivia','Trivia'],['cables','Cables Fix'],['virus','Virus Purge'],['counter','67 Counter'],['hold','Hold Pose'],['jumba','Whack Jumba'],['security','Security Check']].map(([k,lbl])=>(<label key={k} className="cfg-check"><input type="checkbox" checked={cfgObs[k]} onChange={()=>setCfgObs(p=>({...p,[k]:!p[k]}))}/><span className="cfg-ck-box"/><span>{lbl}</span></label>))}</div></div>
        </div>
        <button className="sb" onClick={startG}>INITIALIZE</button>
        <button className="mp-btn mp-cancel" style={{marginTop:8}} onClick={()=>setPh('menu')}>← BACK</button></div></div>)}
      {ph==='start'&&gameMode==='multi'&&(<div className="ov"><div className="sc"><h1 className="st">SYSTEM <span>REBOOT</span></h1><p className="ss">Connect with your opponent.</p>
        <div className="mp-section">
          {!mpMode?(<div className="mp-btns"><button className="mp-btn" onClick={()=>{setMpMode(true);setMpRole(null);setOppRole(null);createRoom()}}>CREATE ROOM</button><div className="mp-or">or</div><div className="mp-join"><input className="mp-code" type="text" placeholder="CODE" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={4}/><button className="mp-btn" onClick={()=>{setMpMode(true);setMpRole(null);setOppRole(null);joinRoom(joinCode)}}>JOIN</button></div></div>)
          :(<div className="mp-status">{rtcErr&&<div className="mp-err">{rtcErr}</div>}{roomCode&&<div className="mp-room">ROOM: <span>{roomCode}</span></div>}{connected?<><div className="mp-connected">OPPONENT CONNECTED ✓</div>
            <div className="mp-roles"><div className="mp-roles-title">CHOOSE YOUR ROLE</div><div className="mp-role-btns">
              <button className={`mp-role-btn mp-role-atk ${mpRole==='attacker'?'active':''}`} onClick={()=>{setMpRole('attacker');send({type:'role',role:'attacker'})}}><span className="mp-role-icon">⚔️</span><span className="mp-role-name">ATTACKER</span></button>
              <button className={`mp-role-btn mp-role-def ${mpRole==='defender'?'active':''}`} onClick={()=>{setMpRole('defender');send({type:'role',role:'defender'})}}><span className="mp-role-icon">🛡️</span><span className="mp-role-name">DEFENDER</span></button>
            </div>
            {mpRole&&oppRole?(mpRole===oppRole?<div className="mp-role-conflict">Both picked {mpRole} — someone switch!</div>:<div className="mp-role-ready">Roles locked! {mpRole.toUpperCase()} vs {oppRole.toUpperCase()}</div>):mpRole?<div className="mp-role-wait">Waiting for opponent to pick...</div>:null}
          </div></>:<div className="mp-waiting">Waiting for opponent...</div>}<button className="mp-btn mp-cancel" onClick={()=>{setMpMode(false);setMpRole(null);setOppRole(null);disconnect()}}>CANCEL</button></div>)}
        </div>
        <button className="sb" onClick={startG} disabled={!connected||!(mpRole&&oppRole&&mpRole!==oppRole)}>START RACE</button>
        <button className="mp-btn mp-cancel" style={{marginTop:8}} onClick={()=>{setMpMode(false);disconnect();setPh('menu')}}>← BACK</button></div></div>)}
      {ph==='cd'&&<CD onDone={cdDone}/>}
      {ph==='go'&&gameMode==='single'&&(<div className="ov"><div className="go-wrap"><div className="go-left"><h2 className={`got ${G.current.dist>=FINISH?'w':''}`}>{G.current.dist>=FINISH?'SYSTEM ONLINE':'SYSTEM FAILURE'}</h2><div className="gos">{Math.round((G.current.dist/FINISH)*100)}%</div><div className="gol">Battery Charged</div><div className="gost"><div className="gos2"><div className="gosv">{G.current.passed}</div><div className="gosl">Cleared</div></div><div className="gos2"><div className="gosv">{G.current.hit}</div><div className="gosl">Errors</div></div><div className="gos2"><div className="gosv">{Math.floor((Date.now()-G.current.t0)/1000)}s</div><div className="gosl">Uptime</div></div></div>
        <div className="lb-submit-area">{!lbSubmitted?(<div className="lb-submit"><input className="lb-input" type="text" placeholder="Enter your name..." value={lbName} onChange={e=>setLbName(e.target.value)} maxLength={20}/><button className="lb-btn" onClick={()=>submitScore(lbName,Math.floor((Date.now()-G.current.t0)/1000),G.current.passed,G.current.hit,Math.round((G.current.dist/FINISH)*100))}>SUBMIT SCORE</button></div>):(<div className="lb-done">Score submitted!</div>)}</div>
        <button className="gob" onClick={()=>setPh('menu')}>REBOOT</button></div>
        <div className="go-right">{lbScores.length>0&&(<div className="lb-board"><div className="lb-title">LEADERBOARD</div>{lbScores.map((s,i)=>(<div key={i} className={`lb-row ${i===0?'lb-gold':i===1?'lb-silver':i===2?'lb-bronze':''}`}><div className="lb-badge">{i+1}</div><div className="lb-info"><div className="lb-name">{s.name}</div><div className="lb-stats">{s.cleared} cleared · {s.errors} errors</div></div><div className="lb-score"><div className="lb-score-val">{s.uptime}s</div><div className="lb-score-lbl">{s.charge_pct}%</div></div></div>))}</div>)}</div></div></div>)}
      {ph==='go'&&gameMode==='multi'&&(<div className="ov"><div className="goc"><h2 className={`got ${mpWinner?'w':''}`} style={{color:mpWinner==='attacker'?'#ff4455':'#00ddff'}}>{mpWinner?(mpWinner.toUpperCase()+' WINS!'):'MATCH OVER'}</h2>
        <div className="gost"><div className="gos2"><div className="gosv">{mpRole?.toUpperCase()}</div><div className="gosl">Your Role</div></div><div className="gos2"><div className="gosv">{G.current.passed}</div><div className="gosl">Cleared</div></div><div className="gos2"><div className="gosv">{G.current.hit}</div><div className="gosl">Errors</div></div><div className="gos2"><div className="gosv">{Math.floor((Date.now()-G.current.t0)/1000)}s</div><div className="gosl">Uptime</div></div></div>
        <div style={{display:'flex',gap:12,marginTop:14}}><button className="gob" onClick={()=>{setMpWinner(null);startG()}}>RETRY</button><button className="gob" style={{background:'rgba(255,255,255,0.08)',color:'#fff'}} onClick={()=>{setMpMode(false);disconnect();setMpWinner(null);setPh('menu')}}>MENU</button></div></div></div>)}
    </div></div>);
};

const CD=({onDone})=>{const[n,sn]=useState(3);useEffect(()=>{if(n<=0){onDone();return}const t2=setTimeout(()=>sn(v=>v-1),1000);return()=>clearTimeout(t2)},[n,onDone]);if(n<=0)return null;return(<div className="ov" style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'rgba(4,6,12,0.97)',zIndex:200}}><div className="cdn">{n}</div><div className="cdl">Initializing systems...</div></div>)};

export default RunningMan;
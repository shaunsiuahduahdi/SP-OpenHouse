import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useWebRTC } from './useWebRTC';
import { useHubRemote } from './hubListener';
import '../stylesheets/fruit.css';

const SIGNAL_URL='wss://system-reboot-signaling.onrender.com';

const COMPONENTS={
  battery:{label:'Battery',color:'#ffd740',stroke:'#F9A825'},
  resistor:{label:'Resistor',color:'#a1887f',stroke:'#6D4C41'},
  red_wire:{label:'Red Wire',color:'#ef5350',stroke:'#c62828'},
  blue_wire:{label:'Blue Wire',color:'#42a5f5',stroke:'#1565c0'},
  switch_comp:{label:'Switch',color:'#ab47bc',stroke:'#7b1fa2'},
  capacitor:{label:'Capacitor',color:'#26c6da',stroke:'#00838f'},
  led:{label:'LED',color:'#ff1744',stroke:'#c62828'},
  green_wire:{label:'Green Wire',color:'#66bb6a',stroke:'#2e7d32'},
};
const CIRCUIT_SEQUENCE=['battery','red_wire','switch_comp','resistor','blue_wire','led','green_wire'];
const ALL_TYPES=Object.keys(COMPONENTS);
const ORB_R=55,HIT_R=ORB_R+50,SPAWN_INT=1800,BOMB_CH=0.08;
const TRAIL_LEN=30,TRAIL_DUR=200,F_OFF_Y=140,F_OFF_X=75,SMOOTH=0.25,MIN_SC=0.3;
const Q_INTERVAL=25000; // question every ~25s
const Q_DURATION=6000;  // 6s to answer
const Q_HIT_R=90;       // answer orb hit radius

// ═══ TRIVIA QUESTIONS ═══
const QUESTIONS=[
  {q:"What year was SP founded?",l:"1954",r:"1968",c:"left"},
  {q:"SP campus is in?",l:"Dover",r:"Clementi",c:"left"},
  {q:"Nearest MRT to SP?",l:"Dover",r:"Buona Vista",c:"left"},
  {q:"SP was Singapore's first?",l:"Polytechnic",r:"University",c:"left"},
  {q:"LED stands for?",l:"Light Emitting Diode",r:"Laser Emission Device",c:"left"},
  {q:"Resistor unit?",l:"Ohm",r:"Volt",c:"left"},
  {q:"What stores charge?",l:"Capacitor",r:"Resistor",c:"left"},
  {q:"Current unit?",l:"Ampere",r:"Watt",c:"left"},
  {q:"SP logo primary color?",l:"Blue",r:"Orange",c:"right"},
  {q:"Number of schools in SP?",l:"10",r:"7",c:"right"},
  {q:"Battery provides?",l:"Voltage",r:"Resistance",c:"left"},
  {q:"Circuit must be?",l:"Closed loop",r:"Open ended",c:"left"},
];

const mkPlayer=()=>({objects:[],score:0,lives:5,combo:0,seqIndex:0,placed:new Set(),correctSlices:0,wrongSlices:0,
  round:1,circuitComplete:false,completeTime:0,lastSpawnTime:0,spawnInterval:SPAWN_INT,
  sLX:0,sLY:0,sRX:0,sRY:0,leftTrail:[],rightTrail:[],hands:{left:null,right:null},failed:false,
  // QnA
  qActive:false,qNote:null,qTimer:0,qAnswered:false,qResult:null,qResultT:0,qIdx:0,lastQTime:0,
  qObjL:null,qObjR:null});

const LEDFruitNinja=()=>{
  const vidRef=useRef(null),canRef=useRef(null),detRef=useRef(null),animRef=useRef(null);
  const G=useRef({players:[],cw:0,ch:0,f:0,running:false});
  const effRef=useRef([]);

  const[ph,setPh]=useState('load');const[statusMsg,setStatusMsg]=useState('Loading...');
  const[cam,setCam]=useState(false);const[mdl,setMdl]=useState(false);
  const[gameMode,setGameMode]=useState(null);const[countdown,setCountdown]=useState(null);
  const[hud,setHud]=useState([{sc:0,lives:5,combo:0,seq:0,round:1,placed:new Set(),complete:false}]);

  const{roomCode,connected,error:rtcErr,createRoom,joinRoom,send,onMessage,disconnect}=useWebRTC(SIGNAL_URL);
  const[mpMode,setMpMode]=useState(false);const[joinCode,setJoinCode]=useState('');
  const[oppScore,setOppScore]=useState(0);const[oppLives,setOppLives]=useState(5);
  const[oppResult,setOppResult]=useState(null);const[oppFailed,setOppFailed]=useState(false);
  const mpRef=useRef({lastSend:0});

  // ── HUB REMOTE — listen to master hub session if ?hub=XXXX in URL ──
  const hubCode=useHubRemote((cmd,data)=>{
    if(cmd==='selectMode'){
      const mode=data.mode;
      if(mode==='multi'){setGameMode('multi');setMpMode(true)}
      else{setGameMode(mode);startCountdown()}
    }
    if(cmd==='stop'){G.current.running=false;setPh('menu');setMpMode(false)}
    if(cmd==='restart'){startCountdown()}
    if(cmd==='backToMenu'){G.current.running=false;setMpMode(false);setPh('menu')}
    if(cmd==='backToHub'||cmd==='selectGame'){G.current.running=false;window.location.hash='#/home'}
  });

  useEffect(()=>{onMessage(msg=>{
    if(msg.type==='sync'){setOppScore(msg.sc||0);setOppLives(msg.lives||0)}
    if(msg.type==='done'){setOppResult(msg)}
    if(msg.type==='failed'){setOppFailed(true);setOppResult(msg);G.current.running=false;setTimeout(()=>setPh('results'),500)}
    if(msg.type==='start'){startCountdown()}
  })},[onMessage]); // eslint-disable-line

  const sfx=useRef({});
  useEffect(()=>{
    const mk=fn=>()=>{try{fn()}catch{}};
    sfx.current.slice=mk(()=>{const c=new(window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();o.connect(f);f.connect(g);g.connect(c.destination);o.type='sawtooth';o.frequency.setValueAtTime(800,c.currentTime);o.frequency.exponentialRampToValueAtTime(200,c.currentTime+.15);f.type='lowpass';f.frequency.setValueAtTime(2000,c.currentTime);g.gain.setValueAtTime(.2,c.currentTime);g.gain.exponentialRampToValueAtTime(.01,c.currentTime+.15);o.start(c.currentTime);o.stop(c.currentTime+.15)});
    sfx.current.wrong=mk(()=>{const c=new(window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='square';o.frequency.setValueAtTime(150,c.currentTime);o.frequency.exponentialRampToValueAtTime(80,c.currentTime+.3);g.gain.setValueAtTime(.15,c.currentTime);g.gain.exponentialRampToValueAtTime(.01,c.currentTime+.3);o.start(c.currentTime);o.stop(c.currentTime+.3)});
    sfx.current.bomb=mk(()=>{const c=new(window.AudioContext||window.webkitAudioContext)(),b=c.createBuffer(1,c.sampleRate*.3,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);const s=c.createBufferSource(),g=c.createGain(),f=c.createBiquadFilter();s.buffer=b;s.connect(f);f.connect(g);g.connect(c.destination);f.type='lowpass';f.frequency.setValueAtTime(1000,c.currentTime);f.frequency.exponentialRampToValueAtTime(100,c.currentTime+.3);g.gain.setValueAtTime(.4,c.currentTime);g.gain.exponentialRampToValueAtTime(.01,c.currentTime+.3);s.start(c.currentTime)});
    sfx.current.correct=mk(()=>{const c=new(window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.setValueAtTime(523,c.currentTime);o.frequency.exponentialRampToValueAtTime(784,c.currentTime+.12);g.gain.setValueAtTime(.15,c.currentTime);g.gain.exponentialRampToValueAtTime(.01,c.currentTime+.15);o.start(c.currentTime);o.stop(c.currentTime+.15)});
  },[]);

  useEffect(()=>{let s;(async()=>{try{s=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:false});if(vidRef.current){vidRef.current.srcObject=s;await new Promise(r=>{vidRef.current.onloadedmetadata=()=>{vidRef.current.play();r()}});setCam(true)}}catch{setStatusMsg('Camera access needed.')}})();return()=>{if(s)s.getTracks().forEach(t=>t.stop())}},[]);

  useEffect(()=>{if(!cam)return;let ok=true;(async()=>{try{await window.tf.setBackend('webgl');await window.tf.ready();const mt=gameMode==='dual'?window.poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING:window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING;const d=await window.poseDetection.createDetector(window.poseDetection.SupportedModels.MoveNet,{modelType:mt});if(ok){detRef.current=d;setMdl(true);if(ph==='load')setPh('menu')}}catch(e){console.error(e);try{const d2=await window.poseDetection.createDetector(window.poseDetection.SupportedModels.MoveNet,{modelType:window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING});if(ok){detRef.current=d2;setMdl(true);if(ph==='load')setPh('menu')}}catch{}}})();return()=>{ok=false}},[cam,gameMode]); // eslint-disable-line

  useEffect(()=>{if(!cam||!mdl||!detRef.current)return;let id,busy=false;const loop=async()=>{if(!busy&&vidRef.current?.readyState>=2){busy=true;try{
    const poses=await detRef.current.estimatePoses(vidRef.current);const g=G.current,vw=vidRef.current.videoWidth||640,vh=vidRef.current.videoHeight||480;
    const ext=(kps,ps)=>{const lw=kps[9],rw=kps[10];ps.hands.left=lw?.score>MIN_SC?{x:lw.x/vw,y:lw.y/vh}:null;ps.hands.right=rw?.score>MIN_SC?{x:rw.x/vw,y:rw.y/vh}:null};
    if(gameMode==='dual'&&poses.length>=2){const s2=poses.filter(p=>p.keypoints[5]?.score>.15&&p.keypoints[6]?.score>.15).map(p=>({p,mx:1-((p.keypoints[5].x+p.keypoints[6].x)/2)/vw})).sort((a,b)=>a.mx-b.mx);for(let i=0;i<Math.min(2,s2.length);i++){if(g.players[i])ext(s2[i].p.keypoints,g.players[i])}}
    else if(poses.length>0&&g.players[0])ext(poses[0].keypoints,g.players[0]);
  }catch{}busy=false}id=requestAnimationFrame(loop)};id=requestAnimationFrame(loop);return()=>cancelAnimationFrame(id)},[cam,mdl,gameMode]);

  const startCountdown=useCallback(()=>{const g=G.current;g.players=[];for(let i=0;i<(gameMode==='dual'?2:1);i++)g.players.push(mkPlayer());g.running=false;g.f=0;effRef.current=[];
    setHud(g.players.map(()=>({sc:0,lives:5,combo:0,seq:0,round:1,placed:new Set(),complete:false})));setOppScore(0);setOppLives(5);setOppResult(null);setOppFailed(false);
    let n=3;setCountdown(n);setPh('cd');const iv=setInterval(()=>{n--;if(n>0)setCountdown(n);else{clearInterval(iv);setCountdown(null);g.running=true;g.f=0;const now=Date.now();g.players.forEach(p=>{p.lastQTime=now});setPh('play')}},1000)},[gameMode]);
  const startGame=useCallback(()=>{if(gameMode==='multi'&&connected)send({type:'start'});startCountdown()},[gameMode,connected,send,startCountdown]);

  // ═══ DRAWING ═══
  const drawOrb=(ctx,obj)=>{
    const sz=obj.radius*2;ctx.save();ctx.translate(obj.x,obj.y);ctx.rotate(obj.rotation);
    ctx.shadowColor='rgba(0,0,0,0.5)';ctx.shadowBlur=12;ctx.shadowOffsetY=6;ctx.fillStyle=obj.color;ctx.strokeStyle=COMPONENTS[obj.type]?.stroke||'#555';ctx.lineWidth=3;
    if(obj.isBomb){ctx.beginPath();ctx.arc(0,0,obj.radius,0,Math.PI*2);ctx.fillStyle='rgba(40,40,40,0.9)';ctx.fill();ctx.lineWidth=10;ctx.strokeStyle='#c0392b';ctx.setLineDash([16,8]);ctx.stroke();ctx.setLineDash([]);ctx.shadowBlur=0;ctx.rotate(-obj.rotation);ctx.font=`${obj.radius*1.3}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('\u{1F4A5}',0,4)}
    else{switch(obj.type){
      case'battery':{const bw=sz,bh=sz*.6;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(-bw/2,-bh/2,bw,bh,8);else ctx.rect(-bw/2,-bh/2,bw,bh);ctx.fill();ctx.stroke();ctx.fillStyle='#F9A825';ctx.fillRect(bw/2-2,-8,10,16);ctx.shadowBlur=0;ctx.fillStyle='#333';ctx.font=`bold ${sz*.28}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('+ \u2212',-2,0);break}
      case'resistor':{const rw=sz,rh=sz*.45;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(-rw/2,-rh/2,rw,rh,7);else ctx.rect(-rw/2,-rh/2,rw,rh);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#999';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-rw/2,0);ctx.lineTo(-rw/2-14,0);ctx.stroke();ctx.beginPath();ctx.moveTo(rw/2,0);ctx.lineTo(rw/2+14,0);ctx.stroke();[['#8B4513',-.28],['#111',-.06],['#FF6F00',.16],['#ffd740',.3]].forEach(([col,p])=>{ctx.fillStyle=col;ctx.fillRect(rw*p-3,-rh/2,6,rh)});break}
      case'led':{const r2=sz*.42;ctx.beginPath();ctx.arc(0,-4,r2,Math.PI,0);ctx.lineTo(r2,r2*.5);ctx.lineTo(-r2,r2*.5);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#bbb';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-6,r2*.5);ctx.lineTo(-6,r2*.5+18);ctx.moveTo(6,r2*.5);ctx.lineTo(6,r2*.5+22);ctx.stroke();break}
      case'red_wire':case'blue_wire':case'green_wire':{ctx.shadowBlur=0;ctx.strokeStyle=obj.color;ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-sz/2,0);ctx.bezierCurveTo(-sz/4,-14,sz/4,14,sz/2,0);ctx.stroke();ctx.fillStyle=obj.color;ctx.beginPath();ctx.arc(-sz/2,0,7,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(sz/2,0,7,0,Math.PI*2);ctx.fill();break}
      case'switch_comp':{const sw=sz*.7,sh=sz*.45;ctx.fillStyle='#444';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(-sw/2,-sh/2,sw,sh,8);else ctx.rect(-sw/2,-sh/2,sw,sh);ctx.fill();ctx.stroke();ctx.fillStyle=obj.color;ctx.fillRect(2,-sh/2+4,sw/2-6,sh-8);ctx.shadowBlur=0;ctx.fillStyle='#ccc';ctx.beginPath();ctx.arc(-sw/2-6,0,4,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(sw/2+6,0,4,0,Math.PI*2);ctx.fill();break}
      case'capacitor':{const cw2=sz*.4,ch2=sz*.65;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(-cw2/2,-ch2/2,cw2,ch2,6);else ctx.rect(-cw2/2,-ch2/2,cw2,ch2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.font=`bold ${sz*.16}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('100\u03BCF',0,0);break}
      default:{ctx.beginPath();ctx.arc(0,0,sz*.4,0,Math.PI*2);ctx.fill();ctx.stroke()}}
      ctx.shadowBlur=0;ctx.rotate(-obj.rotation);ctx.font=`bold ${Math.max(16,sz*.18)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(255,255,255,0.8)';ctx.fillText(obj.label,0,obj.radius+20)}
    ctx.restore()};

  const drawTrail=(ctx,trail,color)=>{if(trail.length<3)return;const now=Date.now();const recent=trail.filter(p=>now-p.time<TRAIL_DUR);if(recent.length<3)return;
    const rr=parseInt(color.slice(1,3),16),gg=parseInt(color.slice(3,5),16),bb=parseInt(color.slice(5,7),16);
    ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(recent[0].x,recent[0].y);for(let i=1;i<recent.length-1;i++){const xc=(recent[i].x+recent[i+1].x)/2,yc=(recent[i].y+recent[i+1].y)/2;ctx.quadraticCurveTo(recent[i].x,recent[i].y,xc,yc)}ctx.strokeStyle=`rgba(${rr},${gg},${bb},0.35)`;ctx.lineWidth=50;ctx.stroke();
    for(let i=1;i<recent.length;i++){const age=now-recent[i].time;const alpha=1-age/TRAIL_DUR;ctx.beginPath();ctx.moveTo(recent[i-1].x,recent[i-1].y);ctx.lineTo(recent[i].x,recent[i].y);ctx.strokeStyle=color;ctx.globalAlpha=alpha*.85;ctx.lineWidth=26*alpha+6;ctx.stroke()}
    if(recent.length>0){const tip=recent[recent.length-1];ctx.globalAlpha=1;ctx.beginPath();ctx.arc(tip.x,tip.y,46,0,Math.PI*2);ctx.fillStyle=`rgba(${rr},${gg},${bb},0.35)`;ctx.fill();ctx.beginPath();ctx.arc(tip.x,tip.y,36,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.beginPath();ctx.arc(tip.x,tip.y,30,0,Math.PI*2);ctx.fillStyle=color;ctx.fill()}ctx.globalAlpha=1};

  const drawSliceEff=(ctx,e)=>{const p=(Date.now()-e.startTime)/e.duration;if(p>=1)return false;ctx.save();ctx.globalAlpha=1-p;
    if(e.isWrong){ctx.fillStyle='#e74c3c';ctx.font='900 100px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('X',e.x,e.y-p*60)}
    else{const r2=70+p*100;ctx.beginPath();ctx.arc(e.x,e.y,r2,0,Math.PI*2);ctx.strokeStyle=e.color;ctx.lineWidth=10*(1-p);ctx.stroke();for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2,d=50+p*80;ctx.beginPath();ctx.arc(e.x+Math.cos(a)*d,e.y+Math.sin(a)*d,7*(1-p),0,Math.PI*2);ctx.fillStyle=e.color;ctx.fill()}}
    ctx.restore();return true};

  // ═══ DRAW ANSWER ORB — big glowing answer bubble ═══
  const drawAnswerOrb=(ctx,x,y,text,color,borderColor,pulse)=>{
    const r=70,p=pulse?1+Math.sin(Date.now()*.005)*.06:1;
    ctx.save();
    // Glow
    ctx.shadowColor=color;ctx.shadowBlur=30;
    ctx.beginPath();ctx.arc(x,y,r*p,0,Math.PI*2);ctx.fillStyle=color+'22';ctx.fill();
    // Border ring
    ctx.beginPath();ctx.arc(x,y,r*p,0,Math.PI*2);ctx.strokeStyle=borderColor;ctx.lineWidth=5;ctx.stroke();
    // Body
    ctx.shadowBlur=0;ctx.beginPath();ctx.arc(x,y,(r-4)*p,0,Math.PI*2);ctx.fillStyle=color+'CC';ctx.fill();
    // Highlight
    ctx.beginPath();ctx.arc(x-15,y-15,r*.3,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.2)';ctx.fill();
    // Text
    ctx.fillStyle='#fff';ctx.font=`bold ${Math.min(22,Math.max(14,320/Math.max(text.length,1)))}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    // Word wrap if long
    if(text.length>12){const words=text.split(' ');const mid=Math.ceil(words.length/2);ctx.fillText(words.slice(0,mid).join(' '),x,y-10);ctx.fillText(words.slice(mid).join(' '),x,y+12)}
    else ctx.fillText(text,x,y);
    ctx.restore()};

  // ═══ GAME LOOP ═══
  useEffect(()=>{
    if(ph!=='play')return;
    const can=canRef.current,ctx=can.getContext('2d'),g=G.current,effects=effRef.current;
    const rsz=()=>{can.width=window.innerWidth;can.height=window.innerHeight;g.cw=can.width;g.ch=can.height};
    rsz();window.addEventListener('resize',rsz);
    const pCount=g.players.length,isDual=pCount===2;

    const hudIv=setInterval(()=>{
      setHud(g.players.map(ps=>({sc:ps.score,lives:ps.lives,combo:ps.combo,seq:ps.seqIndex,round:ps.round,placed:new Set(ps.placed),complete:ps.circuitComplete})));
      if(gameMode==='multi'){const ps=g.players[0];if(ps&&g.f-mpRef.current.lastSend>8){mpRef.current.lastSend=g.f;send({type:'sync',sc:ps.score,lives:ps.lives})}}
    },100);

    const spawnObj=(ps,pw,pOff,h)=>{
      if(ps.circuitComplete||ps.objects.length>=4||ps.qActive)return;
      const needed=CIRCUIT_SEQUENCE[ps.seqIndex];
      let sx=pOff+100+Math.random()*(pw-200),sy=h+50,tx=pOff+pw/2+(Math.random()-.5)*200,ty=-200-Math.random()*200;
      const dx=tx-sx,dy=ty-sy,dist=Math.sqrt(dx*dx+dy*dy),spd=14+Math.random()*3;
      const vx=(dx/dist)*spd,vy=(dy/dist)*spd;
      const count=1+Math.floor(Math.random()*2),types=[needed];
      for(let i=1;i<count;i++){if(Math.random()<BOMB_CH)types.push('__bomb__');else{let d2;do{d2=ALL_TYPES[Math.floor(Math.random()*ALL_TYPES.length)]}while(d2===needed);types.push(d2)}}
      types.sort(()=>Math.random()-.5);
      types.forEach((type,i)=>{const ox=(i-(count-1)/2)*Math.min(280,pw*.4),oy=i*40;const isB=type==='__bomb__';const comp=isB?null:COMPONENTS[type];
        ps.objects.push({id:Date.now()+Math.random(),type:isB?'bomb':type,isBomb:isB,color:isB?'#333':comp.color,label:isB?'BOMB':comp.label,x:sx+ox,y:sy+oy,vx:vx+(Math.random()-.5)*2,vy:vy+(Math.random()-.5),gravity:.12,radius:ORB_R,rotation:0,rotationSpeed:(Math.random()-.5)*.3,hit:false})})};

    let raf;
    const loop=()=>{
      if(!g.running){raf=requestAnimationFrame(loop);return}
      g.f++;const w=can.width,h=can.height,now=Date.now();
      ctx.clearRect(0,0,w,h);
      if(vidRef.current?.readyState>=2){const vw=vidRef.current.videoWidth,vh=vidRef.current.videoHeight,va=vw/vh,ca=w/h;let dw,dh,ox,oy;if(ca>va){dw=w;dh=w/va;ox=0;oy=(h-dh)/2}else{dh=h;dw=h*va;ox=(w-dw)/2;oy=0}ctx.save();ctx.translate(w,0);ctx.scale(-1,1);ctx.drawImage(vidRef.current,w-ox-dw,oy,dw,dh);ctx.restore();ctx.fillStyle='rgba(0,0,0,0.2)';ctx.fillRect(0,0,w,h)}
      if(isDual){ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.stroke()}

      let allDone=true;
      for(let pi=0;pi<pCount;pi++){
        const ps=g.players[pi];if(ps.failed)continue;
        const pw=isDual?w/2:w,pOff=isDual?pi*pw:0;
        ctx.save();if(isDual){ctx.beginPath();ctx.rect(pOff,0,pw,h);ctx.clip()}

        const mapX=nx=>pOff+(1-nx)*(isDual?w:w);const mapY=ny=>ny*h;
        let lx=0,ly=0,lV=false,rx=0,ry=0,rV=false;
        if(ps.hands.left){const rX=mapX(ps.hands.left.x)+F_OFF_X,rY=mapY(ps.hands.left.y)-F_OFF_Y;ps.sLX+=(rX-ps.sLX)*SMOOTH;ps.sLY+=(rY-ps.sLY)*SMOOTH;lx=ps.sLX;ly=ps.sLY;lV=true;ps.leftTrail.push({x:lx,y:ly,time:now});if(ps.leftTrail.length>TRAIL_LEN)ps.leftTrail.shift()}
        if(ps.hands.right){const rX=mapX(ps.hands.right.x)-F_OFF_X,rY=mapY(ps.hands.right.y)-F_OFF_Y;ps.sRX+=(rX-ps.sRX)*SMOOTH;ps.sRY+=(rY-ps.sRY)*SMOOTH;rx=ps.sRX;ry=ps.sRY;rV=true;ps.rightTrail.push({x:rx,y:ry,time:now});if(ps.rightTrail.length>TRAIL_LEN)ps.rightTrail.shift()}
        drawTrail(ctx,ps.leftTrail,'#ef5350');drawTrail(ctx,ps.rightTrail,'#42a5f5');

        // ══════════════════════════════════════════
        // QNA MODE — question with two answer orbs
        // ══════════════════════════════════════════
        if(ps.qActive&&!ps.qAnswered){
          ps.qTimer++;
          const qn=ps.qNote,cx=pOff+pw/2;
          const lOrbX=pOff+pw*0.22,rOrbX=pOff+pw*0.78,orbY=h*0.55;

          // Dark overlay
          ctx.fillStyle='rgba(0,0,10,0.85)';ctx.fillRect(pOff,0,pw,h);
          // Left tint
          const lg=ctx.createLinearGradient(pOff,0,cx,0);lg.addColorStop(0,'rgba(30,100,220,0.15)');lg.addColorStop(1,'transparent');ctx.fillStyle=lg;ctx.fillRect(pOff,0,pw/2,h);
          // Right tint
          const rg=ctx.createLinearGradient(pOff+pw,0,cx,0);rg.addColorStop(0,'rgba(220,50,50,0.15)');rg.addColorStop(1,'transparent');ctx.fillStyle=rg;ctx.fillRect(cx,0,pw/2,h);

          // Question text
          ctx.font=`900 ${isDual?28:48}px sans-serif`;ctx.textAlign='center';ctx.fillStyle='#fff';
          ctx.shadowColor='rgba(0,0,0,0.5)';ctx.shadowBlur=8;ctx.fillText(qn.q,cx,h*0.22);ctx.shadowBlur=0;

          // "SLICE THE ANSWER" subtitle
          ctx.font=`600 ${isDual?14:20}px sans-serif`;ctx.fillStyle='rgba(255,255,255,0.3)';ctx.fillText('SLICE THE CORRECT ANSWER',cx,h*0.30);

          // Timer bar
          const elapsed=now-(ps.lastQTime+Q_INTERVAL);const qPct=Math.max(0,1-ps.qTimer/((Q_DURATION)/16.67));
          ctx.fillStyle='rgba(255,255,255,0.06)';ctx.fillRect(cx-pw*0.2,h*0.34,pw*0.4,6);
          ctx.fillStyle=qPct>0.3?'#42a5f5':'#ef5350';ctx.fillRect(cx-pw*0.2,h*0.34,pw*0.4*qPct,6);

          // Draw answer orbs
          drawAnswerOrb(ctx,lOrbX,orbY,qn.l,'#2962FF','#448AFF',true);
          drawAnswerOrb(ctx,rOrbX,orbY,qn.r,'#C62828','#EF5350',true);

          // Labels under orbs
          ctx.font=`bold ${isDual?12:16}px sans-serif`;ctx.textAlign='center';
          ctx.fillStyle='rgba(100,160,255,0.5)';ctx.fillText('LEFT',lOrbX,orbY+90);
          ctx.fillStyle='rgba(255,100,100,0.5)';ctx.fillText('RIGHT',rOrbX,orbY+90);

          // Hand collision with answer orbs
          const hands=[];if(lV)hands.push({x:lx,y:ly});if(rV)hands.push({x:rx,y:ry});
          hands.forEach(hand=>{
            const dL=Math.sqrt((hand.x-lOrbX)**2+(hand.y-orbY)**2);
            const dR=Math.sqrt((hand.x-rOrbX)**2+(hand.y-orbY)**2);
            if(dL<Q_HIT_R){ps.qAnswered=true;const ok=qn.c==='left';ps.qResult=ok?'correct':'wrong';ps.qResultT=g.f;
              if(ok){ps.score+=200;ps.combo++;sfx.current.correct?.();effects.push({x:lOrbX,y:orbY,color:'#42a5f5',isWrong:false,startTime:now,duration:500})}
              else{ps.lives--;ps.combo=0;sfx.current.wrong?.();effects.push({x:lOrbX,y:orbY,color:'#e74c3c',isWrong:true,startTime:now,duration:700});if(ps.lives<=0){ps.failed=true;if(gameMode==='multi')send({type:'failed',sc:ps.score})}}}
            if(!ps.qAnswered&&dR<Q_HIT_R){ps.qAnswered=true;const ok=qn.c==='right';ps.qResult=ok?'correct':'wrong';ps.qResultT=g.f;
              if(ok){ps.score+=200;ps.combo++;sfx.current.correct?.();effects.push({x:rOrbX,y:orbY,color:'#ef5350',isWrong:false,startTime:now,duration:500})}
              else{ps.lives--;ps.combo=0;sfx.current.wrong?.();effects.push({x:rOrbX,y:orbY,color:'#e74c3c',isWrong:true,startTime:now,duration:700});if(ps.lives<=0){ps.failed=true;if(gameMode==='multi')send({type:'failed',sc:ps.score})}}}
          });

          // Timeout
          if(!ps.qAnswered&&ps.qTimer>Q_DURATION/16.67){ps.qAnswered=true;ps.qResult='wrong';ps.qResultT=g.f;ps.lives--;ps.combo=0;sfx.current.wrong?.();if(ps.lives<=0){ps.failed=true;if(gameMode==='multi')send({type:'failed',sc:ps.score})}}

          // Draw hand cursors during question
          hands.forEach(hd=>{ctx.beginPath();ctx.arc(hd.x,hd.y,28,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.4)';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke()});

          ctx.restore();allDone=false;continue;
        }
        // Q result flash
        if(ps.qActive&&ps.qAnswered){const age=g.f-ps.qResultT;if(age<35){
          ctx.fillStyle='rgba(0,0,10,0.8)';ctx.fillRect(pOff,0,pw,h);
          ctx.font=`900 ${isDual?44:72}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
          ctx.fillStyle=ps.qResult==='correct'?'#66bb6a':'#ef5350';ctx.globalAlpha=1-age/35;
          ctx.fillText(ps.qResult==='correct'?'CORRECT!':'WRONG!',pOff+pw/2,h/2-20);
          if(ps.qResult==='correct'){ctx.font=`700 ${isDual?18:28}px sans-serif`;ctx.fillStyle='rgba(102,187,106,0.6)';ctx.fillText('+200',pOff+pw/2,h/2+30)}
          else{ctx.font=`700 ${isDual?14:20}px sans-serif`;ctx.fillStyle='rgba(239,83,80,0.5)';ctx.fillText('-1 LIFE',pOff+pw/2,h/2+30)}
          ctx.globalAlpha=1;ctx.textBaseline='alphabetic';ctx.restore();allDone=false;continue}
          else{ps.qActive=false;ps.qNote=null;ps.qAnswered=false;ps.lastQTime=now}}

        // ── Check if it's time for a question ──
        if(!ps.qActive&&!ps.circuitComplete&&now-ps.lastQTime>Q_INTERVAL&&ps.seqIndex>0){
          const q=QUESTIONS[ps.qIdx%QUESTIONS.length];ps.qIdx++;
          ps.qActive=true;ps.qNote=q;ps.qTimer=0;ps.qAnswered=false;ps.qResult=null;
          ps.objects=[];// clear flying objects during question
        }

        // Spawn
        if(!ps.qActive&&now-ps.lastSpawnTime>ps.spawnInterval&&!ps.circuitComplete){spawnObj(ps,pw,pOff,h);ps.lastSpawnTime=now}

        // Update objects
        ps.objects=ps.objects.filter(obj=>{if(obj.hit)return false;obj.vy+=obj.gravity;obj.x+=obj.vx;obj.y+=obj.vy;obj.rotation+=obj.rotationSpeed;
          if(obj.y>h+150||obj.x<pOff-150||obj.x>pOff+pw+150){if(!obj.isBomb&&obj.y>h+100){ps.lives--;if(ps.lives<=0){ps.failed=true;if(gameMode==='multi')send({type:'failed',sc:ps.score})}}return false}drawOrb(ctx,obj);return true});

        // Collision
        const hands2=[];if(lV)hands2.push({x:lx,y:ly});if(rV)hands2.push({x:rx,y:ry});
        ps.objects.forEach(obj=>{if(obj.hit)return;hands2.forEach(hand=>{const dx=hand.x-obj.x,dy=hand.y-obj.y;if(Math.sqrt(dx*dx+dy*dy)<HIT_R){obj.hit=true;
          if(obj.isBomb){ps.lives--;ps.combo=0;effects.push({x:obj.x,y:obj.y,color:'#e74c3c',isWrong:true,startTime:now,duration:700});sfx.current.bomb?.();if(ps.lives<=0){ps.failed=true;if(gameMode==='multi')send({type:'failed',sc:ps.score})}}
          else if(obj.type===CIRCUIT_SEQUENCE[ps.seqIndex]){ps.placed.add(obj.type);ps.seqIndex++;ps.combo++;ps.score+=10*(1+Math.floor(ps.combo*.5));ps.correctSlices++;effects.push({x:obj.x,y:obj.y,color:obj.color,isWrong:false,startTime:now,duration:500});sfx.current.slice?.();ps.spawnInterval=Math.max(1200,SPAWN_INT-ps.seqIndex*40);if(ps.seqIndex>=CIRCUIT_SEQUENCE.length){ps.circuitComplete=true;ps.completeTime=now;ps.score+=500}}
          else{ps.lives--;ps.combo=0;ps.wrongSlices++;effects.push({x:obj.x,y:obj.y,color:'#e74c3c',isWrong:true,startTime:now,duration:700});sfx.current.wrong?.();if(ps.lives<=0){ps.failed=true;if(gameMode==='multi')send({type:'failed',sc:ps.score})}}}})});

        for(let i=effects.length-1;i>=0;i--){if(!drawSliceEff(ctx,effects[i]))effects.splice(i,1)}

        // Circuit complete
        if(ps.circuitComplete){const el=now-ps.completeTime;const fade=Math.min(1,el/600);ctx.fillStyle=`rgba(0,0,0,${fade*.45})`;ctx.fillRect(pOff,0,pw,h);
          if(el>500){const ta=Math.min(1,(el-500)/400);ctx.globalAlpha=ta;ctx.font=`900 ${isDual?36:64}px sans-serif`;ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText('CIRCUIT COMPLETE!',pOff+pw/2,h/2-30);ctx.font=`700 ${isDual?20:32}px sans-serif`;ctx.fillStyle='#ff1744';ctx.fillText('\u{1F4A1} LED is ON!',pOff+pw/2,h/2+20);ctx.globalAlpha=1}
          if(el>3500){ps.seqIndex=0;ps.placed=new Set();ps.circuitComplete=false;ps.completeTime=0;ps.objects=[];ps.spawnInterval=SPAWN_INT;ps.lastSpawnTime=now-SPAWN_INT+200;ps.round++}}

        if(ps.failed){ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(pOff,0,pw,h);ctx.font=`bold ${isDual?40:60}px sans-serif`;ctx.textAlign='center';ctx.fillStyle='#ff3355';ctx.fillText('GAME OVER',pOff+pw/2,h/2)}
        if(!ps.failed&&!ps.circuitComplete)allDone=false;
        ctx.restore()}

      if(g.players.every(p=>p.failed)){g.running=false;if(gameMode==='multi'){const ps=g.players[0];send({type:ps.failed?'failed':'done',sc:ps.score})}setTimeout(()=>setPh('results'),500)}
      raf=requestAnimationFrame(loop)};
    raf=requestAnimationFrame(loop);
    return()=>{window.removeEventListener('resize',rsz);clearInterval(hudIv);cancelAnimationFrame(raf)};
  },[ph]); // eslint-disable-line

  const p0=G.current.players[0]||mkPlayer();

  return(
    <div className="lfn"><div className="game-container">
      <video ref={vidRef} className="video-hidden" playsInline autoPlay muted/>
      <canvas ref={canRef} className="game-canvas"/>

      {ph==='play'&&(<>{(gameMode==='dual'?[0,1]:[0]).map(pi=>{const h2=hud[pi]||{sc:0,lives:5,combo:0,seq:0,round:1,placed:new Set(),complete:false};const needed=CIRCUIT_SEQUENCE[h2.seq]||CIRCUIT_SEQUENCE[0];const nc=COMPONENTS[needed];
        return<div key={pi} style={{position:'absolute',top:0,[pi===1?'right':'left']:0,width:gameMode==='dual'?'50%':'100%',zIndex:50,pointerEvents:'none'}}>
          {!h2.complete&&<div className="target-banner-top" style={{left:'50%',transform:'translateX(-50%)'}}><div className="target-dot" style={{background:nc.color}}/><div className="target-text">SLICE: {nc.label.toUpperCase()}</div></div>}
          <div style={{display:'flex',justifyContent:'space-between',padding:'12px 16px',alignItems:'flex-start'}}>
            <div><div style={{fontSize:28,fontWeight:900,color:'#fff'}}>{h2.sc}</div>
              <div>{[0,1,2,3,4].map(i=><span key={i} style={{fontSize:20,color:i<h2.lives?'#ef5350':'#333',marginRight:2}}>{i<h2.lives?'\u2764':'\u2661'}</span>)}</div>
              {h2.combo>1&&<div style={{fontSize:20,fontWeight:900,color:'#ffd740'}}>{h2.combo}x COMBO</div>}</div>
            <div style={{textAlign:'right'}}><div style={{fontSize:14,color:'#888',background:'rgba(0,0,0,0.4)',borderRadius:8,padding:'4px 10px'}}>Step {Math.min(h2.seq+1,CIRCUIT_SEQUENCE.length)}/{CIRCUIT_SEQUENCE.length}</div>
              <div style={{fontSize:12,color:'#666',marginTop:4}}>Round {h2.round}</div>
              {gameMode==='dual'&&<div style={{color:'rgba(255,255,255,0.3)',fontSize:11,letterSpacing:2,marginTop:4}}>P{pi+1}</div>}</div>
          </div></div>})}</>)}

      {ph==='play'&&gameMode==='multi'&&<div style={{position:'absolute',top:60,right:20,background:'rgba(0,0,0,0.5)',borderRadius:10,padding:'8px 14px',border:'1px solid rgba(255,100,100,0.3)',zIndex:50}}><div style={{color:'#ff6666',fontSize:11,letterSpacing:2,fontWeight:700}}>OPPONENT</div><div style={{color:'#fff',fontSize:22,fontWeight:900}}>{oppScore}</div><div style={{color:'#aaa',fontSize:12}}>{oppLives} lives</div></div>}

      {ph==='load'&&<div className="overlay"><div className="loading-spinner"/><div className="loading-text">{statusMsg}</div></div>}
      {ph==='cd'&&countdown&&<div className="overlay"><div className="countdown">{countdown}</div></div>}

      {ph==='menu'&&!mpMode&&(<div className="overlay"><div className="start-content">
        <h1 className="start-title"><span>LED</span> Fruit Ninja</h1>
        <p className="start-subtitle">Slice components to build a circuit! Trivia questions test your knowledge.</p>
        <button className="start-button" onClick={()=>{setGameMode('single');startCountdown()}}>SINGLE PLAYER \u25B6</button>
        <div style={{display:'flex',gap:10,marginTop:10,width:'100%',maxWidth:340}}>
          <button className="start-button" style={{flex:1,background:'linear-gradient(135deg,#ef5350,#ff6644)',fontSize:16,padding:'14px 0'}} onClick={()=>{setGameMode('multi');setMpMode(true)}}>ONLINE</button>
          <button className="start-button" style={{flex:1,background:'linear-gradient(135deg,#7c4dff,#448aff)',fontSize:16,padding:'14px 0'}} onClick={()=>{setGameMode('dual');startCountdown()}}>DUAL</button>
        </div></div></div>)}

      {mpMode&&ph==='menu'&&(<div className="overlay"><div className="start-content" style={{maxWidth:360}}>
        <h2 style={{color:'#ef5350',fontSize:24,letterSpacing:3}}>MULTIPLAYER</h2>
        {!connected?(<><button className="start-button" onClick={createRoom}>CREATE ROOM</button><div style={{color:'#556',margin:'12px 0',fontSize:13}}>or</div>
          <div style={{display:'flex',gap:8,width:'100%'}}><input style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'10px 14px',color:'#fff',fontSize:18,letterSpacing:6,textAlign:'center',textTransform:'uppercase'}} placeholder="CODE" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={4}/><button className="start-button" style={{padding:'10px 20px'}} onClick={()=>joinRoom(joinCode)}>JOIN</button></div>
          {roomCode&&<div style={{color:'#42a5f5',fontSize:28,fontWeight:900,letterSpacing:8,margin:'16px 0'}}>{roomCode}</div>}{rtcErr&&<div style={{color:'#ef5350',fontSize:12,marginTop:8}}>{rtcErr}</div>}
        </>):(<><div style={{color:'#66bb6a',fontSize:16,marginBottom:12}}>OPPONENT CONNECTED \u2713</div><button className="start-button" onClick={startGame}>START</button></>)}
        <button style={{marginTop:12,background:'none',border:'1px solid #333',borderRadius:8,padding:'8px 20px',color:'#888',cursor:'pointer'}} onClick={()=>{setMpMode(false);disconnect()}}>CANCEL</button>
      </div></div>)}

      {ph==='results'&&(<div className="overlay"><div className="results-content">
        {gameMode==='dual'?(<><h2 className="results-title">Results</h2>
          <div style={{display:'flex',gap:20,width:'100%',maxWidth:500}}>{G.current.players.map((ps,pi)=><div key={pi} style={{flex:1,background:'rgba(255,255,255,0.03)',borderRadius:12,padding:16,border:`1px solid ${pi===0?'rgba(239,83,80,0.3)':'rgba(66,165,245,0.3)'}`}}>
            <div style={{color:pi===0?'#ef5350':'#42a5f5',fontSize:14,letterSpacing:2,fontWeight:700,marginBottom:8}}>PLAYER {pi+1}</div>
            <div style={{fontSize:36,fontWeight:900,color:'#fff'}}>{ps.score}</div>
            <div style={{color:'#aaa',fontSize:13}}>Round {ps.round}</div>
            {ps.failed&&<div style={{color:'#ff3355',fontWeight:700,marginTop:4}}>FAILED</div>}
          </div>)}</div>
          {(()=>{const s0=G.current.players[0]?.score||0,s1=G.current.players[1]?.score||0,f0=G.current.players[0]?.failed,f1=G.current.players[1]?.failed;const wn=f0&&!f1?'P2':f1&&!f0?'P1':s0>s1?'P1':s1>s0?'P2':'TIE';return<div style={{color:wn==='TIE'?'#ffd740':'#66bb6a',fontSize:28,fontWeight:900,letterSpacing:4,marginTop:16}}>{wn==='TIE'?'TIE!':wn+' WINS!'}</div>})()}
        </>):(<>
          {gameMode==='multi'&&(oppFailed||oppResult)&&<div style={{fontSize:28,fontWeight:900,color:oppFailed||(oppResult&&p0.score>oppResult.sc)?'#66bb6a':oppResult&&p0.score<oppResult.sc?'#ef5350':'#ffd740',letterSpacing:4,marginBottom:12}}>{oppFailed?'OPPONENT FAILED — YOU WIN!':oppResult&&p0.score>oppResult.sc?'YOU WIN!':oppResult&&p0.score<oppResult.sc?'YOU LOSE':'TIE'}</div>}
          <h2 className="results-title">Game Over</h2><div className="final-score-value">{p0.score}</div><div className="final-score-label">Points</div>
          <div style={{color:'#888',fontSize:14,marginTop:8}}>Round {p0.round}</div>
          {gameMode==='multi'&&oppResult&&<div style={{marginTop:16,padding:'12px 16px',background:'rgba(255,100,100,0.08)',borderRadius:10,border:'1px solid rgba(255,100,100,0.15)'}}><div style={{color:'#ef5350',fontSize:11,letterSpacing:2}}>OPPONENT</div><div style={{color:'#fff',fontSize:18,fontWeight:900}}>{oppResult.sc}</div></div>}
        </>)}
        <button className="play-again-btn" onClick={()=>{setMpMode(false);disconnect();setPh('menu')}}>PLAY AGAIN</button>
      </div></div>)}
    </div></div>);
};

export default LEDFruitNinja;
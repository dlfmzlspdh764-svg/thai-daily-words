(function(){
'use strict';
const W = window.WORDS, N = W.length;
const $ = s => document.querySelector(s);
const LS = {get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}}, set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
let learned = new Set(LS.get('learned',[]));
let perDay = LS.get('perDay',5);
const BASE = Date.UTC(2026,9,18)/864e5; // 2026-10-18 = 1일차

// 결정적 셔플 (고정 시드)
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const ORDER = (()=>{const r=mulberry32(20261018),o=[...Array(N).keys()];for(let i=N-1;i>0;i--){const j=Math.floor(r()*(i+1));[o[i],o[j]]=[o[j],o[i]]}return o})();

function seoulToday(){const s=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d)/864e5}
const TODAY = seoulToday();
let day = TODAY;
function wordsFor(dn){const idx=dn-BASE,out=[];for(let k=0;k<perDay;k++){const p=((idx*perDay+k)%N+N)%N;out.push(W[ORDER[p]])}return out}
function fmt(dn){const d=new Date(dn*864e5);const wd='일월화수목금토'[d.getUTCDay()];return `${d.getUTCFullYear()}년 ${d.getUTCMonth()+1}월 ${d.getUTCDate()}일 (${wd})`}

// ===== 오디오 =====
let cur=null, curBtn=null;
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,2200)}
function speakFallback(text,slow){
  if(!('speechSynthesis' in window)){toast('이 기기에서는 음성을 재생할 수 없어요');return}
  speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='th-TH';u.rate=slow?0.6:0.95;
  const v=speechSynthesis.getVoices().find(v=>/^th/i.test(v.lang));if(v)u.voice=v;else toast('태국어 TTS 음성이 없을 수 있어요');
  speechSynthesis.speak(u);
}
function play(key,text,slow,btn){
  if(cur){cur.pause();cur=null}if(curBtn)curBtn.classList.remove('playing');
  const a=new Audio(`audio/${key}_${slow?'s':'n'}.mp3`);cur=a;curBtn=btn||null;if(btn)btn.classList.add('playing');
  const done=()=>{if(btn)btn.classList.remove('playing')};
  let fell=false;const fb=()=>{if(fell)return;fell=true;done();speakFallback(text,slow)};
  a.onended=done;a.onerror=fb;
  a.play().catch(e=>{if(e&&e.name==='NotAllowedError'){done();return}fb()});
}
window.speechSynthesis&&speechSynthesis.getVoices();

// ===== 오늘의 단어 =====
function esc(s){return s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function card(w,i){
  const L=learned.has(w.id);
  return `<div class="card ${L?'learned':''}" data-id="${w.id}">
   <div class="head"><span class="num">${i+1}</span><span class="cat">${esc(w.cat)}</span></div>
   <div class="thai" data-play="w" lang="th">${esc(w.th)}</div>
   <div class="rom">${esc(w.rom)}</div><div class="kor">🔊 ${esc(w.ko)}</div>
   <div class="mean">${esc(w.mean)}</div>
   <div class="btns"><button data-play="w">▶ 보통</button><button class="slow" data-play="w" data-slow="1">🐢 느림</button></div>
   <div class="ex" data-play="e">
     <div class="th" lang="th">${esc(w.ex.th)}</div><div class="r">${esc(w.ex.rom)}</div><div class="k">${esc(w.ex.ko)}</div>
   </div>
   <div class="btns"><button data-play="e">▶ 예문 보통</button><button class="slow" data-play="e" data-slow="1">🐢 예문 느림</button></div>
   <button class="learnbtn">${L?'✔ 외웠어요':'☐ 외웠어요로 표시'}</button></div>`;
}
function renderToday(){
  const ws=wordsFor(day);
  $('#dateText').textContent=fmt(day)+(day===TODAY?' · 오늘':'');
  const n=day-BASE+1;$('#dayInfo').textContent=(n>=1?`${n}일차`:'시작 전')+` · 외운 단어 ${learned.size}/${N}`;
  $('#cards').innerHTML=ws.map(card).join('');
  $('#todayBtn').style.visibility=day===TODAY?'hidden':'visible';
}
$('#cards').addEventListener('click',e=>{
  const c=e.target.closest('.card');if(!c)return;const w=W[+c.dataset.id];
  if(e.target.closest('.learnbtn')){learned.has(w.id)?learned.delete(w.id):learned.add(w.id);LS.set('learned',[...learned]);renderToday();return}
  const p=e.target.closest('[data-play]');if(!p)return;
  const slow=!!p.dataset.slow, isW=p.dataset.play==='w';
  play(isW?w.a:w.ea,isW?w.th:w.ex.th,slow,p.tagName==='BUTTON'?p:null);
});
$('#prev').onclick=()=>{day--;renderToday()};$('#next').onclick=()=>{day++;renderToday()};
$('#todayBtn').onclick=()=>{day=TODAY;renderToday()};
$('#perDay').value=String(perDay);$('#perDay').onchange=e=>{perDay=+e.target.value;LS.set('perDay',perDay);renderToday()};

// ===== 퀴즈 =====
let score=LS.get('score',{r:0,t:0});
function pool(){
  const s=$('#quizScope').value;
  if(s==='learned'){const p=W.filter(w=>learned.has(w.id));if(p.length>=4)return p;toast('외운 단어가 4개 미만이라 지금까지 나온 단어로 출제해요')}
  if(s==='all')return W;
  const seen=new Set();for(let d=BASE;d<=Math.max(TODAY,BASE);d++)wordsFor(d).forEach(w=>seen.add(w));
  const arr=[...seen];return arr.length>=4?arr:W;
}
function rnd(a){return a[Math.floor(Math.random()*a.length)]}
function newQ(){
  const P=pool(),ans=rnd(P),type=$('#quizType').value;
  const opts=[ans];while(opts.length<4){const o=rnd(Math.random()<.5?P:W);if(!opts.includes(o)&&o.mean!==ans.mean)opts.push(o)}
  opts.sort(()=>Math.random()-.5);
  let q;
  if(type==='k2t')q=`<div class="mean">${esc(ans.mean)}</div><div class="muted small">알맞은 태국어를 고르세요</div>`;
  else if(type==='listen')q=`<div style="font-size:56px;cursor:pointer" data-qplay>🔊</div><div class="btns"><button data-qplay>▶ 보통</button><button class="slow" data-qplay data-slow="1">🐢 느림</button></div><div class="muted small">듣고 뜻을 고르세요</div>`;
  else q=`<div class="thai" data-qplay lang="th">${esc(ans.th)}</div><div class="btns"><button data-qplay>▶ 보통</button><button class="slow" data-qplay data-slow="1">🐢 느림</button></div><div class="muted small">뜻을 고르세요</div>`;
  const thaiOpts=type==='k2t';
  $('#quizBox').innerHTML=`<div class="q">${q}</div><div class="opts">${opts.map(o=>`<button data-id="${o.id}" class="${thaiOpts?'thaiopt':''}">${esc(thaiOpts?o.th:o.mean)}</button>`).join('')}</div><div id="qfb"></div>`;
  $('#quizBox').dataset.ans=ans.id;$('#quizBox').dataset.done='';
  if(type==='listen')setTimeout(()=>play(ans.a,ans.th,false),200);
  showScore();
}
function showScore(){$('#quizScore').textContent=`정답 ${score.r} / ${score.t}`+(score.t?` (${Math.round(score.r/score.t*100)}%)`:'')}
$('#quizBox').addEventListener('click',e=>{
  const box=$('#quizBox'),ans=W[+box.dataset.ans];
  const qp=e.target.closest('[data-qplay]');if(qp){play(ans.a,ans.th,!!qp.dataset.slow,qp.tagName==='BUTTON'?qp:null);return}
  if(e.target.closest('.next')){newQ();return}
  const b=e.target.closest('.opts button');if(!b||box.dataset.done)return;box.dataset.done='1';
  const ok=+b.dataset.id===ans.id;score.t++;if(ok)score.r++;LS.set('score',score);
  box.querySelectorAll('.opts button').forEach(x=>{if(+x.dataset.id===ans.id)x.classList.add('right')});if(!ok)b.classList.add('wrong');
  $('#qfb').innerHTML=`<div class="ex" style="cursor:default"><div class="th" lang="th">${esc(ans.th)} <span class="rom">${esc(ans.rom)} · ${esc(ans.ko)}</span></div><div class="k"><b>${esc(ans.mean)}</b></div><div class="r">${esc(ans.ex.th)} — ${esc(ans.ex.ko)}</div></div>
   <div class="center" style="font-size:20px;margin-top:8px">${ok?'⭕ 정답!':'❌ 아쉬워요'}</div><button class="next">다음 문제 ▶</button>`;
  play(ans.a,ans.th,false);showScore();
});
$('#quizScope').onchange=newQ;$('#quizType').onchange=newQ;

// ===== 전체 목록 =====
function renderList(){
  const q=$('#search').value.trim().toLowerCase(),only=$('#onlyLearned').checked;
  const items=W.filter(w=>(!only||learned.has(w.id))&&(!q||[w.th,w.rom,w.ko,w.mean,w.cat].join(' ').toLowerCase().includes(q)));
  $('#stats').textContent=`전체 ${N}단어 · 외운 단어 ${learned.size}개 · 표시 ${items.length}개`;
  $('#list').innerHTML=items.map(w=>`<div class="listitem" data-id="${w.id}"><div class="t" data-p lang="th">${esc(w.th)}</div><div class="m"><div>${esc(w.mean)}</div><div class="rom">${esc(w.rom)} · ${esc(w.ko)}</div></div><button class="mini" data-p>▶</button><button class="mini slow" data-p data-slow="1">🐢</button><button class="ck">${learned.has(w.id)?'✅':'⬜'}</button></div>`).join('');
}
$('#list').addEventListener('click',e=>{
  const it=e.target.closest('.listitem');if(!it)return;const w=W[+it.dataset.id];
  if(e.target.closest('.ck')){learned.has(w.id)?learned.delete(w.id):learned.add(w.id);LS.set('learned',[...learned]);renderList();return}
  const p=e.target.closest('[data-p]');if(p)play(w.a,w.th,!!p.dataset.slow,p.tagName==='BUTTON'?p:null);
});
$('#search').oninput=renderList;$('#onlyLearned').onchange=renderList;
$('#cacheAll').onclick=async()=>{
  if(!('caches' in window)){toast('이 브라우저는 저장을 지원하지 않아요');return}
  const urls=[];W.forEach(w=>{for(const k of [w.a,w.ea])for(const s of ['n','s'])urls.push(`audio/${k}_${s}.mp3`)});
  const c=await caches.open('thai-audio-v1');let done=0,fail=0;const msg=$('#cacheMsg');
  for(let i=0;i<urls.length;i+=12){await Promise.all(urls.slice(i,i+12).map(async u=>{try{if(!(await c.match(u))){const r=await fetch(u);if(r.ok)await c.put(u,r);else fail++}}catch(e){fail++}done++}));msg.textContent=`저장 중… ${done}/${urls.length}`}
  msg.textContent=fail?`완료 (실패 ${fail}개 — 다시 눌러 주세요)`:`✅ ${urls.length}개 음성 저장 완료 — 오프라인에서도 재생돼요`;
};

// ===== 탭 =====
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('active',x===b));
  ['today','quiz','list'].forEach(t=>$('#tab-'+t).hidden=t!==b.dataset.tab);
  if(b.dataset.tab==='quiz')newQ();if(b.dataset.tab==='list')renderList();if(b.dataset.tab==='today')renderToday();
});
renderToday();
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js');
})();

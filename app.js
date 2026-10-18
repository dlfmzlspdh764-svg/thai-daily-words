'use strict';
const D=window.DATA, $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const LS={get:(k,d)=>{try{const v=localStorage.getItem('th2_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:(k,v)=>localStorage.setItem('th2_'+k,JSON.stringify(v))};
const LV={b:{name:'기초',emoji:'🌱',desc:'인사·숫자·음식·기본 동사 등 생활 필수 단어',seed:20261018},
          i:{name:'중급',emoji:'🌿',desc:'감정·건강·업무·여행 심화, 연결어',seed:20261019},
          a:{name:'고급',emoji:'🌳',desc:'사회·뉴스·비즈니스·추상 어휘',seed:20261020}};
const TN=['','평성','저성','하강','고성','상승'];
const TC=['','#8a8a8a','#2f6fdb','#e0403f','#ef8a00','#20a060'];
const TP=['','M2 8 L22 8','M2 7 Q12 9 22 13','M2 6 Q11 0 22 14','M2 6 Q14 8 22 1','M2 9 Q10 16 22 2'];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let lv=LS.get('lv',null), tab='words';
// v1 외운 단어 이관
(()=>{try{const old=JSON.parse(localStorage.getItem('learned')||'null');if(old&&!LS.get('mig',0)){LS.set('learned_b',old.map(i=>'b'+i));LS.set('mig',1)}}catch(e){}})();
const learned={},doneD={};
for(const k in LV){learned[k]=new Set(LS.get('learned_'+k,[]));doneD[k]=new Set(LS.get('dlg_'+k,[]))}
const saveL=()=>LS.set('learned_'+lv,[...learned[lv]]), saveD=()=>LS.set('dlg_'+lv,[...doneD[lv]]);
const opt={rom:LS.get('oRom',true),ko:LS.get('oKo',true),tone:LS.get('oTone',true)};

// ===== 날짜/순환 =====
const BASE=Date.UTC(2026,9,18)/864e5;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const ORDER={};for(const k in LV){const N=D.levels[k].length,r=mulberry32(LV[k].seed),o=[...Array(N).keys()];for(let i=N-1;i>0;i--){const j=Math.floor(r()*(i+1));[o[i],o[j]]=[o[j],o[i]]}ORDER[k]=o}
function seoulToday(){const s=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d)/864e5}
const TODAY=seoulToday();let day=TODAY,perDay=+LS.get('perDay',5);
const W=()=>D.levels[lv];
function wordsFor(dn,k=lv,pd=perDay){const L=D.levels[k],N=L.length,idx=dn-BASE,out=[];for(let j=0;j<pd;j++){const p=((idx*pd+j)%N+N)%N;out.push(L[ORDER[k][p]])}return out}
function fmt(dn){const d=new Date(dn*864e5);return `${d.getUTCFullYear()}년 ${d.getUTCMonth()+1}월 ${d.getUTCDate()}일 (${'일월화수목금토'[d.getUTCDay()]})`}

// ===== 오디오 =====
let cur=null,curBtn=null,seqToken=0;
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,2200)}
function speakFallback(text,slow){return new Promise(res=>{if(!('speechSynthesis' in window)){toast('이 기기는 음성을 지원하지 않아요');return res()}
  speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='th-TH';u.rate=slow?.6:1;
  const v=speechSynthesis.getVoices().find(v=>/^th/i.test(v.lang));if(v)u.voice=v;u.onend=u.onerror=()=>res();speechSynthesis.speak(u)})}
function stop(){seqToken++;if(cur){cur.pause();cur=null}if(curBtn)curBtn.classList.remove('playing');curBtn=null;if('speechSynthesis' in window)speechSynthesis.cancel()}
function play(key,text,slow,btn,keepSeq){
  if(!keepSeq)seqToken++;if(cur){cur.pause();cur=null}if(curBtn)curBtn.classList.remove('playing');
  return new Promise(res=>{const a=new Audio(`audio/${key}_${slow?'s':'n'}.mp3`);cur=a;curBtn=btn||null;if(btn)btn.classList.add('playing');
    const done=()=>{if(btn)btn.classList.remove('playing');res()};let fell=false;
    const fb=()=>{if(fell)return;fell=true;if(btn)btn.classList.remove('playing');speakFallback(text,slow).then(res)};
    a.onended=done;a.onerror=fb;a.play().catch(e=>{if(e&&e.name==='NotAllowedError'){done();return}fb()})})}

// ===== 성조 칩 렌더 =====
const svg=t=>`<svg class="tsvg" viewBox="0 0 24 16"><path d="${TP[t]}" stroke="${TC[t]}" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>`;
function chips(s){return `<div class="syls">${s.map(w=>`<span class="wgrp">${w.map(([r,t,h])=>`<span class="syl t${t}"><span class="r">${esc(r)}</span><span class="h">${esc(h)}</span><span class="tn">${svg(t)}${TN[t]}</span></span>`).join('')}</span>`).join('')}</div>`}
const flat=s=>s.map(w=>w.map(x=>x[0]).join('-')).join(' ');
const flatH=s=>s.map(w=>w.map(x=>x[2]).join('')).join(' ');
function pbtns(key,th){return `<span class="pb"><button class="play" data-k="${key}" data-t="${esc(th)}" data-s="0">▶ 보통</button><button class="play slow" data-k="${key}" data-t="${esc(th)}" data-s="1">🐢 느림</button></span>`}
function applyOpt(){document.body.classList.toggle('noRom',!opt.rom);document.body.classList.toggle('noKo',!opt.ko);document.body.classList.toggle('noTone',!opt.tone)}
document.addEventListener('click',e=>{const b=e.target.closest('.play');if(b){e.stopPropagation();play(b.dataset.k,b.dataset.t,b.dataset.s==='1',b);return}
  const t=e.target.closest('[data-say]');if(t){play(t.dataset.say,t.dataset.t,false,t)}});
const TIP=`<div class="tip">💡 문장 끝은 남성형 <b>ครับ</b>(크랍, 고성)으로 통일했어요. 여성은 평서문 <b>ค่ะ</b>(카, 하강) · 의문문 <b>คะ</b>(카, 고성)로 바꿔 말하세요. 회화에서 A는 남성, B는 여성입니다.</div>`;
const LEGEND=`<div class="legend">${[1,2,3,4,5].map(t=>`<span class="lg t${t}">${svg(t)}${TN[t]}</span>`).join('')}</div>`;

// ===== 홈 =====
function renderHome(){
  $('#tab-home').innerHTML=`<h2 class="center">학습 단계를 선택하세요</h2>`+Object.keys(LV).map(k=>{const N=D.levels[k].length,l=learned[k].size,dn=doneD[k].size,DN=D.dialogs[k].length,sc=LS.get('qbest_'+k,null);
    return `<div class="lvcard" data-lv="${k}"><div class="lvh"><span class="lvemo">${LV[k].emoji}</span><div><div class="lvn">${LV[k].name}</div><div class="muted small">${LV[k].desc}</div></div></div>
    <div class="prog"><span>단어 ${l}/${N}</span><div class="bar"><i style="width:${l/N*100}%"></i></div></div>
    <div class="prog"><span>회화 ${dn}/${DN}</span><div class="bar"><i style="width:${dn/DN*100}%;background:#2f6fdb"></i></div></div>
    <div class="muted small">오늘의 단어: ${wordsFor(TODAY,k,3).map(w=>esc(w.th)).join(' · ')} …${sc?` · 퀴즈 정답 ${sc.c}/${sc.n}`:''}</div></div>`}).join('')+
  `<div class="lvcard abc" data-lv="abc"><div class="lvh"><span class="lvemo">ก</span><div><div class="lvn">태국어 글자·성조 기초</div><div class="muted small">자음 44자 · 모음 · 성조 부호 · 성조 규칙 (모든 단계 공통)</div></div></div></div>`+LEGEND;
}
$('#tab-home').addEventListener('click',e=>{const c=e.target.closest('.lvcard');if(!c)return;if(c.dataset.lv==='abc'){lv=lv||'b';LS.set('lv',lv);show('abc')}else{lv=c.dataset.lv;LS.set('lv',lv);day=TODAY;show('words')}});
$('#homeBtn').onclick=()=>show('home');

function show(t){stop();tab=t;$$('main>section').forEach(s=>s.hidden=s.id!=='tab-'+t);$('#tabs').hidden=t==='home';$('#optbar').hidden=t==='home'||t==='quiz';
  $$('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
  $('#lvBadge').textContent=t==='home'?'':` · ${LV[lv].emoji} ${LV[lv].name}`;
  if(t==='home')renderHome();if(t==='words')renderWords();if(t==='dialog')renderDialogs();if(t==='sit')renderSit();if(t==='abc')renderAbc();if(t==='quiz')newQ();window.scrollTo(0,0)}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)show(b.dataset.tab)});

// ===== 단어 =====
let wv='today';
$$('.seg button[data-wv]').forEach(b=>b.onclick=()=>{wv=b.dataset.wv;$$('.seg button[data-wv]').forEach(x=>x.classList.toggle('on',x===b));renderWords()});
function card(w){const L=learned[lv].has(w.id);
  return `<div class="card ${L?'learned':''}" data-id="${w.id}"><div class="cat">${esc(w.cat)}</div>
  <div class="thai" data-say="${w.a}" data-t="${esc(w.th)}">${esc(w.th)}</div>${chips(w.s)}
  <div class="mean">${esc(w.mean)}</div>${pbtns(w.a,w.th)}
  <div class="ex"><div class="exth" data-say="${w.ex.a}" data-t="${esc(w.ex.th)}">${esc(w.ex.th)}</div>${chips(w.ex.s)}<div class="exko">${esc(w.ex.ko)}</div>${pbtns(w.ex.a,w.ex.th)}</div>
  <button class="learnbtn">${L?'✅ 외웠어요':'☐ 외웠어요 표시'}</button></div>`}
function renderWords(){$('#wToday').hidden=wv!=='today';$('#wAll').hidden=wv!=='all';
  if(wv==='today'){$('#perDay').value=perDay;$('#dateText').textContent=fmt(day);const n=day-BASE+1;
    $('#dayInfo').textContent=(n>=1?`${n}일차`:'시작 전')+` · 외운 단어 ${learned[lv].size}/${W().length}`;
    $('#cards').innerHTML=LEGEND+wordsFor(day).map(card).join('')+TIP;$('#todayBtn').style.visibility=day===TODAY?'hidden':'visible'}
  else renderList()}
function onLearn(e){const b=e.target.closest('.learnbtn');if(!b)return;const id=b.closest('.card').dataset.id;learned[lv].has(id)?learned[lv].delete(id):learned[lv].add(id);saveL();renderWords()}
$('#cards').addEventListener('click',onLearn);$('#list').addEventListener('click',e=>{if(e.target.closest('.learnbtn'))return onLearn(e);const r=e.target.closest('.lrow');if(r&&!e.target.closest('.play,[data-say]')){const w=W().find(x=>x.id===r.dataset.id);r.outerHTML=card(w)}});
$('#prev').onclick=()=>{day--;renderWords()};$('#next').onclick=()=>{day++;renderWords()};$('#todayBtn').onclick=()=>{day=TODAY;renderWords()};
$('#perDay').onchange=e=>{perDay=+e.target.value;LS.set('perDay',perDay);renderWords()};
function renderList(){const q=$('#search').value.trim().toLowerCase(),only=$('#onlyLearned').checked;
  const strip=s=>s.normalize('NFD').replace(/[\u0300-\u030c]/g,'');
  const L=W().filter(w=>(!only||learned[lv].has(w.id))&&(!q||w.th.includes(q)||w.mean.toLowerCase().includes(q)||strip(flat(w.s)).includes(strip(q))||flatH(w.s).includes(q)));
  let html='',c=null;for(const w of L){if(w.cat!==c){c=w.cat;html+=`<h3>${esc(c)}</h3>`}
    html+=`<div class="lrow card" data-id="${w.id}"><span class="lth" data-say="${w.a}" data-t="${esc(w.th)}">${esc(w.th)}</span><span class="lrom">${chips(w.s)}</span><span class="lmean">${learned[lv].has(w.id)?'✅ ':''}${esc(w.mean)}</span></div>`}
  $('#list').innerHTML=`<div class="center muted small">${L.length}개 · 외운 단어 ${learned[lv].size}/${W().length} · 줄을 누르면 예문이 열려요</div>`+html}
$('#search').oninput=renderList;$('#onlyLearned').onchange=renderList;
$('#cacheAll').onclick=async()=>{if(!('caches' in window)){toast('이 브라우저는 오프라인 저장을 지원하지 않아요');return}
  const ks=new Set();W().forEach(w=>{ks.add(w.a);ks.add(w.ex.a)});D.dialogs[lv].forEach(d=>d.lines.forEach(l=>ks.add(l.a)));D.sits.forEach(s=>s.p.forEach(p=>ks.add(p.a)));
  const urls=[...ks].flatMap(k=>[`audio/${k}_n.mp3`,`audio/${k}_s.mp3`]);const c=await caches.open('thai-audio-v2');let n=0;
  for(let i=0;i<urls.length;i+=12){await Promise.all(urls.slice(i,i+12).map(u=>c.match(u).then(h=>h||fetch(u).then(r=>r.ok&&c.put(u,r))).catch(()=>{})));n=Math.min(urls.length,i+12);$('#cacheMsg').textContent=`${n}/${urls.length} 저장 중…`}
  $('#cacheMsg').textContent=`✅ ${urls.length}개 음성 저장 완료 (오프라인 재생 가능)`};

// ===== 회화 =====
let openD=null;
function renderDialogs(){const L=D.dialogs[lv],el=$('#tab-dialog');
  if(openD==null){el.innerHTML=`<div class="center muted small">완료한 회화 ${doneD[lv].size}/${L.length}</div>`+L.map((d,i)=>`<div class="card drow" data-i="${i}"><span class="demo">${d.icon}</span><span class="dtitle">${esc(d.title)}</span><span class="muted small">${d.lines.length}줄</span><span>${doneD[lv].has(d.id)?'✅':'›'}</span></div>`).join('');return}
  const d=L[openD],dn=doneD[lv].has(d.id);
  el.innerHTML=`<div class="row-center"><button class="pill" id="dBack">‹ 목록</button><button class="pill" id="dAll">▶ 전체 듣기</button><button class="pill" id="dAllS">🐢 전체 느리게</button></div>
  <h2 class="center">${d.icon} ${esc(d.title)}</h2>${LEGEND}
  ${d.lines.map((l,j)=>`<div class="bub ${l.sp}" data-j="${j}"><div class="who">${l.sp==='A'?'👨 A (남)':'👩 B (여)'}</div>
  <div class="bth" data-say="${l.a}" data-t="${esc(l.th)}">${esc(l.th)}</div>${chips(l.s)}<div class="bko">${esc(l.ko)}</div>${pbtns(l.a,l.th)}</div>`).join('')}
  <div class="center"><button class="pill big" id="dDone">${dn?'✅ 완료함 (취소하려면 누르세요)':'이 회화 완료 표시'}</button></div>`;
  $('#dBack').onclick=()=>{openD=null;stop();renderDialogs()};
  $('#dDone').onclick=()=>{dn?doneD[lv].delete(d.id):doneD[lv].add(d.id);saveD();renderDialogs()};
  const seq=async slow=>{const tk=++seqToken;for(let j=0;j<d.lines.length;j++){if(tk!==seqToken)return;const b=$(`.bub[data-j="${j}"]`);b.classList.add('hl');b.scrollIntoView({block:'center',behavior:'smooth'});await play(d.lines[j].a,d.lines[j].th,slow,null,true);b.classList.remove('hl');await new Promise(r=>setTimeout(r,350))}};
  $('#dAll').onclick=()=>seq(false);$('#dAllS').onclick=()=>seq(true)}
$('#tab-dialog').addEventListener('click',e=>{const r=e.target.closest('.drow');if(r){openD=+r.dataset.i;renderDialogs();window.scrollTo(0,0)}});

// ===== 상황별 =====
let sitI=0,sitAll=false;const LVO={b:1,i:2,a:3};
function renderSit(){const S=D.sits,s=S[sitI],ps=s.p.filter(p=>sitAll||LVO[p.lv]<=LVO[lv]);
  $('#tab-sit').innerHTML=`<div class="chipsbar">${S.map((x,i)=>`<button class="schip ${i===sitI?'on':''}" data-i="${i}">${x.icon} ${esc(x.name)}</button>`).join('')}</div>
  <div class="row-center small"><label><input type="checkbox" id="sitAll" ${sitAll?'checked':''}> 모든 단계 표현 보기</label><span class="muted">(기본: ${LV[lv].name} 이하)</span></div>
  <h2 class="center">${s.icon} ${esc(s.name)} <span class="muted small">${ps.length}개</span></h2>
  ${ps.map(p=>`<div class="card phr"><span class="lvt lv-${p.lv}">${LV[p.lv].name}</span><div class="bth" data-say="${p.a}" data-t="${esc(p.th)}">${esc(p.th)}</div>${chips(p.s)}<div class="bko">${esc(p.ko)}</div>${pbtns(p.a,p.th)}</div>`).join('')}${TIP}`;
  $('#sitAll').onchange=e=>{sitAll=e.target.checked;renderSit()}}
$('#tab-sit').addEventListener('click',e=>{const b=e.target.closest('.schip');if(b){sitI=+b.dataset.i;renderSit()}});

// ===== 글자·성조 =====
let abcV='cons',consF='all';
const CLN={M:'중자음',H:'고자음',L:'저자음'};
function renderAbc(){const A=D.alpha,el=$('#tab-abc');let h=`<div class="seg">${[['cons','자음 44'],['vows','모음'],['marks','성조 부호'],['rules','성조 규칙'],['sets','성조 연습']].map(([k,n])=>`<button data-av="${k}" class="${abcV===k?'on':''}">${n}</button>`).join('')}</div>`;
  if(abcV==='cons'){h+=`<div class="row-center">${[['all','전체'],['M','중자음 (9)'],['H','고자음 (11)'],['L','저자음 (24)']].map(([k,n])=>`<button class="pill sm ${consF===k?'on':''}" data-cf="${k}">${n}</button>`).join('')}</div>
    <p class="muted small center">자음의 '등급(중·고·저)'이 성조를 결정해요. 칸을 누르면 이름을, 예시를 누르면 단어를 들려줘요.</p>
    <div class="cgrid">${A.cons.filter(c=>consF==='all'||c.cls===consF).map(c=>`<div class="cbox c${c.cls}"><div class="cl" data-say="${c.a}" data-t="${esc(c.name)}">${c.l}</div><div class="ccls">${CLN[c.cls]}</div>
      <div class="cname">${esc(c.name)}</div>${chips(c.s)}<div class="csnd">첫소리 <b>${esc(c.ini)}</b> · 받침 <b>${esc(c.fin)}</b></div>
      <div class="cex" data-say="${c.ea}" data-t="${esc(c.ex)}">🔊 ${esc(c.ex)} <span class="muted">${esc(c.mean)}</span></div>${pbtns(c.a,c.name)}</div>`).join('')}</div>`}
  if(abcV==='vows'){h+=`<p class="muted small center">'–' 자리에 자음이 들어가요. 태국어는 모음 길이(짧음/김)가 뜻과 성조에 영향을 줘요.</p><div class="cgrid">${A.vows.map(v=>`<div class="cbox"><div class="cl v" data-say="${v.a}" data-t="${esc(v.snd)}">${esc(v.f)}</div><div class="ccls">${esc(v.len)}</div>${chips(v.s)}
    <div class="cex" data-say="${v.ea}" data-t="${esc(v.ex)}">🔊 ${esc(v.ex)} <span class="muted">${esc(v.mean)}</span></div>${chips(v.es)}${pbtns(v.a,v.snd)}</div>`).join('')}</div>`}
  if(abcV==='marks'){h+=`<p class="muted small center">성조 부호는 첫 자음 위에 붙어요. 같은 부호라도 자음 등급에 따라 성조가 달라져요.</p>`+A.marks.map(m=>`<div class="card"><div class="mrow"><span class="mk" data-say="${m.a}" data-t="${esc(m.name)}">◌${m.m}</span><div><b>${esc(m.name)}</b> <span class="muted">${esc(m.rom)}</span><div class="small">${esc(m.rule)}</div><div class="small muted">예: ${esc(m.ex)}</div></div></div></div>`).join('')+LEGEND}
  if(abcV==='rules'){h+=`<p class="muted small center">살아있는 음절 = 장모음 또는 ㅁ·ㄴ·ㅇ·이·우 받침 / 죽은 음절 = 단모음 또는 ㄱ·ㄷ·ㅂ 받침</p>${LEGEND}<table class="rt"><tr><th>등급</th><th>조건</th><th>성조</th><th>예시</th></tr>${A.rules.map(r=>`<tr><td>${esc(r.cls)}</td><td>${esc(r.cond)}</td><td><span class="lg t${r.t}">${svg(r.t)}${TN[r.t]}</span></td><td>${r.ex.map(e=>`<span class="rex" data-say="${e.a}" data-t="${esc(e.th)}">${esc(e.th)} <small>${esc(e.s.map(w=>w.map(x=>x[0]).join('-')).join(' '))}</small> <small class="muted">${esc(e.mean)}</small></span>`).join('')}</td></tr>`).join('')}</table>`}
  if(abcV==='sets'){h+=`<p class="muted small center">같은 소리, 다른 성조 = 다른 뜻! 차례로 듣고 비교해 보세요.</p>`+A.sets.map((s,i)=>`<div class="card"><div class="row-between"><b>${esc(s.title)}</b><button class="pill sm" data-set="${i}">▶ 차례로 듣기</button></div>${s.w.map(w=>`<div class="srow" data-say="${w.a}" data-t="${esc(w.th)}"><span class="sth">${esc(w.th)}</span>${chips(w.s)}<span class="small">${esc(w.mean)}</span></div>`).join('')}</div>`).join('')}
  el.innerHTML=h}
$('#tab-abc').addEventListener('click',e=>{const a=e.target.closest('[data-av]');if(a){abcV=a.dataset.av;renderAbc();return}const c=e.target.closest('[data-cf]');if(c){consF=c.dataset.cf;renderAbc();return}
  const s=e.target.closest('[data-set]');if(s){const set=D.alpha.sets[+s.dataset.set];(async()=>{const tk=++seqToken;for(const w of set.w){if(tk!==seqToken)return;await play(w.a,w.th,false,null,true);await new Promise(r=>setTimeout(r,400))}})()}});

// ===== 퀴즈 =====
let score={c:0,n:0},qAns=null;
function pool(){const sc=$('#quizScope').value,L=W();if(sc==='all')return L;if(sc==='learned'){const a=L.filter(w=>learned[lv].has(w.id));return a.length>=4?a:L}
  const seen=new Set();for(let d=BASE;d<=Math.max(TODAY,BASE);d++)wordsFor(d).forEach(w=>seen.add(w));const a=[...seen];return a.length>=4?a:L}
const rnd=a=>a[Math.floor(Math.random()*a.length)];
const strip=s=>s.normalize('NFD').replace(/[\u0300-\u030c]/g,'').normalize('NFC');
function newQ(){stop();const P=pool();let type=$('#quizType').value;if(type==='mix')type=rnd(['t2k','k2t','listen','tone']);const box=$('#quizBox');
  if(type==='tone'){const syl=[];P.forEach(w=>{const f=w.s.flat();if(f.length<=3)f.forEach((x,i)=>syl.push([w,i]))});const [w,i]=rnd(syl.length?syl:[[P[0],0]]);const f=w.s.flat(),t=f[i][1];qAns={t};
    box.innerHTML=`<div class="qtype">🎵 성조 맞히기</div><div class="thai qbig">${esc(w.th)}</div><div class="qsyl">${f.map((x,j)=>`<span class="${j===i?'tgt':''}">${esc(strip(x[0]))}</span>`).join('-')}</div><div class="muted small">${esc(w.mean)} · ${f.length>1?`<b>${i+1}번째</b> 음절(굵게 표시)의 `:''}성조는?</div>${pbtns(w.a,w.th)}
    <div class="opts">${[1,2,3,4,5].map(k=>`<button class="opt lg t${k}" data-t="${k}">${svg(k)} ${TN[k]}</button>`).join('')}</div><div id="qfb"></div>`;
    play(w.a,w.th,false);return}
  const ans=rnd(P),opts=[ans];let guard=0;while(opts.length<4&&guard++<200){const o=rnd(Math.random()<.5?P:W());if(!opts.includes(o)&&o.mean!==ans.mean&&o.th!==ans.th)opts.push(o)}opts.sort(()=>Math.random()-.5);qAns={w:ans};
  const q=type==='t2k'?`<div class="thai qbig">${esc(ans.th)}</div>${chips(ans.s)}`:type==='k2t'?`<div class="mean qbig">${esc(ans.mean)}</div>`:`<div class="qbig">🔊</div>${pbtns(ans.a,ans.th)}`;
  box.innerHTML=`<div class="qtype">${{t2k:'뜻을 고르세요',k2t:'태국어를 고르세요',listen:'듣고 뜻을 고르세요'}[type]}</div>${q}<div class="opts">${opts.map(o=>`<button class="opt" data-id="${o.id}">${type==='k2t'?`<span class="thai sm">${esc(o.th)}</span>`:esc(o.mean)}</button>`).join('')}</div><div id="qfb"></div>`;
  if(type!=='k2t')play(ans.a,ans.th,false)}
$('#quizBox').addEventListener('click',e=>{const b=e.target.closest('.opt');if(!b||$('#quizBox').dataset.lock==='1')return;$('#quizBox').dataset.lock='1';let ok;
  if(qAns.t){ok=+b.dataset.t===qAns.t;$$('.opt').forEach(x=>{if(+x.dataset.t===qAns.t)x.classList.add('right')})}
  else{ok=b.dataset.id===qAns.w.id;$$('.opt').forEach(x=>{if(x.dataset.id===qAns.w.id)x.classList.add('right')});const w=qAns.w;$('#qfb').innerHTML=`<div class="fb"><b>${esc(w.th)}</b> = ${esc(w.mean)}${chips(w.s)}</div>`}
  if(!ok)b.classList.add('wrong');score.n++;if(ok)score.c++;
  const best=LS.get('qbest_'+lv,{c:0,n:0});best.c+=ok?1:0;best.n++;LS.set('qbest_'+lv,best);
  $('#quizScore').textContent=`이번 ${score.c}/${score.n} 정답 · ${LV[lv].name} 누적 ${best.c}/${best.n}`;
  $('#qfb').insertAdjacentHTML('beforeend',`<div class="center"><span class="${ok?'okt':'not'}">${ok?'⭕ 정답!':'❌ 아쉬워요'}</span> <button class="pill" id="qNext">다음 문제 ›</button></div>`);
  $('#qNext').onclick=()=>{$('#quizBox').dataset.lock='0';newQ()}});
$('#quizType').onchange=$('#quizScope').onchange=()=>{$('#quizBox').dataset.lock='0';newQ()};

// ===== 옵션 =====
[['oRom','rom'],['oKo','ko'],['oTone','tone']].forEach(([id,k])=>{const c=$('#'+id);c.checked=opt[k];c.onchange=()=>{opt[k]=c.checked;LS.set(id,c.checked);applyOpt()}});applyOpt();

if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
const hp=location.hash.slice(1).split('/');if(hp[0]&&LV[hp[0]]){lv=hp[0];LS.set('lv',lv)}
if(hp[1]==='dialog'&&hp[2]!=null)openD=+hp[2];if(hp[1]==='sit'&&hp[2]!=null)sitI=+hp[2];
show(lv&&hp[1]?hp[1]:'home');

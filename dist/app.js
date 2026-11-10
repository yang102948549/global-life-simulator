(()=>{'use strict';
const cases=window.SCENARIOS,AI=window.AI,app=document.querySelector('#app'),KEY='global-life-lab-v1';
const RUN_VIEWS=['intro','chat','reflect','lab','plan','report'];
const FREE_VIEWS=['home','atlas','guide','select','gallery'];
// 학교 PC는 Windows '애니메이션 효과'가 꺼진 경우가 많아 OS의 '동작 줄이기' 요청을 따르지 않는다.
const reduceMotion=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// 캐릭터마다 그림 속 옷·소품 색에서 고른 포인트 색
const TONE={tuvalu:'#1f7f7c',pakistan:'#2d6b63',bangladesh:'#3e6399',somalia:'#b06d12',gaza:'#3f74a8',haiti:'#a86a14',ghana:'#86552a',sudan:'#76589f',rohingya:'#71519c',afghanistan:'#a3303d',congo:'#ad2843',qatar:'#66750f'};
const DEFAULT_TONE='#111111';

/* ---------- 저장 ---------- */
let state={run:null,completed:[]},view='home',filter='전체',storageOK=true,pending=false;
const emptyChats=()=>[0,1,2].map(()=>({log:[],api:[]}));
try{
  const saved=JSON.parse(localStorage.getItem(KEY));
  if(saved&&Array.isArray(saved.completed)){
    state.completed=saved.completed.filter(id=>cases.some(c=>c.id===id));
    const r=saved.run;
    if(r&&cases.some(c=>c.id===r.id)&&Number.isInteger(r.step)&&r.step>=0&&r.step<=2&&Array.isArray(r.choices)&&r.choices.length===3&&r.choices.every(n=>n===null||n===0||n===1)&&r.fields&&typeof r.fields==='object'){
      if(r.view==='play')r.view='chat';
      if(!RUN_VIEWS.includes(r.view))r.view='intro';
      if(!Array.isArray(r.chats)||r.chats.length!==3||!r.chats.every(x=>x&&Array.isArray(x.log)&&Array.isArray(x.api)))r.chats=emptyChats();
      state.run=r;
    }
    if(saved.me&&typeof saved.me==='object')state.me=saved.me;
  }
}catch{storageOK=false;}

const current=()=>cases.find(c=>c.id===state.run?.id);
const fields=()=>state.run?.fields||{};
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{if(storageOK)dialog({title:'자동 저장을 쓸 수 없어요',body:'이 브라우저에서는 기록이 저장되지 않아요. 활동이 끝나면 탐구 기록을 꼭 내려받아 주세요.'});storageOK=false;}}
// 테마에 맞춘 알림·확인 팝업. 브라우저 기본 alert·confirm 대신 쓴다. 확인을 누르면 true.
function dialog({title,body='',ok='확인',cancel='',icon='!'}){
  return new Promise(res=>{
    const d=document.createElement('div'),prev=document.activeElement;
    d.className='modal dialog';d.setAttribute('role','alertdialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-label',title);
    d.innerHTML=`<div class="modal-box dialog-box"><span class="dialog-icon" aria-hidden="true">${icon}</span><h2>${esc(title)}</h2>${body?`<p>${esc(body)}</p>`:''}<div class="dialog-actions">${cancel?`<button type="button" class="btn ghost" data-dlg="0">${esc(cancel)}</button>`:''}<button type="button" class="btn" data-dlg="1">${esc(ok)}</button></div></div>`;
    const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();done(!cancel);}};
    const done=v=>{d.remove();document.removeEventListener('keydown',key,true);prev?.focus?.({preventScroll:true});res(v);};
    d.addEventListener('click',e=>{const b=e.target.closest('[data-dlg]');if(b){e.stopPropagation();done(b.dataset.dlg==='1');}else if(e.target===d)done(!cancel);});
    document.addEventListener('keydown',key,true);
    document.body.appendChild(d);d.querySelector('[data-dlg="1"]').focus();
  });
}
// 비어 있는 첫 칸으로 데려간다.
function focusEmpty(names){const n=names.find(k=>!fields()[k]?.trim());const el=n&&document.querySelector(`[data-field="${n}"]`);if(el){el.scrollIntoView({block:'center',behavior:reduceMotion?'auto':'smooth'});el.focus({preventScroll:true});}}
function toast(msg){const el=document.querySelector('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),3800);}
function navigate(next){
  view=next;
  if(state.run&&RUN_VIEWS.includes(next)){state.run.view=next;save();}
  render();
  window.scrollTo({top:0,behavior:'instant'});
  app.focus({preventScroll:true});
}

/* ---------- 캐릭터 고르기 ---------- */
const canReplace=async()=>!state.run||state.run.view==='report'||await dialog({title:'새 이야기를 시작할까요?',body:'지금 하던 이야기는 지워져요. 이어서 하려면 "계속하기"를 눌러 주세요.',ok:'새로 시작',cancel:'계속하기',icon:'?'});
// 아직 마치지 않은 캐릭터 가운데 하나. except는 '다른 사람 뽑기'에서 방금 나온 캐릭터를 빼기 위한 것.
function pickRandom(except){
  let pool=cases.filter(x=>!state.completed.includes(x.id)&&x.id!==except);
  if(!pool.length)pool=cases.filter(x=>x.id!==except);
  const n=new Uint32Array(1);crypto.getRandomValues(n);
  return pool[Math.floor(n[0]/4294967296*pool.length)];
}
function begin(c){
  state.run={id:c.id,step:0,choices:[null,null,null],fields:{},chats:emptyChats(),view:'intro',startedAt:new Date().toISOString()};
  save();navigate('intro');
}
async function start(id){if(!await canReplace())return;const c=cases.find(x=>x.id===id);if(c)begin(c);}
async function draw(except){
  if(!except&&!await canReplace())return;
  const target=pickRandom(except);
  navigate('select');
  roulette(target);
}

/* ---------- 공통 조각 ---------- */
const sourceList=c=>`<ul class="sources">${c.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><span>${esc(s.date)}</span></li>`).join('')}</ul>`;
const facts=c=>`<ul class="facts">${c.facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`;
// 캐릭터 그림. kind가 face면 얼굴 부분, 아니면 전신 그림. 그림을 못 읽으면 이름 첫 글자가 보인다.
const artSrc=(id,kind)=>`assets/characters/${id}${kind==='face'?'-face':''}.webp`;
function art(c,kind='card',extra=''){
  return `<div class="art art-${kind} ${extra}" style="--tone:${TONE[c.id]||DEFAULT_TONE}" aria-hidden="true"><span class="art-initial">${esc([...c.name][0])}</span><img src="${artSrc(esc(c.id),kind)}" alt="" decoding="async" onerror="this.remove()"></div>`;
}
// 서버가 멀어 그림 한 장마다 1초 가까이 걸리므로, 첫 화면 뒤에 모든 그림(약 1.2MB)을 미리 받아 둔다.
// 이후 화면에서는 브라우저 저장본이 바로 쓰인다.
function preloadArt(){
  const keep=[];
  for(const kind of ['face','card'])for(const c of cases){const img=new Image();img.src=artSrc(c.id,kind);keep.push(img);}
  preloadArt.keep=keep;
}
function field(name,label,placeholder='',required=false,help=''){return `<label class="field"><span>${esc(label)}${required?' <em>필수</em>':''}</span>${help?`<small>${esc(help)}</small>`:''}<textarea data-field="${name}" name="${name}" maxlength="4000" ${required?'required':''} placeholder="${esc(placeholder)}">${esc(fields()[name]||'')}</textarea></label>`;}
function tile(c){const i=cases.indexOf(c),done=state.completed.includes(c.id);return `<button class="tile" data-start="${c.id}" style="--tone:${TONE[c.id]}">${art(c,'card')}<span class="tile-body"><span class="tile-meta">${esc(c.theme)}${done?' · 완료':''}</span><strong>${esc(c.name)}</strong><span class="tile-title">${esc(c.title)}</span><span class="tile-desc">${esc(c.summary)}</span></span></button>`;}

/* ---------- 홈 · 목록 · 안내 ---------- */
// 홈은 게임 타이틀 화면: 제목과 시작 버튼만.
// 홈: 보고서 표지처럼. 위쪽은 초상과 캐릭터 색 타일을 틈 없이 붙인 모자이크, 아래는 큰 제목.
const MOSAIC=[['p','bangladesh','p1'],['t','gaza','t1'],['p','tuvalu','p2'],['t','congo','t2'],['p','afghanistan','p3'],['t','sudan','t3'],['p','ghana','p4'],['p','gaza','p5'],['t','haiti','t4']];
function home(){const r=state.run,c=current();return `<section class="title-screen">
  <div class="mosaic" aria-hidden="true">${MOSAIC.map(([k,id,area])=>k==='p'?`<div class="m-cell a-${area}" style="grid-area:${area}">${art(cases.find(x=>x.id===id),'card')}</div>`:`<div class="m-cell m-tile a-${area}" style="grid-area:${area};background:${TONE[id]}"></div>`).join('')}</div>
  <div class="title-body">
    <p class="title-kicker">중학교 도덕 · 지구촌 문제 수업</p>
    <h1><span class="line"><span>다른 곳의</span></span><span class="line"><span>하루</span></span></h1>
    <p class="title-sub">지구촌 어딘가에 사는 또래가 되어, 대화하며 아침부터 저녁까지 하루를 살아 보는 도덕 수업 게임입니다.</p>
    <div class="title-actions">
      <button class="btn big" data-action="random">게임 시작</button>
      ${r&&c?`<button class="btn big ghost" data-action="resume">이어하기 · ${esc(c.name)}</button>`:''}
      <button class="link" data-nav="atlas">캐릭터 직접 고르기</button>
    </div>
    <p class="title-note">실제 자료를 바탕으로 만든 이야기입니다. 인물과 대화는 꾸민 것입니다.${!storageOK?' 이 브라우저는 저장을 쓸 수 없어 새로고침하면 진행이 사라질 수 있어요.':''}</p>
  </div>
</section>`;}

function atlas(){const shown=filter==='전체'?cases:cases.filter(c=>c.theme===filter);return `<div class="page-head"><h1>열두 명의 하루</h1><p class="muted">나라 전체가 아니라 특정 지역에 사는 한 사람의 조건을 따라갑니다. 이 브라우저에서 ${state.completed.length} / 12명을 마쳤습니다.</p></div>
<div class="filters" role="group" aria-label="주제별 보기">${['전체','환경','물','빈곤','난민','인권'].map(t=>`<button class="chip" aria-pressed="${filter===t}" data-filter="${t}">${t}</button>`).join('')}</div>
<div class="tiles">${shown.map(tile).join('')}</div>
<div class="actions"><button class="btn" data-action="random">무작위로 뽑기</button></div>`;}

function guide(){return `<div class="page-head"><h1>체험에서 공감으로,<br>공감에서 책임으로.</h1><p class="muted">중학교 도덕 · 지구촌 문제 해결 수업. 모든 사례는 자료 시점의 특정 지역 상황이며 나라 전체를 대표하지 않습니다.</p></div>
<div class="grid3">
  <article class="cell"><p class="label">1차시 · 45분</p><h3>캐릭터와 대화하기</h3><p>도입·뽑기 10분 → 세 장면 대화 20분 → 돌아보기 15분. 다른 선택의 결과도 비교해 봅니다.</p></article>
  <article class="cell"><p class="label">2차시 · 45분</p><h3>질문하고 조사하기</h3><p>질문 하나 정하기 10분 → 앱 안의 AI 조사 도우미와 원문 자료로 알아보기 25분 → 알게 된 것과 근거 정리 10분.</p></article>
  <article class="cell"><p class="label">3차시 · 45분</p><h3>해결책을 글로 내놓기</h3><p>신문 기사·정책 제안서·편지 가운데 하나 고르기 5분 → 쓰기 20분 → 이야기 속 인물·선생님과 피드백 대화하며 고치기 15분 → 갤러리에 제출 5분.</p></article>
</div>
<div class="grid2">
  <article class="cell"><h3>AI 대화 설정</h3><p>onischool.net에서는 학교 서버가 AI 키를 갖고 있어 학생은 키 입력 없이 바로 대화합니다. 키는 학생 기기로 가지 않습니다. AI가 연결되면 선택지 버튼은 보이지 않고, 학생은 답 칩을 누르거나 직접 말하며 대화하다가 세 번째 말부터 나오는 결정 칩(→)이나 직접 쓴 결정으로 장면을 마칩니다. AI를 쓸 수 없을 때는 선택 버튼으로 진행됩니다.</p></article>
  <article class="cell"><h3>AI 대화의 안전장치</h3><p>대화는 Google 쪽에 저장되지 않게 보냅니다. 괴롭힘·혐오·성적·위험 내용 필터를 켜 두었고, 잔인한 묘사·연애 묘사·개인정보 요청을 막는 지침을 넣었습니다. 그래도 AI는 실수할 수 있으니 수업 중 화면을 살펴 주세요. 학생에게 실명·학교·연락처를 쓰지 않도록 안내해 주세요.</p></article>
  <article class="cell"><h3>12명을 모두 다루려면</h3><p>학생마다 무작위로 한 명씩 뽑아 개인 활동으로 진행합니다. 무작위 뽑기는 이 브라우저에서 마치지 않은 캐릭터를 먼저 고릅니다. 기기 사이의 중복은 자동으로 조정되지 않으니 ‘캐릭터’ 목록에서 직접 나눠 줄 수 있습니다.</p></article>
  <article class="cell"><h3>공감을 다루는 방법</h3><p>생존 점수, 빈곤 순위, 사망 결말은 없습니다. 모든 선택에는 얻는 것과 잃는 것이 있습니다. 불편한 장면은 다른 캐릭터로 바꾸거나 자료 읽기로 대신해도 됩니다.</p></article>
</div>
<p class="notice"><strong>평가 관점</strong> · 문제와 당사자 이해 / 스스로 정한 질문 / 출처와 시점 확인 / 개인과 제도의 책임 구분 / 형식에 맞는 글쓰기 / 피드백을 반영한 고치기</p>
<div class="actions"><button class="btn" data-nav="atlas">캐릭터 나눠 주기</button><button class="btn ghost" data-action="clear">이 브라우저의 기록 지우기</button></div>`;}

/* ---------- 뽑기 · 소개 ---------- */
function select(){return `<section class="select">
  <p class="label center">캐릭터 뽑기</p>
  <h1 class="center">오늘 당신이 살아 볼 사람은?</h1>
  <div class="slots">${cases.map((c,i)=>`<div class="slot${state.completed.includes(c.id)?' done':''}" data-slot="${i}" style="--tone:${TONE[c.id]}">${art(c,'face')}<strong>${esc(c.name)}</strong><span>${esc(c.country)}</span></div>`).join('')}</div>
  <p class="muted center" id="select-status" aria-live="polite">고르는 중…</p>
</section>`;}
function roulette(target){
  const slots=[...app.querySelectorAll('.slot')],end=cases.indexOf(target);
  const land=()=>{
    slots.forEach(s=>s.classList.remove('on'));slots[end].classList.add('on','picked');
    const st=app.querySelector('#select-status');if(st)st.innerHTML=`<strong>${esc(target.name)}</strong> · ${esc(target.country)}`;
    setTimeout(()=>{if(view==='select')begin(target);},1800);
  };
  // 한 바퀴 돈 뒤 목표 칸에서 멈추고, 처음엔 이름을 읽을 만한 빠르기로 시작해 끝으로 갈수록 느려진다.
  const st=app.querySelector('#select-status');
  if(st)st.textContent=`${slots.length}명 가운데 한 명을 뽑아요`;
  const total=slots.length+end;
  let step=0;
  const tick=()=>{
    if(view!=='select')return;
    const s=slots[step%slots.length];
    slots.forEach(x=>x.classList.remove('on'));
    s.classList.add('on');
    if(st)st.textContent=`${cases[step%slots.length].name} · ${cases[step%slots.length].country}`;
    if(step>=total){land();return;}
    const p=step/total;step++;
    setTimeout(tick,120+480*p*p*p);
  };
  setTimeout(tick,900);
}

function intro(c){const i=cases.indexOf(c);return `<section class="profile">
  <figure class="portrait">${art(c,'card')}<figcaption><span>${esc(c.theme)}</span><strong>${esc(c.name)}</strong>${esc(c.country)}</figcaption></figure>
  <div class="profile-body">
    <h1>${esc(c.name)}</h1>
    <p class="muted">${esc(c.role)}</p>
    <dl class="facts-table">
      <div><dt>나라</dt><dd>${esc(c.country)}</dd></div>
      <div><dt>사는 곳</dt><dd>${esc(c.region)}</dd></div>
      <div><dt>이야기</dt><dd>${esc(c.title)}</dd></div>
    </dl>
    <div class="callout"><strong>상황</strong><p>${esc(c.summary)}</p></div>
    <blockquote>“${esc(c.wish)}”</blockquote>
    <details><summary>실제로 확인된 사실 보기</summary>${facts(c)}${sourceList(c)}<p class="muted small">인물과 장면은 이 자료를 바탕으로 꾸민 이야기입니다. 선택의 결과는 예측이 아니며 점수도 없습니다.</p></details>
    <div class="actions"><button class="btn big" data-action="join">이 사람으로 시작</button><button class="btn big ghost" data-action="redraw"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>다른 사람 뽑기</button></div>
  </div>
</section>`;}

/* ---------- 게임 화면: 장면 카드 ---------- */
const chatOf=step=>state.run.chats[step];
const playerTag=()=>fields().nickname?`<span class="player">플레이어 · ${esc(fields().nickname)}</span>`:'';
// AI에게 넘길 앞 장면 요약: 고른 길, 대본 결과, 학생이 대화에서 한 말(최근 4개, 앞부분만).
function pastScenes(c){
  const r=state.run;
  return c.scenes.slice(0,r.step).map((s,i)=>{
    const o=s.options[r.choices[i]];
    const said=chatOf(i).log.filter(e=>e.k==='me'&&e.text!==o?.text).slice(-4).map(e=>e.text.slice(0,160));
    return {time:s.time,title:s.title,choice:o?.text||'고르지 않음',result:chatOf(i).brief?.mine?.story||o?.result||'',said};
  });
}
// 장면 뒤 브리핑: 결정이 나면 AI가 '그 뒤의 삶'과 '다른 길을 간 삶'을 쓴다.
// ch.brief가 undefined면 아직 만들지 않은 것, null이면 AI 없이 대본 결과만 쓴다.
let briefing=false;
// 미리 만든 내용(precomputed.js): A·B 선택으로 정해지는 부분은 AI를 부르지 않고 여기서 꺼낸다.
const PRE=window.PRECOMPUTED||{};
function ensureBrief(c){
  const r=state.run,step=r.step,ch=chatOf(step),n=r.choices[step];
  if(n===null||ch.brief!==undefined||briefing)return;
  const pre=PRE[c.id]?.scenes?.[step];
  if(pre){ch.brief={mine:pre.lives[n],other:pre.lives[1-n],between:pre.after[n]};save();return;}
  if(!AI.ready){ch.brief=null;save();return;}
  briefing=true;
  AI.brief({c,step,past:pastScenes(c),n,log:ch.log})
    .then(b=>{if(state.run===r)ch.brief=b;})
    .catch(()=>{if(state.run===r)ch.brief=null;})
    .finally(()=>{briefing=false;save();if(view==='chat'&&state.run===r)render();});
}
// 한 삶의 브리핑 카드. b가 없으면 대본 결과만 보여 준다.
function lifeCard(c,b,text,result,kind){
  const head=kind==='mine'?`그 뒤, ${esc(c.name)}의 삶`:`다른 길을 간 ${esc(c.name)}`;
  return `<section class="life ${kind}">
    <p class="life-tag">${head}</p>
    <p class="life-path">${kind==='mine'?'내가 택한 길':'택하지 않은 길'} · ${esc(text)}</p>
    ${b?`<h2>${esc(b.headline)}</h2>`:''}
    <p class="life-story">${esc(b?.story||result)}</p>
    ${b?`<dl class="gain-loss"><div><dt>얻은 것</dt><dd>${esc(b.gained)}</dd></div><div><dt>잃은 것</dt><dd>${esc(b.lost)}</dd></div></dl>`:''}
  </section>`;
}
// 장면에 처음 들어오면 카드 첫 문단을 넣는다.
// 첫 장면이거나 AI가 없으면 대본 글을, 둘째·셋째 장면은 AI가 앞 장면을 이어 받아 다시 쓴 글을 넣는다.
let opening=false;
// 첫 장면의 답 칩을 미리 받아 둔다. 등록 팝업에서 이름을 적는 동안 받기 시작해서, 대화 화면에 들어오면 이미 떠 있게.
let chipsLoading=false;
function prefetchChips(c){
  const r=state.run,ch=r?.chats[0];
  if(!r||chipsLoading||ch.chips?.length||ch.log.some(e=>e.k==='me'))return;
  if(PRE[c.id]?.chips0){ch.chips=PRE[c.id].chips0;save();return;}
  if(!AI.ready)return;
  chipsLoading=true;
  AI.opening({c,step:0,past:[],fixed:true})
    .then(o=>{if(state.run===r&&!ch.log.some(e=>e.k==='me'))ch.chips=o.chips;})
    .catch(()=>{})
    .finally(()=>{chipsLoading=false;save();if(view==='chat'&&state.run===r&&r.step===0){render();scrollLog();}});
}
function openScene(c){
  const r=state.run,step=r.step,ch=chatOf(step),s=c.scenes[step];
  if(ch.log.length||opening)return;
  // 낮·저녁 첫머리: 앞 장면에서 고른 길에 맞춰 미리 만든 글
  const pre=step>0&&PRE[c.id]?.openings?.[step]?.[r.choices[step-1]];
  if(pre){
    ch.opening=pre.narration;ch.chips=pre.chips;
    ch.log.push({k:'story',text:pre.narration});
    if(pre.dialogue)ch.log.push({k:'say',speaker:pre.speaker||'주변 사람',text:pre.dialogue});
    save();return;
  }
  if(step===0||!AI.ready){
    ch.log.push({k:'story',text:s.story});save();
    if(step===0)prefetchChips(c);
    return;
  }
  opening=pending=true;
  AI.opening({c,step,past:pastScenes(c)})
    .then(o=>{
      if(state.run!==r||ch.log.length)return;
      ch.opening=o.narration;ch.chips=o.chips;
      ch.log.push({k:'story',text:o.narration});
      if(o.dialogue)ch.log.push({k:'say',speaker:o.speaker||'주변 사람',text:o.dialogue});
    })
    .catch(()=>{if(state.run===r&&!ch.log.length)ch.log.push({k:'story',text:s.story});})
    .finally(()=>{opening=pending=false;save();if(view==='chat'&&state.run===r)render();});
}
// 기다리는 동안: 대화·선택 때는 점 세 개, 장면 첫머리를 AI가 쓰는 동안(미리 만든 글이 없을 때)은 호를 따라 도는 해.
function passing(c,step,sceneChange){
  const s=c.scenes[step];
  if(sceneChange&&step>0)return `<div class="passing scene" role="status"><div class="sky" aria-hidden="true"><span class="arm"><i></i></span></div><p>${esc(c.scenes[step-1].time)}이 지나고 ${esc(s.time)}이 된다</p></div>`;
  return '<p class="msg typing" role="status" aria-label="답을 기다리는 중"><i></i><i></i><i></i></p>';
}
// 장면 전환: 창 전체가 하루의 하늘로 바뀐다. 지금 시간대의 하늘빛이 다음 시간대의 하늘빛으로 천천히 번지고,
// 해가 그 시간의 자리로 옮겨 가며, 그사이 앞 장면에서 고른 길에 이어지는 일과가 한 줄씩 지나간다.
// 뒤에서는 다음 장면 첫머리가 준비된다. to가 3이면 마지막 장면 뒤, 밤으로 넘어간 뒤 돌아보기로 간다.
const PHASE={아침:'morning',낮:'noon',저녁:'evening',밤:'night'};
const DAY_FALLBACK={
  낮:[['오전','해가 높이 떠오르고, 하루가 이어진다'],['한낮','그림자가 짧아진다']],
  저녁:[['오후','햇볕이 조금씩 누그러진다'],['해 질 무렵','하늘이 붉게 물든다']],
  밤:[['저녁','하루를 정리한다'],['밤','불이 하나둘 꺼진다']],
};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function dayPass(c,from,to){
  const fromT=c.scenes[from].time,toT=to<3?c.scenes[to].time:'밤';
  const got=chatOf(from).brief?.between;
  const items=got?.length?got:(DAY_FALLBACK[toT]||[]).map(([when,text])=>({when,text}));
  const step=1100,lead=500,dur=lead+items.length*step;
  const el=document.createElement('div');
  el.className=`daypass from-${PHASE[fromT]||'morning'} to-${PHASE[toT]||'night'}`;
  el.setAttribute('role','status');el.setAttribute('aria-live','polite');
  el.style.setProperty('--dur',dur+'ms');
  el.innerHTML=`<div class="dp-sky dp-from"></div><div class="dp-sky dp-to"></div>
    <div class="dp-card">
      <p class="dp-phase"><span>${esc(fromT)}</span><span class="dp-arc" aria-hidden="true"><span class="arm"><i></i></span></span><span>${esc(toT)}</span></p>
      <ol class="dp-list">${items.map((x,i)=>`<li style="--i:${i}">${x.when?`<b>${esc(x.when)}</b>`:''}${esc(x.text)}</li>`).join('')}</ol>
      <p class="dp-next" style="--i:${items.length}">${to<3?`${esc(toT)} · ${esc(c.scenes[to].title)}`:`${esc(c.name)}의 하루가 저문다`}</p>
    </div>`;
  document.body.appendChild(el);
  window.scrollTo({top:0});
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('go')));
  await wait(reduceMotion?1500:dur+lead+900);
  // 다음 장면 첫머리를 아직 쓰는 중이면 마지막 줄을 띄운 채 기다린다.
  while(opening)await wait(200);
  el.classList.add('out');await wait(450);el.remove();
}
// *행동* 표기를 기울임으로 보여 준다.
const fmt=t=>esc(t).replace(/\*([^*\n]+)\*/g,'<i>$1</i>');
function entry(e,c,s){
  // 예전 기록은 장면 설명을 narr로 저장했으므로 같은 문장이면 상황 문단으로 보여 준다.
  if(e.k==='story'||(e.k==='narr'&&s&&e.text===s.story))return `<p class="story">${fmt(e.text)}</p>`;
  if(e.k==='narr')return `<p class="msg narr">${fmt(e.text)}</p>`;
  if(e.k==='say')return `<p class="msg say"><b>${esc(e.speaker)}</b>“${esc(e.text)}”</p>`;
  if(e.k==='me')return `<p class="msg me"><b>${esc(c.name)} (나)</b>${fmt(e.text)}</p>`;
  if(e.k==='error')return `<p class="msg error">${esc(e.text)}</p>`;
  return '';// 예전 기록의 scene·result 항목은 카드 머리말과 결과 카드가 대신 보여 준다.
}
// 장면 화면 왼쪽: 캐릭터 그림, 이름표, 아침·낮·저녁 진행
function stageArt(c,step,decided){return `<aside class="stage-art">
  <figure class="portrait">${art(c,'card')}<figcaption><strong>${esc(c.name)}</strong>${esc(c.country)} · ${esc(c.region)}${playerTag()}</figcaption></figure>
  <ol class="pips" aria-label="장면 진행">${c.scenes.map((x,i)=>`<li class="${i<step||(i===step&&decided)?'done':i===step?'now':''}">${esc(x.time)}</li>`).join('')}</ol>
</aside>`;}
function chat(c){
  const r=state.run,step=r.step,s=c.scenes[step],ch=chatOf(step),n=r.choices[step];
  const under=`<div class="card-under">${step>0?'<button class="link" data-action="prev-scene">← 이전 장면</button>':'<span></span>'}<span>인물과 대화는 자료를 바탕으로 꾸민 이야기입니다</span></div>`;
  if(n!==null){
    const o=s.options[n],other=s.options[1-n],talked=ch.log.some(e=>e.k==='me'||e.k==='say');
    const waiting=ch.brief===undefined,b=ch.brief;
    return `<div class="game play">${stageArt(c,step,true)}<div class="stage-main">
    <article class="scene-card result" aria-live="polite">
      <header class="card-head"><p class="label">${esc(s.time)} · 장면 ${step+1}/3 브리핑</p><h1>${esc(s.title)}</h1></header>
      <div class="card-body">
        ${waiting?`<p class="msg typing" role="status" aria-label="브리핑을 만드는 중"><i></i><i></i><i></i></p>`:`
        ${lifeCard(c,b?.mine,o.text,o.result,'mine')}
        ${lifeCard(c,b?.other,other.text,other.result,'other')}
        <div class="beyond"><strong>선택을 넘어</strong><p>${esc(s.barrier)}</p></div>
        ${talked?`<details><summary>이 장면의 대화 다시 보기</summary><div class="replay">${ch.log.map(e=>entry(e,c,s)).join('')}</div></details>`:''}`}
      </div>
      <footer class="card-foot"><button class="btn big" data-action="next-scene" ${waiting?'disabled':''}>${step===2?'하루 돌아보기':'다음 장면'} →</button></footer>
    </article>${under}</div></div>`;
  }
  return `<div class="game play">${stageArt(c,step,false)}<div class="stage-main">
  <article class="scene-card">
    <header class="card-head"><p class="label">${esc(s.time)} · 장면 ${step+1}/3</p><h1>${esc(s.title)}</h1>
      <details class="sit"><summary>상황</summary><p>${esc(ch.log.find(e=>e.k==='narr')?.text||s.story)}</p></details></header>
    <div class="card-body" id="log" aria-live="polite">${ch.log.map(e=>entry(e,c,s)).join('')}${pending?passing(c,step,opening):''}</div>
    <footer class="card-foot${AI.ready?' talk':''}">
      ${AI.ready?talkFoot(c,s,ch):`<p class="ask">${esc(c.name)}(이)라면, 어떻게 할까요?</p>${choiceRow(s)}
      <p class="hint">오른쪽 위 <b>AI 연결</b>을 하면 고르기 전에 주변 사람과 자유롭게 대화할 수 있어요.</p>`}
    </footer>
  </article>${under}</div></div>`;}
const choiceRow=s=>`<div class="choice-row">${s.options.map((o,i)=>`<button class="choice" data-pick="${i}" ${pending?'disabled':''}><span class="key">${'AB'[i]}</span><span>${esc(o.text)}</span></button>`).join('')}</div>`;
// 이만큼 말해도 정하지 못하면 두 길을 보여 주는 링크를 낸다.
const STUCK_TALK=8;
// AI와 대화할 때의 아래쪽: 선택지는 숨기고 대화로 정한다.
// AI가 학생의 결정을 알아차리면(proposal) 확인 상자를 띄우고, 학생이 확인해야 장면이 끝난다.
function talkFoot(c,s,ch){
  const talked=ch.log.filter(e=>e.k==='me').length,p=ch.proposal;
  const confirm=Number.isInteger(p)?`<div class="decide" role="group" aria-label="결정 확인">
    <p><b>이렇게 하기로 할까요?</b>${esc(s.options[p].text)}</p>
    <div><button class="btn small" data-action="confirm" ${pending?'disabled':''}>이렇게 정하기</button><button class="btn small ghost" data-action="keep-talking">더 이야기하기</button></div>
  </div>`:'';
  const stuck=!confirm&&talked>=STUCK_TALK?(ch.showOptions?`<p class="small-ask">두 가지 길 가운데 하나를 고를 수도 있어요</p>${choiceRow(s)}`:`<button class="link" data-action="show-options">정하기 어렵다면 두 가지 길 보기</button>`):'';
  const waitChips=!confirm&&!pending&&!ch.chips?.length&&chipsLoading&&state.run.step===0&&!talked;
  const chips=waitChips?'<div class="chips" aria-label="말 고르기를 준비하는 중"><span class="chip-wait"></span><span class="chip-wait"></span><span class="chip-wait"></span></div>':!confirm&&!pending&&ch.chips?.length?`<div class="chips" role="group" aria-label="이렇게 말해 볼까요">${ch.chips.map((x,i)=>`<button type="button" class="chip${x.path==='none'?'':' go'}" data-chip="${i}">${fmt(x.text)}${x.path==='none'?'':'<span aria-hidden="true">→</span>'}</button>`).join('')}</div>`:'';
  return `${confirm}${chips}<form id="say-form" class="say-box">
    <textarea id="say" rows="1" maxlength="500" placeholder="직접 써서 말해 보세요" ${pending?'disabled':''}></textarea>
    <button class="btn small" ${pending?'disabled':''}>보내기</button>
  </form>
  <p class="small-ask${talked?' later':''}">${talked?`말을 고르거나 직접 써 보세요. ${esc(c.name)}(이)가 어떻게 할지 정하면 장면이 이어져요`:`말을 고르거나 직접 써서 주변 사람에게 말을 걸어 보세요`}</p>${stuck}`;
}
function lock(c,n){
  state.run.choices[state.run.step]=n;
  save();render();
  window.scrollTo({top:0,behavior:reduceMotion?'auto':'smooth'});
}
async function say(c,text){
  text=text.trim();if(!text||pending)return;
  const r=state.run,step=r.step,ch=chatOf(step);
  ch.log.push({k:'me',text});ch.proposal=null;ch.chips=[];pending=true;save();render();scrollLog();
  try{
    const {reply,history}=await AI.turn({c,step,past:pastScenes(c),opening:ch.opening,history:ch.api,text});
    if(state.run!==r||r.step!==step)return;
    ch.api=history;
    if(reply.narration?.trim())ch.log.push({k:'narr',text:reply.narration.trim()});
    if(reply.dialogue?.trim())ch.log.push({k:'say',speaker:reply.speaker?.trim()||'주변 사람',text:reply.dialogue.trim().replace(/^["“]|["”]$/g,'')});
    // 학생이 대화로 한 길을 정했으면 확인 상자를 띄운다. 확인은 학생이 한다.
    ch.proposal=reply.decision==='none'?null:'AB'.indexOf(reply.decision);
    ch.chips=reply.chips;
  }catch(err){
    ch.log.pop();
    ch.log.push({k:'error',text:err.message});
    chat.draft=text;
  }
  pending=false;save();render();scrollLog();
}
// 넓은 화면은 카드 안쪽이, 휴대폰·태블릿은 페이지 전체가 스크롤된다. 어느 쪽이든 마지막 말이 보이게 내린다.
function scrollLog(){
  const log=document.querySelector('#log'),behavior=reduceMotion?'auto':'smooth';
  if(!log)return;
  if(log.scrollHeight>log.clientHeight+4){log.scrollTo({top:log.scrollHeight,behavior});return;}
  // 휴대폰·태블릿: 페이지가 스크롤되고 입력 영역이 화면 아래에 붙어 있으므로, 마지막 말이 그 위에 오게 내린다.
  const last=log.lastElementChild;if(!last)return;
  const foot=document.querySelector('.scene-card .card-foot');
  const footH=foot&&getComputedStyle(foot).position==='sticky'?foot.getBoundingClientRect().height:0;
  const target=window.scrollY+last.getBoundingClientRect().bottom-(window.innerHeight-footH)+20;
  if(target>window.scrollY+2)window.scrollTo({top:target,behavior});
}

/* ---------- AI 연결 창 ---------- */
function openAiModal(then){
  const m=document.querySelector('#modal');
  m.setAttribute('aria-label','AI 대화 연결');
  if(AI.server){
    m.innerHTML=`<div class="modal-box"><h2>AI 대화 연결됨</h2><p class="muted small">학교 서버를 통해 Gemini에 연결되어 있어요. 키를 넣지 않아도 바로 대화할 수 있어요. 대화는 Google에 저장되지 않게 보내고, 이 브라우저에만 기록됩니다.</p><div class="actions"><button type="button" class="btn" data-action="ai-skip">확인</button></div></div>`;
    m.hidden=false;openAiModal.then=then;return;
  }
  m.innerHTML=`<form class="modal-box" id="ai-form">
    <h2>AI 대화 연결</h2>
    <p class="muted small">Gemini API 키를 넣으면 캐릭터 주변 인물이 학생의 말에 답합니다. 키는 이 탭의 메모리에만 있고 어디에도 저장되지 않습니다. <strong>새로고침하면 다시 넣어야 합니다.</strong></p>
    <label class="field compact"><span>Gemini API 키</span><input type="password" id="ai-key" autocomplete="off" spellcheck="false" placeholder="AIza…"></label>
    <label class="field compact"><span>모델</span><select id="ai-model">${AI.MODELS.map(([id,label])=>`<option value="${id}"${id===AI.model?' selected':''}>${esc(label)}</option>`).join('')}</select></label>
    <p class="muted small">키는 Google(generativelanguage.googleapis.com)로만 전송됩니다. 교사용 키를 쓰고, Google AI Studio에서 이 사이트에서만 쓰도록 제한해 두세요.</p>
    <p id="ai-msg" class="small" role="status"></p>
    <div class="actions"><button class="btn">연결 확인</button>${AI.ready?'<button type="button" class="btn ghost" data-action="ai-off">연결 끊기</button>':''}<button type="button" class="link" data-action="ai-skip">AI 없이 진행</button></div>
  </form>`;
  m.hidden=false;openAiModal.then=then;
  m.querySelector('#ai-key').focus();
}
// 플레이어 등록 팝업: 캐릭터를 고른 뒤 이름을 적고 그 사람의 하루를 시작한다.
function openJoinModal(c){
  const m=document.querySelector('#modal');
  m.setAttribute('aria-label','플레이어 등록');
  m.innerHTML=`<form class="modal-box join" id="join-form">
    <div class="join-face">${art(c,'face')}</div>
    <p class="label">플레이어 등록</p>
    <h2>오늘 하루, 나는 ${esc(c.name)}입니다</h2>
    <p class="muted small">${esc(c.country)} · ${esc(c.region)}에 사는 ${esc(c.role)}의 아침·낮·저녁을 살아 봅니다.</p>
    <label class="field join-field"><span>플레이어 이름</span><input id="join-name" maxlength="20" autocomplete="off" enterkeyhint="go" value="${esc(fields().nickname||'')}" placeholder="이름이나 별명"></label>
    <button class="btn big join-go">${esc(c.name)}의 하루 시작하기 →</button>
    <button type="button" class="link" data-action="ai-skip">다시 고를래요</button>
  </form>`;
  m.hidden=false;openAiModal.then=null;
  setTimeout(()=>m.querySelector('#join-name')?.focus(),50);
  AI.serverCheck.then(()=>prefetchChips(c));
}
function closeModal(){const m=document.querySelector('#modal');m.hidden=true;m.innerHTML='';const then=openAiModal.then;openAiModal.then=null;renderStatus();if(then)then();}
// 상단의 AI 연결 표시는 없앴다. 학교 서버 키로 자동 연결된다.
function renderStatus(){}
// 학교 서버에 키가 있으면 키 입력 없이 바로 연결된다.
AI.serverCheck.then(ok=>{if(!ok)return;renderStatus();if(view==='chat')render();});

/* ---------- 돌아보기 이후: 게임 화면과 같은 틀(왼쪽 그림, 오른쪽 종이 카드) ---------- */
const EPI=['돌아보기','질문·조사','결과물','완성'];
function epiArt(c,active,extra=''){return `<aside class="stage-art">
  <figure class="portrait">${art(c,'card')}<figcaption><strong>${esc(c.name)}</strong>${esc(c.country)} · ${esc(c.region)}${playerTag()}</figcaption></figure>
  <ol class="pips" aria-label="마무리 단계">${EPI.map((t,i)=>`<li class="${i<active?'done':i===active?'now':''}"${i===active?' aria-current="step"':''}>${t}</li>`).join('')}</ol>
  ${extra||`<p class="wish">“${esc(c.wish)}”</p>`}
</aside>`;}
// 하루 동안 고른 세 선택을 작은 카드로
function recap(c){return `<div class="recap">${c.scenes.map((s,i)=>{const o=s.options[state.run.choices[i]];return `<div class="recap-item"><span class="label">${esc(s.time)}</span><strong>${esc(o?.text||'고르지 않음')}</strong><details><summary>선택을 넘어</summary><p>${esc(s.barrier)}</p></details></div>`;}).join('')}</div>`;}
function sec(title,body,note=''){return `<section class="sec"><h2>${title}</h2>${note?`<p class="sec-note">${note}</p>`:''}${body}</section>`;}

function reflect(c){return `<div class="game">${epiArt(c,0)}<div class="stage-main"><article class="paper-card">
  <header class="card-head"><p class="label">마무리 1/4 · 돌아보기</p><h1>어려웠던 건, 선택만의 문제였을까요?</h1></header>
  <form id="reflection-form">
    <div class="card-body">
      ${sec('나의 하루',recap(c),'세 장면에서 내가 고른 것입니다. ‘선택을 넘어’를 펼쳐 다시 읽어 보세요.')}
      ${sec('생각해 보기',field('feeling',`${c.name}에게 가장 중요했던 것은?`,'한두 문장이면 충분해요. 예: 친구와 함께 학교에 다니는 평범한 하루',true)+field('constraint','내 선택만으로는 바꾸기 어려웠던 것은?','예: 물을 길으러 가야 하는 거리, 일꾼을 쓸 수 없는 형편',true,'시설·돈·제도·안전 가운데 떠오르는 것을 적어 보세요.'))}
    </div>
    <footer class="card-foot step-nav"><button class="btn ghost back" type="button" data-nav="chat">← 대화로</button><button class="btn big" type="submit">질문 만들고 조사하기 →</button></footer>
  </form>
</article></div></div>`;}

// 조사하기: 처음에 본 확인된 사실과 원문 출처, 그리고 나라·주제별로 더 찾아볼 수 있는 공신력 있는 사이트.
const ISO={tuvalu:['tuv'],pakistan:['pak'],bangladesh:['bgd'],somalia:['som'],gaza:['pse'],haiti:['hti'],ghana:['gha'],sudan:['sdn','tcd'],rohingya:['mmr','bgd'],afghanistan:['afg'],congo:['cod'],qatar:['qat']};
const ISO_NAME={tuv:'투발루',pak:'파키스탄',bgd:'방글라데시',som:'소말리아',pse:'팔레스타인',hti:'아이티',gha:'가나',sdn:'수단',tcd:'차드',mmr:'미얀마',afg:'아프가니스탄',cod:'콩고민주공화국',qat:'카타르'};
const THEME_SITE={
  환경:{title:'UN 뉴스 · 기후변화',desc:'기후 위기 관련 유엔 소식',url:'https://news.un.org/en/news/topic/climate-change'},
  물:{title:'WHO·UNICEF 식수·위생 통계(JMP)',desc:'나라별 안전한 식수·화장실 이용률',url:'https://washdata.org/data'},
  빈곤:{title:'UNDP 인간개발보고서 데이터',desc:'나라별 소득·교육·건강 지표',url:'https://hdr.undp.org/data-center/specific-country-data'},
  난민:{title:'UNHCR 난민 현황 데이터',desc:'지역별 난민 수와 상황 보고',url:'https://data.unhcr.org/en/situations'},
  인권:{title:'국제앰네스티 한국지부',desc:'인권 보고서와 캠페인(한국어)',url:'https://amnesty.or.kr'},
};
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,'');}catch{return '';}};
const linkCard=(kind,title,meta,url)=>`<a class="src-card" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span class="src-kind">${esc(kind)}</span><strong>${esc(title)}</strong><span class="src-meta">${esc(meta)}</span><span class="src-go" aria-hidden="true">↗</span></a>`;
// 학생 화면에 링크가 있는 자료 전부. AI 조사 도우미도 이 목록 안에서만 자료를 가리킨다.
function refs(c){return [
  ...c.sources.map(x=>({kind:'원문 출처',title:x.title,meta:`${x.date} · ${host(x.url)}`,url:x.url})),
  ...(ISO[c.id]||[]).map(k=>({kind:'현지 소식',title:`ReliefWeb · ${ISO_NAME[k]}`,meta:'유엔이 모은 최신 상황 보고서 · reliefweb.int',url:`https://reliefweb.int/country/${k}`})),
  ...(THEME_SITE[c.theme]?[THEME_SITE[c.theme]].map(t=>({kind:'통계·자료',title:t.title,meta:`${t.desc} · ${host(t.url)}`,url:t.url})):[]),
];}
function sourcesPanel(c){
  const all=refs(c),card=r=>linkCard(r.kind,r.title,r.meta,r.url);
  return `<details class="src-fold"><summary>자료 열어 보기 <span>${all.length}곳</span></summary>
    <p class="sec-note">‘실제로 확인된 사실’과 그 원문입니다. 영어 사이트는 브라우저 번역을 켜고 읽어도 돼요. 자료의 날짜를 꼭 확인하세요.</p>${facts(c)}
    <div class="src-grid">${all.map(card).join('')}</div></details>`;
}

// 질문을 처음부터 쓰기 막막하지 않게: 출발 질문과 빈칸 틀을 눌러서 시작한다.
const frames=c=>[
  c.question,
  `${c.name} 같은 사람이 ____하려면 누가 무엇을 해야 할까?`,
  `왜 ${c.region}에서는 ____이(가) 어려울까?`,
  `____을(를) 돕는 방법에는 어떤 한계나 부작용이 있을까?`,
];
const QUICK=[['내 질문에 답해 줘','mine'],['왜 이런 일이 생기는지 쉽게 설명해 줘'],['이미 누가 어떤 노력을 하고 있어?'],['정부·기업·국제사회는 각각 어떻게 볼까?']];
const labOf=()=>{const r=state.run;if(!r.lab||!Array.isArray(r.lab.log)||!Array.isArray(r.lab.api))r.lab={log:[],api:[]};return r.lab;};
let asking=false;
function askEntry(e,i){
  if(e.k==='me')return `<div class="ask-me">${esc(e.text)}</div>`;
  if(e.k==='error')return `<div class="msg error">${esc(e.text)}</div>`;
  return `<div class="ask-a">${e.answer.split(/\n+/).map(p=>`<p>${esc(p)}</p>`).join('')}
    ${e.check?`<p class="ask-check">직접 확인해 볼 자료 · <strong>${esc(e.check)}</strong></p>`:''}
    ${e.point?`<button class="btn ghost small" data-take="${i}"${e.taken?' disabled':''}>${e.taken?'메모에 담았어요':'핵심을 메모에 담기'}</button>`:''}</div>`;
}
function askPanel(){
  const lab=labOf(),last=[...lab.log].reverse().find(e=>e.k==='ai');
  if(!AI.ready)return `<div class="ask-off"><p>AI가 연결되어 있지 않아요. 자료를 직접 읽고 메모해도 됩니다.</p><button class="btn ghost" data-action="ai-settings">AI 연결하기</button></div>`;
  const quick=last?.followups?.length?last.followups.map(t=>[t]):QUICK;
  return `<div class="ask-log" id="ask-log" aria-live="polite">${lab.log.length?lab.log.map(askEntry).join(''):'<p class="ask-empty">궁금한 것을 물어보세요. AI 답은 틀릴 수 있으니, 함께 알려 주는 자료에서 직접 확인해요.</p>'}${asking?'<div class="msg typing" aria-label="답을 쓰는 중"><i></i><i></i><i></i></div>':''}</div>
    <div class="chips">${quick.map(([t,k])=>`<button class="chip" data-ask="${esc(k||t)}"${asking?' disabled':''}>${esc(t)}</button>`).join('')}</div>
    <form id="ask-form" class="ask-form"><textarea id="ask" rows="1" maxlength="600" placeholder="AI에게 직접 물어보기"${asking?' disabled':''}></textarea><button class="btn" type="submit"${asking?' disabled':''}>묻기</button></form>`;
}
function renderAsk(){const p=document.querySelector('#ask-panel');if(!p)return;p.innerHTML=askPanel();const log=p.querySelector('#ask-log');if(log)log.scrollTop=log.scrollHeight;}
async function ask(c,text){
  text=String(text||'').trim();if(!text||asking)return;
  const lab=labOf();lab.log.push({k:'me',text});asking=true;save();renderAsk();
  try{
    const {reply,history}=await AI.research({c,fields:fields(),refs:refs(c),history:lab.api,text});
    lab.api=history;lab.log.push({k:'ai',...reply});
  }catch(err){lab.log.push({k:'error',text:err.message});}
  asking=false;save();renderAsk();
}

function lab(c){return `<div class="game">${epiArt(c,1)}<div class="stage-main"><article class="paper-card">
  <header class="card-head"><p class="label">마무리 2/4 · 질문·조사</p><h1>궁금한 것 하나를 골라, 깊이 알아봐요.</h1></header>
  <div class="card-body">
    ${sec('① 나의 질문',`<div class="frames">${frames(c).map((t,i)=>`<button class="chip" data-frame="${i}">${i===0?'출발 질문 · ':''}${esc(t)}</button>`).join('')}</div>`+field('question','내가 알아볼 질문','위의 틀을 누르고 빈칸을 채우거나, 직접 써 보세요.',true),'하나만 정하면 돼요. 눌러서 시작하고 내 말로 고쳐 보세요.')}
    ${sec('② 알아보기',`${sourcesPanel(c)}<div id="ask-panel" class="ask-panel">${askPanel()}</div>`,'AI에게 묻고, 자료에서 직접 확인해 보세요.')}
    ${sec('③ 알게 된 것',field('notes','알게 된 것과 근거','예: 해안 지역은 지하수에 바닷물이 섞여 마시기 어렵다 (유니세프 자료)',true,'‘핵심을 메모에 담기’로 옮긴 뒤 내 말로 고쳐도 돼요. 어디서 확인했는지 괄호에 적어 주세요.'))}
  </div>
  <footer class="card-foot step-nav"><button class="btn ghost back" data-nav="reflect">← 돌아보기</button><button class="btn big" data-action="to-plan">결과물 만들기 →</button></footer>
</article></div></div>`;}

// 결과물: 조사한 것을 어떤 글로 내놓을지 고르고, 그 형식에 맞는 네 칸을 채운다. 완성 화면과 갤러리는 이 형식의 서식으로 나온다.
const FORMATS={
  article:{name:'신문 기사',desc:'알게 된 사실을 많은 사람에게 알려요.',fields:[
    ['a_title','제목','예: 물은 있지만 마실 수 없는 마을','문제가 한눈에 보이게 짧게.'],
    ['a_lead','첫 문단 · 누구에게 무슨 일이','어디에서, 누가, 어떤 어려움을 겪고 있나요? 두세 문장으로.'],
    ['a_body','왜 그럴까 · 원인과 근거','조사에서 알게 된 사실을 쓰고, 어디서 확인했는지 밝혀 주세요.'],
    ['a_end','맺음 · 독자에게','읽는 사람이 함께 생각해 볼 질문이나 할 수 있는 일.'],
  ]},
  policy:{name:'정책 제안서',desc:'정부나 기관에 해결 방법을 제안해요.',fields:[
    ['p_title','제안 이름','예: 해안 마을 정수 시설 관리비 지원','무엇을 하자는 제안인지 한 줄로.'],
    ['p_problem','문제','누가 어떤 권리를 누리지 못하고 있나요? 근거와 함께.'],
    ['p_plan','제안 내용','누가(정부·기업·국제기구·주민) 무엇을 하면 될까요?'],
    ['p_limit','예상되는 어려움과 보완','비용이나 부작용은? 현지 사람들의 의견은 어떻게 들을까요?'],
  ]},
  letter:{name:'편지',desc:'책임 있는 곳이나 이야기 속 인물에게 내 목소리를 전해요.',fields:[
    ['l_to','받는 사람','예: 초콜릿 회사 대표님 / 유니세프 담당자님 / 코피에게','누구에게 쓰는지에 따라 부탁도 달라져요.'],
    ['l_learned','내가 알게 된 것','체험과 조사에서 알게 된 사실을 전해 주세요.'],
    ['l_ask','부탁하거나 제안하는 것','받는 사람이 실제로 할 수 있는 일을 구체적으로.'],
    ['l_me','나도 할 일','내가 할 수 있는 작은 행동 한 가지.'],
  ]},
};
const fmtOf=()=>FORMATS[fields().format];
// 피드백 대화: 이야기 속 인물과 선생님이 내 글을 읽고 말하고, 나는 칩이나 직접 쓴 말로 대답한다(시뮬레이션과 같은 방식).
let reviewing=false;
const reviewOf=()=>{const r=state.run;if(!r.review||!Array.isArray(r.review.log)||!Array.isArray(r.review.api))r.review={log:[],api:[]};return r.review;};
const draftParts=()=>{const f=fields(),fm=fmtOf();return fm.fields.map(([n,l])=>[l,f[n]||'']);};
function reviewPanel(c){
  const rv=reviewOf(),last=[...rv.log].reverse().find(e=>e.k==='say');
  if(!AI.ready)return `<div class="ask-off"><p>AI가 연결되어 있지 않아 피드백 대화는 쓸 수 없어요.</p><button type="button" class="btn ghost" data-action="ai-settings">AI 연결하기</button></div>`;
  if(!rv.log.length)return `<div class="tool-row"><button type="button" class="btn" data-action="review-start"${reviewing?' disabled':''}>${esc(c.name)}와 선생님에게 보여 주기</button><span class="sec-note">${esc(c.name)}는 당사자로서, 선생님은 글과 해결책을 보고 이야기해 줘요.</span></div>${reviewing?'<div class="msg typing" aria-label="읽는 중"><i></i><i></i><i></i></div>':''}`;
  const line=e=>e.k==='me'?`<div class="msg me">${esc(e.text)}</div>`:e.k==='error'?`<div class="msg error">${esc(e.text)}</div>`:e.k==='mark'?`<p class="rv-mark">${esc(e.text)}</p>`:`<div class="msg say"><b>${esc(e.speaker)}</b> ${esc(e.text)}</div>`;
  return `<div class="rv-log" id="rv-log" aria-live="polite">${rv.log.map(line).join('')}${reviewing?'<div class="msg typing" aria-label="답을 쓰는 중"><i></i><i></i><i></i></div>':''}</div>
    ${!reviewing&&last?.chips?.length?`<div class="chips">${last.chips.map((t,i)=>`<button type="button" class="chip" data-rv="${i}">${esc(t)}</button>`).join('')}</div>`:''}
    <div class="rv-form"><textarea id="rv-say" rows="1" maxlength="600" placeholder="직접 대답하기"${reviewing?' disabled':''}></textarea><button type="button" class="btn" data-action="rv-send"${reviewing?' disabled':''}>보내기</button></div>
    <div class="tool-row"><button type="button" class="btn ghost small" data-action="review-again"${reviewing?' disabled':''}>고친 글 다시 보여 주기</button></div>`;
}
function renderReview(c){const p=document.querySelector('#rv-panel');if(!p)return;p.innerHTML=reviewPanel(c);const log=p.querySelector('#rv-log');if(log)log.scrollTop=log.scrollHeight;}
async function reviewSay(c,text,mark){
  text=String(text||'').trim();if(!text||reviewing)return;
  const rv=reviewOf();
  if(mark)rv.log.push({k:'mark',text:mark});else rv.log.push({k:'me',text});
  reviewing=true;save();renderReview(c);
  try{
    const {reply,history}=await AI.review({c,fields:fields(),kind:fmtOf().name,parts:draftParts(),history:rv.api,text});
    rv.api=history;rv.log.push({k:'say',...reply});
  }catch(err){rv.log.push({k:'error',text:err.message});}
  reviewing=false;save();renderReview(c);
}
function plan(c){const f=fields(),fm=fmtOf();return `<div class="game">${epiArt(c,2)}<div class="stage-main"><article class="paper-card">
  <header class="card-head"><p class="label">마무리 3/4 · 결과물 만들기</p><h1>알게 된 것을, 세상에 내놓을 글로.</h1></header>
  <form id="plan-form">
    <div class="card-body">
      ${sec('① 어떤 글로 만들까',`<div class="formats" role="radiogroup" aria-label="결과물 형식">${Object.entries(FORMATS).map(([k,x])=>`<button type="button" class="format${f.format===k?' on':''}" role="radio" aria-checked="${f.format===k}" data-format="${k}"><span class="thumb thumb-${k}" aria-hidden="true"><i></i><i></i><i></i><i></i></span><strong>${x.name}</strong><span>${x.desc}</span></button>`).join('')}</div>`,'완성하면 고른 형식의 서식으로 갤러리에 올라가요.')}
      ${fm?sec(`② ${fm.name} 쓰기`,`<div class="my-research"><p><strong>나의 질문</strong>${esc(f.question||'')}</p><p><strong>알게 된 것</strong>${esc(f.notes||'')}</p></div>`+fm.fields.map(([n,l,p,h])=>field(n,l,p,true,h||'')).join('')):''}
      ${fm?sec('③ 피드백 대화',`<div id="rv-panel" class="rv-panel">${reviewPanel(c)}</div>`,'AI는 글을 대신 써 주지 않아요. 대화를 보고 고칠지는 내가 정해요.'):''}
    </div>
    <footer class="card-foot step-nav"><button type="button" class="btn ghost back" data-nav="lab">← 질문·조사</button><button class="btn big" type="submit"${fm?'':' disabled'}>완성하기 →</button></footer>
  </form>
</article></div></div>`;}

/* ---------- 완성: 고른 형식의 서식으로 보여 주고 갤러리에 제출 ---------- */
const paras=t=>String(t||'').split(/\n+/).map(s=>s.trim()).filter(Boolean).map(s=>`<p>${esc(s)}</p>`).join('')||'<p>(작성하지 않음)</p>';
// 서식 공통 조각
const firstSentence=t=>{const s=String(t||'').trim().split(/\n+/)[0]||'';const m=s.match(/^.+?[.!?](?=\s|$)/);return (m?m[0]:s).trim();};
const longDate=f=>{const d=f._ts?new Date(f._ts):new Date(state.run?.finishedAt||Date.now());return d.toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Seoul'});};
const docNo=f=>{const d=f._ts?new Date(f._ts):new Date(state.run?.finishedAt||Date.now());const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;};
const factBox=c=>`<ul>${c.facts.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p class="doc-src">출처 · ${c.sources.map(s=>`${esc(s.title)} (${esc(s.date)})`).join(' · ')}</p>`;
const fictionNote=c=>`<p class="doc-note">이 글은 중학교 도덕 수업 ‘다른 곳의 하루’에서 학생이 쓴 학습 결과물입니다. ${esc(c.name)}의 이야기와 장면은 실제 자료를 바탕으로 꾸민 가상 시뮬레이션입니다.</p>`;

// 신문 기사: 일간지 1면처럼 가운데 제호 → 발행 정보 띠 → 섹션 머리 → 제목 → 바이라인 → 리드 → 사진과 설명 → 2단 본문 → 해설 → 팩트 체크
function docArticle(c,f){return `<article class="doc doc-article">
  <header class="np-mast"><p class="np-name">지구촌 탐구 신문</p>
    <p class="np-issue"><span>제1호</span><span>${longDate(f)}</span><span>국제</span></p></header>
  <p class="np-kicker">국제 <b>${esc(c.country)}</b> · ${esc(c.theme)}</p>
  <h1 class="np-title">${esc(f.a_title||'제목 없음')}</h1>
  <p class="np-byline"><b>${esc(f.nickname||'익명')} 기자</b><span>${esc(c.region)}</span></p>
  <div class="np-lead">${paras(f.a_lead)}</div>
  <div class="np-cols">
    <figure class="np-photo"><img src="${artSrc(c.id)}" alt="" loading="lazy"><figcaption>이야기 속 인물 ${esc(c.name)}(${esc(c.role)}). 실제 자료를 바탕으로 만든 가상 인물의 일러스트다.</figcaption></figure>
    ${paras(f.a_body)}
    <blockquote class="np-quote">“${esc(c.wish)}”<cite>— ${esc(c.name)}(가상 인물)의 바람</cite></blockquote>
    <section class="np-opinion"><h3>함께 생각해 볼 것</h3>${paras(f.a_end)}</section>
  </div>
  <aside class="np-box"><h4>팩트 체크</h4>${factBox(c)}</aside>
  <footer class="np-foot">지구촌 탐구 신문 · 학생 기자가 직접 조사해 쓴 학습 신문입니다. ${fictionNote(c)}</footer>
</article>`;}

// 정책 제안서: 정책 보고서처럼 제안 번호 → 제목 → 핵심 요약 → 수신·발신 표 → Ⅰ~Ⅳ 장 → 맺음
function docPolicy(c,f){return `<article class="doc doc-policy">
  <header class="pb-band"><span>정책 제안서 <i>POLICY PROPOSAL</i></span><span>제안 번호 ${docNo(f)}</span></header>
  <h1 class="pb-title">${esc(f.p_title||'제안 이름 없음')}</h1>
  <section class="pb-summary"><h2>핵심 요약</h2><ul>
    <li><b>문제</b>${esc(firstSentence(f.p_problem))}</li>
    <li><b>제안</b>${esc(firstSentence(f.p_plan))}</li>
    <li><b>보완</b>${esc(firstSentence(f.p_limit))}</li></ul></section>
  <table class="pb-meta"><tbody>
    <tr><th>수신</th><td>${esc(c.actors)}</td></tr>
    <tr><th>제안자</th><td>${esc(f.nickname||'익명')}</td></tr>
    <tr><th>대상 지역</th><td>${esc(c.country)} · ${esc(c.region)}</td></tr>
    <tr><th>작성일</th><td>${longDate(f)}</td></tr>
  </tbody></table>
  <section class="pb-sec"><h2><span>Ⅰ</span>현황과 문제</h2>${paras(f.p_problem)}</section>
  <section class="pb-sec"><h2><span>Ⅱ</span>정책 제안</h2>${paras(f.p_plan)}</section>
  <section class="pb-sec"><h2><span>Ⅲ</span>예상 쟁점과 보완 방안</h2>${paras(f.p_limit)}</section>
  <section class="pb-sec pb-ref"><h2><span>Ⅳ</span>근거 자료</h2>${factBox(c)}</section>
  <footer class="pb-foot">${fictionNote(c)}</footer>
</article>`;}

// 편지: 받는 분 → 본문 → 날짜 → 보내는 사람. 오른쪽 위에 캐릭터 우표.
function docLetter(c,f){return `<article class="doc doc-letter">
  <div class="lt-stamp" aria-hidden="true"><img src="${artSrc(c.id,'face')}" alt=""><span>${esc(c.country)}</span></div>
  <p class="lt-to">${esc(f.l_to||'받는 분께')}</p>
  <div class="lt-body">${paras(f.l_learned)}${paras(f.l_ask)}${paras(f.l_me)}</div>
  <p class="lt-date">${longDate(f)}</p>
  <p class="lt-from">${esc(f.nickname||'')} 드림</p>
  <footer class="lt-ps"><p>덧붙임 · 이 편지는 ${esc(c.country)} ${esc(c.region)}의 상황을 다룬 수업에서 썼습니다. 제가 읽은 자료: ${c.sources.map(s=>esc(s.title)).join(', ')}</p>${fictionNote(c)}</footer>
</article>`;}
const DOCS={article:docArticle,policy:docPolicy,letter:docLetter};
function appendix(c){const r=state.run,f=fields(),row=(l,t)=>`<div class="ap-row"><h3>${esc(l)}</h3>${paras(t)}</div>`;return `<section class="appendix">
  <h2>탐구 과정</h2>
  <div class="ap-row"><h3>${esc(c.name)}의 하루에서 내가 고른 것</h3><ol>${c.scenes.map((s,i)=>`<li><strong>${esc(s.time)}</strong> ${esc(s.options[r.choices[i]]?.text||'고르지 않음')}</li>`).join('')}</ol></div>
  ${row('가장 중요했던 것',f.feeling)}${row('내 선택만으로 바꾸기 어려웠던 것',f.constraint)}${row('나의 질문',f.question)}${row('알게 된 것과 근거',f.notes)}
  <div class="ap-row"><h3>참고 자료</h3>${sourceList(c)}</div>
</section>`;}
function report(c){const f=fields(),fm=fmtOf();
  const side=`<div class="clear-badge">하루를 마쳤어요</div>
  <div class="side-actions no-print"><button class="link" data-nav="plan">← ${esc(fm.name)} 고치기</button></div>`;
  return `<div class="game">${epiArt(c,4,side)}<div class="stage-main"><article class="paper-card report">
  <header class="card-head no-print"><p class="label">마무리 4/4 · 완성</p><h1>나의 ${esc(fm.name)}가 완성됐어요.</h1><p class="muted">아래에서 확인하고, 맨 아래에서 제출하세요.</p></header>
  <div class="card-body">${DOCS[f.format](c,f)}${appendix(c)}${submitBox()}</div>
  <footer class="card-foot no-print"><button class="btn ghost" data-nav="gallery">갤러리 보기</button><button class="btn ghost" data-action="random">다른 캐릭터 뽑기</button><p class="sec-note">새 캐릭터를 시작하면 지금 기록이 바뀝니다. 먼저 제출해 두세요.</p></footer>
</article></div></div>`;}

/* ---------- 제출과 갤러리 ---------- */
// 학년·반·번호·이름은 다음 캐릭터를 할 때도 다시 쓰도록 state.me에 둔다.
const GALLERY_PATH='api/gallery';
const meOf=()=>{if(!state.me||typeof state.me!=='object')state.me={grade:'',cls:'',num:'',name:''};return state.me;};
let submitting=false;
function submitBox(){
  const me=meOf(),done=state.run.submittedAt;
  const num=(k,l,max)=>`<label class="sub-field"><span>${l}</span><input type="number" inputmode="numeric" min="1" max="${max}" data-me="${k}" value="${esc(me[k])}"></label>`;
  return `<form id="submit-form" class="submit-box no-print">
    <h2>제출하기</h2>
    <p class="sec-note">제출하면 결과물이 <strong>갤러리</strong>에 올라가 친구들과 함께 볼 수 있어요. 갤러리에는 이름 가운데 글자를 가려서 보여 줘요(예: 김*수). 다시 제출하면 최신 글로 바뀝니다.</p>
    <div class="sub-row">${num('grade','학년',6)}${num('cls','반',30)}${num('num','번호',60)}<label class="sub-field name"><span>이름</span><input maxlength="10" autocomplete="off" data-me="name" value="${esc(me.name)}" placeholder="실명"></label></div>
    <div class="sub-go"><button class="btn big" type="submit"${submitting?' disabled':''}>${submitting?'제출하는 중…':done?'다시 제출하기':'제출하기'}</button>${done?`<span class="sub-done">✓ ${new Date(done).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}에 제출했어요</span><button type="button" class="btn ghost" data-nav="gallery">갤러리 보기</button>`:''}</div>
  </form>`;
}
async function submitWork(c){
  const me=meOf(),f=fields(),fm=fmtOf();
  const grade=Number(me.grade),cls=Number(me.cls),num=Number(me.num),name=String(me.name||'').trim();
  if(!grade||!cls||!num||!name){dialog({title:'학년·반·번호·이름을 모두 적어 주세요'});return;}
  if(submitting)return;submitting=true;render();
  const data=Object.fromEntries([...fm.fields.map(([n])=>n),'question','notes','feeling','constraint'].map(k=>[k,f[k]||'']));
  data.choices=state.run.choices;
  try{
    const res=await fetch(GALLERY_PATH,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'submit',sub:{grade,cls,num,name,cid:c.id,format:f.format,data}})});
    const out=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error({bad_number:'학년·반·번호를 확인해 주세요.',bad_name:'이름은 10자 안으로, 기호 없이 적어 주세요.',empty_field:'빈칸이 있어요. 결과물을 먼저 채워 주세요.',not_configured:'이 사이트에서는 갤러리를 쓸 수 없어요.',rate_limited:'잠시 뒤에 다시 제출해 주세요.'}[out?.error?.code]||'제출하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    state.run.submittedAt=new Date().toISOString();gallery.items=null;toast(out.replaced?'다시 제출했어요. 갤러리의 글이 바뀌었어요.':'제출했어요! 갤러리에서 볼 수 있어요.');
  }catch(err){dialog({title:'제출하지 못했어요',body:err.message});}
  submitting=false;save();render();
}

const gallery={items:null,loading:false,error:'',filter:{cls:'',format:'',cid:''},admin:''};
async function loadGallery(){
  if(gallery.loading)return;gallery.loading=true;gallery.error='';
  try{
    const res=gallery.admin
      ?await fetch(GALLERY_PATH,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'list',admin:gallery.admin})})
      :await fetch(GALLERY_PATH,{cache:'no-store'});
    const out=await res.json().catch(()=>({}));
    if(!res.ok){if(out?.error?.code==='bad_admin'){gallery.admin='';throw new Error('교사 비밀번호가 맞지 않아요.');}throw new Error(out?.error?.code==='not_configured'?'이 사이트에서는 갤러리를 쓸 수 없어요.':'갤러리를 불러오지 못했어요.');}
    gallery.items=Array.isArray(out.items)?out.items:[];
  }catch(err){gallery.error=err.message;if(!gallery.items)gallery.items=[];}
  gallery.loading=false;if(view==='gallery')render();
}
const who=it=>`${it.grade}학년 ${it.cls}반 ${it.num}번 ${it.name}`;
const titleOf=it=>({article:it.data.a_title,policy:it.data.p_title,letter:it.data.l_to})[it.format]||'';
const gistOf=it=>({article:it.data.a_lead,policy:it.data.p_problem,letter:it.data.l_ask})[it.format]||'';
function galleryView(){
  if(!gallery.items&&!gallery.loading)loadGallery();
  const items=gallery.items||[],F=gallery.filter;
  const classes=[...new Set(items.map(it=>`${it.grade}-${it.cls}`))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const shown=items.filter(it=>(!F.cls||`${it.grade}-${it.cls}`===F.cls)&&(!F.format||it.format===F.format)&&(!F.cid||it.cid===F.cid));
  const card=it=>{const c=cases.find(x=>x.id===it.cid);if(!c)return '';return `<article class="gcard" style="--tone:${TONE[c.id]}">
    <button class="gcard-open" data-open="${esc(it.key)}"><span class="gcard-kind">${esc(FORMATS[it.format]?.name||'')}</span><strong>${esc(titleOf(it))}</strong><span class="gcard-gist">${esc(gistOf(it).slice(0,110))}${gistOf(it).length>110?'…':''}</span>
    <span class="gcard-foot"><span class="gcard-face">${art(c,'face')}</span><span><b>${esc(c.name)}</b> · ${esc(c.country)}<br>${esc(who(it))}</span></span></button>
    ${gallery.admin?`<button class="gcard-del" data-del="${esc(it.key)}" aria-label="${esc(who(it))}의 결과물 지우기">지우기</button>`:''}</article>`;};
  return `<div class="page-head"><h1>결과물 갤러리</h1><p class="muted">‘다른 곳의 하루’를 마친 친구들이 낸 신문 기사·정책 제안서·편지입니다. 카드를 누르면 크게 볼 수 있어요.</p></div>
  <div class="g-filters">
    <select data-gfilter="cls" aria-label="학년·반"><option value="">모든 반</option>${classes.map(k=>`<option value="${k}"${F.cls===k?' selected':''}>${k.replace('-','학년 ')}반</option>`).join('')}</select>
    <select data-gfilter="format" aria-label="형식"><option value="">모든 형식</option>${Object.entries(FORMATS).map(([k,x])=>`<option value="${k}"${F.format===k?' selected':''}>${x.name}</option>`).join('')}</select>
    <select data-gfilter="cid" aria-label="캐릭터"><option value="">모든 캐릭터</option>${cases.map(c=>`<option value="${c.id}"${F.cid===c.id?' selected':''}>${esc(c.name)} · ${esc(c.country)}</option>`).join('')}</select>
    <button class="btn ghost" data-action="gallery-reload" aria-label="갤러리 새로고침"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>새로고침</button>
  </div>
  <p class="g-count">${gallery.loading?'불러오는 중…':`${shown.length}장`}</p>
  ${gallery.error?`<p class="msg error">${esc(gallery.error)}</p>`:''}
  ${!gallery.loading&&!shown.length&&!gallery.error?'<p class="g-empty">아직 올라온 결과물이 없어요.</p>':''}
  <div class="board">${shown.map(card).join('')}</div>
  <p class="g-admin">${gallery.admin?'관리 모드 · 전체 이름이 보이고 지울 수 있어요. <button class="link" data-action="gallery-admin-off">관리 모드 끄기</button>':'<button class="link" data-action="gallery-admin">선생님 관리 모드</button>'}</p>`;
}
function openWork(key){
  const it=(gallery.items||[]).find(x=>x.key===key),c=it&&cases.find(x=>x.id===it.cid);if(!c)return;
  const f={...it.data,format:it.format,nickname:`${it.grade}학년 ${it.cls}반 ${it.name}`,_ts:it.updated};
  const m=document.querySelector('#modal');
  m.setAttribute('aria-label',`${who(it)}의 ${FORMATS[it.format]?.name||'결과물'}`);
  m.innerHTML=`<div class="modal-box work-view" style="--tone:${TONE[c.id]}"><div class="work-bar"><span>${esc(who(it))} · ${esc(c.name)}의 하루</span><button class="btn ghost small" data-action="ai-skip">닫기</button></div>${DOCS[it.format](c,f)}<div class="work-research"><h3>나의 질문</h3>${paras(f.question)}<h3>알게 된 것과 근거</h3>${paras(f.notes)}</div></div>`;
  m.hidden=false;openAiModal.then=null;m.querySelector('.work-view').scrollTop=0;
}

function openAdmin(){
  const m=document.querySelector('#modal');m.setAttribute('aria-label','선생님 관리 모드');
  m.innerHTML=`<form class="modal-box" id="admin-form"><p class="label">선생님 관리 모드</p><h2>교사 비밀번호</h2><p class="muted small">전체 이름을 보고, 부적절한 결과물을 지울 수 있어요.</p><label class="field"><span>비밀번호</span><input id="admin-pw" type="password" autocomplete="off"></label><div class="actions"><button class="btn">켜기</button><button type="button" class="btn ghost" data-action="ai-skip">닫기</button></div></form>`;
  m.hidden=false;openAiModal.then=null;setTimeout(()=>m.querySelector('#admin-pw')?.focus(),50);
}

/* ---------- 그리기 ---------- */
function render(){
  const c=current();
  if(!c&&!FREE_VIEWS.includes(view))view='home';
  if(view==='chat'){openScene(c);ensureBrief(c);}
  if(view==='report'&&!FORMATS[fields().format])view='plan';
  const pages={home,atlas,guide,select,gallery:galleryView,intro:()=>intro(c),chat:()=>chat(c),reflect:()=>reflect(c),lab:()=>lab(c),plan:()=>plan(c),report:()=>report(c)};
  app.innerHTML=(pages[view]||home)();
  document.body.classList.toggle('is-game',['home','select','intro','chat','reflect','lab','plan','report'].includes(view));
  document.querySelector('#resume').hidden=!state.run||RUN_VIEWS.includes(view)||view==='select';
  document.querySelectorAll('nav [data-nav]').forEach(b=>{if(b.dataset.nav===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  document.body.style.setProperty('--tone',c&&RUN_VIEWS.includes(view)?TONE[c.id]:DEFAULT_TONE);
  document.title=`${c&&RUN_VIEWS.includes(view)?c.name+' · ':''}다른 곳의 하루`;
  if(view==='chat'){
    const box=document.querySelector('#say');
    if(box&&chat.draft){box.value=chat.draft;chat.draft='';}
    const log=document.querySelector('#log');if(log)log.scrollTop=log.scrollHeight;
  }
}

/* ---------- 입력 처리 ---------- */
document.addEventListener('input',e=>{const el=e.target;
  // 대화 입력칸은 쓰는 만큼 늘어난다(최대 약 5줄)
  if(el.id==='say'){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,140)+'px';}if(el.dataset.me!==undefined){meOf()[el.dataset.me]=el.value;save();return;}if(el.dataset.field&&state.run){state.run.fields[el.dataset.field]=el.type==='checkbox'?el.checked:el.value;save();}});
document.addEventListener('change',e=>{const el=e.target;if(el.dataset.gfilter!==undefined){gallery.filter[el.dataset.gfilter]=el.value;render();}});
// 펼친 '상황'은 바깥을 누르면 접는다.
document.addEventListener('click',e=>{document.querySelectorAll('details.sit[open]').forEach(d=>{if(!d.contains(e.target))d.open=false;});});
document.addEventListener('click',async e=>{
  const el=e.target.closest('button,a#brand');if(!el)return;
  if(el.id==='brand'){e.preventDefault();navigate('home');return;}
  if(el.id==='resume'){navigate(state.run?.view||'home');return;}
  if(el.dataset.nav){navigate(el.dataset.nav);return;}
  if(el.dataset.start){start(el.dataset.start);return;}
  if(el.dataset.filter){filter=el.dataset.filter;render();return;}
  if(el.dataset.open){openWork(el.dataset.open);return;}
  if(el.dataset.del){
    const it=(gallery.items||[]).find(x=>x.key===el.dataset.del);if(!it)return;
    const ok=await dialog({title:'이 결과물을 지울까요?',body:who(it)+'의 결과물이 갤러리에서 지워져요. 되돌릴 수 없어요.',ok:'지우기',cancel:'그만두기',icon:'?'});if(!ok)return;
    try{const res=await fetch(GALLERY_PATH,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',admin:gallery.admin,key:it.key})});if(!res.ok)throw 0;gallery.items=gallery.items.filter(x=>x.key!==it.key);render();toast('지웠어요.');}
    catch{dialog({title:'지우지 못했어요'});}
    return;
  }
  const c=current();
  if(el.dataset.chip!==undefined){
    const ch=chatOf(state.run.step),x=ch.chips?.[Number(el.dataset.chip)];
    if(!x||pending)return;
    // 결정 칩은 누르는 것이 곧 결정이다. 나머지는 학생의 말로 보낸다.
    if(x.path==='A'||x.path==='B'){ch.log.push({k:'me',text:x.text});ch.chips=[];lock(c,'AB'.indexOf(x.path));}
    else say(c,x.text);
    return;
  }
  if(el.dataset.pick!==undefined){
    const n=Number(el.dataset.pick),o=c.scenes[state.run.step].options[n];
    // 선택 버튼은 AI 연결 여부와 상관없이 바로 결정한다.
    if(pending)return;
    chatOf(state.run.step).log.push({k:'me',text:o.text});lock(c,n);
    return;
  }
  if(el.dataset.frame!==undefined){const t=frames(c)[Number(el.dataset.frame)],box=document.querySelector('[data-field="question"]');if(t&&box){box.value=t;state.run.fields.question=t;save();box.focus();const i=t.indexOf('____');if(i>=0)box.setSelectionRange(i,i+4);}return;}
  if(el.dataset.ask!==undefined){const k=el.dataset.ask;if(k==='mine'){const q=fields().question?.trim();if(!q){dialog({title:'질문을 먼저 써 주세요',body:'"내가 알아볼 질문" 칸을 채우면 AI에게 물어볼 수 있어요.'}).then(()=>focusEmpty(['question']));return;}ask(c,'내 질문: '+q);}else ask(c,k);return;}
  if(el.dataset.take!==undefined){const e=labOf().log[Number(el.dataset.take)];if(!e?.point)return;const line='• '+e.point+(e.check?' (확인: '+e.check+')':'');const box=document.querySelector('[data-field="notes"]');const v=(fields().notes||'').trim();state.run.fields.notes=(v?v+'\n':'')+line;if(box)box.value=state.run.fields.notes;e.taken=true;save();renderAsk();toast('메모에 담았어요. 내 말로 고쳐 써 보세요.');return;}
  if(el.dataset.format){state.run.fields.format=el.dataset.format;save();render();document.querySelector('.formats')?.scrollIntoView({block:'start',behavior:'smooth'});return;}
  if(el.dataset.rv!==undefined){const last=[...reviewOf().log].reverse().find(x=>x.k==='say');const t=last?.chips?.[Number(el.dataset.rv)];if(t)reviewSay(c,t);return;}
  const a=el.dataset.action;
  if(a==='review-start'||a==='review-again'){const miss=fmtOf().fields.find(([n])=>!fields()[n]?.trim());if(miss){dialog({title:'빈칸을 먼저 채워 주세요',body:'네 칸을 모두 쓰면 보여 줄 수 있어요.'}).then(()=>focusEmpty(fmtOf().fields.map(([n])=>n)));return;}reviewSay(c,a==='review-start'?'제가 쓴 글이에요. 읽어 봐 주세요.':'글을 고쳤어요. 다시 읽어 봐 주세요.',a==='review-start'?'':'— 고친 글을 다시 보여 줬어요 —');return;}
  if(a==='rv-send'){const box=document.querySelector('#rv-say');if(box?.value.trim()){const t=box.value;box.value='';reviewSay(c,t);}return;}
  if(a==='random')draw();
  if(a==='redraw')draw(c.id);
  if(a==='resume')navigate(state.run?.view||'home');
  if(a==='enter-chat')navigate('chat');
  if(a==='join')openJoinModal(c);
  if(a==='confirm'){const p=chatOf(state.run.step).proposal;if(!pending&&Number.isInteger(p))lock(c,p);}
  if(a==='keep-talking'){chatOf(state.run.step).proposal=null;save();render();document.querySelector('#say')?.focus();}
  if(a==='show-options'){chatOf(state.run.step).showOptions=true;save();render();}
  if(a==='ai-settings')openAiModal();
  if(a==='ai-skip')closeModal();
  if(a==='ai-off'){AI.clear();toast('AI 연결을 끊었어요.');closeModal();if(view==='chat')render();}
  if(a==='next-scene'){
    if(state.run.choices[state.run.step]===null||document.querySelector('.daypass'))return;
    const from=state.run.step;
    if(from<2){state.run.step++;save();navigate('chat');dayPass(c,from,from+1);}
    else{navigate('reflect');dayPass(c,from,3);}
  }
  if(a==='prev-scene'){state.run.step=Math.max(0,state.run.step-1);save();navigate('chat');}
  if(a==='to-plan'){const miss=['question','notes'].filter(k=>!fields()[k]?.trim());if(miss.length){dialog({title:miss[0]==='question'?'질문을 먼저 정해 주세요':'알게 된 것을 적어 주세요',body:'비어 있는 칸으로 안내할게요.'}).then(()=>focusEmpty(miss));return;}navigate('plan');}
  if(a==='gallery-reload'){gallery.items=null;render();}
  if(a==='gallery-admin')openAdmin();
  if(a==='gallery-admin-off'){gallery.admin='';gallery.items=null;render();}
  if(a==='clear')dialog({title:'이 브라우저의 기록을 지울까요?',body:'지금 이야기와 완료 목록이 지워져요. 이미 내려받은 파일은 그대로 남아요.',ok:'지우기',cancel:'그만두기',icon:'?'}).then(ok=>{if(!ok)return;state={run:null,completed:[]};save();navigate('home');toast('이 브라우저의 기록을 지웠어요.');});
});
document.addEventListener('submit',async e=>{
  if(e.target.id==='join-form'){
    e.preventDefault();
    const box=document.querySelector('#join-name'),name=box.value.trim();
    if(!name){box.focus();box.classList.add('shake');setTimeout(()=>box.classList.remove('shake'),400);return;}
    state.run.fields.nickname=name;save();closeModal();navigate('chat');return;
  }
  if(e.target.id==='submit-form'){e.preventDefault();submitWork(current());return;}
  if(e.target.id==='admin-form'){e.preventDefault();const pw=document.querySelector('#admin-pw').value;if(!pw)return;gallery.admin=pw;gallery.items=null;closeModal();navigate('gallery');return;}
  if(e.target.id==='ask-form'){e.preventDefault();const box=document.querySelector('#ask');const t=box.value;box.value='';ask(current(),t);return;}
  if(e.target.id==='say-form'){e.preventDefault();const box=document.querySelector('#say');say(current(),box.value);return;}
  if(e.target.id==='ai-form'){
    e.preventDefault();
    const k=document.querySelector('#ai-key').value,msg=document.querySelector('#ai-msg'),btn=e.target.querySelector('.btn');
    if(!k.trim()){msg.textContent='키를 넣어 주세요.';return;}
    AI.setKey(k);AI.setModel(document.querySelector('#ai-model').value);
    msg.textContent='연결을 확인하는 중…';btn.disabled=true;
    try{await AI.test();toast('AI가 연결되었어요. 새로고침하면 다시 넣어야 해요.');closeModal();if(view==='chat')render();}
    catch(err){AI.clear();msg.textContent=err.message;btn.disabled=false;}
    return;
  }
  if(e.target.id==='reflection-form'){e.preventDefault();if(['feeling','constraint'].some(k=>!fields()[k]?.trim())){dialog({title:'돌아보기 두 칸을 모두 적어 주세요',body:'비어 있는 칸으로 안내할게요.'}).then(()=>focusEmpty(['feeling','constraint']));return;}navigate('lab');}
  if(e.target.id==='plan-form'){e.preventDefault();const fm=fmtOf();if(!fm)return;const names=fm.fields.map(([n])=>n);if(names.some(n=>!fields()[n]?.trim())){dialog({title:fm.name+'의 네 칸을 모두 적어 주세요',body:'비어 있는 칸으로 안내할게요.'}).then(()=>focusEmpty(names));return;}state.run.finishedAt=new Date().toISOString();if(!state.completed.includes(state.run.id))state.completed.push(state.run.id);save();navigate('report');}
});
document.addEventListener('keydown',e=>{
  // 대화창: Enter로 보내고 Shift+Enter로 줄을 바꾼다.
  if((e.target.id==='rv-say'||e.target.id==='ask')&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(e.target.id==='ask'){const t=e.target.value;e.target.value='';ask(current(),t);}else{const t=e.target.value;e.target.value='';reviewSay(current(),t);}return;}
  if(e.target.id==='say'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();say(current(),e.target.value);}
  if(e.key==='Escape'&&!document.querySelector('#modal').hidden)closeModal();
});
document.querySelector('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal();});
renderStatus();
render();
if(document.readyState==='complete')setTimeout(preloadArt,0);else addEventListener('load',preloadArt,{once:true});
})();

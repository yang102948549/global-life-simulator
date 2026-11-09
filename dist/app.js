(()=>{'use strict';
const cases=window.SCENARIOS,AI=window.AI,app=document.querySelector('#app'),KEY='global-life-lab-v1';
const RUN_VIEWS=['intro','chat','reflect','lab','plan','report'];
const FREE_VIEWS=['home','atlas','guide','select'];
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
// 캐릭터마다 그림 속 옷·소품 색에서 고른 포인트 색
const TONE={tuvalu:'#1f7f7c',pakistan:'#2d6b63',bangladesh:'#3e6399',somalia:'#b06d12',gaza:'#3f74a8',haiti:'#a86a14',ghana:'#86552a',sudan:'#76589f',rohingya:'#71519c',afghanistan:'#a3303d',congo:'#ad2843',qatar:'#66750f'};
const DEFAULT_TONE='#9a4a2a';

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
  }
}catch{storageOK=false;}

const current=()=>cases.find(c=>c.id===state.run?.id);
const fields=()=>state.run?.fields||{};
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageOK=false;toast('자동 저장을 쓸 수 없습니다. 끝난 뒤 기록을 내려받아 주세요.');}}
function toast(msg){const el=document.querySelector('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),3800);}
function navigate(next){
  view=next;
  if(state.run&&RUN_VIEWS.includes(next)){state.run.view=next;save();}
  render();
  window.scrollTo({top:0,behavior:'instant'});
  app.focus({preventScroll:true});
}

/* ---------- 캐릭터 고르기 ---------- */
const canReplace=()=>!state.run||state.run.view==='report'||confirm('진행 중인 기록을 새 이야기로 바꿀까요? 취소하면 지금 이야기를 이어갈 수 있습니다.');
// 아직 마치지 않은 캐릭터 가운데 하나. except는 '다시 뽑기'에서 방금 나온 캐릭터를 빼기 위한 것.
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
function start(id){if(!canReplace())return;const c=cases.find(x=>x.id===id);if(c)begin(c);}
function draw(except){
  if(!except&&!canReplace())return;
  const target=pickRandom(except);
  navigate('select');
  roulette(target);
}

/* ---------- 공통 조각 ---------- */
const sourceList=c=>`<ul class="sources">${c.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><span>${esc(s.date)}</span></li>`).join('')}</ul>`;
const facts=c=>`<ul class="facts">${c.facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`;
// 캐릭터 그림. kind가 face면 얼굴 부분, 아니면 전신 그림. 그림을 못 읽으면 이름 첫 글자가 보인다.
function art(c,kind='card',extra=''){
  const src=`assets/characters/${esc(c.id)}${kind==='face'?'-face':''}.webp`;
  return `<div class="art art-${kind} ${extra}" style="--tone:${TONE[c.id]||DEFAULT_TONE}" aria-hidden="true"><span class="art-initial">${esc([...c.name][0])}</span><img src="${src}" alt="" loading="lazy" onerror="this.remove()"></div>`;
}
function field(name,label,placeholder='',required=false,help=''){return `<label class="field"><span>${esc(label)}${required?' <em>필수</em>':''}</span>${help?`<small>${esc(help)}</small>`:''}<textarea data-field="${name}" name="${name}" maxlength="4000" ${required?'required':''} placeholder="${esc(placeholder)}">${esc(fields()[name]||'')}</textarea></label>`;}
function tile(c){const i=cases.indexOf(c),done=state.completed.includes(c.id);return `<button class="tile" data-start="${c.id}" style="--tone:${TONE[c.id]}">${art(c,'card')}<span class="tile-body"><span class="tile-meta">No.${pad(i+1)} · ${esc(c.theme)}${done?' · 완료':''}</span><strong>${esc(c.name)}</strong><span class="tile-title">${esc(c.title)}</span><span class="tile-desc">${esc(c.summary)}</span></span></button>`;}

/* ---------- 홈 · 목록 · 안내 ---------- */
// 홈은 게임 타이틀 화면: 제목과 시작 버튼만.
function home(){const r=state.run,c=current();return `<section class="title-screen">
  <div class="title-fan" aria-hidden="true">${['bangladesh','tuvalu','gaza','ghana','afghanistan'].map(id=>art(cases.find(x=>x.id===id),'card')).join('')}</div>
  <p class="eyebrow">대화형 지구촌 시뮬레이션</p>
  <h1>다른 곳의 하루</h1>
  <p class="title-sub">지구촌 어딘가의 또래가 되어 하루를 살아 보세요.<br>당신의 말과 선택에 따라 하루가 흘러갑니다.</p>
  <div class="title-actions">
    <button class="btn big" data-action="random">게임 시작</button>
    ${r&&c?`<button class="btn big ghost" data-action="resume">이어하기 · ${esc(c.name)}</button>`:''}
  </div>
  <p class="title-links"><button class="link" data-nav="atlas">캐릭터 직접 고르기</button><span>·</span><button class="link" data-nav="guide">선생님 안내</button></p>
  <p class="title-note">실제 자료를 바탕으로 만든 이야기입니다. 인물과 대화는 꾸민 것입니다.${!storageOK?' 이 브라우저는 저장을 쓸 수 없으니 끝난 뒤 기록을 내려받아 주세요.':''}</p>
</section>`;}

function atlas(){const shown=filter==='전체'?cases:cases.filter(c=>c.theme===filter);return `<div class="page-head"><p class="label">캐릭터</p><h1>열두 명의 하루</h1><p class="muted">나라 전체가 아니라 특정 지역에 사는 한 사람의 조건을 따라갑니다. 이 브라우저에서 ${state.completed.length} / 12명을 마쳤습니다.</p></div>
<div class="filters" role="group" aria-label="주제별 보기">${['전체','환경','물','빈곤','난민','인권'].map(t=>`<button class="chip" aria-pressed="${filter===t}" data-filter="${t}">${t}</button>`).join('')}</div>
<div class="tiles">${shown.map(tile).join('')}</div>
<div class="actions"><button class="btn" data-action="random">무작위로 뽑기</button></div>`;}

function guide(){return `<div class="page-head"><p class="label">수업 안내</p><h1>체험에서 공감으로,<br>공감에서 책임으로.</h1><p class="muted">중학교 도덕 · 지구촌 문제 해결 수업. 모든 사례는 자료 시점의 특정 지역 상황이며 나라 전체를 대표하지 않습니다.</p></div>
<div class="grid3">
  <article class="cell"><p class="label">1차시 · 45분</p><h3>캐릭터와 대화하기</h3><p>도입·뽑기 10분 → 세 장면 대화 20분 → 개인 성찰과 모둠 대화 15분. 다른 선택의 결과도 비교해 봅니다.</p></article>
  <article class="cell"><p class="label">2차시 · 45분</p><h3>질문과 근거 검토</h3><p>질문 고치기 10분 → AI 또는 원문 조사 20분 → 출처 대조·빠진 관점 검토 15분.</p></article>
  <article class="cell"><p class="label">3차시 · 45분</p><h3>함께 바꿀 계획</h3><p>해결 계획 20분 → 모둠끼리 교차 검토 15분 → 고치기·기록 제출 10분.</p></article>
</div>
<div class="grid2">
  <article class="cell"><h3>AI 대화 설정</h3><p>상단의 ‘AI 연결’에 Gemini API 키를 넣으면 학생이 자유롭게 말하고 AI가 주변 인물로 답합니다. 키는 이 탭의 메모리에만 있고 저장되지 않아 새로고침하면 다시 넣어야 합니다. 키는 Google에 직접 전송됩니다. 교사용 키를 쓰고, Google AI Studio에서 키 사용처를 이 사이트로 제한하는 것을 권장합니다. 키가 없으면 선택 버튼만으로 진행됩니다.</p></article>
  <article class="cell"><h3>AI 대화의 안전장치</h3><p>대화는 Google 쪽에 저장되지 않게 보냅니다. 괴롭힘·혐오·성적·위험 내용 필터를 켜 두었고, 잔인한 묘사·연애 묘사·개인정보 요청을 막는 지침을 넣었습니다. 그래도 AI는 실수할 수 있으니 수업 중 화면을 살펴 주세요. 학생에게 실명·학교·연락처를 쓰지 않도록 안내해 주세요.</p></article>
  <article class="cell"><h3>12명을 모두 다루려면</h3><p>12개 모둠, 또는 6개 모둠×2회로 운영하세요. 무작위 뽑기는 이 브라우저에서 마치지 않은 캐릭터를 먼저 고릅니다. 기기 사이의 중복은 자동으로 조정되지 않으니 ‘캐릭터’ 목록에서 직접 나눠 줄 수 있습니다.</p></article>
  <article class="cell"><h3>공감을 다루는 방법</h3><p>생존 점수, 빈곤 순위, 사망 결말은 없습니다. 모든 선택에는 얻는 것과 잃는 것이 있습니다. 불편한 장면은 다른 캐릭터로 바꾸거나 자료 읽기로 대신해도 됩니다.</p></article>
</div>
<p class="notice"><strong>평가 관점</strong> · 문제와 당사자 이해 / 질문 고치기 / 출처와 시점 확인 / 개인과 제도의 책임 구분 / 당사자 참여와 부작용 고려 / 실행과 확인 계획</p>
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
    setTimeout(()=>{if(view==='select')begin(target);},reduceMotion?300:1000);
  };
  if(reduceMotion){land();return;}
  // 두 바퀴 돈 뒤 목표 칸에서 멈추고, 끝에 가까울수록 느려진다.
  const total=slots.length*2+end;
  let step=0,delay=50;
  const tick=()=>{
    if(view!=='select')return;
    slots.forEach(s=>s.classList.remove('on'));
    slots[step%slots.length].classList.add('on');
    if(step>=total){land();return;}
    step++;if(total-step<8)delay+=50;
    setTimeout(tick,delay);
  };
  tick();
}

function intro(c){const i=cases.indexOf(c);return `<section class="profile">
  <figure class="portrait">${art(c,'card')}<figcaption><span>No.${pad(i+1)} · ${esc(c.theme)}</span><strong>${esc(c.name)}</strong>${esc(c.country)}</figcaption></figure>
  <div class="profile-body">
    <p class="label">당신이 살아 볼 사람</p>
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
    <label class="field compact"><span>플레이어 이름 (선택)</span><input data-field="nickname" maxlength="40" value="${esc(fields().nickname||'')}" placeholder="모둠 이름이나 별명"></label>
    <div class="actions"><button class="btn big" data-action="enter-chat">이 사람으로 시작</button><button class="link" data-action="redraw">다시 뽑기</button></div>
  </div>
</section>`;}

/* ---------- 게임 화면: 장면 카드 ---------- */
const chatOf=step=>state.run.chats[step];
function prevChoices(c){return c.scenes.slice(0,state.run.step).map((s,i)=>s.options[state.run.choices[i]]?.text||'고르지 않음');}
// 장면에 처음 들어오면 대본의 장면 설명을 카드 첫 문단으로 넣는다.
function openScene(c){
  const ch=chatOf(state.run.step),s=c.scenes[state.run.step];
  if(!ch.log.length){ch.log.push({k:'story',text:s.story});save();}
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
  <figure class="portrait">${art(c,'card')}<figcaption><strong>${esc(c.name)}</strong>${esc(c.country)} · ${esc(c.region)}</figcaption></figure>
  <ol class="pips" aria-label="장면 진행">${c.scenes.map((x,i)=>`<li class="${i<step||(i===step&&decided)?'done':i===step?'now':''}">${esc(x.time)}</li>`).join('')}</ol>
  <p class="wish">“${esc(c.wish)}”</p>
</aside>`;}
function chat(c){
  const r=state.run,step=r.step,s=c.scenes[step],ch=chatOf(step),n=r.choices[step];
  const under=`<div class="card-under">${step>0?'<button class="link" data-action="prev-scene">← 이전 장면</button>':'<span></span>'}<span>인물과 대화는 자료를 바탕으로 꾸민 이야기입니다</span></div>`;
  if(n!==null){
    const o=s.options[n],other=s.options[1-n],talked=ch.log.some(e=>e.k==='me'||e.k==='say');
    return `<div class="game">${stageArt(c,step,true)}<div class="stage-main">
    <article class="scene-card result" aria-live="polite">
      <header class="card-head"><span class="tag-choice">선택 ${'AB'[n]}</span><p class="label">${esc(s.time)} · ${esc(s.title)}</p><h1>${esc(o.text)}</h1></header>
      <div class="card-body">
        <p class="story">${esc(o.result)}</p>
        <div class="beyond"><strong>선택을 넘어</strong><p>${esc(s.barrier)}</p></div>
        <details><summary>다른 선택이었다면?</summary><p><b>${esc(other.text)}</b><br>${esc(other.result)}</p></details>
        ${talked?`<details><summary>이 장면의 대화 다시 보기</summary><div class="replay">${ch.log.map(e=>entry(e,c,s)).join('')}</div></details>`:''}
        ${field('note'+step,'나는 왜 이 선택을 했을까? (선택)','가장 마음에 걸린 점이나 바꾸고 싶었던 조건을 적어 보세요.')}
      </div>
      <footer class="card-foot"><button class="btn big" data-action="next-scene">${step===2?'하루 돌아보기':'다음 장면'} →</button></footer>
    </article>${under}</div></div>`;
  }
  return `<div class="game">${stageArt(c,step,false)}<div class="stage-main">
  <article class="scene-card">
    <header class="card-head"><p class="label">${esc(s.time)} · 장면 ${step+1}/3</p><h1>${esc(s.title)}</h1></header>
    <div class="card-body" id="log" aria-live="polite">${ch.log.map(e=>entry(e,c,s)).join('')}${pending?'<p class="msg typing" aria-label="답을 쓰는 중"><i></i><i></i><i></i></p>':''}</div>
    <footer class="card-foot${AI.ready?' talk':''}">
      ${AI.ready?`<form id="say-form" class="say-box">
        <textarea id="say" rows="1" maxlength="500" placeholder="${esc(c.name)}(이)가 되어 말해 보세요" ${pending?'disabled':''}></textarea>
        <button type="button" class="icon" data-action="star" title="행동 표시(*) 넣기">*</button><button class="btn small" ${pending?'disabled':''}>보내기</button>
      </form>
      <p class="ask small-ask">결정할 준비가 되면 하나를 고르세요${ch.lean&&ch.lean!=='none'?` · 지금은 <b>${ch.lean}</b> 쪽으로 기운 것 같아요`:''}</p>`:`<p class="ask">${esc(c.name)}(이)라면, 어떻게 할까요?</p>`}
      <div class="choice-row">${s.options.map((o,i)=>`<button class="choice${ch.lean==='AB'[i]?' leaning':''}" data-pick="${i}" ${pending?'disabled':''}><span class="key">${'AB'[i]}</span><span>${esc(o.text)}</span></button>`).join('')}</div>
      ${AI.ready?'':`<p class="hint">오른쪽 위 <b>AI 연결</b>을 하면 고르기 전에 주변 사람과 자유롭게 대화할 수 있어요.</p>`}
    </footer>
  </article>${under}</div></div>`;}
function lock(c,n){
  state.run.choices[state.run.step]=n;
  save();render();
  window.scrollTo({top:0,behavior:reduceMotion?'auto':'smooth'});
}
async function say(c,text){
  text=text.trim();if(!text||pending)return;
  const r=state.run,step=r.step,ch=chatOf(step);
  ch.log.push({k:'me',text});pending=true;save();render();scrollLog();
  try{
    const {reply,history}=await AI.turn({c,step,prevChoices:prevChoices(c),history:ch.api,text});
    if(state.run!==r||r.step!==step)return;
    ch.api=history;
    if(reply.narration?.trim())ch.log.push({k:'narr',text:reply.narration.trim()});
    if(reply.dialogue?.trim())ch.log.push({k:'say',speaker:reply.speaker?.trim()||'주변 사람',text:reply.dialogue.trim().replace(/^["“]|["”]$/g,'')});
    // AI는 결정하지 않는다. 학생의 말이 어느 쪽으로 기울었는지만 표시하고, 결정은 버튼으로.
    ch.lean=reply.lean;
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
  if(log.scrollHeight>log.clientHeight+4)log.scrollTo({top:log.scrollHeight,behavior});
  else{const last=log.lastElementChild;if(last)last.scrollIntoView({block:'end',behavior});}
}

/* ---------- AI 연결 창 ---------- */
function openAiModal(then){
  const m=document.querySelector('#modal');
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
function closeModal(){const m=document.querySelector('#modal');m.hidden=true;m.innerHTML='';const then=openAiModal.then;openAiModal.then=null;renderStatus();if(then)then();}
function renderStatus(){const b=document.querySelector('#ai-status');b.textContent=AI.ready?'AI 연결됨':'AI 연결';b.classList.toggle('on',AI.ready);}
// 학교 서버에 키가 있으면 키 입력 없이 바로 연결된다.
AI.serverCheck.then(ok=>{if(!ok)return;renderStatus();if(view==='chat')render();});

/* ---------- 돌아보기 이후: 게임 화면과 같은 틀(왼쪽 그림, 오른쪽 종이 카드) ---------- */
const EPI=['돌아보기','질문','계획','기록'];
function epiArt(c,active,extra=''){return `<aside class="stage-art">
  <figure class="portrait">${art(c,'card')}<figcaption><strong>${esc(c.name)}</strong>${esc(c.country)} · ${esc(c.region)}</figcaption></figure>
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
      ${sec('생각해 보기',field('feeling','이 사람에게 가장 중요했던 것은 무엇일까?','“불쌍하다”는 말 대신, 지키고 싶었던 일상과 권리를 생각해 보세요.',true)+field('constraint','내 선택만으로 바꾸기 어려웠던 조건은?','시설, 제도, 소득, 안전, 차별 가운데 구체적으로 적어 보세요.',true)+field('unknown','체험만으로는 알 수 없는 것은?','당사자에게 더 듣고 싶은 이야기나 자료로 확인할 내용을 적어 보세요.',true))}
    </div>
    <footer class="card-foot"><button class="btn big" type="submit">질문 연구소로 →</button><button class="link" type="button" data-nav="chat">← 대화 다시 보기</button></footer>
  </form>
</article></div></div>`;}

function promptText(){const c=current(),f=fields();return `나는 중학교 도덕 수업에서 ${c.country}, ${c.region}의 ${c.role}의 관점으로 진행한 가상 시뮬레이션을 했습니다. 인물과 장면은 가상이며 실제 체험이나 증언이 아닙니다.\n\n확인된 배경:\n${c.facts.map(x=>'- '+x).join('\n')}\n출처와 시점:\n${c.sources.map(s=>`${s.title} (${s.date}) ${s.url}`).join('\n')}\n\n내가 발견한 조건: ${f.constraint||'(아직 작성하지 않음)'}\n처음 질문: ${f.firstQuestion||c.question}\n더 구체화한 질문: ${f.betterQuestion||c.question}\n\n위 질문에 대해 ①당사자의 요구와 이미 하는 노력 ②즉시 지원과 장기적 변화 ③주민·정부·기업·국제사회의 역할 ④부작용·비용·실행 조건을 구분해 설명해 주세요. 확인된 사실과 추론을 구분하고 근거의 발행일과 원문 링크를 제시해 주세요. 원문을 확인할 수 없거나 최신 상황을 모르면 모른다고 말해 주세요. 가상의 당사자 발언이나 통계는 만들지 마세요. 결론을 대신 정하지 말고 내가 확인해야 할 질문도 제안해 주세요.`;}

function lab(c){return `<div class="game">${epiArt(c,1)}<div class="stage-main"><article class="paper-card">
  <header class="card-head"><p class="label">마무리 2/4 · 질문 연구소</p><h1>답을 받기 전에, 질문을 더 깊게.</h1></header>
  <div class="card-body">
    <div class="callout"><strong>이 이야기의 출발 질문</strong><p>${esc(c.question)}</p></div>
    ${sec('① 질문 다듬기',field('firstQuestion','나의 첫 질문','예: 이 지역의 문제를 어떻게 해결할 수 있을까?')+field('betterQuestion','더 구체적으로 바꾼 질문','누가 겪는 어떤 어려움인가요? 실행 조건과 책임질 주체까지 넣어 보세요.')+`<p class="sec-note">질문에 넣어 볼 주체: ${esc(c.actors)}</p>`)}
    ${sec('② 조사하기',`<div class="tool-row"><button class="btn ghost" data-action="copy-prompt">AI 질문 복사</button><button class="link" data-action="show-prompt">질문 미리보기</button></div><div id="prompt-preview" class="prompt" hidden></div>`+field('answer','AI 답변 또는 원문 조사 내용','AI를 쓰지 않았다면 읽은 자료를 요약해도 됩니다. 개인정보는 넣지 마세요.'),'질문을 복사해 <strong>학교에서 허용한 AI</strong>에 넣거나, 원문 자료를 직접 읽어 보세요.')}
    ${sec('③ 근거 확인하기',field('evidence','어떤 주장을 어디에서 확인했나요?','주장 / 기관 / 자료 제목·날짜 / 원문 주소 / 일치 여부','','AI가 준 링크도 직접 열어 그 주장을 뒷받침하는지 확인하세요.')+field('revision','받아들이지 않거나 고친 내용은?','근거가 없던 주장, 빠진 사람의 입장, 지역에 맞지 않는 제안을 적어 보세요.'))}
  </div>
  <footer class="card-foot"><button class="btn big" data-action="to-plan">해결 계획 세우기 →</button><button class="link" data-nav="reflect">← 돌아보기 고치기</button></footer>
</article></div></div>`;}

const planFields=[['problem','우리가 해결할 구체적인 문제','누가 어느 지역에서 어떤 권리를 누리지 못하고 있나요?'],['immediate','지금 필요한 지원','당장 필요한 변화와 그것을 실행할 주체를 적어 보세요.'],['longterm','문제를 되풀이하게 만드는 조건을 바꿀 방법','제도·시설·소득·차별 등 원인에 맞서는 방법을 적어 보세요.'],['roles','누가 무엇을 책임져야 하나요?','당사자·정부·기업·국제사회 가운데 관련 주체와 역할을 나눠 보세요.'],['participation','현지 사람들의 의견과 노력을 어떻게 반영할까요?','당사자의 동의·참여와 이미 하고 있는 노력을 생각해 보세요.'],['tradeoff','비용·한계·부작용은 무엇인가요?','누가 부담을 지는지, 필요한 자원, 예상하지 못한 피해를 적으세요.'],['action','우리 모둠이 할 수 있는 구체적인 행동','누구에게, 무엇을, 언제까지 할까요? 문제의 원인과 어떻게 이어지나요?'],['measure','변화를 어떻게 확인할까요?','모금액이나 홍보 횟수 말고, 당사자의 생활이 나아졌는지 확인할 기준을 적으세요.']];

function plan(c){const pf=keys=>planFields.filter(([k])=>keys.includes(k)).map(([n,l,p])=>field(n,l,p,true)).join('');return `<div class="game">${epiArt(c,2)}<div class="stage-main"><article class="paper-card">
  <header class="card-head"><p class="label">마무리 3/4 · 해결 계획</p><h1>좋은 마음을, 실행할 수 있는 계획으로.</h1></header>
  <form id="plan-form">
    <div class="card-body">
      <p class="sec-note">개인의 노력과 공동체·제도의 변화를 이어 보세요. 정답 하나를 찾기보다 근거와 한계를 드러내는 제안을 만듭니다.</p>
      ${sec('① 무엇을 바꿀까',pf(['problem','immediate','longterm']))}
      ${sec('② 누가 함께할까',pf(['roles','participation']))}
      ${sec('③ 어떻게 할까',pf(['tradeoff','action','measure']))}
      ${sec('마지막 점검',`<div class="checks">${[['checkedSource','원문 자료와 시점을 확인했다.'],['checkedFiction','실제 사실과 시뮬레이션의 가정을 구분했다.'],['checkedVoice','당사자의 의견과 참여를 고려했다.']].map(([n,l])=>`<label><input type="checkbox" data-field="${n}" ${fields()[n]?'checked':''}>${l}</label>`).join('')}</div><div id="plan-review" aria-live="polite"></div>`,'빈칸 점검은 칸이 채워졌는지만 봅니다. 사실이 맞는지, 해결책이 타당한지는 판단하지 않습니다.')}
    </div>
    <footer class="card-foot"><button class="btn big" type="submit">탐구 기록 완성 →</button><button type="button" class="btn ghost" data-action="review">빈칸 점검</button><button type="button" class="link" data-nav="lab">← 질문 연구소</button></footer>
  </form>
</article></div></div>`;}

function review(){const f=fields(),checks=[...planFields.map(([n,l])=>[l,typeof f[n]==='string'&&f[n].trim().length>0]),['자료 검토 기록',!!f.evidence?.trim()],['원문·시점 확인 표시',!!f.checkedSource],['사실과 가정 구분 표시',!!f.checkedFiction],['당사자 참여 검토 표시',!!f.checkedVoice]];return `<ul class="review">${checks.map(([l,ok])=>`<li class="${ok?'ok':''}">${ok?'✓':'○'} ${esc(l)}</li>`).join('')}</ul>`;}

function reportText(){const c=current(),r=state.run,f=fields();return `다른 곳의 하루 · 지구촌 탐구 기록\n활동 이름: ${f.nickname||'미입력'}\n캐릭터: ${c.name} (${c.role})\n지역: ${c.country} / ${c.region}\n완료 시각: ${new Date(r.finishedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST\n\n※ 실제 체험·증언이 아닌 학습용 가상 시뮬레이션입니다.\n\n[하루의 선택]\n${c.scenes.map((s,i)=>`${s.time}: ${s.options[r.choices[i]]?.text||'미선택'}\n결과(가정): ${s.options[r.choices[i]]?.result||''}\n선택의 이유: ${f['note'+i]||'미작성'}`).join('\n\n')}\n\n[돌아보기]\n중요했던 것: ${f.feeling||''}\n바꾸기 어려운 조건: ${f.constraint||''}\n더 알아볼 것: ${f.unknown||''}\n\n[질문과 검토]\n첫 질문: ${f.firstQuestion||'미작성'}\n개선 질문: ${f.betterQuestion||'미작성'}\nAI 답변/원문 조사: ${f.answer||'미작성'}\n근거 대조: ${f.evidence||'미작성'}\n수정·보류한 내용: ${f.revision||'미작성'}\n\n[해결 계획]\n${planFields.map(([n,l])=>`${l}\n${f[n]||'미작성'}`).join('\n\n')}\n\n[자가 확인]\n원문·시점: ${f.checkedSource?'확인 표시':'미확인'}\n사실·가정 구분: ${f.checkedFiction?'확인 표시':'미확인'}\n당사자 참여: ${f.checkedVoice?'확인 표시':'미확인'}\n\n[자료]\n${c.sources.map(s=>`${s.title}\n${s.date}\n${s.url}`).join('\n\n')}\n\n선택 결과는 예측이나 통계가 아닙니다. 기관의 승인·감수를 받은 자료는 아닙니다.`;}

function report(c){const r=state.run,f=fields();
  const block=(l,n)=>`<div class="report-block"><h3>${esc(l)}</h3><p>${esc(f[n]||'작성하지 않음')}</p></div>`;
  const side=`<div class="clear-badge">하루를 마쳤어요</div>
  <div class="side-actions no-print"><button class="btn big" data-action="download">기록 내려받기</button><button class="btn ghost" data-action="print">인쇄 / PDF</button><button class="link" data-nav="plan">← 계획 고치기</button></div>`;
  return `<div class="game">${epiArt(c,4,side)}<div class="stage-main"><article class="paper-card report">
  <header class="card-head"><p class="label">마무리 4/4 · 탐구 기록</p><h1>다른 곳의 하루에서, 함께 바꿀 내일로.</h1><p class="muted">${esc(f.nickname||'나의 탐구 기록')} · ${esc(c.name)} · ${esc(c.country)} / ${esc(c.region)}</p></header>
  <div class="card-body">
    <p class="notice">이 체험으로 한 사람의 삶을 다 이해했다고 말할 수는 없습니다. 아래 기록은 자동 평가나 AI의 검증을 거친 결과가 아닙니다.</p>
    ${sec('내가 만난 삶',`<p class="story">“${esc(c.wish)}”</p><p class="sec-note">${esc(c.role)}</p>${facts(c)}`)}
    ${sec('하루의 선택과 남은 어려움',c.scenes.map((s,i)=>{const o=s.options[r.choices[i]];return `<div class="report-block"><h3>${esc(s.time)} · ${esc(o?.text||'미선택')}</h3><p>결과(가정): ${esc(o?.result||'')}\n내 생각: ${esc(f['note'+i]||'작성하지 않음')}\n선택을 넘어: ${esc(s.barrier)}</p></div>`;}).join(''))}
    ${sec('돌아보기',block('지키고 싶었던 일상과 권리','feeling')+block('내 선택만으로 바꾸기 어려운 조건','constraint')+block('아직 모르는 것','unknown'))}
    ${sec('질문과 검토',block('첫 질문','firstQuestion')+block('고친 질문','betterQuestion')+block('AI 답변 또는 원문 조사','answer')+block('근거 확인 기록','evidence')+block('고치거나 보류한 내용','revision'))}
    ${sec('해결 계획',planFields.map(([n,l])=>block(l,n)).join('')+`<div class="report-block"><h3>자가 확인</h3><p>원문·시점: ${f.checkedSource?'확인':'미확인'} / 사실·가정 구분: ${f.checkedFiction?'확인':'미확인'} / 당사자 참여: ${f.checkedVoice?'확인':'미확인'}</p></div>`)}
    ${sec('참고 자료와 시점',sourceList(c)+'<p class="sec-note">장면·인물·대화·선택 결과는 가상입니다. 해당 기관의 승인이나 감수를 받은 콘텐츠가 아닙니다.</p>')}
  </div>
  <footer class="card-foot no-print"><button class="btn big" data-action="random">다른 캐릭터 뽑기</button><button class="btn ghost" data-nav="atlas">캐릭터 목록</button><p class="sec-note">새 캐릭터를 시작하면 지금 기록이 바뀝니다. 먼저 내려받아 두세요.</p></footer>
</article></div></div>`;}

/* ---------- 그리기 ---------- */
function render(){
  const c=current();
  if(!c&&!FREE_VIEWS.includes(view))view='home';
  if(view==='chat')openScene(c);
  const pages={home,atlas,guide,select,intro:()=>intro(c),chat:()=>chat(c),reflect:()=>reflect(c),lab:()=>lab(c),plan:()=>plan(c),report:()=>report(c)};
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
async function copy(text){
  try{await navigator.clipboard.writeText(text);toast('질문을 복사했어요. 허용된 AI에 붙여 넣어 주세요.');}
  catch{const p=document.querySelector('#prompt-preview');if(p){p.hidden=false;p.textContent=text;const range=document.createRange();range.selectNodeContents(p);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);}toast('자동 복사가 안 됩니다. 표시된 질문을 직접 복사해 주세요.');}
}

/* ---------- 입력 처리 ---------- */
document.addEventListener('input',e=>{const el=e.target;
  // 대화 입력칸은 쓰는 만큼 늘어난다(최대 약 5줄)
  if(el.id==='say'){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,140)+'px';}if(el.dataset.field&&state.run){state.run.fields[el.dataset.field]=el.type==='checkbox'?el.checked:el.value;save();}});
document.addEventListener('click',async e=>{
  const el=e.target.closest('button,a#brand');if(!el)return;
  if(el.id==='brand'){e.preventDefault();navigate('home');return;}
  if(el.id==='resume'){navigate(state.run?.view||'home');return;}
  if(el.id==='ai-status'){openAiModal();return;}
  if(el.dataset.nav){navigate(el.dataset.nav);return;}
  if(el.dataset.start){start(el.dataset.start);return;}
  if(el.dataset.filter){filter=el.dataset.filter;render();return;}
  const c=current();
  if(el.dataset.pick!==undefined){
    const n=Number(el.dataset.pick),o=c.scenes[state.run.step].options[n];
    // 선택 버튼은 AI 연결 여부와 상관없이 바로 결정한다.
    if(pending)return;
    chatOf(state.run.step).log.push({k:'me',text:o.text});lock(c,n);
    return;
  }
  const a=el.dataset.action;
  if(a==='random')draw();
  if(a==='redraw')draw(c.id);
  if(a==='resume')navigate(state.run?.view||'home');
  if(a==='enter-chat')navigate('chat');
  if(a==='ai-settings')openAiModal();
  if(a==='ai-skip')closeModal();
  if(a==='ai-off'){AI.clear();toast('AI 연결을 끊었어요.');closeModal();if(view==='chat')render();}
  if(a==='star'){const box=document.querySelector('#say');const s=box.selectionStart,t=box.selectionEnd,v=box.value;box.value=v.slice(0,s)+'*'+v.slice(s,t)+'*'+v.slice(t);box.focus();box.setSelectionRange(s+1,t+1);}
  if(a==='next-scene'){
    if(state.run.choices[state.run.step]===null)return;
    
    if(state.run.step<2){state.run.step++;save();navigate('chat');}
    else navigate('reflect');
  }
  if(a==='prev-scene'){state.run.step=Math.max(0,state.run.step-1);save();navigate('chat');}
  if(a==='copy-prompt')copy(promptText());
  if(a==='show-prompt'){const p=document.querySelector('#prompt-preview');p.hidden=!p.hidden;p.textContent=promptText();}
  if(a==='to-plan'){if(!fields().betterQuestion?.trim()){toast('더 구체적으로 바꾼 질문을 먼저 적어 주세요.');document.querySelector('[data-field="betterQuestion"]').focus();return;}navigate('plan');}
  if(a==='review'){const box=document.querySelector('#plan-review');box.innerHTML=review();box.scrollIntoView({behavior:'smooth',block:'center'});}
  if(a==='download'){const blob=new Blob(['﻿'+reportText()],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`지구촌탐구_${c.id}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('탐구 기록을 내려받기 시작했어요.');}
  if(a==='print')window.print();
  if(a==='clear'&&confirm('지금 이야기와 완료 목록을 이 브라우저에서 지울까요? 내려받은 파일은 지워지지 않습니다.')){state={run:null,completed:[]};save();navigate('home');toast('이 브라우저의 기록을 지웠어요.');}
});
document.addEventListener('submit',async e=>{
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
  if(e.target.id==='reflection-form'){e.preventDefault();if(['feeling','constraint','unknown'].some(k=>!fields()[k]?.trim())){toast('돌아보기 세 칸을 모두 적어 주세요.');return;}navigate('lab');}
  if(e.target.id==='plan-form'){e.preventDefault();if(planFields.some(([n])=>!fields()[n]?.trim())){toast('계획의 필수 칸을 모두 적어 주세요.');return;}state.run.finishedAt=new Date().toISOString();if(!state.completed.includes(state.run.id))state.completed.push(state.run.id);save();navigate('report');}
});
document.addEventListener('keydown',e=>{
  // 대화창: Enter로 보내고 Shift+Enter로 줄을 바꾼다.
  if(e.target.id==='say'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();say(current(),e.target.value);}
  if(e.key==='Escape'&&!document.querySelector('#modal').hidden)closeModal();
});
document.querySelector('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal();});
renderStatus();
render();
})();

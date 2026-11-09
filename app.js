(()=>{'use strict';
const cases=window.SCENARIOS,app=document.querySelector('#app'),KEY='global-life-lab-v1';
const RUN_VIEWS=['intro','play','reflect','lab','plan','report'];
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');

let state={run:null,completed:[]},view='home',filter='전체',storageOK=true;
try{
  const saved=JSON.parse(localStorage.getItem(KEY));
  if(saved&&Array.isArray(saved.completed)){
    state.completed=saved.completed.filter(id=>cases.some(c=>c.id===id));
    const r=saved.run;
    if(r&&cases.some(c=>c.id===r.id)&&Number.isInteger(r.step)&&r.step>=0&&r.step<=2&&Array.isArray(r.choices)&&r.choices.length===3&&r.choices.every(n=>n===null||n===0||n===1)&&r.fields&&typeof r.fields==='object'){
      state.run=r;
      if(!RUN_VIEWS.includes(r.view))r.view='intro';
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
const canReplace=()=>!state.run||state.run.view==='report'||confirm('진행 중인 기록을 새 이야기로 바꿀까요? 취소하면 지금 이야기를 이어갈 수 있습니다.');
// 아직 마치지 않은 캐릭터 가운데 하나를 고른다. except는 '다시 뽑기'에서 방금 나온 캐릭터를 빼기 위한 것.
function pickRandom(except){
  let pool=cases.filter(x=>!state.completed.includes(x.id)&&x.id!==except);
  if(!pool.length)pool=cases.filter(x=>x.id!==except);
  const n=new Uint32Array(1);crypto.getRandomValues(n);
  return pool[Math.floor(n[0]/4294967296*pool.length)];
}
function begin(c){
  state.run={id:c.id,step:0,choices:[null,null,null],fields:{},view:'intro',startedAt:new Date().toISOString()};
  save();navigate('intro');
}
function start(id){
  if(!canReplace())return;
  const c=cases.find(x=>x.id===id);
  if(c)begin(c);
}
function draw(except){
  if(!except&&!canReplace())return;
  const target=pickRandom(except);
  navigate('select');
  roulette(target);
}

/* ---------- 조각 ---------- */
const sourceList=c=>`<ul class="sources">${c.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><br>${esc(s.date)}</li>`).join('')}</ul>`;
const facts=c=>`<ul class="facts">${c.facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`;
const STEPS=['삶 만나기','하루 살아보기','돌아보기','질문 연구소','해결 계획'];
const trail=active=>`<div class="trail" aria-label="진행 단계">${STEPS.map((t,i)=>`<span class="${i===active?'active':i<active?'done':''}"${i===active?' aria-current="step"':''}>${pad(i+1)} ${t}</span>`).join('')}</div>`;
function lifeCard(c){return `<aside class="card"><span class="label">Life Card</span><h2>${esc(c.country)}</h2><div class="region">${esc(c.region)}</div><span class="tag">${esc(c.theme)}</span><p class="who">${esc(c.role)}</p><p class="wish">“${esc(c.wish)}”</p><hr><small>자료를 바탕으로 만든 가상 인물입니다. 인물의 말은 실제 인터뷰가 아닙니다.</small><details><summary>&gt; 이 이야기의 실제 근거</summary>${facts(c)}${sourceList(c)}</details></aside>`;}
function field(name,label,placeholder='',required=false,help=''){return `<label class="field"><span>${esc(label)}${required?' <small style="display:inline">(필수)</small>':''}</span>${help?`<small>${esc(help)}</small>`:''}<textarea data-field="${name}" name="${name}" maxlength="4000" ${required?'required':''} placeholder="${esc(placeholder)}">${esc(fields()[name]||'')}</textarea></label>`;}
const portrait=(c,cls='')=>`<span class="portrait ${cls}" aria-hidden="true"><span>${esc([...c.name][0])}</span></span>`;
function tile(c){const i=cases.indexOf(c),done=state.completed.includes(c.id);return `<button class="tile${done?' done':''}" data-start="${c.id}"><span class="tile-meta"><span>No.${pad(i+1)} · ${esc(c.theme)}</span></span><span class="tile-head">${portrait(c)}<span><span class="tile-country">${esc(c.name)}</span><span class="tile-where">${esc(c.country)}</span></span></span><span class="tile-title">${esc(c.title)}</span><span class="tile-desc">${esc(c.summary)}</span></button>`;}

/* ---------- 화면 ---------- */
function home(){return `<section class="title-screen">
  <div class="title-box"><div class="title-box-inner"><h1>다른 곳의<br>하루</h1><p>A Day in Another Life</p></div></div>
  <p class="title-lead">지구촌 어딘가에서 또래 한 사람의 하루가 시작됩니다.<br>정답 없는 선택을 하고, 그 선택이 왜 어려웠는지 묻고,<br>함께 바꿀 수 있는 내일을 계획합니다.</p>
  <p class="title-call">지금, 아래 버튼을 눌러 나의 이야기를 뽑아 보세요.</p>
  <div class="actions"><button class="btn go" data-action="random">START &gt;</button>${state.run?'<button class="btn" data-action="resume">CONTINUE &gt;</button>':''}</div>
  <p class="hint">Press &lt;START&gt; to begin<span class="blink">_</span></p>
</section>
<div class="section-head"><div><span class="label">Stage Select</span><h2>직접 고르고 싶다면</h2></div><button class="link" data-nav="atlas">12개 모두 보기 &gt;</button></div>
<div class="tiles">${cases.slice(0,6).map(tile).join('')}</div>
<div class="notice"><strong>이 체험이 한 사람의 삶 전체를 대신할 수는 없습니다.</strong> 실제 자료를 바탕으로 만들었지만 인물, 장면, 선택의 결과는 수업을 위해 꾸민 이야기입니다. 무엇을 골랐는지보다 왜 고르기 어려웠는지, 무엇이 바뀌어야 하는지에 주목해 주세요.</div>
${!storageOK?'<div class="notice">브라우저 저장을 쓸 수 없습니다. 끝난 뒤 기록을 꼭 내려받아 주세요.</div>':''}`;}

function atlas(){const shown=filter==='전체'?cases:cases.filter(c=>c.theme===filter);return `<div class="page-head"><span class="label">Stage Select</span><h1 class="title">열두 곳의 하루</h1><p>나라 전체가 아니라 특정 지역에 사는 한 사람의 조건을 따라갑니다. 난민 이야기는 떠나온 나라와 지금 머무는 나라를 함께 적었습니다. 이 브라우저에서 ${state.completed.length} / 12개를 마쳤습니다.</p></div>
<div class="filters" role="group" aria-label="주제별 보기">${['전체','환경','물','빈곤','난민','인권'].map(t=>`<button class="filter" aria-pressed="${filter===t}" data-filter="${t}">${t}</button>`).join('')}</div>
<div class="tiles">${shown.map(tile).join('')}</div>
<div class="actions"><button class="btn go" data-action="random">무작위로 뽑기 &gt;</button></div>`;}

// 캐릭터 뽑기 화면: 12칸 위로 선택 표시가 돌다가 멈춘다.
function select(){return `<section class="select">
  <span class="label center">Character Select</span>
  <h1 class="title center">오늘 당신이 살아 볼 사람은?</h1>
  <div class="slots" role="list">${cases.map((c,i)=>`<div class="slot${state.completed.includes(c.id)?' done':''}" role="listitem" data-slot="${i}">${portrait(c)}<span class="slot-name">${esc(c.name)}</span><span class="slot-where">${esc(c.country)}</span></div>`).join('')}</div>
  <p class="hint" id="select-status">뽑는 중<span class="blink">_</span></p>
</section>`;}
function roulette(target){
  const slots=[...app.querySelectorAll('.slot')],end=cases.indexOf(target);
  const land=()=>{slots.forEach(s=>s.classList.remove('on'));slots[end].classList.add('on','picked');const st=app.querySelector('#select-status');if(st)st.innerHTML=`<strong>${esc(target.name)}</strong> · ${esc(target.country)}`;setTimeout(()=>{if(view==='select')begin(target);},reduceMotion?300:900);};
  if(reduceMotion){land();return;}
  // 두 바퀴 이상 돈 뒤 목표 칸에서 멈추도록 거리를 정하고, 점점 느려지게 한다.
  const total=slots.length*2+((end-0+slots.length)%slots.length);
  let step=0,delay=45;
  const tick=()=>{
    if(view!=='select')return;
    slots.forEach(s=>s.classList.remove('on'));
    slots[step%slots.length].classList.add('on');
    if(step>=total){land();return;}
    step++;
    if(total-step<8)delay+=45;
    setTimeout(tick,delay);
  };
  tick();
}

// 캐릭터 소개: 누구인지, 어디에 사는지, 어떤 상황인지 짧게 읽고 시작한다.
function intro(c){const i=cases.indexOf(c);return `<section class="profile">
  <div class="profile-art">${portrait(c,'big')}<span class="label center">No.${pad(i+1)} · ${esc(c.theme)}</span></div>
  <div class="profile-body">
    <span class="label">Your Character</span>
    <h1 class="profile-name">${esc(c.name)}</h1>
    <p class="profile-role">${esc(c.role)}</p>
    <dl class="stats">
      <div><dt>나라</dt><dd>${esc(c.country)}</dd></div>
      <div><dt>사는 곳</dt><dd>${esc(c.region)}</dd></div>
      <div><dt>이야기</dt><dd>${esc(c.title)}</dd></div>
    </dl>
    <div class="callout"><span class="label">상황</span>${esc(c.summary)}</div>
    <p class="quote">“${esc(c.wish)}”</p>
    <details><summary>&gt; 실제로 확인된 사실 보기</summary>${facts(c)}${sourceList(c)}<p class="small" style="margin-top:12px">인물과 장면은 이 자료를 바탕으로 꾸민 이야기입니다. 선택의 결과는 예측이 아니며 점수도 없습니다.</p></details>
    <label class="field compact"><span>플레이어 이름 (선택)</span><input data-field="nickname" maxlength="40" value="${esc(fields().nickname||'')}" placeholder="모둠 이름이나 별명"></label>
    <div class="actions"><button class="btn go" data-action="begin">GAME START &gt;</button><button class="link" data-action="redraw">다른 캐릭터 뽑기</button></div>
  </div>
</section>`;}

function play(c){
  const r=state.run,s=c.scenes[r.step],chosen=r.choices[r.step],has=chosen!==null;
  const result=has?s.options[chosen].result:'';
  return `<div class="hud">
    <div class="hud-box"><span class="label">${esc(s.time)} · Scene ${pad(r.step+1)}</span>장면을 읽고 하나를 고르세요.<div class="meter" aria-label="${r.step+1} / 3 장면">${[0,1,2].map(i=>`<i class="${i<r.step||(i===r.step&&has)?'on':''}"></i>`).join('')}</div></div>
    <div class="hud-box hud-who"><span class="label">${esc(c.country)} · ${esc(c.region)}</span><strong>${esc(c.role)}</strong></div>
  </div>
  <section class="scene">
    <span class="label">${esc(s.time)}</span>
    <h1 class="title">${esc(s.title)}</h1>
    <p class="story">${esc(s.story)}</p>
    <div class="choices${has?' decided':''}" role="group" aria-label="나의 선택">${s.options.map((o,i)=>`<button class="choice" data-choice="${i}" aria-pressed="${chosen===i}"><span class="key">${'AB'[i]}</span><span>${esc(o.text)}</span></button>`).join('')}</div>
    ${has?`<p class="logged">&gt; 당신의 선택이 기록되었습니다.</p>
    <div class="result"><span class="label">Result</span><p class="typed" data-type="${esc(result)}"><span class="sr-only">${esc(result)}</span><span aria-hidden="true" class="typed-out"></span><span class="cursor" aria-hidden="true"></span></p></div>
    <div class="result-rest" hidden>
      <div class="beyond"><span class="label">Beyond Choice · 개인의 선택을 넘어</span><p>${esc(s.barrier)}</p></div>
      ${field('note'+r.step,'나는 왜 이 선택을 했을까? (선택)','가장 마음에 걸린 점이나 바꾸고 싶었던 조건을 적어 보세요.')}
      <div class="actions"><button class="btn go" data-action="next-scene">${r.step===2?'하루 돌아보기':'다음 장면'} &gt;</button>${r.step>0?'<button class="link" data-action="prev-scene">&lt; 이전 장면</button>':''}</div>
    </div>`:'<p class="hint">A 또는 B를 골라 주세요<span class="blink">_</span></p>'}
  </section>`;}

function reflect(c){return `${trail(2)}<div class="split">${lifeCard(c)}<section>
  <span class="label">Commentary</span>
  <h1 class="title">어려웠던 건,<br>선택만의 문제였을까요?</h1>
  <div class="history">${c.scenes.map((s,i)=>`<div><span class="label">${esc(s.time)} · ${esc(s.title)}</span><strong>${esc(s.options[state.run.choices[i]]?.text||'아직 고르지 않음')}</strong><p>${esc(s.barrier)}</p></div>`).join('')}</div>
  <form id="reflection-form">${field('feeling','이 사람에게 가장 중요했던 것은 무엇일까?','“불쌍하다”는 말 대신, 지키고 싶었던 일상과 권리를 생각해 보세요.',true)}${field('constraint','내 선택만으로 바꾸기 어려웠던 조건은?','시설, 제도, 소득, 안전, 차별 가운데 구체적으로 적어 보세요.',true)}${field('unknown','체험만으로는 알 수 없는 것은?','당사자에게 더 듣고 싶은 이야기나 자료로 확인할 내용을 적어 보세요.',true)}
  <div class="actions"><button class="btn go" type="submit">질문 연구소로 &gt;</button><button class="link" type="button" data-nav="play">&lt; 장면 다시 보기</button></div></form>
</section></div>`;}

function promptText(){const c=current(),f=fields();return `나는 중학교 도덕 수업에서 ${c.country}, ${c.region}의 ${c.role}의 관점으로 진행한 가상 시뮬레이션을 했습니다. 인물과 장면은 가상이며 실제 체험이나 증언이 아닙니다.\n\n확인된 배경:\n${c.facts.map(x=>'- '+x).join('\n')}\n출처와 시점:\n${c.sources.map(s=>`${s.title} (${s.date}) ${s.url}`).join('\n')}\n\n내가 발견한 조건: ${f.constraint||'(아직 작성하지 않음)'}\n처음 질문: ${f.firstQuestion||c.question}\n더 구체화한 질문: ${f.betterQuestion||c.question}\n\n위 질문에 대해 ①당사자의 요구와 이미 하는 노력 ②즉시 지원과 장기적 변화 ③주민·정부·기업·국제사회의 역할 ④부작용·비용·실행 조건을 구분해 설명해 주세요. 확인된 사실과 추론을 구분하고 근거의 발행일과 원문 링크를 제시해 주세요. 원문을 확인할 수 없거나 최신 상황을 모르면 모른다고 말해 주세요. 가상의 당사자 발언이나 통계는 만들지 마세요. 결론을 대신 정하지 말고 내가 확인해야 할 질문도 제안해 주세요.`;}

function lab(c){return `${trail(3)}<div class="split">${lifeCard(c)}<section>
  <span class="label">Question Lab</span>
  <h1 class="title">답을 받기 전에,<br>질문을 더 깊게.</h1>
  <p class="story">이 앱은 AI에 자동으로 연결되지 않습니다. 질문을 복사해 <strong>학교에서 허용한 AI</strong>에 넣고, 답을 아래에 가져와 검토하세요. AI 없이 원문 자료로 조사해도 됩니다.</p>
  <div class="callout"><span class="label">이 이야기의 출발 질문</span>${esc(c.question)}</div>
  ${field('firstQuestion','나의 첫 질문','예: 이 지역의 문제를 어떻게 해결할 수 있을까?')}
  ${field('betterQuestion','더 구체적으로 바꾼 질문','누가 겪는 어떤 어려움인가요? 실행 조건과 책임질 주체까지 넣어 보세요.')}
  <p class="small">질문에 넣어 볼 주체: ${esc(c.actors)}</p>
  <div class="actions"><button class="btn" data-action="copy-prompt">AI 질문 복사</button><button class="link" data-action="show-prompt">질문 미리보기</button></div>
  <div id="prompt-preview" class="prompt" hidden></div>
  ${field('answer','AI 답변 또는 원문 조사 내용','AI를 쓰지 않았다면 읽은 자료를 요약해도 됩니다. 개인정보는 넣지 마세요.')}
  ${field('evidence','어떤 주장을 어디에서 확인했나요?','주장 / 기관 / 자료 제목·날짜 / 원문 주소 / 일치 여부','','AI가 준 링크도 직접 열어 그 주장을 뒷받침하는지 확인하세요.')}
  ${field('revision','받아들이지 않거나 고친 내용은?','근거가 없던 주장, 빠진 사람의 입장, 지역에 맞지 않는 제안을 적어 보세요.')}
  <div class="actions"><button class="btn go" data-action="to-plan">해결 계획 세우기 &gt;</button><button class="link" data-nav="reflect">&lt; 돌아보기 고치기</button></div>
</section></div>`;}

const planFields=[['problem','우리가 해결할 구체적인 문제','누가 어느 지역에서 어떤 권리를 누리지 못하고 있나요?'],['immediate','지금 필요한 지원','당장 필요한 변화와 그것을 실행할 주체를 적어 보세요.'],['longterm','문제를 되풀이하게 만드는 조건을 바꿀 방법','제도·시설·소득·차별 등 원인에 맞서는 방법을 적어 보세요.'],['roles','누가 무엇을 책임져야 하나요?','당사자·정부·기업·국제사회 가운데 관련 주체와 역할을 나눠 보세요.'],['participation','현지 사람들의 의견과 노력을 어떻게 반영할까요?','당사자의 동의·참여와 이미 하고 있는 노력을 생각해 보세요.'],['tradeoff','비용·한계·부작용은 무엇인가요?','누가 부담을 지는지, 필요한 자원, 예상하지 못한 피해를 적으세요.'],['action','우리 모둠이 할 수 있는 구체적인 행동','누구에게, 무엇을, 언제까지 할까요? 문제의 원인과 어떻게 이어지나요?'],['measure','변화를 어떻게 확인할까요?','모금액이나 홍보 횟수 말고, 당사자의 생활이 나아졌는지 확인할 기준을 적으세요.']];

function plan(c){return `${trail(4)}<div class="split">${lifeCard(c)}<section>
  <span class="label">Design a Better Tomorrow</span>
  <h1 class="title">좋은 마음을,<br>실행할 수 있는 계획으로.</h1>
  <p class="story">개인의 노력과 공동체·제도의 변화를 이어 보세요. 정답 하나를 찾기보다 근거와 한계를 드러내는 제안을 만듭니다.</p>
  <form id="plan-form">${planFields.map(([n,l,p])=>field(n,l,p,true)).join('')}
  <span class="label mt">Final Check</span>
  <div class="checks">${[['checkedSource','원문 자료와 시점을 확인했다.'],['checkedFiction','실제 사실과 시뮬레이션의 가정을 구분했다.'],['checkedVoice','당사자의 의견과 참여를 고려했다.']].map(([n,l])=>`<label><input type="checkbox" data-field="${n}" ${fields()[n]?'checked':''}>${l}</label>`).join('')}</div>
  <div class="actions"><button class="btn go" type="submit">탐구 기록 완성 &gt;</button><button type="button" class="btn" data-action="review">계획 점검</button><button type="button" class="link" data-nav="lab">&lt; 질문 연구소</button></div>
  <div id="plan-review" aria-live="polite"></div>
  <p class="small mt">계획 점검은 빈칸이 있는지만 확인합니다. 사실이 맞는지, 해결책이 타당한지는 판단하지 않습니다.</p></form>
</section></div>`;}

function review(){const f=fields(),checks=[...planFields.map(([n,l])=>[l,typeof f[n]==='string'&&f[n].trim().length>0]),['자료 검토 기록',!!f.evidence?.trim()],['원문·시점 확인 표시',!!f.checkedSource],['사실과 가정 구분 표시',!!f.checkedFiction],['당사자 참여 검토 표시',!!f.checkedVoice]];return `<div class="mt">${checks.map(([l,ok])=>`<div class="review-line ${ok?'ok':'missing'}">${esc(l)}</div>`).join('')}</div>`;}

function reportText(){const c=current(),r=state.run,f=fields();return `다른 곳의 하루 · 지구촌 탐구 기록\n활동 이름: ${f.nickname||'미입력'}\n지역: ${c.country} / ${c.region}\n관점: ${c.role} (자료 기반 가상 인물)\n완료 시각: ${new Date(r.finishedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST\n\n※ 실제 체험·증언이 아닌 학습용 가상 시뮬레이션입니다.\n\n[하루의 선택]\n${c.scenes.map((s,i)=>`${s.time}: ${s.options[r.choices[i]]?.text||'미선택'}\n결과(가정): ${s.options[r.choices[i]]?.result||''}\n선택의 이유: ${f['note'+i]||'미작성'}`).join('\n\n')}\n\n[돌아보기]\n중요했던 것: ${f.feeling||''}\n바꾸기 어려운 조건: ${f.constraint||''}\n더 알아볼 것: ${f.unknown||''}\n\n[질문과 검토]\n첫 질문: ${f.firstQuestion||'미작성'}\n개선 질문: ${f.betterQuestion||'미작성'}\nAI 답변/원문 조사: ${f.answer||'미작성'}\n근거 대조: ${f.evidence||'미작성'}\n수정·보류한 내용: ${f.revision||'미작성'}\n\n[해결 계획]\n${planFields.map(([n,l])=>`${l}\n${f[n]||'미작성'}`).join('\n\n')}\n\n[자가 확인]\n원문·시점: ${f.checkedSource?'확인 표시':'미확인'}\n사실·가정 구분: ${f.checkedFiction?'확인 표시':'미확인'}\n당사자 참여: ${f.checkedVoice?'확인 표시':'미확인'}\n\n[자료]\n${c.sources.map(s=>`${s.title}\n${s.date}\n${s.url}`).join('\n\n')}\n\n선택 결과는 예측이나 통계가 아닙니다. 기관의 승인·감수를 받은 자료는 아닙니다.`;}

function report(c){const r=state.run,f=fields();return `<section class="report">
  <span class="label">Stage Clear</span>
  <h1 class="title">다른 곳의 하루에서,<br>함께 바꿀 내일로.</h1>
  <p class="sub" style="margin-top:12px">${esc(f.nickname||'나의 탐구 기록')} · ${esc(c.country)} / ${esc(c.region)}</p>
  <div class="actions no-print"><button class="btn go" data-action="download">기록 내려받기</button><button class="btn" data-action="print">인쇄 / PDF</button><button class="link" data-nav="plan">&lt; 계획 고치기</button></div>
  <div class="notice">이 체험으로 한 사람의 삶을 다 이해했다고 말할 수는 없습니다. 아래 기록은 자동 평가나 AI의 검증을 거친 결과가 아닙니다.</div>
  <div class="report-block mt"><h3>내가 만난 삶</h3><p>${esc(c.role)} · “${esc(c.wish)}”</p>${facts(c)}</div>
  <div class="report-block"><h3>하루의 선택과 남은 어려움</h3>${c.scenes.map((s,i)=>`<p style="margin-top:14px"><strong>${esc(s.time)} · ${esc(s.options[r.choices[i]]?.text||'미선택')}</strong>\n결과(가정): ${esc(s.options[r.choices[i]]?.result||'')}\n내 생각: ${esc(f['note'+i]||'작성하지 않음')}\n선택을 넘어: ${esc(s.barrier)}</p>`).join('')}</div>
  ${[['지키고 싶었던 일상과 권리','feeling'],['내 선택만으로 바꾸기 어려운 조건','constraint'],['아직 모르는 것','unknown'],['첫 질문','firstQuestion'],['고친 질문','betterQuestion'],['AI 답변 또는 원문 조사','answer'],['근거 확인 기록','evidence'],['고치거나 보류한 내용','revision'],...planFields.map(([n,l])=>[l,n])].map(([l,n])=>`<div class="report-block"><h3>${esc(l)}</h3><p>${esc(f[n]||'작성하지 않음')}</p></div>`).join('')}
  <div class="report-block"><h3>자가 확인</h3><p>원문·시점: ${f.checkedSource?'확인':'미확인'} / 사실·가정 구분: ${f.checkedFiction?'확인':'미확인'} / 당사자 참여: ${f.checkedVoice?'확인':'미확인'}</p></div>
  <div class="report-block"><h3>참고 자료와 시점</h3>${sourceList(c)}<p class="small" style="margin-top:12px">장면·인물·선택 결과는 가상입니다. 해당 기관의 승인이나 감수를 받은 콘텐츠가 아닙니다.</p></div>
  <div class="actions no-print"><button class="btn go" data-action="random">다른 삶 만나기 &gt;</button><button class="btn" data-nav="atlas">12개의 이야기</button></div>
  <p class="small no-print" style="margin-top:12px">새 이야기를 시작하면 지금 기록이 바뀝니다. 먼저 내려받아 두세요.</p>
</section>`;}

function guide(){return `<div class="page-head"><span class="label">For the Classroom</span><h1 class="title">체험에서 공감으로,<br>공감에서 책임으로.</h1><p>중학교 도덕 · 지구촌 문제 해결 수업. 모든 사례는 자료 시점의 특정 지역 상황이며 나라 전체를 대표하지 않습니다.</p></div>
<div class="grid3">
  <article class="cell"><span class="label">01 · 1차시 45분</span><h3>삶과 조건 만나기</h3><p>도입·자료 읽기 10분 → 이야기 뽑기·3장면 20분 → 개인 성찰과 모둠 대화 15분. 다른 선택의 결과도 비교해 봅니다.</p></article>
  <article class="cell"><span class="label">02 · 2차시 45분</span><h3>질문과 근거 검토</h3><p>질문 고치기 10분 → AI 또는 원문 조사 20분 → 출처 대조·빠진 관점 검토 15분. AI 답변을 사실로 확정하지 않습니다.</p></article>
  <article class="cell"><span class="label">03 · 3차시 45분</span><h3>함께 바꿀 계획</h3><p>해결 계획 20분 → 모둠끼리 교차 검토 15분 → 계획 고치기·기록 제출 10분. 체험 점수 대신 질문과 판단의 근거를 평가합니다.</p></article>
</div>
<div class="grid2">
  <article class="cell"><h3>12개 이야기를 모두 다루려면</h3><p>12개 모둠, 또는 6개 모둠×2회로 운영하세요. 무작위 뽑기는 이 브라우저에서 마치지 않은 이야기를 먼저 고릅니다. 여러 기기 사이의 중복은 자동으로 조정하지 않으니, ‘12개의 이야기’에서 교사가 직접 나눠 줄 수 있습니다.</p></article>
  <article class="cell"><h3>공감을 다루는 방법</h3><p>생존 점수, 빈곤 순위, 사망 결말은 없습니다. 모든 선택에는 얻는 것과 잃는 것이 있습니다. 불편한 장면은 다른 이야기로 바꾸거나 자료 읽기로 대신해도 됩니다. ‘불쌍한 사람’보다 당사자의 바람·힘·권리에 주목합니다.</p></article>
  <article class="cell"><h3>AI 사용과 기록</h3><p>질문을 복사해 외부 AI에 붙여 넣는 방식입니다. 앱이 직접 AI를 부르지 않습니다. 이름·가족 정보 같은 개인정보는 AI에 넣지 마세요. 기록은 이 브라우저에만 저장되고 교사에게 자동으로 전송되지 않습니다.</p></article>
  <article class="cell"><h3>자료의 한계</h3><p>2023년 조사와 2025~2026년 자료가 섞여 있습니다. 링크의 날짜를 확인하고 수업 전에 변화를 점검하세요. 인물·대사·장면·결과는 수업용 이야기이며 통계적 예측이나 실제 증언이 아닙니다.</p></article>
</div>
<div class="notice"><strong>평가 관점</strong> · 문제와 당사자 이해 / 질문 고치기 / 출처와 시점 확인 / 개인과 제도의 책임 구분 / 당사자 참여와 부작용 고려 / 실행과 확인 계획</div>
<div class="actions"><button class="btn go" data-nav="atlas">이야기 나눠 주기 &gt;</button><button class="btn" data-action="clear">이 브라우저의 기록 지우기</button></div>`;}

/* ---------- 연출 ---------- */
// 결과 문장을 한 글자씩 보여 준다. 클릭하거나 움직임 줄이기 설정이면 바로 전부 보여 준다.
function typewrite(){
  const box=app.querySelector('.typed');if(!box)return;
  const out=box.querySelector('.typed-out'),rest=app.querySelector('.result-rest'),text=box.dataset.type;
  let i=0;
  const finish=()=>{clearInterval(typewrite.t);out.textContent=text;rest.hidden=false;};
  clearInterval(typewrite.t);
  if(reduceMotion||typewrite.skip){typewrite.skip=false;finish();return;}
  typewrite.t=setInterval(()=>{i+=1;out.textContent=text.slice(0,i);if(i>=text.length)finish();},28);
  box.closest('.result').addEventListener('click',finish,{once:true});
}
// 장면이 바뀔 때 잠깐 보여 주는 전환 화면
function stage(label,title,then){
  const el=document.querySelector('#stage');
  if(reduceMotion){then();return;}
  el.innerHTML=`<div><div class="octa"><span>${esc(label)}</span></div><span class="label">Next Scene</span><p class="stage-title">${esc(title)}</p><p class="small">화면을 누르면 바로 넘어갑니다</p></div>`;
  el.hidden=false;
  let done=false;
  const go=()=>{if(done)return;done=true;clearTimeout(stage.t);el.hidden=true;el.innerHTML='';then();};
  el.addEventListener('click',go,{once:true});
  stage.t=setTimeout(go,1600);
}

function render(){
  const c=current();
  if(!c&&!['home','atlas','guide','select'].includes(view))view='home';
  const pages={home,atlas,guide,select,intro:()=>intro(c),play:()=>play(c),reflect:()=>reflect(c),lab:()=>lab(c),plan:()=>plan(c),report:()=>report(c)};
  app.innerHTML=(pages[view]||home)();
  document.querySelector('#resume').hidden=!state.run||RUN_VIEWS.includes(view)||view==='select';
  document.querySelectorAll('nav [data-nav]').forEach(b=>{if(b.dataset.nav===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  document.title=`${c&&RUN_VIEWS.includes(view)?c.country+' · ':''}다른 곳의 하루`;
  if(view==='play')typewrite();
}
async function copy(text){
  try{await navigator.clipboard.writeText(text);toast('질문을 복사했어요. 허용된 AI에 붙여 넣어 주세요.');}
  catch{const p=document.querySelector('#prompt-preview');if(p){p.hidden=false;p.textContent=text;const range=document.createRange();range.selectNodeContents(p);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);}toast('자동 복사가 안 됩니다. 표시된 질문을 직접 복사해 주세요.');}
}

document.addEventListener('input',e=>{const el=e.target;if(el.dataset.field&&state.run){state.run.fields[el.dataset.field]=el.type==='checkbox'?el.checked:el.value;save();}});
document.addEventListener('click',e=>{
  const el=e.target.closest('button,a#brand');if(!el)return;
  if(el.id==='brand'){e.preventDefault();navigate('home');return;}
  if(el.id==='resume'){navigate(state.run?.view||'home');return;}
  if(el.dataset.nav){navigate(el.dataset.nav);return;}
  if(el.dataset.start){start(el.dataset.start);return;}
  if(el.dataset.filter){filter=el.dataset.filter;render();return;}
  if(el.dataset.choice!==undefined){
    const n=Number(el.dataset.choice);
    if(state.run.choices[state.run.step]===n)return;
    state.run.choices[state.run.step]=n;save();render();
    app.querySelector('.logged')?.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'center'});
    return;
  }
  const a=el.dataset.action,c=current();
  if(a==='random')draw();
  if(a==='redraw')draw(c.id);
  if(a==='resume')navigate(state.run?.view||'home');
  if(a==='begin'){const s=c.scenes[state.run.step];stage(s.time,s.title,()=>navigate('play'));}
  if(a==='next-scene'){
    if(state.run.choices[state.run.step]===null)return;
    if(state.run.step<2){state.run.step++;save();const s=c.scenes[state.run.step];stage(s.time,s.title,()=>navigate('play'));}
    else navigate('reflect');
  }
  if(a==='prev-scene'){state.run.step=Math.max(0,state.run.step-1);save();typewrite.skip=true;navigate('play');}
  if(a==='copy-prompt')copy(promptText());
  if(a==='show-prompt'){const p=document.querySelector('#prompt-preview');p.hidden=!p.hidden;p.textContent=promptText();}
  if(a==='to-plan'){if(!fields().betterQuestion?.trim()){toast('더 구체적으로 바꾼 질문을 먼저 적어 주세요.');document.querySelector('[data-field="betterQuestion"]').focus();return;}navigate('plan');}
  if(a==='review'){const box=document.querySelector('#plan-review');box.innerHTML=review();box.scrollIntoView({behavior:'smooth',block:'center'});}
  if(a==='download'){const blob=new Blob(['﻿'+reportText()],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`지구촌탐구_${c.id}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('탐구 기록을 내려받기 시작했어요.');}
  if(a==='print')window.print();
  if(a==='clear'&&confirm('지금 이야기와 완료 목록을 이 브라우저에서 지울까요? 내려받은 파일은 지워지지 않습니다.')){state={run:null,completed:[]};save();navigate('home');toast('이 브라우저의 기록을 지웠어요.');}
});
document.addEventListener('submit',e=>{
  if(e.target.id==='reflection-form'){e.preventDefault();if(['feeling','constraint','unknown'].some(k=>!fields()[k]?.trim())){toast('돌아보기 세 칸을 모두 적어 주세요.');return;}navigate('lab');}
  if(e.target.id==='plan-form'){e.preventDefault();if(planFields.some(([n])=>!fields()[n]?.trim())){toast('계획의 필수 칸을 모두 적어 주세요.');return;}state.run.finishedAt=new Date().toISOString();if(!state.completed.includes(state.run.id))state.completed.push(state.run.id);save();navigate('report');}
});
// 키보드로 A/B 고르기
document.addEventListener('keydown',e=>{
  if(view!=='play'||e.target.closest('textarea,input')||e.ctrlKey||e.metaKey||e.altKey)return;
  const k=e.key.toLowerCase();if(k==='a'||k==='b')app.querySelector(`[data-choice="${k==='a'?0:1}"]`)?.click();
});
render();
})();

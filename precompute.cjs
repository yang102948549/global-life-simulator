// 「다른 곳의 하루」에서 A·B 선택으로 정해지는 부분을 미리 만들어 dist/precomputed.js로 저장한다.
// - 첫 장면 시작 칩
// - 장면 브리핑: 길 A·B를 간 삶(제목·이야기·얻은 것·잃은 것)과 그 뒤 일과(전환 화면)
// - 낮·저녁 장면 첫머리: 앞 장면에서 고른 길(A·B)별로
// 화면은 이 파일에서 바로 꺼내 쓰므로 이 부분에는 AI 호출이 없다. 대화 응답만 AI가 맡는다.
//
// 사용: node precompute.cjs              (열두 명 모두 새로 만든다)
//       node precompute.cjs ghana gaza   (일부만 새로 만들고 나머지는 그대로 둔다)
// onischool.net 서버(학교 키)를 통해 Gemini를 부른다. 만든 뒤 검토용 문서도 함께 쓴다.
const fs = require('fs'), path = require('path');
global.window = {};
const realFetch = fetch;
global.fetch = (u, o = {}) => realFetch(u.startsWith('http') ? u : 'https://onischool.net/anotherday/' + u,
  { ...o, headers: { ...(o.headers || {}), origin: 'https://onischool.net' } });
require('./dist/scenarios.js');
require('./dist/ai.js');
const G = window.AI._gen, cases = window.SCENARIOS;
const OUT = path.join(__dirname, 'dist', 'precomputed.js');
const REVIEW = path.join(__dirname, '검토용-미리만든-내용.html');
const MODEL = 'gemini-3.8-flash';

async function ask(system, schema) {
  for (let tries = 1; ; tries++) {
    try {
      const data = await G.call({
        model: MODEL, store: false, system_instruction: system,
        input: [{ type: 'user_input', content: '써 줘.' }],
        generation_config: { thinking_level: 'low', max_output_tokens: 4096 },
        safety_settings: G.SAFETY,
        response_format: { type: 'text', mime_type: 'application/json', schema },
      });
      return JSON.parse(G.outputText(data));
    } catch (e) {
      if (tries >= 3) throw e;
      await new Promise(r => setTimeout(r, 2000 * tries));
    }
  }
}

const LIFE_KEYS = ['headline', 'story', 'gained', 'lost'];
const cleanLife = x => { if (!x || !LIFE_KEYS.every(k => typeof x[k] === 'string' && x[k].trim())) throw new Error('bad life'); return Object.fromEntries(LIFE_KEYS.map(k => [k, x[k].trim()])); };
const cleanAfter = arr => { const a = (Array.isArray(arr) ? arr : []).map(x => ({ when: String(x?.when || '').trim(), text: String(x?.text || '').trim() })).filter(x => x.text).slice(0, 3); if (a.length < 2) throw new Error('bad after'); return a; };

// 한 장면의 두 삶과 그 뒤 일과를 한 번에 쓴다(두 삶의 결이 맞도록).
function scenePrompt(c, step) {
  const s = c.scenes[step], next = c.scenes[step + 1], [A, B] = s.options;
  return `${G.PROMPT_HEAD}. 지금은 한 장면이 끝난 뒤의 브리핑을 미리 쓴다. 주인공은 ${c.name}(${c.role})이다. 학생은 길 A와 B 가운데 하나를 고르고, 브리핑에는 고른 길의 삶과 고르지 않은 길의 삶이 나란히 나온다.

${G.background(c)}

[이번 장면: ${s.time} 「${s.title}」]
${s.story}
(구조적 배경: ${s.barrier})

[길 A] ${A.text}
대본의 결과: ${A.result}

[길 B] ${B.text}
대본의 결과: ${B.result}

[쓰는 법]
1. a는 길 A를, b는 길 B를 간 ${c.name}의 삶이다. 각 story는 그 길의 대본 결과를 바탕으로 3~4문장. 대본 결과에 나온 일은 모두 담고 바꾸지 마라.
2. "${c.name}은(는) …했다"처럼 3인칭 과거형으로 쓰고, 시점은 대본 결과가 다루는 때까지만 써라.
3. headline은 그 삶을 한눈에 보여 주는 짧은 제목(15자 안팎)으로, 두 삶의 차이가 드러나게 써라. gained와 lost는 대본 결과에서 드러나는 것만 한 문장으로 쓴다. 어느 길도 정답이나 실패처럼 보이게 하지 마라.
4. 결과를 과장하거나 새 불행을 만들지 마라. 개인의 노력만으로 구조적 문제가 해결된 것처럼 쓰지 마라.
5. 주인공의 마음은 대본에 드러난 만큼만 써라.
6. 한국어로, 중학생이 읽기 쉬운 짧은 문장으로 써라.
7. afterA와 afterB에는 각 길을 간 뒤 ${next ? `다음 장면(${next.time} 「${next.title}」)이 시작되기 직전까지` : '잠들 때까지'} ${c.name}의 일과를 시간 순서로 3개 써라. 그 길의 결과에 이어지게 하고, 이 지역의 평범한 생활(오가는 길, 집안일, 수업, 식사 등)을 담아라.${next ? `
   다음 장면은 이렇게 시작한다: ${next.story}
   일과는 이 상황과 어긋나면 안 되고, 다음 장면의 고민거리를 미리 풀거나 정하지 마라.
   다음 장면은 같은 날 ${next.time}이다. 시간은 같은 날 안에서만 흘러가게 하고, "다음 날"이나 "며칠 뒤"로 넘기지 마라.` : ''}
   when은 "오전 8시쯤", "점심 무렵"처럼 대략적인 때로 쓰고, text는 "${c.name}은(는) …한다"처럼 3인칭 현재형으로 25자 안팎으로 써라.

${G.SAFETY_RULES}`;
}
const SCENE_SCHEMA = { type: 'object', properties: { a: G.LIFE, b: G.LIFE, afterA: G.BETWEEN, afterB: G.BETWEEN }, required: ['a', 'b', 'afterA', 'afterB'] };

async function makeCharacter(c) {
  // 1) 첫 장면 칩과 세 장면의 두 삶을 함께 만든다.
  const [first, ...scenes] = await Promise.all([
    ask(G.openingPrompt(c, 0, [], true), G.OPENING_SCHEMA),
    ...c.scenes.map((_, i) => ask(scenePrompt(c, i), SCENE_SCHEMA)),
  ]);
  const chips0 = G.cleanChips(first.chips, 1);
  if (chips0.length < 2) throw new Error(c.id + ': 첫 장면 칩이 모자람');
  const sceneData = scenes.map(x => ({ lives: [cleanLife(x.a), cleanLife(x.b)], after: [cleanAfter(x.afterA), cleanAfter(x.afterB)] }));
  // 2) 낮·저녁 첫머리: 앞 장면에서 고른 길별로. 앞 장면의 결과는 방금 만든 '그 길의 삶'을 넘긴다.
  const openings = {};
  await Promise.all([1, 2].flatMap(step => [0, 1].map(async p => {
    const prev = c.scenes[step - 1];
    const past = [{ time: prev.time, title: prev.title, choice: prev.options[p].text, result: sceneData[step - 1].lives[p].story, said: [] }];
    const o = await ask(G.openingPrompt(c, step, past, false), G.OPENING_SCHEMA);
    if (!o?.narration?.trim()) throw new Error(c.id + ': 첫머리 없음');
    (openings[step] ||= [])[p] = {
      narration: o.narration.trim(), speaker: (o.speaker || '').trim(),
      dialogue: (o.dialogue || '').trim().replace(/^["“]|["”]$/g, ''), chips: G.cleanChips(o.chips, 1),
    };
  })));
  return { chips0, scenes: sceneData, openings };
}

function load() {
  if (!fs.existsSync(OUT)) return {};
  const w = {}; new Function('window', fs.readFileSync(OUT, 'utf8'))(w); return w.PRECOMPUTED || {};
}
function save(data) {
  const ordered = Object.fromEntries(cases.filter(c => data[c.id]).map(c => [c.id, data[c.id]]));
  fs.writeFileSync(OUT, `// 미리 만든 내용: A·B 선택으로 정해지는 부분(첫 장면 칩, 장면 브리핑과 일과, 낮·저녁 첫머리).
// precompute.cjs가 만든다. 직접 고쳐도 되지만, 다시 만들면 덮어쓰인다.
// 만든 날: ${new Date().toISOString().slice(0, 10)} · 모델: ${MODEL}
window.PRECOMPUTED=${JSON.stringify(ordered, null, 1)};
`);
}

const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function writeReview(data) {
  const life = (l, path) => `<div class="life"><p class="path">${esc(path)}</p><h4>${esc(l.headline)}</h4><p>${esc(l.story)}</p><p class="gl"><b>얻은 것</b> ${esc(l.gained)}<br><b>잃은 것</b> ${esc(l.lost)}</p></div>`;
  const after = a => `<ul class="after">${a.map(x => `<li><b>${esc(x.when)}</b> ${esc(x.text)}</li>`).join('')}</ul>`;
  const chips = cs => `<p class="chips">${cs.map(x => `<span>${esc(x.text)}</span>`).join('')}</p>`;
  const body = cases.filter(c => data[c.id]).map(c => {
    const d = data[c.id];
    return `<section><h2>${esc(c.name)} · ${esc(c.country)}</h2>
<h3>첫 장면 시작 칩</h3>${chips(d.chips0)}
${c.scenes.map((s, i) => `<h3>${esc(s.time)} 「${esc(s.title)}」</h3>
${i > 0 ? [0, 1].map(p => { const o = d.openings[i][p]; return `<div class="open"><p class="path">앞 장면에서 "${esc(c.scenes[i - 1].options[p].text)}"를 고른 경우의 첫머리</p><p>${esc(o.narration)}</p>${o.dialogue ? `<p><b>${esc(o.speaker)}</b> “${esc(o.dialogue)}”</p>` : ''}${chips(o.chips)}</div>`; }).join('') : ''}
<div class="pair">${[0, 1].map(n => `<div>${life(d.scenes[i].lives[n], `길 ${'AB'[n]} · ${s.options[n].text}`)}<p class="path">그 뒤 일과(전환 화면)</p>${after(d.scenes[i].after[n])}</div>`).join('')}</div>`).join('')}
</section>`;
  }).join('');
  fs.writeFileSync(REVIEW, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>미리 만든 내용 검토</title>
<style>body{font-family:'Malgun Gothic',sans-serif;max-width:1100px;margin:0 auto;padding:24px 16px;line-height:1.6;color:#111}h1{font-size:26px}h2{margin-top:48px;padding:10px 14px;background:#111;color:#fff}h3{margin:28px 0 8px}h4{margin:0 0 6px;font-size:18px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:700px){.pair{grid-template-columns:1fr}}.life,.open{background:#f4f3ef;padding:14px 16px;margin-bottom:8px}.path{font-size:13px;color:#5c5c5c;margin:0 0 4px}.gl{font-size:14px}.after{margin:4px 0 0;padding-left:18px;font-size:14px}.chips span{display:inline-block;background:#e9e8e3;padding:4px 10px;margin:0 6px 6px 0;font-size:14px}</style></head><body>
<h1>「다른 곳의 하루」 미리 만든 내용 검토</h1><p>A·B 선택으로 정해지는 부분입니다. 사실과 어긋나거나 고칠 문장이 있으면 dist/precomputed.js에서 직접 고치거나, 해당 캐릭터만 다시 만드세요(node precompute.cjs &lt;캐릭터 id&gt;).</p>${body}</body></html>`);
}

(async () => {
  await window.AI.serverCheck;
  if (!window.AI.server) { console.error('학교 서버에 AI 키가 없어 만들 수 없습니다.'); process.exit(1); }
  const only = process.argv.slice(2);
  const targets = only.length ? cases.filter(c => only.includes(c.id)) : cases;
  const data = only.length ? load() : {};
  let done = 0;
  // 서버에 한꺼번에 몰리지 않게 네 명씩.
  for (let i = 0; i < targets.length; i += 4) {
    await Promise.all(targets.slice(i, i + 4).map(async c => {
      for (let tries = 1; ; tries++) {
        try { data[c.id] = await makeCharacter(c); break; }
        catch (e) { if (tries >= 2) { console.error(`${c.id} 실패: ${e.message}`); return; } }
      }
      console.log(`${++done}/${targets.length} ${c.name}`);
    }));
  }
  save(data); writeReview(data);
  const missing = cases.filter(c => !data[c.id]).map(c => c.id);
  console.log(`저장: ${OUT}\n검토용: ${REVIEW}${missing.length ? `\n아직 없는 캐릭터: ${missing.join(', ')}` : ''}`);
})();

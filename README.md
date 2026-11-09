# 다른 곳의 하루

12개 국가·지역의 자료를 바탕으로 만든 중학교 도덕 수업용 대화형 시뮬레이션입니다. 학생은 무작위로 뽑힌 또래 캐릭터가 되어 아침·낮·저녁 세 장면을 보내고, AI가 맡은 주변 인물과 대화하며 정답 없는 선택을 합니다.

## 실행

`python -m http.server 4173 --directory dist --bind 127.0.0.1`

브라우저에서 http://127.0.0.1:4173 을 엽니다. 빌드 없이 HTML/CSS/JavaScript만으로 동작합니다.

## 배포 (onischool.net/anotherday — 수업용 주소)

- 주소: https://onischool.net/anotherday/
- onischool.net 사이트 저장소(`yang102948549/onischool`, 로컬 `codex/OniSchool/onischool-release`)의 `anotherday/` 폴더로 들어가고, Cloudflare Pages가 배포합니다.
- AI 키는 서버 함수 `functions/anotherday/api/chat.js`(onischool 저장소)가 Cloudflare 비밀값 `GEMINI_API_KEY`로 사용합니다. 학생 기기에는 키가 가지 않고, 키 입력 없이 바로 AI와 대화할 수 있습니다.
- 키 등록: Cloudflare 대시보드 → Workers & Pages → onischool.net을 배포하는 Pages 프로젝트 → Settings → Variables and Secrets → Production에 `GEMINI_API_KEY`(Secret) 추가 → 다시 배포.
- 고친 뒤 반영하기:

```
node validate.cjs
node sync-onischool.cjs        # dist → onischool-release/anotherday 복사
# 그다음 onischool-release 저장소에서 커밋하고 git push origin main
```

## 예비 주소 (GitHub Pages)

- 주소: https://yang102948549.github.io/global-life-simulator/ (서버 함수가 없으므로 교사가 'AI 연결'에 키를 직접 넣는 방식)
- `dist` 폴더 내용만 `gh-pages` 브랜치로 올리면 Pages가 그대로 보여 줍니다.
- 고친 뒤 다시 배포하기 (`main`에 커밋한 다음):

```
git push origin main
git subtree split --prefix dist -b gh-pages
git push -f origin gh-pages
git branch -D gh-pages
```

- Gemini 키는 Google AI Studio에서 사용처를 `https://yang102948549.github.io/*`로 제한해 두세요.

## 흐름

1. 캐릭터 뽑기: 이 브라우저에서 아직 마치지 않은 캐릭터 가운데 무작위로 고릅니다. 목록에서 직접 고를 수도 있습니다.
2. 캐릭터 소개: 나라, 사는 곳, 상황, 바람, 확인된 사실을 짧게 읽습니다. '이 사람으로 시작'을 누르면 플레이어 등록 팝업에서 이름(별명)을 적고 하루를 시작합니다.
3. 대화: 첫 장면은 대본의 상황 설명으로 시작합니다. AI가 연결되어 있으면 둘째·셋째 장면은 AI가 앞 장면의 선택·결과와 학생이 한 말을 이어 받아 첫머리를 다시 씁니다(대본의 상황·숫자·고민거리와 A·B 선택지는 그대로, 실패하면 대본 글). 학생이 캐릭터가 되어 말하거나 행동하면 AI가 서술자와 주변 인물로 답합니다. AI가 연결되어 있으면 A·B 선택지 버튼은 보이지 않습니다. 대신 AI가 매 차례 상황에 맞는 답 칩 2~3개를 제안하고(직접 써도 됨), 학생이 세 번째로 말할 차례부터 A·B에 해당하는 결정 칩(→ 표시)이 섞여 나옵니다. 결정 칩을 누르거나, 직접 쓴 말로 결정하면(확인을 거쳐) 장면 브리핑이 나옵니다: '그 뒤, ○○의 삶'(제목·이야기·얻은 것·잃은 것)과 같은 형식의 '다른 길을 간 ○○', 그리고 '선택을 넘어' 설명. 브리핑은 AI가 대본 결과를 바탕으로 대화 내용을 반영해 쓰며, AI가 없거나 실패하면 대본 결과가 그대로 나옵니다. 선택 이유는 묻지 않습니다(활동지에서 다룸). 여덟 번 말해도 정하지 못하면 '두 가지 길 보기'가 나타납니다. AI를 기다리는 동안에는 시계와 시간이 흐르는 문구가, '다음 장면'을 누르면 다음 장면 카드 안에서 점선 호를 따라 해가 왼쪽에서 오른쪽으로 한 번 지나가고(이 움직임이 진행 표시), '아침이 지나고 낮이 된다' 문구와 그사이 일과 3줄이 차례로 나온 뒤 장면이 열립니다(약 4.5초).
4. 돌아보기 → 질문 연구소 → 해결 계획 → 탐구 기록(내려받기·인쇄).

## 미리 만든 내용 (AI 호출 없음)

A·B 선택으로 정해지는 부분은 `dist/precomputed.js`에 미리 만들어 두고 화면이 바로 꺼내 씁니다: 첫 장면 시작 칩, 장면 브리핑(길 A·B를 간 두 삶, 얻은 것·잃은 것), 전환 화면의 일과 3줄, 낮·저녁 장면 첫머리(앞 장면에서 고른 길별). AI는 대화 응답(답·다음 칩·결정 판단)만 맡습니다. A를 고른 학생의 '다른 길'과 B를 고른 학생의 '내 삶'은 같은 글입니다.

- 다시 만들기: `node precompute.cjs` (전체) 또는 `node precompute.cjs ghana gaza` (일부). onischool.net 서버를 통해 Gemini를 부릅니다.
- 만들 때마다 `검토용-미리만든-내용.html`이 함께 갱신됩니다. 고칠 문장은 `dist/precomputed.js`에서 직접 고쳐도 됩니다.
- 대본(`scenarios.js`)의 장면·선택지·결과를 바꾸면 해당 캐릭터를 다시 만드세요.

## AI 대화 (Gemini)

- 상단의 **AI 연결**에서 Gemini API 키를 넣습니다. 키는 탭의 메모리에만 있고 저장되지 않아 **새로고침하면 다시 넣어야 합니다.**
- 브라우저가 Google Gemini Interactions API(`generativelanguage.googleapis.com`)를 직접 부릅니다. 서버는 없습니다.
- 대화는 `store:false`로 보내 Google 쪽에 저장되지 않게 하고, 장면 안의 대화 기록을 매번 다시 보냅니다.
- 응답은 JSON 형식(서술, 말하는 인물, 대사, 선택 A/B/none)으로 받습니다. 결과 문장은 AI가 아니라 `dist/scenarios.js`의 대본을 보여 줍니다.
- 안전장치: 괴롭힘·혐오·성적·위험 내용 필터(중간 이상 차단), 잔인한 묘사·연애 묘사·개인정보 요청을 막고 학생이 실제 고민을 털어놓으면 어른에게 이야기하도록 안내하는 지침.
- 키가 없으면 A·B 선택 버튼만으로 진행됩니다.
- 브라우저에서 쓰는 키는 사용자가 볼 수 있습니다. 교사용 키를 쓰고, Google AI Studio에서 키 사용처(HTTP 리퍼러)를 이 사이트로 제한하세요.
- 브라우저 요청에서는 `Api-Revision` 헤더가 CORS에 막히므로 보내지 않습니다(이 헤더는 2026-06-08 이후 무시됨).

## 파일

- `dist/scenarios.js`: 12개 캐릭터, 사실·출처, 장면·선택지·결과.
- `dist/ai.js`: Gemini 호출, 시스템 지침, 응답 형식, 안전 설정.
- `dist/app.js`: 화면과 진행 상태(로컬 저장).
- `dist/assets/characters/`: 캐릭터 그림(`<id>.webp`, 3:4). 없으면 이름 첫 글자 카드가 나옵니다.
- `design/reference-analysis.md`: 참고 사이트 분석 기록.

## 근거와 교육적 설정

각 사례에 출처와 시점을 명시했습니다. 인물·소망·장면·대화·선택·결과는 교육용 가정입니다. 실제 인물의 증언, 통계적 예측, 기관의 승인 자료가 아닙니다. 수업 전 원문과 정세의 변화를 확인하세요. 개인의 선택으로 구조적 문제가 해결되는 것처럼 표현하지 않으며, 점수·생존률·사망 결말을 두지 않습니다.

검증: `node validate.cjs`

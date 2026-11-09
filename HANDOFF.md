# 작업 인계: 다른 곳의 하루

다른 PC에서 이어서 작업하기 위한 정리입니다. (작성: 2026-11-09)

## 1. 한눈에 보기

- **무엇:** 중학교 도덕 「지구촌 문제」 수업용 대화형 시뮬레이션 게임. 학생이 12명 가운데 무작위로 뽑힌 또래 캐릭터가 되어 아침·낮·저녁 세 장면을 보내고, AI(Gemini)가 맡은 주변 인물과 자유롭게 대화한 뒤 A·B 중 하나를 직접 고릅니다. 이후 돌아보기 → 질문·조사 → 해결 계획 → 탐구 기록으로 마무리합니다.
- **수업용 주소:** https://onischool.net/anotherday/
- **예비 주소:** https://yang102948549.github.io/global-life-simulator/ (서버가 없어 교사가 'AI 연결'에 키를 직접 넣는 방식)
- **기기:** 학생은 휴대폰·태블릿으로 접속합니다. 반응형으로 만들었습니다.

## 2. 저장소 두 개

| 저장소 | 역할 | 로컬 경로(이 PC 기준) |
|---|---|---|
| `yang102948549/global-life-simulator` (공개) | 시뮬레이터 원본. 여기서 고칩니다. | `Desktop/OneDrive/1.교과서/도덕1/3.사회공동체와의 관계/global-life-simulator` |
| `yang102948549/onischool` (비공개) | onischool.net 사이트. 시뮬레이터 복사본(`anotherday/`)과 AI 서버 함수가 들어 있습니다. | `Desktop/OneDrive/codex/OniSchool/onischool-release` |

### global-life-simulator 구성

- `dist/` — 배포되는 앱 전체(빌드 과정 없음)
  - `index.html`, `style.css`
  - `app.js` — 화면과 진행 상태(브라우저 localStorage에 저장)
  - `ai.js` — Gemini 호출, 진행자 지시문(시스템 프롬프트), 응답 형식, 안전 설정
  - `scenarios.js` — 12명 캐릭터, 사실·출처, 장면·선택지·결과(대본)
  - `assets/characters/<id>.webp`, `<id>-face.webp` — 캐릭터 그림(웹용)
- `design/characters.md` — 캐릭터 그림 설계서(이미지 생성 프롬프트)
- `design/reference-analysis.md` — 참고 사이트(앰네스티 불편실험) 분석
- `validate.cjs` — 시나리오·문법 검사 (`node validate.cjs`)
- `sync-onischool.cjs` — `dist`를 onischool 저장소의 `anotherday/`로 복사
- `art-source/` — 캐릭터 그림 원본 PNG(약 94MB). **git에서 제외**되어 GitHub에는 없습니다. OneDrive로 동기화되거나 이 PC에만 있습니다.

### onischool 저장소에 추가한 것

- `anotherday/` — `dist` 복사본(직접 고치지 말고 `sync-onischool.cjs`로 덮어쓰기)
- `functions/anotherday/api/chat.js` — Cloudflare Pages 함수. Gemini 키를 서버 비밀값으로 쓰고, 학생 기기에는 키를 보내지 않습니다.
- `_redirects` — `/anotherday` → `/anotherday/`

## 3. 다른 PC에서 시작하기

```bash
# 1) 두 저장소 받기 (OneDrive로 폴더가 동기화되어 있으면 생략 가능)
gh auth login
git clone https://github.com/yang102948549/global-life-simulator.git
git clone https://github.com/yang102948549/onischool.git onischool-release

# 2) 이 PC에서 쓰던 커밋 작성자(저장소별 설정)
cd global-life-simulator && git config user.name yang4u4u4u4u && git config user.email yang4u4u4u4u@gmail.com && cd ..
cd onischool-release && git config user.name yang102948549 && git config user.email 212488315+yang102948549@users.noreply.github.com && cd ..

# 3) 로컬에서 보기
cd global-life-simulator
python -m http.server 4173 --directory dist --bind 127.0.0.1   # http://127.0.0.1:4173
```

- 로컬 서버에는 AI 서버 함수가 없으므로 'AI 연결'에 키를 직접 넣어야 AI 대화가 됩니다(키는 메모리에만 있고 새로고침하면 사라짐).
- 두 저장소의 위치가 이 PC와 다르면 `node sync-onischool.cjs <onischool-release 경로>`처럼 경로를 넘겨 주세요.

## 4. 고친 뒤 배포하기

```bash
cd global-life-simulator
node validate.cjs
git add -A && git commit -m "..." && git push origin main

# (1) 수업용 onischool.net/anotherday
node sync-onischool.cjs            # dist → onischool-release/anotherday
cd ../onischool-release            # 경로는 PC마다 다를 수 있음
git add anotherday && git commit -m "Update anotherday" && git push origin main
# → Cloudflare Pages(oni-school 프로젝트)가 Git 연동으로 1분 안에 자동 배포

# (2) 예비 GitHub Pages (선택)
cd ../global-life-simulator
git subtree split --prefix dist -b gh-pages && git push -f origin gh-pages && git branch -D gh-pages
```

## 5. Cloudflare와 AI 키

- onischool.net을 배포하는 Pages 프로젝트: **`oni-school`** (Git 연동, onischool.net·www 연결). `onischool`은 예전 직접 업로드 프로젝트입니다.
- 키는 `oni-school` 프로젝트의 비밀값 **`GEMINI_API_KEY`**(Production)에 있습니다. 바꿀 때:

```bash
npx --yes wrangler login
NODE_OPTIONS=--use-system-ca npx wrangler pages secret put GEMINI_API_KEY --project-name oni-school
# 비밀값은 새 배포부터 적용 → onischool-release에서 빈 커밋을 올려 다시 배포
git commit --allow-empty -m "Redeploy" && git push origin main
```

- 학교 네트워크에서는 보안 장비가 인증서를 바꿔 끼워 wrangler가 실패합니다. 명령 앞에 `NODE_OPTIONS=--use-system-ca`를 붙이면 됩니다. 집 등 다른 네트워크에서는 없어도 됩니다.
- 확인: https://onischool.net/anotherday/api/chat 이 `{"ok":true,"configured":true}`면 서버 키가 적용된 것입니다.
- **인계 시점 상태:** `wrangler pages secret put`이 입력칸 없이 바로 성공으로 끝나서, **키가 빈 값으로 저장됐을 가능성**이 있습니다. 다시 배포한 뒤 위 주소가 `configured:false`로 남아 있으면, Cloudflare 대시보드(Workers & Pages → oni-school → Settings → Variables and Secrets)에서 `GEMINI_API_KEY`를 직접 다시 넣고 다시 배포하세요.
- Google AI Studio에서 이 키의 사용량 상한을 정해 두길 권합니다.

### 서버 함수가 지키는 것 (`functions/anotherday/api/chat.js`)

- onischool.net(및 `*.pages.dev`, localhost)에서 온 요청만 받습니다.
- 시스템 지시문이 `너는 중학교 도덕 수업에서 쓰는 대화형 시뮬레이션의 진행자다`로 시작해야 합니다. **`ai.js`의 지시문 첫 문장을 바꾸면 서버 함수의 `PROMPT_PREFIX`도 같이 바꿔야 합니다.**
- 모델은 `gemini-3.8-flash`, `gemini-3.5-flash-lite`만 허용합니다(`ai.js`의 `MODELS`와 맞춰야 함).
- `store:false`, 안전 필터 4종(중간 이상 차단), 답 길이 상한 2048토큰은 서버가 강제로 넣습니다.
- 요청 크기 120KB, 대화 단계 80개 상한. IP당 분당 240회(학교 전체가 같은 IP를 쓰는 경우를 고려해 넉넉하게).

## 6. AI 대화 설계

- Gemini **Interactions API**(`v1beta/interactions`)를 씁니다. `store:false`로 보내고 장면 안의 대화 기록을 매번 다시 보냅니다.
- 브라우저에서 직접 부를 때는 `Api-Revision` 헤더를 보내지 않습니다. 이 헤더가 CORS에서 막히고, 2026-06-08 이후에는 무시되는 헤더입니다.
- 응답은 JSON(`narration`, `speaker`, `dialogue`, `lean`)입니다.
- **AI는 결정하지 않습니다.** 학생이 자유롭게 대화하고, 결정은 A·B 버튼으로만 내립니다. `lean`은 학생의 말이 기운 쪽을 버튼에 살짝 표시하는 용도입니다. (처음에는 AI가 A·B를 판정해 장면을 끝냈는데, 대화가 너무 빨리 끝난다는 피드백으로 바꿨습니다.)
- 결과 문장은 AI가 아니라 `scenarios.js`의 대본을 보여 줍니다(사실성·교육 목표 유지).
- 앱은 시작할 때 `api/chat`을 조회해 서버 키가 있으면 서버로, 없으면 교사가 넣은 키로 Google에 직접 보냅니다.

## 7. 디자인 결정

- 캐릭터 일러스트(따뜻한 수채화풍)에 맞춘 **종이색 동화책 테마**. 제목·이야기 문장은 고운바탕, 나머지는 Pretendard.
- 캐릭터마다 그림 속 옷·소품 색에서 고른 포인트 색(`app.js`의 `TONE`).
- 게임 흐름: 타이틀 → 캐릭터 뽑기(룰렛) → 캐릭터 소개 → 장면 카드(왼쪽 전신 그림, 오른쪽 카드) → 결과 카드 → 마무리 4단계.
- 휴대폰·태블릿(≤900px): 그림은 원형 얼굴로 줄고, 입력칸과 선택 버튼이 화면 아래에 붙습니다. `dvh`, 44px 터치 영역, 16px 입력 글자(아이폰 확대 방지).
- 캐릭터 그림은 AI로 생성했습니다. 오른쪽 아래 생성 도구 표시(✦)는 일부러 남겼고, 바닥글에 "캐릭터 그림은 AI로 만들었습니다"라고 적었습니다.

## 8. 남은 일과 확인할 것

- [ ] 서버 키 적용 확인(`configured:true`). 5절 참고.
- [ ] 실제 키로 수업 전 시험: 대화가 자유롭게 길게 이어지는지, 주변 인물이 되묻고 조건을 드러내는지, 안전 지침이 지켜지는지.
- [ ] 실제 휴대폰·태블릿으로 접속해 확인(지금까지는 브라우저에서 390px·820px 폭으로만 확인).
- [ ] 누르(rohingya) 그림 속 교과서에 잘못된 영어 글자("TEXT BOCKBOOK")가 있음. 필요하면 다시 생성.
- [ ] 뽑기 룰렛 애니메이션은 '애니메이션 줄이기' 설정이 꺼진 기기에서만 보입니다. 꺼진 기기에서 한 번 확인.
- [ ] (선택) 장면 시작 때 주변 인물이 먼저 말을 거는 기능. 요청이 나왔지만 아직 만들지 않았습니다.
- 참고: global-life-simulator는 공개 저장소이고, 커밋 작성자 이메일(yang4u4u4u4u@gmail.com)이 공개되어 있습니다(사용자 확인 후 그대로 둠).
- 참고: GitHub 로그인 토큰에 `workflow` 권한이 없어 GitHub Actions 자동 배포 대신 `gh-pages` 브랜치 방식을 씁니다.

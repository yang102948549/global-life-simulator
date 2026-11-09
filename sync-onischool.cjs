// dist 폴더를 onischool.net 사이트 저장소의 anotherday/ 폴더로 복사한다.
// 사용: node sync-onischool.cjs [onischool-release 폴더 경로]
// 복사 뒤 onischool-release 저장소에서 커밋·푸시하면 Cloudflare Pages가 onischool.net/anotherday/ 로 배포한다.
const fs = require('fs'), path = require('path');
const site = path.resolve(process.argv[2] || path.join(__dirname, '../../../../codex/OniSchool/onischool-release'));
if (!fs.existsSync(path.join(site, 'build_pages.py'))) {
  console.error(`onischool-release 폴더를 찾지 못했습니다: ${site}`);
  process.exit(1);
}
const src = path.join(__dirname, 'dist'), dest = path.join(site, 'anotherday');
// fs.cpSync는 이 PC의 한글 OneDrive 경로에서 Node가 비정상 종료되어, 파일을 하나씩 복사한다.
let count = 0;
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name), b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b);
    else { fs.copyFileSync(a, b); count++; }
  }
}
fs.rmSync(dest, { recursive: true, force: true });
copyDir(src, dest);
console.log(`${count}개 파일을 복사했습니다 → ${dest}`);

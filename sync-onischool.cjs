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
// 학교 사이트는 코드 파일을 브라우저가 4시간 동안 다시 묻지 않게 보낸다(Cloudflare 계정 설정).
// 그래서 index.html의 ?v= 값을 파일 내용의 해시로 바꿔, 파일이 바뀌면 주소가 달라져 바로 새로 받게 한다.
const crypto = require('crypto');
const indexPath = path.join(dest, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8').replace(/(href|src)="([\w.-]+\.(?:js|css))(?:\?v=[^"]*)?"/g, (m, attr, file) => {
  const f = path.join(dest, file);
  if (!fs.existsSync(f)) return m;
  const v = crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 10);
  return `${attr}="${file}?v=${v}"`;
});
fs.writeFileSync(indexPath, html);
console.log(`${count}개 파일을 복사했습니다 → ${dest}`);

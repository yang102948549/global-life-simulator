// 「다른 곳의 하루」 Gemini 중계 Worker (+ 결과물 갤러리 저장소, 아래 GalleryStore).
// 왜 필요한가: Cloudflare는 접속한 곳에서 가까운 서버에서 함수를 돌린다. 한국 학교망은 홍콩(HKG) 서버로
// 연결되는 일이 많은데, Gemini API는 홍콩에서 온 요청을 "User location is not supported"로 막는다.
// 그래서 Gemini 호출만 미국 동부에 고정한 Durable Object 안에서 보낸다.
// - onischool.net의 Pages 함수(functions/anotherday/api/chat.js)만 RELAY_TOKEN을 알고 이 Worker를 부른다.
// - API 키는 Pages 함수가 헤더로 넘긴다. 이 Worker는 키를 저장하지 않는다.
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const HINT = 'enam';   // 미국 동부
const SHARDS = 4;      // 한 반이 동시에 보내도 한 객체에 몰리지 않게 몇 개로 나눈다

export class GeminiRelay {
  async fetch(request) {
    // 진단용: 이 객체가 실제로 어느 데이터센터에서 도는지 알려 준다.
    if (request.method === 'GET') {
      const trace = await (await fetch('https://www.cloudflare.com/cdn-cgi/trace')).text();
      const pick = k => (trace.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1];
      return Response.json({ colo: pick('colo'), loc: pick('loc') });
    }
    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': request.headers.get('x-goog-api-key') },
      body: request.body,
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
}

// 결과물 갤러리 저장소. 학생이 '제출'한 결과물(신문 기사·정책 제안서·편지)을 모아 둔다.
// 한 학생(학년·반·번호)은 한 장만: 다시 내면 최신 글로 바뀐다.
// 검사(출처·크기·형식)와 관리자 비밀번호 확인은 Pages 함수(functions/anotherday/api/gallery.js)가 한다.
const mask = name => {
  const s = [...String(name || '')];
  if (s.length <= 1) return s.join('');
  if (s.length === 2) return s[0] + '*';
  return s[0] + '*'.repeat(s.length - 2) + s[s.length - 1];
};
export class GalleryStore {
  constructor(ctx) {
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS subs(
      key TEXT PRIMARY KEY, grade INTEGER, cls INTEGER, num INTEGER, name TEXT,
      cid TEXT, format TEXT, data TEXT, created INTEGER, updated INTEGER)`);
  }
  async fetch(request) {
    const { pathname } = new URL(request.url);
    const body = request.method === 'POST' ? await request.json() : {};
    if (pathname.endsWith('/list')) {
      const rows = this.sql.exec('SELECT * FROM subs ORDER BY updated DESC LIMIT 1000').toArray();
      return Response.json({ items: rows.map(r => ({
        key: r.key, grade: r.grade, cls: r.cls, num: r.num,
        name: body.admin ? r.name : mask(r.name),
        cid: r.cid, format: r.format, data: JSON.parse(r.data), updated: r.updated,
      })) });
    }
    if (pathname.endsWith('/submit')) {
      const s = body.sub, key = `${s.grade}-${s.cls}-${s.num}`, now = Date.now();
      const old = this.sql.exec('SELECT created FROM subs WHERE key = ?', key).toArray()[0];
      this.sql.exec(`INSERT OR REPLACE INTO subs(key, grade, cls, num, name, cid, format, data, created, updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        key, s.grade, s.cls, s.num, s.name, s.cid, s.format, JSON.stringify(s.data), old ? old.created : now, now);
      return Response.json({ ok: true, key, replaced: !!old });
    }
    if (pathname.endsWith('/delete')) {
      this.sql.exec('DELETE FROM subs WHERE key = ?', String(body.key || ''));
      return Response.json({ ok: true });
    }
    return new Response('Not found', { status: 404 });
  }
}

export default {
  async fetch(request, env) {
    if (!env.RELAY_TOKEN || request.headers.get('x-relay-token') !== env.RELAY_TOKEN) {
      return new Response('Forbidden', { status: 403 });
    }
    // 갤러리는 한국 학생이 쓰므로 아시아·태평양에 둔 하나의 저장소로 보낸다.
    if (new URL(request.url).pathname.startsWith('/gallery/')) {
      const stub = env.GALLERY.get(env.GALLERY.idFromName('anotherday-gallery'), { locationHint: 'apac' });
      return stub.fetch(request);
    }
    if (request.method === 'POST' && !request.headers.get('x-goog-api-key')) {
      return new Response('Missing key', { status: 400 });
    }
    const name = `relay-${HINT}-${Math.floor(Math.random() * SHARDS)}`;
    const stub = env.RELAY.get(env.RELAY.idFromName(name), { locationHint: HINT });
    return stub.fetch(request);
  },
};

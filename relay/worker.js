// 「다른 곳의 하루」 Gemini 중계 Worker.
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

export default {
  async fetch(request, env) {
    if (!env.RELAY_TOKEN || request.headers.get('x-relay-token') !== env.RELAY_TOKEN) {
      return new Response('Forbidden', { status: 403 });
    }
    if (request.method === 'POST' && !request.headers.get('x-goog-api-key')) {
      return new Response('Missing key', { status: 400 });
    }
    const name = `relay-${HINT}-${Math.floor(Math.random() * SHARDS)}`;
    const stub = env.RELAY.get(env.RELAY.idFromName(name), { locationHint: HINT });
    return stub.fetch(request);
  },
};

// 점심·저녁 '오늘 뭐 먹지' 알림 보내기 (pg_cron이 하루 두 번 부름)
// 필요한 비밀값(Supabase > Edge Functions > Secrets): VAPID_PUBLIC, VAPID_PRIVATE, CRON_SECRET
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 Supabase가 자동으로 넣어 줌
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LUNCH = ['김치찌개', '제육볶음', '비빔밥', '돈까스', '칼국수', '쌀국수', '김밥', '된장찌개', '냉면', '카레라이스'];
const DINNER = ['삼겹살', '치킨', '부대찌개', '닭갈비', '떡볶이', '족발', '감자탕', '초밥', '파스타', '마라탕'];
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('no', { status: 401 });
  const { slot } = await req.json().catch(() => ({ slot: '' }));
  if (slot !== 'lunch' && slot !== 'dinner') return new Response('bad slot', { status: 400 });

  webpush.setVapidDetails('mailto:help@omechu.app', Deno.env.get('VAPID_PUBLIC')!, Deno.env.get('VAPID_PRIVATE')!);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: subs, error } = await sb.from('push_subs').select('endpoint,p256dh,auth').contains('slots', [slot]).limit(5000);
  if (error) return new Response(error.message, { status: 500 });

  const menu = pick(slot === 'lunch' ? LUNCH : DINNER);
  const payload = JSON.stringify({
    title: slot === 'lunch' ? '점심 뭐 먹지?' : '저녁 뭐 먹지?',
    body: `오늘은 ${menu} 어때요? 눌러서 3개 골라 받기`,
    url: '/?from=push',
  });
  let sent = 0, gone = 0;
  for (const s of subs ?? []) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 }); sent++; }
    catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await sb.from('push_subs').delete().eq('endpoint', s.endpoint); gone++; }   // 앱 지웠거나 알림 끈 주소
    }
  }
  return new Response(JSON.stringify({ slot, sent, gone }), { headers: { 'Content-Type': 'application/json' } });
});

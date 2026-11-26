// 오메추리 AI 기능 서버 (Gemini)
//  - yt_recipe : 유튜브 링크 → 재료·양·조리 순서 (같은 영상은 저장해 두고 다시 씀)
//  - owner     : 먹자골목 사장님(추리)과 짧은 대화, 메뉴 추천
// 필요한 비밀값(Supabase > Edge Functions > Secrets): GEMINI_API_KEY  (선택: GEMINI_MODEL)
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 Supabase가 자동으로 넣어 줌
// 배포할 때 'Verify JWT' 는 끔 (앱이 익명 키로 부름. 대신 user_key+secret 으로 확인)
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest';
const LIMIT = { yt_recipe: 10, owner: 40, talk: 30 }; // 사람당 하루 횟수
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// 모델이 붐비면(503·429) 잠깐 쉬고 다시, 그래도 안 되면 다른 모델로
const FALLBACK = [MODEL, 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-lite-latest'];
// quick=true: 생각(thinking) 없이 바로 답 → 짧은 답이 빠르고 잘리지 않음. 모델이 이 옵션을 거절하면 빼고 다시
async function gemini(parts: unknown[], jsonOut: boolean, maxTokens = 2048, lowRes = false, quick = false) {
  const errs: string[] = [];
  // 짧은 답은 전체 24초 안에 끝냄 (앱은 26초 뒤 규칙 추천으로 넘어감). 한 모델이 12초 넘게 붙잡으면 다음 모델로
  const until = Date.now() + (quick ? 24000 : 140000);
  for (const model of [...new Set(FALLBACK)]) {
    if (Date.now() > until - 1500) break;
    let think = quick;
    for (let attempt = 0; attempt < 3; attempt++) {
      let r: Response;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        signal: AbortSignal.timeout(Math.max(1000, Math.min(until - Date.now(), quick ? 12000 : 120000))),
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')! },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: jsonOut ? 0.2 : 0.8, maxOutputTokens: maxTokens, ...(jsonOut ? { responseMimeType: 'application/json' } : {}), ...(lowRes ? { mediaResolution: 'MEDIA_RESOLUTION_LOW' } : {}), ...(think ? { thinkingConfig: { thinkingBudget: 0 } } : {}) } }),
        });
      } catch (e) { errs.push(`${model} timeout ${String(e).slice(0, 60)}`); break; }
      if (r.ok) {
        const d = await r.json();
        return (d.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
      }
      const et = (await r.text()).replace(/\s+/g, ' ');
      errs.push(`${model} ${r.status} ` + et.slice(0, 160));
      if (r.status === 400 && think && /thinking/i.test(et)) { think = false; continue; }
      if (r.status === 503 || r.status === 429 || r.status >= 500) { await new Promise((res) => setTimeout(res, 1200)); continue; }
      break; // 404(모델 없음)·400 등은 다음 모델로
    }
  }
  throw new Error('gemini ' + errs.join(' | '));
}

// 문장 뜻을 숫자 768개로 (비슷한 문장 찾기용). 실패하면 null
async function embed(text: string): Promise<number[] | null> {
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent', {
      method: 'POST', signal: AbortSignal.timeout(6000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')! },
      body: JSON.stringify({ content: { parts: [{ text }] }, taskType: 'SEMANTIC_SIMILARITY', outputDimensionality: 768 }),
    });
    if (!r.ok) return null;
    const d = await r.json(); const v = d.embedding?.values;
    return Array.isArray(v) && v.length === 768 ? v : null;
  } catch { return null; }
}

function ytId(u: string) {
  const m = String(u || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}

// 영상 설명란 (YouTube Data API가 켜져 있을 때만. 키는 YT_API_KEY, 없으면 GEMINI_API_KEY로 시도)
async function ytInfo(id: string): Promise<{ title: string; channel: string; channelId: string; desc: string } | null> {
  const key = Deno.env.get('YT_API_KEY') || Deno.env.get('GEMINI_API_KEY');
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${key}`);
    if (!r.ok) return null;
    const d = await r.json(); const sn = d.items?.[0]?.snippet; if (!sn) return null;
    return { title: String(sn.title || ''), channel: String(sn.channelTitle || ''), channelId: String(sn.channelId || ''), desc: String(sn.description || '').slice(0, 5000) };
  } catch { return null; }
}
// 댓글 맨 위(인기순) 몇 개 중 재료가 적힌 것. 채널 주인이 쓴 댓글(보통 고정 댓글)을 먼저. 댓글이 막혀 있으면 ''
async function ytTopComment(id: string, channelId: string): Promise<string> {
  const key = Deno.env.get('YT_API_KEY') || Deno.env.get('GEMINI_API_KEY');
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${id}&order=relevance&maxResults=8&textFormat=plainText&key=${key}`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return '';
    const d = await r.json();
    const cs = (d.items || []).map((it: any) => it.snippet?.topLevelComment?.snippet).filter(Boolean)
      .map((c: any) => ({ t: String(c.textOriginal || c.textDisplay || ''), own: !!channelId && c.authorChannelId?.value === channelId }))
      .filter((c: { t: string }) => looksLikeRecipe(c.t));
    cs.sort((a: { own: boolean }, b: { own: boolean }) => Number(b.own) - Number(a.own));
    return cs[0]?.t.slice(0, 4000) || '';
  } catch { return ''; }
}
const looksLikeRecipe = (t: string) => (t.match(/(큰술|작은술|컵|스푼|티스푼|\d+\s?(g|ml|개|장|쪽|줌|T|t)(?![A-Za-z])|재료)/g) || []).length >= 4;

const RECIPE_PROMPT = `이 요리 영상을 보고 레시피를 정리해 줘. 한국어로, 아래 JSON 형식만 출력해.
{"ok":true,"title":"요리 이름(짧게)","emoji":"요리에 맞는 이모지 1개","servings":영상 기준 인분 숫자,
 "ingredients":[["재료 이름","양(예: 1큰술, 200g, 1/2개, 약간)"]],
 "water":"물이 들어가면 총량(예: 2컵, 400ml), 없으면 빈 문자열",
 "steps":["한 줄에 한 단계, 시간이나 불 세기가 나오면 꼭 적기 (예: 중불에서 5분 끓인다)"],
 "guess":["영상에서 양을 정확히 말하지 않아 추정한 재료 이름들"]}
규칙: 재료 이름은 마트에서 찾는 이름으로(예: '다진마늘','대파'). 1큰술=15ml, 1작은술=5ml, 1컵=200ml 기준. 단계는 12개 이하.
요리 영상이 아니거나 레시피를 알 수 없으면 {"ok":false,"reason":"이유"} 만 출력.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, reason: 'method' }, 405);
  const body = await req.json().catch(() => ({}));
  const { action, user_key, secret } = body || {};
  if (!['yt_recipe', 'owner', 'talk'].includes(action)) return json({ ok: false, reason: 'action' }, 400);
  if (!Deno.env.get('GEMINI_API_KEY')) return json({ ok: false, reason: '아직 준비 중이에요' }, 503);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: okUser } = await sb.rpc('_owner_ok', { p_user_key: user_key, p_secret: secret });
  if (!okUser) return json({ ok: false, reason: '사용자 확인이 안 돼요' }, 401);

  try {
    if (action === 'yt_recipe') {
      const id = ytId(body.url);
      if (!id) return json({ ok: false, reason: '유튜브 영상 주소가 아니에요' }, 400);
      const { data: cached } = await sb.from('ai_recipes').select('data').eq('video_id', id).maybeSingle();
      if (cached?.data) return json({ ok: true, cached: true, video_id: id, recipe: cached.data });
      const { data: allowed } = await sb.rpc('ai_take', { p_user_key: user_key, p_kind: 'yt_recipe', p_limit: LIMIT.yt_recipe });
      if (!allowed) return json({ ok: false, reason: `오늘은 ${LIMIT.yt_recipe}번까지 가져올 수 있어요. 내일 다시 해 주세요` }, 429);
      // ① 설명란에 재료가 적혀 있으면 글만 읽고 끝 (몇 초) ② 없으면 영상을 2초에 1장, 저화질로 봄
      const info = await ytInfo(id);
      // 설명란에 재료가 없으면 댓글 맨 위(고정·인기 댓글)도 봄
      const descOk = !!info && looksLikeRecipe(info.desc);
      const cmt = info && !descOk ? await ytTopComment(id, info.channelId) : '';
      const src = descOk ? `영상 설명란:\n${info!.desc}` : cmt ? `영상 설명란:\n${info!.desc.slice(0, 1500)}\n\n맨 위 댓글(재료가 적힌 고정·인기 댓글):\n${cmt}` : '';
      let out = '', via = 'video';
      if (src) {
        try {
          out = await gemini([{ text: `영상 제목: ${info!.title}\n채널: ${info!.channel}\n${src}\n\n위 글만 보고 정리해. 조리 순서가 없으면 재료만 채우고 steps는 빈 배열로 둬.\n` + RECIPE_PROMPT }], true, 4096);
          const t = JSON.parse(out); if (t?.ok && t.ingredients?.length >= 3 && t.steps?.length >= 3) via = descOk ? 'desc' : 'comment'; else out = '';
        } catch { out = ''; }
      }
      const hint = descOk ? info!.desc.slice(0, 2500) : cmt ? cmt.slice(0, 2500) : (info?.desc || '').slice(0, 2500);
      if (!out) out = await gemini([{ file_data: { file_uri: `https://www.youtube.com/watch?v=${id}` }, video_metadata: { fps: 0.5 } }, { text: (hint ? `참고용 글(설명란 또는 맨 위 댓글, 재료 양이 적혀 있으면 이걸 우선):\n${hint}\n\n` : '') + RECIPE_PROMPT }], true, 4096, true);
      let recipe; try { recipe = JSON.parse(out); } catch { return json({ ok: false, reason: '영상을 정리하지 못했어요. 다시 시도해 주세요' }, 502); }
      if (!recipe?.ok || !Array.isArray(recipe.ingredients) || !Array.isArray(recipe.steps) || !recipe.steps.length) return json({ ok: false, reason: recipe?.reason || '이 영상에서는 레시피를 찾지 못했어요' }, 422);
      recipe.ingredients = recipe.ingredients.filter((x: unknown) => Array.isArray(x) && x[0]).slice(0, 30).map((x: string[]) => [String(x[0]).slice(0, 20), String(x[1] || '').slice(0, 20)]);
      recipe.steps = recipe.steps.slice(0, 14).map((x: string) => String(x).slice(0, 160));
      recipe.title = String(recipe.title || '유튜브 레시피').slice(0, 24);
      recipe.via = via; if (info?.channel) recipe.channel = info.channel.slice(0, 40);
      await sb.from('ai_recipes').upsert({ video_id: id, data: recipe });
      return json({ ok: true, video_id: id, recipe });
    }

    if (action === 'talk') {
      const text = String(body.text || '').slice(0, 80).trim();
      const tags = (Array.isArray(body.tags) ? body.tags : []).slice(0, 120).map((t: unknown) => String(t).slice(0, 24));
      if (!text || !tags.length) return json({ ok: false, reason: 'empty' }, 400);
      // ① 저장된 답: 같은 문장이거나 아주 비슷하고 '안·빼고·말고' 같은 부정어 구성이 같으면 AI 없이 바로
      const norm = text.toLowerCase().replace(/(먹고\s?싶[어다네음]?|뭐\s?먹[지을까]*|추천\s?해?\s?줘?|해\s?줘|좀|요(?=$|[.!?\s]))/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
      const negSig = (t: string) => [/안(?![주심전녕방경])/, /빼/, /말고/, /싫/, /못/, /없/, /덜/].map((re) => (re.test(t) ? 1 : 0)).join('');
      const fit = (r: any) => ({ inc: (r.inc || []).filter((x: string) => tags.includes(x)), exc: (r.exc || []).filter((x: string) => tags.includes(x)), cat: r.cat || '', clues: r.clues || [], reason: r.reason || '' });
      let emb: number[] | null = null;
      if (norm.length >= 2) {
        // 똑같은 문장 → 바로. 아니면 뜻이 아주 비슷하고(0.9 이상) 부정어 구성이 같은 문장 → 바로
        const { data: same } = await sb.from('talk_cache').select('norm,result').eq('norm', norm).maybeSingle();
        let h: { norm: string; result: any } | null = same || null;
        if (same) { const { data: e0 } = await sb.from('talk_cache').select('norm').eq('norm', norm).is('emb', null).maybeSingle(); if (e0) { const v = await embed(text); if (v) await sb.from('talk_cache').update({ emb: JSON.stringify(v) }).eq('norm', norm); } }
        if (!h) {
          emb = await embed(text);
          if (emb) {
            const { data: near } = await sb.rpc('talk_cache_near', { p_emb: JSON.stringify(emb) });
            const n = near?.[0];
            if (n && n.sim >= 0.9 && negSig(n.norm) === negSig(norm)) h = n;
          }
        }
        if (h) {
          const r = fit(h.result);
          if (r.inc.length || r.exc.length) return json({ ok: true, cached: true, ...r });
        }
      }
      const { data: allowed } = await sb.rpc('ai_take', { p_user_key: user_key, p_kind: 'talk', p_limit: LIMIT.talk });
      if (!allowed) return json({ ok: false, reason: 'limit' }, 429);
      const prompt = `너는 '오메추리' 앱의 탐정 메추리 '추리'야. 손님이 한 말에서 단서를 찾아 오늘 먹을 메뉴의 방향을 추리해.
손님 말: "${text}"
태그 목록(이 중에서만, 글자 그대로 골라): ${tags.join(' | ')}
JSON만 출력:
{"inc":["손님이 원하거나 상황에 맞는 태그, 1~4개"],"exc":["빼야 할 태그 (매운 거 싫다, 속 안 좋다 등)"],"cat":"cook(집에서 해먹기)|delivery(배달)|dine(밖에서 먹기)|''(말 안 했으면 빈 문자열)","clues":["손님 말에서 찾은 단서, 2~6글자씩 최대 3개"],"reason":"탐정처럼 단서를 짚고 결론으로 끝맺는 한 문장, 45자 이내. 예: '어젯밤 술자리, 오늘 아침 쓰린 속… 범인은 뜨끈한 국물이다!'"}
돌려 말한 것도 알아들어(예: 과음→해장, 입이 깔깔→상큼, 월급날→든든한 고기). 음식과 상관없는 말이면 inc를 비우고 reason은 가볍게 받아쳐.`;
      let raw = '';
      try { raw = await gemini([{ text: prompt }], true, 1024, false, true); } catch (e) { return json({ ok: false, reason: 'busy', detail: String(e).slice(0, 600) }, 503); }
      let p; try { p = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { return json({ ok: false, reason: 'parse', detail: raw.slice(0, 300) }, 502); }
      const ok = (a: unknown) => (Array.isArray(a) ? a : []).map((x) => String(x)).filter((x) => tags.includes(x));
      const res = { inc: ok(p.inc).slice(0, 4), exc: ok(p.exc).slice(0, 6), cat: ['cook', 'delivery', 'dine'].includes(p.cat) ? p.cat : '', clues: (Array.isArray(p.clues) ? p.clues : []).slice(0, 3).map((x: unknown) => String(x).slice(0, 10)), reason: String(p.reason || '').slice(0, 60) };
      await sb.from('talk_log').insert({ text, found: res.inc.length + res.exc.length > 0, src: 'ai' });
      if (norm.length >= 2 && (res.inc.length || res.exc.length)) { if (!emb) emb = await embed(text); await sb.from('talk_cache').upsert({ norm, result: res, ...(emb ? { emb: JSON.stringify(emb) } : {}) }); }
      return json({ ok: true, ...res });
    }

    if (action === 'owner') {
      const text = String(body.text || '').slice(0, 120).trim();
      if (!text) return json({ ok: false, reason: 'empty' }, 400);
      const { data: allowed } = await sb.rpc('ai_take', { p_user_key: user_key, p_kind: 'owner', p_limit: LIMIT.owner });
      if (!allowed) return json({ ok: true, reply: '오늘은 사장님이 좀 바빠요! 내일 또 얘기해요 🙂' });
      const shop = String(body.shop || '포차').slice(0, 20);
      const menus = (Array.isArray(body.menus) ? body.menus : []).slice(0, 40).map((m: unknown) => String(m).slice(0, 20)).join(', ');
      const hist = (Array.isArray(body.history) ? body.history : []).slice(-6).map((h: { me?: boolean; t?: string }) => `${h.me ? '손님' : '사장님'}: ${String(h.t || '').slice(0, 120)}`).join('\n');
      const prompt = `너는 '오메추리' 앱 먹자골목의 ${shop} 사장님 '추리'야. 동글동글한 아기 메추리 캐릭터고, 친근한 반말 섞인 존댓말로 짧게(2문장 이내) 말해.
손님이 뭘 먹을지 고르도록 도와주는 게 일이야. 메뉴를 추천할 때는 이 가게 메뉴 중에서만 골라: ${menus || '(메뉴판 없음)'}.
음식·식사 얘기가 아니면 가볍게 받아주고 메뉴 얘기로 돌아와. 욕설, 개인정보, 위험한 얘기에는 응하지 마. 건강·의학적 판단은 하지 마.
${hist ? '지난 대화:\n' + hist + '\n' : ''}손님: ${text}\n사장님:`;
      const reply = (await gemini([{ text: prompt }], false, 400, false, true)).trim().slice(0, 200);
      return json({ ok: true, reply: reply || '음… 뭐 드시고 싶어요? 🙂' });
    }
  } catch (e) {
    return json({ ok: false, reason: '잠시 후 다시 시도해 주세요', detail: String(e).slice(0, 900) }, 500);
  }
  return json({ ok: false }, 400);
});

// 오메추리 AI 기능 서버 (Gemini)
//  - yt_recipe : 유튜브 링크 → 재료·양·조리 순서 (같은 영상은 저장해 두고 다시 씀)
//  - owner     : 먹자골목 사장님(추리)과 짧은 대화, 메뉴 추천
// 필요한 비밀값(Supabase > Edge Functions > Secrets): GEMINI_API_KEY  (선택: GEMINI_MODEL)
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 Supabase가 자동으로 넣어 줌
// 배포할 때 'Verify JWT' 는 끔 (앱이 익명 키로 부름. 대신 user_key+secret 으로 확인)
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest';
const LIMIT = { yt_recipe: 10, owner: 40 }; // 사람당 하루 횟수
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// 모델이 붐비면(503·429) 잠깐 쉬고 다시, 그래도 안 되면 다른 모델로
const FALLBACK = [MODEL, 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-lite-latest'];
async function gemini(parts: unknown[], jsonOut: boolean, maxTokens = 2048) {
  const errs: string[] = [];
  for (const model of [...new Set(FALLBACK)]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')! },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: jsonOut ? 0.2 : 0.8, maxOutputTokens: maxTokens, ...(jsonOut ? { responseMimeType: 'application/json' } : {}) } }),
      });
      if (r.ok) {
        const d = await r.json();
        return (d.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
      }
      errs.push(`${model} ${r.status} ` + (await r.text()).replace(/\s+/g, ' ').slice(0, 160));
      if (r.status === 503 || r.status === 429 || r.status >= 500) { await new Promise((res) => setTimeout(res, 1200)); continue; }
      break; // 404(모델 없음)·400 등은 다음 모델로
    }
  }
  throw new Error('gemini ' + errs.join(' | '));
}

function ytId(u: string) {
  const m = String(u || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}

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
  if (!['yt_recipe', 'owner'].includes(action)) return json({ ok: false, reason: 'action' }, 400);
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
      const out = await gemini([{ file_data: { file_uri: `https://www.youtube.com/watch?v=${id}` } }, { text: RECIPE_PROMPT }], true, 4096);
      let recipe; try { recipe = JSON.parse(out); } catch { return json({ ok: false, reason: '영상을 정리하지 못했어요. 다시 시도해 주세요' }, 502); }
      if (!recipe?.ok || !Array.isArray(recipe.ingredients) || !Array.isArray(recipe.steps) || !recipe.steps.length) return json({ ok: false, reason: recipe?.reason || '이 영상에서는 레시피를 찾지 못했어요' }, 422);
      recipe.ingredients = recipe.ingredients.filter((x: unknown) => Array.isArray(x) && x[0]).slice(0, 30).map((x: string[]) => [String(x[0]).slice(0, 20), String(x[1] || '').slice(0, 20)]);
      recipe.steps = recipe.steps.slice(0, 14).map((x: string) => String(x).slice(0, 160));
      recipe.title = String(recipe.title || '유튜브 레시피').slice(0, 24);
      await sb.from('ai_recipes').upsert({ video_id: id, data: recipe });
      return json({ ok: true, video_id: id, recipe });
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
      const reply = (await gemini([{ text: prompt }], false, 200)).trim().slice(0, 200);
      return json({ ok: true, reply: reply || '음… 뭐 드시고 싶어요? 🙂' });
    }
  } catch (e) {
    return json({ ok: false, reason: '잠시 후 다시 시도해 주세요', detail: String(e).slice(0, 900) }, 500);
  }
  return json({ ok: false }, 400);
});

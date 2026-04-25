[image-preview (1).html](https://github.com/user-attachments/files/27084349/image-preview.1.html)
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>오메추 이미지 확인 (미확정 250개)</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#111; color:#f0f0f0; font-family:'Apple SD Gothic Neo',sans-serif; padding:16px; }
h1 { font-size:18px; margin-bottom:4px; color:#ff4757; }
.desc { font-size:12px; color:#888; margin-bottom:12px; line-height:1.6; }
.controls { display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; }
.controls button { background:#222; border:1px solid #444; border-radius:8px; color:#fff; padding:6px 14px; font-size:12px; cursor:pointer; }
.controls button:hover { border-color:#ff4757; }
.progress { font-size:12px; color:#ff4757; margin-bottom:12px; font-weight:700; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:8px; }
.card { background:#1e1e1e; border-radius:10px; overflow:hidden; border:2px solid #333; cursor:pointer; transition:border-color 0.15s; }
.card:hover { border-color:#888; }
.card.good { border-color:#06d6a0; }
.card.bad { border-color:#ff4757 !important; }
.card img { width:100%; height:100px; object-fit:cover; display:block; }
.card .no-img { width:100%; height:100px; background:#2a2a2a; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:4px; font-size:24px; }
.card .no-img span { font-size:10px; color:#555; }
.card .info { padding:6px 8px; }
.card .num { font-size:10px; color:#666; }
.card .name { font-size:11px; font-weight:700; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.card .kw { font-size:10px; color:#888; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.result-box { background:#1a0a0a; border:1.5px solid #ff4757; border-radius:10px; padding:14px; margin-top:16px; }
.result-box h3 { font-size:13px; color:#ff4757; margin-bottom:8px; }
.result-box p { font-size:12px; color:#ccc; line-height:2; word-break:keep-all; }
.copy-btn { margin-top:8px; background:#ff4757; border:none; border-radius:6px; color:white; padding:6px 14px; font-size:12px; cursor:pointer; }
</style>
</head>
<body>
<h1>🔍 미확정 메뉴 이미지 확인 (250개)</h1>
<div class="desc">
  영어 Wikipedia로 이미지 찾아봐요.<br>
  ✅ 초록 테두리 = 이미지 있음 / ❌ 없음 = 이미지 없음<br>
  <strong>사용할 수 있는 것 클릭 → 초록으로 바뀜 / 이상한 것 클릭 → 빨간으로 바뀜</strong><br>
  다 확인하고 "사용 가능 목록 보기" 눌러주세요!
</div>
<div class="controls">
  <button onclick="showGood()">✅ 사용 가능 목록</button>
  <button onclick="showBad()">❌ 이상한 목록</button>
  <button onclick="clearAll()">초기화</button>
</div>
<div class="progress" id="progress">로딩 중...</div>
<div class="grid" id="grid"></div>
<div class="result-box" id="result-box" style="display:none">
  <h3 id="result-title"></h3>
  <p id="result-text"></p>
  <button class="copy-btn" onclick="copyResult()">📋 복사</button>
</div>

<script>
const MENUS = ["가자미구이","가자미찜","간장게장","갈릭버터파스타","갈매기살","갈치구이","갈치찌개","감바스","감자국","감자된장국","감자소고기찌개","감자스프","게살죽","경양식돈까스","계란국","계란볶음밥","고구마맛탕","고구마밥","고구마튀김","고구마피자","고기뷔페","고등어구이","고등어찌개","고등어찜","고추잡채","곤드레나물밥","골뱅이소면","곰탕","곱창","곱창전골","군만두","굴밥","굴비구이","굴죽","그릭요거트볼","그린커리","기스면","김말이튀김","김치돼지볶음","김치순두부","김치전","김치전골","깐쇼새우","깐풍새우","꼬리곰탕","꼬막찜","꽁치구이","꽁치찌개","꽃게된장국","꽃게찜","꽃게탕","꽃등심","꿔바로우","나가사키짬뽕","나베","나시고렝","나폴리탄스파게티","낙곱새","낙지삼겹살볶음","낙지전골","낙지찜","내장전골","냉파스타","뇨끼","단백질쉐이크","달걀찜","닭가슴살 샐러드","닭가슴살도시락","닭가슴살볶음","닭계장","닭날개구이","닭다리구이","닭똥집튀김","닭발","닭볶음","대구매운탕","대구탕","대창","대창덮밥(호르몬동)","대합죽","도토리묵밥","돈가스김밥","돈코츠라멘","동태매운탕","동태찌개","돼지갈비","돼지갈비전골","돼지국밥","돼지껍데기","돼지찌개","된장국","두루치기","두부샐러드","두부스테이크","두부청국장찌개","들깨죽","딤섬","떡만두국","라면","로제파스타","리조또","리코타치즈샐러드","마라롱샤","마라샹궈","막국수","만두국","매운족발","매운치킨","메밀소바","메추리알꼬치","명란파스타","모듬회","모츠나베","목살","문어숙회","미소라멘","미소시루","미트볼스파게티","반미","버터치킨커리","복지리탕","봉골레파스타","북경오리","북어국","분짜","불낙덮밥","비빔국수","비빔냉면","삼겹살","삼치구이","새우볶음밥","새우장덮밥","새우찜","샤오롱바오","샥슈카","선지해장국","소갈비","소고기감자죽","소고기구이","소고기국밥","소고기등심","소고기뭇국","소불고기","소불고기덮밥(규동)","소시지야채볶음","솥밥","수육","순대국밥","순대볶음","순두부찌개","스테이크덮밥","시래기된장국","시저샐러드","쌀국수","쌈밥","아귀찜","아라비아타","아보카도 토스트","아보카도샐러드","알리오올리오","알탕","야키토리","양념치킨","어묵탕","에그베네딕트","연어덮밥(사케동)","연어샐러드","연어스테이크","열무김치국수","열무냉면","오겹살","오뎅볶음","오리구이","오리죽","오마카세","오므라이스","오삼불고기","오이냉국","완탕면","우거지갈비탕","우동볶음","우럭매운탕","월남쌈","유린기","인도카레","잔치국수","잡곡밥","장어덮밥","쟁반막국수","전복버터구이","전어구이","제육덮밥","조개구이","조개탕","족발","중식볶음밥","짬뽕밥","쭈꾸미볶음","차돌박이샤브샤브","차슈덮밥","참치마요덮밥","참치샐러드","참치죽","채소볶음밥","채소죽","청국장","초밥 세트","치즈닭갈비","치즈스틱","치킨마요덮밥","치킨스테이크","치킨윙봉","치킨카레","치킨파히타","케밥","콩국수","콩나물불고기","콩비지찌개","퀘사디아","크로크무슈","크림떡볶이","크림수프","클럽샌드위치","타코야키","탄두리치킨","텐동","토마토파스타","토스트","톰얌꿍","튀김우동","팟타이","포케","프렌치토스트","피시앤칩스","하이라이스","함박스테이크","핫도그","항정살","해물볶음밥","해물순두부","해물파스타","해물파전","현미밥+된장국","홍합탕","황태해장국","회덮밥","후라이드 치킨","훈제연어샐러드","훠궈","히츠마부시"];

const EN_WIKI = {
  "가자미구이":"Flounder","가자미찜":"Flounder","간장게장":"Ganjang_gejang","갈릭버터파스타":"Pasta","갈매기살":"Pork","갈치구이":"Cutlassfish","갈치찌개":"Cutlassfish","감바스":"Gambas_al_ajillo","감자국":"Potato_soup","감자된장국":"Doenjang_jjigae","감자소고기찌개":"Beef_stew","감자스프":"Potato_soup","게살죽":"Congee","경양식돈까스":"Tonkatsu","계란국":"Egg_drop_soup","계란볶음밥":"Fried_rice","고구마맛탕","고구마밥":"Sweet_potato","고구마튀김":"Fried_sweet_potato","고구마피자":"Pizza","고기뷔페":"Buffet","고등어구이":"Atlantic_mackerel","고등어찌개":"Mackerel","고등어찜":"Mackerel","고추잡채":"Japchae","곤드레나물밥":"Rice","골뱅이소면":"Whelk","곰탕":"Gomguk","곱창":"Gopchang","곱창전골","군만두":"Mandu_(food)","굴밥":"Oyster","굴비구이":"Croaker_(fish)","굴죽":"Oyster","그릭요거트볼":"Greek_yogurt","그린커리":"Green_curry","기스면":"Noodle","김말이튀김":"Spring_roll","김치돼지볶음":"Kimchi_jjigae","김치순두부":"Sundubu-jjigae","김치전":"Kimchi_jeon","김치전골":"Korean_hot_pot","깐쇼새우":"Kung_Pao_chicken","깐풍새우":"Kung_Pao_chicken","꼬리곰탕":"Oxtail_soup","꼬막찜":"Cockle_(bivalve)","꽁치구이":"Pacific_saury","꽁치찌개":"Pacific_saury","꽃게된장국":"Crab_soup","꽃게찜":"Blue_crab","꽃게탕":"Kkotgetang","꽃등심":"Rib_eye_steak","꿔바로우":"Gu_lao_rou","나가사키짬뽕":"Champon","나베":"Nabemono","나시고렝":"Nasi_goreng","나폴리탄스파게티":"Pasta","낙곱새":"Gopchang","낙지삼겹살볶음":"Nakji","낙지전골":"Nakji","낙지찜":"Nakji_bokkeum","내장전골":"Beef_offal","냉파스타":"Cold_pasta","뇨끼":"Gnocchi","단백질쉐이크":"Protein_shake","달걀찜":"Gyeran_jjim","닭가슴살 샐러드":"Chicken_salad","닭가슴살도시락":"Chicken_breast","닭가슴살볶음":"Chicken_stir_fry","닭계장":"Dakgaejang","닭날개구이":"Chicken_wings","닭다리구이":"Drumstick_(food)","닭똥집튀김":"Chicken_gizzard","닭발":"Chicken_feet","닭볶음":"Braised_chicken","대구매운탕":"Cod","대구탕":"Cod_soup","대창":"Beef_intestine","대창덮밥(호르몬동)":"Hormones_(food)","대합죽":"Clam_chowder","도토리묵밥":"Dotori-muk","돈가스김밥":"Kimbap","돈코츠라멘":"Tonkotsu_ramen","동태매운탕":"Pollock_(fish)","동태찌개":"Alaska_pollock","돼지갈비":"Pork_ribs","돼지갈비전골":"Korean_hot_pot","돼지국밥":"Pork_soup","돼지껍데기":"Pork_rind","돼지찌개":"Pork_stew","된장국":"Doenjang_jjigae","두루치기":"Pork_stir_fry","두부샐러드":"Tofu","두부스테이크":"Tofu","두부청국장찌개":"Cheonggukjang","들깨죽":"Perilla","딤섬":"Dim_sum","떡만두국":"Tteok_mandu_guk","라면":"Ramen","로제파스타":"Rose_sauce","리조또":"Risotto","리코타치즈샐러드":"Ricotta","마라롱샤":"Crayfish","마라샹궈":"Mala_sauce","막국수":"Memil_guksu","만두국":"Mandu_(food)","매운족발":"Jokbal","매운치킨":"Spicy_chicken","메밀소바":"Soba","메추리알꼬치":"Quail_egg","명란파스타":"Mentaiko","모듬회":"Sashimi","모츠나베":"Motsu_nabe","목살":"Pork_shoulder","문어숙회":"Octopus","미소라멘":"Miso_ramen","미소시루":"Miso_soup","미트볼스파게티":"Spaghetti_and_meatballs","반미":"Bánh_mì","버터치킨커리":"Butter_chicken","복지리탕":"Blowfish","봉골레파스타":"Spaghetti_alle_vongole","북경오리":"Peking_duck","북어국":"Dried_pollack","분짜":"Bún_chả","불낙덮밥":"Nakji","비빔국수":"Bibim_guksu","비빔냉면":"Bibim_naengmyeon","삼겹살":"Samgyeopsal","삼치구이":"Spanish_mackerel","새우볶음밥":"Shrimp_fried_rice","새우장덮밥":"Shrimp","새우찜":"Steamed_shrimp","샤오롱바오":"Xiaolongbao","샥슈카":"Shakshouka","선지해장국":"Blood_sausage","소갈비":"Galbi","소고기감자죽":"Congee","소고기구이":"Grilled_beef","소고기국밥":"Beef_soup","소고기등심":"Sirloin_steak","소고기뭇국":"Beef_soup","소불고기":"Bulgogi","소불고기덮밥(규동)":"Gyudon","소시지야채볶음":"Sausage","솥밥":"Dolsot_bap","수육":"Suyuk","순대국밥":"Sundae_(Korean_food)","순대볶음":"Sundae_(Korean_food)","순두부찌개":"Sundubu-jjigae","스테이크덮밥":"Steak","시래기된장국":"Doenjang_jjigae","시저샐러드":"Caesar_salad","쌀국수":"Phở","쌈밥":"Ssambap","아귀찜":"Monkfish","아라비아타":"Arrabbiata","아보카도 토스트":"Avocado_toast","아보카도샐러드":"Avocado","알리오올리오":"Aglio_e_olio","알탕":"Fish_roe","야키토리":"Yakitori","양념치킨":"Yangnyeom_chicken","어묵탕":"Eomuk","에그베네딕트":"Eggs_Benedict","연어덮밥(사케동)":"Sake_don","연어샐러드":"Salmon_salad","연어스테이크":"Salmon","열무김치국수":"Noodle","열무냉면":"Naengmyeon","오겹살":"Samgyeopsal","오뎅볶음":"Eomuk","오리구이":"Duck","오리죽":"Duck","오마카세":"Omakase","오므라이스":"Omurice","오삼불고기":"Bulgogi","오이냉국":"Gazpacho","완탕면":"Wonton_noodles","우거지갈비탕":"Galbitang","우동볶음":"Udon","우럭매운탕":"Rockfish","월남쌈":"Gỏi_cuốn","유린기":"Yu_ling_ji","인도카레":"Indian_curry","잔치국수":"Janchi_guksu","잡곡밥":"Mixed_grain_rice","장어덮밥":"Unaju","쟁반막국수":"Buckwheat_noodles","전복버터구이":"Abalone","전어구이":"Gizzard_shad","제육덮밥":"Jeyuk_bokkeum","조개구이":"Clam","조개탕":"Clam_soup","족발":"Jokbal","중식볶음밥":"Fried_rice","짬뽕밥":"Jjamppong","쭈꾸미볶음":"Webfoot_octopus","차돌박이샤브샤브":"Shabu-shabu","차슈덮밥":"Chashu_don","참치마요덮밥":"Tuna","참치샐러드":"Tuna_salad","참치죽":"Congee","채소볶음밥":"Fried_rice","채소죽":"Congee","청국장":"Cheonggukjang","초밥 세트":"Sushi","치즈닭갈비","치즈스틱":"Mozzarella_sticks","치킨마요덮밥":"Chicken_rice","치킨스테이크":"Chicken_steak","치킨윙봉":"Buffalo_wing","치킨카레":"Chicken_curry","치킨파히타":"Fajita","케밥":"Kebab","콩국수":"Kong_guksu","콩나물불고기":"Bulgogi","콩비지찌개":"Kongbiji_jjigae","퀘사디아":"Quesadilla","크로크무슈":"Croque_monsieur","크림떡볶이":"Tteokbokki","크림수프":"Cream_soup","클럽샌드위치":"Club_sandwich","타코야키":"Takoyaki","탄두리치킨":"Tandoori_chicken","텐동":"Tendon_(food)","토마토파스타":"Pasta","토스트":"Toast","톰얌꿍":"Tom_yum","튀김우동":"Udon","팟타이":"Pad_thai","포케":"Poké_(food)","프렌치토스트":"French_toast","피시앤칩스":"Fish_and_chips","하이라이스":"Hayashi_rice","함박스테이크":"Hamburg_steak","핫도그":"Hot_dog","항정살":"Pork_jowl","해물볶음밥":"Seafood_fried_rice","해물순두부":"Sundubu-jjigae","해물파스타":"Seafood_pasta","해물파전":"Pajeon","현미밥+된장국":"Brown_rice","홍합탕":"Mussel","황태해장국":"Pollock_(fish)","회덮밥":"Hoe_(food)","후라이드 치킨":"Fried_chicken","훈제연어샐러드":"Smoked_salmon","훠궈":"Hot_pot","히츠마부시":"Hitsumabushi","고구마맛탕":"Candied_sweet_potato","곱창전골":"Gopchang_jeongol","치즈닭갈비":"Dak_galbi"
};

let goodMenus = new Set();
let badMenus = new Set();
let loadedCount = 0;
let resultText = '';

async function fetchImg(name) {
  const title = EN_WIKI[name] || name;
  const isEng = /^[A-Za-z]/.test(title);
  const tryWiki = async (lang, t) => {
    try {
      const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(t)}&prop=pageimages&format=json&pithumbsize=400&origin=*`);
      const data = await res.json();
      const page = Object.values(data.query.pages)[0];
      return page.thumbnail?.source || null;
    } catch(e) { return null; }
  };
  if (isEng) return await tryWiki('en', title);
  let url = await tryWiki('ko', title);
  if (!url) url = await tryWiki('en', title);
  return url;
}

function toggleCard(name, card) {
  if (goodMenus.has(name)) {
    goodMenus.delete(name);
    card.classList.remove('good');
  } else if (badMenus.has(name)) {
    badMenus.delete(name);
    card.classList.remove('bad');
  } else {
    goodMenus.add(name);
    card.classList.add('good');
  }
}

function markBad(name, card, e) {
  e.stopPropagation();
  if (badMenus.has(name)) { badMenus.delete(name); card.classList.remove('bad'); }
  else { badMenus.add(name); card.classList.add('bad'); goodMenus.delete(name); card.classList.remove('good'); }
}

async function init() {
  const grid = document.getElementById('grid');
  const progress = document.getElementById('progress');
  const cards = [];

  MENUS.forEach((name, i) => {
    const kw = EN_WIKI[name] || name;
    const card = document.createElement('div');
    card.className = 'card';
    card.title = '클릭: 사용가능 / 우클릭: 이상함';
    card.onclick = () => toggleCard(name, card);
    card.oncontextmenu = (e) => { e.preventDefault(); markBad(name, card, e); };
    card.innerHTML = `
      <div class="no-img" id="ni-${i}"><span>⏳</span><span>${name}</span></div>
      <div class="info">
        <div class="num">#${i+1}</div>
        <div class="name">${name}</div>
        <div class="kw">${kw}</div>
      </div>`;
    grid.appendChild(card);
    cards.push(card);
  });

  for (let i = 0; i < MENUS.length; i += 6) {
    await Promise.all(MENUS.slice(i, i+6).map(async (name, j) => {
      const idx = i + j;
      const url = await fetchImg(name);
      const ni = document.getElementById(`ni-${idx}`);
      if (ni) {
        if (url) {
          ni.outerHTML = `<img src="${url}" alt="${name}" onerror="this.outerHTML='<div class=no-img><span>❌</span></div>'">`;
          cards[idx].classList.add('good');
          goodMenus.add(MENUS[idx]);
        } else {
          ni.innerHTML = '<span>❌</span><span>없음</span>';
        }
      }
      loadedCount++;
    }));
    progress.textContent = `로딩 중... ${Math.min(loadedCount, MENUS.length)}/${MENUS.length} (클릭: 사용가능 ✅ / 우클릭: 이상함 ❌)`;
    await new Promise(r => setTimeout(r, 80));
  }
  progress.textContent = `✅ 완료! 이미지 있는 건 자동으로 초록색. 이상한 건 우클릭으로 빨간색 표시하세요.`;
}

function showGood() {
  const el = document.getElementById('result-box');
  el.style.display = 'block';
  document.getElementById('result-title').textContent = '✅ 사용 가능한 메뉴';
  resultText = [...goodMenus].join(', ');
  document.getElementById('result-text').textContent = resultText || '없음';
  el.scrollIntoView({behavior:'smooth'});
}

function showBad() {
  const el = document.getElementById('result-box');
  el.style.display = 'block';
  document.getElementById('result-title').textContent = '❌ 이상한 이미지 메뉴';
  resultText = [...badMenus].join(', ');
  document.getElementById('result-text').textContent = resultText || '없음';
  el.scrollIntoView({behavior:'smooth'});
}

function clearAll() {
  goodMenus.clear(); badMenus.clear();
  document.querySelectorAll('.card').forEach(c => { c.classList.remove('good','bad'); });
}

function copyResult() {
  navigator.clipboard.writeText(resultText).then(() => alert('복사됐어요!'));
}

init();
</script>
</body>
</html>

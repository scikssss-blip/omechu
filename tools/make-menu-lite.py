# index.html의 메뉴 목록에서 3D 가게가 쓰는 것만 뽑아 menu-lite.js를 만든다.
# 메뉴를 고치면 다시 실행:  python3 tools/make-menu-lite.py
import re, json, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
i = s.index('const menuDB = ['); blk = s[i:s.index('\n];', i)]
j = s.index('const EXTRA_IMAGES = {'); imgs = set(re.findall(r"'([^']+)'\s*:\s*'/images/", s[j:s.index('};', j)]))
KEEP = ['🍱 한식', '🍣 일식', '🥢 중식', '🍝 양식', '🍺 술안주', '🌙 야식', '🌶️ 매운/얼큰한맛', '🌶️ 매운 음식', '🍲 국물/찌개', '🍯 달달한맛', '🥶 추운 날', '☀️ 더운 날', '🦐 해산물', '🥩 고기', '🥗 채소', '🍜 면', '🫕 튀김']
out = []
for m in re.finditer(r"\{id:\d+,\s*name:'([^']+)',\s*emoji:'([^']*)'.*?tags:\[([^\]]*)\]", blk):
    tags = [t.strip().strip("'") for t in m.group(3).split(',')]
    out.append([m.group(1), m.group(2), [KEEP.index(t) for t in tags if t in KEEP], 1 if m.group(1) in imgs else 0])
js = '// 자동 생성 파일 (tools/make-menu-lite.py). 직접 고치지 마세요.\n'
js += 'window.MENU_TAGS = ' + json.dumps(KEEP, ensure_ascii=False) + ';\n'
js += 'window.MENU_LITE = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
js += "var menuDB = MENU_LITE.map(function (m) { return { name: m[0], emoji: m[1], tags: m[2].map(function (i) { return MENU_TAGS[i]; }), img: m[3] ? '/images/' + m[0] + '.jpg' : null }; });\n"
js += "function getLikedMenus() { try { return JSON.parse(localStorage.getItem('likedMenus') || '[]') || []; } catch (e) { return []; } }\n"
open(os.path.join(root, 'menu-lite.js'), 'w', encoding='utf-8').write(js)
print(len(out), 'menus', sum(m[3] for m in out), 'with image')

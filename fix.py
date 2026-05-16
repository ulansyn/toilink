import subprocess
import re

original = subprocess.check_output(['git', 'show', 'HEAD:src/main/resources/static/landing.html']).decode('utf-8')
with open('src/main/resources/static/landing.html', 'r', encoding='utf-8') as f:
    current = f.read()

replace_start = current.find('<p class="text-white/60 text2.618')
replace_end = current.find('<!-- ─────────────────────────────────────────────────────────── -->\n<!--  JAVASCRIPT')

orig_replace_start = original.find('<p class="text-white/60 text-[14px]')
orig_replace_end = original.find('<!-- ─────────────────────────────────────────────────────────── -->\n<!--  JAVASCRIPT')

orig_piece = original[orig_replace_start:orig_replace_end]
orig_piece = re.sub(r'<!-- ─────────────────────────────────────────────────────────── -->\n<!--  MOBILE BOTTOM NAV                                          -->\n<!-- ─────────────────────────────────────────────────────────── -->\n<nav class="nav-bar.*?</nav>\n\n', '', orig_piece, flags=re.DOTALL)

new_current = current[:replace_start] + orig_piece + current[replace_end:]
with open('src/main/resources/static/landing.html', 'w', encoding='utf-8') as f:
    f.write(new_current)

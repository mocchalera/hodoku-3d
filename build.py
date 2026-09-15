#!/usr/bin/env python3
"""Build the entire browser game into a single portable HTML document."""
from pathlib import Path
root=Path(__file__).resolve().parent
src=root/'src'
text=(src/'index.template.html').read_text()
for marker,filename in [('STYLES','style.css'),('STYLES3D','style3d.css'),('DATA','data.js'),('ENGINE','engine.js'),('RENDERER','renderer2d.js'),('RENDERER3D','renderer3d.js'),('APP','app.js')]:
    text=text.replace('/* '+marker+' */',(src/filename).read_text())
(root/'index.html').write_text(text)
print(f"Built {root/'index.html'} ({len(text.encode()):,} bytes)")

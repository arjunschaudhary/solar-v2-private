"""Create the user handoff ZIP; exclude secrets, dependencies and build output."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
root=Path(__file__).resolve().parents[1]
target=root/'public/downloads/solar-v2-package.zip'
target.parent.mkdir(parents=True,exist_ok=True)
excluded={'.git','node_modules','dist','.next','.wrangler','.sites-runtime','outputs','work','coverage','__pycache__'}
with ZipFile(target,'w',ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  if not p.is_file():continue
  rel=p.relative_to(root)
  if any(part in excluded for part in rel.parts):continue
  if rel.parts[:2]==('public','downloads'):continue
  if p.name.startswith('.env') and p.name!='.env.example':continue
  if p.suffix in ('.pem','.tsbuildinfo','.log') or p.name=='.DS_Store':continue
  name=str(rel)
  z.write(p,name)
print(f'Created {target.name}: {target.stat().st_size:,} bytes')

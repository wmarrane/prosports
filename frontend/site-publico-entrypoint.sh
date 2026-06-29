#!/bin/sh
# Site público de DESENVOLVIMENTO: reconstrói o estático quando o backend grava
# novos snapshots no volume compartilhado e serve o resultado na :80.
set -e
SNAP_DIR=/app/public-site-snapshots
mkdir -p "$SNAP_DIR"

# Semeia o volume com os snapshots commitados na 1ª execução (volume vazio).
if [ -d /seed-snapshots ]; then
  for f in /seed-snapshots/*.json; do
    [ -e "$f" ] || continue
    b=$(basename "$f")
    [ -e "$SNAP_DIR/$b" ] || cp "$f" "$SNAP_DIR/$b"
  done
fi

rebuild() {
  echo "[site-publico] build:site..."
  if npm run build:site; then
    printf '{ "cleanUrls": false, "trailingSlash": false }\n' > dist-site/serve.json
    echo "[site-publico] build OK"
  else
    echo "[site-publico] build:site FALHOU (mantém versão anterior)"
  fi
}

rebuild
echo "[site-publico] servindo dist-site na :80"
npx serve -l 80 dist-site &

# Reconstrói a cada mudança nos snapshots (publicar/despublicar do backend).
while inotifywait -e create -e modify -e delete -e move -e close_write "$SNAP_DIR" >/dev/null 2>&1; do
  rebuild
done

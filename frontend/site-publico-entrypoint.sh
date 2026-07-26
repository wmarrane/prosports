#!/bin/sh
# Site público de DESENVOLVIMENTO: reconstrói o estático quando o backend grava
# novos snapshots no volume compartilhado e serve o resultado na :80.
set -e
SNAP_DIR=/app/public-site-snapshots
mkdir -p "$SNAP_DIR"

# O volume é COMPARTILHADO com o backend, que roda como usuário não-root (node,
# uid 1000) e precisa GRAVAR o snapshot aqui ao publicar um evento. Quando o
# volume nasce vazio, o Docker o inicializa com o conteúdo e as permissões deste
# diretório na imagem — que vêm sem escrita para "outros". Sem este chmod o
# publicar do backend morre com EACCES. Container de desenvolvimento apenas.
chmod 0777 "$SNAP_DIR"

# Semeia o volume com os snapshots commitados na 1ª execução (volume vazio).
if [ -d /seed-snapshots ]; then
  for f in /seed-snapshots/*.json; do
    [ -e "$f" ] || continue
    b=$(basename "$f")
    [ -e "$SNAP_DIR/$b" ] || cp "$f" "$SNAP_DIR/$b"
  done
fi

# Escrever num arquivo que JÁ existe exige permissão no próprio ARQUIVO — o 0777
# do diretório acima só cobre criar/remover. Os JSONs semeados (e os de volumes
# antigos) são copiados como root, então o backend não conseguia REpublicar um
# evento já publicado. Idempotente: roda a cada boot e conserta volumes antigos.
find "$SNAP_DIR" -type f -name '*.json' -exec chmod 0666 {} +

rebuild() {
  echo "[site-publico] build:site..."
  if npm run build:site; then
    # `cleanUrls: false` mantém as URLs .html (os links do site são /evento-N.html,
    # e sem isso o serve redireciona para /evento-N). Efeito colateral no serve 14:
    # ele para de resolver o index.html da RAIZ e devolve a listagem de diretório
    # ("Files within dist-site"). O rewrite explícito de "/" cobre esse buraco.
    printf '{ "cleanUrls": false, "trailingSlash": false, "rewrites": [{ "source": "/", "destination": "/index.html" }] }\n' > dist-site/serve.json
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

# Dev no Docker Desktop (Windows)

Ambiente de desenvolvimento completo rodando na máquina Windows, sem depender da
VM `192.168.56.113`. Arquivo: `docker-compose.dev.windows.yml` (o
`docker-compose.yml` da raiz continua sendo o da VM e não deve ser usado aqui).

## Subir

```powershell
copy .env.dev.windows.example .env.dev.windows.local
docker compose -f docker-compose.dev.windows.yml --env-file .env.dev.windows.local up -d --build
```

O primeiro build leva alguns minutos (três `npm ci`). Os seguintes usam cache.

Popular o banco (admin + dados base) — só na primeira vez:

```powershell
docker compose -f docker-compose.dev.windows.yml --env-file .env.dev.windows.local --profile seed run --rm seed
```

## Atualizar o ambiente (sempre pela develop)

```powershell
npm run dev:update
```

Este é o caminho padrão, equivalente ao que o `deploy-develop.yml` fazia na VM
`192.168.56.113`: busca o remoto, coloca a árvore em `origin/develop` por
fast-forward, e reconstrói os containers com o commit resultante.

**Por que não basta `docker compose up -d --build`:** o compose constrói a
**árvore de trabalho** (`build: ./backend`, `context: .`), não uma branch. Rodar
o build direto empacota o que estiver em checkout — já aconteceu de o ambiente
ficar três releases atrás sem nenhum aviso, e de uma promoção deixar a `main`
em checkout.

O script recusa a atualização se houver alteração **não commitada** (arquivos
não rastreados são tolerados) ou se a `develop` local tiver divergido do remoto.

Para conferir em que versão o ambiente está:

```powershell
curl http://localhost:3100/health     # {"status":"ok","commit":"d472b9e"}
```

`commit` = de qual código a instância foi construída. Vale para a VM também (o
`deploy-develop` já grava `GIT_COMMIT` no `.env`). Sobindo na mão, sem o script,
aparece `local`.

## Endereços

| Serviço | URL | Observação |
|---|---|---|
| Admin (frontend) | http://localhost:8090 | nginx faz proxy de `/api` e `/uploads` para o backend |
| API | http://localhost:3100/health | acesso direto, fora do proxy |
| Site público | http://localhost:8091 | reconstrói sozinho ao publicar/despublicar um evento |
| Postgres | `localhost:5433` | user/db `prosports` / `newprosports` |

Login de dev: `admin@prosports.com` / `admin123` (criado pelo seed).

Redis não é publicado no host — se precisar de acesso externo, adicione
`ports: ["6380:6379"]` ao serviço.

## Por que as portas não são as mesmas da VM

No host Windows já estão ocupadas: **5432** (`r2p-postgres`), **3000**, **8080** e
**8081** (serviços do próprio Windows). Daí 5433 / 3100 / 8090 / 8091. Todas
parametrizadas no `.env.dev.windows.local`.

## Diferenças em relação à VM

| Item | VM (`docker-compose.yml`) | Windows (`docker-compose.dev.windows.yml`) |
|---|---|---|
| Postgres | externo (`DATABASE_URL` aponta para outra máquina) | container `postgres:16-alpine` + volume `pgdata` |
| Migrations | runner do GitHub Actions roda no host antes do `up` | serviço one-shot `migrate` (o backend só sobe depois dele) |
| Chave SFTP | bind mount de `/home/wagner/secrets/...` | não montada (veja "Boletins") |
| Deploy | push em `develop` → CI | `docker compose ... up -d --build` na mão |

A imagem `postgres:16-alpine` é a mesma que a stack **r2p** já usa nesta máquina —
não há download novo. Container e volume são próprios do prosports, então os dois
projetos não se misturam.

## Boletins (upload de PDF)

Este ambiente usa `STORAGE_PROVIDER=local`: os PDFs vão para
`/app/uploads/boletins/<object_key>` (volume `uploads_data`) e são servidos pela
rota estática `/uploads` do backend — **sem depender da VM de SFTP**
(`192.168.56.130`). O `public_url` gravado no banco fica relativo
(`/uploads/boletins/...`), que o admin resolve na mesma origem via proxy do
nginx; para forçar uma URL absoluta, defina `PUBLIC_BOLETINS_BASE_URL`.

Provider só para desenvolvimento — produção continua em `gcs`.

Boletins que vieram na cópia do banco de dev têm `public_url` apontando para o
SFTP antigo; só os enviados a partir de agora usam o storage local.

Se ainda assim quiser usar o SFTP da VM, troque para `STORAGE_PROVIDER=sftp`,
preencha as variáveis `SFTP_*` e monte a chave privada no serviço `backend`:

```yaml
    volumes:
      - C:/Users/Wagner/secrets/boletins_ssh_key:/app/secrets/boletins_ssh_key:ro
```

…mais `SFTP_PRIVATE_KEY_PATH=/app/secrets/boletins_ssh_key` no `environment`.
**Se o arquivo não existir no caminho indicado, o Docker cria um diretório no
lugar** — foi o que quebrou o deploy da VM em junho/2026.

## Armadilhas

- **Não trocar o volume `site_snapshots` por bind mount do Windows.** O
  `site-publico-entrypoint.sh` usa `inotifywait`, e eventos inotify não propagam
  através do 9p/virtiofs — o rebuild automático pararia sem nenhum erro visível.
- **Repositório dentro do OneDrive.** O contexto de build é enviado do OneDrive;
  os `.dockerignore` (raiz e `backend/`) cortam ~700 MB de contexto, mas o build
  ainda fica bem mais rápido com o repo fora do OneDrive — idealmente dentro do
  WSL2 (`\\wsl$\...`).
- **CRLF.** Scripts `.sh` novos precisam do mesmo tratamento que o
  `Dockerfile.site` já faz (`sed -i 's/\r$//'`).
- **Docker Hub rate limit.** Rodar `docker login` (conta gratuita) evita bater no
  limite de pulls anônimos em ciclos de rebuild.

## Comandos do dia a dia

```powershell
# Estado / logs
docker compose -f docker-compose.dev.windows.yml ps
docker compose -f docker-compose.dev.windows.yml logs -f backend

# Rebuild após mudar código
docker compose -f docker-compose.dev.windows.yml --env-file .env.dev.windows.local up -d --build backend

# Nova migration (após editar o schema)
docker compose -f docker-compose.dev.windows.yml --env-file .env.dev.windows.local run --rm migrate

# Derrubar (mantém os dados)
docker compose -f docker-compose.dev.windows.yml down

# Derrubar APAGANDO o banco e os snapshots
docker compose -f docker-compose.dev.windows.yml down -v
```

## Copiar dados de outro ambiente

`docs/runbooks/copiar-prod-para-dev.md` descreve o dump/restore; o destino aqui é
`postgresql://prosports:prosports@localhost:5433/newprosports`.

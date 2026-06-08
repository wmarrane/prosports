# Runbook — Copiar banco de PRODUÇÃO para DEV (manual)

Procedimento manual para clonar o banco de produção (Cloud SQL) por cima do
banco de desenvolvimento. **Cópia bruta** (idêntica à prod, inclusive contas de
usuário). Rode a partir de uma máquina que tenha o `pg_dump`/`pg_restore` e
alcance o banco de dev (ex.: a estação Windows do admin, que está na LAN
192.168.56.x).

> ⚠️ **Destrutivo:** o Passo 4 **sobrescreve** o banco de dev. Faça o backup do
> dev (Passo 3) antes.

---

## Por que é manual / a restrição de rede

- **Prod** = Cloud SQL no GCP, acessível só via `cloud-sql-proxy`.
- **Dev** = Postgres na LAN (`192.168.56.108:5432`, db `newprosports`).
- Nenhum backend sozinho alcança os dois. A máquina que roda a cópia precisa
  alcançar **ambos**: o proxy do Cloud SQL (prod) **e** a LAN (dev).

A estação do admin atende: tem `pg_dump`/`psql` e alcança `192.168.56.108`.
Só falta o `cloud-sql-proxy` (binário) + a conta com `roles/cloudsql.client`.

---

## Valores necessários

| Valor | Onde encontrar |
|---|---|
| `INSTANCE_CONNECTION_NAME` (conexão Cloud SQL de prod) | secret do GitHub `INSTANCE_CONNECTION_NAME` ou console do Cloud SQL |
| `PROD_DATABASE_URL` (user/senha/db da prod) | secret do GitHub `PROD_DATABASE_URL` ou `.env` da VM de prod |
| `DEV_DATABASE_URL` (banco de dev) | `backend/.env` → `DATABASE_URL` (host `192.168.56.108`, db `newprosports`) |

> Não cole senhas em lugares versionados. Use os valores diretamente dos
> `.env`/secrets na hora de rodar.

---

## Pré-requisitos (uma vez)

1. **`cloud-sql-proxy` v2** — baixe o binário único:
   https://github.com/GoogleCloudPlatform/cloud-sql-proxy/releases
   (no Windows: `cloud-sql-proxy.x64.exe`).
2. **Autenticação** com uma conta que tenha `roles/cloudsql.client` no projeto
   da prod (`project-75224ce4-d8a0-4995-a3a`):
   ```powershell
   gcloud auth application-default login
   ```

---

## Passo a passo

### 1. Abrir o proxy para a prod (deixe rodando num terminal)
```powershell
.\cloud-sql-proxy.exe --port 5433 <INSTANCE_CONNECTION_NAME>
```

### 2. Dump da produção (em outro terminal)
```powershell
pg_dump "postgresql://<prod_user>:<prod_senha>@127.0.0.1:5433/<prod_db>" -Fc -f prod.dump
```

### 3. Backup do dev (segurança — antes de sobrescrever)
```powershell
pg_dump "<DEV_DATABASE_URL>" -Fc -f dev-backup.dump
```

### 4. Restaurar a prod no dev (⚠️ sobrescreve o banco de dev)
```powershell
pg_restore --clean --if-exists --no-owner --no-privileges -d "<DEV_DATABASE_URL>" prod.dump
```

### 5. (Opcional) Reconciliar migrations de dev
O dump já traz o schema da prod; isto só reaplica migrations de dev mais novas,
se existirem:
```powershell
cd backend
$env:DATABASE_URL = "<DEV_DATABASE_URL>"
npx prisma migrate deploy
```

---

## Notas

- `pg_dump`/`pg_restore` mais novos (v18) lidam bem com servidores Cloud SQL
  mais antigos.
- `--clean --if-exists` derruba os objetos do dev antes de recriar;
  `--no-owner --no-privileges` evita erros com roles do Cloud SQL
  (ex.: `cloudsqlsuperuser`).
- Como é **cópia bruta**, os logins de produção passam a funcionar no dev (as
  contas de usuário vêm junto). Trate o banco de dev como dado sensível.

---

## Versão automatizada (futuro)

A ideia discutida é um botão em **Administração** que dispara um
`repository_dispatch` → workflow com 2 jobs: o runner de **prod** faz o
`pg_dump` (já tem acesso via `cloud-sql-proxy`) e sobe um **artifact**; o runner
de **dev** baixa o artifact e faz o `pg_restore` + `prisma migrate deploy`. O
artifact do GitHub é o que cruza as redes GCP↔LAN sem expor credenciais de prod
na máquina local nem exigir grant cross-project. Spec ainda não escrita.

#!/usr/bin/env node
/**
 * Atualiza o ambiente de dev do Docker Desktop a partir da branch `develop`,
 * espelhando o que o `deploy-develop.yml` fazia na VM 192.168.56.113:
 * checkout do que está no remoto → build com o commit → sobe os containers.
 *
 * O compose constrói a ÁRVORE DE TRABALHO, então sem passar por aqui o
 * ambiente reflete qualquer branch que estiver em checkout (já aconteceu de
 * ficar três releases atrás sem avisar). Este script garante a origem:
 * sempre `origin/develop`, sempre fast-forward, nunca com alterações soltas.
 *
 * Uso: npm run dev:update
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const COMPOSE = 'docker-compose.dev.windows.yml'
const ENV_LOCAL = '.env.dev.windows.local'
const ENV_EXEMPLO = '.env.dev.windows.example'

function git(...args) {
  return execFileSync('git', args, { cwd: raiz, encoding: 'utf8' }).trim()
}

function passo(msg) {
  console.log(`\n[36m▸ ${msg}[0m`)
}

function abortar(msg, detalhe) {
  console.error(`\n[31m✖ ${msg}[0m`)
  if (detalhe) console.error(detalhe)
  process.exit(1)
}

// 1. Árvore limpa. O CI sempre constrói um checkout limpo; aqui é o mesmo
//    contrato — alteração não commitada não pode entrar na imagem por acidente.
//    Arquivos não rastreados são tolerados (.env local, dumps, etc.).
passo('Verificando alterações não commitadas')
const sujos = git('status', '--porcelain', '--untracked-files=no')
if (sujos) {
  abortar(
    'Há alterações não commitadas. Commite ou guarde antes de atualizar o ambiente.',
    sujos,
  )
}
console.log('  árvore limpa')

passo('Buscando a develop no remoto')
git('fetch', 'origin', '--prune')
const remoto = git('rev-parse', '--short', 'refs/remotes/origin/develop')
console.log(`  origin/develop = ${remoto}`)

passo('Trocando para develop')
const branchAtual = git('rev-parse', '--abbrev-ref', 'HEAD')
if (branchAtual !== 'develop') {
  console.log(`  estava em "${branchAtual}"`)
  git('checkout', 'develop')
}

try {
  git('merge', '--ff-only', 'refs/remotes/origin/develop')
} catch (err) {
  abortar(
    'A develop local divergiu do remoto — o fast-forward falhou.',
    'Resolva manualmente (a branch tem commits que não estão em origin/develop).',
  )
}
const commit = git('rev-parse', '--short', 'HEAD')
console.log(`  develop = ${commit}`)

// 2. Build + up. O serviço one-shot `migrate` do compose aplica as migrations
//    antes de o backend subir, então não há passo separado como havia na VM.
passo('Reconstruindo e subindo os containers')
const envFile = existsSync(path.join(raiz, ENV_LOCAL)) ? ENV_LOCAL : ENV_EXEMPLO
if (envFile === ENV_EXEMPLO) {
  console.log(`  (${ENV_LOCAL} não existe; usando ${ENV_EXEMPLO})`)
}

execFileSync(
  'docker',
  [
    'compose',
    '-f', COMPOSE,
    '--env-file', envFile,
    '--project-directory', '.',
    'up', '-d', '--build', '--remove-orphans',
  ],
  { cwd: raiz, stdio: 'inherit', env: { ...process.env, GIT_COMMIT: commit } },
)

passo(`Ambiente atualizado para develop ${commit}`)
console.log('  confira com:  curl http://localhost:3100/health')

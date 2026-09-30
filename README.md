# Topologia New

Projeto independente para documentar plantas, mesas, datacenters, racks e conexões de várias empresas. Etapas 01 e 02 concluídas: ambiente Docker, contratos de domínio e migrações PostgreSQL. O parque começa vazio; autenticação e provisionamento explícito do administrador serão implementados na etapa 03.

- [Escopo](docs/ESCOPO.md)
- [Arquitetura](docs/IMPLEMENTACAO.md)
- [Plano de desenvolvimento](docs/PLANO_DESENVOLVIMENTO.md)
- [Progresso e evidências](docs/PROGRESSO.md)

## Subir o ambiente

Pré-requisitos: Docker Desktop em execução, containers Linux e Docker Compose. Node.js 24 e npm 11 são opcionais no host; os comandos `npm run dev:*` são atalhos para o Compose. Execute na raiz deste projeto.

O `.env` desta máquina já foi criado com senha aleatória. Em uma cópia nova, configure-o uma única vez no PowerShell, sem sobrescrever um arquivo existente:

```powershell
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    $devPassword = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    $content = (Get-Content .env -Raw).Replace('POSTGRES_PASSWORD=', "POSTGRES_PASSWORD=$devPassword")
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $content, [System.Text.UTF8Encoding]::new($false))
}
```

A senha é exclusiva do banco de desenvolvimento e não provisiona um usuário da aplicação. O `.env` é ignorado pelo Git e excluído do contexto de build. Não coloque senhas em variáveis `VITE_*`, que são expostas à interface.

A porta 5173 foi verificada como livre durante a implementação. Para conferir antes de subir em outra máquina:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue
```

Se houver um listener, escolha outra porta livre em `WEB_PORT` no `.env`, preservando a senha e os dados. O Compose falha caso a porta esteja ocupada; não encerre serviços de outros projetos para liberá-la.

```powershell
docker compose config --quiet
docker compose up --build -d --wait
# Atalho equivalente para subir:
npm run dev:all
# Aplicar o esquema, também em um volume já inicializado:
npm run db:migrate
```

Abra [http://localhost:5173](http://localhost:5173), ou a porta definida em `WEB_PORT`. A tela inicial consulta o estado real da API e do PostgreSQL; **Verificar novamente** repete a consulta.

## Estado, logs e healthcheck

```powershell
docker compose ps
docker compose logs -f --tail=100
# Apenas um serviço:
docker compose logs -f --tail=100 api
Invoke-RestMethod http://localhost:5173/api/health
```

Os atalhos são `npm run dev:status` e `npm run dev:logs`. Ctrl+C encerra o acompanhamento de logs e mantém os containers em execução.

`GET /api/health` executa `SELECT 1` no PostgreSQL e responde HTTP 200 com `status: ok` e `database: up`. Se o banco estiver indisponível, responde HTTP 503 com `status: degraded` e `database: down`, sem expor credenciais ou erros internos. `checkedAt` indica o instante da consulta em UTC. O proxy Vite preserva o caminho `/api` e encaminha para `http://api:3001` na rede Compose.

## Parar e reiniciar sem apagar dados

```powershell
# Parar e remover somente os containers e a rede deste projeto:
docker compose down
# Atalho equivalente:
npm run dev:stop

# Subir novamente com os mesmos volumes:
docker compose up -d --wait

# Reiniciar os containers existentes:
docker compose restart
```

`npm run dev:restart` equivale ao último comando. `docker compose stop` também preserva containers e volumes; retome com `docker compose up -d --wait`. Mudanças no `.env` exigem `docker compose up -d --wait` para recriar os serviços afetados; `restart` não aplica novas variáveis.

Não acrescente `-v` a `docker compose down` e não remova os volumes. A persistência usa volumes exclusivos:

| Volume | Conteúdo | Montagem |
|---|---|---|
| `topologia_new_postgres_data` | Cluster PostgreSQL 18 | `/var/lib/postgresql` |
| `topologia_new_plant_files` | Arquivos de plantas futuros | `/data/files` na API |
| `topologia_new_node_modules` | Dependências Linux de desenvolvimento | `/workspace/node_modules` |

A inicialização do container cria o banco vazio. `npm run db:migrate` aplica o esquema sem inserir cadastros ou administrador. Execute esse comando explicitamente ao instalar ou atualizar o projeto; não há migração nem seed no startup da API. Em volume já inicializado, mudar `POSTGRES_PASSWORD` no `.env` não troca a senha armazenada pelo PostgreSQL; preserve a configuração até existir um procedimento explícito de alteração. O esquema evolui por novas migrações, sem reset dos volumes.

## Migrações e testes do banco

Com os serviços em execução:

```powershell
npm run db:status      # versões applied/pending; confere o histórico e os checksums
npm run db:migrate     # aplica somente versões pendentes, sem apagar dados
npm run test:domain    # contrato e validações de geometria
npm run test:db        # PostgreSQL real, usando bancos sintéticos separados
```

Cada migração SQL é transacional e registrada com SHA-256 em `schema_migrations`. Um lock no PostgreSQL serializa migradores simultâneos. Falhas revertem a versão inteira; versões anteriores permanecem aplicadas. Não edite arquivos já aplicados: acrescente a próxima versão sequencial. Não há comando de reset/down de esquema.

Os testes criam bancos com prefixo `topologia_new_test02_`, verificam migrações, preservação de dados e restrições concorrentes e removem apenas esses bancos ao terminar. O usuário configurado precisa de `CREATEDB` para esses testes e permissão para instalar `btree_gist` nas migrações. O usuário de desenvolvimento criado pela imagem PostgreSQL já atende a isso. O banco de trabalho não recebe dados sintéticos.

Referências: [modelo e operação do banco](database/README.md), [contrato de geometria](docs/GEOMETRIA.md) e [evidências da etapa 02](docs/PROGRESSO.md#etapa-02--domínio-banco-e-migrações).

## Desenvolvimento e verificações

O monorepo usa npm workspaces: `apps/api` (Fastify), `apps/web` (React/Vite) e `packages/domain` (entidades e geometria sem dependência do renderizador). As versões diretas são fixas e a resolução completa está em `package-lock.json`.

O código é montado do host nos containers. Vite atualiza a interface por HMR; `tsx watch` reinicia a API. Polling permite detectar alterações no Docker Desktop/Windows. Não é necessário reconstruir imagens a cada alteração de código.

```powershell
# Verificar e compilar dentro do ambiente Docker:
docker compose exec -T api npm run typecheck
docker compose exec -T api npm run build

# Opcional, usando Node/npm no host:
npm ci
npm run typecheck
npm run build
```

O build compila o domínio, a API e a interface. Os Dockerfiles atuais são de desenvolvimento; o build/servidor de produção será entregue na etapa 20.

Ao alterar dependências, atualize os manifests e o lockfile com npm 11, pare os serviços que usam o volume de dependências e sincronize-o:

```powershell
docker compose stop web api
docker compose run --rm --no-deps api npm install --no-audit --no-fund
# Alternativa para instalar exatamente o lockfile já atualizado:
npm run dev:install
docker compose up --build -d --wait
```

Reconstruir a imagem sozinho não substitui as dependências de um volume já existente. O volume de dependências é compartilhado por API e web; não execute instalações simultâneas nele. Dependências instaladas no Windows ficam ocultas pelo volume Linux dentro dos containers.

## Serviços locais

| Serviço Compose | Container | Acesso |
|---|---|---|
| `web` | `topologia_new_web` | `127.0.0.1:5173` no host, configurável |
| `api` | `topologia_new` | `api:3001`, somente rede Docker |
| `db` | `topologia_new_db` | `db:5432`, somente rede Docker |

O projeto Compose é `topologia_new`. Todos os comandos acima operam somente esse projeto. PostgreSQL e API não têm portas publicadas no host.

## Limites desta entrega

A próxima etapa é **03 — Administrador, login e sessões**, ainda pendente. As tabelas de acesso estão criadas, mas autenticação, provisionamento, autorização de requisições e telas de cadastro não foram iniciados. Editor 2D, importação, QR Code e produção permanecem nas etapas previstas. A identidade Microgate completa permanece na etapa 18; logos serão fornecidos posteriormente.

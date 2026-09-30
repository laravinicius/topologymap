# Topologia New

Projeto independente para documentar plantas, mesas, datacenters, racks e conexões de várias empresas. Etapas 01 a 05 concluídas: ambiente Docker, domínio, migrações, autenticação, administração global, acessos por empresa e cadastros da hierarquia do parque. O parque começa vazio; o primeiro administrador é criado explicitamente pelo usuário, sem senha padrão.

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

Abra [http://localhost:5173](http://localhost:5173), ou a porta definida em `WEB_PORT`. A aplicação apresenta o login. Após entrar, o painel consulta o estado real da API e do PostgreSQL; **Verificar novamente** repete a consulta.

## Criar seu primeiro administrador

Com os serviços em execução, aplique as migrações e execute o provisionamento em um terminal interativo na raiz do projeto:

```powershell
npm run db:migrate
npm run admin:create
# Sem Node/npm no host, os equivalentes são:
# docker compose exec -T api npm run db:migrate --workspace @topologia-new/api
# docker compose exec api npm run admin:create --workspace @topologia-new/api
```

Informe **nome**, **login**, **senha** e **confirmação da senha** quando solicitado. A senha não aparece no terminal e deve ter de 12 a 128 caracteres. Login aceita de 1 a 100 caracteres: letras sem acentos, números e `. _ @ + -`; espaços nas extremidades são removidos e letras convertidas para minúsculas. Depois, entre em [http://localhost:5173/login](http://localhost:5173/login) com o acesso que acabou de criar.

Use o comando sem `-T`: entrada não interativa é recusada. Não passe a senha como argumento, variável `VITE_*`, arquivo versionável ou comando no histórico. Não existe conta padrão, seed de administrador nem provisionamento no startup. O comando cria somente o primeiro administrador; se já houver um, inclusive desativado, termina com erro e **não altera senha, nome ou conta**. Um login já existente também é recusado; execuções simultâneas são serializadas no banco. A administração posterior de usuários e permissões está disponível em **Administração** após entrar como administrador geral.

## Administrar usuários, empresas e acessos

Entre como administrador geral e abra **Administração** (URL `/administracao`). Crie uma empresa e um usuário com login e senha inicial de 12 a 128 caracteres. O usuário começa sem acessos. Em **Permissões por empresa**, selecione usuário, empresa e **Gerenciamento** ou **Visualização** e clique em **Salvar permissão**. Repita para cada empresa; a concessão substitui o papel anterior naquela empresa. **Revogar acesso** remove somente a concessão selecionada.

Para editar, use **Empresa para editar** ou **Usuário para editar**. Renomear preserva IDs e vínculos. Deixe **Nova senha** vazia para manter a senha atual. Desmarcar **Usuário ativo** e salvar revoga todas as sessões; reativar exige novo login. Trocar a senha também encerra sessões, inclusive a do próprio administrador se ele editar sua senha. O administrador geral é provisionado pelo CLI, acessa todas as empresas e não pode ser desativado pela tela/API; os usuários criados na tela recebem somente papéis por empresa.

Em **Empresas autorizadas** (`/parque?empresa=UUID`), cada usuário vê as empresas e os papéis atuais. Recarregar mantém a seleção; **Atualizar acessos**, voltar ao foco ou a consulta a cada 30 segundos revalida a lista e o contexto. A API consulta o banco em cada requisição: revogação/troca de papel não depende de atualizar a tela ou refazer login. Empresa inexistente ou não autorizada recebe 404; escrita como visualizador recebe 403; sessão inválida ou usuário inativo recebe 401. Todas as operações administrativas são exclusivas do administrador geral.

API: `GET /api/companies`, `GET /api/companies/:companyId`, `GET /api/companies/:companyId/park`; administração em `GET/POST /api/admin/users`, `PATCH /api/admin/users/:userId`, `POST /api/admin/companies`, `PATCH/DELETE /api/admin/companies/:companyId`, `GET /api/admin/users/:userId/permissions` e `PUT/DELETE /api/admin/users/:userId/permissions/:companyId`. A concessão PUT recebe `{ role: "manager" | "viewer" }`; cadastros de empresa recebem `{ name }`. Payloads públicos nunca devolvem hash ou sessão interna. Criar, renomear e excluir empresas continua exclusivo do administrador geral.

Não há migração nova: as tabelas e constraints de usuários, empresas e permissões já estão na migração 001. `npm run test:access` valida a API com PostgreSQL e banco sintético exclusivo, removido ao terminar. Para futuras rotas do parque, declare `config: { access: 'company' }`, valide `params.companyId` como UUID e use `request.company.id` em todas as consultas, incluindo as referências a filhos; métodos de escrita recusam viewer automaticamente. Rotas sem política explícita são recusadas por padrão.

## Cadastrar e consultar o parque

Em **Empresas autorizadas**, selecione a empresa. O administrador geral e o gerente autorizado podem usar **Nova unidade**, informar nome e classificação (**Matriz**, **Filial**, **CD** ou uma identificação livre) e salvar. Abra a unidade pelo nome para cadastrar seus **Andares** e **Datacenters da unidade**. Abra o andar para cadastrar **Plantas**. A planta exige somente um nome; imagem, desenho, importação e posicionamento pertencem às próximas etapas. Cada unidade pode ter vários datacenters, independentemente de seus andares.

Use **Editar** para renomear, mantendo IDs e vínculos; a unidade também permite alterar sua classificação. Nesta etapa não se transferem cadastros entre pais: empresa, unidade e andar de filiação não são editáveis. O vínculo espacial de datacenters a plantas será tratado junto com o posicionamento; os metadados desta etapa preservam qualquer geometria ou vínculo espacial já persistido.

O caminho acima das listas permite retornar ao contexto anterior. Empresa, unidade, andar, planta ou datacenter selecionados ficam na URL, por exemplo `/parque?empresa=UUID&unidade=UUID&andar=UUID&planta=UUID`. Recarregar e os botões Voltar/Avançar do navegador preservam o contexto; selecionar outro pai limpa a seleção dos filhos. IDs incompatíveis não mostram filhos de outro contexto. **Atualizar acessos**, foco e revalidação periódica atualizam também os cadastros e o papel. Visualizadores consultam as mesmas listas sem controles de alteração; chamadas diretas de escrita recebem 403.

**Política de exclusão:** exclusão definitiva, mediante confirmação na tela, somente para registros sem dependências; sem arquivamento ou exclusão em cascata nesta etapa. A API e as FKs RESTRICT bloqueiam a remoção de unidade com andares/datacenters, andar com plantas, planta referenciada por mesas/setores/datacenters/racks e datacenter com racks. Empresas só podem ser excluídas pelo administrador, após remover seus cadastros e revogar suas permissões. Conflitos retornam 409 e mantêm os dados; não há desvinculação automática. Exclua os dependentes explicitamente de baixo para cima quando necessário.

API de cadastro, sob `/api/companies/:companyId`: `/units`, `/units/:unitId/floors`, `/units/:unitId/floors/:floorId/plans` e `/units/:unitId/datacenters`. Cada coleção aceita GET (lista) e POST (criação); acrescente o ID do registro para GET (detalhe), PATCH (edição) ou DELETE. Unidades recebem `{ name, classification }`; demais cadastros recebem `{ name }`; PATCH aceita somente os campos editáveis presentes. UUIDs, limites de 1 a 200 caracteres, nomes não vazios, unicidade no pai e toda a filiação são validados. Propriedades extras são recusadas. `/park` retorna um snapshot dos metadados da empresa autorizada, sem arquivos ou geometria.

`npm run test:park` valida os cadastros, papéis, filiações, renomeações, exclusões e concorrência em PostgreSQL exclusivo. Não há migração nova nem seed: as migrações 001/002 já protegem toda a hierarquia. O banco de trabalho e seus volumes são preservados.

## Login, sessão e logout

`POST /api/auth/login` recebe JSON `{ login, password }`; `GET /api/auth/session` retorna apenas usuário público e expiração; `POST /api/auth/logout` revoga a sessão e limpa o cookie. `GET /api/park` é a entrada autenticada. Sem sessão, sessão/parque retornam HTTP 401 e a interface direciona a `/login`. O healthcheck permanece público. Recarregar preserva uma sessão válida; a tela também revalida ao voltar ao foco e a cada 30 segundos. **Sair** só confirma o logout após a resposta da API.

As sessões duram **8 horas fixas**, sem renovação automática. O servidor verifica expiração pelo relógio do PostgreSQL e atividade do usuário em cada consulta autenticada. Tokens aleatórios de 256 bits ficam apenas no cookie; o banco guarda SHA-256 do token. Um novo login gera outro token e revoga a sessão anterior apresentada pelo mesmo navegador. A senha usa scrypt assíncrono (`N=131072, r=8, p=1`), salt aleatório de 128 bits e comparação em tempo constante. Tokens e senhas não ficam no localStorage e não são devolvidos no JSON.

Cookie local: `topologia_session`, `HttpOnly`, `SameSite=Strict`, `Path=/`, expiração/Max-Age e sem Domain. Com `NODE_ENV=production`, passa a `__Host-topologia_session` com `Secure`; `APP_ORIGINS` torna-se obrigatório e aceita somente origens HTTPS. Isso prepara a autenticação para produção; publicação/HTTPS continuam nas etapas 20/21.

Toda escrita exige o header `Origin` presente e igual a uma das origens configuradas. Origem ausente, `null`, diferente ou `Sec-Fetch-Site: cross-site` recebe HTTP 403, inclusive no login/logout. Chamadas manuais de escrita também precisam de Origin e, quando aplicável, cookie. Não há CORS permissivo. No Compose local, as origens padrão são `http://localhost:WEB_PORT` e `http://127.0.0.1:WEB_PORT`; altere `APP_ORIGINS` no `.env` apenas se usar uma origem diferente, sem barra final, separando múltiplas origens por vírgula. Recrie o serviço com `docker compose up -d --wait` após mudar variáveis.

Limites: **5 tentativas por login e 20 por IP em janelas de 15 minutos**, incluindo tentativas bem-sucedidas; HTTP 429 informa `Retry-After`. As janelas usam upsert atômico no PostgreSQL, sobrevivem ao reinício e não são zeradas no login. Login inexistente e senha incorreta recebem a mesma mensagem. No proxy Vite local, o IP visto é o do proxy; `X-Forwarded-For` não é confiado, evitando falsificação. A publicação futura deverá configurar explicitamente seus proxies confiáveis; não habilite confiança irrestrita. A API limita também a duas verificações de senha simultâneas para conter uso de memória.

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
npm run test:auth      # provisionamento, cookies, sessões, expiração, origem e limites
npm run test:access    # administração e autorização por empresa; PostgreSQL sintético separado
```

Cada migração SQL é transacional e registrada com SHA-256 em `schema_migrations`. Um lock no PostgreSQL serializa migradores simultâneos. Falhas revertem a versão inteira; versões anteriores permanecem aplicadas. Não edite arquivos já aplicados: acrescente a próxima versão sequencial. Não há comando de reset/down de esquema.

Os testes criam bancos com prefixo `topologia_new_test02_`, verificam migrações, preservação de dados e restrições concorrentes e removem apenas esses bancos ao terminar. O usuário configurado precisa de `CREATEDB` para esses testes e permissão para instalar `btree_gist` nas migrações. O usuário de desenvolvimento criado pela imagem PostgreSQL já atende a isso. O banco de trabalho não recebe dados sintéticos.

Os testes de autenticação usam bancos exclusivos `topologia_new_test03_`, senha aleatória gerada em memória e remoção ao terminar. Verificam também preservação dos limites após reconstruir a API, revogação, rotação, usuário inativo e flags de produção. Evidências do navegador estão em [PROGRESSO.md](docs/PROGRESSO.md#etapa-03--administrador-login-e-sessões).

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

A próxima etapa é **04 — Usuários e permissões por empresa**, ainda pendente e não iniciada. Autenticação e bootstrap do primeiro administrador estão disponíveis; não há administração de usuários, empresas, permissões ou cadastros do parque nesta entrega. Editor 2D, importação, QR Code e produção permanecem nas etapas previstas. A identidade Microgate completa permanece na etapa 18; logos serão fornecidos posteriormente.

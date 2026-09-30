# Progresso do desenvolvimento

Atualizado em 30/09/2026, às 15:55 (America/Sao_Paulo).

**Estado atual:** etapas 01 e 02 concluídas. Ambiente local saudável, esquema aplicado e parque vazio. Próxima etapa: 03, ainda pendente. A seção 01 preserva o histórico da entrega inicial; o resultado atual está na seção 02.

## Etapa 01 — Workspace e Docker local

**Situação: Concluída.** Ambiente local em execução em [http://localhost:5173](http://localhost:5173). Registro histórico da etapa 01; a entrega posterior da etapa 02 está documentada abaixo.

### Resultado e arquivos principais

- Monorepo npm com `apps/api`, `apps/web` e `packages/domain`; este último contém somente a estrutura para receber o domínio na etapa 02.
- React/TypeScript/Vite na interface; Fastify/TypeScript e cliente PostgreSQL na API; configurações de typecheck/build e `package-lock.json`.
- `compose.yaml`, `apps/api/Dockerfile` e `apps/web/Dockerfile` para desenvolvimento, com volumes exclusivos e código montado do host.
- `.env.example`, `.env` local com senha aleatória, `.gitignore` e `.dockerignore`; nenhuma credencial publicada nos arquivos versionáveis.
- `README.md` com configuração inicial, subida, logs, parada, reinício, verificações e atualização das dependências preservando volumes.
- `docs/IMPLEMENTACAO.md` atualizado e etapa 01 marcada como concluída em `docs/PLANO_DESENVOLVIMENTO.md`.

Não havia repositório Git nesta pasta: `git status --short` informou `not a git repository`. Não foi criado repositório, commit, envio remoto ou publicação.

### Ambiente e versões observadas

| Item | Versão |
|---|---|
| Node.js / npm no host | 24.19.0 / 11.17.0 |
| Docker / Compose | 29.7.2 / v5.4.0 |
| Node.js / npm nos containers | 24.21.0 / 11.19.0 |
| PostgreSQL | 18.6, imagem `postgres:18-bookworm` |
| React / React DOM | 19.3.0 |
| TypeScript | 7.0.2 |
| Vite / plugin React | 8.3.1 / 6.1.1 |
| Fastify / pg / tsx | 5.12.5 / 8.23.1 / 4.23.15 |

Versões e contratos foram consultados no registro npm e na documentação oficial de [Vite](https://vite.dev/config/server-options), [Fastify](https://fastify.dev/docs/latest/Reference/Server/), [Node.js](https://nodejs.org/en/about/previous-releases) e da [imagem PostgreSQL](https://hub.docker.com/_/postgres). O volume do PostgreSQL 18 foi montado em `/var/lib/postgresql`, conforme o layout dessa imagem. Tags das imagens seguem a versão principal; as versões acima descrevem o runtime desta validação.

A skill UI/UX Pro Max foi consultada apenas para a tela inicial. As buscas na base React não encontraram correspondência específica; foram aplicadas orientações gerais de contraste, foco visível, rótulos, feedback e responsividade. A identidade Microgate completa permanece na etapa 18.

### Verificações executadas

| Verificação | Comando/procedimento | Evidência e resultado |
|---|---|---|
| Porta livre | Consulta de listeners e bind com `TcpListener` em loopback | `127.0.0.1:5173 disponível (bind TCP confirmado)` antes da subida. |
| Dependências/lockfile | `npm install --no-audit --no-fund`; `npm ci` durante o build Docker | Instalação concluída no host e em Linux, usando o lockfile. |
| Compose | `docker compose config --quiet` | Configuração válida, exit code 0. |
| Subida real | `docker compose up --build -d --wait --wait-timeout 180`; depois `npm run dev:all` | Três serviços iniciados e `healthy`. |
| Typecheck no host | `npm run typecheck` | API, web e domain aprovados. |
| Build no host | `npm run build` | Domain e API compilados; Vite gerou `apps/web/dist`. |
| Typecheck/build em Linux | `docker compose exec -T api npm run typecheck`; `docker compose exec -T api npm run build` | Ambos aprovados no runtime Docker. Build final da interface: 222,14 kB de JS, 69,57 kB gzip. |
| Proxy e banco disponíveis | `Invoke-WebRequest http://localhost:5173/api/health` | HTTP 200; `status: ok`, `service: topologia_new`, `database: up`. |
| Banco indisponível | `docker compose stop db`; consultar o mesmo endpoint | HTTP 503; `status: degraded`, `database: down`, em 30/09/2026 às 14:58:01. |
| Recuperação do banco | `docker compose up -d --wait`; repetir healthcheck | HTTP 200 e `database: up`, sem reiniciar a API manualmente. |
| Exposição de portas | `docker inspect` dos três containers, somente `HostConfig.PortBindings` | API `{}`, banco `{}`; web exclusivamente `127.0.0.1:5173`. |
| Banco vazio | Consultar `information_schema.tables` com `table_schema='public'` | Zero tabelas de aplicação antes e depois dos testes. |
| HMR da interface | Alterar temporariamente o texto inicial em `App.tsx` | Novo texto apareceu na aba aberta, sem reload manual; logs `hmr update /src/App.tsx`. Texto original restaurado e confirmado. |
| Atualização da API | Alterar temporariamente `service` em `server.ts` | Proxy retornou `topologia_new_hotreload_probe` sem reconstruir/reiniciar container; fonte restaurada e healthcheck voltou a `topologia_new`. |
| Outros projetos | Comparar IDs, nomes e estado dos demais containers antes/depois do ciclo | Nenhuma diferença; serviços de outros projetos preservados. |

Resposta observada após a recriação dos containers, às 15:01:20:

```json
{"status":"ok","service":"topologia_new","database":"up","checkedAt":"2026-09-30T18:01:20.550Z"}
```

### Persistência real após parar e subir

Foi criado um banco separado, `topologia_new_stage01_probe_20260930`, exclusivamente para o teste, com uma tabela `persistence_probe` e o valor `etapa01-persistencia-ok`. O banco de trabalho `topologia_new` permaneceu sem tabelas. Foi escrito um arquivo temporário exclusivo em `/data/files/.stage01-persistence-probe-20260930.txt`, com o valor `etapa01-arquivos-ok`.

Executados `npm run dev:stop` (Compose down sem `-v`) e `npm run dev:all`. Os containers e a rede foram removidos/recriados, os três volumes permaneceram e os dois marcadores foram lidos com os mesmos valores após a subida.

Os volumes `topologia_new_postgres_data` e `topologia_new_plant_files` mantiveram a mesma data de criação, `2026-09-30T17:51:39Z`, antes/depois. Isso foi confirmado por `docker volume inspect`, juntamente com a leitura dos dados.

Após a validação, somente o banco de teste e o arquivo temporário foram removidos. Estado final: banco `topologia_new` com **zero tabelas de aplicação**; `/data/files` **vazio**; nenhum cadastro, dado real ou marcador de teste restante. Não foram apagados volumes.

### Navegador local

Validação real no navegador integrado do Codex, em `http://localhost:5173`:

- Tela inicial renderizada com **Operacional**, API **Em execução** e PostgreSQL **Conectado**.
- Botão **Verificar novamente** atualiza o instante da consulta, mostra estado de carregamento e fica desabilitado durante a requisição.
- Banco parado: interface exibiu **Indisponível** e **A API respondeu, mas o banco está indisponível.**; após a recuperação, voltou ao estado operacional.
- Viewport desktop observada: **792 × 884**, sem overflow horizontal.
- Viewport de celular: **390 × 844**, sem overflow horizontal; botão com aproximadamente **47,6 px** de altura e texto legível. A alteração de viewport foi desfeita ao terminar.
- Após o ciclo de persistência, a página foi recarregada e mostrou os serviços operacionais. Consulta final de logs de console sem erros ou avisos.

Capturas finais: [interface desktop](evidencias/etapa01/interface-desktop.jpg) e [interface em viewport de celular](evidencias/etapa01/interface-celular.jpg). Estado final dos serviços registrado em [verificacao-final.json](evidencias/etapa01/verificacao-final.json).

Typecheck/build, testes locais de API/banco e navegador local foram executados separadamente. Não houve teste em celular físico ou produção. A validação cobre a base local desta etapa, sem afirmar funcionamento dos futuros cadastros, autenticação ou editor.

### Operação e continuidade

Ficaram em execução: `topologia_new` (API), `topologia_new_web` (Vite) e `topologia_new_db` (PostgreSQL), todos saudáveis. Somente a interface é publicada em localhost.

```powershell
npm run dev:all     # subir e aguardar os healthchecks
npm run dev:logs    # acompanhar logs; Ctrl+C encerra só o acompanhamento
npm run dev:stop    # parar preservando todos os volumes
```

**Pendências da etapa 01: nenhuma.** Ao encerrar aquela entrega, a etapa **02 — Domínio, banco e migrações** permanecia pendente e `packages/domain` tinha apenas a estrutura. Migrações e contratos foram implementados posteriormente na seção abaixo. Administrador, login, cadastros pela aplicação, editor, importação, QR Code, 3D, produção e identidade visual definitiva não fizeram parte da etapa 01.

## Etapa 02 — Domínio, banco e migrações

**Situação: Concluída.** Somente esta etapa foi implementada. Etapas 03 a 21 continuam pendentes. Nenhum cadastro real, dado do levantamento legado ou administrador foi carregado.

### Resultado e arquivos principais

- `packages/domain/src/entities.ts` e `geometry.ts`: contratos para as 15 entidades, papéis, equipamentos, conexões e geometria independente do renderizador, com validadores de forma. `docs/GEOMETRIA.md` define metros, origem, eixos, âncora, rotação, paredes/aberturas e fundo.
- `database/migrations/001_access_hierarchy.sql`: usuários/sessões, empresas/permissões, hierarquia, setores/mesas/pontos e datacenters. `002_racks_connections.sql`: racks, equipamentos/portas e relação única das conexões.
- `apps/api/src/database/{config,migrations,cli}.ts`: configuração compartilhada com o healthcheck; migrador versionado, transacional, com SHA-256, validação do histórico, lock de sessão e comandos apply/status. Dockerfile da API inclui os SQLs. `.gitattributes` fixa LF das migrações.
- `apps/api/test/database.test.ts`: testes com PostgreSQL real em bancos exclusivos. `packages/domain/test/geometry.test.mjs`: validações do contrato. Typecheck da API também verifica os testes em `tsconfig.test.json`.
- Scripts `db:migrate`, `db:status`, `test:domain` e `test:db` na raiz. Operação documentada em `README.md` e `database/README.md`; arquitetura e plano atualizados.

IDs UUID e nomes exatos únicos no pai preservam grafia e zeros. FKs compostas protegem empresa, unidade e planta quando aplicável. Dependências usam RESTRICT; remover pai, ponto ou porta ocupados não elimina vínculos. Somente patch panels podem ter portas. `connections` é a única fonte de vínculo, com unicidades independentes de ponto/porta e revisão incrementada ao editar.

Ocupação em U tem exclusão GiST por rack/intervalo `int8range`, com `btree_gist` 1.8. Capacidade é protegida por FK para a capacidade real do rack, testemunho interno `rack_capacity_u`, ON UPDATE CASCADE e CHECK por equipamento. Reduções que deixariam equipamento fora do rack falham integralmente. Essa decisão evita validação por consulta prévia e protege instalação/movimentação concorrentes; o campo interno não será editável no formulário.

A estrutura de acesso não equivale a login/autorização funcionando: autenticação e provisionamento são da etapa 03; autorização por empresa, da etapa 04. APIs/formulários de cadastro e conexão permanecem nas etapas previstas. Geometria está modelada, sem editor ou renderizador instalado; revisão esperada do layout será implementada na etapa 11.

### Verificações executadas

| Verificação | Comando/procedimento | Resultado |
|---|---|---|
| Dependência da etapa 01 | `docker compose ps`, versão PostgreSQL e healthcheck pelo proxy | PostgreSQL 18.6; API, banco e web saudáveis. Antes de migrar, public tinha zero tabelas. |
| Banco novo | Teste cria banco exclusivo, consulta status, aplica e reaplica | Status não cria tabelas; duas versões aplicadas uma única vez. |
| Banco inicializado com dados | Aplicar 001, inserir dados sintéticos nas 11 tabelas da versão, aplicar 002 | Todas as linhas, IDs, datas e geometrias anteriores preservadas; colunas, constraints e índices iguais ao banco novo. |
| Volume de trabalho existente | `npm run db:status`, `npm run db:migrate` duas vezes | Duas versões aplicadas no volume da etapa 01, sem reset e sem duplicar histórico. |
| Histórico/checksum | Alterar cópia de migração e remover arquivo aplicado | Ambos recusados antes de executar SQL; histórico preservado. |
| Falha de migração | 002 de teste cria tabela e falha por divisão por zero | DDL e histórico de 002 revertidos; dados de 001 preservados; arquivo pendente corrigido e reaplicado. |
| Migradores simultâneos | Dois migradores no mesmo banco novo | Cada versão aparece uma única vez. |
| Integridade entre empresas | INSERTs em todos os níveis e UPDATEs de ponto/porta | Referências cruzadas rejeitadas por FK; também testadas planta/unidade/andar, setor/planta e localização do rack/DC. |
| Identidade e dependências | Renomear e posicionar mesa/porta; consultar conexão inversa; tentar exclusões | IDs/vínculos preservados; alteração de ID e exclusões com dependências bloqueadas. |
| Acessos e sessões — estrutura | Usuário manager em A/viewer em B, papéis inválidos, duplicidades e expiração | Restrições do esquema aprovadas; não representa teste de autorização de requisições. |
| U e portas | Multi-U, adjacência, sobreposição, posições inválidas, capacidade, patch panels 24/48 | Regras aprovadas; quantidade deriva dos registros; genérico não aceita porta. |
| Concorrência — conexão | Duas transações disputam a mesma porta ou o mesmo ponto | Segunda gravação aguarda lock real e falha por unicidade; só a primeira é confirmada. |
| Concorrência — U | Duas transações instalam equipamentos sobrepostos | Segunda aguarda lock real e falha por exclusão. |
| Concorrência — capacidade | Redução versus INSERT/movimentação nos dois sentidos; snapshot REPEATABLE READ | Operação conflitante rejeitada; nenhuma linha excede a capacidade real. |
| Testes de banco | `npm run test:db` | **35/35** aprovados (34 subtestes + teste principal), dados sintéticos isolados; bancos temporários removidos. |
| Testes do domínio | `npm run test:domain` | **4/4** aprovados: medidas/rotação, polígonos, paredes/aberturas e metadados do fundo. |
| Typecheck/build | `npm run typecheck` / `npm run build`, no host e por `docker compose exec -T api` | Aprovados em Windows e Linux; testes tipados; API, domínio e web compilados. |
| CLI compilado | `docker compose exec -T api node apps/api/dist/database/cli.js status` | Localização dos SQLs correta no build; duas versões applied. |
| Imagens e serviços | `docker compose up --build -d --wait` | Build via lockfile aprovado, serviços saudáveis; demais containers mantiveram IDs/nomes. |
| Persistência após reinício | `docker compose restart db`; `docker compose up -d --wait`; consultar histórico/contagens | Mesmo esquema/histórico; volume original preservado. |

Os contratos usados foram conferidos nas fontes oficiais: [constraints PostgreSQL 18](https://www.postgresql.org/docs/18/ddl-constraints.html), [intervalos/exclusão PostgreSQL 18](https://www.postgresql.org/docs/18/rangetypes.html) e [transações node-postgres](https://node-postgres.com/features/transactions). Nenhuma dependência nova de aplicação foi instalada; `btree_gist` é extensão fornecida pelo PostgreSQL.

### Evidências e estado final

Logs: [testes de banco](evidencias/etapa02/testes-banco.txt) e [testes do domínio](evidencias/etapa02/testes-dominio.txt). Estado: [banco/histórico/contagens](evidencias/etapa02/estado-banco.json), [persistência do volume](evidencias/etapa02/persistencia-volume.json) e [serviços/healthcheck final](evidencias/etapa02/verificacao-final.json).

O volume `topologia_new_postgres_data` continua com a data de criação **2026-09-30T17:51:39Z**, igual à etapa 01. Reconstrução dos containers e reinício do banco não removeram o volume. Comparação dos demais containers: **zero diferenças** de IDs/nomes.

Consulta final em 30/09/2026 às 15:54 (America/Sao_Paulo): duas linhas no histórico de migração e **zero registros em cada uma das 15 tabelas de domínio**, incluindo usuários e sessões. **Zero bancos temporários de teste restantes.** O banco de trabalho não recebeu dados sintéticos ou clientes. Arquivos de plantas e interface não foram alterados nesta etapa.

Healthcheck final: HTTP 200, `status: ok`, `database: up`, `checkedAt: 2026-09-30T18:54:46.756Z`. API `topologia_new`, web `topologia_new_web` e banco `topologia_new_db` ficaram em execução e saudáveis. URL: [http://localhost:5173](http://localhost:5173).

Typecheck/build e testes reais de banco foram verificados separadamente. Esta etapa não entregou telas novas; houve verificação HTTP do healthcheck, sem nova validação visual no navegador. Não houve teste em dispositivo físico nem produção.

### Operação e continuidade

Para conferir/reaplicar e testar:

```powershell
npm run db:status
npm run db:migrate
npm run test:domain
npm run test:db
```

Para parar preservando volumes: `npm run dev:stop`; para retomar: `npm run dev:all`. O esquema não é migrado automaticamente na subida; execute `npm run db:migrate` para aplicar novas versões. Nunca use `down -v` para atualizar o banco.

**Pendências da etapa 02: nenhuma.** Próxima etapa: **03 — Administrador, login e sessões**, somente mediante nova solicitação. Nenhum commit, publicação ou etapa posterior foi iniciado; a pasta continua sem repositório Git.

# Progresso do desenvolvimento

Os arquivos de evidências em `docs/evidencias/` são locais e ignorados pelo Git. Capturas, logs e relatórios permanecem disponíveis na máquina onde foram gerados; os resultados das verificações continuam registrados neste documento. Os caminhos abaixo são referências locais e não acompanham novas cópias do repositório.

Atualizado em 30/09/2026 (America/Sao_Paulo), após a conclusão da etapa 05.

**Estado atual:** etapas 01 a 05 concluídas. Ambiente local saudável, autenticação, administração global, autorização por empresa e cadastros de unidades/andares/plantas/datacenters disponíveis. Usuários, sessões, empresa e permissões existentes no banco de trabalho preservados; cadastros do parque continuam vazios ali. Dados sintéticos usados somente em bancos separados. Próxima etapa: 06, pendente e não iniciada. As seções 01 a 04 preservam o histórico; o resultado atual está na seção 05.

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

Capturas finais locais: interface desktop (`docs/evidencias/etapa01/interface-desktop.jpg`) e interface em viewport de celular (`docs/evidencias/etapa01/interface-celular.jpg`). Estado final dos serviços registrado em `docs/evidencias/etapa01/verificacao-final.json`.

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

Logs locais: testes de banco (`docs/evidencias/etapa02/testes-banco.txt`) e testes do domínio (`docs/evidencias/etapa02/testes-dominio.txt`). Estado: banco/histórico/contagens (`docs/evidencias/etapa02/estado-banco.json`), persistência do volume (`docs/evidencias/etapa02/persistencia-volume.json`) e serviços/healthcheck final (`docs/evidencias/etapa02/verificacao-final.json`).

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

## Etapa 03 — Administrador, login e sessões

**Situação: Concluída.** Autenticação real disponível em [http://localhost:5173/login](http://localhost:5173/login). Etapas 04 a 21 permanecem pendentes, sem implementação de administração de usuários, empresas ou permissões.

### Resultado e arquivos principais

- `apps/api/src/auth/{password,config,provision,admin-cli}.ts`: scrypt assíncrono, origens explícitas e bootstrap interativo. Senha oculta, confirmação e validações, sem senha padrão ou credencial em argumentos/env. Advisory lock transacional serializa dois provisionamentos; administrador existente, inclusive inativo, ou login ocupado impede alterações.
- `apps/api/src/app.ts`: aplicação testável, hook central de autenticação, login/logout/consulta de sessão e entrada protegida `/api/park`. Servidor mantém healthcheck público, erros genéricos e logs sem cookies/senhas. Todas as escritas exigem origem permitida e rejeitam Fetch Metadata cross-site.
- `packages/domain/src/auth.ts`: contratos públicos de login/usuário/sessão sem hashes ou token. Sessões PostgreSQL com expiração fixa de 8 horas; cookie HttpOnly/SameSite Strict/Path=/, sem Domain; Secure e prefixo `__Host-` em produção, que exige origens HTTPS.
- `database/migrations/003_login_limits.sql`: janelas persistidas, sem alterar 001/002. Cinco tentativas por login e vinte por IP em 15 minutos, incluindo sucesso, com upsert atômico, contagem saturada e Retry-After. Hash das chaves; máximo de duas verificações de senha simultâneas por processo.
- `apps/web/src/{App,HealthPanel}.tsx` e `style.css`: login com rótulos, campos/autocomplete, foco, feedback/erro e acesso autenticado com Sair. Restauração da sessão ao carregar, expiração, revalidação por foco/30 segundos e proteção contra respostas antigas durante login/logout. HealthPanel preserva a consulta do ambiente depois de entrar. Nenhum token em localStorage.
- `apps/api/test/auth.test.ts`: testes em PostgreSQL isolado. `test/browser-server.ts`: servidor opcional de QA que cria/remove somente banco exclusivo e arquivo de credencial sintética ignorado; não provisiona administrador automaticamente.
- README, arquitetura, plano, documentação do banco, Compose e ignores atualizados. `@fastify/cookie` 11.1.2 fixado no lockfile; scrypt usa `node:crypto`, sem biblioteca nativa adicional. Typecheck da raiz compila o domínio antes de consumir seus contratos.

UI/UX Pro Max foi aplicada à autenticação acessível: rótulos, autocomplete para gerenciadores, colagem permitida, foco visível, feedback e controles grandes. Playwright CLI conduziu Chromium real. Mantida a aparência simples existente; identidade Microgate permanece na etapa 18.

### Verificações executadas

| Camada | Comando/procedimento | Resultado |
|---|---|---|
| Dependências 01/02 | Compose, healthcheck, esquema e status atuais | Serviços saudáveis; migrações anteriores aplicadas e banco vazio antes da entrega. |
| Migração no volume existente | `npm run db:migrate`; `npm run db:status` | 003 aplicada sem reset; 001/002 inalteradas; três versões applied. |
| Banco novo e upgrade com dados | `npm run test:db` | **35/35** aprovados, incluindo instalação/reaplicação, preservação dos dados anteriores, esquema igual, checksums, rollback e concorrência. |
| Hash e bootstrap | `npm run test:auth` | Salt individual, senha correta/incorreta, duas provisões concorrentes com exatamente um sucesso, repetição e administrador inativo sem substituição. |
| Sessões e API | Mesmo teste, PostgreSQL real | Sessão de 8 horas com somente token hash no banco; payload público; login/consulta; sem sessão e cookie malformado recebem 401. |
| Persistência e rotação | Fechar/reconstruir Fastify com o mesmo banco; novo login com cookie anterior | Sessão continua válida após reconstrução; token novo é diferente e token anterior recebe 401. |
| Logout | Origem externa e depois origem válida; replay do cookie antigo | Origem externa recebe 403 sem revogar; logout válido 204, revoked_at preenchido, cookie limpo e token anterior 401. Logout repetido é idempotente. |
| Expiração e desativação | Expirar sessão no banco de teste; desativar usuário | Consulta/parque 401, cookie limpo; usuário inativo não autentica nem acessa pela sessão existente. |
| CSRF/origem | Escritas login/logout/rota futura sem Origin, null, outra origem e cross-site | HTTP 403 antes de criar sessões. Entradas inválidas/oversized não ecoam credenciais. |
| Limitação | Exceder login/IP; reconstruir API; vencer janela; requisições concorrentes com X-Forwarded-For diferente | 429/Retry-After, persistência após reinício, liberação pela janela e somente uma última tentativa concorrente admitida. Header não altera o IP confiado. |
| Configuração de produção | App de teste com origem HTTPS; configuração com HTTP/sem origem | Cookie __Host-/Secure/HttpOnly sem Domain; configuração HTTP/ausente recusada. Não equivale a implantação HTTPS. |
| Total de autenticação | `npm run test:auth` | **15/15** aprovados, 14 subtestes mais teste principal; bancos removidos. |
| Domínio | `npm run test:domain` | **4/4** aprovados. |
| Typecheck/build | Raiz no host; `docker compose exec -T api npm run typecheck` / `npm run build` | Aprovados em Windows e Linux. Build Linux final: JS 226,17 kB / 70,76 kB gzip. |
| Imagens e configuração | `docker compose config --quiet`; `npm run dev:all` | Imagens reconstruídas pelo lockfile e três serviços saudáveis. Volume e exposição somente local preservados. |
| Arquivos | `git diff --check`; ignores de `.env`, CLI e QA | Sem erro de whitespace. Credenciais sintéticas/estado do navegador ficam fora do Git e do contexto Docker. |

### Validação real no navegador

O fluxo completo usou **banco exclusivo** `topologia_new_test03_browser_*`, API temporária interna na porta 3002 e Vite temporário em `127.0.0.1:5174`. O administrador sintético foi criado **pelo próprio CLI interativo**, com entrada oculta e confirmação. Executar o CLI novamente produziu erro de administrador existente; não houve alteração de senha. O usuário deve repetir o procedimento documentado no README para criar sua conta no banco de trabalho.

- Acesso direto a `/parque` sem sessão redirecionou para `/login`; consulta direta da API retornou 401.
- Login incorreto mostrou **Login ou senha inválidos.**, limpou o campo de senha e manteve o formulário.
- Login válido exibiu **Administrador geral** e a entrada do parque. Recarregar permaneceu em `/parque`, com a mesma sessão válida consultada no PostgreSQL.
- Cookie observado no navegador: HttpOnly, SameSite Strict, Path=/, Secure false no HTTP local; `document.cookie` vazio. Flags de produção verificadas separadamente no teste da API.
- **Sair** voltou ao login, removeu o cookie e retornou 401 na consulta da sessão. Replay explícito do token anterior também retornou 401 no parque; recarregar continuou no login.
- A expiração foi simulada alterando created_at/expires_at **somente no banco de QA**, respeitando a constraint temporal. Recarregar retornou ao login, sessão/parque responderam 401 e não restou cookie. Não foi necessário esperar 8 horas para testar o relógio do banco.
- Viewports **1280 × 900** e **390 × 844**: login legível, sem overflow horizontal, foco visível e inputs/botão com 48 px. Entrada autenticada e Sair também conferidos nos dois tamanhos; a página tem rolagem vertical normal.
- Console sem exceções da aplicação. Respostas 401 dos cenários sem sessão são esperadas; o favicon ausente da base ainda retorna 404, sem impedir o fluxo.
- Após remover o ambiente de QA, o navegador abriu o ambiente do usuário em `http://localhost:5173/parque`, redirecionou para `/login` e mostrou a tela pronta para o administrador que será criado pelo usuário.

Evidências locais em `docs/evidencias/etapa03/`: testes de autenticação (`testes-autenticacao.txt`), regressão do banco (`testes-banco.txt`), recarga/logout/replay (`navegador-logout.txt`), expiração (`navegador-expiracao.txt`), login desktop (`login-desktop.png`), login celular (`login-celular.png`), parque desktop (`parque-desktop.png`), parque celular (`parque-celular.png`) e tela final no ambiente do usuário (`login-ambiente-usuario.png`).

### Estado final e operação

Conferência em 30/09/2026 às 17:09 (America/Sao_Paulo): **zero usuários, sessões, empresas e registros em todas as 15 tabelas de domínio**, além de zero janelas de login no banco de trabalho. **Zero bancos temporários de teste restantes.** O administrador sintético, suas sessões e credencial temporária foram removidos junto com o ambiente de QA. Nenhum dado real foi carregado. Contagens e histórico registrados no arquivo local `docs/evidencias/etapa03/estado-banco.json`.

Volume PostgreSQL original preservado, criação **2026-09-30T17:51:39Z**. Permanecem API `topologia_new`, web `topologia_new_web` e banco `topologia_new_db` em execução, saudáveis. Interface em `127.0.0.1:5173`; API/banco sem portas publicadas. Healthcheck HTTP 200 com database up; parque sem sessão HTTP 401. Estado final dos serviços registrado no arquivo local `docs/evidencias/etapa03/verificacao-final.json`.

Para criar seu administrador, na raiz do projeto:

```powershell
npm run db:migrate
npm run admin:create
```

Informe nome/login e uma senha própria no terminal; não coloque a credencial em arquivos versionáveis. Abra [http://localhost:5173/login](http://localhost:5173/login), entre, recarregue e use **Sair**. O procedimento completo e as configurações de cookie/origem/limites estão no [README](../README.md#criar-seu-primeiro-administrador).

Parar preservando volumes: `npm run dev:stop`. Retomar: `npm run dev:all`. O repositório Git estava limpo no começo desta etapa; não houve commit, push ou publicação. Os registros de inexistência de Git nas etapas anteriores são históricos.

Typecheck/build, testes de API/PostgreSQL e navegador local são evidências distintas. Não houve teste em celular físico nem produção. **Pendências da etapa 03: nenhuma. Próxima etapa: 04 — Usuários e permissões por empresa, pendente e não iniciada.**

## Etapa 04 — Usuários e permissões por empresa

**Situação: Concluída em 30/09/2026.** Administração exclusiva do administrador geral, autorização central na API e navegação por empresas autorizadas disponíveis em [http://localhost:5173](http://localhost:5173). A etapa 05 permanece pendente e não foi iniciada.

### Resultado e arquivos principais

- `apps/api/src/auth/authorization.ts`: políticas explícitas de sessão, administrador e empresa, hook central após validação e recusa de rotas sem política. Empresa e papel vêm do banco em cada requisição, sem cache na sessão. Escritas por viewer recebem 403; empresa não autorizada/inexistente recebe a mesma resposta 404.
- `apps/api/src/admin/routes.ts`: criação/edição/desativação/reativação de usuários, troca de senha, criação/renomeação básicas de empresas, consulta/concessão/revogação de acessos. Somente administrador geral altera esses cadastros. Usuários novos começam sem permissões e sem perfil global. Hashes e registros de sessões não são devolvidos. Duplicidades recebem 409 e entradas inválidas 400.
- `apps/api/src/app.ts`: integração da autorização, schemas sem coerção ou descarte de propriedades extras, erros públicos e manutenção da proteção de origem/sessão. Desativação e troca de senha revogam sessões em transação sob lock; reativação não recupera cookie antigo. O administrador não pode ser desativado; promoção/rebaixamento global não é exposto.
- `packages/domain/src/access.ts`: DTOs públicos compartilhados para usuários, empresas e concessões, reutilizando os papéis manager/viewer do domínio.
- `apps/web/src/{Workspace,Administration,api}.tsx/ts`, `App.tsx` e `style.css`: administração com formulários, seletores, atividade, feedback e revogação; seletor de empresas com papel atual, contexto na URL, estados vazios e revalidação por foco/30 segundos/atualização manual. Respostas antigas não substituem uma nova seleção. Desktop em duas colunas e celular em uma, preservando a aparência simples existente.
- `apps/api/test/access.test.ts`: API com PostgreSQL exclusivo e dados sintéticos; script `npm run test:access`. `test/browser-server.ts --stage04`: opção explícita de QA cria apenas o administrador sintético no banco temporário, sem provisionar no startup ou no banco de trabalho.
- README, arquitetura, plano e documentação do banco atualizados. Não houve dependência nova, alteração de lockfile, migração nova ou reset de volume: o esquema 001 já contém todas as tabelas/constraints necessárias.

Criação e renomeação de empresas são administrativas; gerenciamento por empresa autoriza a gestão do parque, cujo CRUD começa na etapa 05. Para provar a escrita permitida/negada sem antecipar essa etapa, o teste registra uma rota **somente no app de teste**, com a política central e UPDATE real de unidade sintética. A consulta inclui company_id autorizado e ID do filho. Essa rota não existe no servidor da aplicação. Exclusão/arquivamento de empresas continua reservado à etapa 05.

### Verificações executadas

| Camada/cenário | Procedimento | Resultado |
|---|---|---|
| Dependências 01 a 03 | Compose, healthcheck, esquema e testes de autenticação | Serviços foram iniciados; três migrações já aplicadas. Administrador e sessão de trabalho existentes preservados. |
| Administração e payloads | Criar usuário/empresas por API; listar/editar; enviar isAdmin extra, papel inválido, nomes vazios, senha curta, UUID inválido e duplicidades | 201/200 nos cadastros válidos; 400/404/409 nos inválidos; nenhum hash/token/sessão interna nos formulários. |
| Sem concessões | Login de usuário ativo sem permissões | Sessão 200, lista vazia; empresa sem acesso 404. |
| Papéis diferentes | Mesmo usuário manager em A e viewer em B, mantendo cookie | Lista/contexto com papel correto em cada empresa. Administrador acessa A/B/C sem concessões individuais. |
| Escrita direta | PATCH real na rota de teste, primeiro em A e depois em B | Gerente grava em A; visualizador recebe 403 em B; linha de B permanece igual. Administrador grava em B. |
| Administração global | Usuário comum tenta listar/criar/editar usuários, criar/renomear empresas e conceder/revogar acessos | Todas as operações administrativas testadas recebem 403. |
| Referências cruzadas | Empresa C sem concessão, UUID inexistente, UUID inválido, filho de B sob contexto A | 404 sem revelar C; inválido 400; filho cruzado 404 e sem gravação. |
| Troca de papel e identidade | Renomear usuário/empresa, repetir upsert, manager → viewer → manager | IDs/concessões preservados, sem duplicação; próxima escrita usa o papel atual com a mesma sessão. |
| Revogação | DELETE via administração; reenviar cookie em leitura/escrita/listagem | Empresa revogada deixa lista e retorna 404; outra empresa e sessão continuam 200. Revogação repetida é idempotente. |
| Desativação/reativação | PATCH isActive false, consultas com cookie antigo, login, nova concessão e posterior reativação | Sessão/parque/lista 401; login inativo 401 e concessão rejeitada; reativar não revive cookie antigo; novo login funciona. |
| Senha e acesso administrativo | Trocar senha com sessão existente; tentar desativar administrador | Sessão anterior 401; senha anterior falha, nova entra; desativação do administrador 409, sessão administrativa preservada. |
| Proteções anteriores | Origin ausente/externa, ausência de sessão e rota sem política | Escritas 403 ou 401 conforme origem/sessão; rota sem política 403. |
| Testes de acesso | `npm run test:access` | **13/13** aprovados (12 cenários + principal), PostgreSQL real e banco removido. |
| Regressão de autenticação | `npm run test:auth` | **15/15** aprovados. |
| Regressão do banco | `npm run test:db` | **35/35** aprovados: instalação/upgrade, preservação, constraints e concorrência. |
| Domínio | `npm run test:domain` | **4/4** aprovados. Total: **67/67**. |
| Typecheck/build | Host Windows e `docker compose exec -T api npm run typecheck` / `npm run build` | Aprovados; inclui os testes tipados. Build Linux final: JS 237,64 kB / 73,39 kB gzip. |
| Imagens/serviços | `npm run dev:all` após remover QA; `docker compose ps`; healthcheck pelo proxy | Imagens pelo lockfile, três serviços saudáveis, API/banco sem portas publicadas. |
| Arquivos | `git diff --check`; estado Git e ignores | Sem erro de whitespace; evidências/credenciais de QA ignoradas. Sem commit, push ou publicação. |

### Validação real no navegador

Playwright CLI conduziu Chromium com **banco exclusivo** `topologia_new_test04_browser_*`, API interna temporária em 3002 e container web temporário com Vite publicado apenas em `127.0.0.1:5174`. Nenhum cadastro sintético foi feito pelo endereço de trabalho. UI/UX Pro Max orientou labels, erros anunciados, feedback, foco e layout responsivo, mantendo a identidade atual.

- Pela tela administrativa foram criadas A, B, C e dois usuários sintéticos. O mesmo usuário recebeu gerenciamento em A e visualização em B; C permaneceu sem concessão. Usuários novos ficam sem empresas até a concessão explícita.
- A sessão do usuário comum mostrou somente A/B, papéis distintos e ausência de Administração. Selecionar A mostrou Gerenciamento; B mostrou Visualização — somente consulta. Recarregar manteve cookie e empresa da URL.
- Uma chamada direta do visualizador a PATCH administrativo retornou 403. Consulta direta de C, mesmo com query string mencionando A, retornou 404. A lista não revelou C.
- Renomear usuário e A pela interface preservou IDs e permissões. Nome atualizado apareceu na consulta da sessão existente e na lista de empresas.
- Revogar A preservou B e a sessão; depois de restabelecer A, revogar B enquanto estava selecionada retornou 404 na próxima chamada. **Atualizar acessos** removeu B do seletor e retirou seu conteúdo, com erro claro. A e sessão permaneceram 200.
- Desativar o usuário pela interface retornou 401 nas consultas seguintes usando a sessão existente. Recarregar voltou a `/login`. Reativação e novo login também foram cobertos nos testes da API.
- Criar empresa duplicada mostrou **Nome ou login já cadastrado.** sem alterar cadastro. Criar outro usuário selecionou sua edição e a área de permissões. Ao entrar sem concessões, a interface mostrou **Você ainda não tem acesso a empresas. Solicite a concessão ao administrador geral.**
- Viewports **1280 × 900** e **390 × 844**: administração e contexto do visualizador conferidos visualmente; sem overflow horizontal; campos de texto, selects e botões com pelo menos 44 px. Rolagem vertical normal e foco visível. Não houve teste em celular físico.
- Console sem exceções da aplicação; 401/403/404/409 são respostas esperadas dos cenários. O favicon ausente já registrado na etapa 03 permanece com 404, sem impedir o fluxo.

Evidências locais em `docs/evidencias/etapa04/`: `testes-acessos.txt`, `testes-autenticacao.txt`, `testes-banco.txt`, `testes-dominio.txt`, `typecheck-host.txt`, `build-host.txt`, `typecheck-linux.txt`, `build-linux.txt`; administração desktop/celular, visualização desktop/celular, revogação e retorno ao login em PNG. Resultados de chamadas diretas, isolamento, revogação, desativação, validação de formulário, criação de usuário, estado sem acessos e layout em `navegador-*.txt`.

### Estado final e operação

O banco de trabalho mantém **1 usuário e 1 sessão existentes**, com **0 empresas e 0 permissões**; todas as tabelas do parque permanecem vazias. Duas janelas de login existentes e três versões de migração estão registradas. Nenhum usuário/empresa sintético foi inserido ali. O banco temporário de QA foi removido, assim como o container temporário e o arquivo de credencial; **zero bancos temporários restantes**. Contagens registradas em `estado-banco.json` (30/09/2026, 19:41:47, America/Sao_Paulo).

Volume `topologia_new_postgres_data` preservado, criação **2026-09-30T17:51:39Z**. Após reconstrução final, permanecem API `topologia_new`, web `topologia_new_web` e banco `topologia_new_db` saudáveis. Evidências: `volume.txt`, `servicos-build.txt` e `verificacao-final.json`. URL de trabalho: [http://localhost:5173](http://localhost:5173).

Conferência após reconstrução, às **19:45:41**: mesmas contagens e nenhum banco temporário (`estado-banco-final.json`). Navegador sem sessão aberto em `http://localhost:5173/parque` voltou a `/login`, com tela pronta para o administrador existente; captura em `login-ambiente-usuario.png`. Healthcheck final HTTP 200, status ok e database up. Os logs typecheck/build do host também foram atualizados com a versão final.

Entre com seu administrador existente, abra **Administração**, crie empresas/usuários e conceda os acessos. Para verificar: `npm run test:access`. Para retomar serviços: `npm run dev:all`; para parar preservando volumes: `npm run dev:stop`. Não é necessário executar migração nova para esta entrega.

Typecheck/build, API/PostgreSQL e navegador local foram validados separadamente. Não houve teste em dispositivo físico ou produção. **Pendências essenciais da etapa 04: nenhuma. Próxima etapa: 05 — Empresas, unidades, andares, plantas e datacenters**, somente mediante nova solicitação.

## Etapa 05 — Organização do parque

**Situação: Concluída em 30/09/2026.** Empresas, unidades, andares, plantas e datacenters disponíveis em [http://localhost:5173](http://localhost:5173), com cadastro contextual, nomes livres, IDs estáveis e exclusões protegidas. Etapa 06 pendente e não iniciada.

### Resultado e arquivos principais

- `apps/api/src/park/routes.ts`: GET/POST/PATCH/DELETE de unidades, andares, plantas e datacenters, coleções/detalhes sob empresa autorizada. A cadeia completa da URL participa das consultas; criação valida o pai e as FKs compostas protegem também a gravação concorrente. `/companies/:companyId/park` retorna um snapshot consistente dos quatro cadastros em um statement SQL.
- `packages/domain/src/park.ts`: DTOs compartilhados de metadados e entradas de nome/classificação, reutilizando entidades existentes. Não expõe geometria nem arquivos. Classificação livre, com sugestões Matriz/Filial/CD na interface; vários datacenters por unidade; planta criada só com nome e geometria vazia padrão.
- `apps/web/src/Park.tsx`, `Workspace.tsx` e `style.css`: listas, formulários de criação/edição, seleção contextual, breadcrumbs, estados vazios, confirmação de exclusão e feedback. Contexto na URL suporta recarga/histórico; trocar o pai limpa filhos selecionados. Cadastros incompatíveis com a URL não aparecem. Revalidação periódica/foco/manual inclui hierarquia e papel. Visualizador consulta sem botões de edição; gerente só opera seu parque autorizado.
- `apps/api/src/admin/routes.ts` e `apps/web/src/Administration.tsx`: completam exclusão de empresas, mantendo criação, renomeação, exclusão e concessões exclusivas do administrador. Gerente não administra cadastros globais.
- `apps/api/src/app.ts`: tratamento de `23001` (RESTRICT) além de `23503` (FK), ambos como conflito público. A exclusão com dependentes não gera erro de serviço nem expõe SQL.
- `apps/api/test/park.test.ts`, scripts `test:park` e opção explícita `test/browser-server.ts --stage05`: API/PostgreSQL e navegador com dados sintéticos em bancos independentes. README, arquitetura, plano e documentação do banco atualizados.

**Política de exclusão:** definitiva e explícita, só sem dependências; sem cascata ou arquivamento. Empresas exigem remoção de cadastros e revogação dos acessos. Unidades com andares/datacenters, andares com plantas, plantas referenciadas por mesas/setores/datacenters/racks e datacenters com racks retornam 409. A operação não remove ou desvincula filhos automaticamente. IDs e filiação não são campos editáveis; renomear ou alterar a classificação da unidade não transfere filhos. O vínculo espacial/posicionamento de datacenters fica para as etapas de layout; metadados de cadastro preservam vínculos/placement já persistidos.

Não houve migração nova, instalação de dependências, alteração de lockfile ou reset. Esquema existente 001/002 e autorização central da etapa 04 cobrem a entrega. Dependências 01 a 04 confirmadas pelos serviços, três migrações aplicadas e testes de regressão atuais.

### Verificações executadas

| Camada | Procedimento | Resultado |
|---|---|---|
| Tipos e build | `npm run typecheck` e `npm run build` no host e dentro da API Linux | Passaram; workspace/API/web/domínio compilados. |
| API e PostgreSQL | `npm run test:park` | 9/9 testes passando, incluindo oito grupos de cenários e o teste principal. CRUD real, Matriz/Filial/CD/livre, vários datacenters, planta sem imagem, duplicidades/limites, IDs estáveis e pais preservados. |
| Acesso e filiação | Chamadas diretas como manager/viewer/admin e referências cruzadas | Gerente autorizado grava; viewer recebe 403; empresa não autorizada e cadeias erradas recebem 404; escalada global e alteração de IDs/pais recusadas. Troca de papel/revogação vale na sessão existente. |
| Dependências | DELETE com unidades/andares/mesas/setores/datacenters/racks/permissões dependentes, depois remoção explícita de folhas | 409 protege pais; 204 nas exclusões válidas; 404 após remover. Filiação cruzada também rejeitada diretamente no PostgreSQL. |
| Concorrência | Quatro corridas de DELETE da unidade contra POST do andar | Nunca houve exclusão do pai e criação bem-sucedida do filho na mesma corrida; zero órfãos. |
| Regressão | `test:access`, `test:auth`, `test:db`, `test:domain` | 13/13, 15/15, 35/35 e 4/4 testes passando, respectivamente. Total com parque: 76 testes. |
| Navegador local | Playwright CLI/Chromium, formulários reais, desktop 1280 × 900 e celular 390 × 844 | Fluxo solicitado realizado; contexto, renomeação, dependência, modo consulta e layout conferidos. Nenhum teste em dispositivo físico ou produção. |

Logs locais em `docs/evidencias/etapa05/testes-*.txt`, `typecheck-{host,linux}.txt` e `build-{host,linux}.txt`. As evidências de tipos/build não substituem os testes de banco nem a conferência do navegador.

### Validação real no navegador

Ambiente opcional exclusivo: banco `topologia_new_test05_browser_37d1d77cbf23`, API interna temporária em 3002 e web temporária em `127.0.0.1:5174`, sem carga automática no banco de trabalho. Administrador sintético provisionado só por `--stage05` explícito.

- Pela tela administrativa, criados empresa e usuário sintéticos; concedido gerenciamento. Após entrar com esse gerente, Administração estava ausente. A hierarquia foi cadastrada pelos formulários, sem inserir suas entidades via API ou SQL: **Matriz QA** e **Filial QA**, classificações Matriz/Filial, **Térreo Matriz** e **Térreo Filial**, **Planta Matriz 01** e **Planta Filial 01**, **Datacenter 01** e **Datacenter 02** na matriz.
- Estados vazios de unidades, andares, plantas e datacenters observados antes de seus cadastros. As duas plantas foram salvas só com nome; nenhum arquivo ou imagem exigido. Abrir filial não exibiu andares/datacenters da matriz.
- Selecionar planta e recarregar manteve empresa/unidade/andar/planta. Abrir Datacenter 02 limpou o contexto de andar/planta e a recarga manteve unidade/datacenter. Breadcrumbs e seleção das listas indicaram os pais corretos.
- Renomear a planta da filial para **Planta Filial 01 revisada** manteve o mesmo UUID na URL e no PostgreSQL. API também verificou preservação de IDs, created_at, pais e geometria para todos os recursos e empresa.
- Excluir a filial com andar/planta mostrou confirmação e depois o conflito **Não é possível excluir: este cadastro possui dependências. Remova ou desvincule os dependentes primeiro.** Os registros permaneceram consultáveis.
- Papel alterado para viewer somente no banco de QA, sem trocar a sessão. Recarregar apresentou **Visualização — somente consulta**, com zero botões de criação/edição/exclusão. PATCHs diretos do navegador para unidade, andar, planta, datacenter e empresa responderam 403. A alteração de permissões via API administrativa foi validada separadamente pelos testes.
- Capturas desktop/celular inspecionadas visualmente. No viewport de 390 px, scrollWidth também 390, sem overflow e sem controles menores que 44 px. Botões contextuais compactados após a primeira conferência; `matriz-celular.png` e `visualizador-celular.png` registram o resultado final. Console final sem exceções JavaScript da aplicação; os 403/409 são cenários esperados. 401 sem sessão e favicon 404 já existentes também apareceram na entrada inicial.

Evidências: `navegador-{matriz,filial-recarga,datacenter-recarga,exclusao-protegida,visualizador,visualizador-api}.txt`, `cadastros-qa.txt`, `ids-qa.txt`, `layout-celular-final.txt`, `console.txt`; `matriz-{desktop,celular}.png`, `filial-desktop.png` e `visualizador-{desktop,celular}.png`.

### Estado final e operação

O banco de trabalho foi conferido antes/depois: **2 usuários, 3 sessões, 1 empresa e 1 concessão existentes**, com **0 unidades, andares, plantas e datacenters**. Essas contagens atuais diferem do registro histórico da etapa 04; nenhum cadastro sintético foi criado no banco de trabalho nesta etapa. Os arquivos `banco-trabalho-{antes,depois}.txt` são iguais. Volume PostgreSQL original preservado, criação `2026-09-30T17:51:39Z`; três versões no histórico de migrações. Banco/container temporários de QA e arquivo de credencial removidos; zero bancos de teste restantes.

Permanecem API `topologia_new`, web `topologia_new_web` e banco `topologia_new_db` saudáveis. Interface em [http://localhost:5173](http://localhost:5173); API/banco sem portas publicadas. Healthcheck final HTTP 200, status ok e database up às 20:19:52 (America/Sao_Paulo), em `health-final.json`. Navegador sem sessão abriu `/parque` do ambiente de trabalho e retornou ao login, com captura em `login-ambiente-usuario.png`. Nenhum commit, push ou publicação realizado.

Para validar com seus dados, entre com o administrador existente, crie/conceda acesso à empresa em **Administração**, selecione-a em **Empresas autorizadas** e cadastre unidades → andares → plantas; datacenters ficam na unidade. Use uma conta gerente autorizada ou o administrador. Recarregue para conferir o contexto. `npm run test:park` repete as verificações da API em dados isolados. Retomar: `npm run dev:all`; parar preservando volumes: `npm run dev:stop`.

**Pendências essenciais da etapa 05: nenhuma. Próxima etapa: 06 — Mesas e pontos, pendente e não iniciada.**

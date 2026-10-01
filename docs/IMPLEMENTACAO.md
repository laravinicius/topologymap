# Arquitetura e plano de implementação

Status: etapas 01 a 10 implementadas e validadas localmente; demais funcionalidades continuam como proposta técnica. Atualizado em 01/10/2026. Evidências em [PROGRESSO.md](PROGRESSO.md).

Os requisitos confirmados e os detalhes propostos estão separados em [ESCOPO.md](ESCOPO.md).

A sequência detalhada, os critérios de cada entrega e as solicitações copiáveis para o agente estão em [PLANO_DESENVOLVIMENTO.md](PLANO_DESENVOLVIMENTO.md). Este documento mantém a referência de arquitetura.

## 1. Tecnologias propostas

| Camada | Tecnologia | Motivo |
|---|---|---|
| Interface | React + TypeScript + Vite | Interface interativa no navegador e contratos tipados. |
| Planta 2D | Konva + react-konva | Primitivas de desenho, seleção, arraste e transformações integradas ao React. |
| Racks e detalhes | HTML/React | Portas e controles acessíveis e adaptação para celular. |
| API | Node.js + Fastify + TypeScript | API modular com validação das entradas e autorização centralizada. |
| Banco | PostgreSQL | Relações, transações e restrições para proteger conexões e posições em U. |
| PDF de fundo | PDF.js | Escolha e renderização de página no navegador. |
| QR Code | Biblioteca local de geração | Gerar etiquetas sem enviar dados de clientes a serviços externos. |
| Desenvolvimento e produção | Docker Compose | Serviços e volumes identificados para este projeto. |

As versões compatíveis serão fixadas no lockfile durante a implementação. A versão principal do react-konva deverá corresponder à do React.

Na etapa 01 foram fixados React/React DOM 19.3.0, TypeScript 7.0.2, Vite 8.3.1, plugin React do Vite 6.1.1, Fastify 5.12.5, node-postgres 8.23.1 e tsx 4.23.15. `package-lock.json` registra a resolução completa. Imagens de desenvolvimento: `node:24-bookworm-slim` e `postgres:18-bookworm`; o runtime observado foi Node.js 24.21.0, npm 11.19.0 e PostgreSQL 18.6. As tags das imagens permitem atualizações dentro dessas versões principais; builds posteriores podem obter patches mais recentes. Konva/react-konva, PDF.js e QR Code não foram instalados nesta etapa.

Consultas às fontes oficiais:

- [Konva com React](https://konvajs.org/docs/react/index.html)
- [Fastify com TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/)
- [Restrições do PostgreSQL](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PDF.js](https://mozilla.github.io/pdf.js/getting_started/)
- [Modelo de aplicações do Docker Compose](https://docs.docker.com/compose/intro/compose-application-model/)

Ambiente do host verificado nesta máquina: Node.js 24.19.0, npm 11.17.0, Docker 29.7.2 e Docker Compose v5.4.0. O daemon Docker respondeu à consulta. Na verificação inicial da documentação ainda não havia containers do projeto; ao concluir a etapa 01, os três containers estão em execução e saudáveis.

## 2. Estrutura prevista

```text
apps/
  api/                  # autenticação, autorização, cadastros e conexões
  web/                  # editor e visualizações autenticadas/públicas
packages/
  domain/               # contratos e geometria independente do renderizador
database/
  migrations/           # esquema e evolução do banco
docs/
  ESCOPO.md
  IMPLEMENTACAO.md
compose.yaml            # desenvolvimento
compose.production.yaml # produção
.env.example            # configuração sem credenciais reais
```

Começar com um monorepo simples. Não há necessidade inicial de microsserviços, Redis ou edição colaborativa em tempo real.

## 3. Modelo e integridade

Entidades: usuário, empresa, permissão por empresa, unidade, andar, planta, setor, mesa, ponto, datacenter, rack, equipamento, porta e conexão.

Toda operação autenticada verifica a empresa de cada objeto envolvido e a permissão do usuário. Relações entre objetos devem preservar a mesma empresa. Usar IDs internos estáveis, não caminhos formados por nomes.

A tabela de conexões terá unicidade independente para `point_id` e `port_id`. Vincular, desvincular ou transferir deverá ocorrer em transação. Uma colisão entre dois gerentes será devolvida como conflito, sem sobrescrever a alteração do outro.

As posições em U utilizarão intervalos. A integridade contra sobreposição deverá ser protegida no banco (restrição de exclusão por rack e intervalo, ou ocupação única por U em tabela normalizada), além da validação na interface. Não usar apenas uma consulta prévia sem proteção contra concorrência.

Nomes de pontos serão únicos dentro da mesa; nomes de portas dentro do equipamento; nomes de patch panels dentro do rack. Definir unicidade dos demais nomes dentro do respectivo pai, preservando a grafia informada.

Alterações destrutivas precisam indicar dependências. Não eliminar conexões implicitamente ao reduzir pontos, portas ou capacidade do rack.

**Implementado na etapa 02:** contratos em `packages/domain`, migrações `001_access_hierarchy.sql` e `002_racks_connections.sql` e ferramenta transacional em `apps/api/src/database`. UUIDs, nomes exatos únicos no pai (collation C), FKs compostas com empresa e, onde necessário, unidade/planta, dependências RESTRICT e discriminação de portas exclusiva de patch panels. Quantidades de pontos/portas derivam dos registros, com ordinal positivo único no pai.

Ocupação em U usa `int8range` gerado e exclusão GiST (`btree_gist`). A capacidade é protegida por testemunho interno `equipment.rack_capacity_u`, FK para a capacidade real do rack com ON UPDATE CASCADE e CHECK de limites na mesma linha. Essa escolha acrescenta redundância controlada para garantir redução/instalação/movimentação concorrentes de forma declarativa, inclusive diante de snapshots antigos. Não se usa CHECK que consulta outro registro nem validação baseada somente em leitura prévia. Contratos e exemplo de escrita estão em [database/README.md](../database/README.md).

Usuários, sessões e permissões receberam estrutura na etapa 02. A autenticação central e o provisionamento explícito foram implementados na etapa 03; administração e autorização por empresa foram implementadas na etapa 04. A tabela única de conexões tem FKs, unicidades e revisão automática; operações transacionais de associação/desvinculação/transferência e consulta nos dois sentidos foram entregues na etapa 08.

### Cadastros do parque — etapa 05

API em `apps/api/src/park/routes.ts`: coleções/detalhes de unidades, andares, plantas e datacenters com GET/POST/PATCH/DELETE, sob a política central de empresa. Toda consulta/gravação filtra empresa e a cadeia completa da URL; POST valida o pai e as FKs compostas protegem a filiação também sob concorrência. PATCH aceita somente nome e, para unidades, classificação livre; IDs e pais não são editáveis. Novas plantas usam a geometria vazia padrão do banco, sem imagem. Não foi necessária migração: 001/002 já cobrem a entrega.

`GET /api/companies/:companyId/park` passou de placeholder a snapshot de metadados, com as quatro coleções em um statement SQL para consistência de leitura. Contratos públicos em `packages/domain/src/park.ts` compartilham entidades do domínio sem retornar geometria/arquivos. O vínculo espacial de datacenters e posicionamento continuam nas etapas de layout; editar seus nomes não altera plan_id/placement existentes.

`apps/web/src/Park.tsx` entrega listas, formulários contextuais, sugestões Matriz/Filial/CD com identificação livre, estados vazios, confirmação de exclusão e feedback. Breadcrumbs e seleção na URL suportam recarga e histórico; a seleção de outro pai limpa seus filhos, e IDs incompatíveis não exibem conteúdo de outro contexto. `Workspace.tsx` revalida cadastros e papel no mesmo fluxo de foco/30 segundos/atualização manual. `Administration.tsx` mantém empresas e acessos globais exclusivos do administrador e acrescenta exclusão de empresas.

**Política adotada:** exclusão definitiva somente sem dependências, sem arquivamento ou cascata. Excluir empresas exige perfil global, cadastros vazios e concessões revogadas; demais exclusões exigem gerente autorizado ou administrador. O banco impede remover pais referenciados, inclusive plantas com mesas/setores/datacenters/racks e datacenters com racks. A interface confirma a intenção; a API traduz dependências em HTTP 409, sem limpar filhos/vínculos automaticamente. Filiação não é transferida nesta etapa. PostgreSQL desta máquina devolveu `23001` nas exclusões RESTRICT; o tratamento contempla esse código e `23503`, conforme os [SQLSTATE oficiais](https://www.postgresql.org/docs/current/errcodes-appendix.html).

`npm run test:park` usa PostgreSQL isolado para CRUD, grafia/IDs/pais, papéis, entradas inválidas, cadeias cruzadas, dependências e criação de filho concorrente à exclusão do pai. Testes anteriores continuam passando. Fluxo de formulário em Chromium desktop/celular validado com empresa, matriz/filial, seus andares/plantas e dois datacenters na matriz; evidências no progresso.

### Conexões — etapa 08

`apps/api/src/connections/routes.ts`: GET pelas extremidades/ID, associação com INSERT simples, transferência explícita por POST e DELETE com estado esperado obrigatório. Empresa/papel usam a política central; destino precisa conter ponto e porta de patch panel da mesma empresa, sem restringir andar/unidade. Transações e unicidades/FKs da migração 002 protegem as alterações. UPDATE/DELETE condicionam empresa, ID, revisão e as duas extremidades esperadas, reavaliadas após uma escrita concorrente. Sem upsert ou remoção implícita de vínculos ocupados; conflito reverte a operação inteira. Transferir preserva ID e incrementa revisão pelo trigger existente. Não foi necessária migração.

`connections/query.ts` monta em um statement o DTO e o caminho pelos nomes/IDs atuais. Leituras pelas extremidades distinguem entidade inexistente (404) de entidade livre (connection null). `packages/domain/src/connections.ts` compartilha estados esperados/caminho; detalhes de mesa e equipamento preservam connectionId e acrescentam connection. `apps/web/src/ConnectionPath.tsx` mostra o caminho nas listas existentes, revalidado por foco/30 segundos/Atualizar acessos. O formulário pela mesa foi entregue na etapa 09; associação pela porta segue na etapa 10. Contrato completo, códigos e procedimento de conflito em [CONEXOES.md](CONEXOES.md).

`test/connections.test.ts` usa PostgreSQL isolado e locks de um terceiro cliente para garantir requisições simultâneas em voo, verificadas em pg_stat_activity. Cobre associação por ponto/porta, transferência por estado e por destino, remoção concorrente, rollback, andares distintos, renomeações, isolamento/FKs e autorização atual. QA opcional de navegador `browser-server.ts --stage08` segue o padrão de banco temporário, nunca o banco de trabalho.

### Associação pela mesa — etapa 09

`Desks.tsx` oferece Associar nos pontos livres e Transferir/Desvincular nos associados. `DeskConnectionEditor.tsx` seleciona datacenter, rack, patch panel e porta pelas coleções existentes da empresa. Datacenters de todas as unidades são identificados pela unidade e nome; equipamentos genéricos são excluídos. Portas mostram Livre/Ocupada e, nas ocupadas, mesa/ponto de origem; destinos ocupados ficam desabilitados. Contagens e resumo do destino são textuais. Nenhuma nova relação, rota de escrita, dependência ou migração foi necessária.

Transferir/desvincular exigem revisão explícita e confirmação, preservando o ID, revisão e extremidades da leitura que abriu a ação. Mudanças detectadas na revalidação bloqueiam a ação antiga, sem atualizar seu estado esperado silenciosamente. HTTP 409 cancela a confirmação, relê o ponto, a porta anterior e o destino tentado, atualiza mesa/cadastros/ocupação e exige fechar e abrir uma nova ação. Falha de rede também exige revisão porque a resposta pode ter se perdido após o commit. Escritas bem-sucedidas revalidam as extremidades e consumidores existentes; outras sessões recebem a informação pelo foco, intervalo de 30 segundos ou atualização manual, sem WebSocket.

Os pedidos assíncronos de destinos usam geração para descartar respostas antigas; trocar um pai limpa seus filhos. Controles ficam bloqueados durante carregamento/gravação, há proteção contra submissão repetida e feedback acessível de sucesso/erro. Visualizador não recebe controles nem editor; perda do papel fecha a edição ao revalidar, e a política central da API exige autorização atual para cada escrita. QA local isolado `browser-server.ts --stage09` aceita `QA_ORIGIN` para uma porta alternativa. Oito pontos, duas associações distintas, consultas inversas, cancelamentos, conflitos entre sessões, erro de rede, rebaixamento de papel e viewport 390 × 844 verificados no navegador; detalhes em [PROGRESSO.md](PROGRESSO.md#etapa-09--associação-pela-mesa).

## 4. Geometria e editor

O domínio armazenará IDs, posições e dimensões no sistema de coordenadas da planta. Pixels, zoom e deslocamento da câmera pertencem ao renderizador.

**Contrato implementado na etapa 02:** versão 1 em metros, X à direita/Y para baixo, retângulos ancorados no centro, dimensões positivas e rotação horária em graus [0, 360). Paredes/aberturas estruturadas, setores como polígonos e fundo com metadados do arquivo separados da transformação em metros. Validadores no domínio e CHECKs JSONB no PostgreSQL. Detalhes em [GEOMETRIA.md](GEOMETRIA.md). Nenhum renderizador foi instalado nesta etapa; persistência com revisão esperada e edição continuam nas etapas previstas.

Geometria de paredes e aberturas deve ser estruturada. Portas e janelas podem referenciar a parede e a posição dentro dela. Setores usam polígonos; mesas e marcadores de rack usam transformação e dimensões. A posição gráfica não substitui a filiação no cadastro.

Importar a planta cria um fundo. Para PDF, selecionar e renderizar uma página, mantendo o original e a imagem gerada em armazenamento do projeto. Registrar o alinhamento e a escala do fundo separadamente dos objetos.

Salvar o layout com número de revisão. Se outra sessão já alterou a revisão, exigir atualização/reconciliação antes de gravar. Indicar alterações pendentes e oferecer desfazer/refazer do layout. Os vínculos de cabeamento usam as operações transacionais da API, separadamente do histórico local de desenho.

## 5. Autenticação e publicação da mesa

**Implementado na etapa 03:** sessões PostgreSQL com duração fixa de 8 horas, token aleatório de 256 bits e somente SHA-256 do token persistido. Cookie HttpOnly/SameSite Strict/Path=/, sem Domain; em produção, Secure e prefixo `__Host-`. `APP_ORIGINS` contém origens exatas; `NODE_ENV=production` exige origens HTTPS. Todas as escritas passam pela verificação de Origin e Fetch Metadata antes da autenticação ou validação do corpo. Não há CORS permissivo. Login/logout são as únicas escritas públicas; todas as outras rotas da API exigem sessão por padrão, exceto o GET/HEAD de healthcheck.

`apps/api/src/app.ts` centraliza o hook de autenticação, consulta da atividade do usuário e erros públicos sem dados internos. Login revalida atividade/hash sob lock antes de criar sessão; novo login revoga o token anterior recebido pelo mesmo navegador. Logout é idempotente, revoga no banco e limpa o cookie mesmo se já expirado. Contratos públicos em `packages/domain/src/auth.ts`; UI em `/login` e `/parque`, com consulta ao carregar/foco/a cada 30 segundos, timer de expiração e proteção contra respostas antigas durante login/logout. Nenhum token é armazenado no localStorage. Na etapa 04, a entrada foi integrada ao seletor de empresas autorizadas e à administração em `/administracao`.

**Implementado na etapa 04:** `apps/api/src/auth/authorization.ts` declara políticas `session`, `admin` e `company` e aplica um hook central `preHandler`, depois da validação de schema. Rotas sem política são recusadas; exceções públicas são restritas a método/rota de saúde e autenticação existentes. Em acesso por empresa, a consulta junta usuário ativo, empresa e concessão atual; não armazena papel na sessão. GET/HEAD consultam manager/viewer, métodos de escrita rejeitam viewer, e administrador tem acesso a todas as empresas. `request.company` carrega o contexto autorizado, usado nas consultas; filhos precisam ser consultados com o mesmo company_id, nunca só pelo ID fornecido. Referência inexistente e empresa sem acesso retornam a mesma mensagem/404. Contrato de hooks conferido na [documentação oficial do Fastify](https://fastify.dev/docs/latest/Reference/Routes/).

`apps/api/src/admin/routes.ts` implementa usuários (criação, edição, atividade e senha), empresa básica (criação/renomeação) e concessão por usuário/empresa (upsert ou revogação). Apenas administrador geral opera essas rotas. Novos usuários não são administradores; campo isAdmin é recusado no corpo e não há promoção/rebaixamento global pela tela. Desativação do administrador é recusada para preservar o acesso administrativo. Desativação de usuário e troca de senha revogam suas sessões na mesma transação sob lock do usuário; reativar não recupera os cookies antigos. Concessão exige usuário ativo sem perfil global. Nomes preservam grafia e IDs; duplicidade resulta em 409. Não se excluem usuários/empresas nesta etapa. A etapa 05 definiu a política de exclusão do parque, descrita abaixo.

Os DTOs públicos estão em `packages/domain/src/access.ts`, sem hashes ou registros de sessões. Schemas recusam propriedades extras e coerção de tipos para impedir alterações de privilégios por mass assignment. O esquema da migração 001 já cobre a entrega; nenhuma migração ou reset foi necessário. Teste de escrita com `access: 'company'` utiliza uma rota registrada somente no app de teste e um UPDATE real em unidades sintéticas. Não se publica uma rota fictícia de escrita nem se antecipa o CRUD da etapa 05.

`apps/web/src/Workspace.tsx` mostra somente empresas permitidas, papel atual, seleção na URL e estados vazios. Revalida ao carregar, mudar de empresa, foco, 30 segundos ou atualização manual; respostas antigas não substituem seleção nova. Uma revogação retira o conteúdo e a opção do seletor na próxima atualização; a API já bloqueia a próxima requisição. `Administration.tsx` oferece formulários com labels, limites, feedback anunciado, listas/seletores e revogação explícita. Layout usa duas colunas no desktop e uma no celular; identidade Microgate permanece na etapa 18.

Senhas usam scrypt nativo assíncrono do Node 24 (`N=2^17, r=8, p=1`, salt aleatório de 16 bytes, chave de 32 bytes e timingSafeEqual). A escolha evita dependências nativas adicionais e usa os parâmetros recomendados para scrypt pela [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Foram conferidos os contratos de [node:crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html), [hooks Fastify](https://fastify.dev/docs/latest/Reference/Hooks/) e [@fastify/cookie](https://github.com/fastify/fastify-cookie); a única dependência externa nova é `@fastify/cookie` 11.1.2, compatível com Fastify 5 e fixa no lockfile.

Migração aditiva `003_login_limits.sql`: janelas persistidas de 15 minutos, 5 tentativas/login e 20/IP, incluindo sucesso; chaves SHA-256, upsert atômico, contagem saturada e Retry-After. Janelas vencidas são reutilizadas e removidas no login bem-sucedido. Limites sobrevivem ao reinício da API; não há Redis. Até duas verificações de senha simultâneas por processo limitam a memória do scrypt. O proxy Vite local compartilha seu IP entre navegadores; trustProxy permanece false. A configuração dos proxies confiáveis de produção pertence à publicação, sem aceitar X-Forwarded-For arbitrário nesta etapa.

`npm run admin:create` provisiona o primeiro administrador por terminal interativo, com senha oculta e confirmação, sem argumentos/env de credencial. Advisory lock transacional serializa bootstrap concorrente. Administrador existente, inclusive inativo, ou login já cadastrado impede a criação e preserva dados/senha. Não há conta padrão, seed ou bootstrap no startup; procedimento em [README](../README.md#criar-seu-primeiro-administrador). A administração posterior de usuários e permissões, implementada na etapa 04, é exclusiva do administrador geral.

A consulta pública terá endpoint e resposta próprios. O identificador do QR Code não será um ID sequencial da mesa. A resposta pública trará apenas os campos definidos no escopo, sem reutilizar o payload interno completo. Permitir desativar e renovar o endereço.

Arquivos privados da planta passam pelo controle de acesso. Um QR público de mesa não concede acesso aos arquivos da planta nem à listagem de equipamentos.

## 6. Interface e uso no celular

No computador: seletor de empresa/unidade/andar, área principal da planta ou rack, ferramentas contextuais e painel de detalhes. O mesmo objeto pode ser encontrado por busca e por lista.

No celular: navegação compacta, planta com movimentação e zoom por toque, detalhes em painel próprio e portas disponíveis também como lista. Todos os controles de consulta devem funcionar sem hover. A política de edição continua aplicada por perfil na API; a interface concentra as ferramentas de edição no computador.

Usar estados textuais para porta livre/ocupada e ponto não associado; cores complementam a informação. Manter foco visível, controles com rótulos, contraste adequado e alternativa ao arraste.

A consulta à skill UI/UX Pro Max produziu sugestões gerais de minimalismo para aplicações empresariais e uma orientação específica sobre alternativas ao arraste. As sugestões de landing page, paleta comercial e fontes não serão adotadas automaticamente. A referência visual definida pelo usuário, Microgate, prevalece. Não foi gerado um design system definitivo nesta etapa.

## 7. Docker e persistência

Desenvolvimento implementado na etapa 01:

- Projeto Compose: `topologia_new`.
- API: container `topologia_new`.
- Interface Vite: container `topologia_new_web`.
- PostgreSQL: container `topologia_new_db`.
- Volumes exclusivos para banco e arquivos de planta.
- Porta da interface vinculada ao localhost; banco e API acessíveis pela rede interna dos serviços.
- Proxy da interface para o hostname do serviço da API, não para o localhost do container.
- Porta do host `127.0.0.1:5173`, escolhida após teste de bind TCP; configurável por `WEB_PORT` no `.env`.

O proxy Vite encaminha `/api` para `http://api:3001`. `GET /api/health` consulta o PostgreSQL com `SELECT 1` e retorna HTTP 200 (`status: ok`, `database: up`) ou HTTP 503 (`status: degraded`, `database: down`). O Compose aguarda healthchecks antes de iniciar os serviços dependentes.

Volumes: `topologia_new_postgres_data` em `/var/lib/postgresql` (layout oficial do PostgreSQL 18), `topologia_new_plant_files` em `/data/files` na API e `topologia_new_node_modules` compartilhado por API/web. O diretório dos arquivos é preparado, sem upload, importação ou endpoint de download nesta etapa. Após a etapa 02, o banco contém o esquema e duas versões no histórico, com zero registros nas 15 tabelas de domínio; não há provisionamento automático de administrador.

Bind mounts e polling permitem HMR do Vite e reinício da API por `tsx watch` no Docker Desktop/Windows. As dependências são instaladas por `npm ci` nas imagens e ficam em volume Linux. Alterações de dependências em volumes existentes exigem sincronização explícita, documentada no README; reconstruir a imagem sozinho não atualiza esse volume.

Comandos para subir, acompanhar logs, parar e reiniciar estão no [README](../README.md). `npm run dev:all` sobe o Compose com build e espera pelos healthchecks; `npm run dev:logs` acompanha logs; `npm run dev:stop` usa `docker compose down` sem remover volumes. A preservação do banco e dos arquivos após esse ciclo foi validada com marcadores temporários, removidos ao terminar o teste.

Em produção, a API poderá servir o build da interface, com acesso pelo proxy HTTPS do servidor. Não expor o banco na Internet. Configurar origem pública para que as etiquetas apontem ao domínio correto.

Migrações deverão funcionar em volumes existentes. Documentar backup e restauração do banco e dos arquivos antes da publicação.

Ferramenta da etapa 02: `npm run db:migrate` / `npm run db:status`, execução explícita, transação por arquivo, SHA-256 e advisory lock de sessão. Migrações aplicadas no volume inicializado da etapa 01 e em bancos novos/atualizados de teste; sem reset. Dockerfile da API inclui os SQLs. Testes sintéticos criam/removem bancos próprios, preservando o banco de trabalho e serviços de outros projetos.

### Mesas e pontos — etapa 06

Contratos e limites compartilhados em `packages/domain/src/desks.ts`, API em `apps/api/src/desks/routes.ts` e interface em `apps/web/src/Desks.tsx`, integrada à planta. Rotas aninhadas na cadeia empresa/unidade/andar/planta/mesa; autorização central aplicada também a pontos. Criação e alteração de quantidade usam transação, e as alterações de uma mesa serializam no registro de `desks` com `FOR UPDATE`. Na redução, os pontos são bloqueados antes de consultar/remover, e as FKs RESTRICT protegem também a corrida com novas conexões. GET detalhe usa snapshot REPEATABLE READ de mesa/pontos; lista conta registros reais. Não foi necessária migração.

Quantidade de 0 a 512, nomes de 1 a 200 caracteres sem normalização, coordenadas X/Y de -1000000 a 1000000 m, dimensões positivas até 10000 m, rotação [0,360). São limites técnicos de entrada, definidos nesta entrega. A sequência interna segue o maior ordinal existente, sem examinar números nos nomes; nomes sugeridos ocupados são pulados. Pontos existentes nunca são recriados durante ampliação. Alterar quantidade exige `expectedPointIds` na ordem atual, recusando alterações concorrentes/desatualizadas. Redução elimina somente os últimos pontos, após confirmação na interface e somente sem conexão. Excluir mesa exige ausência de pontos; não há cascata, desvinculação implícita ou arquivamento. Renomear/mover/girar mantém IDs, filiação, created_at e conexões.

Lista e detalhe mantêm a mesa na URL (`mesa=UUID`), revalidam junto com o parque e limpam a seleção ao trocar um pai. Visualizadores consultam sem controles de escrita. Geometria permanece no contrato `Rectangle`, em metros e com centro como âncora; não implementa editor ou revisão de layout nesta etapa. Detalhe retorna `connectionId` e apresenta Associado/Não associado; consulta/edição de conexões e composição do destino foram entregues nas etapas 08/09. Testes em PostgreSQL separado e navegador real registrados no progresso.

Referências consultadas para validação e locks: [Fastify — Validation and Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) e [PostgreSQL — Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html).

### Racks, equipamentos e portas — etapa 07

Contratos/limites em `packages/domain/src/racks.ts`, rotas em `apps/api/src/racks/routes.ts`, listas/formulários em `apps/web/src/Racks.tsx`, integrados ao datacenter em `Park.tsx`. A cadeia empresa/unidade/datacenter/rack/equipamento/porta é validada na API, com autorização central e consulta por empresa e pai. Rack/equipamento selecionados ficam na URL; trocar um pai limpa seus filhos. Revalidação acompanha o snapshot do parque. Visualizadores consultam listas e estados Livre/Ocupada sem controles de escrita. A frente gráfica foi entregue na etapa 10.

Capacidade, U inicial e altura: inteiros de 1 a 1000; quantidade de portas: inteiro de 1 a 512, somente para patch panels. Nomes/tipo: 1 a 200 caracteres com pelo menos um não branco, preservando grafia. Equipamentos genéricos não têm portas. `kind`, IDs, pais e ordinais não são editáveis. Alterar posição/altura/nome/tipo mantém equipamento, portas e conexões. Contagens derivam dos registros; a sequência usa ordinais e pula nomes sugeridos já ocupados. Ampliação só acrescenta portas. Mudança de quantidade exige `expectedPortIds` na ordem atual; tela desatualizada recebe 409. Redução remove as últimas portas livres, mediante confirmação na interface. Conexão em qualquer porta removida desfaz a operação inteira, incluindo outros campos.

Toda escrita de filho bloqueia primeiro o rack e depois equipamento/portas, serializando com alteração da capacidade. As validações de capacidade e sobreposição da API retornam 409 compreensível; a migração 002 continua protegendo escritores externos com `equipment_no_overlap` (EXCLUDE GiST sobre intervalo de U), `equipment_capacity_check` e FK de capacidade com ON UPDATE CASCADE. RESTRICT protege corridas entre remoção e nova conexão/filho. Não houve alteração do esquema ou reset. Criação de equipamento e lote de portas é transacional; detalhe usa snapshot REPEATABLE READ.

Exclusão permanece explícita e sem cascata: porta exige ausência de conexão; equipamento exige ausência de portas; rack exige ausência de equipamentos. É possível remover individualmente todas as portas livres para excluir um patch panel, ou gerar novamente um lote positivo. Reduzir rack só é permitido se todos os equipamentos couberem. Não há desvinculação automática nem conversão entre genérico e patch panel.

`npm run test:racks`: PostgreSQL exclusivo, incluindo 24/48/512 portas, múltiplas U, rollback de lote, IDs/grafia, dependências, papéis/cadeias cruzadas e concorrência na API e SQL direto. Testes anteriores mantidos; pequeno ajuste no teste da etapa 06 removeu um ramo inacessível após `assert.equal` para o typecheck atual. Referências conferidas: [PostgreSQL — Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) e [Fastify — Validation and Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/). Evidências de navegador e operação no progresso.

### Rack frontal 2D e associação pela porta — etapa 10

`apps/web/src/RackFront.tsx` desenha o rack como U empilhadas de baixo para cima, com dimensões proporcionais, equipamentos genéricos e portas numeradas nos patch panels. `RackPortEditor.tsx` consulta o caminho da porta e permite ao gerente associar um ponto livre, transferir o vínculo dessa porta para outro ponto livre ou desvincular, com confirmação e estado esperado. A consulta `GET /companies/:companyId/points` identifica os pontos livres pelo nome da mesa e planta. Os mesmos vínculos aparecem na lista equivalente de portas e na mesa; não existe armazenamento paralelo.

Equipamentos podem ser movidos por arraste até uma U, por botões de uma U ou pelos campos de U inicial/altura do formulário. Todas as mudanças usam `PATCH` existente; conflitos 409 preservam o cadastro e as conexões. A consulta de rack retorna seus equipamentos com portas e conexões para compor a frente em uma leitura consistente. Nenhuma migração ou dependência de imagem foi necessária. `browser-server.ts --stage10` cria QA isolado sob solicitação explícita.

## 8. Etapas e entregas

- [x] **Base local (etapa 01):** workspace, dependências, Compose, banco persistente, healthcheck e comandos de operação.
- [x] **Domínio e migrações (etapa 02):** contratos, esquema e migrações versionadas, sem reset dos volumes; restrições concorrentes validadas em PostgreSQL real.
- [x] **Autenticação (etapa 03):** primeiro administrador explícito, login/logout, sessões persistidas, expiração, proteção de origem e limites; API/banco e navegador local validados em dados sintéticos separados.
- [x] **Usuários e permissões (etapa 04):** administração global, empresa básica, acessos por empresa, autorização central e seletor; API/PostgreSQL e navegador desktop/celular validados com dados sintéticos isolados.
- [x] **Organização do parque (etapa 05):** empresas, unidades, andares, plantas e datacenters; contexto na URL, estados vazios, IDs estáveis e exclusão protegida; API/PostgreSQL e formulários em navegador desktop/celular validados em banco exclusivo.
- [x] **Mesas e pontos (etapa 06):** cadastro/lista/detalhe, lote transacional, nomes editáveis, geometria do domínio, ampliação preservando IDs e redução/exclusão protegidas; API/PostgreSQL e navegador em banco separado.
- [x] **Racks, equipamentos e portas (etapa 07):** listas/formulários, capacidade e ocupação em U, genéricos e patch panels, portas em lote, IDs estáveis, reduções/exclusões protegidas e conflitos concorrentes; API/PostgreSQL e navegador em banco separado.
- [x] **API de conexões (etapa 08):** consulta por ponto/porta/ID, caminho atual, associação, transferência/desvinculação com estado esperado e concorrência real; relação única, autorização e isolamento; consumidores existentes atualizados e validados em navegador isolado.
- [x] **Associação pela mesa (etapa 09):** seleção de destinos pelos nomes, portas livres/ocupadas, confirmação de transferência/desvinculação, revalidação das extremidades e aviso de conflitos; visualizador somente consulta; oito pontos e duas associações distintas validados no navegador.
- [x] **Rack frontal 2D e associação pela porta (etapa 10):** U numeradas, equipamentos/portas selecionáveis, lista equivalente, associação/transferência/desvinculação pela porta e posição por arraste, botões e campos; persistência e vínculo inverso validados.
- [ ] **Cadastros e conexões:** hierarquia completa, criação em lote de pontos/portas, vínculo único e edição pelas duas extremidades.
- [ ] **Rack 2D:** capacidade em U, equipamentos genéricos, patch panels, seleção de portas e proteção contra sobreposição.
- [ ] **Planta 2D:** desenho, setores, importação de fundos, escala, posicionamento, transformações e salvamento com revisão.
- [ ] **Consulta e QR:** visualizador completo no celular, busca, lista equivalente e página pública restrita à mesa; geração de etiquetas.
- [ ] **Validação e identidade:** fluxo manual completo, testes de acesso e integridade, persistência após reinício e verificação real em navegador de computador/celular; aplicação da identidade Microgate.
- [ ] **Preparação de produção:** build, Compose de produção, backup/restauração e instruções para domínio/HTTPS. Publicação depende do ambiente a ser informado.

## 9. Verificação proporcional

Testes de API/banco: isolamento por empresa, bloqueio de escrita para visualizadores, concorrência na associação de portas e ocupação em U, revisões do layout e escopo da resposta pública.

Testes em navegador: criar manualmente a hierarquia, uma mesa com oito pontos, rack e patch panel; vincular pelos dois lados, mover a mesa e recarregar; consultar no celular; abrir e desativar o QR Code.

Dados sintéticos para validar a escala do exemplo, sem carregar o levantamento real. O ambiente usado pelo usuário começará com cadastros vazios.

Typecheck e build não substituem prova da API, banco, navegador ou produção. Relatar essas verificações separadamente.

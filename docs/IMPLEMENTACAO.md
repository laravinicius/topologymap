# Arquitetura e plano de implementação

Status: etapas 01 e 02 implementadas e validadas localmente; demais funcionalidades continuam como proposta técnica. Atualizado em 30/09/2026. Evidências em [PROGRESSO.md](PROGRESSO.md).

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

Usuários, sessões e permissões têm estrutura, sem provisão de administrador ou autenticação. A autorização central da API continua nas etapas 03/04. A tabela única de conexões já tem FKs, unicidades e revisão automática; operações de associação/transferência com estado esperado continuam na etapa 08.

## 4. Geometria e editor

O domínio armazenará IDs, posições e dimensões no sistema de coordenadas da planta. Pixels, zoom e deslocamento da câmera pertencem ao renderizador.

**Contrato implementado na etapa 02:** versão 1 em metros, X à direita/Y para baixo, retângulos ancorados no centro, dimensões positivas e rotação horária em graus [0, 360). Paredes/aberturas estruturadas, setores como polígonos e fundo com metadados do arquivo separados da transformação em metros. Validadores no domínio e CHECKs JSONB no PostgreSQL. Detalhes em [GEOMETRIA.md](GEOMETRIA.md). Nenhum renderizador foi instalado nesta etapa; persistência com revisão esperada e edição continuam nas etapas previstas.

Geometria de paredes e aberturas deve ser estruturada. Portas e janelas podem referenciar a parede e a posição dentro dela. Setores usam polígonos; mesas e marcadores de rack usam transformação e dimensões. A posição gráfica não substitui a filiação no cadastro.

Importar a planta cria um fundo. Para PDF, selecionar e renderizar uma página, mantendo o original e a imagem gerada em armazenamento do projeto. Registrar o alinhamento e a escala do fundo separadamente dos objetos.

Salvar o layout com número de revisão. Se outra sessão já alterou a revisão, exigir atualização/reconciliação antes de gravar. Indicar alterações pendentes e oferecer desfazer/refazer do layout. Os vínculos de cabeamento usam as operações transacionais da API, separadamente do histórico local de desenho.

## 5. Autenticação e publicação da mesa

Proposta: sessões persistidas no banco e cookie HttpOnly, com configuração Secure em produção, proteção das operações de escrita contra requisições de outra origem e limitação de tentativas de login.

Provisionar o primeiro administrador explicitamente, com credencial configurada localmente e sem senha padrão publicada no repositório. A administração de usuários e permissões é exclusiva do administrador geral.

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

## 8. Etapas e entregas

- [x] **Base local (etapa 01):** workspace, dependências, Compose, banco persistente, healthcheck e comandos de operação.
- [x] **Domínio e migrações (etapa 02):** contratos, esquema e migrações versionadas, sem reset dos volumes; restrições concorrentes validadas em PostgreSQL real.
- [ ] **Acesso:** provisionamento do administrador, login, usuários e permissões por empresa; testar isolamento.
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

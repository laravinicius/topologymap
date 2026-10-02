# Progresso do desenvolvimento

Os arquivos de evidências em `docs/evidencias/` são locais e ignorados pelo Git. Capturas, logs e relatórios permanecem disponíveis na máquina onde foram gerados; os resultados das verificações continuam registrados neste documento. Os caminhos abaixo são referências locais e não acompanham novas cópias do repositório.

Atualizado em 02/10/2026 (America/Sao_Paulo), após implementação e validação da etapa 17.

**Estado atual:** etapas 01 a 17 concluídas. Ambiente local saudável em [localhost:5173](http://localhost:5173), com consulta autenticada completa em tela compacta e QR restrito à mesa. Dados de trabalho preservados; QA sintético em bancos separados, removidos ao terminar. Etapas 18 a 21 permanecem pendentes. As seções anteriores preservam o histórico.

## Etapa 17 — Consulta completa no celular

**Situação: Concluída em 02/10/2026.** Somente a etapa 17. Próxima: **18 — Identidade visual Microgate**, pendente. Sem commit, push ou publicação. Alterações locais anteriores da etapa 16 preservadas.

### Entrega

- `Workspace.tsx`, `Park.tsx`, `useCompact.ts`: busca recolhível, atalhos para hierarquia e modo de consulta até 900 CSS px. Empresa/unidade/andar/planta/datacenter/rack continuam acessíveis pela hierarquia e busca. A API mantém papéis por conta/empresa; viewport controla somente apresentação.
- `PlanCanvas.tsx`, `touchCamera.ts`, `PlanEditor.tsx`: tap para selecionar, pan por um dedo e pinça por dois durante a consulta; botões equivalentes; canvas com altura adaptável e enquadramento. Lista/detalhes em uma coluna, propriedades de mesa/rack textuais. Câmera de leitura não escreve layout; edição, rascunho, histórico e proteção de saída preservados no computador e ao redimensionar.
- `RackFront.tsx`, `Racks.tsx`, `style.css`: vista frontal com rolagem interna, acesso destacado à lista de equipamentos/portas, nomes completos, estados livre/ocupada, controles de leitura de pelo menos 44×44 CSS px. Portas gráficas pequenas continuam tendo alternativa pela lista. QR responsivo conserva somente mesa/pontos/destinos, sem navegação interna.
- `ObjectLink.tsx`: resposta assíncrona de localização não substitui uma seleção posterior. `ArchitecturePanel.tsx`/`BackgroundPanel.tsx`: instruções coerentes com consulta. Testes da matemática dos gestos em `test/touchCamera.test.ts` e comando `npm run test:touch`.
- QA opcional `browser-server.ts --stage17`: banco exclusivo, visualizador/gerente sintéticos, empresas autorizadas/restrita, mesas com oito pontos e patch panel com 48 portas. Nenhuma migração, seed ou alteração de autorização de API na etapa 17. Contrato/roteiro em [CONSULTA_CELULAR.md](CONSULTA_CELULAR.md); IMPLEMENTACAO/plano/README atualizados.

### Verificações

| Categoria | Procedimento | Resultado |
|---|---|---|
| Typecheck/build | `npm run typecheck`; `npm run build` | Aprovados após as alterações finais, incluindo API/testes/web/domínio. |
| Câmera/gestos | `npm run test:touch` | **3/3**: pan preserva escala; pinça mantém ancoragem mesmo com centro em movimento; limites, contatos coincidentes e mudança de quantidade de dedos não produzem saltos/NaN. |
| Edição/navegação | `npm run test:layout-editor`; `npm run test:navigation` | **6/6 + 4/4**: histórico/reconciliação/enquadramento/fundo e URLs/cadeias/conflitos/listas mantidos. |
| API/PostgreSQL — autorização | `npm run test:access` | **13/13**: perfis, isolamento, escrita direta, revogação/desativação e sessões preservados. |
| API/PostgreSQL — QR | `npm run test:public` | **11/11**: DTO restrito, gestão, papéis, tokens/estado/revisões, concorrência e persistência preservados. |
| Navegador real — visualizador | Chromium/Playwright CLI: **360×800, 375×812, 390×844, 768×1024, 844×390 horizontal, 1280×900** | Em cada viewport: hierarquia → planta/lista → mesa/ponto → destino → porta 48 pela lista → rack/planta → origem → busca → ponto → recarga. Sem controles de edição do visualizador. |
| Layout/alvos | Medir documento e controles em hierarquia/planta, mesa/pontos, rack/portas/lista, rack/planta e busca | **30 medições** sem overflow horizontal da página; alvos de leitura ≥44×44 CSS px, considerando label da grade e alternativa de portas pela lista. ScrollWidths 345/360/375/753/829/1265 px nos viewports acima; a barra vertical ocupa 15 px. Screenshots inspecionados visualmente. |
| Toque emulado — planta | CDP `Input.dispatchTouchEvent`, um/dois contatos, screenshot do canvas e GET do layout antes/depois | Tap selecionou mesa; pinça **134% → 269%**; pan alterou a imagem. Layout/revisão **4 idênticos** antes/depois dos gestos. Botões de zoom/câmera funcionaram. Movimento reduzido conferido na seleção/lista. |
| Navegação concorrente | Reter resolução de mesa, selecionar ponto, liberar resposta | URL/seleção do ponto posterior mantidas. |
| Estados de leitura | Busca/hierarquia vazias, busca carregando, 503 simulado por interceptação | Estados legíveis em 390 px. Recarga/back/forward preservaram contexto. Erro simulado é prova de apresentação, não indisponibilidade real de infraestrutura. |
| Autorização por requisição | PUT de layout com payload válido por viewer em 360/1280; PATCH sem mudança de nome por gerente em 768 | **403 / 403 / 200**. Tela grande não concede escrita; tela pequena não retira autorização da API do gerente. |
| Edição no computador | Gerente, campos/aplicar/salvar/recarregar e resize 1280→768→1280 | X **3→3,25** persistiu; rascunho X **4** e histórico sobreviveram ao resize; desfazer restaurou 3,25. Controles ocultos em compacto reapareceram no computador. Exclusivamente QA. |
| QR público — navegador separado | Mesmos seis viewports, oito pontos/destinos, recarga e inspeção das chamadas/cookies | Zero cookies, links/navegação interna e pedidos à API privada. Sem overflow; estados reais de token inválido/mesa sem pontos e carregamento controlado conferidos em 360 px. |
| Preservação/limpeza | Snapshot contagens/MD5 antes/depois; encerramento do servidor/browser/web QA; consulta do catálogo de bancos | **18 tabelas de trabalho idênticas**, inclusive sessões e endereços públicos. Banco `topologia_new_test17_browser_*` removido; `temporaryDatabases: []`, `runtimeExists: false`; container QA removido e sessões de navegador encerradas. Volumes de trabalho preservados. |
| Operação/whitespace | Compose/health local e `git diff --check` | Serviços principais saudáveis; interface somente `127.0.0.1:5173`; whitespace aprovado. |

Total: **37 testes automatizados aprovados**, além dos fluxos/medições no navegador. Sem novos pacotes ou migrações nesta etapa. As tentativas preliminares do harness foram corrigidas para aguardar a resolução dos links, distinguir botões de busca/detalhe e medir o label clicável da grade; a prova final está nos logs de resultado. Erros HTTP dos cenários 403/404/503 são esperados; não foram identificadas exceções JavaScript da aplicação nos fluxos finais.

Evidências locais em `docs/evidencias/etapa17/`: `typecheck.txt`, `build.txt`, `touch-camera.txt`, `layout-editor.txt`, `navegacao.txt`, `acessos.txt`, `publico.txt`, `fluxos.txt`, `gestos.txt`, `estados-acesso.txt`, `desktop.txt`, `selecao-toque.txt`, `qr-publico.txt`, `banco-preservado.json`, `cleanup.json`, `diff-check.txt` e screenshots `planta-*`, `mesa-*`, `rack-*`, `portas-*`, `busca-*`, `qr-*`, `gesto-*`, `toque-selecao-390.png`, `edicao-desktop.png`, `gerente-consulta-768.png`. Scripts de QA em `output/playwright/etapa17/`; capturas/logs ignorados pelo Git. Não acompanham um clone novo.

**Limites da prova:** navegador real com viewport e toque emulado não substitui celular físico. Não houve Safari/iOS, Chrome/Android físico, teclado virtual, câmera/scanner QR, impressão física, conectividade externa ou produção. Escala integrada e identidade visual permanecem nas próximas etapas.

Para validar localmente: abra [localhost:5173](http://localhost:5173), entre com uma conta existente e siga [CONSULTA_CELULAR.md](CONSULTA_CELULAR.md). Abra também um QR já ativado no banco de trabalho. `topologia_new`, `topologia_new_web` e `topologia_new_db` continuam saudáveis em execução; `npm run dev:stop` para parar preservando volumes, `npm run dev:all` para subir. **Pendências essenciais da etapa 17: nenhuma. Próxima etapa: 18**, somente mediante solicitação.

## Etapa 16 — Consulta pública e etiquetas QR Code

**Situação: Concluída em 02/10/2026.** Somente a etapa 16. Próxima: **17 — Consulta completa no celular**, pendente. Sem commit, push ou publicação.

### Entrega

- `packages/domain/src/publicDesk.ts`, `apps/api/src/public-desks/routes.ts`, `app.ts`, `auth/{authorization,config}.ts`: endpoint/DTO público próprio sem IDs/administração, com nomes/pontos/destinos canônicos atuais. Exceção sem sessão somente na rota exata GET/HEAD. Gestão com contexto completo e papel/atividade atuais; leitura/viewer não criam token. Token aleatório de 32 bytes; reativação mantém endereço, renovação invalida anterior, desativação bloqueia. Revisão e lock transacional protegem concorrência.
- `007_desk_public_links.sql`: migração aditiva sem ativação automática ou alteração do parque. Aplicada no volume existente após backup local `backup/stage16-before.dump`; 001–006/volumes preservados. `compose.yaml`/`.env.example`: `PUBLIC_ORIGIN`, padrão local e HTTPS em produção.
- `PublicDesk.tsx`/`main.tsx`: entrada sem App/login/navegação interna, lista de pontos/destinos, loading/erro/tentativa e revalidação. `DeskPublicLink.tsx`, `Desks.tsx`, `qr.ts`, `style.css`, `index.html`: gestão/confirmações no cadastro, endereço, QR local e impressão isolada do parque. `qrcode` 1.5.4/types 1.5.6 fixados; `jsqr` 1.4.0 só para decodificação independente de teste. Sem serviço externo.
- Operação/contrato em [QR_PUBLICO.md](QR_PUBLICO.md); README/IMPLEMENTACAO/plano atualizados. Testes API/QR/migração e QA opcional `browser-server.ts --stage16`.

### Verificações

| Categoria | Procedimento | Resultado |
|---|---|---|
| Typecheck/build | `npm run typecheck`; `npm run build` | Aprovados em domínio/API/testes/web; editor e PDF em chunks separados. |
| API/PostgreSQL público/gestão | `npm run test:public` | **11/11**: sem cookie/cookie inválido; DTO exato/HEAD/no-store; token inválido/desativado/renovado; API interna/arquivos fechados; nomes/posição/setor/planta/conexão com token estável; admin/manager/viewer, contexto, revogação/atividade, campos extras; renovação ativa/desativada; duas renovações 200/409; reinício preserva token/estado/revisão/sessão; FK/unicidade/exclusão. |
| QR/configuração | `npm run test:qr` | **2/2**: PNGs decodificados independentemente para localhost, HTTPS e IP/porta; URL exata. Origens/token inválidos recusados. PNG exibido, QR renovado e QR no render da impressão também decodificados para o endereço mostrado (`qr-final-proof.json`). |
| Migrações/upgrade | `npm run test:db` | **39/39**: instalação nova e upgrade 006→007 com registros anteriores idênticos, mesmo esquema final e tabela pública vazia. |
| Regressões auth/acesso | `npm run test:auth`; `npm run test:access` | **15/15 + 13/13**; sessões/origens/limites/perfis/revogação/isolamento preservados. |
| Navegador gestão | Chromium/Playwright CLI, gerente, 1280×900/390×844 | Ativar, endereço/QR; desativar com confirmação/retirada da etiqueta; reativar mantém URL; renovar com aviso/nova URL. Viewer consulta mesa sem painel de gestão. |
| Navegador público | Navegador separado, zero cookies e reload do QR | Oito pontos, dois destinos/DCs e pontos livres; zero links/navegação interna; só chamadas à API pública, sem sessão/parque. Capturas desktop/390 px inspecionadas, sem overflow. |
| Navegador bloqueios | Reload após desativação/renovação; HTTP antigo/novo | Página anterior só mostra indisponibilidade; endereço antigo 404 e novo 200, sem redirecionamento a login. |
| Impressão local | PDF print, `pdfinfo` e render Poppler inspecionado | **Uma página A4**, fundo branco, somente etiqueta/nome/QR/URL. Corrigidas páginas vazias da inspeção inicial e espaçamento do aviso na gestão. Sem papel físico. |
| Preservação/operação | Backup, snapshot contagens/MD5, migração/health/Compose | **17 tabelas de trabalho idênticas**, incluindo usuários/sessões/login_limits, geometria/arquivos/conexões. Nova tabela vazia; sem fixture no banco de trabalho; web em loopback. |

Total: **80 testes automatizados aprovados**, além do navegador. Evidências locais ignoradas em `output/playwright/etapa16/`: `typecheck.txt`, `build.txt`, provas `public-proof.txt`, `viewer-proof.txt`, `disabled.txt`, `renew-proof.txt`, `qr-browser.json`, snapshots `banco-antes.json`/`banco-preservado.json`, `cleanup.json`; imagens `gestao-etiqueta.png`, `gestao-390.png`, `publica-desktop.png`, `publica-390.png`, PDF `etiqueta-primeira.pdf` (versão final de uma página) e render `etiqueta-impressao-final.png`.

QA em `http://localhost:5174`, banco exclusivo `topologia_new_test16_browser_204017c1cb4a` e contas/fixtures sintéticos. Navegadores, servidor e container `qa16_web` encerrados; banco QA/runtime/arquivos com credenciais removidos. Nenhum banco temporário da etapa 16 restante. Serviços principais `topologia_new`, `topologia_new_web`, `topologia_new_db` continuam em execução e saudáveis.

Para validar: abra [localhost:5173](http://localhost:5173), entre como gerente/admin e selecione uma mesa; ative a consulta, confira o QR/endereço e imprima. `PUBLIC_ORIGIN` no `.env` define a origem das etiquetas; `npm run dev:all` reaplica configuração; `npm run dev:stop` encerra preservando volumes. **Prova local apenas:** localhost não acessa esta aplicação em outro aparelho; nenhum celular físico/domínio definitivo/HTTPS/produção validado. **Pendências essenciais da etapa 16: nenhuma. Próxima: etapa 17**, mediante solicitação.

## Etapa 15 — Busca e navegação integrada

**Situação: Concluída em 02/10/2026.** Entrega limitada à etapa 15. Próxima: **16 — Página pública e etiquetas QR Code**, pendente e não iniciada.

### Entrega

`packages/domain/src/search.ts` define resultados, facetas e destinos canônicos. `apps/api/src/search/routes.ts` entrega busca autenticada por nomes/tipos, filtros empresa/unidade/andar/setor, paginação e resolução de objetos por UUID, com atividade/permissões atuais no SQL. Catálogo derivado dos cadastros: nomes livres/homônimos não substituem IDs. Nenhuma migração, carga no banco de trabalho ou duplicação de conexões.

`Search.tsx`, `ObjectLink.tsx`, `navigation.ts`, `ConnectionPath.tsx`, `PlanEditor.tsx`, `Desks.tsx`, `Racks.tsx`, `Park.tsx`, `Workspace.tsx` e `App.tsx` integram busca/lista, consulta nos dois sentidos e foco na planta correta. Porta/ponto, filtros e foco ficam na URL e sobrevivem à recarga/histórico/login direto. Objetos sem posição ou planta continuam consultáveis. Destinos fora dos filtros limpam a busca com aviso explícito. Foco usa câmera local sem alterar layout/revisão/histórico, inclusive como administrador. Racks na lista gráfica identificam o datacenter; sua representação gráfica própria permanece opcional e não foi adicionada ao contrato de geometria.

Contrato/uso em [NAVEGACAO.md](NAVEGACAO.md), README/IMPLEMENTACAO/plano atualizados. Testes API/cliente e fixtures opcionais em `search.test.ts`, `search-fixtures.ts`, `navigation.test.ts` e `browser-server.ts --stage15`.

### Verificações

| Categoria | Procedimento | Resultado |
|---|---|---|
| Typecheck/build | `npm run typecheck`; `npm run build` | Aprovados em domínio, API/testes e web. Editor/PDF continuam em chunks separados. |
| API/PostgreSQL — busca | `npm run test:search` | **9/9**: resultados/facetas autorizados, visualizador, nomes atuais e literais, filtros/UUIDs incluindo caixa, filiações incompatíveis, dois DCs homônimos, conexões em ambos os sentidos/andares, sem posição/planta, paginação de 65 itens, URLs diretas, revogação/desativação com sessão existente. |
| Cliente — URLs | `npm run test:navigation` | **4/4**: cadeia completa, origem/destino, foco no rack canônico, filtros compatíveis e aviso/limpeza dos conflitantes, consulta sem posição/planta. |
| Regressões API/PostgreSQL | `npm run test:connections`; `npm run test:racks` | **13/13 + 13/13**: conexão única, transferências/locks/concorrência, autorização/isolamento, racks/portas/equipamentos e integridade preservados. |
| Regressões do editor | `npm run test:layout-editor` | **6/6**: histórico, relações, reconciliação, enquadramento e calibração. |
| Navegador — busca/filtros | Chromium/Playwright CLI, conta visualizadora, viewport 1280 × 900 | Rack 01 aparece duas vezes com DC/andar corretos; filtro de andar limita ao rack daquele contexto; empresa/unidade/andar/setor/texto permanecem após recarga. |
| Navegador — conexões/histórico | Ponto 1 → Porta 1 no DC 01 → origem; Porta 2 no DC 02 → Ponto inverso → destino | Consulta nos dois sentidos, selecionando UUIDs corretos. Porta/ponto sobrevivem à recarga; Voltar/Avançar restauram o lado anterior. Filtro de origem conflitante é limpo com aviso. Localizar rack abre a planta do outro andar. |
| Navegador — sem posição/planta | Rack 01 no DC 02 vinculado sem posição; Rack sem planta com patch panel/porta livre | Planta vinculada informa ausência de posição e mantém **Consultar pela lista**, inclusive após recarga. Rack sem planta permite equipamento/porta livre e mantém seleção ao recarregar. |
| Navegador — acesso direto | Empresa não autorizada e rack do DC 01 sob URL do DC 02 | HTTP 404 e mensagem contextual; nenhum detalhe restrito ou de filiação cruzada. Visualizador sem ferramentas de escrita; **zero escritas** no fluxo final de busca. |
| Navegador — edição/entrada direta | Administrador entra por URL de mesa/ponto/foco; clique real no canvas; alterar X/cancelar saída/desfazer/localizar rack/reload | Login retoma a URL completa. Canvas seleciona a mesa e abre seus pontos. Cancelar a navegação conserva planta/rascunho; desfazer libera a troca. Foco e recarga deixam **Salvar layout desabilitado**, sem escrita. |
| Visual/responsivo | Capturas desktop/390 × 844 inspecionadas e `scrollWidth <= innerWidth` | Busca/filtros/resultados e lista de portas utilizáveis, sem overflow do documento. Sem teste em dispositivo físico. |
| Preservação/operação | Snapshot de contagens/MD5 em todas as tabelas do banco de trabalho, Compose/health e `git diff --check` | **18 tabelas idênticas** antes/depois, incluindo usuários/sessões. Migrações 001–006 preservadas; nenhuma migração nova. Serviços principais saudáveis, somente web em loopback. |

Total: **45 testes automatizados aprovados**, além dos cenários no navegador. Durante a validação, foram corrigidos a tipagem UUID dos parâmetros SQL e a limpeza de foco ao trocar mesa/rack. Os scripts de navegador foram ajustados aos nomes acessíveis reais (**Editor de planta**, **Desfazer layout**, **Alterações pendentes**) e o cancelamento do diálogo foi verificado também pelo snapshot/fluxo posterior. Erros 401 do login sem sessão e 404 dos ataques sintéticos são esperados; nenhum erro de execução da interface nos fluxos finais.

Evidências locais ignoradas em `output/playwright/etapa15/`: `typecheck.txt`, `build.txt`, `api-search.txt`, `api-connections.txt`, `api-racks.txt`, `navigation.txt`, `layout-editor.txt`, `browser-flows-final.txt`, `browser-unplaced-final.txt`, `browser-admin-finish.txt`, `browser-summary.txt`, `admin-cancelled.txt`, snapshots `banco-antes.json`/`banco-depois.json`, `preservacao.json`, `operacao.txt` e `diff-check.txt`. Capturas: `busca-datacenters.png`, `busca-390.png`, `rack-localizado.png`, `lista-sem-planta.png` e `rack-390.png`.

QA em `http://localhost:5174`, API interna temporária `api:3002`, bancos exclusivos `topologia_new_test15_browser_*` e contas/fixtures sintéticas. Navegadores e web/servidor QA encerrados; bancos e credencial temporária removidos. Nenhuma fixture no banco de trabalho; volumes preservados. `topologia_new`, `topologia_new_web` e `topologia_new_db` continuam em execução.

Para validar manualmente: abra [localhost:5173](http://localhost:5173), entre com sua conta, use **Busca e lista do parque** e **Consultar**/**Localizar na planta**. Na mesa/porta associada, percorra origem/destino e recarregue ou use Voltar. `npm run dev:stop` para parar preservando volumes; `npm run dev:all` para subir. **Pendências essenciais da etapa 15: nenhuma.** Etapa 16 não iniciada; sem validação em dispositivo físico ou produção, commit/push/publicação.

## Etapa 14 — Importação de plantas e calibração de escala

**Situação: Concluída.** Entrega limitada à etapa 14. Próxima: **15 — Busca e navegação entre planta, mesa e rack**, pendente e não iniciada.

### Entrega

Migração aditiva `006_plan_files.sql` com metadados, FKs compostas e validação das referências do fundo. Rotas em `apps/api/src/files/` para upload binário privado, decodificação/normalização de PNG/JPG com Sharp e renderização de página PDF com PDF.js/canvas, em worker com limites. Original e renderizado usam UUIDs internos no volume `plant_files`; download exige sessão e acesso atual à empresa/planta e confere bytes/SHA-256. O PUT do layout valida IDs, página e resolução, mantendo a proteção de revisão.

`BackgroundPanel.tsx`, `PdfPreview.tsx`, `background.ts`, `PlanCanvas.tsx` e `PlanEditor.tsx` entregam prévia/seleção de página, troca/remoção, downloads, centro/dimensões/rotação, opacidade e calibração por dois cliques ou coordenadas em pixels com distância real. A calibração mantém o primeiro ponto no lugar e transforma exclusivamente o fundo. Histórico de desfazer/refazer inclui o fundo; pontos, conexões e posições canônicas permanecem independentes. Fontes/CMaps/WASM são locais; PDF.js é carregado somente quando necessário.

Limites, API, retenção e comandos em [FUNDOS.md](FUNDOS.md). Versões fixadas e verificadas no npm: PDF.js **6.3.289**, Sharp **0.35.5**, canvas **1.0.10**.

### Verificações

| Categoria | Procedimento | Resultado |
|---|---|---|
| Typecheck/build | `npm run typecheck`, `npm run build`, equivalentes via `docker compose exec -T api` | Aprovados no Windows e Linux. Worker compilado executado diretamente pelo Node: página 2 renderizada em 600 × 450 px; prévia e worker PDF.js separados no build web. |
| Migração no volume existente | `npm run db:status`, `npm run db:migrate` | 001–005 já aplicadas; 006 aplicada explicitamente sem reset ou dados sintéticos no banco de trabalho. |
| Instalação/upgrade real | `npm run test:db` | **38/38**; banco novo, reaplicação e upgrade **005 → 006** com parque, geometria e conexão preservados e esquema equivalente. |
| API/banco/arquivos | `npm run test:files` | **10/10**; PNG/JPG, original idêntico, PDF com duas páginas distintas, página inexistente/101 páginas, tipo falso, truncamento, 20 MiB, 8192 px/16 milhões de pixels, caminhos, quotas, checksum/symlink. |
| Autorização/integridade | Mesmo teste, chamadas diretas | Outra empresa/planta: 404; referência cruzada no layout: 400 e SQL: 23514; visualizador lê e recebe 403 ao escrever; revogação com sessão existente: 404; sem sessão: 401. Troca preserva IDs/posições/pontos/conexão; revisão antiga: 409. |
| Regressão de layout | `npm run test:layout` | **14/14**, conflitos, setores, cadastros, visualizador e preservação de cabeamento. |
| Domínio/editor | `npm run test:domain`, `npm run test:layout-editor` | **6/6 + 6/6**; calibração com rotação mantém o primeiro ponto, proporção e distância; entradas inválidas recusadas; histórico/reconciliação preservados. |
| Navegador local | Chromium real/Playwright, banco e web exclusivos em `localhost:5174` | PNG/JPG importados/salvos; página 2 do PDF selecionada/importada; troca desfeita/refeita; alinhamento X=2/Y=3 e rotação 30°; dois cliques com distância de 6 m produziram largura 8 m e opacidade 40%, mantendo mesa de oito pontos. Reload conservou valores. |
| Visualizador no navegador | Usuário sintético viewer | Fundo e links de download disponíveis; importação e Salvar layout ausentes. |
| Reinício de containers | Reinício real de API/web de QA e dos serviços Compose; banco saudável antes de iniciar novamente o QA | Snapshot, sessão e SHA-256 do original/renderizado idênticos após reinício/reload. Houve 502 transitório durante a parada; verificações finais após recuperação dos serviços. |
| Viewport de celular | Chromium 390 × 844 | Controles legíveis e sem overflow horizontal; captura inspecionada. Não equivale a teste em dispositivo físico. |
| Limpeza | Parada/remoção dos containers QA e `browser-files-server.ts --cleanup` | Banco, subdiretório `qa14_*`, credencial e navegador QA removidos; consulta final `testDatabases: []`, `qaDirectories: []`, zero arquivos de QA no banco de trabalho; volumes preservados. |
| Produção/dispositivo físico | Não executados | Fora desta etapa. |

Capturas locais inspecionadas: `output/playwright/stage14-png-canvas.png`, `stage14-pdf-canvas.png`, `stage14-jpg-canvas.png`, `stage14-persistence.png`, `stage14-mobile.png` e `stage14-viewer.png`. Scripts/capturas do navegador permanecem ignorados pelo Git; testes reproduzíveis da API/domínio fazem parte do código.

### Ambiente e limites

Permanecem os serviços `topologia_new`, `topologia_new_web` e `topologia_new_db`; web exclusivamente em **127.0.0.1:5173**, API/banco internos. Abra a planta, importe em **Fundo da planta**, escolha a página se PDF, ajuste/calibre e clique em **Salvar layout**. `npm run dev:stop` para sem apagar volumes; `npm run dev:all` espera healthchecks ao subir.

Originais/fundos até 20 MiB; imagens estáticas até 8192 px/16000000 pixels; PDF até 100 páginas/14400 pt por lado; renderização até 4096 px por lado; conversão de 30 s; quota de 100 importações ou 512 MiB por planta. Importações anteriores e uploads não vinculados são retidos para preservar originais/histórico, contando na quota; não há expurgo automático. Arquivos impedem exclusão física da planta por dependência RESTRICT. Não há OCR/CAD, suporte a PDF protegido por senha, acesso público aos arquivos ou publicação em produção. Não há pendência essencial da etapa 14.

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

## Etapa 06 — Mesas e pontos

**Situação: Concluída em 01/10/2026.** Cadastro, lista e detalhe de mesas/pontos disponíveis em [http://localhost:5173](http://localhost:5173), dentro da planta selecionada. Etapa 07 pendente e não iniciada.

### Resultado e arquivos principais

- `packages/domain/src/desks.ts`: entradas e DTOs compartilhados, limites, contagem real e estado de conexão; geometria reutiliza `Rectangle`, em metros, com centro como âncora.
- `apps/api/src/desks/routes.ts`: rotas sob empresa/unidade/andar/planta/mesa; criação transacional da mesa e N pontos; consulta consistente do detalhe; edição de mesa/ponto, ampliação e redução com IDs esperados; exclusões explícitas protegidas. Autorização central da etapa 04 e cadeia completa da URL em todas as operações. Não exige racks nem implementa associação nesta etapa.
- `apps/api/src/app.ts`: registro do módulo e mensagens específicas de validação para mesas/pontos. Quantidade inteira de 0 a 512; nome de 1 a 200 caracteres, não branco; coordenadas de -1000000 a 1000000 m; dimensões positivas até 10000 m; rotação [0,360). IDs, filiação e ordinal não são campos editáveis.
- `apps/web/src/Desks.tsx`, `Park.tsx`, `style.css`: formulário, lista com quantidade, detalhe com Associado/Não associado, edição de nome/posição/dimensão/rotação, confirmações e feedback anunciado com foco no erro. Mesa na URL; recarga mantém contexto e troca de pai limpa a mesa. Revalidação acompanha o parque; visualizador consulta sem controles de alteração.
- `apps/api/test/desks.test.ts`, scripts `test:desks` e opção `browser-server.ts --stage06`: testes em PostgreSQL e QA de navegador opcionais em bancos separados. README, arquitetura e plano atualizados.

**Integridade e política:** todas as alterações de pontos serializam no registro da mesa; reduções bloqueiam os pontos antes de verificar/remover. A FK RESTRICT preserva conexões mesmo diante de uma associação concorrente. Aumentar acrescenta registros; não recria nem substitui pontos anteriores. A quantidade usa o número de registros, sem interpretar números nos nomes. Sequência segue o ordinal interno; quando um nome sugerido já foi usado, gera outro nome livre. Renomear preserva grafia exata, IDs, pais e created_at. Alterar quantidade exige IDs atuais na ordem da lista (`expectedPointIds`), recusando tela antiga com 409. Redução remove os últimos pontos somente sem conexão, após confirmação; qualquer falha desfaz toda a edição. Mesa só pode ser excluída sem pontos, removidos explicitamente antes. Sem cascata, arquivamento ou desvinculação implícita.

Não houve migração nova, alteração de dependências/lockfile ou reset. Migrações 001/002/003 já aplicadas e dependências da etapa 05 verificadas pelo código, serviços e regressões atuais. O editor gráfico, revisões de layout e destinos/associação de conexões continuam nas etapas previstas.

### Verificações executadas

| Camada | Procedimento | Resultado |
|---|---|---|
| API e PostgreSQL | `npm run test:desks` | **10/10** passando: oito pontos sem racks; nomes exatos e mesmo nome em outra planta; limites e campos imutáveis; renomeação, posição/rotação e ampliação mantendo IDs; redução/exclusão; papéis e isolamento. |
| Transação | Trigger sintético falha no quarto ponto da criação | Requisição falha; mesa e lote inteiros revertidos, zero órfãos. Trigger somente no banco exclusivo de testes. |
| Conexões e redução | Fixture SQL de patch panel/porta/conexão em banco de teste, sem implementar sua API | Redução de pontos conectados, exclusão de ponto e mesa recusadas; vínculo/IDs permanecem. Nome proposto junto à redução bloqueada também não é salvo. Após desvinculação explícita de teste, redução mantém os IDs restantes. |
| Concorrência | Duas ampliações com os mesmos IDs esperados; quatro corridas de DELETE ponto contra INSERT conexão | Uma ampliação 200 e outra 409; pontos originais preservados. Na corrida com conexão: conexão gravada implica DELETE 409; DELETE 204 implica INSERT recusado pela FK. Nunca remove vínculo nem produz órfão. |
| Acesso | Manager em A, viewer em B, C sem permissão, cadeias/mesas/pontos cruzados, revogação | Escrita autorizada funciona; viewer 403; empresa sem acesso e referência fora do pai 404; sem sessão 401; alteração de papel/revogação vale na sessão existente. |
| Regressão | `test:park`, `test:access`, `test:auth`, `test:db`, `test:domain` | **9/9, 13/13, 15/15, 35/35, 4/4**; com mesas, **86 testes passando**. |
| Tipos/build | `npm run typecheck`, `npm run build`, no Windows e dentro da API Linux | Aprovados, incluindo tipos dos testes. Build web final: JS 254,26 kB / 77,28 kB gzip. |
| Navegador | Playwright CLI/Chromium, formulários reais, 1280 × 900 e 390 × 844 | Fluxo manual e consulta de visualizador conferidos; sem overflow horizontal e sem controles visíveis menores que 44 px no viewport móvel. |
| Operação | `npm run dev:all`, `docker compose ps`, `db:status`, health pelo proxy e `git diff --check` | Três serviços saudáveis, três migrações aplicadas, health 200/database up; sem erros de whitespace. Volumes preservados. |

### Validação real no navegador

Banco exclusivo `topologia_new_test06_browser_128a62366eee`, API temporária interna em 3002 e web temporária `topologia_new_web_qa06` em `127.0.0.1:5174`. Administrador sintético somente por opção explícita `--stage06`. Nenhuma carga sintética foi feita no banco de trabalho.

- Criados **Empresa mesas QA → Matriz QA → Térreo QA → Planta mesas QA** pelos formulários. Sem datacenter/rack, **Nova mesa** recebeu **Mesa 01 Freso** com oito pontos. Lista e detalhe mostraram oito registros em sequência **Ponto 1…Ponto 8**, todos **Não associado**.
- Quantidade `-1` foi bloqueada pela validação nativa do campo, sem criar mesa. Chamadas diretas do navegador com `-1`, `1.5`, `513` e nome somente branco retornaram 400. Os testes finais da API também verificaram mensagens específicas dos limites de quantidade e nome.
- **Ponto 1** renomeado para **Ponto 099 Freso**, mesa para **Mesa 01 Freso revisada**, quantidade ampliada para dez, X = -2,5 m e rotação = 45°. Consulta da API pelo próprio navegador confirmou ID da mesa e oito IDs originais iguais, nome exato e placement atualizado. Recarga manteve contexto, dez pontos, nome e posição/rotação.
- Redução para oito abriu **Confirmar remoção**; confirmar removeu somente os dois últimos pontos livres. Tentar excluir a mesa não vazia mostrou a confirmação e depois **Não é possível excluir: esta mesa possui pontos. Remova os pontos sem conexão primeiro.** com foco no alerta; mesa e oito pontos permaneceram.
- Fixtures complementares de B/C foram criadas por chamadas administrativas no QA; o mesmo usuário sintético passou a manager em A e viewer em B, sem refazer login. Escritas diretas em B retornaram 403; C e ponto de outra mesa sob A retornaram 404; PATCH em A retornou 200. A listagem revelou somente A/B e seus papéis. Navegar para B mostrou os dois pontos e **Visualização — somente consulta**, sem criação/edição/exclusão ou Administração.
- Capturas desktop/celular inspecionadas visualmente. Consulta completa e botões utilizáveis com rolagem vertical. Viewport móvel de 390 px com scrollWidth 375 (barra de rolagem do Chromium), sem overflow horizontal; zero controles visíveis com altura abaixo de 44 px. Sem teste em dispositivo físico.
- Console sem exceções JavaScript da aplicação; os 400/403/404/409 dos cenários e 401 antes de login são esperados. Favicon 404 já existente permanece. Console da consulta final de visualizador sem erros/warnings.

Evidências locais em `docs/evidencias/etapa06/`: `testes-{mesas,parque,acessos,autenticacao,banco,dominio}.txt`, `typecheck-{host,linux}.txt`, `build-{host,linux}.txt`; `navegador-{oito-pontos,ids-antes,ampliacao,reducao,invalido,invalido-api,isolamento,visualizador,exclusao-protegida,layout-celular}.txt`; `mesa-oito-desktop.png`, `mesa-celular.png`, `visualizador-celular.png` e logs de console. Capturas originais também em `output/playwright/`, ignoradas.

### Estado final e operação

Banco de trabalho conferido antes/depois: **2 usuários, 5 sessões, 1 empresa, 1 concessão, 1 unidade e 1 andar existentes; 0 plantas, mesas, pontos e conexões**. Os arquivos `banco-trabalho-antes.txt` e `banco-trabalho-depois.txt` são iguais. Este é o estado observado nesta etapa, diferente das contagens históricas da etapa 05. Cadastros existentes preservados; nenhum sintético ali.

Servidor de QA encerrado pelo stdin: banco sintético e arquivo de credencial removidos. Container web de QA removido; `bancos-final.txt` confirma somente banco de trabalho, postgres e templates, sem bancos temporários. Volume PostgreSQL original preservado, criação `2026-09-30T17:51:39Z` em `volume.txt`. Serviços reconstruídos pelo lockfile: API `topologia_new`, web `topologia_new_web` e banco `topologia_new_db` saudáveis, somente web publicada em loopback. Evidências em `servicos-build.txt`, `servicos-final.txt` e `health-final.json`.

Navegador sem sessão abriu `/parque` do ambiente de trabalho reconstruído e retornou a `/login`; tela disponível para o usuário existente. Evidências em `navegador-trabalho-final.txt` e `login-trabalho-final.png`. Health final 200/status ok/database up, em 01/10/2026 às 08:46:40 (America/Sao_Paulo).

URL de trabalho: [http://localhost:5173](http://localhost:5173). Entre com o usuário existente, selecione empresa → unidade → andar → planta e use **Nova mesa**. É necessário cadastrar uma planta se ainda não existir. Use quantidade oito e abra a mesa para editar os pontos. Recarregue para conferir persistência e contexto. Para repetir as regras de API/banco: `npm run test:desks`; para subir: `npm run dev:all`; para parar preservando volumes: `npm run dev:stop`.

Typecheck/build, API/PostgreSQL e navegador local foram validados separadamente. Sem teste em dispositivo físico ou produção; sem commit, push ou publicação. **Pendências essenciais da etapa 06: nenhuma. Próxima etapa: 07 — Racks, equipamentos e portas**, somente mediante nova solicitação.

## Etapa 07 — Racks, equipamentos e portas

**Situação: Concluída em 01/10/2026.** Cadastros disponíveis em [http://localhost:5173](http://localhost:5173), dentro do datacenter. Frente gráfica permanece na etapa 10; a API de conexões permanece na etapa 08.

### Resultado e arquivos principais

`packages/domain/src/racks.ts`: DTOs e limites compartilhados. `apps/api/src/racks/routes.ts`: rack, equipamento genérico/patch panel, portas em lote, edição e exclusão com dependências. `apps/web/src/Racks.tsx` e integração em `Park.tsx`: listas, formulários, confirmação de redução/remoção, contexto na URL, estados vazios/carregamento, conflitos com foco no alerta e consulta de visualizador. Registro/erros em `app.ts`, comandos `test:racks` nos dois package.json e instruções no README/IMPLEMENTACAO. Ajuste de typecheck em `desks.test.ts` remove somente um ramo inacessível após assert; demais alterações anteriores da etapa 06 preservadas.

Capacidade/U inicial/altura positivas inteiras de 1 a 1000 e portas de 1 a 512; nome/tipo de 1 a 200 caracteres, preservando grafia. Equipamentos genéricos não recebem portas. Criação de equipamento e lote é transacional; ampliar acrescenta registros e mantém IDs, reduzir exige IDs atuais e remove somente as últimas portas livres. Edição preserva equipamento, portas e conexões. Rack com equipamento fora da nova capacidade, porta conectada, equipamento com portas e rack com equipamentos não podem ser reduzidos/excluídos de forma destrutiva. Não há cascata ou desvinculação implícita.

Locks na ordem rack → equipamento → portas serializam escritas da API; restrições EXCLUDE GiST/FK/CHECK da migração 002 continuam protegendo sobreposição e capacidade no banco, inclusive para SQL direto. Nenhuma migração nova ou reset foi necessário. Conflitos retornam 409 compreensível; as rotas aplicam autorização atual e filiação completa.

### Verificações e resultados

| Camada | Verificação | Resultado |
|---|---|---|
| API/PostgreSQL isolado | `npm run test:racks` | **13/13**. Equipamento 3 U, adjacência, patch panels 24/48/512, limites/tipos, sobreposição/capacidade, grafia/IDs, edição/ampliação/redução/exclusão, papéis e cadeias cruzadas. |
| Transação | Trigger sintético falha na porta 12 | Criação retorna falha; equipamento e lote inteiro revertidos, zero portas órfãs. Trigger somente no banco de teste. |
| Concorrência | Duas instalações sobrepostas; duas quantidades com mesmos IDs; INSERTs SQL em transações distintas | Instalações: 201/409; quantidades: 200/409; SQL direto: somente um equipamento, segundo recusado por EXCLUDE/23P01. |
| Dependências concorrentes | Corridas redução de capacidade/instalação e DELETE porta/INSERT conexão; regressões do banco | Nenhum equipamento além da capacidade, sobreposição ou vínculo removido. A operação perdedora recebe conflito ou erro da restrição; testes do banco também cobrem redução/movimentação nas duas ordens e snapshot antigo. |
| Regressão | `test:desks`, `test:park`, `test:access`, `test:auth`, `test:db`, `test:domain` | **10/10, 9/9, 13/13, 15/15, 35/35, 4/4**, total com racks **99 testes aprovados**. |
| Tipos/build | `docker compose exec -T api npm run typecheck` e `npm run build` | Aprovados para workspace inteiro, incluindo testes; JS web 265,90 kB / 79,48 kB gzip. |
| Navegador real | Playwright CLI/Chromium, 1280 × 900 e 390 × 844 | Formulários de rack, genérico, PP24/48, edição de porta/posição/altura, ampliação/redução, conflitos e recarga aprovados. Capturas inspecionadas visualmente. |
| Operação | Reinício somente de API/web, health, db:status, comparação do banco e `git diff --check` | Serviços saudáveis, health 200/database up, três migrações aplicadas, banco/volumes preservados e nenhum erro de whitespace. |

### Prova no navegador

QA exclusivo `topologia_new_test07_browser_9f67da137d0f`, API interna 3002, web temporária `topologia_new_web_qa07` em loopback 5174, administrador por opção explícita `--stage07`. Empresa/unidade/DC sintéticos preparados por API no navegador; rack/equipamentos/portas operados pelos formulários reais.

- Criados Rack QA 42 com 42 U, Servidor QA 3U (U 1–3), PP QA 24 (U 4, 24 portas) e PP QA 48 (U 5–6, 48 portas). Listas/estados Livre e intervalos corretos. Sobreposição U 3–4 recusada e alerta focado.
- PP48 renomeado, movido para U 10 e ampliado em altura para 3 U, depois ampliado para 50 portas. Consulta pelo próprio navegador confirmou ID do equipamento e os 48 IDs originais iguais. Porta 1 renomeada para Porta 099 Freso. Redução do rack para 11 U bloqueada, com foco no alerta.
- Fixture SQL de conexão somente na última porta do QA: reduzir para 24 exigiu confirmação e foi bloqueado pela conexão, mantendo os 50 registros. Após remoção explícita da conexão de teste, repetir a confirmação manteve os primeiros 24 IDs e removeu apenas as últimas portas livres. Recarga manteve nome, U, altura, quantidade e contexto.
- Consulta como visualizador sintético mostrou rack/equipamentos/portas sem botões Novo/Editar/Excluir. Em 390 px: scrollWidth 375 (barra do Chromium), sem overflow horizontal; zero controles visíveis com altura inferior a 44 px. Sem teste em dispositivo físico.
- Console sem exceções JavaScript da aplicação; 401 de sessão inicial e 409 de conflitos são esperados. Favicon 404 preexistente permanece.

Evidências locais ignoradas em `docs/evidencias/etapa07/`: `testes-{racks,desks,park,access,auth,db,domain}.txt`, `typecheck-linux.txt`, `build-linux.txt`, `navegador-{pp24,pp48,conflito,alerta,ids-antes,edicao-ampliacao,capacidade,reducao-protegida,reducao-livre,recarga,layout-celular,visualizador,visualizador-layout,trabalho-final}.txt`, `rack-desktop.png`, `rack-celular.png`, `visualizador-celular.png`, `console.txt`, `health-final.json` e snapshots de operação/banco.

### Estado final e validação pelo usuário

Servidor QA encerrado por SIGTERM; banco sintético/credencial removidos, container web QA removido. `bancos-final.txt` confirma somente topologia_new, postgres e templates. Banco de trabalho observado: 2 usuários, 6 sessões, 1 empresa, 1 concessão, 1 unidade, 1 andar, 1 planta, 1 mesa, 8 pontos, 1 datacenter, zero racks/equipamentos/portas/conexões. Esses cadastros existentes são diferentes do snapshot histórico da etapa 06; nenhuma carga de QA foi executada ali. Contagens/checksums das 14 tabelas são iguais antes/depois do reinício (`banco-trabalho-{antes,depois}-reinicio.txt`).

API `topologia_new`, web `topologia_new_web` e PostgreSQL `topologia_new_db` ficaram saudáveis. Somente web exposta em `127.0.0.1:5173`; volumes existentes mantidos. Health final em 01/10/2026 às 09:12:34 (America/Sao_Paulo). Navegador sem sessão válida do banco de trabalho mostra login. Para validar: entre em [http://localhost:5173](http://localhost:5173), selecione empresa → unidade → datacenter, use **Novo rack** e **Novo equipamento**, escolha patch panel e informe 24 ou 48 portas. Abra o equipamento para editar os nomes. Recarregue para conferir persistência. `npm run dev:stop` para parar preservando volumes; `npm run dev:all` para subir novamente.

Sem dispositivo físico, produção, commit, push ou publicação. **Pendências essenciais da etapa 07: nenhuma. Próxima etapa: 08 — API de conexões e proteção contra concorrência**, somente mediante nova solicitação.

## Etapa 08 — Conexões e concorrência

**Situação: Concluída em 01/10/2026.** API transacional disponível no ambiente local. Contrato de rotas, corpos, respostas e tratamento dos conflitos em [CONEXOES.md](CONEXOES.md). Etapas 09/10 de formulários de associação e frente gráfica não foram iniciadas.

### Resultado e arquivos principais

- `packages/domain/src/connections.ts`: caminho, DTO da conexão e estado esperado; contratos de pontos/portas acrescentam connection mantendo connectionId.
- `apps/api/src/connections/routes.ts`: consulta por ponto, porta ou ID; associação por POST; transferência explícita por POST /transfer e desvinculação por DELETE. Registro e mensagem de validação em `app.ts`; comandos test:connections nos manifests.
- `apps/api/src/connections/query.ts`: caminho derivado dos cadastros atuais em um statement, reutilizado nas duas extremidades e nos detalhes de mesa/equipamento. Integração em `desks/routes.ts` e `racks/routes.ts`.
- `apps/web/src/ConnectionPath.tsx`, `Desks.tsx` e `Racks.tsx`: caminho textual e localização de origem nas listas existentes. Revalidação por foco, 30 segundos e Atualizar acessos, sem nova infraestrutura.
- `apps/api/test/connections.test.ts`: testes com Fastify real via inject e PostgreSQL isolado; `browser-server.ts --stage08` disponibiliza QA opcional separado. README, arquitetura, contrato e plano atualizados.

A única relação persistida continua em connections. Associação usa INSERT simples: ponto/porta ocupados recebem 409, inclusive ao repetir o par. Transferência preserva ID/createdAt, incrementa revisão e libera a extremidade substituída; destino ocupado por outra conexão gera rollback, sem remover/substituir o vínculo alheio. DELETE e transferência exigem revisão e as duas extremidades esperadas, condicionadas junto ao ID e à empresa no statement de alteração. Estado antigo, inclusive após remover e recriar o par, não afeta o vínculo novo. Cada escrita usa transação completa.

Empresa/papel são validados na política central e as referências são filtradas pela empresa; visualizador não escreve e administrador também não pode cruzar empresas. Unicidades/FKs/revisão da migração 002 continuam protegendo o banco. Nenhuma migração ou alteração no banco de trabalho foi necessária. Andares/unidades diferentes são permitidos dentro da empresa. Nomes atuais, grafia e IDs vêm dos cadastros; não há caminho duplicado persistido.

### Testes de API/banco e compilação

| Verificação | Comando/procedimento | Resultado |
|---|---|---|
| Nova suíte API/PostgreSQL | `npm run test:connections` | **13/13**, zero falhas/skips. Banco exclusivo topologia_new_test08_<sufixo>, credencial sintética aleatória e remoção ao terminar. |
| Concorrência por ponto | Duas chamadas POST com mesmo ponto e portas diferentes, ambas aguardando locks reais confirmados em pg_stat_activity | **201/409**; exatamente uma conexão, igual nas duas consultas. |
| Concorrência por porta | Duas chamadas POST com pontos diferentes e mesma porta, com a mesma barreira de banco | **201/409**; exatamente uma conexão e nenhuma substituição. |
| Transferência concorrente | Duas transferências do mesmo ID/revisão/estado | **200/409**; apenas uma revisão incrementada e extremidades antigas livres. |
| Destino disputado | Duas conexões transferidas simultaneamente para mesmo ponto ou porta | **200/409** em ambos os cenários; perdedora e seu vínculo anterior íntegros. |
| DELETE contra transferência | Ambas as operações em voo no mesmo estado, bloqueadas por terceiro cliente antes da liberação | **200/409**; condição revalidada depois do lock; remoção antiga não apaga transferência/nova associação. |
| Estado esperado | Revisão/extremidades antigas, campos omitidos/tipos incorretos; remoção/recriação do mesmo par | Estado desatualizado 409; entradas inválidas 400. Novo ID preservado diante de alterações usando ID antigo. |
| Caminho e integridade | GET ponto/porta/ID e detalhes; andares distintos; renomear mesa/ponto/rack/PP/porta; rack sem localização | Mesmo DTO nos dois sentidos; caminhos atuais, IDs/revisão preservados após renomear, localização opcional null. |
| Rollback e isolamento | Associação duplicada, destino ocupado, destinos de empresa B sob A, incluindo admin; INSERT direto com FKs/unicidades | Conflitos 409; referência cruzada 404; banco rejeita FK 23503 e unicidade 23505. Vínculos existentes preservados. |
| Autorização | Mesmo usuário manager em A/viewer em B, origem inválida, revogação e desativação com sessão existente | Viewer/origem inválida 403; empresa sem acesso/revogação 404; sem sessão/usuário inativo 401. Admin autorizado opera. |
| Regressão API/PostgreSQL | `npm run test:desks`, `npm run test:racks`, `npm run test:db` | **10/10, 13/13, 35/35**. Com a suíte nova: **71 testes aprovados**. Incluem corridas de remoção de ponto/porta contra conexão e proteção de reduções. |
| Typecheck no host | `npm run typecheck` | API, testes, web e domínio aprovados. |
| Build no host | `npm run build` | Aprovado; web 266,49 kB / 79,68 kB gzip. |
| Verificação final Linux | `docker compose exec -T api npm run typecheck` e `npm run build` | Ambos aprovados no workspace inteiro. Logs em typecheck-linux.txt/build-linux.txt. |
| Operação | `npm run db:status`, health pelo proxy e `git diff --check` | Três migrações aplicadas, HTTP 200/status ok/database up e sem erros de whitespace. |

Esses testes usam sessões HTTP e SQL de banco reais; inject exercita hooks, schemas e handlers Fastify sem abrir outra porta pública. A barreira de concorrência usa terceiro cliente com FOR UPDATE e observa duas requisições aguardando locks antes de soltá-las. Não depende de apenas disparar duas promises sem provar sobreposição no banco.

### Navegador local

Playwright CLI/Chromium com banco exclusivo `topologia_new_test08_browser_b546af4afe23`, API temporária interna em 3002 e web temporária em `127.0.0.1:5174`. Administrador somente por --stage08 explícito; cadastros e conexão sintéticos criados pela nova API nesse QA.

- Consulta de mesa mostrou Ponto 1 Associado e o caminho Mesa QA 08 → Ponto 1 → Datacenter QA 08 → Rack QA 08 → Patch panel QA 08 → Porta 1. Pontos 2/3 continuaram Não associado.
- Consulta do patch panel mostrou a mesma origem na porta ocupada. Após transferência explícita pela API para Porta 2 e Atualizar acessos, Porta 1 ficou Livre e Porta 2 exibiu o caminho. Reabrir a mesa mostrou Porta 2, comprovando o consumidor inverso.
- Desvinculação explícita pela API seguida de Atualizar acessos removeu o caminho e devolveu Ponto 1 a Não associado.
- Capturas desktop e 390 × 844 inspecionadas visualmente; caminho legível com quebra de texto e sem overflow horizontal (scrollWidth 375 no Chromium com viewport 390). Não houve teste em aparelho físico.
- Console das consultas autenticadas sem erros/warnings. 401 anteriores ao login e 404 do favicon preexistente foram observados na abertura inicial, sem exceção JavaScript da aplicação.

Evidências locais ignoradas em `docs/evidencias/etapa08/`: `etapa08-mesa-desktop.png`, `etapa08-mesa-celular.png` (após transferência), `etapa08-porta-celular.png`, `etapa08-transferencia-porta.png`, `etapa08-desvinculacao.png`, logs de typecheck/build Linux e `banco-trabalho-final.txt`. Scripts e capturas originais em output/playwright, ignorado. Resultados numéricos de API/banco registrados na tabela acima.

### Ambiente e continuidade

Servidor/banco/container web de QA encerrados e removidos; arquivo de credencial e estado de sessão temporários removidos. Consulta de pg_database confirmou somente topologia_new entre bancos com esse prefixo, sem bancos sintéticos restantes. Nenhum cadastro de QA ou seed foi escrito no banco de trabalho. Snapshot final do trabalho: **2 usuários, 6 sessões, 1 empresa/concessão/unidade/andar/planta/mesa/datacenter/rack/equipamento, 8 pontos, 24 portas e 0 conexões**. Os cadastros de rack/PP existentes diferem do histórico da etapa 07 e foram preservados. O snapshot final é registrado sem alegar comparação de checksum com um snapshot inicial desta etapa que não foi coletado.

API `topologia_new`, web `topologia_new_web` e banco `topologia_new_db` continuam saudáveis. Somente web exposta em `127.0.0.1:5173`; volumes mantidos. Health final HTTP 200 em 01/10/2026 às 09:33:57 (America/Sao_Paulo).

URL local: [http://localhost:5173](http://localhost:5173). Entre com sua conta e use os IDs retornados pelos detalhes existentes conforme [CONEXOES.md](CONEXOES.md) para testar as chamadas de associação/transferência/desvinculação. Abra mesa/patch panel e use Atualizar acessos para conferir o caminho. Para repetir os cenários em banco isolado: `npm run test:connections`. `npm run dev:stop` para parar preservando volumes; `npm run dev:all` para subir.

Typecheck/build, API/PostgreSQL e navegador local são provas separadas. Sem celular físico, produção, commit, push ou publicação. **Pendências essenciais da etapa 08: nenhuma. Próxima etapa: 09 — Associação pela mesa**, somente mediante nova solicitação.

## Etapa 09 — Associação pela mesa

**Situação: Concluída em 01/10/2026.** Primeiro fluxo de cabeamento completo pela mesa, usando a API transacional existente. **Etapa 10 permanece pendente e não foi iniciada.** Alterações anteriores da etapa 08 e demais trabalho local preservados.

### Entrega e arquivos

- `apps/web/src/Desks.tsx`: ações Associar/Transferir/Desvincular por ponto, consulta dos oito pontos e caminho atual; coordenação de gravação e atualização do detalhe. Edição dos cadastros existente mantida.
- `apps/web/src/DeskConnectionEditor.tsx`: seleção datacenter → rack → patch panel → porta pelos nomes reais; datacenters de todas as unidades autorizadas da empresa identificados pela unidade, sem trocar os filtros da mesa. Equipamentos genéricos não entram no seletor. Portas mostram Livre/Ocupada, mesa/ponto nas ocupadas, contagens e resumo completo do destino; ocupadas ficam indisponíveis.
- Transferência e desvinculação com revisão e confirmação explícitas, cancelamento sem escrita e estado esperado congelado na leitura que abriu a ação. Sem troca implícita, remoção de vínculo alheio ou repetição automática com revisão nova.
- Estados de carregamento/gravação/sucesso/erro, rótulos, foco visível, erro anunciado, controles desabilitados e proteção contra submissão repetida. Trocar o pai limpa filhos; gerações descartam respostas antigas. Ajuste localizado em `style.css` mantém apresentação existente.
- Após escrita ou conflito, consultas explícitas ao ponto, porta anterior, destino tentado e eventual porta atual definida pela outra sessão, seguidas de atualização do parque/detalhe e ocupação. Mudanças detectadas por foco/30 segundos/Atualizar acessos bloqueiam a ação antiga e mostram o estado atual. HTTP 409 exige fechar e abrir uma nova ação; falha de rede também exige revisão para evitar repetir operação cuja resposta pode ter se perdido.
- Visualizadores não recebem controles/editor. A API da etapa 08 continua exigindo papel atual em cada escrita; rebaixamento de papel fecha o editor ao revalidar. Nenhuma nova migração, rota de escrita, biblioteca ou persistência paralela. Única relação permanece em `connections`.
- `apps/api/test/browser-server.ts`: opção explícita `--stage09` e origem de QA configurável por `QA_ORIGIN`. README, plano, arquitetura e `CONEXOES.md` atualizados. Skills de validação por etapa, Playwright e UI/UX Pro Max aplicadas ao escopo existente.

### Verificações

| Categoria | Verificação | Resultado |
|---|---|---|
| API/PostgreSQL | `npm run test:connections` | **13/13**; associação/inversa, concorrência com locks reais, revisão, rollback, isolamento, viewer, revogação e desativação. |
| Regressão API/PostgreSQL | `npm run test:desks`, `npm run test:racks` | **10/10 e 13/13**; preservação de pontos/portas, dependências, concorrência e papéis. |
| Domínio | `npm run test:domain` | **4/4**. Total das quatro suítes: **40 testes aprovados**, zero falhas/skips. |
| Compilação | `npm run typecheck`, `npm run build`, no host e via `docker compose exec -T api` | Aprovados; API/testes/web/domínio. Build final Linux: JS **275,30 kB / 81,97 kB gzip**. |
| Navegador | Chromium/Playwright CLI, gerente, mesa com oito pontos | Ponto 1 associado pela UI à Porta 1 do Patch panel/Rack/Datacenter QA 1 na Matriz; Ponto 2 à Porta 2 do segundo destino na Filial. Seis pontos permaneceram livres nessa prova. DTOs idênticos pelas portas; recarga preservou vínculos e URL de empresa/unidade/andar/planta/mesa. |
| Navegador | Ocupação e transferência | Porta ocupada desabilitada com mesa/ponto; genérico excluído. Revisar/cancelar preservou vínculo; confirmar transferiu Ponto 1 para Porta 3, preservou ID e incrementou revisão. Porta anterior livre; detalhe do rack apresentou Ponto 1/Porta 3. |
| Navegador + duas sessões HTTP | Outra sessão ocupou a porta selecionada antes da confirmação | **409**; ponto perdedor livre, vínculo vencedor intacto, seletor atualizado para Ocupada, repetição bloqueada e erro visível. |
| Navegador + duas sessões HTTP | Outra sessão transferiu após abrir confirmação de desvinculação | **409** no DELETE antigo; transferência preservada, ponto atualizado e nova porta consultada explicitamente. Estado atual mostrado sem substituir a revisão da ação antiga. |
| Navegador | Atualização de fundo e desvinculação | Após outra transferência, Atualizar acessos avisou mudança e bloqueou escrita antiga. Nova ação usou a leitura atual; cancelar preservou vínculo e confirmar liberou ponto/porta. Outro ponto continuou associado. |
| Navegador/API | Viewer e rebaixamento de gerente com editor aberto | Nenhum controle de escrita no viewer; POST associação, POST transferência e DELETE receberam **403/403/403**. Papel rebaixado antes de confirmar recebeu **403**, sem gravação, e a interface fechou o editor/removeu controles; concessão sintética restaurada após a prova. |
| Navegador, respostas retardadas para a prova | Carregamento e gravação | Mensagens visíveis; submissão bloqueada durante consulta/gravação e contra duplo clique. Pedido real liberado depois da barreira concluiu a associação. |
| Navegador, falha de rede simulada | POST abortado pelo Playwright | Erro visível, reconsulta do estado e necessidade de nova revisão; sem repetição automática. |
| Navegador em viewport móvel | Consulta do viewer e formulário, **390 × 844** | Textos/controles legíveis, capturas inspecionadas; `scrollWidth=375`, menor que viewport 390. Resumo do destino permite ler nomes completos fora do select. Sem teste em dispositivo físico. |
| Operação e arquivos | `npm run dev:all`, `npm run db:status`, health e `git diff --check` | Compose aguardou os três serviços saudáveis; três migrações continuam aplicadas; health HTTP 200/status ok/database up. Sem erro de whitespace; somente avisos preexistentes de conversão LF/CRLF. |

QA utilizou exclusivamente `topologia_new_test09_browser_5867c463162d`, API temporária interna em `api:3002` e web em `127.0.0.1:5175`; a porta 5174 estava ocupada por outro processo e foi preservada. Duas sessões independentes de gerenciamento e papéis sintéticos criados somente nesse banco. Console sem warnings/exceções JavaScript da aplicação; 409/403 esperados e falha de rede induzida apareceram como erros HTTP, além dos 401 de abertura sem login/favicon preexistente.

Capturas e logs locais ignorados em `docs/evidencias/etapa09/`: duas associações, ocupação, porta após transferência, conflitos, desvinculação, viewer/formulário móvel e erro de rede; logs de transferência/conflitos/desvinculação-viewer e snapshot final. Scripts de QA e capturas originais ficam em `output/playwright/`, ignorado. Uma repetição do cenário de gravação retardada corrigiu o encerramento dos interceptadores do próprio Playwright; a execução corrigida passou, sem alteração necessária na aplicação por esse erro de harness.

### Preservação e continuidade

Comparação inicial/final de **14 tabelas do banco de trabalho**, com contagens e MD5 do conteúdo ordenado por ID: **todas idênticas**, incluindo usuários/sessões/permissões e cadastros. Mantidos 2 usuários, 6 sessões, 1 empresa/concessão/unidade/andar/planta/mesa/datacenter/rack/equipamento, 8 pontos, 24 portas e 0 conexões. Não houve seed nem conexão de QA no banco do usuário.

Servidor/API/web temporários encerrados e container de QA removido; banco sintético eliminado pelo servidor, arquivo de credencial e quatro estados de sessão temporários removidos. Consulta final de `pg_database` confirmou apenas `topologia_new` entre os bancos com esse prefixo. Volumes preservados. API `topologia_new`, web `topologia_new_web` e banco `topologia_new_db` seguem **healthy**, com somente a web exposta em **127.0.0.1:5173**. Health final HTTP 200 em **01/10/2026 às 11:23:53 (America/Sao_Paulo)**.

URL de trabalho: [http://localhost:5173](http://localhost:5173). Entre com sua conta, selecione empresa → unidade → andar → planta → mesa e use Associar/Transferir/Desvincular em cada ponto. Abra o patch panel correspondente para consultar o mesmo vínculo. **Atualizar acessos** revalida consultas e permissões. `npm run dev:stop` para parar preservando volumes; `npm run dev:all` para subir novamente.

Typecheck/build, API/PostgreSQL e navegador local são provas separadas. Sem dispositivo físico, produção, commit, push ou publicação. **Pendências essenciais da etapa 09: nenhuma. Próxima etapa à época: 10 — Visualização frontal do rack e associação pela porta.**

## Etapa 10 — Rack frontal 2D e associação pela porta

**Situação: Concluída após correção e revalidação em 01/10/2026.** A entrega original, os dois achados e a aprovação parcial permanecem no histórico abaixo. As duas falhas passaram na revalidação das correções registrada ao final desta seção. **Etapa 11 — Persistência do layout e revisões mantém seu registro e suas alterações locais; etapas 12 a 21 permanecem pendentes.**

### Entrega

- `apps/web/src/RackFront.tsx`: frente do rack com U em ordem crescente de baixo para cima, altura proporcional e representação própria de equipamentos genéricos; patch panels exibem portas numeradas com estados Livre/Ocupada e o ponto ligado. Portas selecionáveis por mouse/teclado.
- `apps/web/src/RackPortEditor.tsx`: painel da porta mostra o caminho completo. Gerente pode associar ponto livre, transferir a conexão para outro ponto livre ou desvincular, cada ação com confirmação apropriada. Seleção mostra mesa e planta; nenhuma operação substitui vínculo alheio.
- A lista textual de portas mostra o mesmo estado e caminho da frente. Visualizador consulta sem controles de escrita; a API aplica o papel atual em cada escrita.
- Arrastar equipamento a uma faixa de U, mover por botões ↑/↓ e editar U inicial/altura usam o PATCH já existente. Ocupação e capacidade continuam verificadas na API e no PostgreSQL; erro 409 informa o conflito sem alterar posição nem conexão.
- `GET /companies/:companyId/points` retorna pontos com mesa, planta e conexão para o seletor. O detalhe do rack agora retorna equipamentos com portas/conexões, reduzindo chamadas da frente; associação, transferência e desvinculação usam as mesmas rotas e a mesma tabela `connections`.
- `packages/domain/src/racks.ts`, rota de rack/conexões, documentação do plano/arquitetura/contrato e opção isolada `browser-server.ts --stage10` atualizados. Sem migração, serviço, pacote ou imagem comercial.

### Verificações

| Categoria | Verificação | Resultado |
|---|---|---|
| Typecheck | `npm run typecheck` | API, testes, web e domínio aprovados. |
| Build | `npm run build` | Aprovado; bundle web 284,57 kB (84,04 kB gzip). |
| API/PostgreSQL | `npm run test:connections` | **13/13**; inclui igualdade da consulta da conexão no rack, porta, ponto e mesa, listagem de pontos, concorrência, revalidação de revisão, isolamento e papéis. Registro em `docs/evidencias/etapa10/api-connections.txt`. |
| API/PostgreSQL | `npm run test:racks` | **13/13**; inclui ocupação sobreposta, PATCH de posição, capacidade, restrições diretas no PostgreSQL, dependências e autorização. Registro em `docs/evidencias/etapa10/api-racks.txt`. |
| Navegador — gerente | Chromium/Playwright CLI em `http://localhost:5176`, API temporária em `api:3002`, origem QA `http://localhost:5176`, banco `topologia_new_test10_browser_dfb2631bdcda` | Em banco exclusivamente sintético: associação iniciada pela Porta 1, consulta pela frente/lista, transferência para Ponto 2 e retorno a Ponto 1, desvinculação confirmada e nova associação. Após cada gravação, a mesa e o rack foram atualizados. |
| Navegador — posição | Botão ↑: U inicial 2→3; arraste do servidor até U 6: início 5; formulário: início 6 | Alterações atualizadas no rack e na API. Tentativa seguinte de avançar para U 7, sobreposta ao patch panel em U 8, retornou **409** e preservou U inicial 6. Após recarregar, API confirmou `startU=6`, `heightU=2`. |
| Navegador — relação inversa/persistência | GET do rack e GET do detalhe da mesa após recarregar | Rack/porta e mesa retornaram o mesmo ID de conexão, Ponto 1 → Mesa QA → Porta 1, revisão 1. Capturas mostram o caminho nos dois contextos. |
| Navegador — acessibilidade/responsivo | Seleção da porta por botão, lista textual e viewport **390 × 844** | Lista mostra nomes completos e controles usuais; em 390 px, largura do documento permaneceu 390 px, com rolagem horizontal restrita à moldura do rack (conteúdo 604 px, janela 264 px). Sem teste em aparelho físico. |
| Operação/preservação | `npm run dev:all`, `npm run db:status`, `/api/health`, consulta aos bancos `topologia_new_test%`, `git diff --check` | Três serviços saudáveis; 001/002/003 aplicadas; health HTTP 200 e database up; nenhum banco QA restante; whitespace sem erros. Volumes existentes preservados. |

Capturas Chromium/Playwright em `docs/evidencias/etapa10/` (diretório local ignorado): `vista-frontal-rack.png`, `porta-conexao.png`, `mesa-conexao.png` e `rack-lista-portas.png`. Os registros das suítes API/PostgreSQL estão no mesmo diretório. O banco sintético e a sessão de QA foram encerrados/removidos; web/API temporários e proxy de QA foram encerrados. Nenhum cadastro de QA foi gravado no banco de trabalho; não foi necessária comparação ou restauração do volume. API `topologia_new`, web `topologia_new_web` e banco `topologia_new_db` permanecem saudáveis. Web disponível em [http://localhost:5173](http://localhost:5173); somente web exposta em loopback. `npm run dev:stop` para parar preservando dados; `npm run dev:all` para subir.

Sem validação em dispositivo físico ou produção, commit, push ou publicação. A conclusão original foi substituída pela revalidação abaixo.

### Revalidação da etapa 10 — 01/10/2026

**Resultado: aprovação parcial; duas correções pendentes.** Revisão solicitada da implementação existente, sem correções no código funcional nem trabalho nas etapas posteriores. Alterações locais preexistentes da etapa 11 preservadas.

| Achado | Reprodução e impacto | Local e correção necessária |
|---|---|---|
| P2 — Visualizador recebe ações de escrita no painel da porta | Em Chromium, perfil `viewer` seleciona Porta 1 ocupada e recebe seletor de ponto, Revisar transferência do vínculo e Revisar desvinculação. A confirmação de desvinculação envia DELETE e recebe **403**. POST de associação e transferência também retornam **403**, mantendo a conexão: a autorização da API está correta, mas a interface viola a consulta sem controles de escrita. | `apps/web/src/Racks.tsx` renderiza `RackPortEditor` sem passar `writable`; `RackPortEditor.tsx` renderiza seletor, ações e confirmação incondicionalmente. Propagar e aplicar a permissão atual, inclusive se revogada com o painel aberto. |
| P2 — Portas sobrepõem controles de posição do patch panel | Rack 12U, PP24 e PP48 de 1U, viewport **1280 × 900**. A largura fixa das portas e o cabeçalho sem redução se sobrepõem. No PP24, o centro de Editar posição atinge Porta 2; ↑ atinge Porta 6; ↓ atinge Porta 8. Clique real em Editar posição falha porque Porta 2 intercepta os eventos. O formulário externo continua disponível. | `apps/web/src/style.css`, regras `.rack-equipment-heading` e `.rack-visual-ports`, e composição em `RackFront.tsx`. Separar os alvos de interação mantendo altura proporcional à ocupação e acesso à lista equivalente. |

| Categoria | Verificação atual | Resultado |
|---|---|---|
| Typecheck / build | `npm run typecheck`; `npm run build` | **Aprovados**, API/testes/web/domínio; web 284,57 kB, gzip 84,04 kB. |
| API / PostgreSQL | `npm run test:racks`; `npm run test:connections` | **13/13 em cada suíte**, incluindo ocupação, concorrência por SQL/API, posição, IDs, relação inversa, revisão, isolamento e papéis. Bancos exclusivos dos testes. |
| Navegador — conexão | Chromium/Playwright CLI, gerente, QA em `http://localhost:5176`, banco `topologia_new_test10_browser_e4f705bb5d0c` | Porta 1 → Ponto 1 criada pela frente; vista pela mesa e pela lista. Transferência para Ponto 2 preservou ID e incrementou revisão; desvinculação liberou ambas as extremidades; nova associação aprovada. |
| Navegador — posição e integridade | Servidor genérico 2U: botão início 2→3; arraste até U6: início 5; campos: início 6; avanço para início 7 | Gravações válidas aprovadas. Sobreposição com PP24 em U8 rejeitada com **409**; início 6 e conexão preservados. Após recarregar, mesma posição e mesmo DTO da conexão. |
| Navegador — patch panel conectado | Editar equipamento pelo formulário externo: PP24 de U8→U9; recarregar | Posição 9 persistida; equipamento, IDs e conteúdo de todas as portas/conexão preservados integralmente. |
| Navegador — acesso / acessibilidade | Visualizador, seleção por Enter, viewport 390 × 844 | Seleção por teclado aprovada; consulta e lista equivalentes disponíveis. Documento com largura 375 px dentro de viewport de 390 px. API rejeita as três escritas com **403**; controles de escrita indevidos e colisão visual registrados como pendências. |

Evidências locais ignoradas em `output/playwright/validacao-etapa10/`: `typecheck.txt`, `build.txt`, `api-racks.txt`, `api-connections.txt`, `resultados.json`, `resultado-visual.json`, `browser-flows.txt` e `browser-visual.txt`. Capturas: `frente-inicial.png`, `frente-posicao-conflito.png`, `frente-sobreposicao-1280.png`, `mesa-vinculo.png`, `porta-gerente.png`, `lista-porta-vinculada.png`, `visualizador-acoes-indevidas.png`, `visualizador-api403.png` e `rack-celular.png`.

QA encerrado: navegador, servidor API temporário e container `qa10_validation_web` finalizados; banco sintético removido, sem bancos `topologia_new_test%` restantes. Credenciais/sessões temporárias removidas. Banco de trabalho não recebeu fixtures ou alterações desta validação; volumes preservados. `db:status` confirmou 001–004 aplicadas, sem executar migração. API/web/banco principais continuam saudáveis, `/api/health` retorna HTTP 200 com `database=up` e web em [http://localhost:5173](http://localhost:5173), exposta somente em loopback. `git diff --check` aprovado; avisos existentes de conversão LF/CRLF sem erros de whitespace. Parar com `npm run dev:stop`, preservando volumes.

**Pendências registradas nesta revalidação:** corrigir as duas falhas e repetir os cenários afetados antes de devolver a situação a Concluída. Sem teste em dispositivo físico ou produção. Nenhum commit, push, publicação, migração ou alteração funcional foi realizado nesta validação.

### Correções e revalidação da etapa 10 — 01/10/2026

**Resultado: Concluída.** Ambas as falhas P2 acima foram corrigidas e passaram nos cenários afetados, incluindo revogação durante consulta assíncrona e cliques reais na frente do rack em computador/celular. O histórico dos achados foi mantido. Escopo funcional limitado a `Racks.tsx`, `RackPortEditor.tsx`, `RackFront.tsx` e `style.css`; sem mudança no banco de trabalho, migrações, contratos públicos ou implementação da etapa 11.

- Permissões: propriedade interna obrigatória `writable`, usando o papel já calculado pela aplicação. Visualizador recebe somente consulta atual, atualização e fechamento; candidatos carregados apenas com escrita. Perda da permissão cancela confirmação e limpa seleção. Gravação protegida na entrada e após as consultas, com atualização de acessos em 403. A revisão original das confirmações e o tratamento de conflitos foram preservados.
- Layout: frente mínima de **900 px**, rolagem horizontal somente na moldura, **40 px por U**. Patch panels usam identificação, controles e portas em colunas separadas; genéricos usam identificação e controles. Truncamento apenas da identificação, com nomes completos na lista e atributos de consulta. Portas excedentes rolam dentro da área disponível sem aumentar a altura representada.

| Categoria | Procedimento | Resultado |
|---|---|---|
| Typecheck / build | `npm run typecheck`; `npm run build` | **Aprovados**. Domínio/API/testes/web verificados; bundle web 285,07 kB, gzip 84,19 kB. |
| API / PostgreSQL | `npm run test:racks`; `npm run test:connections` | **13/13 em cada suíte**, bancos separados criados/removidos pelos testes. |
| Navegador — visualizador | Chrome/Chromium via Playwright CLI, portas livres/ocupadas, seleção por Enter e lista equivalente | Somente Fechar porta e Atualizar porta. **Zero GET da lista de candidatos e zero gravações iniciadas pela interface**. Estado/caminho atualizados com painel aberto após associação em outra sessão e retorno a Livre após desvinculação/Atualizar acessos. |
| API — visualizador | POST de associação, POST de transferência e DELETE de conexão com sessão viewer | **403/403/403**; DTO da conexão integralmente preservado. |
| Navegador — revogação | Rebaixar gerente com transferência confirmável aberta; Atualizar acessos; restaurar papel | Confirmação e seletor desaparecem, consulta continua aberta, nenhuma escrita iniciada. Ao restaurar papel, ponto selecionado vazio e confirmação cancelada. |
| Navegador — 403 / consulta em voo | Rebaixar antes de confirmar desvinculação; depois rebaixar com resposta de GET anterior à transferência retida pelo Playwright | DELETE retorna **403**, acessos atualizados e controles retirados. No segundo cenário, soltar a resposta após revalidar os acessos gera **zero POST de transferência**, sem alteração do vínculo. |
| Navegador — gerente | Associação pela Porta 1, consulta pela mesa, transferência confirmada para Ponto 2 e desvinculação confirmada | Associação inversa correta; transferência mantém ID e incrementa revisão; desvinculação libera mesa e porta. Nova associação realizada para testar o patch panel conectado. |
| Navegador — revisão / conflito | Outra sessão transfere antes das consultas; outra transfere após as consultas, antes do POST retido pelo Playwright | Primeiro cenário impede POST e mostra estado atual. Segundo envia o `expected` original, recebe **409**, cancela confirmação e atualiza o caminho sem sobrescrever o vínculo concorrente. |
| Navegador — layout | **1280 × 900** e **390 × 844**; PP24/PP48 de 1U, servidor 2U, nomes longos e PP96 de 1U | Alturas **40/40/80/40 px**; colunas sem invasão. PP24/PP48 cabem na área vertical; PP96 rola internamente e sua última porta é consultável. Frente mede 900 px; documento não excede o viewport. Centros dos controles/portas atingem o próprio botão. |
| Navegador — cliques reais | Nas duas resoluções: Editar posição, ↑/↓ e portas de PP24/PP48; Editar posição e ↑/↓ no genérico | **Todos atingem o equipamento/porta correto**, com PATCH e posição confirmados pela API. Nomes completos recuperados no formulário/lista. Capturas mostram moldura, controles e portas em diferentes posições da rolagem. |
| Navegador/API — integridade | Genérico: botões 2→3→2, arraste para início 5, campos para 6. PP24 conectado: botões 8→9→8, arraste para 4, campos para 9 | IDs e conteúdo integral de portas e pontos/conexões preservados após cada movimento. Sobreposições do genérico e do patch panel recebem **409**, sem alterar posição/cabeamento. Recarga confirma posições **6 e 9**. Rodada adicional de ↑/↓ nas duas resoluções preserva posições, IDs e vínculos após nova recarga. |
| Preservação / operação | Contagens e MD5 ordenados por ID em **15 tabelas** antes/depois; consulta de bancos QA; health e Compose | Todas as tabelas do banco de trabalho **idênticas**, incluindo usuários/sessões. Nenhum banco `topologia_new_test%` restante. Migrações 001–004 apenas consultadas no banco de trabalho. Três serviços principais **healthy**; health HTTP **200**, `database=up`, às **13:47:08 (America/Sao_Paulo)**. |

QA em `http://localhost:5176`, API temporária `api:3002`, banco exclusivo `topologia_new_test10_browser_0233b18ccaa1`; fixture sintética com gerente, viewer e administrador próprios. Servidor/API temporário encerrado, container `qa10_correction_web` removido, banco e todas as suas sessões eliminados, credencial `runtime.json` e três arquivos de sessão removidos. Navegador de QA encerrado. Web principal preservada em [http://localhost:5173](http://localhost:5173), exposta somente em **127.0.0.1:5173**; volumes preservados.

Evidências locais ignoradas em `output/playwright/correcao-etapa10/`: `typecheck.txt`, `build.txt`, `api-racks.txt`, `api-connections.txt`, `browser-{layout,flows,permissions,revocation,conflicts,mobile}.txt` e relatórios correspondentes `*-resultados.json`; snapshots `banco-trabalho-antes.json`, `banco-trabalho-depois.json` e `banco-status-final.json`. O harness de revogação precisou aguardar a conclusão de `route.fulfill` antes de remover o interceptador; a execução corrigida passou, sem alteração na aplicação por esse erro do próprio QA.

Capturas: `rack-{1280,390}.png`, `rack-controles-{1280,390}.png`, `rack-portas-{1280,390}.png`, `mesa-vinculo.png`, `lista-vinculo.png`, `gerente-confirmacao.png`, `gerente-porta.png`, `visualizador-livre.png`, `visualizador-ocupada.png`, `visualizador-consulta-atual.png`, `visualizador-porta-{1280,390}.png`, `revogacao-confirmacao-aberta.png`, `revogacao-somente-consulta.png`, `revogacao-api403.png`, `revogacao-consulta-em-voo.png`, `conflito-preconsulta.png` e `conflito-api409.png`. `git diff --check` sem erros de whitespace, registrado em `diff-check.txt`.

**Pendências essenciais da etapa 10: nenhuma.** Validação em navegador local com viewports simulados; sem dispositivo físico, produção, commit, push ou publicação. Etapa 11 preservada e concluída; etapas 12 a 21 pendentes.

## Etapa 11 — Persistência do layout e revisões

**Situação: Concluída em 01/10/2026.** Documento de geometria persistido sem dependência do Konva, com leitura/salvamento versionados, validação das referências atuais e controle transacional de revisão. Registro da entrega de persistência; o editor entregue posteriormente está na seção da etapa 12 abaixo.

### Entrega

- `packages/domain/src/layout.ts` define o snapshot v1: geometria da planta, câmera em pixels separada das dimensões em metros, listas identificadas de mesas, racks e setores. O validador rejeita formato/formas inválidos, campos extras em todos os níveis, UUID ausente/malformado e IDs duplicados dentro de cada coleção ou entre tipos, independentemente da capitalização.
- `GET` e `PUT /api/companies/:companyId/plans/:planId/layout` entregam leitura e salvamento para as plantas da empresa. Leitores podem consultar; gravações exigem gerente ou administrador pela política central. PUT aceita até 1 MiB para geometria e listas de objetos.
- Migração incremental `004_layout_revisions.sql` adiciona `plans.camera` e revisão automática para inclusão, remoção, mudança de posição/filiação de mesas e racks e alterações em setores. Sem reset de banco/volume.
- A gravação bloqueia a planta, compara `expectedRevision`, exige o conjunto completo atual dos IDs de mesas/racks/setores e bloqueia os objetos com `FOR NO KEY UPDATE NOWAIT` antes de atualizar em uma transação. Revisão/membros divergentes ou cadastro em edição retornam **409** com rollback; corpo geométrico inválido/ID repetido retorna **400**; planta fora da empresa retorna **404**. `placement: null` de rack é persistido como SQL `NULL`.
- Posições seguem em `desks.placement` e `racks.placement`, polígonos em `sectors.polygon`, paredes/aberturas/fundo em `plans.geometry`, câmera em `plans.camera`. Mesas, pontos, setores, racks, equipamentos, portas e conexões não são recriados, apagados nem copiados para JSON. O snapshot não contém pontos/conexões e nenhuma tabela de cabeamento é escrita pelo salvamento.
- `docs/GEOMETRIA.md` e `docs/IMPLEMENTACAO.md` documentam contrato, coordenadas, revisão, autorização e respostas. Nenhum editor Konva, importador ou fluxo de desfazer/refazer foi iniciado.
- Referências de arquivos de fundo permanecem reservadas à etapa 14. O layout rejeita introdução/substituição de IDs de arquivos com **400**, sem aceitar referências novas não verificadas; permite preservar IDs de fundo preexistente, alterar sua transformação ou removê-lo.

### Verificações

| Categoria | Verificação | Resultado |
|---|---|---|
| Typecheck | `npm run typecheck` | API, testes, web e domínio aprovados. |
| Build | `npm run build` | Domínio/API/web aprovados; bundle 284,57 kB (84,04 kB gzip). |
| Domínio | `npm run test:domain` | **4/4**. |
| API/PostgreSQL | `npm run test:layout` | **12/12**: round trip, comparação integral de pontos/equipamentos/portas/conexões, revisão desatualizada, duas gravações da mesma revisão (200/409 e estado integral do vencedor), edição cadastral em curso (409 sem deadlock/gravação parcial), IDs repetidos/inexistentes/de outra empresa/planta, alteração/inclusão/exclusão cadastral após leitura, campos extras e arquivos de fundo rejeitados, rack sem posição, viewer/gerente e rebaixamento com sessão existente. Banco QA criado e removido pelo teste. |
| Upgrade PostgreSQL | `npm run test:db` | **36/36**. Instalação nova e upgrades 001→004 e 003→004 com dados sintéticos; o segundo compara 12 tabelas, incluindo racks, equipamentos, portas e conexões. Registros preservados e esquema igual ao banco novo; lock e checksum aprovados. |
| Regressão API/PostgreSQL | `npm run test:park`, `npm run test:desks`, `npm run test:racks`, `npm run test:connections` | **9/9, 10/10, 13/13 e 13/13**. Sem regressões de autorização, filiação, posição em U ou cabeamento. |
| Operação | `npm run db:status`, `docker compose ps`, `/api/health`, `git diff --check` | Migração 004 já aplicada ao volume de trabalho confirmada na revalidação; 001–004 aplicadas, sem edição das migrações existentes. API, banco e web healthy; web exposta somente em `127.0.0.1:5173`. Health HTTP 200/database up e `git diff --check` sem erros de whitespace. |

Total após revalidação em **01/10/2026: 97 testes aprovados** nas suítes acima. O teste adicional de edição em curso reproduziu HTTP **503** por deadlock na implementação inicial; o salvamento agora rejeita o lock conflitante com **409** antes de gravar. Também foi corrigido HTTP **503** ao salvar rack sem posição. Campos extras e novas referências de fundo passaram a ser recusados. As consultas no mesmo cliente deixaram de ser enfileiradas por `Promise.all`, eliminando o aviso de depreciação do `pg` na suíte de layout.

Os upgrades sintéticos comparam as linhas anteriores ignorando apenas a nova coluna `camera`. Nesta revalidação não houve migração pendente, reset de volume nem gravação no banco de trabalho; comparação de contagens e MD5 do conteúdo completo em **15 tabelas** confirmou dados idênticos antes/depois. Todos os bancos QA foram removidos pelos testes. Logs em `docs/evidencias/etapa11/validacao-*.txt` e snapshots em `banco-trabalho-antes.json`/`banco-trabalho-depois.json`, arquivos locais ignorados. Sem interface nova nesta etapa, teste visual, dispositivo físico ou produção.

O app segue em [http://localhost:5173](http://localhost:5173); entre com a conta existente e consuma os endpoints descritos em [GEOMETRIA.md](GEOMETRIA.md). Não há interface de editor nesta etapa. `npm run dev:stop` para parar preservando volumes; `npm run dev:all` para subir novamente. **Pendências essenciais da etapa 11: nenhuma. Próxima etapa: 12 — Área de desenho e posicionamento de mesas/racks**, somente mediante solicitação própria.

## Etapa 12 — Área de desenho e posicionamento

**Situação: Concluída em 01/10/2026.** Editor 2D em Konva integrado à persistência/revisões existentes. **Etapas 13 a 21 permanecem pendentes.** Sem migração, dados sintéticos no banco de trabalho, commit, push ou publicação.

### Entrega e arquivos principais

- `PlanEditor.tsx`, `PlanCanvas.tsx` e `layoutEditor.ts`: seleção no canvas/lista HTML, zoom no cursor, câmera por arraste/botões, enquadramento considerando rotação, grade adaptativa e ajuste opcional a 0,25 m. Mesas e racks cadastrados podem ser posicionados, dimensionados e girados pelas alças ou por campos em metros; botões de rotação e alinhamento à grade/centros X/Y. IDs existentes são a referência de cada representação; sem cópias de pontos, equipamentos, portas ou conexões no histórico.
- Salvamento explícito pelo PUT da etapa 11 e indicação de alterações pendentes. Histórico de até 100 operações somente de posições; salvar mantém o histórico, enquanto recarga/reconciliação o substitui. Câmera fica separada. Falha mantém o rascunho; 409 bloqueia novas edições/gravações até recarregar com descarte confirmado ou reconciliar posições locais de IDs atuais. Nenhum retry automático. A reconciliação preserva alterações remotas em objetos não editados localmente; se o mesmo objeto mudou nas duas sessões, prevalece sua posição local, com conferência e salvamento explícitos.
- `layout/routes.ts`: POST para vincular rack cadastrado sem planta, mesma empresa/unidade, revisão esperada e locks; preserva datacenter/equipamentos/portas e usa o trigger existente para avançar a revisão. Vinculação fora do histórico, com layout sem pendências; depois a posição é editada pelo PUT. Rack com posição nula pode ser posicionado; retirar posição mantém seu cadastro/filiação.
- `navigation.ts`, `Park.tsx`, `Workspace.tsx` e `App.tsx`: integração contextual, carregamento sob demanda e guard antes da navegação interna/logout, Voltar/Avançar e recarga/fechamento. Cancelar a saída mantém contexto e rascunho. Visualizador seleciona/consulta e navega pela câmera, sem controles ou chamadas de escrita; propriedades desabilitadas e API autorizando cada requisição.
- Dependências exatas Konva 10.7.0/react-konva 19.3.0 e lockfile. CSS existente adaptado à área de planta e lista/propriedades responsivas, sem antecipar identidade visual, paredes/setores, importação ou busca integrada. Geometria, setores e referências de fundo existentes passam intactos pelo snapshot.
- `apps/web/test/layoutEditor.test.ts`, suíte de layout da API ampliada e servidor opcional de QA `--stage12`. README, IMPLEMENTACAO, GEOMETRIA e plano atualizados.

### Verificações

| Categoria | Procedimento | Resultado |
|---|---|---|
| Typecheck/build | `npm run typecheck`; `npm run build` | Aprovados em domínio/API/web. Konva/editor em chunk separado, sem aviso de bundle maior que 500 kB. |
| Histórico/geometria do cliente | `npm run test:layout-editor` | **3/3**: histórico não restaura membro removido nem câmera/geometria/setor; reconciliação mantém apenas posições locais de IDs atuais, preservando mudanças remotas restantes; enquadramento com rotação e coordenadas negativas. |
| API/PostgreSQL | `npm run test:layout` | **13/13**: contratos/revisões/concorrência e integridade anteriores; novo vínculo de rack com revisão, empresa/unidade, posição nula e 403 de visualizador; tabelas de cabeamento integralmente preservadas. |
| Regressão API/PostgreSQL | `npm run test:racks`; `npm run test:connections` | **13/13 + 13/13**, preservando ocupação em U, IDs, portas, relação única, concorrência, estado esperado e papéis/revogação. |
| Navegador — mesa/rack | Chromium com Playwright CLI, gerente, 1280 × 900 | Mesa de oito pontos: arraste X 1→2 m e Y 2→2,5 m com grade; Girar 90°, desfazer/refazer, campos e salvar. Rack existente vinculado, posicionado em X 4/Y 2, dimensionado 0,8 × 1,2 m e girado 30°. |
| Navegador — alças/alinhamento/câmera | Mouse real nas alças e canvas; campos e botões | Dimensionamento aproximadamente 1,6 × 0,8→2 × 1 m; alça de rotação chega a 90°. Alinhamento à grade e de centros Y aprovado. Câmera por arraste, zoom no cursor e por botão, deslocamento por botão e enquadramento aprovados. |
| Navegador — persistência/integridade | Salvar, recarregar, comparar snapshot e DTOs completos da mesa/rack | Posições/dimensões/rotação/câmera reproduzidas. IDs e conteúdo de pontos/equipamentos/portas/conexões preservados integralmente após os movimentos. O vínculo gráfico do rack acrescenta planta/andar ao caminho derivado, mantendo a relação canônica. |
| Navegador — histórico independente | Transferir conexão real para outro ponto, depois desfazer/refazer posições | Nova revisão e extremidades da conexão permanecem intactas. Histórico não grava cabeamento. |
| Navegador — revisão/conflito | Outra aba grava a mesma planta, depois gerente tenta PUT antigo | HTTP **409**; posição local mantida, salvamento bloqueado. Reconciliar manteve a mesa editada localmente e a posição remota do rack; conferência e novo salvamento explícitos aprovados. |
| Navegador — falha de gravação | Interceptar PUT com **503**, depois falha de transporte | Erros visíveis, edição/rotação e indicação pendente preservadas; revisão do banco não avança. Recuperação seguida de salvamento aprovada. |
| Navegador — cadastro removido | Criar mesa sintética, editar posição, remover ponto livre/mesa em outra sessão, salvar/reconciliar | PUT antigo recebe 409; mesa removida desaparece do rascunho e não é restaurada pelo histórico. Mesas/racks restantes preservados. |
| Navegador — saída pendente | Voltar do navegador, logout e recarga, cancelar os três avisos | Contexto da planta e rotação local preservados após os cancelamentos; salvamento posterior aprovado. |
| Navegador — visualizador | Seleção por Enter, consulta, câmera, chamadas diretas PUT/POST | Sem salvar/desfazer/refazer/propriedades editáveis/vinculação. **Zero escritas iniciadas pela interface**. Chamadas diretas retornam **403/403**, snapshot idêntico. Câmera local não gera edição pendente. |
| Navegador — responsivo/visual | Capturas inspecionadas de gerente/visualizador; viewport 390 × 844 | Documento não ultrapassa o viewport; canvas contido e lista/propriedades empilhadas. Nenhum teste em aparelho físico. |
| Preservação/operação | Contagens e MD5 ordenados por ID em 15 tabelas antes/depois; status do banco/Compose/health; `git diff --check` | Banco de trabalho **idêntico**, incluindo usuários/sessões. Migrações 001–004 aplicadas, sem nova migração/reset; nenhum banco QA restante. Serviços principais healthy, web somente em loopback; whitespace aprovado. |

Total: **42 testes automatizados aprovados**, além dos cenários no navegador. A inspeção real das alças identificou a necessidade de sincronizar também o node ao ajustar à grade (uma prop que permanece igual não é reaplicada pelo modo não estrito do react-konva); correção revalidada. A margem de enquadramento passou a acomodar a alça de rotação. Voltar foi centralizado no Workspace antes de atualizar o contexto, e passou nos cancelamentos. O harness aguarda a pintura do canvas antes de clicar nas alças; erros de medição durante iterações e de repetição de salvamento sem mudanças foram corrigidos no próprio QA, com rodadas finais aprovadas.

QA em `http://localhost:5176`, API temporária `api:3002`, banco exclusivo `topologia_new_test12_browser_fe82267acd45`, administrador/gerente/visualizador e fixtures sintéticos. Navegadores, servidor/API temporário e container `qa12_web` encerrados; banco QA, sessões, `runtime.json` e os três arquivos de autenticação removidos. Nenhuma fixture no banco de trabalho; volumes preservados. API `topologia_new`, web `topologia_new_web` e banco `topologia_new_db` permanecem em execução e saudáveis.

Evidências locais ignoradas em `output/playwright/etapa12/`: `typecheck.txt`, `build.txt`, `editor-history.txt`, `api-{layout,racks,connections}.txt`, `browser-flows-final.txt`, `browser-handles-final.txt`, `browser-conflicts-final.txt`, `browser-deletion.txt`, `browser-viewer-final.txt`, `navigation-{back,logout,reload,result}.txt`, snapshots `banco-trabalho-antes.json`/`banco-trabalho-depois.json`, `banco-status-final.json` e `diff-check.txt`. Capturas: `planta-gerente.png`, `planta-alcas.png`, `conflito-revisao.png`, `falha-gravacao.png`, `planta-390.png` e `planta-visualizador{,-390}.png`.

Para validar manualmente: abra [http://localhost:5173](http://localhost:5173), entre com a conta existente e selecione Empresa → Unidade → Andar → Planta. Use a lista ou o canvas, altere posição/medidas/rotação e **Salvar layout**; reabra para conferir. Racks sem planta podem ser vinculados pela lista da própria área. `npm run dev:stop` para parar preservando volumes; `npm run dev:all` para subir. **Pendências essenciais da etapa 12: nenhuma. Próxima etapa: 13 — Paredes, portas, janelas e setores**, somente mediante solicitação própria. Sem validação em dispositivo físico ou produção.

## Etapa 13 — Paredes, portas, janelas e setores

**Situação: Concluída em 02/10/2026.** Desenho do local do zero, sem importação ou detecção automática. Etapas 14 a 21 permanecem pendentes; sem commit, push ou publicação.

### Entrega e arquivos principais

- `PlanEditor.tsx`, `PlanCanvas.tsx`, `ArchitecturePanel.tsx`, `layoutEditor.ts`: ferramentas de desenho por cliques, seleção no canvas/lista, paredes arrastáveis com extremos editáveis, setores poligonais com arraste/alças de vértices, porta/janela ligada à parede e propriedades por campos. Criação por campos para todos os tipos; abertura pode ser configurada antes de entrar no desenho, inclusive numa parede curta. Nomes únicos de setores e seletor **Setor da mesa**, com opção sem setor e contagem de mesas por setor. Enquadramento inclui a arquitetura.
- `packages/domain/src/{geometry,layout}.ts`: geometria em metros independente de Konva; polígonos simples, área/vértices válidos, aberturas inteiras dentro da parede sem sobreposição, IDs sem colisões entre tipos selecionáveis e relações de mesas para setores presentes. Campo de nome e setor da mesa ampliam o v1 de forma compatível.
- `apps/api/src/layout/routes.ts`: PUT atômico cria/renomeia/remove setores canônicos e grava `desks.sector_id`, preservando a revisão/locks/autorização. `newSectorIds` declara criação/recriação intencional; IDs cruzados ou já existentes são recusados. Mesas/racks exigem conjunto completo. Setor removido desvincula as mesas antes do DELETE; não remove mesas, pontos ou conexões. Omissão de campos novos em clientes anteriores mantém seus valores, exceto associação ao setor removido.
- `database/migrations/005_sector_editing.sql`: migração aditiva, com unicidade diferível para troca atômica dos nomes e trigger de revisão incluindo renomeação. Aplicada no volume de trabalho após backup local `backup/stage13-before.dump`; arquivos 001–004 e volumes preservados.
- Histórico local de até 100 operações para posições, paredes/aberturas, setores/nomes e relações mesa-setor. Câmera e cabeamento permanecem separados. Salvar mantém histórico; desfazer exclusão de setor após salvar recria seu ID e relação explicitamente. Conflito mantém rascunho e bloqueia edição/gravação; reconciliação restrita às posições pede confirmação de descarte das outras edições locais.
- Políticas de dependências: mover parede/extremos mantém offsets das aberturas; encurtar só é permitido se todas couberem. Remover parede remove suas aberturas após confirmação. Mover ou alterar setor não reassocia mesas automaticamente. Remover setor somente desvincula as mesas, com confirmação e histórico integrado.
- Testes de domínio/cliente/API/banco ampliados, servidor de QA opcional `--stage13`, README, GEOMETRIA, IMPLEMENTACAO e plano atualizados.

### Verificações e evidências

| Categoria | Procedimento | Resultado |
|---|---|---|
| Typecheck/build | `npm run typecheck`; `npm run build` | Aprovados em domínio, API, testes e web. Editor continua em chunk separado. |
| Domínio | `npm run test:domain` | **6/6**: medidas, polígonos, cruzamentos/retrocesso, aberturas órfãs/fora da parede/duplicadas/sobrepostas, contato válido de extremidades e fundo. |
| Histórico do desenho | `npm run test:layout-editor` | **4/4**: remoção de parede leva aberturas, setor desvincula sem apagar mesas; undo restaura IDs/relações e mantém câmera; regressões de posições/reconciliação/enquadramento. |
| API/PostgreSQL | `npm run test:layout` | **14/14**: round trip, locks/concorrência/revisões, papéis/isolamento, setores novos explícitos, permuta de nomes, relação válida/cruzada, remoção sem apagar mesa/ponto/conexão, rollback de nomes duplicados, clientes anteriores e restauração explícita de setor. |
| Migrações/upgrade | `npm run test:db` | **37/37**: instalação nova, upgrades 001→005 e 003→005, novo upgrade 004→005 com 8 tabelas preservadas e revisão em renomeação, mesmo esquema final, checksum/concorrência e integridade. |
| Regressões | `npm run test:desks`; `npm run test:connections` | **10/10 + 13/13**: pontos, IDs, dependências, autorização, relação única e concorrência de cabeamento preservados. |
| Navegador — desenho do zero | Chromium/Playwright CLI em QA isolado, 1280 × 900 | Hierarquia criada pela interface. Duas mesas com 8 pontos; quatro paredes delimitando sala, porta e janela desenhadas por clique; dois setores poligonais nomeados **Atendimento** e **Engenharia**. |
| Navegador — relações/persistência | Associar uma mesa a cada setor; desfazer/refazer associação; salvar e reload completo | Snapshot de API idêntico antes/depois; nomes/IDs/polígonos/aberturas e `sectorId` mantidos. Seletor da mesa mostrou o setor correto após reabrir. Consulta direta no PostgreSQL de QA confirmou 2 mesas, 16 pontos, 2 setores e as relações Atendimento/Engenharia. |
| Navegador — dependências/edição | Encurtar parede com aberturas, espessura por campos, remover parede/undo; remover setor/salvar/undo/salvar | Medida que deixava aberturas fora da parede recusada sem alteração do desenho. Parede removida leva as 2 aberturas; undo restaura IDs. Setor removido deixa a mesa sem setor; gravar preserva as 2 mesas; undo após salvar restaura setor e relação com mesmo ID. |
| Navegador — alças/campos | Mouse real em extremo de parede/vértice do setor; campo de polígono inválido; criação por campos de parede curta/porta/setor | Extremo da parede Y 0,5→1 m e vértice X 4,5→4,25 m confirmados nos campos, depois desfeitos. Polígono inválido recusado. Porta de 0,4 m criada por campos em parede de 0,5 m; operações desfeitas até revisão salva. |
| Visual/responsivo | Capturas desktop/390 × 844 inspecionadas; `scrollWidth <= innerWidth` | Sem overflow do documento; controles/lista/propriedades empilhados. Canvas tem câmera própria e pode ser enquadrado no viewport. Sem teste em aparelho físico. |
| Preservação de trabalho | Comparar contagens/MD5 ordenados por ID ao backup anterior | **15 tabelas idênticas**, incluindo usuários/sessões e todos os cadastros/conexões. Apenas esquema/histórico de migração atualizado; nenhuma fixture no banco de trabalho. |
| Operação/whitespace | `npm run db:status`; Compose/health; `git diff --check` | Migrações 001–005 aplicadas, serviços principais saudáveis, interface em `127.0.0.1:5173`, health HTTP 200/database up; whitespace aprovado. |

Total: **84 testes automatizados aprovados**, além dos cenários no navegador. A validação identificou e corrigiu a interceptação das alças de setor por paredes nas bordas; agora as alças ficam em camada superior e o arraste passou. O harness passou a aguardar o término da gravação antes de recarregar, respeitando a proteção de saída enquanto a operação está ocupada. Para comparar o conteúdo do dump, foi usado um restore em banco temporário com `search_path=public`: o restore padrão havia falhado em funções geométricas com chamadas não qualificadas. Isso não altera as funções/migrações anteriores; procedimento definitivo de backup/restauração permanece na etapa 20.

Evidências locais ignoradas: `output/playwright/etapa13/{typecheck,build,api-layout}.txt`, `browser-database-final.json`, `banco-trabalho-preservado.json`, `planta-final.png` e `planta-390.png`. Scripts de interação em `output/playwright/{drawing,sectors,save-reload,dependencies,handles-final,fields-final,final}.cjs`; snapshots/logs em `.playwright-cli/`. QA em `http://localhost:5174`, API temporária interna `api:3002` e banco `topologia_new_test13_browser_039f6af4dee8`. Navegador, servidor e web QA encerrados; banco QA e `runtime.json` removidos. Backup local preservado; banco temporário de comparação removido.

Para validar: abra [http://localhost:5173](http://localhost:5173), entre com a conta existente e selecione Empresa → Unidade → Andar → Planta. Desenhe paredes/aberturas/setores ou use criação por campos; nomeie setores, selecione as mesas e escolha **Setor da mesa**. Use **Salvar layout**, recarregue e confira os seletores/contagens. `topologia_new`, `topologia_new_web` e `topologia_new_db` continuam em execução. `npm run dev:stop` para parar preservando volumes; `npm run dev:all` para subir. **Pendências essenciais da etapa 13: nenhuma. Próxima etapa: 14 — Importação de plantas e calibração de escala**, somente mediante solicitação. Sem validação em dispositivo físico ou produção.

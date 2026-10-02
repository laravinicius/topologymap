# Consulta no celular — etapa 17

O visualizador autenticado consulta o parque completo das empresas autorizadas. O QR público mantém o contrato da etapa 16: somente a mesa, seus pontos e destinos, sem acesso à hierarquia ou navegação para o parque.

## Uso

1. Entre na aplicação e escolha a empresa. Use **Navegar na hierarquia** para abrir Unidade → Andar → Planta ou Datacenter → Rack.
2. **Buscar no parque** abre a busca recolhível. Nome, filtros, paginação e links de consulta/localização continuam disponíveis em tela pequena, inclusive para objetos sem planta ou posição.
3. Na planta, **Ver desenho** e **Ver lista e detalhes** levam às duas representações. Toque seleciona; arrastar com um dedo move a câmera durante a consulta; pinça com dois dedos amplia/reduz em torno do centro dos dedos. Botões de zoom, enquadramento e movimentação oferecem alternativa aos gestos. A rolagem da página continua disponível fora do mapa.
4. Abra uma mesa e um ponto para consultar o caminho, o destino ou a origem. Localizar mesa/rack abre o contexto da planta correspondente. Detalhes e listas ficam em uma coluna no modo compacto.
5. A vista frontal do rack desliza dentro do seu próprio contêiner. **Consultar equipamentos e portas pela lista** evita depender das pequenas portas gráficas: selecione o equipamento e consulte portas livres/ocupadas com controles grandes e nomes completos.
6. O endereço `/mesa/:token` abre sem login. Mostra todos os pontos da mesa e os nomes dos destinos, com estados associado/não associado, carregamento, erro e mesa sem pontos.

## Apresentação e autorização

Até **900 CSS px**, a interface apresenta consulta e recolhe a busca inicialmente; as ferramentas de cadastro/edição ficam no computador. Acima desse limite, gerente/admin conservam as ferramentas existentes. Esse limite é de apresentação, inclusive em tablet ou orientação horizontal; não identifica um dispositivo físico.

O papel continua vindo da conta/empresa e sendo aplicado na API a cada requisição. A etapa não altera hooks, políticas, sessões, rotas, migrações ou DTOs. Uma tela pequena não retira a permissão de API do gerente, nem uma tela grande concede escrita ao visualizador. Redimensionar mantém o rascunho/histórico da planta e a proteção contra saída com alterações pendentes. Câmera de consulta e gestos não escrevem o layout.

Nenhuma informação essencial exige hover. Estados de conexão têm texto; seleção funciona por toque/clique/lista. Controles de leitura têm alvo mínimo de 44 × 44 CSS px, considerando o label clicável da grade. As portas gráficas compactas têm alternativa equivalente pela lista. O fundo importado mantém download por links com alvo adequado.

`ObjectLink` descarta uma resposta de localização se outra navegação ocorreu enquanto aguardava a API, preservando a seleção mais recente. O tratamento de pinça usa coordenadas locais ao canvas e escala limitada a 0,05–8, seguindo o mecanismo documentado em [Konva — Multi-touch Scale Stage](https://konvajs.org/docs/sandbox/Multi-touch_Scale_Stage.html). O modo compacto acompanha mudanças de largura com [MDN — matchMedia](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia).

## Prova local de 02/10/2026

Chromium real conduzido por Playwright CLI, banco sintético exclusivo com duas empresas autorizadas e outra restrita, mesas com oito pontos, destinos em dois datacenters/plantas e patch panel com **48 portas**. O servidor opcional `apps/api/test/browser-server.ts --stage17` cria essas fixtures somente no banco de QA.

| Viewport CSS | Orientação | Consulta autenticada e QR | Maior largura do documento medida |
|---|---|---|---|
| 360 × 800 | Vertical | Aprovadas | 345 px |
| 375 × 812 | Vertical | Aprovadas | 360 px |
| 390 × 844 | Vertical | Aprovadas | 375 px |
| 768 × 1024 | Vertical | Aprovadas | 753 px |
| 844 × 390 | Horizontal | Aprovadas | 829 px |
| 1280 × 900 | Computador | Aprovadas | 1265 px |

A diferença de 15 px corresponde à barra vertical deste Chromium. `scrollWidth <= innerWidth` em hierarquia/planta, mesa/pontos, rack/48 portas/lista, rack/planta e busca; nenhum overflow horizontal do documento. A frente do rack possui rolagem horizontal intencional interna.

Em cada viewport, o visualizador percorreu hierarquia → planta/lista → mesa/ponto → destino/porta → porta 48 pela lista → rack na planta → consulta inversa → busca → ponto → recarga. Estados vazios de busca/hierarquia e carregamento/erro foram exercitados; o 503 de busca foi simulado por interceptação controlada. QR sem pontos e token inválido usaram respostas reais do banco/API de QA; carregamento foi mantido por atraso controlado. QR: oito pontos, zero cookies, zero navegação interna, somente pedidos à API pública.

Eventos de toque nativos do Chromium via **CDP `Input.dispatchTouchEvent`** comprovaram tap para seleção, pinça (134% → 269%) e pan por mudança na imagem do canvas, com layout/revisão idênticos antes/depois. Testes da câmera cobrem ancoragem, transições de quantidade de dedos, contatos coincidentes e limites. Um resolvedor atrasado foi retido/liberado no navegador e não sobrescreveu o ponto selecionado depois. Movimento reduzido foi conferido na seleção/lista.

Escrita direta de layout com payload válido: **403** para visualizador em 360 e 1280 px. Gerente em 768 px: **200** em PATCH sem mudança de nome, apesar da edição oculta na interface. Gerente no computador: posição X 3 → 3,25, salvar/recarregar; rascunho X 4 mantido ao mudar 1280 → 768 → 1280 e desfazer restaurou 3,25. Tudo exclusivamente em QA.

Capturas/logs em `docs/evidencias/etapa17/`, ignorados pelo Git: `planta-*`, `mesa-*`, `portas-*`, `rack-*`, `busca-*`, `qr-publico-*`, `qr-{erro,vazio,carregando}-360.png`, `gesto-{pinca,pan}-390.png`, `toque-selecao-390.png`, `edicao-desktop.png` e `gerente-consulta-768.png`. Resultados em `fluxos.txt`, `gestos.txt`, `estados-acesso.txt`, `desktop.txt`, `selecao-toque.txt` e `qr-publico.txt`; comandos automatizados e limpeza no [PROGRESSO.md](PROGRESSO.md).

**Limites:** viewport e toque emulado em navegador real não equivalem a celular físico. Não foram testados Safari/iOS, Chrome/Android físico, teclado virtual, câmera/scanner QR, impressão física, conectividade de outro aparelho ou produção. O endereço local continua em loopback; não foi aberta rede externa. Identidade visual, escala integrada, operação de produção e publicação permanecem nas etapas 18–21.

# Busca e navegação integrada — etapa 15

A busca consulta os cadastros existentes e a navegação usa seus UUIDs. Não existe catálogo persistido, segunda conexão nem associação por nome. Renomear mantém os destinos. A consulta continua disponível para visualizadores; edição mantém as políticas atuais.

## Uso

Em **Busca e lista do parque**, pesquise pelo nome de planta, mesa, ponto, datacenter, rack, patch panel ou porta. A busca considera o nome do objeto, sem distinguir maiúsculas/minúsculas; `%`, `_` e `\` são literais. Contextos completos distinguem nomes repetidos. Busca vazia lista os cadastros; cada página contém até 50 resultados.

Os filtros de empresa/unidade/andar/setor e tipo são independentes do contexto aberto. Selecionar outro pai do filtro limpa os filhos. **Setor** aplica-se a mesas e seus pontos; **Andar** exclui racks/datacenters sem planta vinculada. Facetas exibem os pais para distinguir andares/setores com nomes iguais. **Limpar busca e filtros** recupera a consulta global autorizada.

- **Consultar** abre a lista e o detalhe, selecionando ponto/porta quando aplicável. Rack sem planta ou sem posição continua com consulta completa.
- **Localizar na planta** abre a planta canônica da mesa/rack e o seleciona. Equipamento/porta localiza o rack. Sem posição, abre a planta e informa a ausência; **Consultar pela lista** continua disponível. Sem planta, somente consulta pela lista é oferecida.
- O caminho da conexão oferece origem, destino, datacenter e localização de mesa/rack, nos dois sentidos. O servidor resolve novamente o objeto antes de abrir; IDs excluídos ou sem acesso não navegam.
- Ao abrir destino fora dos filtros hierárquicos atuais, a busca/filtros são limpos e a interface informa **“O destino está fora dos filtros anteriores. A busca foi limpa para abrir o contexto correto.”** O destino prevalece; uma conexão pode atravessar andares ou unidades da mesma empresa.

Selecionar mesa no canvas abre seus pontos; selecionar rack permite consultá-lo pela lista do datacenter. A lista gráfica identifica o datacenter de cada rack. A representação gráfica própria do datacenter é opcional no plano e não foi criada nesta etapa; seus racks e sua lista dão acesso ao contexto.

## URLs e estado

| Parâmetros | Conteúdo |
|---|---|
| `empresa`, `unidade`, `andar`, `planta` | Cadeia da planta |
| `mesa`, `ponto` | Seleção dentro da planta |
| `datacenter`, `rack`, `equipamento`, `porta` | Cadeia da frente/lista do rack |
| `foco` | UUID da mesa/rack selecionado na planta |
| `busca`, `fEmpresa`, `fUnidade`, `fAndar`, `fSetor`, `tipo`, `pagina` | Texto, filtros e offset da busca |
| `avisoBusca=ajustado` | Indicação de que os filtros conflitantes foram limpos |

Abrir um destino substitui a cadeia anterior inteira. Recarga, Voltar e Avançar restauram a seleção/filtros da URL. Uma URL protegida aberta sem sessão mantém a consulta na tela de login e retoma o contexto depois da autenticação. Logout explícito limpa a URL.

Foco/enquadramento da busca usa câmera local: não modifica layout, revisão ou histórico e não deixa alterações pendentes para gerente/administrador. Navegação que sai da planta continua passando pelo guard de edição; cancelar mantém contexto e rascunho. Mudanças dentro da mesma planta preservam a edição.

## API

`GET /api/search` exige sessão ativa. Aceita `q` (até 200 caracteres), `companyId`, `unitId`, `floorId`, `sectorId` (UUID), `kind` e `offset` (string decimal de 0 a 9999999). Corpos/campos extras e entradas inválidas retornam 400; filtros inexistentes, incompatíveis ou sem acesso retornam 404.

Tipos: `plan`, `desk`, `point`, `datacenter`, `rack`, `patch_panel`, `port`. Retorno `SearchResponse` em `packages/domain/src/search.ts`: `results`, `total`, `offset`, `limit=50` e facetas autorizadas de unidades/andares/setores. Ordenação por nome sem caixa, tipo e UUID; o total continua disponível em páginas vazias. Cada resultado traz nome atual, contexto, indicação de posição e `NavigationTarget` com IDs e pais canônicos.

`GET /api/companies/:companyId/locate/:kind/:id` exige autorização atual na empresa e resolve o mesmo catálogo derivado da busca. Retorna `SearchResult` ou 404; não aceita ID de outro tipo/empresa. As APIs de detalhe existentes continuam validando a cadeia completa e o papel em URLs diretas.

Ambas as consultas filtram atividade e permissões atuais no SQL, inclusive no catálogo e nas facetas. Revogação/desativação vale com sessão existente; a interface revalida junto com as empresas, ignora respostas obsoletas e retira resultados em erros. A relação de cabeamento continua sendo exclusivamente `connections`, consultada pelo [contrato de conexões](CONEXOES.md).

## Validação

`npm run test:search` usa PostgreSQL descartável para nomes/IDs, autorização, filtros, paginação, dois datacenters da mesma unidade, racks homônimos, sem posição/sem planta e consulta em ambos os sentidos. `npm run test:navigation` cobre composição de URLs, limpeza de cadeia e resolução de filtros conflitantes. Evidências de navegador e regressões em [PROGRESSO.md](PROGRESSO.md).

QA opcional explícito: `apps/api/test/browser-server.ts --stage15`. Cria banco separado, contas sintéticas com senha aleatória, dois datacenters e conexões entre dois andares. Proxy temporário `http://api:3002`, origem padrão `http://localhost:5174`; nunca provisiona/carrega o banco de trabalho. SIGTERM remove banco e arquivo ignorado `output/playwright/runtime.json`. Remova também o container web de QA ao terminar. Página pública, QR e consulta móvel completa permanecem nas etapas 16/17.

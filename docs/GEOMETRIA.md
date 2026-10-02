# Contrato de geometria v1

Fonte tipada e validadores: `packages/domain/src/geometry.ts`. Não dependem de Konva, React, DOM ou modelos 3D. O banco guarda estruturas JSONB deste contrato e verifica suas formas básicas. Não armazenar serializações de nodes de um renderizador.

## Coordenadas e formas

Unidade única: **metro** (`unit: 'm'`), versão explícita `version: 1`. Origem da planta livre; X cresce à direita e Y para baixo. Coordenadas podem ser negativas, mas devem ser números finitos. Zoom e deslocamento de câmera não entram na geometria métrica; o estado de câmera fica persistido em campo separado. Pixels de renderização, seleção e ferramentas pertencem ao cliente.

- `Position`: `{x, y}`.
- `Rectangle`: `{x, y, width, height, rotation}`. Âncora no **centro**, dimensões positivas em metros, rotação **horária em graus** no intervalo `[0, 360)`. O adaptador converte âncora e unidades para o renderizador.
- `Polygon`: array aberto de posições; não repetir o primeiro vértice no final. Pelo menos três vértices distintos, com área não nula. Na etapa 13, o domínio também recusa cruzamentos/tangências de arestas não adjacentes e retrocesso sobre uma aresta adjacente.
- `Wall`: ID estável, início/fim distintos e espessura positiva em metros.
- `Opening`: ID estável, `door`/`window`, ID de parede existente, offset não negativo desde o início da parede e largura positiva. A abertura inteira deve caber no comprimento da parede. IDs de parede e abertura são únicos; o snapshot do editor também impede colisões entre todos os tipos selecionáveis. Aberturas na mesma parede podem encostar, mas não se sobrepor.

Setores guardam polígonos em registros próprios. Mesas guardam retângulo obrigatório; datacenters e racks admitem posição ausente. Uma posição de datacenter/rack exige filiação a uma planta da unidade correspondente. A transformação gráfica não substitui a filiação física no cadastro nem altera conexões.

## Documento da planta e fundo

```json
{
  "version": 1,
  "unit": "m",
  "walls": [
    {"id": "parede-uuid", "start": {"x": 0, "y": 0}, "end": {"x": 4, "y": 0}, "thickness": 0.15}
  ],
  "openings": [
    {"id": "abertura-uuid", "kind": "door", "wallId": "parede-uuid", "offset": 1, "width": 0.9}
  ]
}
```

Plantas podem começar sem paredes, aberturas ou fundo. O fundo opcional contém `originalFileId`, `renderedFileId`, `page` (inteiro positivo para PDF, `null` para imagem), `sourceWidthPx`, `sourceHeightPx`, `placement` em metros e `opacity` opcional (0–1, padrão 1 para documentos anteriores). Pixels descrevem apenas a resolução do arquivo, não a geometria do parque. Calibração é representada pelas dimensões reais e alinhamento do fundo, separados das medidas dos objetos. Na etapa 14, a importação cria os arquivos privados e o PUT valida o par original/renderizado contra metadados da mesma empresa/planta, incluindo página e resolução. Referência inexistente/cruzada ou metadado adulterado retorna **400**; o banco também protege essa relação ao gravar geometria. O layout não cadastra arquivos. Remover o fundo retira sua referência do desenho; os arquivos são retidos. Limites e fluxo em [FUNDOS.md](FUNDOS.md).

## Documento persistido na etapa 11

`packages/domain/src/layout.ts` define a versão 1 do snapshot enviado ao editor. `geometry` contém paredes, aberturas e fundo; `desks`, `racks` e `sectors` são listas de IDs e valores geométricos associados. Cada lista referencia os registros canônicos da planta, com IDs UUID sem duplicação dentro da coleção nem entre os três tipos, independentemente de maiúsculas/minúsculas. Campos extras são rejeitados em todo o documento, inclusive nas formas e na câmera; o JSON da planta não pode receber cópias de cadastros ou atributos de nodes do renderizador. Polígonos permanecem em `sectors`, posições em `desks.placement` e `racks.placement`; não são cópias armazenadas no JSON da planta. Rack sem posição usa `placement: null`, persistido como SQL `NULL`. A câmera `{x,y,zoom}` fica em coluna própria `plans.camera` e usa pixels/zoom do cliente, sem contaminar medidas em metros.

Leitura e gravação: `GET /api/companies/:companyId/plans/:planId/layout` retorna `{revision,layout}`. `PUT` recebe `{expectedRevision,layout}`. A leitura é permitida para gerente/visualizador; gravação exige gerente/administrador. `revision` é positiva e global à planta. O `PUT` é transacional, só aceita o conjunto atual completo de mesas, racks e setores daquela planta, valida formas e IDs e incrementa a revisão uma vez. Revisão ou conjunto de referências desatualizado retorna HTTP 409; payload estrutural inválido retorna 400; planta fora da empresa retorna 404.

O salvamento bloqueia primeiro a planta e verifica a revisão. Em seguida bloqueia os objetos canônicos com `FOR NO KEY UPDATE NOWAIT`: se um cadastro já estiver em edição, retorna **409** e desfaz integralmente a transação, sem aguardar um lock na ordem inversa àquela usada pelos cadastros. Uma segunda gravação da mesma revisão aguarda a primeira na planta e é rejeitada como desatualizada. Nenhum conflito é repetido automaticamente.

Inserir, remover, posicionar ou alterar a associação de mesa, rack ou setor incrementa a revisão automaticamente. Assim um snapshot antigo não repõe posições nem remove/recria cadastros feitos após sua leitura. O salvamento atualiza somente polígonos e posições dos IDs existentes e a geometria/câmera da planta; mesas, pontos, setores como registros, racks, equipamentos, portas e conexões mantêm seus IDs e relações. O histórico de conexões é independente.

Desfazer/refazer foi implementado na etapa 12 como histórico local de posições de mesas/racks, aplicado somente aos IDs presentes. Não cria/remove cadastros nem grava conexões. O editor Konva converte metros para pixels sem serializar nodes; câmera permanece separada. Conflito de revisão bloqueia edição e salvamento até recarga ou reconciliação explícita; IDs removidos por outra sessão não sobrevivem à reconciliação.

`POST /api/companies/:companyId/plans/:planId/racks/:rackId`, com `{expectedRevision}`, vincula um rack cadastrado sem planta a uma planta da mesma unidade. Verifica papel, empresa, revisão e locks; preserva datacenter/equipamentos/portas, inicia com posição nula e incrementa a revisão pelo trigger existente. Esse cadastro é separado do histórico de posições e exige layout sem alterações pendentes na interface. Para retirar a representação gráfica sem desfazer a filiação, use `placement: null` no PUT. Adaptações futuras deverão versionar o contrato e migrar os dados, preservando IDs. Nenhum renderizador 3D foi instalado ou implementado.

## Ampliação compatível da etapa 13

GET sempre acrescenta `name` ao setor e `sectorId` (UUID ou null) à mesa. No PUT estes campos são opcionais para compatibilidade com clientes v1 anteriores; omissão preserva o nome/relação existente. Se o setor for removido, suas mesas são desvinculadas, inclusive para payloads anteriores sem `sectorId`. Um `sectorId` explícito deve pertencer à lista de setores da mesma planta; relação órfã retorna 400 antes de abrir a transação.

O PUT aceita o campo opcional `newSectorIds: UUID[]`, identificando exclusivamente setores que ainda não existem e devem ser criados. Esses setores exigem `name`; IDs já usados são recusados. Para remover setor, omita-o da lista e envie as mesas com `sectorId:null` ou outro setor válido. A API desvincula dependentes, remove setores omitidos, aplica criação/renomeação/polígonos e grava posições/relações/arquitetura/câmera, incrementando a revisão uma única vez. Mesas e racks continuam exigindo seus conjuntos completos. Nenhum ponto ou vínculo de cabeamento é alterado.

Os nomes dos setores ficam na tabela canônica `sectors`, têm de 1 a 200 caracteres não inteiramente brancos, grafia preservada e unicidade por planta. A migração 005 torna a unicidade diferível durante o salvamento para permitir permutar nomes, e inclui renomeação na revisão automática. Histórico/revisões permanecem locais ao desenho: paredes, aberturas, setores e relações mesa-setor agora podem ser desfeitos/refeitos, inclusive restaurando um setor removido e salvo com o mesmo ID por intenção explícita. Mesas/racks só recebem posições/relações para os membros atuais; não são recriados pelo histórico. Conflito exige recarga ou reconciliação de posições com confirmação de descarte das outras alterações. Os parágrafos da etapa 11 acima descrevem o contrato original; esta seção rege sua ampliação na etapa 13.

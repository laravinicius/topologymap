# Contrato de geometria v1

Fonte tipada e validadores: `packages/domain/src/geometry.ts`. Não dependem de Konva, React, DOM ou modelos 3D. O banco guarda estruturas JSONB deste contrato e verifica suas formas básicas. Não armazenar serializações de nodes de um renderizador.

## Coordenadas e formas

Unidade única: **metro** (`unit: 'm'`), versão explícita `version: 1`. Origem da planta livre; X cresce à direita e Y para baixo. Coordenadas podem ser negativas, mas devem ser números finitos. Zoom, pixels da tela, deslocamento de câmera, seleção e ferramentas pertencem ao cliente.

- `Position`: `{x, y}`.
- `Rectangle`: `{x, y, width, height, rotation}`. Âncora no **centro**, dimensões positivas em metros, rotação **horária em graus** no intervalo `[0, 360)`. O adaptador converte âncora e unidades para o renderizador.
- `Polygon`: array aberto de posições; não repetir o primeiro vértice no final. Pelo menos três vértices distintos, com área não nula. A edição futura poderá aprofundar validações topológicas, como interseções; os validadores atuais verificam a estrutura, finitude, duplicação e área.
- `Wall`: ID estável, início/fim distintos e espessura positiva em metros.
- `Opening`: ID estável, `door`/`window`, ID de parede existente, offset não negativo desde o início da parede e largura positiva. A abertura inteira deve caber no comprimento da parede. IDs de parede e abertura são únicos nos respectivos grupos da planta.

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

Plantas podem começar sem paredes, aberturas ou fundo. O fundo opcional contém `originalFileId`, `renderedFileId`, `page` (inteiro positivo para PDF, `null` para imagem), `sourceWidthPx`, `sourceHeightPx` e `placement` em metros. Pixels aqui descrevem apenas a resolução do arquivo, não a geometria do parque. Calibração é representada pelas dimensões reais e pelo alinhamento do fundo, separados das medidas dos objetos. IDs de arquivos são referências reservadas; armazenamento, autorização e integridade dessas referências serão implementados na etapa de importação.

`plans.revision` prepara o salvamento com estado esperado. A API de layout, incremento/reconciliação da revisão e desfazer/refazer serão implementados na etapa 11. A revisão de conexões é independente. Adaptações e extensões futuras deverão versionar o contrato e migrar os dados, preservando IDs. Nenhum renderizador 3D foi instalado ou implementado.

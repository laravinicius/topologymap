# Identidade visual Microgate — etapa 18

Aplicada em 02/10/2026. Referência consultada: [site oficial](https://microgateinformatica.com.br/) e seu [CSS compartilhado](https://microgateinformatica.com.br/css/style.css). O sistema mantém os fluxos e a organização existentes, com a paleta grafite/azul claro do site.

## Tokens e uso

`apps/web/src/tokens.css` é a fonte única de cores, famílias tipográficas, escala de texto, espaçamentos, raios e foco. `style.css` consome essas variáveis; `theme.ts` resolve as mesmas cores para Konva ao montar a planta. Não há paleta paralela no canvas.

| Papel | Token / cor |
|---|---|
| Fundo / superfície | `--background: #10151b`, `--surface: #171e26` |
| Texto / texto secundário | `--text: #f7f9fb`, `--muted: #c2cbd5` |
| Acento / foco | `--accent: #72b7f2`, `--accent-strong: #9bcfff` |
| Ação / texto da ação | `--action: #d9edff`, `--on-action: #111b25` |
| Seleção | `--selected: #263f55`, contorno e estado `aria-pressed` |
| Sucesso / livre | `--success: #a6e8c0`, `--success-surface: #183c2c` |
| Erro / ocupada | `--danger: #ffb6b6`, `--danger-surface: #4b242b` |
| Pendente / aviso | `--warning: #f7d391`, `--warning-surface: #49351a` |
| Papel da etiqueta | Preto `#000000` sobre branco `#ffffff` |

A família segue a cadeia do site: Inter quando instalada, seguida de fontes locais de sistema. Dados técnicos usam `ui-monospace`/Cascadia Code/Consolas. Não foi fornecido nem baixado um arquivo Inter; não há carregamento de fonte/CDN em runtime. Espaçamentos usam passos de 4 px; dimensões físicas dos racks, alvos e limites responsivos existentes foram preservados.

## Logos e imagens fornecidas

Originais em `docs/logos/`, preservados. Cópias servidas localmente em `apps/web/public/brand/`:

- `logo_horizontal_white.webp`: marca no login, parque e QR público; proporção original, sem recorte, filtro ou redesenho.
- `ico.ico`: favicon fornecido.
- `background.webp`: fundo decorativo do login, com sobreposição escura; a consulta do parque usa fundo sólido.
- `logo_vertical_white.webp` permanece disponível na pasta de origem, sem necessidade de outra variante na interface.

Os SHA256 das três cópias coincidem com os originais, registrados em `docs/evidencias/etapa18/resumo-visual.json`. **Pendência de logos: nenhuma.** As imagens decorativas da marca não são usadas como fundo de planta ou equipamento.

## Estados e legibilidade

Portas apresentam Livre/Ocupada em texto, nome acessível e destino; a vista frontal acrescenta legenda e sublinhado no número ocupado. A lista equivalente mantém nomes completos e alvos grandes. Seleções usam contorno, tracejado na planta e estado acessível; mensagens continuam anunciadas pelos roles existentes.

Mesas/racks têm superfícies opacas, nomes no objeto e rótulo do selecionado com tamanho constante na tela, mesmo ao reduzir o zoom. Nomes completos continuam na lista/detalhes. Setores são translúcidos para conservar a imagem importada; rótulos de setores e paredes têm fundo opaco e tamanho constante. Não há filtro ou alteração nos arquivos de planta. Foco visível cobre botões, campos, links, summary e itens focáveis; a grade reserva espaço para o contorno das portas.

Consulta compacta continua até 900 CSS px. Os controles de edição reaparecem no computador conforme o papel da conta; o viewport não muda autorização. A página pública continua restrita à mesa, pontos e destinos, sem navegação privada. Marca é uma imagem sem link nessa entrada. O QR e a etiqueta permanecem preto/branco, com impressão isolada do parque.

## Prova e limites

Chromium real/Playwright CLI: 360×800, 375×812, 390×844, 768×1024, horizontal 844×390 e desktop 1280×900. Fluxos, contraste, Tab/Enter, estados, edição, recarga, gestos emulados, consulta pública e impressão simulada estão registrados em [PROGRESSO.md](PROGRESSO.md). Menor contraste de texto medido nas combinações conferidas: **6,61:1**; isso é prova das telas verificadas, não certificação completa de acessibilidade. Bitmap do QR capturado da tela decodificado por jsQR com URL/token corretos.

Evidências visuais e logs locais em `docs/evidencias/etapa18/`, ignorados pelo Git. Sem prova em celular físico, câmera/scanner, impressão física ou produção. Escala/validação integrada, backup/restauração e publicação ficam nas etapas 19–21.

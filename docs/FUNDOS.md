# Fundos de planta — etapa 14

## Operação

Abra Empresa → Unidade → Andar → Planta. Em **Fundo da planta**, escolha PNG, JPG/JPEG ou PDF. Para PDF, confira a prévia do PDF.js e selecione a página. **Usar como fundo** armazena o original e a imagem normalizada/renderizada e prepara a troca no rascunho. **Salvar layout** grava o vínculo e as transformações com a revisão esperada. Importar, trocar, remover e calibrar não desloca mesas, racks, paredes ou setores e não altera pontos/conexões.

Ajuste o centro X/Y em metros, largura, altura, rotação e opacidade. **Centralizar na origem** alinha o centro em (0,0). Para calibrar, use **Marcar dois pontos no fundo**, clique em dois extremos de uma medida conhecida, informe a distância real em metros e aplique. Também é possível informar os pontos em pixels, medidos desde o canto superior esquerdo da imagem renderizada. A calibração considera rotação/dimensões atuais, mantém o primeiro ponto no mesmo lugar e escala largura/altura uniformemente. Não há inferência automática da escala de um PDF. A transformação do fundo permanece separada da geometria canônica em metros.

As mudanças do fundo participam do desfazer/refazer local. Recarregar descarta o rascunho mediante confirmação; a reconciliação de conflito conserva somente posições de mesas/racks, descartando alterações locais de fundo e demais elementos arquitetônicos após confirmação. Um visualizador consulta o fundo e pode baixar os arquivos; os controles de importação/gravação não aparecem e a API recusa escrita com 403.

## Limites e validação

| Entrada | Limite |
|---|---|
| Original e PNG renderizado | 20 MiB cada; arquivo vazio recusado |
| PNG/JPG | Até 8192 px por lado e 16000000 pixels; uma imagem estática |
| PDF | Até 100 páginas; página inteira de 1 até a quantidade real |
| Página PDF | Dimensões positivas, até 14400 pontos PDF por lado |
| Renderização PDF na API | Escala até 1,5, reduzida para caber em 4096 px por lado / 16000000 pixels |
| Conversão | Uma por instância da API; worker de até 30 s, heap V8 de 256 MiB |
| Acervo de uma planta | Até 100 importações (200 arquivos) ou 512 MiB somando originais e renderizados |
| Fundo em metros | Centro X/Y entre −1000000 e 1000000; lados entre 0,001 e 10000; rotação [0,360) |
| Opacidade | 0 a 1; ausência em documentos antigos equivale a 1 |
| Calibração | Dois pontos dentro da imagem, separados por pelo menos 1 pixel; distância positiva até 10000 m |

A API confere MIME, assinatura, decodificação real e dimensões. Sharp decodifica e normaliza PNG/JPG em PNG, aplicando orientação EXIF. O original conserva seus bytes. PDF.js valida o PDF e renderiza exclusivamente a página escolhida no servidor; a API não aceita uma imagem renderizada arbitrária fornecida pelo cliente. PDFs protegidos por senha, inválidos ou fora dos limites são recusados. A prévia no navegador usa worker, fontes, CMaps e WASM locais, sem CDN. A imagem é uma base raster; não há importação de CAD, OCR, extração de objetos ou execução de links/scripts/anexos do PDF.

O limite V8 não limita toda a memória nativa de imagens/canvas. Arquivos complexos podem ser recusados pelo timeout ou limites de recursos. O dimensionamento e a configuração definitiva do serviço pertencem à etapa 20.

## API, autorização e integridade

- `POST /api/companies/:companyId/plans/:planId/backgrounds[?page=N]`: corpo binário, `Content-Type: image/png`, `image/jpeg` ou `application/pdf`. PDF exige `page`; imagem não aceita página. Retorna 201 com `{background}`. Exige gerente/administrador, sessão e origem autorizada, inclusive antes da leitura do corpo. Não altera a revisão/layout até o PUT explícito.
- `GET /api/companies/:companyId/plans/:planId/files/:fileId`: gerente/visualizador autorizado à empresa. Verifica também filiação do arquivo à planta, tamanho, SHA-256 e arquivo regular, recusando symlinks no runtime Linux. Sem sessão: 401; empresa/planta/arquivo inacessível: 404. Originais são downloads; fundos renderizados podem ser exibidos inline. Cabeçalhos `no-store`, `nosniff`, CSP sandbox e CORP same-origin.
- `PUT .../layout`: valida o par original/renderizado, empresa/planta, página e resolução contra os metadados, além do contrato geométrico. Referência inválida: 400; revisão antiga: 409. A migração `006_plan_files.sql` acrescenta metadados, FKs compostas e trigger de integridade do fundo, sem alterar migrações aplicadas ou cadastros existentes.

Não há endpoint público ou serviço estático dos arquivos. Nomes originais e caminhos do cliente não são usados nem aceitos como parâmetros. O armazenamento usa somente UUIDs gerados no servidor em `FILES_DIR` (Compose: `/data/files`, volume `topologia_new_plant_files`). As permissões são reconsultadas por requisição; revogação passa a valer com a sessão já aberta. Um futuro QR de mesa não concede leitura desses arquivos.

Os bytes são gravados com criação exclusiva, permissões privadas e sincronização antes do commit dos metadados. Falha tratada remove arquivos criados e reverte a transação. Banco e filesystem não formam uma transação distribuída: queda abrupta entre gravação e commit pode deixar um arquivo órfão sem metadados, que não é acessível pela API. A reconciliação de armazenamento/backup fica para a operação da etapa 20.

## Persistência e retenção

Trocar/remover um fundo não apaga importações anteriores. Isso preserva o original, o histórico local e as referências de outros rascunhos. Uma importação cancelada após upload também continua no acervo privado e conta na quota. Não há expurgo automático ou interface de exclusão de arquivos nesta etapa. Arquivos são dependências: a exclusão física de uma planta com importações é recusada pela FK RESTRICT. Não remova arquivos/linhas manualmente sem conferir as referências e um backup.

Preserve juntos PostgreSQL e `plant_files`. `npm run dev:stop` para os serviços sem apagar volumes; `npm run dev:all` espera os healthchecks ao subir. Nunca use `down -v` para atualizar o esquema. Depois de atualizar dependências, sincronize o volume com `npm run dev:install`; aplique `npm run db:migrate` explicitamente.

## Verificação reproduzível

`npm run test:files` cria e remove um banco sintético e diretório temporário: PNG/JPG, PDF de duas páginas, tipos/tamanhos/dimensões, falsificação, caminhos, troca preservando conexões, referências cruzadas, revisões, leitura como visualizador, revogação, reinício de aplicação, checksum e symlink. `npm run test:db` valida instalação nova e upgrades com dados preservados; `npm run test:layout` e `npm run test:layout-editor` cobrem revisão, histórico e calibração.

QA opcional de navegador, sempre em banco separado:

```powershell
docker compose run -d --no-deps --name topologia_qa14 api npx tsx apps/api/test/browser-files-server.ts
docker compose run -d --no-deps --name topologia_qa14_web -e API_PROXY_TARGET=http://topologia_qa14:3002 -p 127.0.0.1:5174:5173 web npm run dev --workspace @topologia-new/web
```

Acesse `http://localhost:5174`. Credencial sintética temporária: `output/playwright/files-runtime.json`, ignorado pelo Git. Os exemplos PNG/JPG/PDF ficam nesse mesmo diretório. Cadastre a hierarquia pela interface/API somente nesse QA. O servidor mantém seu banco e subdiretório privado ao receber SIGTERM para permitir prova de reinício; após reiniciar o banco, aguarde sua saúde antes de iniciar novamente o QA.

Ao terminar, execute a limpeza explícita:

```powershell
docker stop topologia_qa14_web topologia_qa14
docker compose run --rm --no-deps api npx tsx apps/api/test/browser-files-server.ts --cleanup
docker rm topologia_qa14_web topologia_qa14
```

Esse comando valida o prefixo do banco e o subdiretório QA, remove somente o banco/arquivos/credencial temporários e preserva os volumes de trabalho. Feche o navegador de QA e remova arquivos de sessão de automação; as capturas podem ser conservadas como evidência local.

Referências técnicas: [exemplos oficiais do PDF.js](https://mozilla.github.io/pdf.js/examples/), [renderização Node do PDF.js](https://github.com/mozilla/pdf.js/blob/master/examples/node/pdf2png/pdf2png.mjs) e [metadados do Sharp](https://sharp.pixelplumbing.com/api-input/). Versões fixadas: PDF.js 6.3.289, Sharp 0.35.5 e canvas 1.0.10.

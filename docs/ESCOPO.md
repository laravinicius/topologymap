# Escopo funcional — primeira versão

Consolidado em 30/09/2026 a partir do questionário com o usuário.

## 1. Objetivo e referências

Construir um projeto independente para documentar o cabeamento de várias empresas. Prioridade: funcionamento, integridade dos vínculos e facilidade de consulta.

Referência de interação: [UniFi Design Center](https://design.ui.com/), principalmente a navegação entre planta, rack e portas, o posicionamento de objetos e os detalhes do item selecionado. A implementação será própria.

Referência de identidade visual: [Microgate IT Solutions](https://microgateinformatica.com.br/), com fundo escuro, textos claros e detalhes em azul claro. O usuário fornecerá as logos posteriormente. Não inventar logos ou copiar imagens de equipamentos para o projeto.

O projeto anterior não será utilizado como referência de implementação, código ou memória.

## 2. Organização dos cadastros

- Empresa: cliente atendido pela Microgate.
- Unidade: matriz, filial, CD ou outra identificação livre.
- Andar: vinculado a uma unidade; nome editável.
- Planta: vinculada a um andar; contém geometria, setores e posições dos objetos.
- Setor: região identificada na planta.
- Mesa: pertence à planta, pode ser associada a um setor e tem posição, dimensões e rotação.
- Ponto: pertence à mesa; pode existir sem conexão cadastrada.
- Datacenter: pertence à unidade, pode ser localizado na planta e contém racks.
- Rack: pertence ao datacenter, tem capacidade em U e pode ser posicionado na planta.
- Equipamento: pertence ao rack, com nome, tipo, posição e altura em U.
- Patch panel: equipamento que também contém portas configuráveis.
- Conexão: relaciona um ponto da mesa com uma porta de patch panel.

Nomes serão editáveis. Preservar diferenças como `Mesa 1`, `Mesa 01`, `Rack 01` e `Rack 01 Freso`; nomes não substituem os identificadores internos.

## 3. Acesso

| Perfil | Permissões |
|---|---|
| Administrador geral da Microgate | Gerenciar usuários, empresas e permissões; administrar todos os parques. |
| Gerenciamento por empresa | Criar e alterar unidades, andares, plantas, setores, mesas, pontos, datacenters, racks, equipamentos e conexões da empresa autorizada. |
| Visualização por empresa | Consultar todo o parque da empresa autorizada, sem alterações. |
| Consulta pública da mesa | Sem login; somente a mesa associada ao QR Code, seus pontos e os destinos das conexões. |

Um usuário pode receber permissões diferentes em diferentes empresas. Gerenciamento de um cliente não concede acesso a outros clientes nem à administração global de usuários.

O isolamento será aplicado na API e nas consultas ao banco, incluindo downloads de plantas e imagens. Esconder botões não é controle de acesso suficiente.

## 4. Planta 2D

Decisões confirmadas:

- Desenhar a planta do zero com paredes, portas e janelas.
- Importar uma planta e utilizá-la como fundo.
- Delimitar e identificar setores.
- Posicionar, mover, dimensionar e girar mesas e racks.
- Zoom, movimentação da área de visualização e enquadramento da planta.
- Selecionar mesa para consultar seus pontos e conexões.
- Identificar datacenters e acessar seus racks.
- Edição disponível no computador; consulta completa compatível com celular.

Detalhes propostos para implementação:

- Importar PNG, JPG e PDF; para PDF, escolher a página.
- Calibrar escala usando uma distância conhecida.
- Usar dimensões reais para a geometria, separadas dos pixels da tela.
- Oferecer grade e ajuste de alinhamento, ferramentas de seleção e desfazer/refazer do layout.
- Salvar o layout explicitamente, indicando alterações pendentes e erros de gravação.
- Oferecer campos e botões para posição, dimensões e rotação como alternativa ao arraste.
- Buscar mesas e pontos e filtrar por setor.

Esses detalhes são decisões técnicas propostas, não requisitos adicionais solicitados pelo usuário.

## 5. Mesas, pontos e conexões

Criar uma mesa com N pontos deve gerar os pontos de uma vez. Cada ponto terá nome editável, inicialmente em sequência. A mesa pode ser cadastrada antes dos racks e as associações podem ser realizadas depois.

Exemplo de apresentação:

`Mesa 1 → Ponto 1 → Datacenter 01 → Rack 04 → Patch panel 02 → Porta 23`

O vínculo será um único registro. Associar pela mesa atualiza a consulta da porta; associar pela porta atualiza a consulta da mesa.

Regras:

- Um ponto pode ter no máximo uma conexão com patch panel.
- Uma porta pode atender no máximo um ponto.
- Ponto e porta precisam pertencer à mesma empresa.
- Mesas podem estar em andares diferentes do datacenter que as atende.
- Mostrar portas livres e ocupadas e informar o ponto associado.
- Não substituir uma conexão existente silenciosamente; a transferência deve ser explícita.
- Mover ou girar a mesa mantém os pontos e os vínculos.
- Renomear os cadastros atualiza a apresentação do caminho sem reconstruir a conexão.
- Pontos sem destino permanecem cadastrados e aparecem como não associados.
- Reduzir a quantidade de pontos não pode apagar conexões silenciosamente.

## 6. Datacenters e racks

Uma unidade pode ter vários datacenters. Cada datacenter pode ter vários racks.

O rack será apresentado frontalmente em 2D, com unidades U identificadas. A numeração padrão será crescente de baixo para cima, mantendo o posicionamento armazenado por U inicial e altura.

Equipamentos genéricos terão nome, tipo, U inicial e altura em U. Para patch panels, informar também a quantidade de portas e seus nomes/números.

Regras:

- Capacidade do rack e quantidade de portas configuráveis.
- Impedir equipamentos sobrepostos e posições fora da capacidade do rack.
- Impedir redução de capacidade que deixe equipamentos fora do rack.
- Impedir redução de portas que apague conexões existentes.
- Selecionar uma porta permite consultar a mesa de destino e, com gerenciamento, associar ou desvincular o ponto.
- Posicionar equipamentos por arraste e também por campos/botões.
- Equipamentos genéricos representam a ocupação física; a conexão interativa da primeira versão é ponto de mesa ↔ porta de patch panel.

## 7. Visualização no celular

O visualizador autenticado terá acesso ao parque completo das empresas autorizadas:

- Navegar por empresa, unidade e andar.
- Consultar planta com zoom e movimentação por toque.
- Selecionar mesas, racks e portas.
- Pesquisar pontos e consultar seus caminhos.
- Abrir detalhes em painel adequado à tela pequena.
- Consultar uma lista textual equivalente aos objetos da planta e às portas do rack.

Evitar depender de hover. A página não deverá ter rolagem horizontal involuntária; a navegação da planta ocorre dentro da área própria do mapa. Portas pequenas no desenho terão acesso equivalente por lista, com alvos de toque adequados.

## 8. QR Code da mesa

Cada mesa poderá ter um endereço público permanente, utilizado na etiqueta física. Mudanças de nome e conexão não exigirão substituir a etiqueta.

A página pública exibirá o nome da mesa, seus pontos e o destino de cada conexão, incluindo datacenter, rack, patch panel e porta. Não permitirá navegar para o restante da planta, listar outras mesas ou acessar detalhes internos dos racks.

Detalhes técnicos propostos: endereço com identificador aleatório, ativação explícita, desativação e possibilidade de renovar o endereço quando necessário; geração e impressão da etiqueta a partir do cadastro da mesa. A URL pública de produção será configurável.

## 9. Dados de referência

O arquivo `D:\Backup_DB\inframap\backup_informacoes_banco.txt` foi fornecido pelo usuário para ilustrar a estrutura de dados. Não será importado automaticamente nem usado para replicar o sistema anterior.

Verificação realizada: uma empresa, dois andares, 59 registros no grupo mesas (incluindo impressoras e TVs), 363 pontos, 358 conexões completas, quatro racks, 26 patch panels de 24 portas e 624 portas. As 358 conexões coincidem nas duas listagens, sem duplicidades de ponto/porta ou referências inválidas identificadas. Cinco pontos estão incompletos.

Classificação informada pelo usuário:

- Unidade Matriz, Datacenter 01: Rack 01, Rack 02 e Rack 03.
- Unidade Matriz, outro datacenter: Rack 01 Freso. O nome desse datacenter será definido no cadastro.

O usuário pretende cadastrar tudo manualmente para validar o funcionamento. Começar com um parque vazio, mantendo apenas o provisionamento do administrador.

## 10. Evolução para 3D

A primeira versão será 2D. Armazenar geometria, dimensões, posições, rotações e IDs sem dependência dos objetos internos do Konva ou de coordenadas da tela.

Renderizadores futuros poderão consumir o mesmo modelo. Altura de paredes, dimensões adicionais e modelos 3D poderão ser acrescentados quando essa etapa for implementada. A preparação não equivale à entrega de 3D nesta versão.

## 11. Critérios de aceitação

1. Criar duas empresas e manter seus dados e permissões isolados.
2. Criar matriz e filial, andares e plantas independentes.
3. Desenhar uma planta e importar imagens e uma página de PDF como fundo.
4. Criar setores e uma mesa com oito pontos, posicionar e girar a mesa.
5. Criar dois datacenters na mesma unidade e seus racks.
6. Criar equipamentos genéricos e patch panels com capacidades diferentes.
7. Associar um ponto pela mesa e verificar a mesma conexão na porta do rack.
8. Associar outro ponto pela porta e verificar a conexão na mesa.
9. Impedir associação duplicada e transferência silenciosa.
10. Impedir sobreposição em U e reduções que destruam vínculos.
11. Recarregar a página e reiniciar os containers mantendo cadastros, layout e arquivos.
12. Verificar que visualizadores podem consultar, mas não alterar dados mesmo por chamada direta à API.
13. Consultar planta, mesa, rack e conexões em navegador com viewport de celular.
14. Abrir o QR Code sem login e verificar que somente a mesa correspondente fica disponível.
15. Validar busca e navegação com dados sintéticos na escala de pelo menos 40 mesas com oito pontos e três racks com sete patch panels de 24 portas.

## 12. Itens adiados

- Visualização e edição 3D.
- Descoberta automática e integração com controladores UniFi.
- Simulação de Wi-Fi, PoE, energia ou capacidade de links.
- Rastreamento de conexões entre switches e demais equipamentos ativos.
- Importação automática do levantamento legado, CAD/DWG e detecção automática de paredes.
- Edição no celular.

## 13. Pendências operacionais para publicação

Servidor de produção, domínio público e logos ainda serão fornecidos. Essas informações não impedem o desenvolvimento local. A publicação será uma etapa posterior, com banco e arquivos persistentes, HTTPS e validação dos QR Codes no domínio definitivo.

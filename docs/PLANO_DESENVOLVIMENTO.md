# Plano de desenvolvimento orientado a solicitações ao agente

Projeto: Topologia New. Elaborado em 30/09/2026.

**Estado inicial:** documentação criada; aplicação, banco e containers ainda não implementados. Todas as etapas abaixo começam pendentes.

**Estado atual (30/09/2026):** etapas 01 e 02 concluídas, com ambiente local em execução e evidências em [PROGRESSO.md](PROGRESSO.md). Etapas 03 a 21 permanecem pendentes.

Este documento transforma [ESCOPO.md](ESCOPO.md) e [IMPLEMENTACAO.md](IMPLEMENTACAO.md) em tarefas executáveis, em ordem, com solicitações prontas para copiar para o agente.

## 1. Como utilizar

1. Envie ao agente a solicitação da etapa 01.
2. Confira a entrega, os testes executados e eventuais pendências informadas.
3. Avance para a próxima etapa quando os critérios da anterior estiverem atendidos.
4. Se houver falha, use a solicitação de correção ao final deste documento e conclua a etapa antes de avançar.
5. Para retomar em outro chat, use a solicitação de retomada. O estado registrado no projeto será a referência.

Cada solicitação autoriza a implementação daquela etapa, incluindo os ajustes necessários para integrá-la ao código existente. O agente deve concluir a etapa solicitada sem pedir confirmação para escolhas técnicas rotineiras já cobertas pelos documentos. Não deve iniciar automaticamente a etapa seguinte.

Os caminhos usados nas solicitações são relativos à raiz deste projeto. O agente deve trabalhar na pasta `C:\Users\Vinicius\Documents\GitHub\topologymap` e resolver os arquivos a partir dela.

## 2. Fontes e limites

- Requisitos funcionais e critérios de aceitação: `docs/ESCOPO.md`.
- Arquitetura, tecnologias e regras técnicas: `docs/IMPLEMENTACAO.md`.
- Ordem das tarefas, entregas e controle de progresso: este documento.
- Instruções e correções explícitas do usuário prevalecem sobre os documentos.
- Detalhes classificados como proposta técnica podem ser adotados como padrão de implementação. Registrar ajustes relevantes e seus motivos em `IMPLEMENTACAO.md`; não tratar uma proposta como requisito funcional original.
- Criar um projeto independente; não consultar o projeto antigo, seu código ou a memória de `microgate_topologia`.
- O TXT fornecido serve apenas como exemplo de dados. Não copiar, importar ou carregar dados reais automaticamente.
- O ambiente de validação do usuário começa sem empresas, mesas ou racks. Provisionar apenas o administrador, por procedimento explícito.
- Dados sintéticos ficam em ambiente de teste separado ou em uma carga opcional identificada, nunca executada automaticamente no banco de trabalho do usuário.
- Implementar somente a versão 2D. Preparar o modelo para outro renderizador sem instalar nem desenvolver 3D nesta versão.
- Priorizar funcionalidade. A identidade Microgate será aplicada na etapa 18; manter a interface legível e utilizável desde as primeiras telas.
- Não implementar itens adiados do escopo nem adicionar serviços sem necessidade demonstrada.

## 3. Contrato de execução de cada etapa

Antes de editar:

1. Ler as instruções aplicáveis ao projeto e as seções pertinentes dos três documentos.
2. Inspecionar o estado real dos arquivos e, quando houver Git, as alterações existentes. Preservar trabalho não relacionado.
3. Confirmar as dependências da etapa por evidências atuais. Uma caixa marcada não substitui verificar se o código necessário existe e funciona.
4. Usar skills aplicáveis; verificar versões e contratos de bibliotecas quando necessário. Não assumir que versões registradas na documentação continuam atuais.

Durante a implementação:

- Entregar o fluxo completo previsto para a etapa: banco, API e interface quando indicados.
- Manter autorização e validações na API, não apenas nos controles da interface.
- Reutilizar os contratos do domínio e a fonte única das conexões.
- Criar migrações compatíveis com dados existentes; não apagar volumes para atualizar o esquema.
- Executar os testes pertinentes à mudança. Testar regras de integridade e acesso; não criar testes que apenas repitam a implementação.
- Verificar telas em navegador real quando a etapa entregar interface. Não classificar CSS ou build como prova visual.
- Atualizar instruções operacionais e os documentos quando houver mudança relevante.
- Não criar commits, enviar código ou publicar em produção sem solicitação específica para essas ações.

Ao concluir:

1. Atualizar a situação da etapa na tabela abaixo.
2. Criar ou atualizar `docs/PROGRESSO.md` com etapa, resultado, arquivos principais, comandos/verificações executados, resultado, pendências e próxima etapa.
3. Distinguir typecheck/build, testes de API/banco, navegador local, teste em dispositivo físico e produção.
4. Informar URL local e procedimento de validação quando houver aplicação executável.
5. Manter o projeto em estado utilizável. Informar quais serviços ficaram em execução e como pará-los preservando os volumes.

Usar os estados `Pendente`, `Em andamento`, `Concluída` e `Bloqueada`. Marcar bloqueio somente quando uma informação ou condição externa impedir aquela etapa; registrar o motivo. Não marcar concluída se um critério essencial estiver sem prova.

`docs/PROGRESSO.md` será criado na etapa 01. As solicitações deste plano não pressupõem que a aplicação já exista.

## 4. Sequência e controle

| Etapa | Entrega | Dependências | Situação |
|---|---|---|---|
| 01 | Workspace e Docker local | Documentos atuais | Concluída |
| 02 | Domínio, banco e migrações | 01 | Concluída |
| 03 | Administrador, login e sessões | 02 | Pendente |
| 04 | Usuários e permissões por empresa | 03 | Pendente |
| 05 | Empresas, unidades, andares, plantas e datacenters | 04 | Pendente |
| 06 | Mesas e pontos | 05 | Pendente |
| 07 | Racks, equipamentos e portas | 05 | Pendente |
| 08 | API de conexões e proteção contra concorrência | 06, 07 | Pendente |
| 09 | Consulta e associação pela mesa | 08 | Pendente |
| 10 | Visualização frontal do rack e associação pela porta | 09 | Pendente |
| 11 | Persistência do layout e revisões | 06, 07, 10 | Pendente |
| 12 | Área de desenho e posicionamento de mesas/racks | 11 | Pendente |
| 13 | Paredes, portas, janelas e setores | 12 | Pendente |
| 14 | Importação de plantas e calibração de escala | 13 | Pendente |
| 15 | Busca e navegação entre planta, mesa e rack | 14 | Pendente |
| 16 | Página pública e etiquetas QR Code | 15 | Pendente |
| 17 | Consulta completa no celular | 16 | Pendente |
| 18 | Identidade visual Microgate | 17 | Pendente |
| 19 | Validação integrada e da escala prevista | 18 | Pendente |
| 20 | Build de produção, backup e restauração | 19 | Pendente |
| 21 | Publicação e validação no ambiente definitivo | 20 + ambiente informado | Pendente |

Seguir a sequência numérica como padrão. A tabela registra dependências técnicas, não autoriza execução paralela de agentes.

## 5. Etapas detalhadas

### Etapa 01 — Workspace e Docker local

**Objetivo:** tornar o projeto executável localmente, sem dados de clientes.

**Entregas:** monorepo com `apps/api`, `apps/web` e `packages/domain`; React/TypeScript/Vite e Fastify; configurações de build/typecheck; lockfile; Dockerfiles; Compose de desenvolvimento; volumes de PostgreSQL e arquivos; `.env.example`, arquivos ignorados e comandos de operação no README. Criar `docs/PROGRESSO.md`.

**Critérios:** containers da API `topologia_new`, interface `topologia_new_web` e banco `topologia_new_db`; porta local livre; banco/API internos; proxy Vite para o serviço da API; healthcheck com estado do banco; abrir uma tela inicial; alteração de código refletida no desenvolvimento; parar e subir sem perder volumes. Não alterar serviços Docker de outros projetos.

**Solicitação para o agente:**

```text
Implemente a etapa 01 de docs/PLANO_DESENVOLVIMENTO.md, seguindo seu contrato de execução, docs/ESCOPO.md e docs/IMPLEMENTACAO.md. Crie o workspace e o ambiente Docker de desenvolvimento com React, TypeScript, Vite, Fastify e PostgreSQL. Use os nomes de containers definidos, verifique uma porta local disponível, configure proxy e persistência, e documente comandos para subir, acompanhar logs e parar sem apagar dados. Suba o ambiente e valide a interface e o healthcheck. Crie docs/PROGRESSO.md com as evidências. Conclua esta etapa sem iniciar a próxima.
```

### Etapa 02 — Domínio, banco e migrações

**Objetivo:** estabelecer a estrutura que protege as relações do parque.

**Entregas:** contratos de domínio e migrações versionadas para usuários, sessões, empresas, permissões, unidades, andares, plantas, setores, mesas, pontos, datacenters, racks, equipamentos, portas e conexões. A geometria terá contrato próprio, independente de Konva. Implementar a ferramenta de migração e documentar seu uso.

**Critérios:** identificadores estáveis; vínculos entre entidades da mesma empresa protegidos no banco; unicidade de ponto e porta na conexão; nomes únicos no respectivo pai, preservando grafia; capacidade, posição e ocupação em U; migrações aplicáveis a banco novo e volume existente sem reset. Estruturas poderão evoluir nas próximas etapas mediante migrações.

**Solicitação para o agente:**

```text
Implemente a etapa 02 de docs/PLANO_DESENVOLVIMENTO.md e siga o contrato de execução e os documentos de escopo e implementação. Modele o domínio e crie migrações para a hierarquia, acessos, mesas/pontos, datacenters/racks/equipamentos/portas e conexão única. Proteja no PostgreSQL a consistência entre empresas e a ocupação em U, inclusive contra concorrência. Defina um contrato de geometria independente do renderizador. Valide migrações em banco novo e em volume já inicializado e teste as restrições relevantes. Não carregue cadastros de clientes. Atualize o progresso e conclua somente esta etapa.
```

### Etapa 03 — Administrador, login e sessões

**Objetivo:** disponibilizar autenticação real para a aplicação.

**Entregas:** provisionamento explícito do primeiro administrador; hash de senha adequado; sessões persistidas; login, logout, consulta da sessão e expiração; proteção de escrita contra outras origens e limitação de tentativas; tela de login e rotas autenticadas.

**Critérios:** sem credencial padrão no repositório; provisionamento repetido não troca a senha nem duplica o administrador silenciosamente; cookie HttpOnly com configuração de produção; logout invalida sessão; requisição sem sessão não acessa o parque; atualização da página mantém sessão válida; mensagens não expõem credenciais. Validar API e fluxo no navegador.

**Solicitação para o agente:**

```text
Implemente a etapa 03 de docs/PLANO_DESENVOLVIMENTO.md conforme seu contrato, escopo e arquitetura. Entregue o provisionamento explícito do administrador, autenticação com sessões no banco, login/logout e tela de login funcional. Proteja cookies e operações de escrita, limite tentativas e não inclua senha padrão nem credenciais reais nos arquivos versionáveis. Teste expiração, invalidação no logout, acesso sem sessão e permanência após recarregar. Valide o fluxo em navegador e documente como o usuário cria seu administrador. Atualize o progresso sem iniciar a próxima etapa.
```

### Etapa 04 — Usuários e permissões por empresa

**Objetivo:** implementar o administrador geral e os dois níveis por cliente.

**Entregas:** cadastro/edição/desativação de usuários e atribuição/revogação de permissões pelo administrador; criação básica de empresas necessária às permissões; tela administrativa; serviço central de autorização; seletor das empresas acessíveis.

**Critérios:** um usuário pode gerenciar a empresa A e visualizar B; visualizador não escreve por chamada direta à API; gerente não gerencia usuários/permissões globais; IDs de outra empresa não liberam acesso; desativação/revogação passa a valer nas próximas requisições mesmo com sessão existente; formulários não retornam hashes ou sessões.

**Solicitação para o agente:**

```text
Implemente a etapa 04 de docs/PLANO_DESENVOLVIMENTO.md, seguindo o contrato e os documentos existentes. Entregue administração de usuários e empresas e concessão de gerenciamento ou visualização por empresa, exclusiva do administrador geral. Centralize a autorização na API e integre a navegação inicial às empresas autorizadas. Teste um mesmo usuário com papéis distintos em duas empresas, tentativas diretas de escrita como visualizador, referências a empresa não autorizada e revogação/desativação com sessão existente. Use dados sintéticos de teste. Valide a interface e registre as evidências no progresso.
```

### Etapa 05 — Organização do parque

**Objetivo:** cadastrar Empresa → Unidade → Andar → Planta e datacenters por unidade.

**Entregas:** API e telas para empresas, unidades, andares, plantas e datacenters; navegação e estados vazios; nomes livres; identificação de matriz/filial/CD; proteção contra exclusão de pais com dependências. Definir explicitamente a política de exclusão/arquivamento e documentá-la.

**Critérios:** duas unidades e dois datacenters na mesma unidade; seleção do contexto correta; gerente opera apenas clientes autorizados; criação de empresas e atribuição de acessos continuam com o administrador geral; renomear mantém IDs; validar filiação de todos os pais; ainda não exigir uma imagem para criar planta.

**Solicitação para o agente:**

```text
Implemente a etapa 05 de docs/PLANO_DESENVOLVIMENTO.md pelo contrato de execução. Complete os cadastros e telas de empresas, unidades, andares, plantas e datacenters, com navegação contextual e estados vazios. Permita matriz/filial/CD e vários datacenters por unidade. Mantenha a criação de empresas e os acessos globais sob o administrador, e a gestão do parque com o gerente autorizado. Proteja dependências e filiações e preserve IDs ao renomear. Valide no navegador um cadastro manual de matriz e filial, andares e plantas, e dois datacenters na matriz. Atualize o progresso.
```

### Etapa 06 — Mesas e pontos

**Objetivo:** cadastrar mesas com seus pontos sem depender de racks existentes.

**Entregas:** API e formulários de mesa e pontos; criação de N pontos em uma transação; sequência inicial e nomes editáveis; posição/dimensão/rotação como dados do domínio; lista de mesas e detalhe de pontos; apresentação de ponto não associado.

**Critérios:** criar mesa com oito pontos; editar nomes preservando IDs; aumentar quantidade preservando os existentes; reduzir sem apagar vínculos; mesas de mesmo nome em plantas distintas; não inferir quantidade pelo maior número do nome do ponto. Definir limites de entrada com erros claros. Remoção de mesa/ponto segue a política de dependências.

**Solicitação para o agente:**

```text
Implemente a etapa 06 de docs/PLANO_DESENVOLVIMENTO.md conforme o contrato, escopo e arquitetura. Entregue cadastro, lista e detalhe de mesas com pontos pertencentes a elas. A criação de uma mesa com N pontos deve ser transacional, com sequência inicial e nomes editáveis. Permita criar sem racks, ampliar pontos sem substituir os existentes e proteja reduções/exclusões que afetem conexões. Preserve IDs e a grafia dos nomes. Valide manualmente no navegador uma mesa com oito pontos e teste entradas inválidas e isolamento por empresa. Registre o resultado no progresso.
```

### Etapa 07 — Racks, equipamentos e portas

**Objetivo:** registrar a estrutura física do rack antes da visualização gráfica.

**Entregas:** API e formulários/listas para racks com capacidade em U, equipamentos genéricos e patch panels com quantidade de portas; geração de portas em transação; nome/tipo/U inicial/altura; proteção da ocupação no banco e validações na API.

**Critérios:** criar patch panels de 24 e 48 portas; equipamento de múltiplas U; limites positivos e inteiros; rejeitar sobreposição e capacidade excedida, inclusive em gravações concorrentes; editar posições sem perda de IDs; redução de portas/capacidade não destrói vínculos ou equipamentos; retornar conflito compreensível.

**Solicitação para o agente:**

```text
Implemente a etapa 07 de docs/PLANO_DESENVOLVIMENTO.md seguindo seu contrato e os documentos de referência. Entregue cadastros de racks, equipamentos genéricos e patch panels com criação de portas em lote. Valide U inicial, altura, capacidade e quantidade de portas na API e proteja sobreposição concorrente no banco. Preserve identificadores nas alterações e bloqueie reduções com dependências. Crie formulários e listas utilizáveis; a frente gráfica do rack será feita na etapa 10. Teste equipamentos de múltiplas U, patch panels de 24/48 portas e conflitos. Atualize o progresso.
```

### Etapa 08 — Conexões e concorrência

**Objetivo:** implementar a fonte única do vínculo ponto ↔ porta.

**Entregas:** consulta, associação, desvinculação e transferência explícita; transações; caminho composto a partir dos cadastros; consulta inversa; validações de empresa e papel; proteção contra alterações concorrentes e atualização de telas consumidoras.

**Critérios:** associação vista por ambos os lados; ponto e porta com no máximo um vínculo; transferência com estado esperado da conexão, impedindo remover vínculo que outra sessão alterou; rejeitar empresas diferentes; permitir andares diferentes; renomear não quebra relação. Testar duas associações simultâneas à mesma porta e ao mesmo ponto, com apenas uma bem-sucedida.

**Solicitação para o agente:**

```text
Implemente a etapa 08 de docs/PLANO_DESENVOLVIMENTO.md e siga o contrato, escopo e arquitetura. Entregue a API transacional de associação, desvinculação e transferência explícita entre ponto de mesa e porta de patch panel, usando uma única relação persistida. Retorne o caminho atualizado pelas duas extremidades e proteja empresa, papel e estado esperado nas alterações. Não substitua vínculos silenciosamente. Teste concorrência por ponto e por porta, transferência com estado desatualizado, conexões entre andares e bloqueio entre empresas. Atualize o progresso com resultados dos testes de API/banco.
```

### Etapa 09 — Associação pela mesa

**Objetivo:** entregar o primeiro fluxo completo de cabeamento na interface.

**Entregas:** detalhe da mesa com pontos e caminhos; seleção de datacenter/rack/patch panel/porta; identificação de destinos ocupados; desvinculação/transferência explícita; feedback de gravação e erros; consulta ao destino.

**Critérios:** associar dois pontos manualmente a portas diferentes; atualizar a tela sem dados obsoletos; manter filtros do contexto; avisar conexão alterada em outra sessão; visualizador consulta sem controles de escrita. O formulário deve permitir encontrar os destinos pelos nomes reais, sem memorizar IDs.

**Solicitação para o agente:**

```text
Implemente a etapa 09 de docs/PLANO_DESENVOLVIMENTO.md conforme o contrato e os documentos existentes. Complete o detalhe da mesa para consultar e associar cada ponto, selecionando datacenter, rack, patch panel e porta. Mostre portas livres/ocupadas e entregue desvinculação e transferência explícitas, com estados de carregamento, sucesso e erro. Trate conflitos de outra sessão e atualize a informação pelas duas extremidades. Bloqueie escrita para visualizadores na API e na interface. Valide no navegador uma mesa com oito pontos e duas associações distintas. Atualize o progresso.
```

### Etapa 10 — Rack frontal 2D

**Objetivo:** visualizar a ocupação e operar conexões a partir das portas.

**Entregas:** vista frontal com U de baixo para cima; equipamentos posicionados e altura proporcional; patch panels com portas selecionáveis; painel da porta e consulta inversa; associação pelo rack; edição de posição por arraste e campos/botões.

**Critérios:** ocupação coincide com cadastro; portas livres/ocupadas com texto e cor; ponto associado pelo rack aparece imediatamente na mesa; editar posição não altera cabeamento; dados persistem após recarregar; layout não depende de imagens comerciais de equipamentos. Oferecer lista equivalente para portas e acessibilidade.

**Solicitação para o agente:**

```text
Implemente a etapa 10 de docs/PLANO_DESENVOLVIMENTO.md pelo contrato, escopo e arquitetura. Entregue a vista frontal 2D dos racks com numeração U, equipamentos genéricos e portas de patch panels. Ao selecionar uma porta, permita consultar e, para gerentes, associar/desvincular/transferir um ponto pelo fluxo já existente. Permita posicionar equipamentos por arraste e por campos/botões, sem violar a ocupação. Inclua lista equivalente das portas. Valide o vínculo criado pelo rack na mesa, edição de posição e persistência após recarregar. Registre evidências de navegador e API no progresso.
```

### Etapa 11 — Persistência e contrato do layout

**Objetivo:** armazenar geometria sem acoplar o banco ao editor.

**Entregas:** contratos para paredes, aberturas, polígonos de setores, fundo, posições de mesas/racks e câmera; separação entre dimensões do domínio e pixels; endpoints de leitura/salvamento com revisão; validação do documento e das referências a objetos.

**Critérios:** salvar layout não altera pontos/conexões; uma mesa tem identidade única e posição canônica; referências a objetos inexistentes, de outra empresa/planta ou duplicados são rejeitadas; setores do desenho correspondem a registros do cadastro; revisão antiga não sobrescreve uma nova. Cadastros criados/removidos após a leitura do layout não são restaurados ou apagados por um snapshot desatualizado.

**Solicitação para o agente:**

```text
Implemente a etapa 11 de docs/PLANO_DESENVOLVIMENTO.md conforme seu contrato e documentos de referência. Defina e persista a geometria estruturada da planta com IDs e coordenadas independentes do Konva. Entregue leitura/salvamento com controle de revisão e validação de todos os objetos referenciados. Preserve a fonte canônica de mesas, racks e setores e não altere cabeamento ao salvar layout. Rejeite referências duplicadas, cruzadas ou inexistentes e salvamentos concorrentes desatualizados. Teste conflitos de revisão e cadastros modificados entre leitura e gravação. Atualize o progresso.
```

### Etapa 12 — Área de desenho e posicionamento

**Objetivo:** entregar a base do editor de planta no computador.

**Entregas:** renderizador Konva; seleção, zoom, movimentação, enquadramento, grade/alinhamento; posicionar mesas/racks já cadastrados, dimensionar e girar; painel de propriedades com alternativa ao arraste; salvar, alterações pendentes e desfazer/refazer do layout.

**Critérios:** transformação usa coordenadas do domínio; mover mesa mantém seus pontos; referência ao rack mantém seus equipamentos; salvar/reabrir reproduz layout; desfazer/refazer não desfaz conexão do banco nem restaura cadastro removido; erro de gravação mantém o trabalho local; sair com alterações pendentes é tratado; visualizador navega sem editar.

**Solicitação para o agente:**

```text
Implemente a etapa 12 de docs/PLANO_DESENVOLVIMENTO.md pelo contrato e os documentos de escopo/implementação. Entregue a área de planta em Konva com seleção, zoom, movimentação, enquadramento e posicionamento/dimensionamento/rotação de mesas e racks cadastrados. Inclua campos alternativos ao arraste, grade/alinhamento, salvar, indicação de alterações pendentes e desfazer/refazer restrito ao layout. Preserve IDs, pontos e conexões. Valide mover/girar mesa, salvar/reabrir, conflito de revisão, falha de gravação e acesso visualizador em navegador real. Atualize o progresso.
```

### Etapa 13 — Paredes, portas, janelas e setores

**Objetivo:** permitir desenhar o local do zero.

**Entregas:** ferramentas para paredes, portas/janelas vinculadas a paredes e setores poligonais; propriedades editáveis; identificação de setores; associação da mesa ao setor; validação de geometria e atualização das dependências ao editar/remover.

**Critérios:** desenhar sala com porta e janela; delimitar dois setores e associar mesas; salvar/reabrir mantendo relações; não criar aberturas órfãs; rejeitar medidas e polígonos inválidos; remover setor não apaga mesas/pontos; disponibilizar alternativas por campos para propriedades e ajustes. Não executar detecção automática de paredes.

**Solicitação para o agente:**

```text
Implemente a etapa 13 de docs/PLANO_DESENVOLVIMENTO.md seguindo o contrato e documentos existentes. Entregue desenho/edição de paredes, portas, janelas e setores poligonais, com nomes e associação das mesas aos setores. Persista geometria e relações no modelo estruturado, trate dependências ao modificar paredes ou setores e não apague mesas ao remover um setor. Integre seleção, propriedades e desfazer/refazer. Valide no navegador uma planta desenhada do zero com dois setores, porta, janela e mesas; salve, recarregue e confira as relações. Atualize o progresso.
```

### Etapa 14 — Importação de plantas e escala

**Objetivo:** utilizar imagens e PDFs como base do desenho.

**Entregas:** upload de PNG/JPG/PDF; escolher página de PDF com PDF.js; armazenamento persistente do original e fundo renderizado; controle de acesso aos arquivos; alinhamento, opacidade e escala; calibração por dois pontos e distância real.

**Critérios:** validar tipo, tamanho e dimensões com limites documentados; arquivos não servidos por caminho arbitrário nem publicamente; troca de fundo mantém mesas/conexões; conversão/calibração não muda posições canônicas silenciosamente; leitura de arquivo privado verifica empresa; visualizador recebe somente acesso de leitura. Validar reinício dos containers com arquivos presentes.

**Solicitação para o agente:**

```text
Implemente a etapa 14 de docs/PLANO_DESENVOLVIMENTO.md conforme o contrato e documentos de referência. Entregue importação de PNG/JPG/PDF como fundo, escolha de página com PDF.js, armazenamento persistente e acesso autorizado aos arquivos. Adicione alinhamento, opacidade e calibração de escala por distância conhecida, separando a transformação do fundo da geometria do parque. Proteja entradas e caminhos e documente limites. Valide imagem, PDF com várias páginas, troca de fundo, acesso cruzado entre empresas e persistência após reiniciar. Atualize o progresso.
```

### Etapa 15 — Busca e navegação integrada

**Objetivo:** encontrar pontos e percorrer seu caminho sem repetir cadastros.

**Entregas:** busca por nomes de mesa, ponto, datacenter, rack e patch panel; filtros por empresa/unidade/andar/setor; foco na mesa ou rack encontrado; navegação da mesa ao destino e da porta à origem; lista equivalente; localização gráfica opcional do datacenter.

**Critérios:** acesso direto por URL mantém autorização; recarregar/back preserva contexto válido; ponto de outro andar leva à planta correta; objeto sem posição pode ser consultado pela lista; unidade com dois datacenters não mistura racks; resultados incluem apenas empresas autorizadas; conflito entre filtro e destino é resolvido explicitamente.

**Solicitação para o agente:**

```text
Implemente a etapa 15 de docs/PLANO_DESENVOLVIMENTO.md pelo contrato e documentos existentes. Integre busca, filtros e navegação entre planta, mesa, ponto, datacenter, rack e porta usando os mesmos IDs e vínculos. Permita localizar o objeto na planta e consultá-lo pela lista mesmo quando ainda não foi posicionado. Ao atravessar uma conexão entre andares, abra o contexto correto. Preserve navegação ao recarregar e voltar e mantenha autorização em URLs diretas. Valide dois datacenters na mesma unidade e consulta nos dois sentidos. Atualize o progresso.
```

### Etapa 16 — Consulta pública e QR Code

**Objetivo:** gerar uma etiqueta que abre somente a mesa correspondente.

**Entregas:** ativação/desativação e renovação do endereço público; identificador aleatório; endpoint com resposta própria; página sem login; geração local do QR e etiqueta imprimível; configuração da origem pública e distinção entre teste local e URL definitiva.

**Critérios:** endereço estável após renomear/mover/alterar conexão; página contém apenas mesa/pontos/destinos; não expõe dados administrativos ou acesso ao mapa; token inválido/desativado não abre mesa; renovação invalida o anterior; visualizar não permite criar/alterar token; conteúdo do QR confere com o endereço esperado. QR em localhost só é validado no navegador local; teste com celular exige endereço alcançável pelo dispositivo.

**Solicitação para o agente:**

```text
Implemente a etapa 16 de docs/PLANO_DESENVOLVIMENTO.md seguindo o contrato e o escopo. Entregue a página pública restrita à mesa, com seus pontos e destinos, usando endpoint próprio e identificador aleatório. Inclua gestão do endereço por gerente/admin, desativação/renovação e geração local de etiqueta QR imprimível com origem pública configurável. Não exponha navegação para o restante do parque. Valide sem login, confira o conteúdo do QR, estabilidade após alterações, bloqueio de token inválido/desativado e invalidação na renovação. Distinga prova local de teste em celular físico. Atualize o progresso.
```

### Etapa 17 — Consulta completa no celular

**Objetivo:** adaptar todos os fluxos de leitura, não apenas a página QR.

**Entregas:** navegação responsiva de empresa/unidade/andar, planta com zoom/movimentação por toque, seleção de mesas/racks/portas, busca, painel de detalhes e listas equivalentes; telas públicas e autenticadas. Concentrar ferramentas de edição no computador.

**Critérios:** validar larguras de 360, 375, 390 e 768 px, além do computador; sem rolagem horizontal involuntária da página; controles de leitura sem hover; alvos de toque adequados; portas pequenas acessíveis pela lista; carregamento/erro/estado vazio legíveis; orientação vertical/horizontal. Viewport não substitui autorização: papéis continuam definidos pela conta e empresa na API.

**Solicitação para o agente:**

```text
Implemente a etapa 17 de docs/PLANO_DESENVOLVIMENTO.md pelo contrato e documentos de referência. Garanta consulta completa no celular para visualizadores autenticados e QR público: hierarquia, planta, mesas, racks, portas, busca, detalhes e listas equivalentes. Adapte navegação e gestos de zoom/movimentação, elimine dependência de hover e preserve a edição na interface de computador. Não altere autorização da API com base no tamanho da tela. Verifique em navegador real as larguras previstas e o fluxo completo de um visualizador. Registre screenshots e limites da prova, diferenciando viewport de dispositivo físico. Atualize o progresso.
```

### Etapa 18 — Identidade visual Microgate

**Objetivo:** aplicar a identidade da empresa sem prejudicar a documentação do parque.

**Entregas:** tokens de cor, tipografia, espaçamento e estados; fundo escuro, textos claros e detalhes em azul claro; navegação, formulários, planta, racks e página QR coerentes. Consultar o site oficial e usar as skills de interface aplicáveis.

**Critérios:** contraste/foco/rótulos adequados; estados não dependem apenas de cor; legibilidade de nomes e portas; sem controles essenciais ocultos; manter funcionalidades validadas; conferir computador/celular. Incorporar logos somente se arquivos forem fornecidos; na ausência deles usar identificação textual simples e registrar a pendência, sem bloquear o restante.

**Solicitação para o agente:**

```text
Implemente a etapa 18 de docs/PLANO_DESENVOLVIMENTO.md seguindo o contrato e o escopo. Aplique a identidade do site microgateinformatica.com.br ao sistema com tokens consistentes, fundo escuro, textos claros e acentos em azul claro. Use as skills de interface pertinentes e preserve os fluxos funcionais existentes. Confira legibilidade, contraste, foco e estados de mesas/portas, além da consulta no celular e do QR. Use logos apenas quando fornecidas; caso contrário mantenha identificação textual e registre a pendência. Valide em navegador real, salve evidências visuais e atualize o progresso.
```

### Etapa 19 — Validação integrada e escala

**Objetivo:** provar os critérios da versão 1 e corrigir falhas antes da produção.

**Entregas:** testes integrados pertinentes, roteiro de cadastro manual, dados sintéticos separados e relatório `docs/VALIDACAO.md` com resultado de cada critério do escopo. Corrigir falhas encontradas e repetir os testes afetados.

**Critérios:** duas empresas, matriz/filial, dois datacenters por unidade, equipamentos genéricos, conexões pelos dois lados, autorização e concorrência; escala mínima de 40 mesas × 8 pontos e 3 racks × 7 patch panels × 24 portas; importação e desenho; celular e QR; persistência de banco/arquivos/layout após reiniciar. Medir busca, carregamento e interação e registrar o ambiente e limitações, sem inventar metas numéricas não acordadas.

**Solicitação para o agente:**

```text
Execute a etapa 19 de docs/PLANO_DESENVOLVIMENTO.md pelo contrato. Valide todos os 15 critérios de docs/ESCOPO.md e corrija falhas encontradas. Use ambiente separado com dados sintéticos na escala definida; preserve o banco vazio ou os cadastros manuais do usuário. Teste API/banco, concorrência, isolamento, navegador em computador/celular, QR, desenho/importação e persistência após reinício. Crie docs/VALIDACAO.md com evidência por critério e roteiro para o usuário cadastrar manualmente. Registre medidas de desempenho e limites reais das verificações. Conclua a etapa apenas com critérios atendidos ou pendências essenciais explicitamente registradas.
```

### Etapa 20 — Preparação de produção e recuperação

**Objetivo:** produzir uma instalação reproduzível e recuperável.

**Entregas:** Dockerfile de produção, build da interface, API servindo a aplicação, Compose de produção, `.env.example` documentado, migrações de atualização, healthchecks e `docs/OPERACAO.md`. Procedimentos/scripts de backup e restauração conjunta do banco e arquivos, criação do administrador, atualização e recuperação de versão compatível.

**Critérios:** testar instalação limpa e atualização sobre dados existentes em ambiente local de validação; sem dados sintéticos automáticos; credenciais/origem pública obrigatórias; banco sem publicação externa; iniciar/parar mantendo dados; gerar backup consistente e restaurar em volumes isolados; verificar mesas, vínculos, layout e arquivos restaurados; assegurar que rotas diretas e QR funcionam no build servido. Não publicar ainda em servidor externo.

**Solicitação para o agente:**

```text
Implemente a etapa 20 de docs/PLANO_DESENVOLVIMENTO.md seguindo o contrato, escopo e arquitetura. Entregue build e Compose de produção, configuração documentada e procedimentos de instalação, migração, atualização, backup e restauração de banco e arquivos. Teste o build de produção localmente, inclusive URLs diretas e QR. Faça um backup de dados sintéticos e restaure em volumes isolados, verificando conexões, layout e arquivos sem sobrescrever o ambiente do usuário. Crie docs/OPERACAO.md e registre as evidências. Prepare a publicação, mas não altere servidor externo nesta etapa.
```

### Etapa 21 — Publicação definitiva

**Objetivo:** instalar e validar a aplicação no servidor definido pelo usuário.

**Pré-requisitos:** etapa 20 concluída; servidor e acesso indicados; domínio/origem pública informados; autorização explícita de publicação. Sem esses dados, manter a etapa pendente e registrar o que falta. Não inferir destinos a partir de projetos anteriores.

**Entregas:** instalação com volumes e segredos de produção; proxy HTTPS do ambiente; migrações; administrador; verificação do acesso público/autenticado; rotina de backup conforme os recursos do servidor; registro em `docs/OPERACAO.md` e `docs/VALIDACAO.md`.

**Critérios:** login e papéis funcionam no domínio; HTTP/HTTPS e cookies corretos; arquivos privados protegidos; QR utiliza endereço definitivo e pode ser lido em celular real; reinício mantém dados; backup/restauração documentados; não prejudicar aplicações existentes. A publicação da versão 1 termina quando esses critérios forem demonstrados; 3D continua como evolução futura.

**Solicitação para o agente:**

```text
Execute a etapa 21 de docs/PLANO_DESENVOLVIMENTO.md no servidor e domínio que informei nesta conversa; esta solicitação autoriza a publicação do Topologia New nesse destino. Siga o contrato e docs/OPERACAO.md. Verifique a preparação de produção, preserve aplicações e dados existentes, configure volumes, segredos, HTTPS, migrações e backup, e publique a aplicação. Valide no domínio login, permissões, planta, racks, arquivos e QR. Não invente destinos ou credenciais: se faltar informação essencial, solicite-a antes da ação dependente. Registre a prova de produção e deixe explícita qualquer validação física ainda pendente.
```

## 6. Cobertura dos critérios do escopo

Todos os critérios abaixo são conferidos novamente na etapa 19. A etapa 21 acrescenta a prova no ambiente publicado.

| Critério de ESCOPO.md | Implementação principal |
|---|---|
| 1. Duas empresas com isolamento | 02, 04, 05 |
| 2. Matriz/filial, andares e plantas | 05 |
| 3. Desenho, imagem e página de PDF | 11–14 |
| 4. Setores, mesa com oito pontos, posição e rotação | 06, 12, 13 |
| 5. Dois datacenters e racks na mesma unidade | 05, 07 |
| 6. Equipamentos e capacidades diferentes | 07, 10 |
| 7. Associar pela mesa e consultar na porta | 08–10 |
| 8. Associar pela porta e consultar na mesa | 08–10 |
| 9. Impedir duplicidade/transferência silenciosa | 02, 08, 09, 10 |
| 10. Impedir sobreposição/reduções destrutivas | 02, 06, 07, 10 |
| 11. Persistência após recarregar/reiniciar | 01, 02, 11–14, 20 |
| 12. Visualizador sem escrita por API | 03, 04 e todas as rotas posteriores |
| 13. Consulta completa no celular | 15, 17, 18 |
| 14. QR sem login limitado à mesa | 16, 17 |
| 15. Escala mínima com dados sintéticos | 19 |

## 7. Solicitações de apoio

### Retomar o desenvolvimento em outro chat

```text
Retome o projeto Topologia New nesta pasta. Leia as instruções aplicáveis, docs/ESCOPO.md, docs/IMPLEMENTACAO.md, docs/PLANO_DESENVOLVIMENTO.md e docs/PROGRESSO.md, se existir. Inspecione o código e o estado real do ambiente sem descartar alterações existentes. Identifique a primeira etapa incompleta e o que falta nela, considerando as evidências, e implemente apenas essa etapa conforme o contrato do plano. Se toda a etapa já estiver comprovadamente concluída, registre isso e prossiga para a primeira pendente. Não use o projeto antigo ou sua memória como referência. Ao terminar, atualize o progresso e informe a próxima etapa.
```

### Corrigir uma etapa antes de avançar

Substitua `[NN]` e `[problema observado]` antes de enviar.

```text
Corrija a etapa [NN] de docs/PLANO_DESENVOLVIMENTO.md. Problema observado: [problema observado]. Leia o escopo, a arquitetura e o progresso, reproduza o problema e corrija a causa preservando os demais fluxos e dados. Execute as verificações afetadas e confirme novamente os critérios essenciais da etapa. Atualize docs/PROGRESSO.md e a situação no plano com evidências. Não avance para a etapa seguinte nem amplie o escopo para funcionalidades adiadas.
```

### Conferir a entrega de uma etapa

Substitua `[NN]` antes de enviar.

```text
Revise a entrega da etapa [NN] de docs/PLANO_DESENVOLVIMENTO.md contra seus critérios, docs/ESCOPO.md e docs/IMPLEMENTACAO.md. Inspecione o código e execute as verificações relevantes. Distinga resultado de build/typecheck de prova de API/banco, navegador e produção. Corrija falhas necessárias à conclusão dessa etapa, preserve trabalho não relacionado e registre o resultado no progresso. Não marque como concluído o que não foi verificado e não inicie a próxima etapa.
```

## 8. Formato do registro de progresso

Modelo para `docs/PROGRESSO.md`, a ser criado na primeira etapa:

```markdown
# Progresso do desenvolvimento

Atualizado em: [data]
Etapa atual: [NN — nome]
Situação: [Em andamento / Concluída / Bloqueada]

## Entrega

[O que foi implementado e arquivos principais.]

## Verificação

| Verificação | Comando ou procedimento | Resultado |
|---|---|---|
| Typecheck/build | ... | ... |
| API/banco | ... | ... |
| Navegador local | ... | ... |
| Celular físico, quando aplicável | ... | ... |
| Produção, quando aplicável | ... | ... |

## Ambiente

[URL, serviços ativos e comando para parar sem remover volumes.]

## Pendências

[Informação externa necessária ou critério ainda sem prova; indicar quando não houver.]

## Próxima etapa

[NN — nome, com dependências.]

## Histórico de etapas

[Acrescentar registros concisos sem apagar as evidências anteriores.]
```

Conservar evidências relevantes no histórico e manter o resumo atual no início. O plano organiza o trabalho; a conclusão depende das verificações da aplicação real.

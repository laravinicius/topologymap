# API de conexões — etapa 08

Implementada em 01/10/2026. Todas as rotas abaixo exigem sessão e usam o prefixo `/api/companies/:companyId`. Leituras permitem administrador, gerente e visualizador autorizados; escritas permitem administrador ou gerente da empresa. Origin continua obrigatório para escrita. IDs são UUIDs e os corpos recusam campos adicionais/coerção de tipos.

| Método e rota relativa | Entrada | Resposta |
|---|---|---|
| `GET /points` | — | `{ points }` da empresa, com `deskName`, `planName`, connectionId e connection; usado para associar pela porta |
| `GET /points/:pointId/connection` | — | `{ pointId, connection }`; connection null se livre |
| `GET /ports/:portId/connection` | — | `{ portId, connection }`; connection null se livre |
| `GET /connections/:connectionId` | — | ConnectionDetail; 404 se inexistente/fora da empresa |
| `POST /connections` | `{ pointId, portId }` | 201, ConnectionDetail |
| `POST /connections/:connectionId/transfer` | `{ pointId, portId, expected }` | 200, ConnectionDetail com revisão incrementada |
| `DELETE /connections/:connectionId` | `{ expected }` | 200, `{ pointId, portId, connection: null }` |

`expected` exige as **duas extremidades anteriores e a revisão da última leitura**:

```json
{
  "expected": {
    "pointId": "UUID-do-ponto-anterior",
    "portId": "UUID-da-porta-anterior",
    "revision": 1
  },
  "pointId": "UUID-do-ponto-desejado",
  "portId": "UUID-da-porta-desejada"
}
```

Esse exemplo representa uma transferência; remova pointId/portId externos ao expected para desvincular. Copie o ID da conexão para a URL e o estado do objeto retornado pela consulta. Revisão aceita somente inteiro positivo até `Number.MAX_SAFE_INTEGER`; nunca use um nome como identificador.

Transferir permite alterar ponto, porta ou ambos, mantendo o ID/createdAt da conexão. Ao menos uma extremidade deve mudar. A extremidade mantida pode continuar ocupada pela própria conexão; qualquer destino ocupado por **outra** conexão resulta em 409 e preserva os dois vínculos. A operação não desloca outro ponto nem remove outro registro. Para mudar um destino ocupado, consulte e desvincule explicitamente seu vínculo com o estado atual antes de uma nova operação. Cada operação é uma transação independente; não há troca implícita de dois vínculos.

Associar exige ponto e porta livres, inclusive quando a tentativa repete exatamente o mesmo par. Não há upsert. Toda associação, transferência ou desvinculação usa BEGIN/COMMIT/ROLLBACK. A única tabela persistida é `connections`, com unicidades independentes para ponto/porta, FKs compostas por empresa e trigger de revisão já presentes na migração 002; nenhuma migração nova foi necessária.

Transferência e remoção usam UPDATE/DELETE condicionados simultaneamente por empresa, ID, revisão e extremidades esperadas. Sob READ COMMITTED, o PostgreSQL reavalia a condição após esperar a escrita concorrente; zero linhas significa 409. Unicidades e FKs continuam protegendo SQL direto e corridas com remoção das extremidades. Colisão de unicidade, referência alterada, serialização/deadlock são traduzidos para 409 com rollback completo, sem revelar dados internos. Contratos conferidos nas documentações oficiais de [isolamento](https://www.postgresql.org/docs/current/transaction-iso.html) e [locks](https://www.postgresql.org/docs/current/explicit-locking.html).

Após 409, releia **ambas as extremidades** e obtenha o vínculo/revisão atuais. Não repita automaticamente usando uma revisão nova sem apresentar o estado ao usuário. Uma conexão removida e recriada tem outro ID: o estado antigo não pode apagar a nova, mesmo que ela volte ao mesmo par e à revisão 1. Em alteração, ID inexistente/fora da empresa e estado obsoleto produzem o mesmo conflito genérico; referências de destino fora da empresa/inexistentes produzem 404. Visualizador recebe 403 e empresa sem acesso 404, conforme autorização central; sessão inválida recebe 401.

## Caminho retornado

`ConnectionDetail` contém `id`, `companyId`, `pointId`, `portId`, `revision`, `createdAt`, `updatedAt` e `path`:

```text
path.company: { id, name }
path.origin: unit, floor, plan, sector, desk, point
path.destination: unit, datacenter, rack, plan, floor, patchPanel, port
```

Cada elemento é `{ id, name }`; sector pode ser null. Plan/floor do destino são null quando o rack ainda não tem filiação espacial. Todos os nomes vêm dos cadastros atuais, com a grafia preservada. O caminho não é salvo em outra tabela nem duplicado nas extremidades. O mesmo SELECT com joins serve os dois sentidos e os detalhes existentes de mesa/equipamento. Renomear ou posicionar não recria a conexão. Não há restrição de igualdade entre andares ou unidades; exige-se a mesma empresa.

Os detalhes de mesa e equipamento mantêm `connectionId` e acrescentam `connection: ConnectionDetail | null` em cada ponto/porta. A interface exibe o caminho textual nos dois lados e revalida pelo fluxo existente de foco, intervalo de 30 segundos ou **Atualizar acessos**. Sem push/WebSocket. O formulário pela mesa foi entregue na etapa 09; frente gráfica e associação pela porta foram entregues na etapa 10. A tela do rack usa `GET /points` para apresentar pontos livres por mesa/planta, mas grava exclusivamente com as rotas POST, POST /transfer e DELETE existentes.

## Interface pela mesa — etapa 09

Na mesa selecionada, **Associar** abre a seleção datacenter → rack → patch panel → porta. Datacenters incluem o nome da unidade e permitem destinos em outra unidade da mesma empresa. O formulário mostra os nomes cadastrados, ocupação de cada porta, contagens e resumo do destino; não exige memorizar UUIDs. Portas ocupadas exibem a mesa/ponto e não permitem seleção. **Confirmar associação** usa o POST existente.

Em ponto associado, **Transferir** abre o destino atual e exige uma porta livre diferente. **Revisar transferência** mostra o destino proposto; somente **Confirmar transferência** grava e libera a porta anterior. **Desvincular** → **Revisar desvinculação** → **Confirmar desvinculação** libera ambas as extremidades. Cancelar mantém o vínculo. Nenhuma ação remove um vínculo alheio implicitamente.

O estado esperado é congelado ao abrir a ação. Se a consulta de fundo detectar outro ID/revisão, o formulário avisa e bloqueia a escrita antiga. HTTP 409 relê o ponto, porta anterior e porta tentada, atualiza o detalhe e a ocupação, apresenta o conflito e exige **Fechar e revisar ponto**, seguido de uma nova ação. Não há repetição automática. Falhas de rede também exigem revisão; uma escrita já concluída com atualização posterior falha recebe mensagem específica. Após sucesso, as extremidades são consultadas novamente e mesa/portas revalidadas. As demais sessões usam a revalidação existente por foco/intervalo/atualização manual.

Visualizadores consultam caminhos sem controles de escrita. A API continua devolvendo 403 para associação, transferência e desvinculação, inclusive após rebaixar o papel com a sessão existente. A revalidação atualiza o papel e fecha o editor.

## Verificação reproduzível

Com o Compose ativo, execute `npm run test:connections`. A suíte cria `topologia_new_test08_<sufixo>`, aplica as migrações e provisiona credencial sintética aleatória apenas ali. Remove esse banco ao terminar. Não modifica os cadastros de trabalho.

Concorrência é sincronizada por um terceiro cliente PostgreSQL: mantém um lock, inicia duas requisições Fastify e confirma ambas aguardando locks em `pg_stat_activity` antes de liberar. São testadas associação concorrente por ponto/porta, duas transferências do mesmo estado, transferências para uma extremidade disputada e DELETE contra transferência. Resultado e prova no navegador registrados em [PROGRESSO.md](PROGRESSO.md#etapa-08--conexões-e-concorrência).

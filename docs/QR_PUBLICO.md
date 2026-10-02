# Consulta pública e etiquetas QR — etapa 16

No cadastro de uma mesa, gerente da empresa e administrador geral encontram **Endereço público e etiqueta QR**. Visualizadores consultam o parque autenticado, sem receber token/ferramentas de publicação. A autorização é aplicada na API e revalida atividade/papel a cada pedido.

1. Selecione Empresa → Unidade → Andar → Planta → Mesa.
2. Use **Ativar consulta pública**. Somente essa operação cria o identificador aleatório de 256 bits.
3. Confira o endereço e **Abrir consulta pública**. A página abre sem login, com nome da mesa, pontos e destinos datacenter/rack/patch panel/porta, sem links para outros objetos.
4. Use **Imprimir etiqueta**. A impressão contém somente nome, QR e endereço. Geração local por `qrcode` 1.5.4, sem CDN/serviço externo: preto/branco, margem de quatro módulos, PNG de 600 px e impressão a 55 mm.

**Desativar consulta pública** exige confirmação e bloqueia o endereço com HTTP 404. **Reativar consulta pública** reutiliza o identificador. **Renovar endereço** exige confirmação e invalida o anterior definitivamente, mantendo o estado ativo/desativado. Substitua as etiquetas após renovar. Conflito de revisão retorna 409 e exige atualização; não substitui silenciosamente a mudança de outra sessão.

Renomear mesa/ponto/destino, alterar posição/setor/planta e trocar conexões não altera o identificador. A consulta lê a conexão canônica e os nomes atuais; a etiqueta guarda somente a URL. Um nome impresso antigo continua abrindo a mesa atual. Excluir a mesa pelas regras existentes de dependências remove seu endereço público.

## Origem pública

No `.env`, configure `PUBLIC_ORIGIN` com a origem completa, sem caminho, query, credenciais ou barra final. Exemplo para quando o domínio estiver disponível:

```dotenv
PUBLIC_ORIGIN=https://consulta.exemplo.com.br
```

Recrie os serviços com `npm run dev:all`. No Compose local, o padrão é `http://localhost:WEB_PORT` (5173 por padrão). Fora do Compose, ausência da variável usa a primeira `APP_ORIGINS`; produção exige HTTPS. A configuração não concede acesso de rede, não publica o serviço e não altera `APP_ORIGINS`, que controla a origem das escritas autenticadas. Origem inválida impede inicialização.

O QR contém `${PUBLIC_ORIGIN}/mesa/${token}`. Alterar a origem não renova o token, mas muda novas etiquetas; as anteriores dependem de manter a origem antiga acessível ou de um redirecionamento futuro. A origem nunca deriva da requisição, Host ou header de proxy.

**Localhost identifica o aparelho que abre a URL.** O Compose permanece em `127.0.0.1:5173`; prova local não comprova leitura por celular físico. Testar no aparelho exige origem alcançável e infraestrutura que encaminhe página/API à mesma aplicação. Domínio, HTTPS e publicação definitiva continuam nas etapas 20/21. Também não houve impressão em papel físico.

## Contrato técnico

| Método e rota | Acesso / resposta |
|---|---|
| `GET/HEAD /api/public/desks/:token` | Sem sessão. GET retorna `PublicDesk`: `name` e `points[]`, com `name` e `destination` nulo ou nomes `datacenter`, `rack`, `patchPanel`, `port`. Sem IDs, filiação, posição, revisão, arquivos ou dados administrativos. |
| `GET /api/companies/:companyId/units/:unitId/floors/:floorId/plans/:planId/desks/:deskId/public-link` | Gerente/admin no contexto completo. `{enabled, token, revision, origin}`. Ausência: token nulo, enabled falso, revisão 0; leitura não cria registro. |
| `PUT` na mesma rota | Gerente/admin; body com `action` (`activate`, `deactivate` ou `renew`) e `expectedRevision` inteiro. Campos extras recusados; conflito 409. |

Migração aditiva `007_desk_public_links.sql`: tabela separada, FK composta mesa/empresa, token único hexadecimal de 64 caracteres, estado e revisão. Sem seed/ativação automática ou alteração de cadastros/layout/conexões. Token recuperável na gestão para reimprimir; ausente nos DTOs internos usuais e para visualizadores. Escritas usam transação e lock da mesa: mesma revisão permite uma gravação. Não há histórico nem reativação de tokens renovados.

Os dois hooks centrais permitem somente a exceção exata GET/HEAD da rota pública; prefixos/outros métodos não abrem a API. A consulta usa um statement SQL/snapshot, `Cache-Control: no-store`, `Referrer-Policy: no-referrer` e `X-Robots-Tag: noindex, nofollow`. Token inválido, inexistente, desativado ou renovado recebe a mesma mensagem 404. O token não autentica chamadas internas nem dá acesso aos fundos.

A entrada React `/mesa/:token` não monta o App autenticado nem consulta sessão/parque. Fetch omite credenciais; erros retiram dados. Foco/intervalo de 30 segundos revalidam; uma página já aberta só descobre a desativação/renovação na próxima consulta. Documento usa referrer `no-referrer`; página pública indica `noindex, nofollow`.

Testes: `npm run test:public`, `npm run test:qr`, `npm run test:db`, `npm run typecheck`, `npm run build`. Evidências e limites em [PROGRESSO.md](PROGRESSO.md). Biblioteca conferida na [documentação oficial node-qrcode](https://github.com/soldair/node-qrcode).

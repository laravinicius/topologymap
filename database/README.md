# Modelo e migrações — etapa 02

`001_access_hierarchy.sql` cria usuários, sessões, empresas, permissões, unidades, andares, plantas, setores, mesas, pontos e datacenters. `002_racks_connections.sql` cria racks, equipamentos, portas e a fonte única das conexões. Nenhuma migração contém dados ou administrador.

## Operação

Na raiz, com o Compose ativo: `npm run db:status` e `npm run db:migrate`. Para executar dentro da API: `npm run db:migrate --workspace @topologia-new/api`. O CLI compilado é `node apps/api/dist/database/cli.js apply` ou `status`, usando as variáveis `DATABASE_*`. O diretório `database/migrations` precisa acompanhar o build; já está incluído no Dockerfile da API.

Arquivos sequenciais `001_nome.sql`, `002_nome.sql`, etc., em UTF-8 e LF. O migrador valida nomes, sequência e histórico inteiro antes de executar SQL. Registra versão, nome, SHA-256 e instante em `public.schema_migrations`; cada versão e seu registro usam a mesma transação e conexão. Um advisory lock de sessão serializa toda a execução. Timeout de locks: 15 s; de cada comando: 60 s. Em falha, a versão incompleta é revertida e o processo retorna código 1; reaplicar retoma as pendentes. Status não cria tabelas. Não há seeds, reset de volume, downgrade nem execução automática no servidor.

Alterar uma migração aplicada, removê-la ou apresentar um histórico fora da sequência provoca erro. Restaurar o arquivo original e criar uma nova versão; não alterar checksums manualmente. `.gitattributes` preserva LF dos arquivos SQL para evitar divergência de bytes entre Windows/Linux. Para futuras atualizações com dados de trabalho, faça backup antes de migrar; a política completa de backup/restauração está na etapa 20.

## Identidade, hierarquia e acesso

- IDs UUID gerados por `gen_random_uuid()`; triggers impedem trocar os IDs das entidades editáveis e mantêm `created_at`. Renomear/posicionar atualiza `updated_at`, preservando os relacionamentos.
- Nomes de 1 a 200 caracteres, sem aceitar apenas espaços. Unicidade exata, com collation `C`, sem normalizar caixa, zeros, acentos ou espaços. Empresa tem nome único global; os demais nomes são únicos no pai. Pontos e portas têm também ordinal positivo único no pai. Quantidades derivam da contagem de registros, nunca do maior número no nome.
- `company_id` participa de todas as FKs do parque. Planta referencia empresa/unidade/andar; setor e mesa compartilham a planta. A localização opcional de datacenter/rack referencia uma planta da unidade do cadastro. Um rack pode estar em outra planta da mesma unidade. Um ponto pode se conectar a um datacenter de outra unidade/andar da **mesma empresa**.
- Administrador geral: `users.is_admin`; desativação: `is_active`. Login único sem distinguir caixa. `company_permissions` tem uma linha por usuário/empresa com `manager` ou `viewer`. Não há concessão automática.
- Sessões guardam apenas hash hexadecimal SHA-256 do token, usuário, expiração e revogação. O hash de senha é texto para receber o formato seguro escolhido na etapa 03. Os contratos internos com hashes não são DTOs públicos. A autorização efetiva das requisições será implementada nas etapas 03/04; integridade de empresa por FK não concede acesso de usuário.
- Exclusão física é `RESTRICT` nas dependências; nada apaga conexões em cascata. Remover pontos/portas ocupados ou pais com filhos falha. Arquivamento e mensagens da API serão definidos nas respectivas etapas de cadastro.

## Ocupação do rack e concorrência

U 1 fica na base; `start_u` e `height_u` são inteiros positivos. O intervalo gerado `occupied_u` é `[start_u, start_u + height_u)`, usando `int8range` para evitar overflow da soma. A restrição `equipment_no_overlap`, com GiST e `btree_gist`, rejeita qualquer interseção no mesmo rack, incluindo INSERT/UPDATE simultâneos. Intervalos adjacentes são válidos.

`rack_capacity_u` em `equipment` é um testemunho interno da capacidade, não um campo editável do formulário. Uma FK `(company_id, rack_id, rack_capacity_u)` aponta para o rack e sua capacidade real. `ON UPDATE CASCADE` propaga uma mudança de capacidade; um CHECK na mesma linha exige `start_u + height_u - 1 <= rack_capacity_u`. Se um equipamento não couber, toda a redução é revertida. FK, CASCADE e CHECK também arbitram corridas entre instalação/movimentação e redução, sem depender de consulta prévia ou trigger que lê linhas de outro snapshot.

Ao criar/mover para outro rack, a futura API deve obter o testemunho do banco, por exemplo:

```sql
INSERT INTO equipment(company_id, rack_id, name, kind, equipment_type,
                      start_u, height_u, rack_capacity_u)
SELECT company_id, id, $2, $3, $4, $5, $6, capacity_u
FROM racks WHERE id = $1;
```

Uma mudança concorrente pode invalidar o valor lido: a gravação falha por FK/CHECK e deve voltar à API como conflito. Não aumentar o testemunho para contornar capacidade: a FK rejeita valores diferentes do rack real. Reduções válidas atualizam o testemunho de todos os equipamentos na mesma transação. Ao atualizar U no mesmo rack, não é necessário fornecer o testemunho.

## Portas e conexão única

`kind` distingue `generic` e `patch_panel`; `equipment_type` permanece livre. A FK da porta contém o discriminador fixo `patch_panel`, impedindo portas em equipamento genérico e mudança para genérico enquanto houver portas. Reduzir portas/pontos implica remover registros livres explicitamente; ocupados são protegidos pelas FKs.

Somente `connections` guarda o vínculo: `point_id` e `port_id` têm unicidade independente, e ambos são referenciados com `company_id`. Consultas pelos dois lados usam essa tabela e compõem o caminho com nomes atuais. Alterações incrementam a revisão automaticamente. A API transacional com estado esperado e transferência explícita pertence à etapa 08; esta entrega fornece sua proteção estrutural.

SQLSTATE relevantes para os futuros serviços: `23505` (unicidade), `23P01` (sobreposição), `23514` (CHECK), `23503` (FK), `23001` (dependência RESTRICT) e `40001`/`40P01` (serialização/deadlock). A API deverá tratar os erros e não devolver SQL bruto ao usuário.

## Verificação

`npm run test:db` usa bancos temporários exclusivos no mesmo PostgreSQL persistente. Testa instalação nova, atualização 001 → 002 com dados em todas as tabelas anteriores, igualdade de esquema, reaplicação, checksum, rollback e dois migradores simultâneos. Testa relações entre empresas, filiação, nomes, geometria, dependências, U e conexão única.

Os testes concorrentes usam duas transações e comprovam que a segunda sessão aguarda um lock real em `pg_stat_activity` antes de confirmar a primeira. Cobrem ponto, porta, sobreposição e redução contra INSERT/UPDATE, nos dois sentidos, incluindo um snapshot em REPEATABLE READ. Dados sintéticos e bancos de teste são removidos ao terminar. Não há acesso ao levantamento legado.

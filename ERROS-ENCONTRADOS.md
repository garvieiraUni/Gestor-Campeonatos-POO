# Erros encontrados

Análise de 09/11/2026. Os testes não foram executados (sem `node_modules`).

## Alta prioridade

1. **[CORRIGIDO] Atualizações perdidas com acessos simultâneos** — lock otimista com `versao` e HTTP 409 (regra R25 do README).
   - Onde: `backend/src/application/casos-de-uso/campeonatos.ts` (`CasoDeUsoDoOrganizador`) e `backend/src/infra/persistence/postgres/repositorios-postgres.ts` (`salvar`)
   - Problema: carregar → aplicar → salvar sem controle de versão; o `salvar` apaga e reinsere todos os filhos. Duas requisições ao mesmo tempo fazem a segunda apagar o que a primeira gravou (ex.: um gol some).
   - Correção: coluna `versao` com `UPDATE ... WHERE versao = $n` (lock otimista) ou `SELECT ... FOR UPDATE` na transação.

## Média prioridade

2. **Confronto direto incorreto em empate triplo**
   - Onde: `backend/src/domain/desempate/criterios.ts` (`CriterioConfrontoDireto`)
   - Problema: compara as equipes de duas em duas dentro do `sort`. Com três equipes empatadas o comparador pode não ser transitivo (A > B, B > C, C > A) e a ordem fica indefinida.
   - Correção: calcular um "mini-campeonato" só com as partidas entre as equipes empatadas.

3. **Cabeças de chave 1 e 2 se enfrentam na semifinal**
   - Onde: `backend/src/domain/formatos/mata-mata.ts` (`gerarFaseInicial`)
   - Problema: os confrontos 1×8, 2×7, 3×6, 4×5 ficam nas posições 0 a 3, e os vencedores de 0 e 1 se cruzam na fase seguinte.
   - Correção: usar a ordem padrão de chave (1-8, 4-5, 3-6, 2-7).

4. **Suspensão cumprida na partida errada**
   - Onde: `backend/src/domain/disciplina/observadores.ts` (`ControleDisciplinar`)
   - Problema: a suspensão é cumprida na próxima partida da equipe que for *finalizada*, não na próxima pela ordem das rodadas.
   - Correção: considerar a rodada/ordem da partida ao cumprir a suspensão.

5. **Suspensão cumprida em partida na qual o jogador atuou**
   - Onde: `backend/src/domain/disciplina/observadores.ts` e `Campeonato.registrarEvento`
   - Problema: se o jogador já tem lances numa partida em andamento quando outra partida gera a suspensão dele, a R11 não barra nada e essa partida ainda conta como suspensão cumprida.
   - Correção: não contar como cumprida uma partida em que o jogador teve eventos.

6. **[CORRIGIDO] Segredo JWT padrão em silêncio** — com `PERSISTENCIA=postgres` a API não sobe sem `JWT_SECRET`.
   - Onde: `backend/src/main.ts` (`lerOpcoes`)
   - Problema: sem `JWT_SECRET`, a API usa `'segredo-de-desenvolvimento'`.
   - Correção: recusar subir sem `JWT_SECRET` quando `PERSISTENCIA=postgres`.

## Baixa prioridade

7. **Segundo amarelo sem expulsão após apagar o vermelho automático**
   - Onde: `backend/src/domain/entidades/partida.ts` (`registrarEvento` / `removerEvento`)
   - Problema: apagar só o vermelho automático deixa o jogador com 2 amarelos sem expulsão; um terceiro amarelo não gera vermelho, porque a regra checa `=== 2`.
   - Correção: impedir a remoção direta do vermelho automático, ou checar `>= 2`.

8. **Segurança da API**
   - CORS aberto para qualquer origem (`app.enableCors()` em `main.ts`).
   - Login sem limite de tentativas.
   - Token salvo no `localStorage` com validade de 7 dias e sem revogação.

9. **Consultas N+1 na listagem**
   - Onde: `repositorios-postgres.ts` (`listar`)
   - Problema: carrega o agregado completo de cada campeonato (9 queries cada) só para montar o resumo.

10. **Mensagem de erro errada ao finalizar**
    - Onde: `partida.ts` (`finalizar`)
    - Problema: os pênaltis são validados antes do estado; uma partida que nem começou recebe a mensagem de pênaltis em vez de "não iniciada".

11. **Regulamento não é totalmente imutável**
    - Onde: `backend/src/domain/entidades/regulamento.ts`
    - Problema: `Object.freeze` é raso; o array `props.criteriosDesempate` ainda pode ser alterado.

12. **[CORRIGIDO] Arquivo de build versionado**
    - `*.tsbuildinfo` entrou no `.gitignore`.

13. **[CORRIGIDO] Documento dos jogadores público**
    - Encontrado durante a implementação dos papéis: a API devolvia o documento (RA/CPF) de todos os jogadores para qualquer visitante. Agora só a organização e o responsável pelo time veem (regra R26).

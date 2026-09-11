# Together — identidade visual de planejamento doméstico

Esta atualização altera somente apresentação. Regras financeiras, cálculos, persistência,
autenticação, rotas, textos funcionais e fluxos permanecem inalterados.

## Fundamentos

| Papel                 | Claro     | Escuro    | Uso                                       |
| --------------------- | --------- | --------- | ----------------------------------------- |
| Fundo                 | `#EEE9F1` | `#110C16` | base calma, com grade editorial sutil     |
| Superfície            | `#FCFAFD` | `#1A1320` | cartões, modais e navegação               |
| Superfície secundária | `#E6DEEA` | `#261B2E` | agrupamentos e campos                     |
| Estrutura             | `#4B285F` | `#B58BCB` | ciclos, navegação ativa e hierarquia      |
| Confirmação           | `#117F74` | `#56C9BC` | progresso, sucesso e ações confirmatórias |
| Planejamento          | `#C28A42` | `#D8A65E` | atenção e valores reservados              |
| Texto                 | `#241D29` | `#F4EFF6` | conteúdo principal                        |
| Texto secundário      | `#675D6C` | `#B3A6B9` | explicações e metadados                   |
| Perigo                | `#A9444D` | `#E08A90` | erros e projeções negativas               |

Os tons fortes de confirmação, planejamento e perigo são usados quando a cor precisa carregar
texto. A cor teal inicial permanece como cor gráfica; botões teal usam a variante forte para
manter contraste.

## Mapeamento do tema anterior

- `stone` passou a representar texto, bordas e superfícies neutras.
- `emerald` passou a representar confirmação, sucesso e progresso.
- `sky`, `blue`, `cyan` e `indigo` foram normalizados para a estrutura roxo-ameixa.
- `teal` permanece reservado a confirmação, sucesso e progresso.
- `amber` e `yellow` passaram a representar planejamento e atenção.
- `rose` e `pink` foram consolidados como perigo.
- raios grandes foram limitados a `16px`, com até `18px` em destaques e modais.
- sombras de cartões foram reduzidas; divisores e bordas assumem a separação estrutural.
- algarismos usam `tabular-nums` e `lining-nums` em todo o produto.

## Contraste validado

Relações principais, calculadas segundo WCAG:

| Par                                            |   Relação |
| ---------------------------------------------- | --------: |
| Texto / fundo claro                            | `13.69:1` |
| Texto secundário / superfície secundária clara |  `4.76:1` |
| Roxo-ameixa / superfície clara                 | `11.44:1` |
| Teal / branco                                  |  `4.87:1` |
| Planejamento forte / branco                    |  `6.36:1` |
| Perigo / branco                                |  `5.80:1` |
| Texto / fundo escuro                           | `17.03:1` |
| Texto secundário / fundo escuro                |  `8.34:1` |
| Roxo claro / fundo escuro                      |  `6.91:1` |

## Capturas de revisão

As capturas em `docs/screenshots/visual-refresh/` cobrem o antes e depois da tela Hoje em desktop
e mobile, as variações clara e escura e a aplicação posterior nas demais telas principais.

As capturas da tela Hoje foram produzidas com dados locais vazios e um bypass temporário de
autenticação que não faz parte do código final. Nenhuma conta ou dado do Supabase foi criado ou
alterado.

## Movimento

Interações usam apenas transições curtas de cor, borda, foco, sombra e deslocamento de um pixel.
Com `prefers-reduced-motion: reduce`, animações e rolagem suave são desativadas.

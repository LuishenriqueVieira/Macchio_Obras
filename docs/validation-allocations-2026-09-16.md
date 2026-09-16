# Divisão de medições em MA3, ALEX e Pedreiro

## Regra implementada

As três parcelas dividem o valor financeiro do período. Seus valores somam exatamente o valor da medição e seus percentuais relativos somam 100%. O avanço acumulado da etapa continua separado. Valores individuais podem ser zero; a medição deve ter valor positivo. A aplicação impede salvar distribuições incompletas, negativas, duplicadas ou superiores ao total, tanto na interface quanto no servidor.

Valores são persistidos em centavos inteiros. Para percentuais ou valores que não admitem representação exata em duas casas, os maiores restos conciliam o fechamento; a ordem MA3, ALEX e Pedreiro desempata restos iguais. A interface exibe valores efetivos, saldo, excesso e percentuais conciliados antes de salvar.

## Dados e histórico

Backup concluído antes de editar: versão publicada, pacote, 12 tabelas, 13 obras e 5 medições; nenhum documento vinculado. Restauração e vínculos verificados. A migração 0006 acrescenta somente uma coluna nullable, preservando os dados anteriores. Medições antigas permanecem sem distribuição até uma edição permitida. O histórico de edição guarda a distribuição anterior; pagamentos e cancelamentos não alteram a divisão.

## Validação

Testes de valor para percentual e percentual para valor, preenchimento do saldo, mudança do total, campos vazios, casas decimais, valores negativos, centavos mínimos e valores altos. Fechamento exato de 100% e centavos verificado. Testes de API abrangem composição inválida, parcela duplicada, repetição da requisição, alteração com auditoria, concorrência, medição paga e registros antigos. Suítes existentes de autenticação, permissões, CRUD e medições mantidas. O backup deve ser atualizado e novamente conferido imediatamente antes da publicação.

# Correção de pagamento e cálculo dinâmico

O formulário compartilhado executava o cálculo percentual mesmo no diálogo de pagamento, que não possui o campo percent. Isso podia converter NaN para BigInt e interromper a renderização. O cálculo agora só é realizado para medições com entrada válida; campos vazios ou intermediários não interrompem a página.

Valor do período e percentual acumulado são calculados nos dois sentidos, descontando os lançamentos anteriores. A edição desconsidera o próprio lançamento na base anterior. Os limites de saldo, percentual e casas decimais permanecem aplicados. Quando o valor informado não corresponde a um percentual de duas casas, o formulário informa o ajuste e exibe o valor final antes de salvar.

Validação: teste do componente reproduzindo pagamento sem percentual, mudanças nos dois campos, campos vazios, saldo máximo, edição e arredondamento. Testes de autenticação, permissões, CRUD, documentos e medições executados. TypeScript verificado. Nenhuma migração de banco ou alteração de registros de produção faz parte desta atualização.

Backup inicial: versão publicada preservada em git bundle e pacote; todas as 12 tabelas exportadas pelos conectores, incluindo medições existentes. Nenhum documento vinculado. Restauração SQLite e integridade referencial verificadas. A restauração foi corrigida para validar relações após carregar todas as tabelas, pois a exportação é alfabética.

A regra registrada em AGENTS.md passa a exigir backup antes de editar rotinas, além da conferência imediatamente anterior à publicação. Não há interceptação automática de alterações ou publicações realizadas fora desse procedimento.

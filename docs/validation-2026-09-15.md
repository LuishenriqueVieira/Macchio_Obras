# Validação da atualização — 15/09/2026

## Resultado

Interface reorganizada em acompanhamento, cadastros e administração. Indicadores e atalhos revisados; tabelas e formulários padronizados. Verificação visual do painel em computador e em largura de 390 px, incluindo formulário de obra. Dados de demonstração removidos do aplicativo; registros utilizados nos testes existem somente no ambiente local.

## Verificações concluídas

- Autenticação: senha, sessão, usuário desabilitado, revogação após alteração de senha, proteção do administrador principal e restrição de requisições.
- Permissões: consulta, edição e exclusão por módulo, incluindo recusas no servidor para usuários sem autorização.
- Cadastros: criação, consulta, alteração e exclusão; bloqueio de exclusões que deixariam vínculos inconsistentes.
- Documentos: envio, recuperação dos arquivos, alteração de metadados e exclusão autorizada.
- Medições: cálculo percentual em centavos, períodos, concorrência, revisão do último lançamento pendente, histórico anterior e proteção de medições pagas.
- TypeScript e compilação de produção concluídos sem erros.
- Backup da versão publicada: código, pacote e todas as 11 tabelas; restauração em SQLite, vínculos e hashes verificados. Não havia documentos vinculados no momento da cópia. A conferência dos dados deve ser repetida imediatamente antes da publicação.

## Regras e limites

Medições pagas e lançamentos anteriores não podem ser alterados ou excluídos por esse fluxo. A exclusão permitida de medição é um cancelamento que preserva o histórico financeiro. Cadastros com dependências exigem tratamento dos vínculos antes da exclusão.

Os testes cobrem os cenários acima; não garantem ausência de toda falha possível, indisponibilidade de serviços externos ou erro em dispositivos não testados. O procedimento de backup é obrigatório antes de cada publicação; não intercepta publicações realizadas fora desse procedimento.

# Publicações do sistema Macchio

Antes de toda publicação, por solicitação do usuário:
1. Identificar a versão publicada e preservar seu código (git bundle) e pacote em `.sites-runtime/backups/<data>/`.
2. Copiar TODAS as tabelas do banco publicado usando os conectores Sites. Paginar apenas com os offsets retornados. Não aceitar campos truncados, linhas omitidas ou tabelas ausentes. Guardar em `database.json` no formato utilizado por `scripts/verify-backup.mjs`.
3. Copiar também o conteúdo de cada documento vinculado, em `documents/<id>`. Sem documentos vinculados, registrar essa condição. Metadados não substituem os arquivos. Não publicar se o backup estiver incompleto; obter acesso autenticado ao download/exportação quando necessário. Nunca inventar credenciais ou contornar o login.
4. Executar `node scripts/verify-backup.mjs <pasta>`, verificar o git bundle e preservar `verified.json`. Fazer o backup antes de publicar, sem incluir arquivos de backup, dados de produção ou segredos no repositório/pacote público. Confirmar que os dados não mudaram desde a cópia antes da publicação; se mudaram, atualizar o backup.
5. Rodar os testes de autenticação, permissões, CRUD e medições, TypeScript e compilação. Corrigir falhas relevantes e registrar limitações concretas.
6. Publicar somente após a verificação. O backup é uma etapa obrigatória do procedimento; não existe agendamento ou gancho nativo que intercepte publicações externas ao procedimento.

Preservar a regra de senha numérica com até 8 dígitos e o acesso público com dados protegidos por login. Não reintroduzir dados ou visões demonstrativas. Exclusão de medição deve preservar o histórico financeiro; não apagar registros pagos ou quebrar vínculos sem tratamento explícito.

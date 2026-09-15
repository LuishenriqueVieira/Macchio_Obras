# Macchio — Gestão de Obras

Sistema em português para cadastro e acompanhamento de obras de engenharia.

- Obras: cliente, endereço, responsável, prazos, situação, orçamento e observações.
- Engenheiros: identificação profissional, registro, especialidade e contato.
- Equipes: líder, serviço, integrantes e obra vinculada.
- Tipos de etapas: catálogo compartilhado, nome, descrição, cadastro e edição; nove tipos iniciais disponíveis para seleção.
- Etapas por obra: nove etapas iniciais, cadastro e edição, empreiteira, valor contratado para 100% e período.
- Medições: percentual acumulado (duas casas decimais), variação por período, avanço semanal, valor financeiro salvo, pagamento e histórico.
- Documentos: importação de arquivos por obra e categoria, abertura, download e exclusão.

Os dados demonstrativos são fictícios e não são gravados no banco. Os cadastros reais são persistidos no D1; os documentos ficam no R2. A página de entrada é pública; dados e documentos exigem login com usuário e senha e as permissões do cadastro. Valor medido não equivale a valor pago. Arquivos importados são armazenados; não há extração automática de conteúdo nem interpretação de projetos CAD.

## Execução

Node.js 22.13 ou superior. Instale as dependências com `npm run install:ci`, execute a prévia com `npm run dev` e compile com `npm run build`. Os testes de autenticação usam contas fictícias em SQLite na memória e não alteram o banco publicado.

A estrutura é definida em `db/schema.ts` e as migrações ficam em `drizzle/`. Para preparar o banco local, após compilar, execute a migração pendente com Wrangler:

```
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_great_wallop.sql
```

Não repita migrações já aplicadas. A publicação aplica as migrações de produção.

## Verificação realizada

Compilação e TypeScript sem erros. Testes locais de cadastro, relacionamentos, edição pela interface, cálculo dos valores, limite de medição (incluindo requisições simultâneas), preservação do preço após medição, importação e recuperação de PDF, download, exclusão de documento, autenticação e origem de requisições. Navegação verificada em desktop e celular, além das ferramentas WebMCP de consulta e abertura da obra.
Limite de importação: 25 MB por arquivo. Projetos CAD são disponibilizados para download e abertura em software compatível.

## Identidade visual

Logo, ícone e projetos do portfólio foram obtidos no site oficial da Macchio. A interface usa preto, branco, cinza e azul quase preto (#000422), com Montserrat hospedada junto do sistema. As imagens do portfólio são renderizações arquitetônicas; não são associadas aos cadastros demonstrativos como fotos reais dessas obras. Fontes dos assets: `docs/brand-sources.md`.

## Medições percentuais

Cada lançamento guarda o percentual anterior, o novo acumulado, a base contratada, a empreiteira e o valor em centavos. O valor corresponde ao total acumulado arredondado menos os valores anteriores, garantindo que 100% feche o contrato. Períodos da mesma etapa não podem se sobrepor. O filtro usa a data final da medição; não há rateio diário. O avanço geral é ponderado pelo valor contratado das etapas.

Pagamentos têm data e histórico de alterações. Somente a última medição pendente pode ser cancelada; o registro permanece no histórico. O valor contratado fica bloqueado após o primeiro lançamento. As medições antigas são apresentadas em percentuais a partir de suas quantidades, preservando os valores financeiros anteriores.

A migração aditiva 0001 deve ser aplicada apenas uma vez no banco local. As etapas iniciais são criadas pela aplicação, de forma idempotente, ao abrir os dados e ao cadastrar obras. Informe valores e empreiteiras antes de medir.

Teste de integração das regras com SQLite em memória: `node tests/measurements.mjs`.

O catálogo de tipos é independente dos contratos. Selecionar um tipo preenche o nome da etapa; editar o catálogo não renomeia etapas existentes nem altera seus cálculos. A migração aditiva 0002 cria o catálogo e o vínculo opcional.

## Usuários e permissões

A aba Usuários e permissões oferece perfis Administrador, Engenheiro, Consulta e Personalizado. Privilégios de consulta e alteração são validados nas APIs e refletidos nos menus e botões. Pagamentos, cancelamento de medições, exclusão de documentos e administração de usuários têm permissões próprias. As permissões se aplicam a todas as obras.

O administrador cadastra nome, e-mail de contato, usuário, senha inicial, perfil e situação. Não há expiração do cadastro, da senha nem links de ativação. As contas permanecem disponíveis até serem desativadas. A interface oferece Minha senha, Sair e redefinição de senha de outros usuários pelo administrador. A senha do administrador principal só pode ser alterada por ele, mediante a senha atual.

A primeira senha do administrador já vinculado é definida pelo próprio titular, autenticado com a identidade estável anteriormente registrada. Essa confirmação de migração só funciona enquanto a senha estiver ausente. Depois disso, o acesso normal exige usuário e senha, sem ChatGPT. Usuários desconhecidos nunca se tornam administradores automaticamente. O administrador principal permanece ativo e com acesso completo.

Senhas usam scrypt (N=32768, r=8, p=3), sal aleatório de 16 bytes e comparação em tempo constante. Referências: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) e [Cloudflare node:crypto](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/). Sessões usam tokens aleatórios de 32 bytes e apenas seus hashes SHA-256 são armazenados. Cookies HttpOnly, Secure em HTTPS e SameSite=Lax são renovados por até 400 dias, conforme os limites dos navegadores. O usuário poderá precisar entrar novamente se limpar os cookies ou trocar de navegador; isso não expira sua conta.

Cada requisição valida a situação, as permissões e a versão da autenticação. Desativar, redefinir ou alterar a senha invalida as sessões anteriores. Reativar não restaura sessões antigas. Sair revoga a sessão atual. Há limitação de tentativas por usuário e IP, e bloqueio de requisições de alteração vindas de outra origem. O histórico administrativo fica em userAudit. Não há auto-cadastro público nem recuperação automática por e-mail; redefinições são administradas no sistema.

A migração aditiva 0004 cria sessões, limitação de tentativas e os campos de login, preservando obras e contas existentes. As colunas antigas de ativação ficam sem uso para preservar o histórico de migrações. Nenhuma senha ou conta é incluída em migrações.

Validação: `node tests/users.mjs`, `node tests/measurements.mjs`, TypeScript, compilação e autenticação no Worker local.

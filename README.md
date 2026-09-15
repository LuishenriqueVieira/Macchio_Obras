# Macchio — Gestão de Obras

Sistema em português para cadastro e acompanhamento de obras de engenharia.

- Obras: cliente, endereço, responsável, prazos, situação, orçamento e observações.
- Engenheiros: identificação profissional, registro, especialidade e contato.
- Equipes: líder, serviço, integrantes e obra vinculada.
- Tipos de etapas: catálogo compartilhado, nome, descrição, cadastro e edição; nove tipos iniciais disponíveis para seleção.
- Etapas por obra: nove etapas iniciais, cadastro e edição, empreiteira, valor contratado para 100% e período.
- Medições: percentual acumulado (duas casas decimais), variação por período, avanço semanal, valor financeiro salvo, pagamento e histórico.
- Documentos: importação de arquivos por obra e categoria, abertura, download e exclusão.

Os dados demonstrativos são fictícios e não são gravados no banco. Os cadastros reais são persistidos no D1; os documentos ficam no R2. O acesso ao sistema publicado é privado e utiliza a autenticação da plataforma Sites. Valor medido não equivale a valor pago. Arquivos importados são armazenados; não há extração automática de conteúdo nem interpretação de projetos CAD.

## Execução

Node.js 22.13 ou superior. Instale as dependências com `npm run install:ci`, execute a prévia com `npm run dev` e compile com `npm run build`. Em desenvolvimento, entre pelo caminho `/signin-with-chatgpt?return_to=%2F` para ativar a sessão local de teste.

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

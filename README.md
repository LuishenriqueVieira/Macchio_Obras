# Macchio — Gestão de Obras

Sistema em português para cadastro e acompanhamento de obras de engenharia.

- Obras: cliente, endereço, responsável, prazos, situação, orçamento e observações.
- Engenheiros: identificação profissional, registro, especialidade e contato.
- Equipes: líder, serviço, integrantes e obra vinculada.
- Etapas: quantidade prevista, unidade, preço unitário e período.
- Medições: quantidades executadas, saldo da etapa, valor e histórico acumulado.
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
`nLimite de importação: 25 MB por arquivo. Projetos CAD são disponibilizados para download e abertura em software compatível.

## Identidade visual

Logo, ícone e projetos do portfólio foram obtidos no site oficial da Macchio. A interface usa preto, branco, cinza e azul quase preto (#000422), com Montserrat hospedada junto do sistema. As imagens do portfólio são renderizações arquitetônicas; não são associadas aos cadastros demonstrativos como fotos reais dessas obras. Fontes dos assets: `docs/brand-sources.md`.

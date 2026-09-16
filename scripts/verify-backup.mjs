import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const dir=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Informe a pasta de backup.');
const snapshot=JSON.parse(fs.readFileSync(path.join(dir,'database.json'),'utf8'));
if(!Array.isArray(snapshot.expectedTables)||snapshot.expectedTables.length!==Object.keys(snapshot.tables).length||snapshot.expectedTables.some(t=>!Object.hasOwn(snapshot.tables,t)))throw Error('Lista de tabelas incompleta ou ausente');
const db=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const counts={};
for(const [table,pages] of Object.entries(snapshot.tables)){
 if(!Array.isArray(pages)||!pages.length)throw Error('Tabela sem página de exportação: '+table);
 let expectedOffset=0;for(const p of pages){if(p.offset!==expectedOffset||p.table_name!==table)throw Error('Sequência de páginas inválida: '+table);expectedOffset=p.model_projection.next_offset}
 if(!/^[a-zA-Z]+$/.test(table)||!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table))throw Error('Tabela desconhecida');
 counts[table]=0;
 for(const p of pages){if(p.model_projection.truncated||p.model_projection.truncated_values||p.model_projection.omitted_rows||p.model_projection.omitted_columns)throw Error('Backup incompleto: '+table);for(const row of p.rows){const keys=Object.keys(row);db.prepare(`INSERT INTO "${table}" (${keys.map(k=>'"'+k+'"').join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>row[k]));counts[table]++}}
 if(pages.at(-1).has_more||pages.at(-1).model_projection.next_offset!==null)throw Error('Paginação incompleta');
}
if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Vínculos inconsistentes no backup');
if(counts.documents){for(const row of db.prepare('SELECT * FROM documents').all()){const f=path.join(dir,'documents',row.id);if(!fs.existsSync(f)||fs.statSync(f).size!==row.size)throw Error('Arquivo não copiado: '+row.id)}}
const files=['database.json','source.bundle','published-site.tar.gz'];const hashes=Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(dir,f))).digest('hex')]));
fs.writeFileSync(path.join(dir,'verified.json'),JSON.stringify({verifiedAt:new Date().toISOString(),sourceCommit:snapshot.sourceCommit,projectId:snapshot.projectId,counts,hashes,documents:counts.documents?'copied':'none-linked',restoration:'SQLite schema + records + foreign keys verified'},null,2));db.close();console.log('Backup validado: estrutura, registros, vínculos e integridade dos arquivos.');

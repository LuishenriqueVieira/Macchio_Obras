import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));
function statement(query,args=[]){return {bind(...v){return statement(query,v)},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){return sql.prepare(query).run(...args)}}}
globalThis.testDb={prepare:statement,async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.all());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const access=url(compile('db/access.ts').replace("'cloudflare:workers'",JSON.stringify(url('export const env={DB:globalThis.testDb};'))));
const permissions=url(compile('lib/permissions.ts'));
const passwords=url(compile('db/passwords.ts').replace("'./access'",JSON.stringify(access)));
const users=url(compile('db/users.ts').replace("'./access'",JSON.stringify(access)).replace("'./passwords'",JSON.stringify(passwords)).replace("'@/lib/permissions'",JSON.stringify(permissions)));
function route(path){return import(url(compile(path).replace("'zod'",JSON.stringify(import.meta.resolve('zod'))).replace("'cloudflare:workers'",JSON.stringify(url('export const env={};'))).replace("'@/db/access'",JSON.stringify(access)).replace("'@/db/users'",JSON.stringify(users)).replace("'@/db/passwords'",JSON.stringify(passwords)).replace("'@/lib/permissions'",JSON.stringify(permissions)).replace("'@/lib/measurement'",JSON.stringify(url(compile('lib/measurement.ts'))))))}
const api=await route('app/api/users/route.ts'),auth=await route('app/api/auth/route.ts'),data=await route('app/api/data/route.ts'),docs=await route('app/api/documents/route.ts');
const {presets,expandPermissions}=await import(permissions),{tokenHash}=await import(passwords),cookies={};
const pass='Local teste forte 2026!',next='Outra senha teste 2026!';
async function req(target,method,who,body,status=200,extra={}){const headers={'Content-Type':'application/json',...extra};if(who&&cookies[who])headers.Cookie=cookies[who];const r=await target[method](new Request('https://localhost/api/'+(target===api?'users':target===auth?'auth':'data'),{method,headers,...(body?{body:JSON.stringify(body)}:{})}));const text=await r.text();assert.equal(r.status,status,text.slice(0,300));if(r.headers.has('Set-Cookie')&&who){const c=r.headers.get('Set-Cookie');assert.match(c,/HttpOnly/);assert.match(c,/Secure/);assert.match(c,/SameSite=Lax/);cookies[who]=c.split(';')[0]}try{return JSON.parse(text)}catch{return text}}
const login=(who,username,password=pass,status=200)=>req(auth,'POST',who,{action:'login',username,password},status);
assert.equal((await req(api,'GET')).user,null);await req(data,'GET',null,null,401);for(const m of ['GET','POST','DELETE'])await req(docs,m,null,m==='GET'?null:{},401);
await req(auth,'POST',null,{action:'setup-owner',username:'owner',password:pass},403,{'oai-authenticated-user-id':'stranger'});
sql.prepare('INSERT INTO appUsers(id,identityId,name,email,role,permissions,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?)').run('owner','owner-stable-id','Principal','owner@example.com','admin',JSON.stringify(presets.admin),'2000-01-01','2000-01-01');
assert.ok((await req(api,'GET',null,null,200,{'oai-authenticated-user-id':'owner-stable-id'})).setup);
await req(auth,'POST',null,{action:'setup-owner',username:'owner',password:pass},403,{'oai-authenticated-user-id':'wrong'});
await req(auth,'POST','owner',{action:'setup-owner',username:'owner',password:pass},200,{'oai-authenticated-user-id':'owner-stable-id'});
await req(auth,'POST',null,{action:'setup-owner',username:'owner',password:next},403,{'oai-authenticated-user-id':'owner-stable-id'});
await req(data,'GET',null,null,401,{'oai-authenticated-user-id':'owner-stable-id'});
assert.equal((await req(api,'GET')).needsOwnerSetup,false);
await login('owner2','OWNER');await login(null,'owner','wrong password',401);await login(null,'unknown',pass,401);
const raw=sql.prepare('SELECT * FROM appUsers WHERE id=?').get('owner');assert.match(raw.passwordHash,/^scrypt\$/);assert.ok(!raw.passwordHash.includes(pass));
const storedSession=sql.prepare('SELECT id FROM authSessions WHERE userId=?').get('owner').id;assert.ok(!cookies.owner.includes(storedSession));assert.equal(await tokenHash(cookies.owner.split('=')[1]),storedSession);
const person={name:'Leitor',email:'reader@example.com',username:'leitor',password:pass,role:'custom',active:true,permissions:['stageTypes.view']};
await req(api,'POST',null,{data:person},401);const created=await req(api,'POST','owner',{data:person},201);await req(api,'POST','owner',{data:person},409);
await req(api,'POST','owner',{data:{...person,email:'other@example.com',username:'other',password:'short'}},400);
const list=await req(api,'GET','owner');assert.equal(list.users.length,2);assert.ok(!JSON.stringify(list).includes('passwordHash'));assert.ok(!JSON.stringify(list).includes('activationHash'));assert.ok(!JSON.stringify(list).includes(pass));
await login('reader','leitor');assert.equal((await req(api,'GET','reader')).users.length,0);
await req(data,'POST','owner',{action:'initialize'});const filtered=await req(data,'GET','reader');assert.equal(filtered.stageTypes.length,9);assert.deepEqual(filtered.projects,[]);assert.deepEqual(filtered.measurements,[]);
await req(data,'POST','reader',{kind:'stageTypes',data:{name:'Ataque',description:''}},403);await req(data,'PATCH','reader',{action:'payment'},403);await req(data,'DELETE','reader',{id:'any'},403);
for(const method of ['GET','POST','DELETE'])await req(docs,method,'reader',method==='GET'?null:{},403);
await req(api,'PATCH','reader',{id:created.id,data:{...person,role:'admin'},revision:0},403);
await req(auth,'POST','owner',{action:'logout'},403,{Origin:'https://attacker.example'});await req(auth,'POST',null,{action:'login',username:'owner',password:pass},403,{'Sec-Fetch-Site':'cross-site'});
let reader=(await req(api,'GET','owner')).users.find(u=>u.id===created.id);
await req(api,'PATCH','owner',{id:reader.id,revision:reader.revision,data:{...person,active:false}});await req(data,'GET','reader',null,401);await login(null,'leitor',pass,401);
reader=(await req(api,'GET','owner')).users.find(u=>u.id===created.id);await req(api,'PATCH','owner',{id:reader.id,revision:reader.revision,data:{...person,active:true,permissions:['stageTypes.edit']}});
await req(data,'GET','reader',null,401);await login('reader','leitor');await req(data,'POST','reader',{kind:'stageTypes',data:{name:'Tipo permitido',description:''}},201);await req(api,'PATCH','owner',{id:reader.id,revision:reader.revision,data:person},409);
const owner=(await req(api,'GET','owner')).user;await req(api,'PATCH','owner',{id:'owner',revision:owner.revision,data:{...owner,active:false}},403);await req(api,'PATCH','owner',{id:'owner',revision:owner.revision,data:{...owner,role:'viewer',permissions:presets.viewer}},403);await req(api,'POST','owner',{action:'password',id:'owner',password:next},403);
await req(api,'POST','owner',{action:'password',id:reader.id,password:next});await req(data,'GET','reader',null,401);await login(null,'leitor',pass,401);await login('reader','leitor',next);
await req(auth,'POST','owner',{action:'change-password',currentPassword:'wrong',password:next},400);await req(auth,'POST','owner',{action:'change-password',currentPassword:pass,password:next});await req(data,'GET','owner2',null,401);await req(data,'GET','owner');await login(null,'owner',pass,401);await login('owner2','owner',next);
await req(auth,'POST','reader',{action:'logout'});await req(data,'GET','reader',null,401);
await req(api,'POST',null,{action:'activate',token:'legacy'},401);await req(api,'POST','owner',{action:'renew',id:reader.id},400);
// Legacy login names must also participate in the unique index.
sql.prepare('INSERT INTO appUsers(id,name,email,role,createdAt,updatedAt) VALUES(?,?,?,?,?,?)').run('legacy','Antigo','legacy@example.com','viewer','2000-01-01','2000-01-01');
await req(api,'POST','owner',{data:{...person,email:'new@example.com',username:'legacy@example.com'}},409);
// No account age or password expiry, even with very old creation timestamps.
sql.prepare('UPDATE appUsers SET createdAt=? WHERE id=?').run('1900-01-01','owner');sql.exec('DELETE FROM loginThrottle');await login('old-account','owner',next);
for(let i=0;i<10;i++)await login(null,'attempts',pass,401);await login(null,'attempts',pass,429);
assert.equal(sql.prepare('SELECT COUNT(*) count FROM userAudit').get().count,6);assert.ok(expandPermissions(['payments.edit']).includes('projects.view'));
console.log('PASS: primeira senha restrita ao titular; login sem ChatGPT; cookies e hashes; conta sem expiração; privilégios e documentos; bloqueio de sessões por desativação e senha; reativação sem reviver sessões; logout; duplicidade; CSRF; limitação de tentativas; proteção do administrador; auditoria.');sql.close();

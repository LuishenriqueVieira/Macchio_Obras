import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {database,failure,invalid} from '@/db/access';
import {identity,currentUser,requireUser,publicUser,tokenHash} from '@/db/users';
import {expandPermissions,hasPermission,privileges,presets} from '@/lib/permissions';
const schema=z.object({name:z.string().trim().min(1).max(150),email:z.string().trim().email().max(254).transform(s=>s.toLowerCase()),role:z.enum(['admin','engineer','viewer','custom']),active:z.boolean(),permissions:z.array(z.string()).max(privileges.length).refine(p=>p.every(k=>privileges.includes(k)))});
const safeHeaders={'Cache-Control':'private, no-store'};
export async function GET(request:Request){try{const who=identity(request),user=await currentUser(request);let users:any[]=[];if(hasPermission(user,'users.manage'))users=(await database().prepare('SELECT * FROM appUsers ORDER BY createdAt DESC').all()).results.map(publicUser);return Response.json({identity:who,user,users},{headers:safeHeaders})}catch(e){return failure(e)}}
export async function POST(request:Request){try{
 const who=identity(request),body:any=await request.json(),db=database(),now=new Date().toISOString();
 if(body.action==='bootstrap'){
  const secret=(env as any).OWNER_SETUP_TOKEN,email=(env as any).OWNER_SETUP_EMAIL;
  if(!secret||typeof body.token!=='string'||await tokenHash(body.token)!==await tokenHash(secret)||!email||who.email.toLowerCase()!==email.toLowerCase())return invalid('Configuração inicial não autorizada.',403);
  const result=await db.prepare(`INSERT OR IGNORE INTO appUsers(id,identityId,name,email,role,active,permissions,createdAt,updatedAt) SELECT 'owner',?,?,?,'admin',1,?,?,? WHERE NOT EXISTS(SELECT 1 FROM appUsers WHERE id='owner') RETURNING id`).bind(who.id,'Administrador principal',who.email.toLowerCase(),JSON.stringify(presets.admin),now,now).all();
  if(!result.results.length)return invalid('O administrador principal já está configurado.',409);return Response.json({ok:true});
 }
 if(body.action==='activate'){
  if(typeof body.token!=='string'||body.token.length>200)return invalid('Link de ativação inválido.');
  if(await currentUser(request))return invalid('Esta conta já está vinculada a um usuário.',409);
  const hash=await tokenHash(body.token);const r=await db.prepare('UPDATE appUsers SET identityId=?,activationHash=NULL,activationExpiresAt=NULL,updatedAt=?,revision=revision+1 WHERE activationHash=? AND identityId IS NULL AND active=1 AND activationExpiresAt>? RETURNING id').bind(who.id,now,hash,now).all();
  if(!r.results.length)return invalid('Link inválido, expirado ou já utilizado. Solicite um novo link ao administrador.',403);return Response.json({ok:true});
 }
 const admin=await requireUser(request,'users.manage');
 if(body.action==='renew'){
  if(typeof body.id!=='string')return invalid('Usuário inválido.');const token=crypto.randomUUID()+crypto.randomUUID(),hash=await tokenHash(token),expires=new Date(Date.now()+7*86400000).toISOString();
  const r=await db.prepare('UPDATE appUsers SET activationHash=?,activationExpiresAt=?,updatedAt=?,revision=revision+1 WHERE id=? AND identityId IS NULL AND active=1 RETURNING id').bind(hash,expires,now,body.id).all();if(!r.results.length)return invalid('Ative um usuário ainda não vinculado para gerar o link.');return Response.json({activationToken:token,expires},{headers:safeHeaders});
 }
 const parsed=schema.safeParse(body.data);if(!parsed.success)return invalid('Confira nome, e-mail, perfil e permissões.');const d=parsed.data,id=crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID(),hash=await tokenHash(token),expires=new Date(Date.now()+7*86400000).toISOString();
 const permissions=expandPermissions(d.role==='admin'?presets.admin:d.permissions);
 const result=await db.prepare('INSERT OR IGNORE INTO appUsers(id,name,email,role,active,permissions,activationHash,activationExpiresAt,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id').bind(id,d.name,d.email,d.role,d.active?1:0,JSON.stringify(permissions),hash,expires,now,now).all();if(!result.results.length)return invalid('Já existe um usuário com esse e-mail.',409);
 await db.prepare('INSERT INTO userAudit(id,userId,actorId,action,createdAt) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,admin.id,'Usuário cadastrado',now).run();return Response.json({id,activationToken:token,expires},{status:201,headers:safeHeaders});
}catch(e){return failure(e)}}
export async function PATCH(request:Request){try{
 const admin=await requireUser(request,'users.manage'),body:any=await request.json(),parsed=schema.safeParse(body.data);if(!parsed.success||typeof body.id!=='string'||!Number.isInteger(body.revision))return invalid('Confira os dados do usuário.');
 const d=parsed.data,db=database(),old:any=await db.prepare('SELECT * FROM appUsers WHERE id=?').bind(body.id).first();if(!old)return invalid('Usuário não encontrado.',404);
 const permissions=expandPermissions(d.role==='admin'?presets.admin:d.permissions);
 if(old.id==='owner'&&(!d.active||d.role!=='admin'))return invalid('O administrador principal deve permanecer ativo com acesso completo.');
 if(old.id===admin.id&&(!d.active||(d.role!=='admin'&&!permissions.includes('users.manage'))))return invalid('Você não pode remover o próprio acesso à administração.');
 const now=new Date().toISOString();const r=await db.batch([db.prepare('UPDATE OR IGNORE appUsers SET name=?,email=?,role=?,active=?,permissions=?,revision=revision+1,updatedAt=? WHERE id=? AND revision=? RETURNING id').bind(d.name,d.email,d.role,d.active?1:0,JSON.stringify(permissions),now,body.id,body.revision),db.prepare('INSERT INTO userAudit(id,userId,actorId,action,createdAt) SELECT ?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),old.id,admin.id,JSON.stringify({role:d.role,active:d.active,permissions}),now)]);
 if(!r[0].results.length)return invalid('O cadastro mudou ou o e-mail já está em uso. Atualize os dados.',409);return Response.json({id:body.id});
}catch(e){return failure(e)}}

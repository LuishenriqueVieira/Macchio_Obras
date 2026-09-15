import {z} from 'zod';
import {database,failure,invalid,checkOrigin} from '@/db/access';
import {currentUser,requireUser,publicUser,ownerSetup} from '@/db/users';
import {hashPassword,validPassword,normalizeUsername,validUsername,sessionCookie,sessionToken} from '@/db/passwords';
import {expandPermissions,hasPermission,privileges,presets} from '@/lib/permissions';
const schema=z.object({name:z.string().trim().min(1).max(150),email:z.string().trim().email().max(254).transform(s=>s.toLowerCase()),username:z.string().transform(normalizeUsername).refine(validUsername),role:z.enum(['admin','engineer','viewer','custom']),active:z.boolean(),permissions:z.array(z.string()).max(privileges.length).refine(p=>p.every(k=>privileges.includes(k)))});
const safeHeaders={'Cache-Control':'private, no-store'};
export async function GET(request:Request){try{
 checkOrigin(request);const user=await currentUser(request);let users:any[]=[];if(hasPermission(user,'users.manage'))users=(await database().prepare('SELECT * FROM appUsers ORDER BY createdAt DESC').all()).results.map(publicUser);
 const setup=user?null:await ownerSetup(request),pending=await database().prepare("SELECT id FROM appUsers WHERE id='owner' AND active=1 AND passwordHash IS NULL").first();
 return Response.json({user,users,setup:setup?{name:setup.name,username:setup.username}:null,needsOwnerSetup:!!pending},{headers:{...safeHeaders,...(user?{'Set-Cookie':sessionCookie(request,sessionToken(request))}:{})}});
}catch(e){return failure(e)}}
export async function POST(request:Request){try{
 const admin=await requireUser(request,'users.manage'),body:any=await request.json(),db=database(),now=new Date().toISOString();
 if(body.action==='password'){
  if(typeof body.id!=='string'||!validPassword(body.password))return invalid('Use uma senha entre 12 e 128 caracteres.');
  const old:any=await db.prepare('SELECT * FROM appUsers WHERE id=?').bind(body.id).first();if(!old)return invalid('Usuário não encontrado.',404);
  if(old.id==='owner'||old.id===admin.id)return invalid('Para sua própria conta, use Minha senha. A senha do administrador principal só pode ser alterada por ele.',403);
  const hash=await hashPassword(body.password),result=await db.batch([db.prepare('UPDATE appUsers SET passwordHash=?,authVersion=authVersion+1,activationHash=NULL,activationExpiresAt=NULL,updatedAt=?,revision=revision+1 WHERE id=? AND revision=? RETURNING id').bind(hash,now,old.id,old.revision),db.prepare('INSERT INTO userAudit(id,userId,actorId,action,createdAt) SELECT ?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),old.id,admin.id,'Senha redefinida pelo administrador',now)]);
  if(!result[0].results.length)return invalid('O cadastro mudou. Atualize os dados.',409);return Response.json({ok:true},{headers:safeHeaders});
 }
 if(body.action)return invalid('Ação inválida.');
 const parsed=schema.safeParse(body.data);if(!parsed.success)return invalid('Confira nome, e-mail, usuário, perfil e permissões.');if(!validPassword(body.data.password))return invalid('Use uma senha entre 12 e 128 caracteres.');
 const d=parsed.data,id=crypto.randomUUID(),hash=await hashPassword(body.data.password),permissions=expandPermissions(d.role==='admin'?presets.admin:d.permissions);
 const result=await db.batch([db.prepare('INSERT OR IGNORE INTO appUsers(id,username,passwordHash,name,email,role,active,permissions,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id').bind(id,d.username,hash,d.name,d.email,d.role,d.active?1:0,JSON.stringify(permissions),now,now),db.prepare('INSERT INTO userAudit(id,userId,actorId,action,createdAt) SELECT ?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),id,admin.id,'Usuário cadastrado',now)]);
 if(!result[0].results.length)return invalid('Já existe um cadastro com esse usuário ou e-mail.',409);return Response.json({id},{status:201,headers:safeHeaders});
}catch(e){return failure(e)}}
export async function PATCH(request:Request){try{
 const admin=await requireUser(request,'users.manage'),body:any=await request.json(),parsed=schema.safeParse(body.data);if(!parsed.success||typeof body.id!=='string'||!Number.isInteger(body.revision))return invalid('Confira os dados do usuário.');
 const d=parsed.data,db=database(),old:any=await db.prepare('SELECT * FROM appUsers WHERE id=?').bind(body.id).first();if(!old)return invalid('Usuário não encontrado.',404);
 const permissions=expandPermissions(d.role==='admin'?presets.admin:d.permissions);
 if(old.id==='owner'&&(admin.id!=='owner'||!d.active||d.role!=='admin'))return invalid('O administrador principal deve permanecer ativo com acesso completo e somente ele pode editar sua conta.',403);
 if(old.id===admin.id&&(!d.active||(d.role!=='admin'&&!permissions.includes('users.manage'))))return invalid('Você não pode remover o próprio acesso à administração.');
 const now=new Date().toISOString(),r=await db.batch([db.prepare('UPDATE OR IGNORE appUsers SET name=?,email=?,username=?,role=?,active=?,permissions=?,authVersion=authVersion+?,revision=revision+1,updatedAt=? WHERE id=? AND revision=? RETURNING id').bind(d.name,d.email,d.username,d.role,d.active?1:0,JSON.stringify(permissions),old.active&&!d.active?1:0,now,body.id,body.revision),db.prepare('INSERT INTO userAudit(id,userId,actorId,action,createdAt) SELECT ?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),old.id,admin.id,JSON.stringify({role:d.role,active:d.active,permissions}),now)]);
 if(!r[0].results.length)return invalid('O cadastro mudou ou o usuário/e-mail já está em uso. Atualize os dados.',409);return Response.json({id:body.id},{headers:safeHeaders});
}catch(e){return failure(e)}}

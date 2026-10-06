import {database,checkOrigin,failure,invalid} from '@/db/access';
import {ownerSetup,ownerRecovery,requireUser} from '@/db/users';
import {createSession,hashPassword,verifyPassword,validPassword,normalizeUsername,validUsername,sessionCookie,sessionToken,tokenHash,loginThrottle} from '@/db/passwords';
export async function POST(request:Request){try{
 checkOrigin(request);const raw=await request.text();if(raw.length>16384)return invalid('Solicitação muito grande.',413);const body=JSON.parse(raw),db=database(),now=new Date().toISOString();
 if(body.action==='logout'){const token=sessionToken(request);if(token)await db.prepare('DELETE FROM authSessions WHERE id=?').bind(await tokenHash(token)).run();return Response.json({ok:true},{headers:{'Set-Cookie':sessionCookie(request,''),'Cache-Control':'no-store'}})}
 if(body.action==='login'){
  const username=normalizeUsername(typeof body.username==='string'?body.username:'');if(!validUsername(username)||typeof body.password!=='string'||body.password.length>128)return invalid('Usuário ou senha inválidos.',401);
  await loginThrottle(request,username);const row:any=await db.prepare('SELECT * FROM appUsers WHERE COALESCE(username,email)=?').bind(username).first();const correct=await verifyPassword(body.password,row?.passwordHash||null);if(!row?.active||!correct)return invalid('Usuário ou senha inválidos, ou cadastro desativado.',401);
  const cookie=await createSession(request,row);return Response.json({ok:true},{headers:{'Set-Cookie':cookie,'Cache-Control':'no-store'}});
 }
 if(body.action==='setup-owner'||body.action==='change-password'||body.action==='recover-owner'){
  const setup=body.action==='setup-owner',recovery=body.action==='recover-owner',user=setup?await ownerSetup(request):recovery?await ownerRecovery(request):await requireUser(request);if(!user)return invalid(recovery?'Recuperação do administrador principal indisponível.':'Configuração inicial indisponível.',403);
  if(!validPassword(body.password))return invalid('Use uma senha somente numérica, com no máximo 8 dígitos.');const username=normalizeUsername(typeof body.username==='string'?body.username:user.username);if(!validUsername(username))return invalid('Use pelo menos 3 caracteres no usuário: letras, números, ponto, hífen ou e-mail.');
  if(!setup)await loginThrottle(request,(recovery?'owner-recovery:':'password-change:')+user.id);
  const old:any=await db.prepare('SELECT * FROM appUsers WHERE id=?').bind(user.id).first();if(!setup&&!recovery&&(typeof body.currentPassword!=='string'||body.currentPassword.length>128||!await verifyPassword(body.currentPassword,old.passwordHash)))return invalid('A senha atual não confere.',400);
  const hash=await hashPassword(body.password);const result=await db.batch([db.prepare(`UPDATE OR IGNORE appUsers SET username=?,passwordHash=?,authVersion=authVersion+1,activationHash=NULL,activationExpiresAt=NULL,updatedAt=?,revision=revision+1 WHERE id=? AND authVersion=? ${setup?'AND passwordHash IS NULL':''} RETURNING id,authVersion`).bind(username,hash,now,user.id,old.authVersion),db.prepare('INSERT INTO userAudit(id,userId,actorId,action,createdAt) SELECT ?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),user.id,user.id,recovery?'Conta master recuperada via ChatGPT':setup?'Primeira senha definida':'Senha alterada',now)]);
  if(!result[0].results.length)return invalid('Usuário já utilizado ou cadastro atualizado. Tente novamente.',409);const cookie=await createSession(request,result[0].results[0]);return Response.json({ok:true},{headers:{'Set-Cookie':cookie,'Cache-Control':'no-store'}});
 }
 return invalid('Ação inválida.');
}catch(e){return failure(e)}}

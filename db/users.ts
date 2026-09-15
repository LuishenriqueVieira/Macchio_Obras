import {database,authorize} from './access';
import {hasPermission} from '@/lib/permissions';
export function identity(request:Request){authorize(request);return {id:request.headers.get('oai-authenticated-user-id')!,email:request.headers.get('oai-authenticated-user-email')||''}}
export function publicUser(row:any){if(!row)return null;const {activationHash,...safe}=row;return {...safe,permissions:JSON.parse(row.permissions||'[]'),active:!!row.active}}
export async function currentUser(request:Request){const who=identity(request);return publicUser(await database().prepare('SELECT * FROM appUsers WHERE identityId=?').bind(who.id).first())}
export async function requireUser(request:Request,permission?:string){const user=await currentUser(request);if(!user?.active)throw Response.json({error:user?'Seu acesso está desativado. Procure o administrador.':'Seu usuário ainda não foi autorizado. Solicite um link de ativação.'},{status:403});if(permission&&!hasPermission(user,permission))throw Response.json({error:'Você não tem permissão para esta ação.'},{status:403});return user}
export async function tokenHash(token:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}

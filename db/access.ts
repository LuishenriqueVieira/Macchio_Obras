import {env} from 'cloudflare:workers';
export function database(){if(!env.DB)throw new Error('Armazenamento indisponível');return env.DB;}
export function checkOrigin(request:Request){if(request.method!=='GET'&&request.method!=='HEAD'){const site=request.headers.get('Sec-Fetch-Site');if(site==='cross-site')throw Response.json({error:'Origem não permitida.'},{status:403});const origin=request.headers.get('Origin');if(origin && origin!==new URL(request.url).origin)throw new Response('Origem não permitida.',{status:403});}}
export function failure(error:unknown){if(error instanceof Response)return error;console.error('Obras API:',error);return Response.json({error:'Não foi possível concluir. Seus dados preenchidos foram mantidos. Tente novamente.'},{status:503});}
export function invalid(message:string,status=400){return Response.json({error:message},{status});}

export const authorize=checkOrigin;

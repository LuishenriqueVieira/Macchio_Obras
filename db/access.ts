import {env} from 'cloudflare:workers';
export function database(){if(!env.DB)throw new Error('Armazenamento indisponível');return env.DB;}
export function authorize(request:Request){if(!request.headers.get('oai-authenticated-user-id'))throw new Response('Faça login para acessar.',{status:401});if(request.method!=='GET'){const origin=request.headers.get('Origin');if(origin && origin!==new URL(request.url).origin)throw new Response('Origem não permitida.',{status:403});}}
export function failure(error:unknown){if(error instanceof Response)return error;console.error('Obras API:',error);return Response.json({error:'Não foi possível concluir. Seus dados preenchidos foram mantidos. Tente novamente.'},{status:503});}
export function invalid(message:string,status=400){return Response.json({error:message},{status});}

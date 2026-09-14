import {z} from 'zod';
import {authorize,database,failure,invalid} from '@/db/access';
const str=z.string().trim().max(1000);const req=str.min(1);const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
const schemas={
 engineers:z.object({name:req,crea:req,specialty:req,email:z.union([z.string().email(),z.literal('')]),phone:str}),
 projects:z.object({name:req,client:req,address:req,engineerId:str.nullable(),start:date,end:date,budget:z.number().finite().min(0).max(1e12),status:z.enum(['Planejamento','Em andamento','Pausada','Concluída']),notes:str}).refine(d=>d.end>=d.start,{message:'A entrega deve ser igual ou posterior ao início.'}),
 teams:z.object({name:req,leader:req,trade:req,members:z.string().trim().max(10000),projectId:str.nullable()}),
 stages:z.object({projectId:req,name:req,unit:z.enum(['m²','m³','m','un','kg','h','vb']),quantity:z.number().finite().positive().max(1e10),price:z.number().finite().positive().max(1e10),start:date,end:date}).refine(d=>d.end>=d.start,{message:'Confira as datas da etapa.'}),
 measurements:z.object({stageId:req,date,quantity:z.number().finite().positive().max(1e10),notes:str})};
const kinds=Object.keys(schemas);
export async function GET(request:Request){try{authorize(request);const db=database();const lists=await db.batch([...kinds,'documents'].map(k=>db.prepare(`SELECT * FROM ${k} ORDER BY rowid DESC`)));return Response.json(Object.fromEntries([...kinds,'documents'].map((k,i)=>[k,lists[i].results])),{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e)}}
async function save(request:Request,editing:boolean){try{authorize(request);const body:any=await request.json();const kind=body.kind as keyof typeof schemas;if(!kinds.includes(kind))return invalid('Cadastro inválido.');if(editing&&kind==='measurements')return invalid('Exclua a medição incorreta e registre a correção.');const parsed=schemas[kind].safeParse(body.data);if(!parsed.success)return invalid(parsed.error.issues[0]?.message || 'Confira os campos informados.');const d:any=parsed.data;const db=database();const id=editing?z.string().uuid().parse(body.id):crypto.randomUUID();
if(editing&&!await db.prepare(`SELECT id FROM ${kind} WHERE id=?`).bind(id).first())return invalid('Cadastro não encontrado.',404);
if(d.projectId&&!await db.prepare('SELECT id FROM projects WHERE id=?').bind(d.projectId).first())return invalid('Selecione uma obra cadastrada.');
if(d.engineerId&&!await db.prepare('SELECT id FROM engineers WHERE id=?').bind(d.engineerId).first())return invalid('Selecione um engenheiro cadastrado.');
if(kind==='measurements'){const inserted=await db.prepare(`INSERT INTO measurements(id,projectId,stageId,date,quantity,unitPrice,notes) SELECT ?,s.projectId,s.id,?,?,s.price,? FROM stages s WHERE s.id=? AND ? <= s.quantity-COALESCE((SELECT SUM(quantity) FROM measurements WHERE stageId=s.id),0)+0.0000001 RETURNING id`).bind(id,d.date,d.quantity,d.notes,d.stageId,d.quantity).all();if(!inserted.results.length)return invalid('A quantidade excede o saldo da etapa ou a etapa não existe. Atualize a obra e confira o saldo.');}
else if(kind==='stages'&&editing){const r=await db.prepare(`UPDATE stages SET name=?,unit=?,quantity=?,price=?,start=?,end=? WHERE id=? AND projectId=? AND ?>=COALESCE((SELECT SUM(quantity) FROM measurements WHERE stageId=?),0) AND (NOT EXISTS(SELECT 1 FROM measurements WHERE stageId=?) OR (price=? AND unit=?)) RETURNING id`).bind(d.name,d.unit,d.quantity,d.price,d.start,d.end,id,d.projectId,d.quantity,id,id,d.price,d.unit).all();if(!r.results.length)return invalid('Após medir, preserve a unidade e o preço. A quantidade prevista não pode ficar abaixo do executado.');}
else {const keys=Object.keys(d);if(editing)await db.prepare(`UPDATE ${kind} SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=?`).bind(...keys.map(k=>d[k]),id).run();else await db.prepare(`INSERT INTO ${kind}(id,${keys.join(',')}) VALUES(?,${keys.map(()=>'?').join(',')})`).bind(id,...keys.map(k=>d[k])).run();}
return Response.json({id},{status:editing?200:201});}catch(e){return failure(e)}}
export async function POST(r:Request){return save(r,false)}
export async function PATCH(r:Request){return save(r,true)}
export async function DELETE(request:Request){try{authorize(request);const {id}=await request.json() as {id:unknown};if(typeof id!=='string')return invalid('Medição inválida.');await database().prepare('DELETE FROM measurements WHERE id=?').bind(id).run();return Response.json({ok:true});}catch(e){return failure(e)}}


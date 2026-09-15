import {z} from 'zod';
import {authorize,database,failure,invalid} from '@/db/access';
import {initialStages,normalizeMeasurements,stageLedger,contractCents,amountCents,calculateCents} from '@/lib/measurement';
const str=z.string().trim().max(1000),req=str.min(1);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
const typeKey=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const schemas={
 stageTypes:z.object({name:req,description:str.default('')}),
 engineers:z.object({name:req,crea:req,specialty:req,email:z.union([z.string().email(),z.literal('')]),phone:str}),
 projects:z.object({name:req,client:req,address:req,engineerId:str.nullable(),start:date,end:date,budget:z.number().finite().min(0).max(1e12),status:z.enum(['Planejamento','Em andamento','Pausada','Concluída']),notes:str}).refine(d=>d.end>=d.start,{message:'A entrega deve ser igual ou posterior ao início.'}),
 teams:z.object({name:req,leader:req,trade:req,members:z.string().trim().max(10000),projectId:str.nullable()}),
 stages:z.object({stageTypeId:str.nullable().optional(),projectId:req,name:req,contractValue:z.number().finite().min(0).max(1e10),contractor:str,start:date,end:date}).refine(d=>d.end>=d.start,{message:'Confira as datas da etapa.'}),
 measurements:z.object({requestId:z.string().uuid(),stageId:req,periodStart:date,date,percent:z.number().finite().positive().max(100).refine(v=>Math.abs(v*100-Math.round(v*100))<1e-7,{message:'Use até duas casas decimais no percentual.'}),previousId:str,notes:str})
};
const kinds=Object.keys(schemas);
async function initialize(db:ReturnType<typeof database>){
 await db.batch(initialStages.map((name,i)=>db.prepare('INSERT OR IGNORE INTO stageTypes(id,name,nameKey,description) VALUES(?,?,?,?)').bind('default-type-'+i,name,typeKey(name),'')));
 const defaults=(await db.prepare("SELECT * FROM stageTypes WHERE id LIKE 'default-type-%' ORDER BY rowid").all<any>()).results;
 await db.batch(defaults.map(t=>db.prepare('UPDATE stages SET stageTypeId=? WHERE stageTypeId IS NULL AND name=? COLLATE NOCASE').bind(t.id,t.name)));
 const works=await db.prepare('SELECT * FROM projects WHERE stagesInitialized=0').all<any>();
 for(const p of works.results){await db.batch([...defaults.map(t=>db.prepare(`INSERT INTO stages(id,projectId,name,stageTypeId,unit,quantity,price,start,end,contractCents,contractor) SELECT ?,id,?,?,'%',100,0,start,end,0,'' FROM projects WHERE id=? AND stagesInitialized=0 AND NOT EXISTS(SELECT 1 FROM stages WHERE projectId=? AND name=? COLLATE NOCASE)`).bind(crypto.randomUUID(),t.name,t.id,p.id,p.id,t.name)),db.prepare('UPDATE projects SET stagesInitialized=1 WHERE id=?').bind(p.id)])}
}
export async function GET(request:Request){try{authorize(request);const db=database();const lists=await db.batch([...kinds,'documents'].map(k=>db.prepare(`SELECT rowid AS sequence,* FROM ${k} ORDER BY rowid DESC`)));const data:any=Object.fromEntries([...kinds,'documents'].map((k,i)=>[k,lists[i].results]));data.measurements=normalizeMeasurements(data.stages,data.measurements);return Response.json(data,{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
async function save(request:Request,editing:boolean){try{
 authorize(request);const body:any=await request.json(),db=database();
 if(body.action==='initialize'&&!editing){await initialize(db);return Response.json({ok:true})}
 if(body.action==='payment'&&editing){
  const parsed=z.object({id:req,paid:z.boolean(),paidAt:date.nullable(),revision:z.number().int().min(0)}).safeParse(body);if(!parsed.success)return invalid('Confira os dados do pagamento.');
  const d=parsed.data;if(d.paid&&!d.paidAt)return invalid('Informe a data do pagamento.');
  const m:any=await db.prepare('SELECT * FROM measurements WHERE id=?').bind(d.id).first();if(!m||m.cancelledAt)return invalid('Medição indisponível.');
  if(d.paid&&d.paidAt!<m.date)return invalid('O pagamento não pode anteceder o encerramento da medição.');
  const history=JSON.parse(m.paymentHistory||'[]');history.push({paid:d.paid,paidAt:d.paid?d.paidAt:null,changedAt:new Date().toISOString()});
  const r=await db.prepare('UPDATE measurements SET paid=?,paidAt=?,paymentHistory=?,revision=revision+1 WHERE id=? AND revision=? AND cancelledAt IS NULL RETURNING id').bind(d.paid?1:0,d.paid?d.paidAt:null,JSON.stringify(history),d.id,d.revision).all();
  if(!r.results.length)return invalid('Este lançamento foi atualizado. Recarregue os dados.',409);return Response.json({id:d.id});
 }
 const kind=body.kind as keyof typeof schemas;if(!kinds.includes(kind))return invalid('Cadastro inválido.');if(editing&&kind==='measurements')return invalid('Os cálculos salvos não podem ser editados. Cancele o último lançamento pendente para corrigir.');
 const parsed=schemas[kind].safeParse(body.data);if(!parsed.success)return invalid(parsed.error.issues[0]?.message||'Confira os campos informados.');let d:any=parsed.data;
 const id=editing?req.parse(body.id):kind==='measurements'?d.requestId:crypto.randomUUID();
 if(editing&&!await db.prepare(`SELECT id FROM ${kind} WHERE id=?`).bind(id).first())return invalid('Cadastro não encontrado.',404);
 if(d.projectId&&!await db.prepare('SELECT id FROM projects WHERE id=?').bind(d.projectId).first())return invalid('Selecione uma obra cadastrada.');
 if(d.engineerId&&!await db.prepare('SELECT id FROM engineers WHERE id=?').bind(d.engineerId).first())return invalid('Selecione um engenheiro cadastrado.');
 if(kind==='stageTypes'){
  const key=typeKey(d.name);if(!key)return invalid('Informe o nome do tipo de etapa.');
  const result=editing?await db.prepare('UPDATE OR IGNORE stageTypes SET name=?,nameKey=?,description=? WHERE id=? RETURNING id').bind(d.name,key,d.description,id).all():await db.prepare('INSERT OR IGNORE INTO stageTypes(id,name,nameKey,description) VALUES(?,?,?,?) RETURNING id').bind(id,d.name,key,d.description).all();
  if(!result.results.length)return invalid('Já existe um tipo de etapa com esse nome.',409);
 }else if(kind==='measurements'){
  const duplicate:any=await db.prepare('SELECT * FROM measurements WHERE id=?').bind(id).first();if(duplicate){if(duplicate.stageId===d.stageId&&duplicate.endBp===Math.round(d.percent*100)&&duplicate.date===d.date&&duplicate.periodStart===d.periodStart&&duplicate.notes===d.notes)return Response.json({id});return invalid('Identificador já utilizado. Abra uma nova medição.',409)}
  const s:any=await db.prepare('SELECT * FROM stages WHERE id=?').bind(d.stageId).first();if(!s)return invalid('Selecione uma etapa cadastrada.');
  const base=contractCents(s);if(base<=0||!s.contractor.trim())return invalid('Edite a etapa e informe o valor contratado e a empreiteira antes de medir.');
  const raw=await db.prepare('SELECT rowid AS sequence,* FROM measurements WHERE stageId=?').bind(s.id).all<any>();const ledger=stageLedger(normalizeMeasurements([s],raw.results),s.id),last=ledger.at(-1),startBp=last?.endBp||0,endBp=Math.round(d.percent*100);
  if((last?.id||'')!==d.previousId)return invalid('Outra medição foi lançada. Atualize os dados antes de continuar.',409);
  if(endBp<=startBp)return invalid('O percentual acumulado deve superar o anterior e não pode passar de 100%.');
  if(d.date<d.periodStart||(last&&d.periodStart<=last.date))return invalid('O período deve começar depois da última medição e terminar na data final ou depois do início.');
  const value=calculateCents(base,endBp,ledger.reduce((t,m)=>t+amountCents(m),0));if(value<0)return invalid('O valor acumulado anterior excede o novo cálculo. Confira o contrato da etapa.');
  const r=await db.prepare(`INSERT INTO measurements(id,projectId,stageId,date,quantity,unitPrice,notes,periodStart,startBp,endBp,amountCents,contractCents,stageName,contractor,createdAt) SELECT ?,projectId,id,?,?,?,?,?,?,?,?,?,name,contractor,? FROM stages WHERE id=? AND COALESCE(contractCents,ROUND(quantity*price*100))=? AND name=? AND contractor=? AND COALESCE((SELECT id FROM measurements WHERE stageId=? AND cancelledAt IS NULL ORDER BY date DESC,rowid DESC LIMIT 1),'')=? RETURNING id`).bind(id,d.date,(endBp-startBp)/100,base/10000,d.notes,d.periodStart,startBp,endBp,value,base,new Date().toISOString(),s.id,base,s.name,s.contractor,s.id,d.previousId).all();
  if(!r.results.length)return invalid('Os dados da etapa mudaram. Atualize antes de salvar.',409);
 }else if(kind==='stages'){
  if(d.stageTypeId&&!await db.prepare('SELECT id FROM stageTypes WHERE id=?').bind(d.stageTypeId).first())return invalid('Selecione um tipo de etapa cadastrado.');
  const cents=Math.round(d.contractValue*100);if(editing){const r=await db.prepare(`UPDATE stages SET stageTypeId=COALESCE(?,stageTypeId),name=?,contractor=?,start=?,end=?,contractCents=? WHERE id=? AND projectId=? AND (NOT EXISTS(SELECT 1 FROM measurements WHERE stageId=?) OR COALESCE(contractCents,ROUND(quantity*price*100))=?) RETURNING id`).bind(d.stageTypeId||null,d.name,d.contractor,d.start,d.end,cents,id,d.projectId,id,cents).all();if(!r.results.length)return invalid('O valor contratado e a obra ficam preservados após o primeiro lançamento.');}
  else await db.prepare(`INSERT INTO stages(id,projectId,name,stageTypeId,unit,quantity,price,start,end,contractCents,contractor) VALUES(?,?,?,?,'%',100,?,?,?,?,?)`).bind(id,d.projectId,d.name,d.stageTypeId||null,cents/10000,d.start,d.end,cents,d.contractor).run();
 }else{const keys=Object.keys(d);if(editing)await db.prepare(`UPDATE ${kind} SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=?`).bind(...keys.map(k=>d[k]),id).run();else await db.prepare(`INSERT INTO ${kind}(id,${keys.join(',')}) VALUES(?,${keys.map(()=>'?').join(',')})`).bind(id,...keys.map(k=>d[k])).run();if(kind==='projects'&&!editing)await initialize(db)}
 return Response.json({id},{status:editing?200:201});
}catch(e){return failure(e)}}
export async function POST(r:Request){return save(r,false)}
export async function PATCH(r:Request){return save(r,true)}
export async function DELETE(request:Request){try{authorize(request);const {id}=await request.json() as any;if(typeof id!=='string')return invalid('Medição inválida.');const db=database();const r=await db.prepare(`UPDATE measurements SET cancelledAt=?,revision=revision+1 WHERE id=? AND paid=0 AND cancelledAt IS NULL AND id=(SELECT newer.id FROM measurements newer WHERE newer.stageId=measurements.stageId AND newer.cancelledAt IS NULL ORDER BY newer.date DESC,newer.rowid DESC LIMIT 1) RETURNING id`).bind(new Date().toISOString(),id).all();if(!r.results.length)return invalid('Somente a última medição pendente da etapa pode ser cancelada.');return Response.json({ok:true})}catch(e){return failure(e)}}

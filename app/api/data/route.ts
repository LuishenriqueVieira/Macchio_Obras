import {requireUser} from '@/db/users';
import {hasPermission} from '@/lib/permissions';
import {z} from 'zod';
import {database,failure,invalid} from '@/db/access';
import {initialStages,normalizeMeasurements,stageLedger,contractUnits,stageAllocationBases,amountUnits,endPercentUnits,resolveMeasurementInput,validateStageAllocations,readAllocations,VALUE_SCALE,PERCENT_SCALE} from '@/lib/measurement';
const str=z.string().trim().max(1000),req=str.min(1);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
const typeKey=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const decimal2=(maximum:number,label:string)=>z.number().finite().min(0).max(maximum).refine(v=>Math.abs(v*100-Math.round(v*100))<1e-6,{message:`Use até duas casas após a vírgula em ${label}.`});
const allocation=z.object({name:z.enum(['MA3','ALEX','Pedreiro']),amountUnits:z.number().int().nonnegative().max(1e14).refine(v=>v%100===0,{message:'Use até duas casas após a vírgula no valor da camada.'}).optional(),amountCents:z.number().int().nonnegative().max(1e12).optional()}).refine(v=>v.amountUnits!==undefined||v.amountCents!==undefined,{message:'Informe o valor da camada.'});
const schemas={
 stageTypes:z.object({name:req,description:str.default('')}),
 engineers:z.object({name:req,crea:req,specialty:req,email:z.union([z.string().email(),z.literal('')]),phone:str}),
 projects:z.object({name:req,client:req,address:req,engineerId:str.nullable(),start:date,end:date,budget:decimal2(1e10,'valores monetários'),status:z.enum(['Planejamento','Em andamento','Pausada','Concluída']),notes:str}).refine(d=>d.end>=d.start,{message:'A entrega deve ser igual ou posterior ao início.'}),
 teams:z.object({name:req,leader:req,trade:req,members:z.string().trim().max(10000),projectId:str.nullable()}),
 stages:z.object({stageTypeId:str.nullable().optional(),projectId:req,name:req,contractValue:decimal2(1e10,'valor da MA3'),alexValue:decimal2(1e10,'valor de ALEX').default(0),pedreiroValue:decimal2(1e10,'valor do Pedreiro').default(0),contractor:str,start:date,end:date}).refine(d=>d.end>=d.start,{message:'Confira as datas da etapa.'}).refine(d=>d.alexValue+d.pedreiroValue<=d.contractValue,{message:'A soma das bases ALEX e Pedreiro não pode superar o valor total da MA3.'}),
 measurements:z.object({requestId:z.string().uuid(),stageId:req,periodStart:date,date,percent:z.number().finite().positive().max(100).refine(v=>Math.abs(v*PERCENT_SCALE-Math.round(v*PERCENT_SCALE))<1e-6,{message:'Use até quatro casas após a vírgula no percentual.'}),measurementInput:z.enum(['percent','amount']).default('percent'),measurementValue:decimal2(1e10,'valor da medição').optional(),previousId:str,notes:str,allocations:z.array(allocation,{required_error:'Atualize a página e distribua a medição entre MA3, ALEX e Pedreiro.'}).length(3,{message:'Informe MA3, ALEX e Pedreiro.'})}).refine(d=>d.measurementInput!=='amount'||(d.measurementValue!==undefined&&d.measurementValue>0),{message:'Informe um valor positivo para a medição.',path:['measurementValue']})
};
const kinds=Object.keys(schemas);
async function initialize(db:ReturnType<typeof database>){
 await db.batch([...initialStages.map((name,i)=>db.prepare("INSERT OR IGNORE INTO stageTypes(id,name,nameKey,description) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM systemSettings WHERE id='stage-types-initialized')").bind('default-type-'+i,name,typeKey(name),'')),db.prepare("INSERT OR IGNORE INTO systemSettings(id,value) VALUES('stage-types-initialized','1')")]);
 const defaults=(await db.prepare("SELECT * FROM stageTypes WHERE id LIKE 'default-type-%' ORDER BY rowid").all<any>()).results;
 await db.batch(defaults.map(t=>db.prepare('UPDATE stages SET stageTypeId=? WHERE stageTypeId IS NULL AND name=? COLLATE NOCASE').bind(t.id,t.name)));
 const works=await db.prepare('SELECT * FROM projects WHERE stagesInitialized=0').all<any>();
 for(const p of works.results){await db.batch([...defaults.map(t=>db.prepare(`INSERT INTO stages(id,projectId,name,stageTypeId,unit,quantity,price,start,end,contractCents,contractUnits,contractor) SELECT ?,id,?,?,'%',100,0,start,end,0,0,'' FROM projects WHERE id=? AND stagesInitialized=0 AND NOT EXISTS(SELECT 1 FROM stages WHERE projectId=? AND name=? COLLATE NOCASE)`).bind(crypto.randomUUID(),t.name,t.id,p.id,p.id,t.name)),db.prepare('UPDATE projects SET stagesInitialized=1 WHERE id=?').bind(p.id)])}
}
export async function GET(request:Request){try{const user=await requireUser(request);const db=database(),all=[...kinds,'documents'],allowed=all.filter(k=>hasPermission(user,k+'.view'));const lists=allowed.length?await db.batch(allowed.map(k=>db.prepare(`SELECT rowid AS sequence,* FROM ${k} ORDER BY rowid DESC`))):[];const data:any=Object.fromEntries(all.map(k=>[k,allowed.includes(k)?lists[allowed.indexOf(k)].results:[]]));data.projects=data.projects.map((p:any)=>({...p,budget:p.budgetUnits==null?p.budget:p.budgetUnits/VALUE_SCALE}));data.measurements=normalizeMeasurements(data.stages,data.measurements);return Response.json(data,{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
async function save(request:Request,editing:boolean){try{
 const user=await requireUser(request);const body:any=await request.json(),db=database();
 if(body.action==='initialize'&&!editing){if(hasPermission(user,'projects.edit')||hasPermission(user,'stageTypes.edit'))await initialize(db);return Response.json({ok:true})}
 if(body.action==='payment'&&editing){
  await requireUser(request,'payments.edit');
  const parsed=z.object({id:req,paid:z.boolean(),paidAt:date.nullable(),revision:z.number().int().min(0)}).safeParse(body);if(!parsed.success)return invalid('Confira os dados do pagamento.');
  const d=parsed.data;if(d.paid&&!d.paidAt)return invalid('Informe a data do pagamento.');
  const m:any=await db.prepare('SELECT * FROM measurements WHERE id=?').bind(d.id).first();if(!m||m.cancelledAt)return invalid('Medição indisponível.');
  if(d.paid&&d.paidAt!<m.date)return invalid('O pagamento não pode anteceder o encerramento da medição.');
  const history=JSON.parse(m.paymentHistory||'[]');history.push({paid:d.paid,paidAt:d.paid?d.paidAt:null,changedAt:new Date().toISOString()});
  const r=await db.prepare('UPDATE measurements SET paid=?,paidAt=?,paymentHistory=?,revision=revision+1 WHERE id=? AND revision=? AND cancelledAt IS NULL RETURNING id').bind(d.paid?1:0,d.paid?d.paidAt:null,JSON.stringify(history),d.id,d.revision).all();
  if(!r.results.length)return invalid('Este lançamento foi atualizado. Recarregue os dados.',409);return Response.json({id:d.id});
 }
 const kind=body.kind as keyof typeof schemas;if(!kinds.includes(kind))return invalid('Cadastro inválido.');
 await requireUser(request,kind+'.edit');
 const parsed=schemas[kind].safeParse(body.data);if(!parsed.success)return invalid(parsed.error.issues[0]?.message||'Confira os campos informados.');const d:any=parsed.data;
 const id=editing?req.parse(body.id):kind==='measurements'?d.requestId:crypto.randomUUID();
 if(editing&&!await db.prepare(`SELECT id FROM ${kind} WHERE id=?`).bind(id).first())return invalid('Cadastro não encontrado.',404);
 if(d.projectId&&!await db.prepare('SELECT id FROM projects WHERE id=?').bind(d.projectId).first())return invalid('Selecione uma obra cadastrada.');
 if(d.engineerId&&!await db.prepare('SELECT id FROM engineers WHERE id=?').bind(d.engineerId).first())return invalid('Selecione um engenheiro cadastrado.');
 if(kind==='stageTypes'){
  const key=typeKey(d.name);if(!key)return invalid('Informe o nome do tipo de etapa.');
  const result=editing?await db.prepare('UPDATE OR IGNORE stageTypes SET name=?,nameKey=?,description=? WHERE id=? RETURNING id').bind(d.name,key,d.description,id).all():await db.prepare('INSERT OR IGNORE INTO stageTypes(id,name,nameKey,description) VALUES(?,?,?,?) RETURNING id').bind(id,d.name,key,d.description).all();
  if(!result.results.length)return invalid('Já existe um tipo de etapa com esse nome.',409);
 }else if(kind==='measurements'&&editing){
  const old:any=await db.prepare('SELECT * FROM measurements WHERE id=?').bind(id).first();
  if(!Number.isInteger(body.revision)||old.revision!==body.revision)return invalid('A medição mudou. Atualize os dados.',409);
  if(old.paid||old.cancelledAt||old.stageId!==d.stageId)return invalid('Somente a última medição pendente pode ser alterada, mantendo a etapa.');
  const stage:any=await db.prepare('SELECT * FROM stages WHERE id=?').bind(old.stageId).first(),raw=await db.prepare('SELECT rowid AS sequence,* FROM measurements WHERE stageId=?').bind(old.stageId).all<any>(),ledger=stageLedger(normalizeMeasurements([stage],raw.results),old.stageId);
  if(ledger.at(-1)?.id!==id)return invalid('Somente a última medição pendente pode ser alterada.');
  const prior=ledger.slice(0,-1),last=prior.at(-1),startP4=last?endPercentUnits(last):0,base=old.contractUnits??contractUnits(stage),resolved=resolveMeasurementInput('measurements',d.measurementInput,base,d.percent,d.measurementValue,prior.reduce((sum,m)=>sum+amountUnits(m),0)),endP4=resolved?.endP4??0;
  if(!resolved||endP4<=startP4||d.date<d.periodStart||(last&&d.periodStart<=last.date))return invalid('Confira o valor, o percentual e o período: a medição deve superar a anterior.');
  const amount=resolved.amountUnits;
  const allocation=validateStageAllocations(d.allocations,stageAllocationBases(stage),prior);if(!allocation)return invalid('Confira os valores de MA3, ALEX e Pedreiro em relação às bases cadastradas.');
  const history=JSON.parse(old.editHistory||'[]');history.push({changedAt:new Date().toISOString(),actorId:user.id,previous:{periodStart:old.periodStart,date:old.date,startBp:old.startBp,endBp:old.endBp,startP4:old.startP4,endP4:old.endP4,amountCents:old.amountCents,amountUnits:old.amountUnits,contractUnits:old.contractUnits,allocations:old.allocations,notes:old.notes}});
  const result=await db.prepare('UPDATE measurements SET periodStart=?,date=?,startBp=?,endBp=?,startP4=?,endP4=?,amountCents=?,amountUnits=?,contractUnits=?,quantity=?,unitPrice=?,notes=?,editHistory=?,allocations=?,revision=revision+1 WHERE id=? AND revision=? AND paid=0 AND cancelledAt IS NULL AND id=(SELECT newer.id FROM measurements newer WHERE newer.stageId=measurements.stageId AND newer.cancelledAt IS NULL ORDER BY newer.date DESC,newer.rowid DESC LIMIT 1) RETURNING id').bind(d.periodStart,d.date,Math.round(startP4/100),Math.round(endP4/100),startP4,endP4,Math.round(amount/100),amount,base,(endP4-startP4)/PERCENT_SCALE,base/(VALUE_SCALE*100),d.notes,JSON.stringify(history),JSON.stringify(allocation),id,body.revision).all();
  if(!result.results.length)return invalid('A medição mudou. Atualize os dados.',409);
 }else if(kind==='measurements'){
  const duplicate:any=await db.prepare('SELECT * FROM measurements WHERE id=?').bind(id).first();if(duplicate&&duplicate.stageId!==d.stageId)return invalid('Identificador já utilizado. Abra uma nova medição.',409);
  const s:any=await db.prepare('SELECT * FROM stages WHERE id=?').bind(d.stageId).first();if(!s)return invalid('Selecione uma etapa cadastrada.');
  const base=contractUnits(s);if(base<=0||!s.contractor.trim())return invalid('Edite a etapa e informe o valor contratado e a empreiteira antes de medir.');
  const raw=await db.prepare('SELECT rowid AS sequence,* FROM measurements WHERE stageId=? AND id<>?').bind(s.id,id).all<any>();const ledger=stageLedger(normalizeMeasurements([s],raw.results),s.id),last=ledger.at(-1),startP4=last?endPercentUnits(last):0,resolved=resolveMeasurementInput('measurements',d.measurementInput,base,d.percent,d.measurementValue,ledger.reduce((t,m)=>t+amountUnits(m),0)),endP4=resolved?.endP4??0;
  if(!resolved)return invalid('Informe um valor ou percentual válido dentro do saldo disponível da etapa.');
  const value=resolved.amountUnits;let allocation=duplicate?validateStageAllocations(d.allocations,stageAllocationBases(s),ledger):null;
  if(duplicate){if(allocation&&endPercentUnits(duplicate)===endP4&&amountUnits(duplicate)===value&&duplicate.date===d.date&&duplicate.periodStart===d.periodStart&&duplicate.notes===d.notes&&JSON.stringify(readAllocations(duplicate.allocations,value))===JSON.stringify(allocation))return Response.json({id});return invalid('Identificador já utilizado. Abra uma nova medição.',409)}
  if((last?.id||'')!==d.previousId)return invalid('Outra medição foi lançada. Atualize os dados antes de continuar.',409);
  if(endP4<=startP4)return invalid('O percentual acumulado deve superar o anterior e não pode passar de 100%.');
  if(d.date<d.periodStart||(last&&d.periodStart<=last.date))return invalid('O período deve começar depois da última medição e terminar na data final ou depois do início.');
  allocation=validateStageAllocations(d.allocations,stageAllocationBases(s),ledger);if(!allocation)return invalid('Confira os valores de MA3, ALEX e Pedreiro em relação às bases cadastradas.');
  const r=await db.prepare(`INSERT INTO measurements(id,projectId,stageId,date,quantity,unitPrice,notes,periodStart,startBp,endBp,startP4,endP4,amountCents,contractCents,amountUnits,contractUnits,stageName,contractor,createdAt,allocations) SELECT ?,projectId,id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, name,contractor, ?, ? FROM stages WHERE id=? AND COALESCE(contractUnits,COALESCE(contractCents,ROUND(quantity*price*100))*100)=? AND name=? AND contractor=? AND COALESCE((SELECT id FROM measurements WHERE stageId=? AND cancelledAt IS NULL ORDER BY date DESC,rowid DESC LIMIT 1),'')=? RETURNING id`).bind(id,d.date,(endP4-startP4)/PERCENT_SCALE,base/(VALUE_SCALE*100),d.notes,d.periodStart,Math.round(startP4/100),Math.round(endP4/100),startP4,endP4,Math.round(value/100),Math.round(base/100),value,base,new Date().toISOString(),JSON.stringify(allocation),s.id,base,s.name,s.contractor,s.id,d.previousId).all();
  if(!r.results.length)return invalid('Os dados da etapa mudaram. Atualize antes de salvar.',409);
 }else if(kind==='stages'){
  if(d.stageTypeId&&!await db.prepare('SELECT id FROM stageTypes WHERE id=?').bind(d.stageTypeId).first())return invalid('Selecione um tipo de etapa cadastrado.');
  const units=Math.round(d.contractValue*VALUE_SCALE),alexUnits=Math.round(d.alexValue*VALUE_SCALE),pedreiroUnits=Math.round(d.pedreiroValue*VALUE_SCALE),cents=Math.round(units/100);if(editing){const r=await db.prepare(`UPDATE stages SET stageTypeId=COALESCE(?,stageTypeId),name=?,contractor=?,start=?,end=?,contractCents=?,contractUnits=?,alexUnits=?,pedreiroUnits=? WHERE id=? AND projectId=? AND (NOT EXISTS(SELECT 1 FROM measurements WHERE stageId=?) OR COALESCE(contractUnits,COALESCE(contractCents,ROUND(quantity*price*100))*100)=?) RETURNING id`).bind(d.stageTypeId||null,d.name,d.contractor,d.start,d.end,cents,units,alexUnits,pedreiroUnits,id,d.projectId,id,units).all();if(!r.results.length)return invalid('O valor total da MA3 e a obra ficam preservados após o primeiro lançamento.');}
  else await db.prepare(`INSERT INTO stages(id,projectId,name,stageTypeId,unit,quantity,price,start,end,contractCents,contractUnits,alexUnits,pedreiroUnits,contractor) VALUES(?,?,?,?,'%',100,?,?,?,?,?,?,?,?)`).bind(id,d.projectId,d.name,d.stageTypeId||null,units/(VALUE_SCALE*100),d.start,d.end,cents,units,alexUnits,pedreiroUnits,d.contractor).run();
 }else{if(kind==='projects')d.budgetUnits=Math.round(d.budget*VALUE_SCALE);const keys=Object.keys(d);if(editing)await db.prepare(`UPDATE ${kind} SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=?`).bind(...keys.map(k=>d[k]),id).run();else await db.prepare(`INSERT INTO ${kind}(id,${keys.join(',')}) VALUES(?,${keys.map(()=>'?').join(',')})`).bind(id,...keys.map(k=>d[k])).run();if(kind==='projects'&&!editing)await initialize(db)}
 return Response.json({id},{status:editing?200:201});
}catch(e){return failure(e)}}
export async function POST(r:Request){return save(r,false)}
export async function PATCH(r:Request){return save(r,true)}
export async function DELETE(request:Request){try{
 const body:any=await request.json(),kind=body.kind||'measurements',id=body.id;if(typeof id!=='string'||!kinds.includes(kind))return invalid('Cadastro inválido.');
 await requireUser(request,kind==='measurements'?'measurements.cancel':kind+'.delete');const db=database();
 if(kind==='measurements'){const r=await db.prepare(`UPDATE measurements SET cancelledAt=?,revision=revision+1 WHERE id=? AND paid=0 AND cancelledAt IS NULL AND id=(SELECT newer.id FROM measurements newer WHERE newer.stageId=measurements.stageId AND newer.cancelledAt IS NULL ORDER BY newer.date DESC,newer.rowid DESC LIMIT 1) RETURNING id`).bind(new Date().toISOString(),id).all();if(!r.results.length)return invalid('Somente a última medição pendente da etapa pode ser excluída.');return Response.json({ok:true})}
 const blockers:Record<string,string>={projects:'EXISTS(SELECT 1 FROM stages WHERE projectId=?) OR EXISTS(SELECT 1 FROM teams WHERE projectId=?) OR EXISTS(SELECT 1 FROM documents WHERE projectId=?)',engineers:'EXISTS(SELECT 1 FROM projects WHERE engineerId=?)',stages:'EXISTS(SELECT 1 FROM measurements WHERE stageId=?)',stageTypes:'EXISTS(SELECT 1 FROM stages WHERE stageTypeId=?)',teams:'0'};
 const predicate=blockers[kind];if(!predicate)return invalid('Cadastro inválido.');
 if(kind==='stageTypes')await db.prepare("INSERT OR IGNORE INTO systemSettings(id,value) SELECT 'stage-types-initialized','1' WHERE EXISTS(SELECT 1 FROM stageTypes WHERE id=?)").bind(id).run();
 const r=await db.prepare(`DELETE FROM ${kind} WHERE id=? AND NOT (${predicate}) RETURNING id`).bind(id,...Array((predicate.match(/\?/g)||[]).length).fill(id)).all();
 if(!r.results.length){if(!await db.prepare(`SELECT id FROM ${kind} WHERE id=?`).bind(id).first())return invalid('Cadastro não encontrado.',404);return invalid('Existem registros vinculados. Remova ou desvincule esses registros antes de excluir. Etapas com histórico de medição são preservadas.',409)}
 return Response.json({ok:true});
}catch(e){return failure(e)}}

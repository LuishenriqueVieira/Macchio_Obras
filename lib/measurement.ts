import type {Row} from './obras';
export const initialStages=['FUNDAÇÃO','TIJOLAMENTO','PILAR','LAJE CONCRETADA','TELHADO','REBOCO','PISO','CONTRA PISO','CORTE PAREDE'];
export const contractCents=(s:Row)=>s.contractCents??Math.round(s.quantity*s.price*100);
export const amountCents=(m:Row)=>m.amountCents??Math.round(m.quantity*m.unitPrice*100);
export function normalizeMeasurements(stages:Row[],rows:Row[]){
 const balances=new Map<string,number>();
 return [...rows].sort((a,b)=>a.date.localeCompare(b.date)||(a.sequence||0)-(b.sequence||0)).map(m=>{
  const s=stages.find(s=>s.id===m.stageId);const previous=balances.get(m.stageId)||0;
  const end=m.endBp??Math.min(10000,previous+Math.round(m.quantity/(s?.quantity||1)*10000));
  const result={...m,startBp:m.startBp??previous,endBp:end,amountCents:amountCents(m),contractCents:m.contractCents??(s?contractCents(s):0),stageName:m.stageName||s?.name||'Etapa',contractor:m.contractor||s?.contractor||'Não informado',periodStart:m.periodStart||m.date};
  if(!m.cancelledAt)balances.set(m.stageId,end);
  return result;
 });
}
export function stageLedger(rows:Row[],id:string){return rows.filter(m=>m.stageId===id&&!m.cancelledAt).sort((a,b)=>a.date.localeCompare(b.date)||(a.sequence||0)-(b.sequence||0))}
export function calculateCents(contract:number,endBp:number,already:number){return Number((BigInt(Math.round(contract))*BigInt(Math.round(endBp))+BigInt(5000))/BigInt(10000))-already}
export function weekRange(day:string){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const start=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+6);return {start,end:d.toISOString().slice(0,10)}}

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
// Draft fields can be empty while typing; payment dialogs have no percentage.
export function previewMeasurement(kind:string|undefined,contract:number,percent:unknown,already:number):number|null{
 if(kind!=='measurements'||percent===''||percent==null)return null;
 const p=Number(percent);
 if(!Number.isSafeInteger(contract)||contract<=0||!Number.isSafeInteger(already)||already<0||!Number.isFinite(p)||p<0||p>100)return null;
 return calculateCents(contract,Math.round(p*100),already);
}
export function percentFromAmount(contract:number,amount:unknown,already:number):number|null{
 if(amount===''||amount==null||!Number.isSafeInteger(contract)||contract<=0||!Number.isSafeInteger(already)||already<0)return null;
 const value=Number(amount),cents=Math.round(value*100);
 if(!Number.isFinite(value)||value<=0||!Number.isSafeInteger(cents)||cents+already>contract)return null;
 return Number((BigInt(cents+already)*BigInt(10000)+BigInt(Math.floor(contract/2)))/BigInt(contract))/100;
}

export const allocationNames=['MA3','ALEX','Pedreiro'] as const;
export type Allocation={name:typeof allocationNames[number];amountCents:number;percentBp:number};
export type AllocationDraft={mode:'amount'|'percent';input:string};
// Largest remainders close integer cents/percentage points without losing fractions.
function apportion(total:number,weights:number[],denominator:number){
 const products=weights.map(w=>BigInt(total)*BigInt(w)),base=products.map(p=>Number(p/BigInt(denominator)));
 let remainder=total-base.reduce((a,b)=>a+b,0);
 const order=products.map((p,i)=>({i,r:p%BigInt(denominator)})).sort((a,b)=>a.r===b.r?a.i-b.i:a.r>b.r?-1:1);
 for(const {i} of order){if(remainder--<=0)break;base[i]++}return base;
}
export function validateAllocations(raw:unknown,total:number):Allocation[]|null{
 if(!Number.isSafeInteger(total)||total<=0||!Array.isArray(raw)||raw.length!==3)return null;
 const amounts=allocationNames.map(name=>{const matches=raw.filter(r=>r&&r.name===name);return matches.length===1?matches[0].amountCents:NaN});
 if(amounts.some(v=>!Number.isSafeInteger(v)||v<0||v>total)||amounts.reduce((a,b)=>a+b,0)!==total)return null;
 const percentages=apportion(10000,amounts,total);
 return allocationNames.map((name,i)=>({name,amountCents:amounts[i],percentBp:percentages[i]}));
}
export function readAllocations(raw:unknown,total:number):Allocation[]|null{
 try{return validateAllocations(typeof raw==='string'?JSON.parse(raw):raw,total)}catch{return null}
}
export function allocationDrafts(raw:unknown,total:number):AllocationDraft[]{
 const rows=readAllocations(raw,total);return allocationNames.map((_,i)=>({mode:'amount',input:rows?(rows[i].amountCents/100).toFixed(2):'0.00'}));
}
export function resolveAllocationDrafts(total:number,drafts:AllocationDraft[]=[]){
 const inputs=allocationNames.map((_,i)=>drafts[i]||{mode:'amount',input:''});
 const scaled=inputs.map(d=>{const n=Number(d.input);return d.input.trim()!==''&&Number.isFinite(n)&&n>=0&&Math.abs(n*100-Math.round(n*100))<1e-6&&n<=(d.mode==='percent'?100:1e10)?Math.round(n*100):null});
 const usable=Number.isSafeInteger(total)&&total>0;
 let amounts=scaled.map((n,i)=>n===null?null:inputs[i].mode==='amount'?n:usable?calculateCents(total,n,0):0);
 if(usable&&inputs.every(d=>d.mode==='percent')&&scaled.every(n=>n!==null)&&scaled.reduce<number>((s,n)=>s+(n||0),0)===10000)amounts=apportion(total,scaled as number[],10000);
 const sum=amounts.reduce<number>((s,n)=>s+(n||0),0);
 const valid=usable&&scaled.every(n=>n!==null)?validateAllocations(allocationNames.map((name,i)=>({name,amountCents:amounts[i]})),total):null;
 const rows=allocationNames.map((name,i)=>({name,amountCents:amounts[i],percentBp:valid?valid[i].percentBp:usable?Math.round((amounts[i]||0)/total*10000):0}));
 return {rows,sum,remaining:usable?total-sum:0,valid};
}
export function weekRange(day:string){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const start=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+6);return {start,end:d.toISOString().slice(0,10)}}

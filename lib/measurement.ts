import type {Row} from './obras';
export const initialStages=['FUNDAÇÃO','TIJOLAMENTO','PILAR','LAJE CONCRETADA','TELHADO','REBOCO','PISO','CONTRA PISO','CORTE PAREDE'];
export const VALUE_SCALE=10000;
export const CENT_UNITS=100;
export const PERCENT_SCALE=10000;
export const PERCENT_TOTAL=100*PERCENT_SCALE;
export const contractCents=(s:Row)=>s.contractCents??Math.round(s.quantity*s.price*100);
export const amountCents=(m:Row)=>m.amountCents??Math.round(m.quantity*m.unitPrice*100);
export const contractUnits=(s:Row)=>s.contractUnits??contractCents(s)*100;
export const alexContractUnits=(s:Row)=>s.alexUnits??0;
export const pedreiroContractUnits=(s:Row)=>s.pedreiroUnits??0;
export const amountUnits=(m:Row)=>m.amountUnits??amountCents(m)*100;
export const startPercentUnits=(m:Row)=>m.startP4??Math.round((m.startBp??0)*100);
export const endPercentUnits=(m:Row)=>m.endP4??Math.round((m.endBp??0)*100);
export function normalizeMeasurements(stages:Row[],rows:Row[]){
 const balances=new Map<string,number>();
 return [...rows].sort((a,b)=>a.date.localeCompare(b.date)||(a.sequence||0)-(b.sequence||0)).map(m=>{
  const s=stages.find(s=>s.id===m.stageId);const previous=balances.get(m.stageId)||0;
  const end=m.endP4??(m.endBp==null?Math.min(PERCENT_TOTAL,previous+Math.round(m.quantity/(s?.quantity||1)*PERCENT_TOTAL)):Math.round(m.endBp*100));
  const start=m.startP4??(m.startBp==null?previous:Math.round(m.startBp*100));
  const result={...m,startP4:start,endP4:end,amountUnits:amountUnits(m),contractUnits:m.contractUnits??(m.contractCents==null?(s?contractUnits(s):0):m.contractCents*100),stageName:m.stageName||s?.name||'Etapa',contractor:m.contractor||s?.contractor||'Não informado',periodStart:m.periodStart||m.date};
  if(!m.cancelledAt)balances.set(m.stageId,end);
  return result;
 });
}
export function stageLedger(rows:Row[],id:string){return rows.filter(m=>m.stageId===id&&!m.cancelledAt).sort((a,b)=>a.date.localeCompare(b.date)||(a.sequence||0)-(b.sequence||0))}
export function canEditMeasurement(rows:Row[],row:Row){
 if(row.paid||row.cancelledAt)return false;
 const ledger=stageLedger(rows,row.stageId),position=ledger.findIndex(m=>m.id===row.id);
 if(position<0)return false;
 const next=ledger[position+1];
 return !next?.paid;
}
export function calculateCents(contract:number,endBp:number,already:number){return Number((BigInt(Math.round(contract))*BigInt(Math.round(endBp))+BigInt(5000))/BigInt(10000))-already}
export function calculateUnits(contract:number,endP4:number,already:number){return Number((BigInt(Math.round(contract))*BigInt(Math.round(endP4))+BigInt(PERCENT_TOTAL/2))/BigInt(PERCENT_TOTAL))-already}
export function cumulativeMoneyUnits(contract:number,endP4:number){const cents=Math.round(contract/CENT_UNITS);return Number((BigInt(cents)*BigInt(Math.round(endP4))+BigInt(PERCENT_TOTAL/2))/BigInt(PERCENT_TOTAL))*CENT_UNITS}
export function calculateMoneyUnits(contract:number,endP4:number,already:number){return Math.round((cumulativeMoneyUnits(contract,endP4)-already)/CENT_UNITS)*CENT_UNITS}
// Draft fields can be empty while typing; payment dialogs have no percentage.
export function previewMeasurement(kind:string|undefined,contract:number,percent:unknown,already:number):number|null{
 if(kind!=='measurements'||percent===''||percent==null)return null;
 const p=Number(percent);
 if(!Number.isSafeInteger(contract)||contract<=0||!Number.isSafeInteger(already)||already<0||!Number.isFinite(p)||p<0||p>100)return null;
 if(Math.abs(p*PERCENT_SCALE-Math.round(p*PERCENT_SCALE))>1e-6)return null;
 return calculateMoneyUnits(contract,Math.round(p*PERCENT_SCALE),already);
}
export function amountInputUnits(contract:number,amount:unknown,already:number):number|null{
 if(amount===''||amount==null||!Number.isSafeInteger(contract)||contract<=0||!Number.isSafeInteger(already)||already<0)return null;
 const value=Number(amount),cents=Math.round(value*100),units=cents*CENT_UNITS;
 if(!Number.isFinite(value)||value<=0||Math.abs(value*100-cents)>1e-6||!Number.isSafeInteger(units)||units+already>contract)return null;
 return units;
}
export function percentFromAmount(contract:number,amount:unknown,already:number):number|null{
 const units=amountInputUnits(contract,amount,already);if(units===null)return null;
 return Number((BigInt(units+already)*BigInt(PERCENT_TOTAL)+BigInt(Math.floor(contract/2)))/BigInt(contract))/PERCENT_SCALE;
}
export function resolveMeasurementInput(kind:string|undefined,mode:unknown,contract:number,percent:unknown,amount:unknown,already:number):{amountUnits:number;endP4:number}|null{
 if(kind!=='measurements')return null;
 if(mode==='amount'){
  const units=amountInputUnits(contract,amount,already),derived=percentFromAmount(contract,amount,already);
  if(units===null||derived===null)return null;
  const endP4=Math.round(derived*PERCENT_SCALE);
  if(endP4<=0||endP4>PERCENT_TOTAL)return null;
  return {amountUnits:units,endP4};
 }
 const units=previewMeasurement(kind,contract,percent,already),p=Number(percent);
 if(units===null||units<=0||!Number.isFinite(p))return null;
 return {amountUnits:units,endP4:Math.round(p*PERCENT_SCALE)};
}

export const allocationNames=['MA3','ALEX','Pedreiro'] as const;
export type Allocation={name:typeof allocationNames[number];amountUnits:number;percentP4:number;baseUnits?:number};
export type AllocationDraft={mode:'amount'|'percent';input:string};
export const stageAllocationBases=(stage:Row|undefined)=>stage?[contractUnits(stage),alexContractUnits(stage),pedreiroContractUnits(stage)]:[0,0,0];
// Largest remainders close the four-decimal value and percentage units exactly.
function apportion(total:number,weights:number[],denominator:number){
 const products=weights.map(w=>BigInt(total)*BigInt(w)),base=products.map(p=>Number(p/BigInt(denominator)));
 let remainder=total-base.reduce((a,b)=>a+b,0);
 const order=products.map((p,i)=>({i,r:p%BigInt(denominator)})).sort((a,b)=>a.r===b.r?a.i-b.i:a.r>b.r?-1:1);
 for(const {i} of order){if(remainder--<=0)break;base[i]++}return base;
}
export function validateAllocations(raw:unknown,total:number):Allocation[]|null{
 if(!Number.isSafeInteger(total)||total<=0||!Array.isArray(raw)||raw.length!==3)return null;
 const amounts=allocationNames.map(name=>{const matches=raw.filter((r:any)=>r&&r.name===name);if(matches.length!==1)return NaN;const row:any=matches[0];return row.amountUnits??(Number.isSafeInteger(row.amountCents)?row.amountCents*100:NaN)});
 if(amounts.some(v=>!Number.isSafeInteger(v)||v<0||v>total)||amounts.reduce((a,b)=>a+b,0)!==total)return null;
 const percentages=apportion(PERCENT_TOTAL,amounts,total);
 return allocationNames.map((name,i)=>({name,amountUnits:amounts[i],percentP4:percentages[i]}));
}
export function readAllocations(raw:unknown,total:number):Allocation[]|null{
 try{
  const parsed=typeof raw==='string'?JSON.parse(raw):raw;
  if(Array.isArray(parsed)&&parsed.length===3&&parsed.every(row=>row&&Number.isSafeInteger(row.baseUnits)&&row.baseUnits>=0)){
   const rows=allocationNames.map(name=>parsed.find(row=>row.name===name));
   if(rows.some(row=>!row||!Number.isSafeInteger(row.amountUnits)||row.amountUnits<0||row.amountUnits%CENT_UNITS!==0||row.amountUnits>row.baseUnits))return null;
   return rows.map(row=>({...row,percentP4:row.baseUnits?Math.round(row.amountUnits/row.baseUnits*PERCENT_TOTAL):0}));
  }
  return validateAllocations(parsed,total);
 }catch{return null}
}
export function payableUnits(measurement:Row){const rows=readAllocations(measurement.allocations,amountUnits(measurement));return rows?.every(row=>row.baseUnits!==undefined)?rows.reduce((sum,row)=>sum+row.amountUnits,0):amountUnits(measurement)}
export function allocationDrafts(raw:unknown,total:number):AllocationDraft[]{
 const rows=readAllocations(raw,total);return allocationNames.map((_,i)=>({mode:'amount',input:rows?(rows[i].amountUnits/VALUE_SCALE).toFixed(2):'0.00'}));
}
export function resolveAllocationDrafts(total:number,drafts:AllocationDraft[]=[]){
 const inputs=allocationNames.map((_,i)=>drafts[i]||{mode:'amount',input:''});
 const scaled=inputs.map(d=>{const n=Number(d.input),scale=d.mode==='percent'?PERCENT_SCALE:100,raw=Math.round(n*scale);return d.input.trim()!==''&&Number.isFinite(n)&&n>=0&&Math.abs(n*scale-raw)<1e-6&&n<=(d.mode==='percent'?100:1e10)?(d.mode==='percent'?raw:raw*CENT_UNITS):null});
 const usable=Number.isSafeInteger(total)&&total>0&&total%CENT_UNITS===0;
 let amounts=scaled.map((n,i)=>n===null?null:inputs[i].mode==='amount'?n:usable?calculateMoneyUnits(total,n,0):0);
 if(usable&&inputs.every(d=>d.mode==='percent')&&scaled.every(n=>n!==null)&&scaled.reduce<number>((s,n)=>s+(n||0),0)===PERCENT_TOTAL)amounts=apportion(total/CENT_UNITS,scaled as number[],PERCENT_TOTAL).map(v=>v*CENT_UNITS);
 const sum=amounts.reduce<number>((s,n)=>s+(n||0),0);
 const valid=usable&&scaled.every(n=>n!==null)?validateAllocations(allocationNames.map((name,i)=>({name,amountUnits:amounts[i]})),total):null;
 const rows=allocationNames.map((name,i)=>({name,amountUnits:amounts[i],percentP4:valid?valid[i].percentP4:usable?Math.round((amounts[i]||0)/total*PERCENT_TOTAL):0}));
 return {rows,sum,remaining:usable?total-sum:0,valid};
}
export function resolveStageAllocationDrafts(bases:number[],drafts:AllocationDraft[]=[]){
 const inputs=allocationNames.map((_,i)=>drafts[i]||{mode:'amount',input:''});
 const rows=allocationNames.map((name,i)=>{const baseUnits=bases[i]||0,draft=inputs[i],value=Number(draft.input),scale=draft.mode==='percent'?PERCENT_SCALE:100,scaled=Math.round(value*scale),validInput=draft.input.trim()!==''&&Number.isFinite(value)&&value>=0&&Math.abs(value*scale-scaled)<1e-6&&value<=(draft.mode==='percent'?100:1e10);if(!validInput||!Number.isSafeInteger(baseUnits)||baseUnits<0)return {name,baseUnits,amountUnits:null,percentP4:0};const amount=draft.mode==='percent'?calculateMoneyUnits(baseUnits,scaled,0):scaled*CENT_UNITS,percentP4=draft.mode==='percent'?scaled:baseUnits?Math.round(amount/baseUnits*PERCENT_TOTAL):0;return {name,baseUnits,amountUnits:amount<=baseUnits?amount:null,percentP4}});
 const valid=rows.every(row=>row.amountUnits!==null)?rows.map(row=>({...row,amountUnits:row.amountUnits as number})):null;
 return {rows,sum:rows.reduce((sum,row)=>sum+(row.amountUnits||0),0),valid};
}
export function validateStageAllocations(raw:unknown,bases:number[],prior:Row[]=[]):Allocation[]|null{
 if(!Array.isArray(raw)||raw.length!==3||bases.length!==3||bases.some(base=>!Number.isSafeInteger(base)||base<0))return null;
 const previous=allocationNames.map(name=>prior.reduce((sum,measurement)=>sum+(readAllocations(measurement.allocations,amountUnits(measurement))?.find(row=>row.name===name)?.amountUnits||0),0));
 const rows=allocationNames.map((name,i)=>{const matches=raw.filter((row:any)=>row&&row.name===name);if(matches.length!==1)return null;const amount=matches[0].amountUnits??(Number.isSafeInteger(matches[0].amountCents)?matches[0].amountCents*CENT_UNITS:NaN),baseUnits=bases[i];if(!Number.isSafeInteger(amount)||amount<0||amount%CENT_UNITS!==0||amount+previous[i]>baseUnits)return null;return {name,amountUnits:amount,baseUnits,percentP4:baseUnits?Math.round(amount/baseUnits*PERCENT_TOTAL):0}});
 return rows.every(Boolean)?rows as Allocation[]:null;
}
export function stageAllocationDrafts(stage:Row|undefined,endP4:number,prior:Row[],total:number):AllocationDraft[]{
 if(!stage||!Number.isSafeInteger(endP4)||endP4<=0||!Number.isSafeInteger(total)||total<=0)return allocationDrafts(null,0);
 const paid=(name:string)=>prior.reduce((sum,m)=>sum+(readAllocations(m.allocations,amountUnits(m))?.find(r=>r.name===name)?.amountUnits||0),0);
 let alex=Math.max(0,cumulativeMoneyUnits(alexContractUnits(stage),endP4)-paid('ALEX'));
 let pedreiro=Math.max(0,cumulativeMoneyUnits(pedreiroContractUnits(stage),endP4)-paid('Pedreiro'));
 alex=Math.min(Math.max(0,alexContractUnits(stage)-paid('ALEX')),alex);pedreiro=Math.min(Math.max(0,pedreiroContractUnits(stage)-paid('Pedreiro')),pedreiro);
 const amounts=[total,alex,pedreiro];
 return amounts.map(value=>({mode:'amount',input:(value/VALUE_SCALE).toFixed(2)}));
}
export function weekRange(day:string){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const start=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+6);return {start,end:d.toISOString().slice(0,10)}}

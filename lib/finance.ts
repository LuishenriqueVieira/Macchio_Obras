import type {Row} from './obras';
import {amountUnits,readAllocations,VALUE_SCALE} from './measurement';

export type FinancePeriod='day'|'week'|'month'|'year';
export type FinanceStatus='all'|'pending'|'paid';
export type PartyName='MA3'|'ALEX'|'Pedreiro';
export type PartyTotals=Record<PartyName,number>;
export const financeParties:PartyName[]=['MA3','ALEX','Pedreiro'];

const iso=(date:Date)=>date.toISOString().slice(0,10);
const utcDate=(value:string)=>{const [year,month,day]=value.slice(0,10).split('-').map(Number);return new Date(Date.UTC(year,month-1,day||1,12))};
const addDays=(value:string,days:number)=>{const date=utcDate(value);date.setUTCDate(date.getUTCDate()+days);return iso(date)};

export function financeRange(period:FinancePeriod,anchor:string){
 const current=/^\d{4}-\d{2}-\d{2}$/.test(anchor)?anchor:'1970-01-01';
 if(period==='day')return {start:current,end:current};
 if(period==='week'){
  const day=utcDate(current).getUTCDay(),start=addDays(current,-((day+6)%7));
  return {start,end:addDays(start,6)};
 }
 const year=Number(current.slice(0,4)),month=Number(current.slice(5,7));
 if(period==='month')return {start:`${current.slice(0,7)}-01`,end:iso(new Date(Date.UTC(year,month,0,12)))};
 return {start:`${year}-01-01`,end:`${year}-12-31`};
}

export function shiftFinanceAnchor(period:FinancePeriod,anchor:string,direction:-1|1){
 if(period==='day')return addDays(anchor,direction);
 if(period==='week')return addDays(anchor,direction*7);
 const date=utcDate(anchor);
 if(period==='month')date.setUTCMonth(date.getUTCMonth()+direction,1);
 else date.setUTCFullYear(date.getUTCFullYear()+direction,0,1);
 return iso(date);
}

export function financialUnits(row:Row):PartyTotals{
 const main=amountUnits(row),allocations=readAllocations(row.allocations,main);
 if(!allocations)return {MA3:main,ALEX:0,Pedreiro:0};
 return Object.fromEntries(financeParties.map(name=>[name,allocations.find(item=>item.name===name)?.amountUnits||0])) as PartyTotals;
}

const zero=():PartyTotals=>({MA3:0,ALEX:0,Pedreiro:0});
const add=(target:PartyTotals,value:PartyTotals)=>{for(const party of financeParties)target[party]+=value[party]};
export const totalUnits=(totals:PartyTotals)=>financeParties.reduce((sum,party)=>sum+totals[party],0);

export function summarizeFinance(measurements:Row[],projects:Row[],options:{start:string;end:string;status:FinanceStatus;projectId?:string;parties?:PartyName[]}){
 const selectedParties=options.parties??financeParties;
 const selectedValues=(row:Row)=>{
  const values=financialUnits(row);
  return Object.fromEntries(financeParties.map(party=>[party,selectedParties.includes(party)?values[party]:0])) as PartyTotals;
 };
 const allRows=measurements.filter(row=>!row.cancelledAt&&row.date>=options.start&&row.date<=options.end&&(!options.projectId||row.projectId===options.projectId));
 const valuedRows=allRows.filter(row=>totalUnits(selectedValues(row))>0);
 const rows=valuedRows.filter(row=>options.status==='all'||(options.status==='paid'?!!row.paid:!row.paid));
 const totals=zero(),paid=zero(),pending=zero();
 for(const row of valuedRows){const values=selectedValues(row);add(row.paid?paid:pending,values)}
 for(const row of rows)add(totals,selectedValues(row));
 const byProject=[...new Set(rows.map(row=>row.projectId))].map(projectId=>{
  const list=rows.filter(row=>row.projectId===projectId).sort((a,b)=>b.date.localeCompare(a.date));
  const projectTotals=zero(),projectPaid=zero(),projectPending=zero();
  for(const row of list){const values=selectedValues(row);add(projectTotals,values);add(row.paid?projectPaid:projectPending,values)}
  return {projectId,name:projects.find(project=>project.id===projectId)?.name||'Obra não identificada',rows:list,totals:projectTotals,paid:projectPaid,pending:projectPending};
 }).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 return {rows,totals,paid,pending,byProject,total:totalUnits(totals),paidTotal:totalUnits(paid),pendingTotal:totalUnits(pending),displayValue:(units:number)=>units/VALUE_SCALE};
}

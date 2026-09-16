"use client";
import {allocationNames,allocationDrafts,resolveAllocationDrafts,readAllocations,VALUE_SCALE,PERCENT_SCALE,type AllocationDraft} from '@/lib/measurement';
import {money,number} from '@/lib/obras';

export function AllocationEditor({total,drafts,onChange,busy=false}:{total:number;drafts?:AllocationDraft[];onChange:(drafts:AllocationDraft[])=>void;busy?:boolean}){
 const inputs=drafts||allocationDrafts(null,0),result=resolveAllocationDrafts(total,inputs);
 const change=(index:number,mode:'amount'|'percent',input:string)=>onChange(allocationNames.map((_,i)=>i===index?{mode,input}:inputs[i]||{mode:'amount',input:'0.0000'}));
 const reconcile=()=>{if(result.valid)onChange(result.valid.map(row=>({mode:'amount',input:(row.amountUnits/VALUE_SCALE).toFixed(2)})))};
 return <section className="allocation-editor wide" aria-label="Divisão da medição">
  <div className="allocation-heading"><div><h3>Divisão da medição</h3><p>Distribua o valor entre as três camadas.</p></div><span>Total a distribuir<strong>{money(Math.max(0,total)/VALUE_SCALE)}</strong></span></div>
  <div className="allocation-cards">{result.rows.map((row,i)=>{
   const draft=inputs[i]||{mode:'amount',input:'0.0000'},other=result.sum-(row.amountUnits||0),remaining=total-other;
   return <fieldset key={row.name} disabled={busy||total<=0} className={'allocation-card allocation-'+i}>
    <legend><span>{i+1}</span>{row.name}</legend>
    <label>Valor (R$)<input aria-label={'Valor '+row.name} name={'allocation-amount-'+i} type="number" inputMode="decimal" min="0" max={Math.max(0,total/VALUE_SCALE)} step="0.01" required value={draft.mode==='amount'?draft.input:row.amountUnits===null?'':(row.amountUnits/VALUE_SCALE).toFixed(2)} onFocus={e=>e.currentTarget.select()} onChange={e=>change(i,'amount',e.target.value)}/></label>
    <label>Parte da medição (%)<input aria-label={'Percentual '+row.name} name={'allocation-percent-'+i} type="number" inputMode="decimal" min="0" max="100" step="0.0001" required value={draft.mode==='percent'?draft.input:(row.percentP4/PERCENT_SCALE).toFixed(4)} onFocus={e=>e.currentTarget.select()} onChange={e=>change(i,'percent',e.target.value)} onBlur={reconcile}/></label>
    <button type="button" className="allocation-rest" disabled={remaining<0||remaining>total} onClick={()=>change(i,'amount',(remaining/VALUE_SCALE).toFixed(2))}>Completar saldo aqui</button>
   </fieldset>;
  })}</div>
  <div className={'allocation-balance '+(result.valid?'is-complete':result.remaining<0?'is-over':'')} role="status" aria-live="polite">
   <span>Distribuído<strong>{money(result.sum/VALUE_SCALE)} · {result.valid?'100,0000':number(total>0?result.sum/total*100:0)}%</strong></span>
   <span>{result.valid?'Divisão conferida':result.remaining<0?'Acima do total':'Falta distribuir'}<strong>{result.valid?'100,0000% do valor da medição':money(Math.abs(result.remaining)/VALUE_SCALE)}</strong></span>
  </div>
  <p className="allocation-help">100,0000% corresponde ao valor principal desta medição. Valores em reais usam duas casas e percentuais usam quatro. As três parcelas devem fechar o total.</p>
 </section>;
}

export function AllocationBreakdown({raw,total}:{raw:unknown;total:number}){
 const rows=readAllocations(raw,total);
 return rows?<dl className="allocation-breakdown">{rows.map(row=><div key={row.name}><dt>{row.name}</dt><dd><strong>{money(row.amountUnits/VALUE_SCALE)}</strong><span>{number(row.percentP4/PERCENT_SCALE)}%</span></dd></div>)}</dl>:<p className="allocation-help">Divisão não informada neste lançamento.</p>;
}

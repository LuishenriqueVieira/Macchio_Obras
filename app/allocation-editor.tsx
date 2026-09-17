"use client";
import {allocationNames,allocationDrafts,resolveStageAllocationDrafts,readAllocations,VALUE_SCALE,PERCENT_SCALE,type AllocationDraft} from '@/lib/measurement';
import {money,number} from '@/lib/obras';

export function AllocationEditor({total,bases,drafts,onChange,busy=false}:{total:number;bases:number[];drafts?:AllocationDraft[];onChange:(drafts:AllocationDraft[])=>void;busy?:boolean}){
 const inputs=drafts||allocationDrafts(null,0),result=resolveStageAllocationDrafts(bases,inputs);
 const change=(index:number,mode:'amount'|'percent',input:string)=>onChange(allocationNames.map((_,i)=>i===index?{mode,input}:inputs[i]||{mode:'amount',input:'0.0000'}));
 const reconcile=()=>{if(result.valid)onChange(result.valid.map(row=>({mode:'amount',input:(row.amountUnits/VALUE_SCALE).toFixed(2)})))};
 return <section className="allocation-editor wide" aria-label="Divisão da medição">
  <div className="allocation-heading"><div><h3>Valores por parte</h3><p>O percentual da medição é aplicado à base cadastrada de cada parte.</p></div><span>Total financeiro<strong>{money(result.sum/VALUE_SCALE)}</strong></span></div>
  <div className="allocation-cards">{result.rows.map((row,i)=>{
   const draft=inputs[i]||{mode:'amount',input:'0.00'};
   return <fieldset key={row.name} disabled={busy||total<=0} className={'allocation-card allocation-'+i}>
    <legend><span>{i+1}</span>{row.name}</legend>
    <small className="allocation-base">Base cadastrada: <strong>{money(row.baseUnits/VALUE_SCALE)}</strong></small>
    <label>Valor no período (R$)<input aria-label={'Valor '+row.name} name={'allocation-amount-'+i} type="number" inputMode="decimal" min="0" max={Math.max(0,row.baseUnits/VALUE_SCALE)} step="0.01" required value={draft.mode==='amount'?draft.input:row.amountUnits===null?'':(row.amountUnits/VALUE_SCALE).toFixed(2)} onFocus={e=>e.currentTarget.select()} onChange={e=>change(i,'amount',e.target.value)}/></label>
    <label>Percentual sobre a base (%)<input aria-label={'Percentual '+row.name} name={'allocation-percent-'+i} type="number" inputMode="decimal" min="0" max="100" step="0.0001" required value={draft.mode==='percent'?draft.input:(row.percentP4/PERCENT_SCALE).toFixed(4)} onFocus={e=>e.currentTarget.select()} onChange={e=>change(i,'percent',e.target.value)} onBlur={reconcile}/></label>
   </fieldset>;
  })}</div>
  <div className={'allocation-balance '+(result.valid?'is-complete':'is-over')} role="status" aria-live="polite">
   <span>Total calculado<strong>{money(result.sum/VALUE_SCALE)}</strong></span>
   <span>{result.valid?'Bases conferidas':'Revise os campos'}<strong>{result.valid?'Cada percentual usa o valor cadastrado da própria parte':'O valor não pode superar a base cadastrada'}</strong></span>
  </div>
  <p className="allocation-help">Ao informar o percentual principal, ele é aplicado às bases MA3, ALEX e Pedreiro. Ao editar uma parcela, o percentual é recalculado somente em relação à base daquela parte.</p>
 </section>;
}

export function AllocationBreakdown({raw,total}:{raw:unknown;total:number}){
 const rows=readAllocations(raw,total);
 return rows?<dl className="allocation-breakdown">{rows.map(row=><div key={row.name}><dt>{row.name}</dt><dd><strong>{money(row.amountUnits/VALUE_SCALE)}</strong><span>{number(row.percentP4/PERCENT_SCALE)}%</span>{row.baseUnits!==undefined&&<small>Base: {money(row.baseUnits/VALUE_SCALE)}</small>}</dd></div>)}</dl>:<p className="allocation-help">Divisão não informada neste lançamento.</p>;
}

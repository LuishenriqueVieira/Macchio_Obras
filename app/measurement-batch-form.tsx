"use client";
import {Plus,Trash2} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Choice} from './obras-ui';
import {AllocationEditor} from './allocation-editor';
import {money,number,today,type Row} from '@/lib/obras';
import {contractUnits,alexContractUnits,pedreiroContractUnits,stageAllocationBases,stageLedger,amountUnits,endPercentUnits,resolveMeasurementInput,percentFromAmount,allocationDrafts,stageAllocationDrafts,resolveStageAllocationDrafts,VALUE_SCALE,PERCENT_SCALE} from '@/lib/measurement';

export function newBatchMeasurementItem(day=today()){
 return {requestId:crypto.randomUUID(),stageId:'',periodStart:day,date:day,percent:'',measurementInput:'percent',measurementValue:'',previousId:'',notes:'',allocationDrafts:allocationDrafts(null,0)};
}
const nextDay=(day:string)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)};

export function MeasurementBatchForm({modal,setModal,form,update,real,busy,formError,submit}:any){
 if(modal?.kind!=='measurementBatch')return null;
 const items:Row[]=form.measurementItems||[];
 const stages=real.stages.filter((stage:Row)=>stage.projectId===form.projectId);
 const selectedIds=items.map(item=>item.stageId).filter(Boolean);
 const setItems=(next:Row[])=>update('measurementItems',next);
 const patchItem=(index:number,patch:Row)=>setItems(items.map((item,i)=>i===index?{...item,...patch}:item));
 const chooseProject=(projectId:string)=>{update('projectId',projectId);update('measurementItems',[newBatchMeasurementItem()])};
 const chooseStage=(index:number,stageId:string)=>{
  const ledger=stageLedger(real.measurements,stageId),last=ledger.at(-1),periodStart=last?nextDay(last.date):today(),current=items[index];
  patchItem(index,{stageId,previousId:last?.id||'',periodStart,date:current.date&&current.date>=periodStart?current.date:periodStart,percent:'',measurementInput:'percent',measurementValue:'',allocationDrafts:allocationDrafts(null,0)});
 };
 const add=()=>setItems([...items,newBatchMeasurementItem()]);
 const remove=(index:number)=>setItems(items.filter((_,i)=>i!==index));
 const states=items.map((item,index)=>{
  const stage=stages.find((candidate:Row)=>candidate.id===item.stageId),ledger=stageLedger(real.measurements,item.stageId),last=ledger.at(-1),previous=endPercentUnits(last||{})/PERCENT_SCALE,base=stage?contractUnits(stage):0,already=ledger.reduce((sum:number,row:Row)=>sum+amountUnits(row),0);
  const measurement=resolveMeasurementInput('measurements',item.measurementInput,base,item.percent,item.measurementValue,already),total=measurement?.amountUnits||0,bases=stageAllocationBases(stage),drafts=item.allocationDrafts||allocationDrafts(null,0),allocation=resolveStageAllocationDrafts(bases,drafts);
  const valid=!!stage&&!!stage.contractor&&base>0&&!!measurement&&measurement.endP4>endPercentUnits(last||{})&&item.periodStart&&item.date>=item.periodStart&&(!last||item.periodStart>last.date)&&!!allocation.valid&&selectedIds.indexOf(item.stageId)===index;
  return {item,stage,ledger,last,previous,base,already,measurement,total,bases,drafts,allocation,valid};
 });
 const valid=!!form.projectId&&items.length>0&&states.every(state=>state.valid);
 return <Dialog open onOpenChange={open=>{if(!busy&&!open)setModal(null)}}><DialogContent className="form-dialog measurement-dialog batch-measurement-dialog" showCloseButton={!busy}>
  <DialogHeader><DialogTitle>Nova medição com várias etapas</DialogTitle><DialogDescription>Adicione as etapas medidas e informe o avanço de cada uma. Todos os lançamentos serão salvos juntos.</DialogDescription></DialogHeader>
  <form onSubmit={submit}>
   <div className="batch-project"><label>Obra<Choice label="Obra" value={form.projectId||''} onChange={chooseProject} options={[["","Selecione uma obra"],...real.projects.map((project:Row)=>[project.id,project.name])]}/></label><span>{items.length} {items.length===1?'etapa adicionada':'etapas adicionadas'}</span></div>
   {!form.projectId&&<p className="form-hint">Selecione a obra para adicionar as etapas desta medição.</p>}
   <div className="batch-items">{states.map(({item,stage,ledger,last,previous,base,already,measurement,total,bases,drafts,allocation,valid:entryValid},index)=>{
    const updateMeasurement=(mode:'percent'|'amount',value:string)=>{const resolved=resolveMeasurementInput('measurements',mode,base,mode==='percent'?value:percentFromAmount(base,value,already),mode==='amount'?value:undefined,already);patchItem(index,{measurementInput:mode,percent:mode==='percent'?value:percentFromAmount(base,value,already)??'',measurementValue:mode==='amount'?value:'',allocationDrafts:stageAllocationDrafts(stage,resolved?.endP4||0,ledger,resolved?.amountUnits||0)})};
    const amountValue=item.measurementInput==='amount'?item.measurementValue:measurement?(measurement.amountUnits/VALUE_SCALE).toFixed(2):'';
    const available=stages.filter((candidate:Row)=>candidate.id===item.stageId||!selectedIds.includes(candidate.id));
    return <section className={'batch-item '+(item.stageId&&!entryValid?'has-error':'')} key={item.requestId}>
     <header><div><span>Etapa {index+1}</span><strong>{stage?.name||'Selecione a etapa'}</strong></div>{items.length>1&&<button type="button" className="icon-button danger" title="Remover etapa" onClick={()=>remove(index)} disabled={busy}><Trash2 size={16}/></button>}</header>
     <div className="batch-item-grid">
      <label className="wide">Etapa<Choice label={'Etapa '+(index+1)} value={item.stageId} onChange={(value:string)=>chooseStage(index,value)} options={[["","Selecione uma etapa"],...available.map((candidate:Row)=>[candidate.id,candidate.name])]}/></label>
      <label>Início do período<input type="date" value={item.periodStart} min={last?nextDay(last.date):undefined} max={item.date} onChange={event=>patchItem(index,{periodStart:event.target.value})} required/></label>
      <label>Fim do período<input type="date" value={item.date} min={item.periodStart} onChange={event=>patchItem(index,{date:event.target.value})} required/></label>
      <label>Percentual acumulado (%)<input type="number" inputMode="decimal" value={item.percent} min={Math.min(100,previous+0.0001)} max="100" step="0.0001" onFocus={event=>event.currentTarget.select()} onChange={event=>updateMeasurement('percent',event.target.value)} required disabled={!stage}/></label>
      <label>Valor MA3 no período (R$)<input type="number" inputMode="decimal" value={amountValue} min="0.01" max={Math.max(0,(base-already)/VALUE_SCALE)} step="0.01" onFocus={event=>event.currentTarget.select()} onChange={event=>updateMeasurement('amount',event.target.value)} required disabled={!stage}/></label>
      <label className="wide">Observações<textarea value={item.notes} onChange={event=>patchItem(index,{notes:event.target.value})} maxLength={1000}/></label>
     </div>
     {stage&&<div className="notice">Anterior: <strong>{number(previous)}%</strong> · Novo acumulado: <strong>{number(Number(item.percent))}%</strong> · Variação: <strong>{number(Math.max(0,Number(item.percent)-previous))} p.p.</strong><br/>Bases: MA3 {money(contractUnits(stage)/VALUE_SCALE)} · ALEX {money(alexContractUnits(stage)/VALUE_SCALE)} · Pedreiro {money(pedreiroContractUnits(stage)/VALUE_SCALE)}</div>}
     {stage&&(!stage.contractor||!base)&&<p className="form-hint" role="alert">Informe a empreiteira e a base MA3 no cadastro da etapa antes de medir.</p>}
     {stage&&<AllocationEditor total={total} bases={bases} drafts={drafts} onChange={value=>patchItem(index,{allocationDrafts:value})} busy={busy}/>} 
     {item.stageId&&!entryValid&&<p className="batch-error" role="alert">Confira período, percentual, valores e saldos desta etapa. Nenhuma parcela pode ultrapassar a base cadastrada.</p>}
     {allocation.valid&&measurement&&<div className="batch-item-total"><span>Total financeiro da etapa</span><strong>{money(allocation.sum/VALUE_SCALE)}</strong></div>}
    </section>})}</div>
   {form.projectId&&<button type="button" className="secondary batch-add" onClick={add} disabled={busy||items.length>=stages.length||items.length>=20}><Plus size={16}/>Adicionar outra etapa</button>}
   {form.projectId&&!stages.length&&<p className="form-hint">Esta obra ainda não possui etapas disponíveis para medição.</p>}
   {formError&&<div className="error-banner" role="alert">{formError}</div>}
   <div className="form-actions"><button type="button" className="secondary" onClick={()=>setModal(null)} disabled={busy}>Cancelar</button><button type="submit" className="primary" disabled={busy||!valid}>{busy?'Salvando…':`Salvar ${items.length} ${items.length===1?'medição':'medições'}`}</button></div>
  </form>
 </DialogContent></Dialog>;
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const helpers=url(compile('lib/measurement.ts'));
const h=await import(helpers);
const ui=url('export const Dialog=()=>null,DialogContent=()=>null,DialogHeader=()=>null,DialogTitle=()=>null,DialogDescription=()=>null,Choice=()=>null,Upload=()=>null,FileText=()=>null;');
const obras=url(compile('lib/obras.ts').replace("'./measurement'",JSON.stringify(helpers)));
const allocationSource=compile('app/allocation-editor.tsx').replace('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime'))).replace("'@/lib/measurement'",JSON.stringify(helpers)).replace("'@/lib/obras'",JSON.stringify(obras));
const allocationModule=url(allocationSource);
const source=compile('app/record-form.tsx').replace('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime'))).replace("'@/lib/measurement'",JSON.stringify(helpers)).replace("'@/lib/obras'",JSON.stringify(obras)).replace("'lucide-react'",JSON.stringify(ui)).replace("'@/components/ui/dialog'",JSON.stringify(ui)).replace("'./obras-ui'",JSON.stringify(ui)).replace("'./allocation-editor'",JSON.stringify(allocationModule));
const Form=(await import(url(source))).default;
const real={projects:[],engineers:[],stageTypes:[],stages:[{id:'s',projectId:'p',contractCents:100000,contractor:'Empreiteira'}],measurements:[{id:'old',stageId:'s',endBp:3000,amountCents:30000,date:'2026-09-01'}]};
let form={stageId:'s',projectId:'p',percent:'',date:'2026-09-02',periodStart:'2026-09-02',notes:''};
const render=(kind='measurements',row)=>Form({modal:{kind,row},setModal(){},form,update:(key,value)=>{form={...form,[key]:value}},real,files:[],busy:false,formError:'',submit(){}});
const nodes=tree=>!tree||typeof tree!=='object'?[]:[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];
const input=name=>nodes(render()).find(n=>n.type==='input'&&n.props.name===name);
// Regression: opening payment has stageId but no percent. It must never invoke BigInt(NaN).
const payment={id:'m',stageId:'s',stageName:'Fundação',contractor:'Empreiteira',amountCents:20000,paid:true,paidAt:'2026-09-03',date:'2026-09-02'};
const original=form;form=payment;assert.doesNotThrow(()=>render('payment',payment));form=original;
assert.equal(input('measurementValue').props.value,'');
input('percent').props.onChange({target:{value:'50'}});assert.equal(input('measurementValue').props.value,'200.00');
input('measurementValue').props.onChange({target:{value:'150.00'}});assert.equal(form.percent,45);assert.equal(input('percent').props.value,45);
input('percent').props.onChange({target:{value:''}});assert.equal(input('measurementValue').props.value,'');
input('measurementValue').props.onChange({target:{value:'700'}});assert.equal(form.percent,100);
input('measurementValue').props.onChange({target:{value:'700.01'}});assert.equal(form.percent,'');assert.ok(nodes(render()).find(n=>n.type==='button'&&n.props.type==='submit').props.disabled);
input('measurementValue').props.onChange({target:{value:''}});assert.equal(form.percent,'');
form={...original,percent:50};assert.equal(input('measurementValue').props.value,'200.00');
// Editing excludes the existing record from the prior balance.
real.measurements.push({id:'edit',stageId:'s',endBp:5000,amountCents:20000,date:'2026-09-02'});
assert.equal(nodes(render('measurements',{id:'edit'})).find(n=>n.type==='input'&&n.props.name==='measurementValue').props.value,'200.00');
assert.equal(h.previewMeasurement('payment',100000,undefined,0),null);
for(const invalid of [NaN,Infinity,undefined,'',101,-1])assert.equal(h.previewMeasurement('measurements',100000,invalid,0),null);
assert.equal(h.percentFromAmount(0,100,0),null);assert.equal(h.percentFromAmount(100000,-1,0),null);
// Rounding and final balance use exactly the server's integer-cent calculation.
assert.equal(h.percentFromAmount(100001,700.01,30000),100);
assert.equal(h.previewMeasurement('measurements',100001,100,30000),70001);
const rounded=h.percentFromAmount(1234567,12.34,0);assert.equal(rounded,0.1);assert.equal(h.previewMeasurement('measurements',1234567,rounded,0),1235);
console.log('PASS: payment dialog regression, dynamic amount/percentage inputs, previous balance, editing, clearing, bounds and rounding.');

const {AllocationEditor}=await import(allocationModule);
let drafts=h.allocationDrafts(null,100001),total=100001;
const editor=()=>AllocationEditor({total,drafts,onChange:value=>drafts=value});
const layerInput=name=>nodes(editor()).find(n=>n.type==='input'&&n.props.name===name);
layerInput('allocation-amount-0').props.onChange({target:{value:'500.00'}});
assert.equal(layerInput('allocation-percent-0').props.value,'50.00');
layerInput('allocation-percent-1').props.onChange({target:{value:'30'}});
assert.equal(layerInput('allocation-amount-1').props.value,'300.00');
nodes(editor()).filter(n=>n.type==='button')[2].props.onClick();
assert.equal(layerInput('allocation-amount-2').props.value,'200.01');
let result=h.resolveAllocationDrafts(total,drafts);assert.ok(result.valid);assert.equal(result.valid.reduce((s,r)=>s+r.percentBp,0),10000);assert.equal(result.sum,total);
total=80000;assert.equal(h.resolveAllocationDrafts(total,drafts).valid,null);
layerInput('allocation-amount-0').props.onChange({target:{value:''}});assert.equal(h.resolveAllocationDrafts(total,drafts).valid,null);
for(const invalid of ['-1','Infinity','0.001','10000000000000000000']){drafts=[{mode:'amount',input:invalid},{mode:'amount',input:'0'},{mode:'amount',input:'0'}];assert.equal(h.resolveAllocationDrafts(100,drafts).valid,null)}
for(const value of [1,2,3,101,100001,999999999999]){
 drafts=[{mode:'percent',input:'33.33'},{mode:'percent',input:'33.33'},{mode:'percent',input:'33.34'}];
 const resolved=h.resolveAllocationDrafts(value,drafts);assert.ok(resolved.valid);assert.equal(resolved.sum,value);assert.equal(resolved.valid.reduce((s,r)=>s+r.percentBp,0),10000);
}
total=3;drafts=[{mode:'percent',input:'33.33'},{mode:'percent',input:'33.33'},{mode:'percent',input:'33.34'}];
layerInput('allocation-percent-2').props.onBlur();assert.equal(nodes(editor()).filter(n=>n.type==='input'&&n.props.name.startsWith('allocation-percent')).reduce((s,n)=>s+Math.round(Number(n.props.value)*100),0),10000);
// The complete form blocks saving a balanced total until its three layers close.
real.measurements=real.measurements.filter(m=>m.id!=='edit');form={...original,percent:50};
assert.ok(nodes(render()).find(n=>n.type==='button'&&n.props.type==='submit').props.disabled);
form.allocationDrafts=[{mode:'amount',input:'100'},{mode:'amount',input:'60'},{mode:'amount',input:'40'}];
assert.equal(nodes(render()).find(n=>n.type==='button'&&n.props.type==='submit').props.disabled,false);
assert.equal(h.readAllocations(null,20000),null);assert.equal(h.readAllocations('broken',20000),null);
console.log('PASS: three dynamic layers, fill remaining balance, changed total, empty/invalid values, rounding, tiny and large values, 100% closure and save protection.');

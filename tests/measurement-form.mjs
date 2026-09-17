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
let selected=0;input('percent').props.onFocus({currentTarget:{select(){selected++}}});input('measurementValue').props.onFocus({currentTarget:{select(){selected++}}});assert.equal(selected,2);
input('percent').props.onChange({target:{value:'50'}});assert.equal(input('measurementValue').props.value,'200.00');assert.equal(input('percent').props.step,'0.0001');assert.equal(input('measurementValue').props.step,'0.01');
input('measurementValue').props.onChange({target:{value:'150.00'}});assert.equal(form.percent,45);assert.equal(input('percent').props.value,45);
input('percent').props.onChange({target:{value:''}});assert.equal(input('measurementValue').props.value,'');
input('measurementValue').props.onChange({target:{value:'700'}});assert.equal(form.percent,100);
input('measurementValue').props.onChange({target:{value:'700.01'}});assert.equal(form.percent,'');assert.ok(nodes(render()).find(n=>n.type==='button'&&n.props.type==='submit').props.disabled);
input('measurementValue').props.onChange({target:{value:''}});assert.equal(form.percent,'');
form={...original,percent:50};assert.equal(input('measurementValue').props.value,'200.00');
// Editing excludes the existing record from the prior balance.
real.measurements.push({id:'edit',stageId:'s',endBp:5000,amountCents:20000,date:'2026-09-02'});
assert.equal(nodes(render('measurements',{id:'edit'})).find(n=>n.type==='input'&&n.props.name==='measurementValue').props.value,'200.00');
assert.equal(h.previewMeasurement('payment',10000000,undefined,0),null);
for(const invalid of [NaN,Infinity,undefined,'',101,-1,30.00001])assert.equal(h.previewMeasurement('measurements',10000000,invalid,0),null);
assert.equal(h.percentFromAmount(0,100,0),null);assert.equal(h.percentFromAmount(10000000,-1,0),null);assert.equal(h.percentFromAmount(10000000,0.00001,0),null);
// Monetary values close in cents while percentages retain four decimal places.
assert.equal(h.percentFromAmount(10000100,700.01,3000000),100);
assert.equal(h.previewMeasurement('measurements',10000100,100,3000000),7000100);
const rounded=h.percentFromAmount(123456700,12.34,0);assert.equal(rounded,0.1);assert.equal(h.previewMeasurement('measurements',123456700,rounded,0),123500);
const screenshotCase=h.resolveMeasurementInput('measurements','amount',48000000,62.5033,1000,20001600);assert.deepEqual(screenshotCase,{amountUnits:10000000,endP4:625033});
assert.equal(h.previewMeasurement('measurements',48000000,62.5033,20001600),10000000);
assert.deepEqual(h.stageAllocationDrafts({contractUnits:10000000,alexUnits:3000000,pedreiroUnits:2000000},500000,[],5000000).map(x=>x.input),['500.00','150.00','100.00']);
const priorSplit=[{stageId:'s',amountUnits:2000000,allocations:JSON.stringify([{name:'MA3',amountUnits:1000000,percentP4:500000},{name:'ALEX',amountUnits:600000,percentP4:300000},{name:'Pedreiro',amountUnits:400000,percentP4:200000}])}];
assert.deepEqual(h.stageAllocationDrafts({contractUnits:10000000,alexUnits:3000000,pedreiroUnits:2000000},500000,priorSplit,3000000).map(x=>x.input),['300.00','90.00','60.00']);
const newAllocation=JSON.stringify([{name:'MA3',amountUnits:5000000,baseUnits:10000000,percentP4:500000},{name:'ALEX',amountUnits:1800000,baseUnits:6000000,percentP4:300000},{name:'Pedreiro',amountUnits:1000000,baseUnits:4000000,percentP4:250000}]);
assert.equal(h.payableUnits({amountUnits:5000000,allocations:newAllocation}),7800000);assert.deepEqual(h.readAllocations(newAllocation,5000000).map(r=>r.percentP4),[500000,300000,250000]);assert.equal(h.payableUnits({amountUnits:5000000,allocations:priorSplit[0].allocations}),5000000);
console.log('PASS: payment dialog regression, dynamic amount/percentage inputs, previous balance, editing, clearing, bounds and rounding.');

const {AllocationEditor}=await import(allocationModule);
let drafts=h.allocationDrafts(null,10000000),total=5000000,bases=[10000000,6000000,4000000];
const editor=()=>AllocationEditor({total,bases,drafts,onChange:value=>drafts=value});
const layerInput=name=>nodes(editor()).find(n=>n.type==='input'&&n.props.name===name);
selected=0;layerInput('allocation-amount-0').props.onFocus({currentTarget:{select(){selected++}}});layerInput('allocation-percent-0').props.onFocus({currentTarget:{select(){selected++}}});assert.equal(selected,2);
layerInput('allocation-amount-0').props.onChange({target:{value:'500.00'}});
assert.equal(layerInput('allocation-percent-0').props.value,'50.0000');assert.equal(layerInput('allocation-amount-0').props.step,'0.01');assert.equal(layerInput('allocation-percent-0').props.step,'0.0001');
layerInput('allocation-percent-1').props.onChange({target:{value:'30'}});
assert.equal(layerInput('allocation-amount-1').props.value,'180.00');
layerInput('allocation-percent-2').props.onChange({target:{value:'25'}});assert.equal(layerInput('allocation-amount-2').props.value,'100.00');
let result=h.resolveStageAllocationDrafts(bases,drafts);assert.ok(result.valid);assert.deepEqual(result.valid.map(r=>r.percentP4),[500000,300000,250000]);assert.equal(result.sum,7800000);
layerInput('allocation-amount-0').props.onChange({target:{value:''}});assert.equal(h.resolveStageAllocationDrafts(bases,drafts).valid,null);
for(const invalid of ['-1','Infinity','0.001','1001','10000000000000000000']){drafts=[{mode:'amount',input:invalid},{mode:'amount',input:'0'},{mode:'amount',input:'0'}];assert.equal(h.resolveStageAllocationDrafts(bases,drafts).valid,null)}
drafts=[{mode:'percent',input:'20.8333'},{mode:'percent',input:'20.8333'},{mode:'percent',input:'20.8333'}];result=h.resolveStageAllocationDrafts(bases,drafts);assert.ok(result.valid);assert.deepEqual(result.valid.map(r=>r.amountUnits),[2083300,1250000,833300]);
// The complete form applies the main percentage to every registered base.
real.measurements=real.measurements.filter(m=>m.id!=='edit');form={...original};input('percent').props.onChange({target:{value:'50'}});
assert.equal(nodes(render()).find(n=>n.type==='button'&&n.props.type==='submit').props.disabled,false);
form.allocationDrafts=[{mode:'amount',input:'1001'},{mode:'amount',input:'0'},{mode:'amount',input:'0'}];assert.ok(nodes(render()).find(n=>n.type==='button'&&n.props.type==='submit').props.disabled);
assert.equal(h.readAllocations(null,2000000),null);assert.equal(h.readAllocations('broken',2000000),null);
console.log('PASS: three dynamic bases, value/percentage conversion per party, automatic main percentage, bounds, cents and save protection.');

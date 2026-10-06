import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const transpile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const measurement=url(transpile('lib/measurement.ts').replace("'./obras'","'data:text/javascript,export%20{}'"));
const finance=await import(url(transpile('lib/finance.ts').replace("'./measurement'",JSON.stringify(measurement))));

assert.deepEqual(finance.financeRange('day','2026-09-17'),{start:'2026-09-17',end:'2026-09-17'});
assert.deepEqual(finance.financeRange('week','2027-01-01'),{start:'2026-12-28',end:'2027-01-03'});
assert.deepEqual(finance.financeRange('month','2028-02-12'),{start:'2028-02-01',end:'2028-02-29'});
assert.deepEqual(finance.financeRange('year','2026-09-17'),{start:'2026-01-01',end:'2026-12-31'});
assert.equal(finance.shiftFinanceAnchor('week','2027-01-01',-1),'2026-12-25');
assert.equal(finance.shiftFinanceAnchor('month','2026-01-31',1),'2026-02-01');
assert.equal(finance.shiftFinanceAnchor('year','2026-09-17',1),'2027-01-01');

const units=value=>value*10000;
const allocation=(ma3,alex,pedreiro)=>JSON.stringify([
 {name:'MA3',amountUnits:units(ma3),baseUnits:units(1000),percentP4:0},
 {name:'ALEX',amountUnits:units(alex),baseUnits:units(1000),percentP4:0},
 {name:'Pedreiro',amountUnits:units(pedreiro),baseUnits:units(1000),percentP4:0},
]);
const projects=[{id:'p1',name:'Obra Alfa'},{id:'p2',name:'Obra Beta'}];
const measurements=[
 {id:'m1',projectId:'p1',date:'2026-09-15',paid:0,amountUnits:units(100),allocations:allocation(100,50,25)},
 {id:'m2',projectId:'p2',date:'2026-09-16',paid:1,paidAt:'2026-09-18',amountUnits:units(200),allocations:allocation(200,100,80)},
 {id:'legacy',projectId:'p1',date:'2026-09-17',paid:1,amountUnits:units(300),allocations:null},
 {id:'outside',projectId:'p1',date:'2026-09-25',paid:0,amountUnits:units(999),allocations:allocation(999,1,1)},
 {id:'cancelled',projectId:'p1',date:'2026-09-18',paid:0,cancelledAt:'2026-09-19',amountUnits:units(999),allocations:allocation(999,1,1)},
];
const all=finance.summarizeFinance(measurements,projects,{start:'2026-09-14',end:'2026-09-20',status:'all'});
assert.equal(all.rows.length,3);
assert.deepEqual(all.totals,{MA3:units(600),ALEX:units(150),Pedreiro:units(105)});
assert.equal(all.total,units(855));
assert.deepEqual(all.paid,{MA3:units(500),ALEX:units(100),Pedreiro:units(80)});
assert.equal(all.paidTotal,units(680));
assert.equal(all.pendingTotal,units(175));
assert.equal(all.byProject.length,2);
assert.equal(all.byProject.find(row=>row.projectId==='p1').rows.length,2);
const pending=finance.summarizeFinance(measurements,projects,{start:'2026-09-14',end:'2026-09-20',status:'pending'});
assert.deepEqual(pending.totals,{MA3:units(100),ALEX:units(50),Pedreiro:units(25)});
const beta=finance.summarizeFinance(measurements,projects,{start:'2026-09-14',end:'2026-09-20',status:'all',projectId:'p2'});
assert.equal(beta.total,units(380));
assert.equal(beta.byProject[0].name,'Obra Beta');
console.log('PASS: períodos diário, semanal, mensal e anual, totais por MA3/ALEX/Pedreiro, pagos, pendentes e detalhamento por obra.');


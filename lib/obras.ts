import {contractUnits,amountUnits,VALUE_SCALE} from './measurement';
export type Row=Record<string,any>;
export type Store={stageTypes:Row[];projects:Row[];engineers:Row[];teams:Row[];stages:Row[];measurements:Row[];documents:Row[]};
export const empty:Store={stageTypes:[],projects:[],engineers:[],teams:[],stages:[],measurements:[],documents:[]};
export const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:4,maximumFractionDigits:4}).format(v||0);
export const number=(v:number)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:4,maximumFractionDigits:4}).format(v||0);
export const dateLabel=(v:string)=>v?new Date(v.slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'—';
export const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
export const initials=(s:string)=>s.split(' ').filter(Boolean).slice(0,2).map(s=>s[0]).join('');
export const countMembers=(s:string)=>s.split('\n').filter(s=>s.trim()).length;
export function stats(data:Store,projectId?:string){const stages=data.stages.filter(s=>!projectId||s.projectId===projectId);const measurements=data.measurements.filter(m=>!m.cancelledAt&&(!projectId||m.projectId===projectId));const planned=stages.reduce((t,s)=>t+contractUnits(s)/VALUE_SCALE,0);const measured=measurements.reduce((t,m)=>t+amountUnits(m)/VALUE_SCALE,0);return {planned,measured,progress:planned?Math.min(100,100*measured/planned):0};}
export const categories=['Projeto','Orçamento','Comprovante de pagamento','Contrato','Relatório','Outros'];
export const labels:Record<string,string>={stageTypes:'tipo de etapa',projects:'obra',engineers:'engenheiro',teams:'equipe',stages:'etapa',measurements:'medição',documents:'documento'};

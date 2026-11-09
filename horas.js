import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const db=createClient('https://pqhfltldtnmxvowhhkvu.supabase.co','sb_publishable_mkMZ7kF5RxWmaAma-wzWFA_WkiqCDQu');
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let user=null,records=[],people=[],editingId=null;
const isAdmin=()=>['alvaro.batistella@method-flow.com','drapatriciadiezg@gmail.com'].includes(user?.email?.toLowerCase());
function minutesBetween(start,end,pause){
 const parse=v=>{if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v))return NaN;const [day,time]=v.split('T'),[y,m,d]=day.split('-').map(Number),[hh,mm]=time.split(':').map(Number);return Date.UTC(y,m-1,d,hh,mm)/60000};
 const gross=parse(end)-parse(start);
 if(!Number.isFinite(gross)||gross<=0||!Number.isInteger(pause)||pause<0||pause>gross)throw Error('Confira as datas, os horários e o intervalo. A saída deve ser posterior à entrada e o intervalo não pode superar a duração.');
 return gross-pause;
}
const duration=n=>Math.floor(n/60)+'h '+String(n%60).padStart(2,'0')+'min';
function values(){return {entrada:$('#dayIn').value+'T'+$('#timeIn').value,saida:$('#dayOut').value+'T'+$('#timeOut').value,intervalo_minutos:Number($('#breakMinutes').value)}}
function preview(){try{const r=values();$('#duration').textContent='Horas trabalhadas: '+duration(minutesBetween(r.entrada,r.saida,r.intervalo_minutos))}catch(e){$('#duration').textContent=e.message}}
const displayDate=v=>v.slice(8,10)+'/'+v.slice(5,7)+'/'+v.slice(0,4)+' '+v.slice(11,16);
function render(){
 const start=$('#start').value,end=$('#end').value;
 if(start&&end&&start>end){$('#total').textContent='A data final deve ser posterior ou igual à inicial.';$('#hoursRows').innerHTML='';return}
 const list=records.filter(r=>(!$('#personFilter').value||r.usuario_email===$('#personFilter').value)&&(!start||r.entrada.slice(0,10)>=start)&&(!end||r.entrada.slice(0,10)<=end));
 let total=0;
 $('#hoursRows').innerHTML=list.map(r=>{const n=minutesBetween(r.entrada,r.saida,r.intervalo_minutos);total+=n;const p=people.find(x=>x.email===r.usuario_email);return '<tr><td>'+esc(p?.nome||r.usuario_email)+'<div class="sub">'+esc(r.usuario_email)+'</div></td><td>'+displayDate(r.entrada)+'</td><td>'+displayDate(r.saida)+'</td><td>'+r.intervalo_minutos+' min</td><td><b>'+duration(n)+'</b></td><td>'+'<button type="button" class="secondary small" data-edit="'+esc(r.id)+'">Editar</button> <button type="button" class="danger small" data-delete="'+esc(r.id)+'">Excluir</button>'+'</td></tr>'}).join('')||'<tr><td colspan="6">Nenhum registro encontrado.</td></tr>';
 $('#total').textContent='Total: '+duration(total)+' · '+list.length+' registro(s)';
}
async function load(){
 const {data,error}=await db.from('mf_horas_registros').select('*').order('entrada',{ascending:false});if(error)throw error;records=data;render();
}
$('#hoursForm').addEventListener('input',preview);
$('#hoursForm').onsubmit=async e=>{
 e.preventDefault();const button=$('#saveHours');button.disabled=true;
 try{const r=values();minutesBetween(r.entrada,r.saida,r.intervalo_minutos);
 if(records.some(x=>x.id!==editingId&&x.usuario_email===$('#person').value&&r.entrada<x.saida&&r.saida>x.entrada))throw Error('Já existe um registro com horário sobreposto para este usuário.');
 const payload={...r,usuario_email:$('#person').value};
 const result=editingId
   ?await db.from('mf_horas_registros').update(payload).eq('id',editingId).select('id')
   :await db.from('mf_horas_registros').insert({...payload,criado_por:null}).select('id');
 if(result.error)throw result.error;
 if(result.data?.length!==1)throw Error('O registro não foi alterado. Atualize a página e confira as permissões no Supabase.');
 const wasEditing=Boolean(editingId);cancelEdit();
 $('#message').textContent=wasEditing?'Registro atualizado.':'Horas salvas.';await load();
 }catch(err){alert('Não foi possível salvar: '+err.message)}finally{button.disabled=false}
};
function cancelEdit(){
 editingId=null;$('#saveHours').textContent='Salvar horas';$('#cancelEdit').hidden=true;
 $('#formTitle').textContent='Registrar horas';
 $('#person').querySelectorAll('[data-historical]').forEach(option=>option.remove());
}
$('#cancelEdit').onclick=()=>{cancelEdit();$('#hoursForm').reset();preview()};
$('#hoursRows').onclick=async e=>{
 const button=e.target.closest('button');if(!button)return;
 const id=button.dataset.edit||button.dataset.delete;
 const row=records.find(r=>r.id===id);if(!row)return;
 if(button.dataset.edit){
   cancelEdit();editingId=id;
   if(!people.some(p=>p.email===row.usuario_email)){
     const option=document.createElement('option');option.value=row.usuario_email;option.textContent=row.usuario_email+' (cadastro inativo)';option.dataset.historical='true';$('#person').append(option);
   }
   $('#person').value=row.usuario_email;
   $('#dayIn').value=row.entrada.slice(0,10);$('#timeIn').value=row.entrada.slice(11,16);
   $('#dayOut').value=row.saida.slice(0,10);$('#timeOut').value=row.saida.slice(11,16);
   $('#breakMinutes').value=row.intervalo_minutos;
   $('#formTitle').textContent='Editar registro de horas';$('#saveHours').textContent='Salvar alterações';$('#cancelEdit').hidden=false;
   preview();$('#hoursForm').scrollIntoView({behavior:'smooth',block:'start'});return;
 }
 if(!confirm('Excluir o registro de '+row.usuario_email+' de '+displayDate(row.entrada)+' até '+displayDate(row.saida)+'? Esta ação não pode ser desfeita.'))return;
 button.disabled=true;
 try{
   const {data,error}=await db.from('mf_horas_registros').delete().eq('id',id).select('id');
   if(error)throw error;if(data?.length!==1)throw Error('Registro não excluído. Confira as permissões ou atualize a página.');
   if(editingId===id)cancelEdit();await load();$('#message').textContent='Registro excluído. Total de horas atualizado.';
 }catch(err){alert('Não foi possível excluir: '+err.message)}finally{button.disabled=false}
};
['start','end','personFilter'].forEach(id=>$('#'+id).addEventListener('change',render));
async function openDirect(){
 try{
 const {data,error}=await db.from('mf_horas_pessoas').select('email,nome,ativo').eq('ativo',true).order('nome');if(error)throw error;people=data;
 const options=people.map(p=>'<option value="'+esc(p.email)+'">'+esc(p.nome)+'</option>').join('');
 $('#person').innerHTML='<option value="">Selecione o nome</option>'+options;
 $('#personFilter').innerHTML='<option value="">Todos</option>'+options;
 const now=new Date(),local=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');$('#dayIn').value=local;$('#dayOut').value=local;
 await load();$('#content').hidden=false;$('#message').textContent=people.length?'Selecione seu nome e registre os horários.':'Nenhuma pessoa ativa. Cadastre as pessoas no Supabase.';
 }catch(err){$('#message').textContent='Não foi possível carregar: '+err.message+'. Execute acesso-direto-horas.sql no novo Supabase.'}
}
await openDirect();

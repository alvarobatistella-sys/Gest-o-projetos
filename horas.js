import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const db=createClient('https://pqhfltldtnmxvowhhkvu.supabase.co','sb_publishable_mkMZ7kF5RxWmaAma-wzWFA_WkiqCDQu');
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let user=null,records=[],people=[];
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
 $('#hoursRows').innerHTML=list.map(r=>{const n=minutesBetween(r.entrada,r.saida,r.intervalo_minutos);total+=n;const p=people.find(x=>x.email===r.usuario_email);return '<tr><td>'+esc(p?.nome||r.usuario_email)+'<div class="sub">'+esc(r.usuario_email)+'</div></td><td>'+displayDate(r.entrada)+'</td><td>'+displayDate(r.saida)+'</td><td>'+r.intervalo_minutos+' min</td><td><b>'+duration(n)+'</b></td><td>'+((r.criado_por===user.id||isAdmin())?'<button class="danger small" data-delete="'+esc(r.id)+'">Excluir</button>':'—')+'</td></tr>'}).join('')||'<tr><td colspan="6">Nenhum registro encontrado.</td></tr>';
 $('#total').textContent='Total: '+duration(total)+' · '+list.length+' registro(s)';
}
async function load(){
 const {data,error}=await db.from('mf_horas_registros').select('*').order('entrada',{ascending:false});if(error)throw error;records=data;render();
}
$('#hoursForm').addEventListener('input',preview);
$('#hoursForm').onsubmit=async e=>{
 e.preventDefault();const button=$('#saveHours');button.disabled=true;
 try{const r=values();minutesBetween(r.entrada,r.saida,r.intervalo_minutos);
 if(records.some(x=>x.usuario_email===$('#person').value&&r.entrada<x.saida&&r.saida>x.entrada))throw Error('Já existe um registro com horário sobreposto para este usuário.');
 const {error}=await db.from('mf_horas_registros').insert({...r,usuario_email:$('#person').value,criado_por:user.id});if(error)throw error;
 $('#message').textContent='Horas salvas.';await load();
 }catch(err){alert('Não foi possível salvar: '+err.message)}finally{button.disabled=false}
};
['start','end','personFilter'].forEach(id=>$('#'+id).addEventListener('change',render));
$('#hoursRows').onclick=async e=>{const button=e.target.closest('[data-delete]');if(!button||!confirm('Excluir este registro de horas?'))return;button.disabled=true;try{const {data,error}=await db.from('mf_horas_registros').delete().eq('id',button.dataset.delete).select('id');if(error)throw error;if(!data.length)throw Error('Registro não excluído. Verifique sua permissão.');await load()}catch(err){alert(err.message)}finally{button.disabled=false}};
$('#sair').onclick=async()=>{await db.auth.signOut();showLogin()};
function showLogin(){user=null;records=[];people=[];$('#content').hidden=true;$('#loginHours').hidden=false;$('#message').textContent='Entre com seu acesso do novo banco de horas.'}
async function enterHours(){
 try{
 const {data:{user:active},error:authError}=await db.auth.getUser();
 if(authError||!active){showLogin();return}
 user=active;const {data:allowed,error:accessError}=await db.rpc('mf_horas_autorizado',{});
 if(accessError)throw accessError;if(!allowed)throw Error('E-mail não autorizado. Peça ao administrador para cadastrar seu acesso.');
 const {data,error}=await db.from('mf_horas_pessoas').select('email,nome,ativo').order('nome');if(error)throw error;people=data;
 const options=people.filter(p=>p.ativo).map(p=>'<option value="'+esc(p.email)+'">'+esc(p.nome)+' — '+esc(p.email)+'</option>').join('');
 $('#person').innerHTML=options;$('#personFilter').innerHTML='<option value="">Todos</option>'+people.map(p=>'<option value="'+esc(p.email)+'">'+esc(p.nome)+'</option>').join('');
 if(people.some(x=>x.email===user.email.toLowerCase()))$('#person').value=user.email.toLowerCase();
 const now=new Date(),local=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');$('#dayIn').value=local;$('#dayOut').value=local;
 await load();$('#loginHours').hidden=true;$('#content').hidden=false;$('#peopleAdmin').hidden=!isAdmin();$('#message').textContent='Conectado: '+user.email;
 $('#peopleList').innerHTML=isAdmin()?people.map(p=>'<p>'+esc(p.nome)+' · '+esc(p.email)+' · '+(p.ativo?'Ativo':'Inativo')+'</p>').join(''):'';
 }catch(err){$('#content').hidden=true;$('#loginHours').hidden=false;$('#message').textContent='Não foi possível carregar: '+err.message+' Se faltar uma tabela ou função, execute configurar-horas-novo.sql neste projeto.'}
}
$('#loginHours').onsubmit=async e=>{e.preventDefault();const {error}=await db.auth.signInWithPassword({email:$('#hoursEmail').value.trim(),password:$('#hoursPassword').value});if(error){$('#message').textContent=error.message;return}await enterHours()};
$('#createHoursAccount').onclick=async()=>{
 if(!$('#hoursEmail').reportValidity()||!$('#hoursPassword').reportValidity())return;
 const {error}=await db.auth.signUp({email:$('#hoursEmail').value.trim(),password:$('#hoursPassword').value,options:{emailRedirectTo:new URL('horas.html',location.href).href}});
 $('#message').textContent=error?error.message:'Cadastro solicitado. Se houver confirmação por e-mail, confirme e depois entre. O administrador precisa autorizar seu endereço.';
};
$('#peopleForm').onsubmit=async e=>{e.preventDefault();const {error}=await db.rpc('mf_horas_cadastrar_pessoa',{p_email:$('#personEmail').value.trim(),p_nome:$('#personName').value.trim(),p_ativo:$('#personActive').checked});if(error){alert(error.message);return}$('#peopleForm').reset();$('#personActive').checked=true;await enterHours()};
db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')showLogin()});
await enterHours();

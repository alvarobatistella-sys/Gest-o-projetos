import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const url = 'https://ezvnnkyovmflawrphjoo.supabase.co';
const publishableKey = 'sb_publishable_M7uuHFZLfmuI02Ug_LlqCA_gIgstxbx';
const db = createClient(url, publishableKey);
const $ = s => document.querySelector(s);
const fields = ['area','line','model','take','filmOwner','filmPlan','filmDoer','filmDone','analysisOwner','analysisPlan','analysisDoer','analysisDone'];
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = v => String(v ?? '').trim().replace(/\s+/g,' ');
const today = () => new Date().toLocaleDateString('en-CA');
const date = v => v ? new Date(v+'T12:00:00').toLocaleDateString('pt-BR') : '—';
const labels = {done:'Concluída',late:'Atrasada',active:'Em andamento',planned:'Planejada'};
let rows=[], editing=null, token=null, version=null, currentUser=null, renewing=null, refreshing=false;
function status(r){
  if(r.filmDone && r.analysisDone) return 'done';
  if((!r.filmDone && r.filmPlan<today()) || (!r.analysisDone && r.analysisPlan<today())) return 'late';
  if(r.filmDone || r.analysisDone) return 'active';
  return 'planned';
}
function step(owner,planned){return '<b>'+esc(owner)+'</b><div class="sub">'+date(planned)+'</div>'}
function actual(doer,done){return '<b>'+esc(doer||'Pendente')+'</b><div class="sub">'+date(done)+'</div>'}
function locked(row){return row.bloqueado_por && new Date(row.bloqueado_ate)>new Date()}
function render(){
  const q=clean($('#search').value).toLocaleLowerCase(), model=$('#modelFilter').value, filter=$('#statusFilter').value;
  const list=rows.filter(x=>{
    const r=x.dados;
    return (!model||r.model===model)&&(!filter||status(r)===filter)&&
      [r.area,r.line,r.model,r.take,r.filmOwner,r.filmDoer,r.analysisOwner,r.analysisDoer].join(' ').toLocaleLowerCase().includes(q);
  });
  $('#cards').innerHTML=[['Tomadas',list.length],['Filmagens realizadas',list.filter(x=>x.dados.filmDone).length],['Análises realizadas',list.filter(x=>x.dados.analysisDone).length],['Atrasadas',list.filter(x=>status(x.dados)==='late').length]].map(([a,b])=>'<div class="card"><strong>'+b+'</strong><span>'+a+'</span></div>').join('');
  $('#dashboard').innerHTML=['HB20','I20','Creta'].map(m=>{const a=list.filter(x=>x.dados.model===m),pct=a.length?Math.round(a.filter(x=>status(x.dados)==='done').length/a.length*100):0;return '<tr><td><b>'+m+'</b></td><td>'+a.length+'</td><td>'+a.filter(x=>x.dados.filmDone).length+'</td><td>'+a.filter(x=>x.dados.analysisDone).length+'</td><td>'+a.filter(x=>status(x.dados)==='late').length+'</td><td>'+pct+'%</td></tr>'}).join('');
  $('#records').innerHTML=list.slice().sort((a,b)=>a.dados.filmPlan.localeCompare(b.dados.filmPlan)).map(x=>{
    const r=x.dados, busy=locked(x);
    return '<tr><td><b>'+esc(r.area)+'</b><div class="sub">'+esc(r.line)+'</div></td><td><b>'+esc(r.model)+'</b><div class="sub">'+esc(r.take)+'</div></td><td>'+step(r.filmOwner,r.filmPlan)+'</td><td>'+actual(r.filmDoer,r.filmDone)+'</td><td>'+step(r.analysisOwner,r.analysisPlan)+'</td><td>'+actual(r.analysisDoer,r.analysisDone)+'</td><td><span class="badge '+status(r)+'">'+labels[status(r)]+'</span>'+(busy?'<div class="sub">Em edição</div>':'')+'</td><td class="actions"><button class="secondary small" data-edit="'+esc(x.id)+'" '+(busy?'disabled title="Em edição por outra pessoa"':'')+'>Editar</button> <button class="danger small" data-delete="'+esc(x.id)+'" '+(busy?'disabled title="Em edição por outra pessoa"':'')+'>Excluir</button></td></tr>';
  }).join('')||'<tr><td colspan="8" class="empty">Nenhuma tomada encontrada. Use “+ Adicionar tomada” para começar.</td></tr>';
}
async function rpc(name,args){
  const {data,error}=await db.rpc('controle_'+name,args);
  if(error) throw error;
  return data;
}
async function refresh(){
  if(!currentUser||refreshing)return;
  refreshing=true;
  try{
    const {data,error}=await db.from('controle_tomadas').select('id,dados,versao,bloqueado_por,bloqueado_ate').order('atualizado_em',{ascending:false});
    if(error)throw error;
    rows=data;
    $('#connectionStatus').textContent='Dados atualizados';
    render();
  }catch(e){$('#connectionStatus').textContent='Sem conexão com a base — alterações indisponíveis';}
  finally{refreshing=false}
}
async function release(){
  clearInterval(renewing);renewing=null;
  if(editing&&token)try{await rpc('liberar',{p_id:editing,p_token:token})}catch(e){}
  editing=null;token=null;version=null;
}
async function close(){$('#editor').close();await release();await refresh()}
function fill(row){
  $('#form').reset();
  $('#dialogTitle').textContent=row?'Editar tomada':'Adicionar tomada';
  if(row)fields.forEach(k=>$('#form').elements[k].value=row.dados[k]||'');
  $('#editor').showModal();
}
async function lock(row){
  const newToken=crypto.randomUUID();
  const ok=await rpc('bloquear',{p_id:row.id,p_token:newToken});
  if(!ok){await refresh();alert('Esta tomada já está aberta para edição em outro computador.');return false}
  editing=row.id;token=newToken;
  // Lê a versão atual depois de obter o bloqueio.
  const {data,error}=await db.from('controle_tomadas').select('id,dados,versao').eq('id',row.id).single();
  if(error){await release();throw error}
  version=data.versao;fill(data);
  renewing=setInterval(async()=>{
    try{
      const stillMine=await rpc('renovar',{p_id:editing,p_token:token});
      if(!stillMine)throw Error('Bloqueio expirado');
    }catch(e){
      clearInterval(renewing);renewing=null;
      $('#editor').close();editing=null;token=null;version=null;
      alert('A reserva de edição foi perdida. Abra a tomada novamente para evitar sobrescrever alterações.');
      refresh();
    }
  },45000);
  await refresh();
  return true;
}
function valid(r){
  if(fields.some(k=>typeof r[k]!=='string')||!['HB20','I20','Creta'].includes(r.model))return false;
  if(['area','line','take','filmOwner','filmPlan','analysisOwner','analysisPlan'].some(k=>!r[k]))return false;
  if((!!r.filmDone)!=(!!r.filmDoer)||(!!r.analysisDone)!=(!!r.analysisDoer))return false;
  if(r.analysisDone&&(!r.filmDone||r.analysisDone<r.filmDone))return false;
  return true;
}
async function enter(){
  const {data:{user}}=await db.auth.getUser();
  if(!user){currentUser=null;$('#loginPanel').hidden=false;$('#app').hidden=true;return}
  const allowed=await rpc('autorizado',{});
  if(!allowed){currentUser=null;$('#loginPanel').hidden=false;$('#app').hidden=true;$('#connectionStatus').textContent='';alert('E-mail não autorizado ou ainda não confirmado. Peça ao responsável para cadastrar seu e-mail no projeto.');return}
  currentUser=user;
  $('#signedIn').textContent=user.email;
  $('#loginPanel').hidden=true;$('#app').hidden=false;
  await refresh();
}
$('#loginForm').onsubmit=async e=>{
  e.preventDefault();
  const {error}=await db.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});
  if(error){alert('Não foi possível entrar: '+error.message);return}
  try{await enter()}catch(err){alert('Falha ao consultar acesso: '+err.message)}
};
$('#signup').onclick=async()=>{
  if(!$('#email').reportValidity()||!$('#password').value){alert('Preencha o e-mail e uma senha antes de criar acesso.');return}
  const {error}=await db.auth.signUp({email:$('#email').value.trim(),password:$('#password').value});
  alert(error?'Não foi possível criar acesso: '+error.message:'Confira o e-mail de confirmação. O responsável também precisa autorizar este endereço no banco.');
};
$('#logout').onclick=async()=>{await closeIfEditing();await db.auth.signOut();currentUser=null;rows=[];render();$('#app').hidden=true;$('#loginPanel').hidden=false};
async function closeIfEditing(){if($('#editor').open)$('#editor').close();await release()}
$('#new').onclick=()=>{editing=null;token=null;version=null;fill(null)};
$('#cancel').onclick=close;
$('#editor').addEventListener('cancel',e=>{e.preventDefault();close()});
$('#form').onsubmit=async e=>{
  e.preventDefault();
  const dados=Object.fromEntries(fields.map(k=>[k,clean($('#form').elements[k].value)]));
  if(!valid(dados)){alert('Confira responsáveis e datas realizadas. A análise deve acontecer após a filmagem.');return}
  try{
    const ok=editing?await rpc('salvar',{p_id:editing,p_token:token,p_versao:version,p_dados:dados}):await rpc('criar',{p_dados:dados});
    if(ok===false){alert('O bloqueio expirou ou esta tomada mudou. Reabra a tomada antes de salvar.');return}
    // A função salvar libera a reserva no banco.
    token=null;editing=null;clearInterval(renewing);renewing=null;$('#editor').close();await refresh();
  }catch(err){alert('Não foi possível salvar: '+err.message)}
};
$('#records').onclick=async e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  const row=rows.find(x=>x.id===(b.dataset.edit||b.dataset.delete));if(!row)return;
  try{
    if(b.dataset.edit){await lock(row);return}
    if(!confirm('Excluir a tomada “'+row.dados.take+'” e suas etapas?'))return;
    const t=crypto.randomUUID();
    if(!await rpc('bloquear',{p_id:row.id,p_token:t})){alert('Esta tomada está em edição.');await refresh();return}
    const ok=await rpc('excluir',{p_id:row.id,p_token:t,p_versao:row.versao});
    if(!ok){await rpc('liberar',{p_id:row.id,p_token:t});alert('A tomada foi alterada. Atualize e tente novamente.')}
    await refresh();
  }catch(err){alert('Operação não concluída: '+err.message);await refresh()}
};
['search','modelFilter','statusFilter'].forEach(k=>$('#'+k).addEventListener(k==='search'?'input':'change',render));
$('#export').onclick=()=>{
  const data={version:2,rows:rows.map(x=>({...x.dados,id:x.id}))};
  const link=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=link;a.download='backup-tomadas-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(link),1000);
};
setInterval(refresh,10000);
try{await enter()}catch(err){$('#loginPanel').hidden=false;$('#app').hidden=true;alert('A base ainda não está preparada ou a conexão falhou. Execute o arquivo SQL no projeto Supabase.')}

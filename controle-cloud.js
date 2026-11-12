import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const url = 'https://ezvnnkyovmflawrphjoo.supabase.co';
const publishableKey = 'sb_publishable_M7uuHFZLfmuI02Ug_LlqCA_gIgstxbx';
const db = createClient(url, publishableKey);
const $ = s => document.querySelector(s);
const fields = ['area','line','model','shift','take','filmOwner','filmPlan','filmDoer','filmDone','analysisOwner','analysisPlan','analysisDoer','analysisDone'];
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const takeName = v => String(v ?? '').replace(/(?:\s*[—–-]\s*cópia)+\s*$/iu,'').trim();
const compareText = (a,b) => String(a ?? '').localeCompare(String(b ?? ''),'pt-BR',{numeric:true,sensitivity:'base'});
const clean = v => String(v ?? '').trim().replace(/\s+/g,' ');
const today = () => new Date().toLocaleDateString('en-CA');
const date = v => v ? new Date(v+'T12:00:00').toLocaleDateString('pt-BR') : '—';
const labels = {done:'Concluída',late:'Atrasada',active:'Em andamento',planned:'Planejada'};
let rows=[], editing=null, token=null, version=null, currentUser=null, renewing=null, refreshing=false;
const adminEmail='alvaro.batistella@method-flow.com';
const siteUrl='https://alvarobatistella-sys.github.io/Gest-o-projetos/';
const authLinkError=new URLSearchParams(location.hash.slice(1)).get('error_description');
if(authLinkError){
  history.replaceState(null,'',location.pathname+location.search);
  setTimeout(()=>alert('O link de acesso é inválido ou expirou. Solicite um novo em “Esqueci a senha” ou “Reenviar acesso” e use somente o link mais recente.'),0);
}
let recoveryMode=location.hash.includes('type=recovery');
function showRecovery(){
  recoveryMode=true;
  $('#loginPanel').hidden=true;$('#app').hidden=true;$('#recoveryPanel').hidden=false;
}
db.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')showRecovery()});
if(recoveryMode)showRecovery();
function status(r){
  if(r.filmDone && r.analysisDone) return 'done';
  if((!r.filmDone && r.filmPlan<today()) || (!r.analysisDone && r.analysisPlan<today())) return 'late';
  if(r.filmDone || r.analysisDone) return 'active';
  return 'planned';
}
function step(owner,planned){return '<b>'+esc(owner)+'</b><div class="sub">'+date(planned)+'</div>'}
function actual(doer,done){return '<b>'+esc(doer||'Pendente')+'</b><div class="sub">'+date(done)+'</div>'}
function locked(row){return row.bloqueado_por && new Date(row.bloqueado_ate)>new Date()}
function refreshPlanningOptions(id,values,label){
  const select=$('#'+id),chosen=select.value;
  const options=[...new Set(values.filter(Boolean))].sort(compareText);
  select.innerHTML='<option value="">'+label+'</option>'+options.map(value=>'<option value="'+esc(value)+'">'+esc(value)+'</option>').join('');
  select.value=options.includes(chosen)?chosen:'';
}
function matchesPlanning(r,f){
  return (!f.area||r.area===f.area)&&(!f.shift||r.shift===f.shift)&&(!f.take||takeName(r.take)===f.take)&&(!f.person||[r.filmOwner,r.filmDoer,r.analysisOwner,r.analysisDoer].includes(f.person));
}
function matchesStageStatus(r,stage,filter){
  if(!stage&&!filter) return true;
  const stages=stage?[stage]:['film','analysis'];
  if(filter==='active') return Boolean(r.filmDone)!==Boolean(r.analysisDone);
  if(filter==='done') return Boolean(r.filmDone&&r.analysisDone);
  return stages.some(key=>{
    const plan=r[key+'Plan'],done=r[key+'Done'];
    if(filter==='late') return Boolean(plan&&!done&&plan<today());
    if(filter==='planned') return Boolean(plan&&!done);
    if(filter==='realized') return Boolean(done);
    return Boolean(plan||done);
  });
}
let selectedIds=new Set(),visibleIds=[],bulkRunning=false;
function render(){
  refreshPlanningOptions('areaFilter',rows.map(x=>x.dados.area),'Todas as áreas');
  refreshPlanningOptions('personFilter',rows.flatMap(x=>[x.dados.filmOwner,x.dados.filmDoer,x.dados.analysisOwner,x.dados.analysisDoer]),'Todas as pessoas');
  refreshPlanningOptions('takeFilter',rows.map(x=>takeName(x.dados.take)),'Todos os postos / tomadas');
  const extra={area:$('#areaFilter').value,shift:$('#shiftFilter').value,person:$('#personFilter').value,take:$('#takeFilter').value};
  const q=clean($('#search').value).toLocaleLowerCase(), model=$('#modelFilter').value, filter=$('#statusFilter').value;
  const list=rows.filter(x=>{
    const r=x.dados;
    return matchesPlanning(r,extra)&&(!model||r.model===model)&&matchesStageStatus(r,$('#stageFilter').value,filter)&&
      [r.area,r.line,r.model,r.shift,r.take,r.filmOwner,r.filmDoer,r.analysisOwner,r.analysisDoer].join(' ').toLocaleLowerCase().includes(q);
  });
  visibleIds=list.map(x=>x.id);
  selectedIds=new Set([...selectedIds].filter(id=>visibleIds.includes(id)));
  updateBulkSelection();
  $('#planningCount').textContent=list.length+' de '+rows.length+' tomada(s) encontrada(s).';
  $('#cards').innerHTML=[['Tomadas',list.length],['Filmagens realizadas',list.filter(x=>x.dados.filmDone).length],['Análises realizadas',list.filter(x=>x.dados.analysisDone).length],['Atrasadas',list.filter(x=>status(x.dados)==='late').length]].map(([a,b])=>'<div class="card"><strong>'+b+'</strong><span>'+a+'</span></div>').join('');
  $('#dashboard').innerHTML=['HB20','I20','Creta'].map(m=>{const a=list.filter(x=>x.dados.model===m),pct=a.length?Math.round(a.filter(x=>status(x.dados)==='done').length/a.length*100):0;return '<tr><td><b>'+m+'</b></td><td>'+a.length+'</td><td>'+a.filter(x=>x.dados.filmDone).length+'</td><td>'+a.filter(x=>x.dados.analysisDone).length+'</td><td>'+a.filter(x=>status(x.dados)==='late').length+'</td><td>'+pct+'%</td></tr>'}).join('');
  $('#records').innerHTML=list.slice().sort((a,b)=>compareText(a.dados.area,b.dados.area)||compareText(a.dados.line,b.dados.line)||compareText(takeName(a.dados.take),takeName(b.dados.take))||compareText(a.dados.model,b.dados.model)||compareText(a.dados.shift,b.dados.shift)||compareText(a.dados.filmPlan,b.dados.filmPlan)||compareText(a.id,b.id)).map(x=>{
    const r=x.dados, busy=locked(x);
    return '<tr><td><input type="checkbox" data-select="'+esc(x.id)+'" aria-label="Selecionar '+esc(takeName(r.take))+'" '+(selectedIds.has(x.id)?'checked':'')+'></td><td><b>'+esc(r.area)+'</b><div class="sub">'+esc(r.line)+'</div></td><td><b>'+esc(r.model)+'</b><div class="sub">'+esc(takeName(r.take))+'</div></td><td>'+esc(r.shift||'—')+'</td><td>'+step(r.filmOwner,r.filmPlan)+'</td><td>'+actual(r.filmDoer,r.filmDone)+'</td><td>'+step(r.analysisOwner,r.analysisPlan)+'</td><td>'+actual(r.analysisDoer,r.analysisDone)+'</td><td><span class="badge '+status(r)+'">'+labels[status(r)]+'</span>'+(busy?'<div class="sub">Em edição</div>':'')+'</td><td class="actions"><button class="secondary small" data-edit="'+esc(x.id)+'" '+(busy?'disabled title="Em edição por outra pessoa"':'')+'>Editar</button> <button class="secondary small" data-duplicate="'+esc(x.id)+'">Duplicar</button> <button class="danger small" data-delete="'+esc(x.id)+'" '+(busy?'disabled title="Em edição por outra pessoa"':'')+'>Excluir</button></td></tr>';
  }).join('')||'<tr><td colspan="10" class="empty">Nenhuma tomada encontrada. Use “+ Adicionar tomada” para começar.</td></tr>';
}
async function rpc(name,args){
  const {data,error}=await db.rpc('controle_'+name,args);
  if(error) throw error;
  return data;
}
async function loadAllTomadas(){
 const all=[];let offset=0,total=null;
 while(total===null||offset<total){
  const {data,error,count}=await db.from('controle_tomadas')
   .select('id,dados,versao,bloqueado_por,bloqueado_ate',{count:'exact'})
   .order('id',{ascending:true}).range(offset,offset+499);
  if(error)throw error;
  if(count!==null&&count!==undefined)total=count;
  if(!data?.length){if(total!==null&&offset<total)throw Error('Carregamento incompleto. Atualize novamente.');break;}
  all.push(...data);offset+=data.length;
  $('#connectionStatus').textContent='Carregando '+offset+(total!==null?' de '+total:'')+' tomadas…';
  if(total===null&&data.length<500)break;
 }
 return [...new Map(all.map(row=>[row.id,row])).values()];
}
async function refresh(){
  if(!currentUser||refreshing)return;
  refreshing=true;
  try{
    rows=await loadAllTomadas();
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
  if(row)fields.forEach(k=>$('#form').elements[k].value=(k==='take'?takeName(row.dados[k]):row.dados[k])||'');
  $('#replaceFrom').value=$('#form').elements.take.value;
  $('#replaceTo').value=$('#form').elements.take.value;
  previewReplacement();
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
  if(!['','1T','2T','3T'].includes(r.shift))return false;
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
  $('#adminPanel').hidden=user.email?.toLowerCase()!==adminEmail;
  if(!$('#adminPanel').hidden)await loadUsers();
  await refresh();
}
async function loadUsers(){
  const users=await rpc('listar_usuarios',{});
  $('#hoursSyncStatus').textContent='Nomes do controle de horas vinculados aos usuários deste planejamento.';

  $('#users').innerHTML=users.map(u=>'<tr><td>'+esc(u.nome)+'</td><td>'+esc(u.email)+'</td><td>'+(u.confirmado?'E-mail confirmado':'Aguardando confirmação')+'</td><td>'+(u.email.toLowerCase()===adminEmail?'Administrador':'<button class="secondary small" data-resend="'+esc(u.email)+'" data-confirmed="'+u.confirmado+'">Reenviar acesso</button> <button class="danger small" data-remove="'+esc(u.email)+'">Remover acesso</button>')+'</td></tr>').join('');
}
$('#userForm').onsubmit=async e=>{
  e.preventDefault();
  const b=$('#userForm button');b.disabled=true;
  try{
    await rpc('adicionar_usuario',{p_email:$('#userEmail').value.trim(),p_nome:$('#userName').value.trim()});
    $('#userForm').reset();await loadUsers();
    alert('E-mail autorizado. Envie o endereço do site à pessoa para ela clicar em “Criar acesso” e escolher a própria senha.');
  }catch(err){alert('Não foi possível autorizar: '+err.message)}
  finally{b.disabled=false}
};
$('#users').onclick=async e=>{
  const button=e.target.closest('button');
  if(button?.dataset.resend){
    const email=button.dataset.resend;
    button.disabled=true;
    try{
      const result=button.dataset.confirmed==='true'
        ?await db.auth.resetPasswordForEmail(email,{redirectTo:siteUrl})
        :await db.auth.resend({type:'signup',email,options:{emailRedirectTo:siteUrl}});
      if(result.error)throw result.error;
      alert(button.dataset.confirmed==='true'
        ?'Solicitação aceita para '+email+'. Confira a caixa de entrada e spam. Se não chegar, o administrador precisa verificar SMTP e logs de autenticação no Supabase.'
        :'Solicitação de reenvio feita para '+email+'. Se a pessoa ainda não clicou em “Criar acesso”, ela deve fazer isso primeiro.');
    }catch(err){alert('Não foi possível reenviar: '+err.message)}
    finally{button.disabled=false}
    return;
  }
  const email=button?.dataset.remove;
  if(!email||!confirm('Remover o acesso de '+email+'?'))return;
  try{await rpc('remover_usuario',{p_email:email});await loadUsers()}
  catch(err){alert('Não foi possível remover: '+err.message)}
};
$('#loginForm').onsubmit=async e=>{
  e.preventDefault();
  const {error}=await db.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});
  if(error){alert('Não foi possível entrar: '+error.message);return}
  try{await enter()}catch(err){alert('Falha ao consultar acesso: '+err.message)}
};
$('#signup').onclick=async()=>{
  if(!$('#email').reportValidity()||!$('#password').value){alert('Preencha o e-mail e uma senha antes de criar acesso.');return}
  const {error}=await db.auth.signUp({email:$('#email').value.trim(),password:$('#password').value,options:{emailRedirectTo:siteUrl}});
  alert(error?'Não foi possível criar acesso: '+error.message:'Confira o e-mail de confirmação. O responsável também precisa autorizar este endereço no banco.');
};
$('#forgot').onclick=async()=>{
  if(!$('#email').reportValidity())return;
  const {error}=await db.auth.resetPasswordForEmail($('#email').value.trim(),{redirectTo:siteUrl});
  alert(error?'Não foi possível solicitar: '+error.message:'Se este e-mail possui cadastro, uma mensagem para escolher nova senha será enviada.');
};
$('#recoveryForm').onsubmit=async e=>{
  e.preventDefault();
  const button=$('#recoveryForm button');button.disabled=true;
  try{
    const {error}=await db.auth.updateUser({password:$('#newPassword').value});
    if(error)throw error;
    alert('Senha atualizada. Entre com seu e-mail e a nova senha.');
    await db.auth.signOut();
    recoveryMode=false;history.replaceState(null,'',siteUrl);
    $('#recoveryPanel').hidden=true;$('#loginPanel').hidden=false;
  }catch(err){alert('Não foi possível atualizar a senha: '+err.message)}
  finally{button.disabled=false}
};
$('#logout').onclick=async()=>{await closeIfEditing();await db.auth.signOut();currentUser=null;rows=[];render();$('#app').hidden=true;$('#adminPanel').hidden=true;$('#loginPanel').hidden=false};
async function closeIfEditing(){if($('#editor').open)$('#editor').close();await release()}
$('#new').onclick=()=>{editing=null;token=null;version=null;fill(null)};
$('#cancel').onclick=close;
$('#editor').addEventListener('cancel',e=>{e.preventDefault();close()});
$('#form').onsubmit=async e=>{
  e.preventDefault();
  const dados=Object.fromEntries(fields.map(k=>[k,clean($('#form').elements[k].value)]));
  if(!valid(dados)){alert('Confira responsáveis e datas realizadas. A análise deve acontecer após a filmagem.');return}
  try{
    if(!editing){
      const existing=await loadAllTomadas();
      if(existing.some(x=>duplicateKey(x.dados)===duplicateKey(dados)))throw Error('Já existe uma tomada com a mesma área, linha, nome, modelo e turno. Altere esses campos para criar uma nova. Mudar somente as datas não permite duplicar.');
    }
    const ok=editing?await rpc('salvar',{p_id:editing,p_token:token,p_versao:version,p_dados:dados}):await rpc('criar',{p_dados:dados});
    if(ok===false){alert('O bloqueio expirou ou esta tomada mudou. Reabra a tomada antes de salvar.');return}
    // A função salvar libera a reserva no banco.
    token=null;editing=null;clearInterval(renewing);renewing=null;$('#editor').close();await refresh();
  }catch(err){alert('Não foi possível salvar: '+err.message)}
};
$('#records').onclick=async e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  const row=rows.find(x=>x.id===(b.dataset.edit||b.dataset.duplicate||b.dataset.delete));if(!row)return;
  try{
    if(b.dataset.duplicate){
      editing=null;token=null;version=null;
      const dados={...row.dados,take:takeName(row.dados.take),filmDoer:'',filmDone:'',analysisDoer:'',analysisDone:''};
      fill({dados});
      $('#dialogTitle').textContent='Duplicar tomada';
      $('#form').elements.take.focus();
      $('#form').elements.take.select();
      return;
    }
    if(b.dataset.edit){await lock(row);return}
    if(!confirm('Excluir a tomada “'+row.dados.take+'” e suas etapas?'))return;
    const t=crypto.randomUUID();
    if(!await rpc('bloquear',{p_id:row.id,p_token:t})){alert('Esta tomada está em edição.');await refresh();return}
    const ok=await rpc('excluir',{p_id:row.id,p_token:t,p_versao:row.versao});
    if(!ok){await rpc('liberar',{p_id:row.id,p_token:t});alert('A tomada foi alterada. Atualize e tente novamente.')}
    await refresh();
  }catch(err){alert('Operação não concluída: '+err.message);await refresh()}
};
['search','modelFilter','statusFilter','stageFilter','areaFilter','shiftFilter','personFilter','takeFilter'].forEach(k=>$('#'+k).addEventListener(k==='search'?'input':'change',render));
$('#export').onclick=()=>{
  const data={version:2,rows:rows.map(x=>({...x.dados,id:x.id}))};
  const link=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=link;a.download='backup-tomadas-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(link),1000);
};
setInterval(refresh,10000);
try{if(!recoveryMode)await enter()}catch(err){$('#loginPanel').hidden=false;$('#app').hidden=true;alert('A base ainda não está preparada ou a conexão falhou. Execute o arquivo SQL no projeto Supabase.')}



$('#clearPlanningFilters').onclick=()=>{['search','modelFilter','statusFilter','stageFilter','areaFilter','shiftFilter','personFilter','takeFilter'].forEach(id=>$('#'+id).value='');render()};

function replacementChanges(form,from,to,target){
  if(!from)return [];
  const names=target==='all'?['area','line','take']:target==='both'?['line','take']:[target];
  return names.map(name=>({name,before:form.elements[name].value,after:form.elements[name].value.split(from).join(to)})).filter(x=>x.before!==x.after);
}
function previewReplacement(){
  const from=$('#replaceFrom').value,to=$('#replaceTo').value;
  const changes=replacementChanges($('#form'),from,to,$('#replaceTarget').value);
  $('#applyReplace').disabled=!changes.length;
  $('#replacePreview').textContent=!from?'Informe o trecho a substituir. Ex.: 4L por 7L.':changes.length?changes.map(x=>({area:'Área de trabalho: ',line:'Linha: ',take:'Tomada: '}[x.name])+x.before+' → '+(x.after||'(vazio)')).join(' | '):'Nenhuma ocorrência encontrada nos campos selecionados.';
}
['replaceFrom','replaceTo','replaceTarget'].forEach(id=>$('#'+id).addEventListener('input',previewReplacement));
$('#form').elements.line.addEventListener('input',previewReplacement);
$('#form').elements.area.addEventListener('input',previewReplacement);
$('#form').elements.take.addEventListener('input',()=>{
  $('#replaceFrom').value=$('#form').elements.take.value;
  $('#replaceTo').value=$('#form').elements.take.value;
  previewReplacement();
});
$('#applyReplace').onclick=()=>{
  const changes=replacementChanges($('#form'),$('#replaceFrom').value,$('#replaceTo').value,$('#replaceTarget').value);
  changes.forEach(x=>$('#form').elements[x.name].value=x.after);
  previewReplacement();
  $('#replacePreview').textContent=changes.length?'Substituição aplicada no formulário. Clique em Salvar tomada para gravar.':'Nenhuma alteração aplicada.';
};

function updateBulkSelection(){
 const all=$('#selectAllRows'),count=visibleIds.filter(id=>selectedIds.has(id)).length;
 all.checked=visibleIds.length>0&&count===visibleIds.length;
 all.indeterminate=count>0&&count<visibleIds.length;
 all.disabled=!visibleIds.length||bulkRunning;

 $('#bulkCount').textContent=selectedIds.size+' selecionada(s)';
 $('#openBulk').disabled=!selectedIds.size||bulkRunning;
 $('#openDuplicateBulk').disabled=!selectedIds.size||bulkRunning;
}
$('#records').addEventListener('change',e=>{
 const id=e.target.dataset.select;if(!id)return;
 if(e.target.checked)selectedIds.add(id);else selectedIds.delete(id);updateBulkSelection();
});
$('#selectFiltered').onclick=()=>{selectedIds=new Set(visibleIds);render()};
$('#clearSelected').onclick=()=>{selectedIds.clear();render()};
let bulkIds=[];
function bulkPatch(){
 const patch={};
 document.querySelectorAll('[data-bulk-enable]:checked').forEach(c=>{
  const key=c.dataset.bulkEnable,value=$('#bulk_'+key).value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Preencha a data de todos os campos marcados.');
  patch[key]=value;
  if(key==='filmDone'||key==='analysisDone'){
   const doer=key==='filmDone'?'filmDoer':'analysisDoer';
   patch[doer]=clean($('#bulk_'+doer).value);
   if(!patch[doer])throw Error('Informe quem realizou a etapa marcada.');
  }
 });
 if(!Object.keys(patch).length)throw Error('Marque ao menos uma data para atualizar.');
 return patch;
}
$('#bulkForm').noValidate=true;
$('#bulkForm').addEventListener('change',e=>{
 const key=e.target.dataset.bulkEnable;if(key){$('#bulk_'+key).disabled=!e.target.checked;$('#bulk_'+key).required=e.target.checked;}
});
$('#openBulk').onclick=()=>{
 bulkIds=[...selectedIds];$('#bulkForm').reset();$('#bulkSave').disabled=false;
 document.querySelectorAll('[data-bulk-enable]').forEach(c=>{$('#bulk_'+c.dataset.bulkEnable).disabled=true;$('#bulk_'+c.dataset.bulkEnable).required=false;});
 $('#bulkSummary').textContent=bulkIds.length+' tomada(s) selecionada(s). Confira a lista antes de confirmar:';
 $('#bulkPreview').innerHTML=bulkIds.map(id=>{const r=rows.find(x=>x.id===id)?.dados;return '<div>'+esc([r?.model,r?.area,r?.take,r?.shift].filter(Boolean).join(' · '))+'</div>'}).join('');
 $('#bulkResult').textContent='';$('#bulkEditor').showModal();
};
$('#bulkCancel').onclick=()=>{if(!bulkRunning)$('#bulkEditor').close()};
$('#bulkEditor').addEventListener('cancel',e=>{if(bulkRunning)e.preventDefault()});
async function saveBulkRow(id,patch){
 const batchToken=crypto.randomUUID();let acquired=false;
 try{
  acquired=await rpc('bloquear',{p_id:id,p_token:batchToken});
  if(!acquired)throw Error('Em edição por outra pessoa.');
  const {data,error}=await db.from('controle_tomadas').select('id,dados,versao').eq('id',id).single();
  if(error)throw error;
  const base={...data.dados};
  fields.forEach(k=>{base[k]=String(base[k]??'')});
  const dados={...base,...patch};
  if(!valid(dados)){
   const missing=['area','line','take','filmOwner','filmPlan','analysisOwner','analysisPlan'].filter(k=>!dados[k]);
   if(missing.length)throw Error('Cadastro original incompleto: '+missing.join(', ')+'. Abra Editar e complete os campos.');
   if(dados.analysisDone&&(!dados.filmDone||dados.analysisDone<dados.filmDone))throw Error('A análise já realizada ('+date(dados.analysisDone)+') não pode ficar antes da filmagem realizada ('+date(dados.filmDone)+').');
   throw Error('Confira turno e os pares de data/responsável realizados no cadastro original.');
  }
  const ok=await rpc('salvar',{p_id:id,p_token:batchToken,p_versao:data.versao,p_dados:dados});
  if(ok===false)throw Error('A versão mudou ou o bloqueio expirou.');
  const check=await db.from('controle_tomadas').select('dados').eq('id',id).single();
  if(check.error)throw check.error;
  if(Object.entries(patch).some(([key,value])=>check.data.dados[key]!==value))throw Error('O banco não confirmou os novos valores. Atualize a página e tente novamente.');
 }finally{
  if(acquired)try{await rpc('liberar',{p_id:id,p_token:batchToken})}catch(e){}
 }
}
$('#bulkForm').onsubmit=async e=>{
 e.preventDefault();if(bulkRunning)return;
 let patch;try{patch=bulkPatch()}catch(err){$('#bulkResult').textContent=err.message;alert(err.message);return}
 const names={filmPlan:'Filmagem prevista',filmDone:'Filmagem realizada',analysisPlan:'Análise prevista',analysisDone:'Análise realizada',filmDoer:'Realizou filmagem',analysisDoer:'Realizou análise'};
 const detail=Object.entries(patch).map(([k,v])=>names[k]+': '+(k.endsWith('Doer')?v:date(v))).join('\n');
 if(!confirm('Atualizar '+bulkIds.length+' tomada(s)?\n\n'+detail+'\n\nDatas já preenchidas nos campos marcados serão substituídas.'))return;
 bulkRunning=true;$('#bulkSave').disabled=true;$('#bulkCancel').disabled=true;
 const failures=[];let done=0;
 try{
  for(const id of bulkIds){
   $('#bulkResult').textContent='Processando '+(done+failures.length+1)+' de '+bulkIds.length+'…';
   try{await saveBulkRow(id,patch);done++;selectedIds.delete(id)}
   catch(err){const r=rows.find(x=>x.id===id)?.dados;failures.push((r?.take||id)+': '+err.message)}
  }
  $('#bulkResult').textContent=done+' atualizada(s). '+failures.length+' não atualizada(s).';
  $('#bulkPreview').textContent=failures.length?failures.join('\n'):'Todas as tomadas selecionadas foram atualizadas.';
  $('#bulkPreview').style.whiteSpace='pre-wrap';
  $('#bulkResult').scrollIntoView({block:'nearest'});
  bulkIds=failures.length?bulkIds.filter(id=>selectedIds.has(id)):[];
  await refresh();
 }finally{
  bulkRunning=false;$('#bulkSave').disabled=!bulkIds.length;$('#bulkCancel').disabled=false;updateBulkSelection();
 }
};

let duplicateBulkIds=[];
function duplicateData(source,shift,filmPlan,analysisPlan,model="",take=""){
 const data={...source,model:model||source.model,shift:shift||source.shift,filmPlan:filmPlan||source.filmPlan,analysisPlan:analysisPlan||source.analysisPlan,take:takeName(clean(take)||source.take),line:clean(take)?takeName(clean(take)):source.line};
 fields.forEach(k=>{if(data[k]==null)data[k]=''});
 if(!valid(data))throw Error('Campos obrigatórios incompletos na tomada original.');
 return data;
}
function duplicateKey(r){return JSON.stringify([r.area,r.line,r.model,takeName(r.take),r.shift].map(v=>clean(v).toLocaleLowerCase('pt-BR')))}
$('#openDuplicateBulk').onclick=()=>{
 duplicateBulkIds=[...selectedIds];$('#duplicateBulkForm').reset();$('#duplicateBulkSave').disabled=false;
 $('#duplicateBulkCount').textContent=duplicateBulkIds.length+' tomada(s) selecionada(s).';
 $('#duplicateBulkPreview').textContent=duplicateBulkIds.map(id=>{const r=rows.find(x=>x.id===id)?.dados;return [r?.model,r?.area,r?.take,'Turno '+(r?.shift||'—')].join(' · ')}).join('\n');
 $('#duplicateBulkResult').textContent='';$('#duplicateBulkEditor').showModal();
};
$('#duplicateBulkCancel').onclick=()=>{if(!bulkRunning)$('#duplicateBulkEditor').close()};
$('#duplicateBulkEditor').addEventListener('cancel',e=>{if(bulkRunning)e.preventDefault()});
$('#duplicateBulkForm').onsubmit=async e=>{
 e.preventDefault();if(bulkRunning||!duplicateBulkIds.length)return;
 const model=$('#dupModel').value,take=clean($('#dupTake').value);
 if(model&&!['Creta','HB20','I20'].includes(model))return;
 const shift=$('#dupShift').value,filmPlan=$('#dupFilmPlan').value,analysisPlan=$('#dupAnalysisPlan').value;
 if(!['','1T','2T','3T'].includes(shift)||(filmPlan&&!/^\d{4}-\d{2}-\d{2}$/.test(filmPlan))||(analysisPlan&&!/^\d{4}-\d{2}-\d{2}$/.test(analysisPlan)))return;
 if(!confirm('Criar até '+duplicateBulkIds.length+' novas tomadas?\nModelo: '+(model||'Manter original')+'\nTurno: '+(shift||'Manter turno de cada original')+'\nPosto / tomada: '+(take||'Manter original')+'\nFilmagem prevista: '+(filmPlan?date(filmPlan):'Manter original')+'\nAnálise prevista: '+(analysisPlan?date(analysisPlan):'Manter original')+'\n\nAs originais serão preservadas. Datas e responsáveis realizados serão mantidos como no original. Tomadas com a mesma área, linha, nome, modelo e turno serão ignoradas, mesmo com datas diferentes.'))return;
 bulkRunning=true;updateBulkSelection();$('#duplicateBulkSave').disabled=true;$('#duplicateBulkCancel').disabled=true;
 let created=0,skipped=0;const issues=[];
 try{
  await refresh();const known=new Set(rows.map(x=>duplicateKey(x.dados)));
  for(let i=0;i<duplicateBulkIds.length;i++){
   const id=duplicateBulkIds[i];$('#duplicateBulkResult').textContent='Duplicando '+(i+1)+' de '+duplicateBulkIds.length+'…';
   try{
    const {data,error}=await db.from('controle_tomadas').select('id,dados').eq('id',id).single();if(error)throw error;
    const dados=duplicateData(data.dados,shift,filmPlan,analysisPlan,model,take),key=duplicateKey(dados);
    if(known.has(key)){skipped++;continue;}
    const result=await rpc('criar',{p_dados:dados});if(!result)throw Error('Não foi possível confirmar a criação.');
    known.add(key);created++;
   }catch(err){const r=rows.find(x=>x.id===id)?.dados;issues.push((r?.take||id)+': '+err.message)}
  }
  $('#duplicateBulkResult').textContent=created+' criada(s), '+skipped+' combinação(ões) já existente(s), '+issues.length+' falha(s).';
  $('#duplicateBulkPreview').textContent=issues.length?issues.join('\n')+'\nEm caso de falha de conexão, confira a lista antes de tentar novamente.':'Concluído. Use os filtros do novo turno para localizar as novas tomadas.';
  duplicateBulkIds=[];await refresh();
 }finally{bulkRunning=false;$('#duplicateBulkCancel').disabled=false;updateBulkSelection()}
};

$('#selectAllRows').onchange=e=>{selectedIds=e.target.checked?new Set(visibleIds):new Set();render()};

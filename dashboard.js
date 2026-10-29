import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const url = 'https://ezvnnkyovmflawrphjoo.supabase.co';
const publishableKey = 'sb_publishable_M7uuHFZLfmuI02Ug_LlqCA_gIgstxbx';
const db = createClient(url, publishableKey);
const $ = s => document.querySelector(s);
const fields = ['area','line','model','shift','take','filmOwner','filmPlan','filmDoer','filmDone','analysisOwner','analysisPlan','analysisDoer','analysisDone'];
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = v => String(v ?? '').trim().replace(/\s+/g,' ');
const today = () => new Date().toLocaleDateString('en-CA');
const date = v => v ? new Date(v+'T12:00:00').toLocaleDateString('pt-BR') : '—';
const labels = {done:'Concluída',late:'Atrasada',active:'Em andamento',planned:'Planejada'};
let rows=[];
function status(r){
  if(r.filmDone && r.analysisDone) return 'done';
  if((!r.filmDone && r.filmPlan<today()) || (!r.analysisDone && r.analysisPlan<today())) return 'late';
  if(r.filmDone || r.analysisDone) return 'active';
  return 'planned';
}
function analyticsData(data,filters){
  const inPeriod=v=>!!v&&(!filters.start||v>=filters.start)&&(!filters.end||v<=filters.end);
  const selected=data.map(x=>x.dados).filter(r=>
    (!filters.model||r.model===filters.model)&&(!filters.area||r.area===filters.area)&&(!filters.shift||r.shift===filters.shift)&&
    (!filters.status||(filters.status==='realized'?!!(r.filmDone||r.analysisDone):filters.status==='active'?!!(r.filmDone||r.analysisDone)&&!(r.filmDone&&r.analysisDone):status(r)===filters.status)));
  const relevant=selected.filter(r=>['filmPlan','analysisPlan','filmDone','analysisDone'].some(k=>inPeriod(r[k])));
  const count=(items,k)=>items.filter(r=>inPeriod(r[k])).length;
  const counts=items=>({filmPlan:count(items,'filmPlan'),filmDone:count(items,'filmDone'),analysisPlan:count(items,'analysisPlan'),analysisDone:count(items,'analysisDone')});
  return {relevant,counts:counts(relevant),count,countsFor:counts,inPeriod};
}
function dashBars(items){
  const max=Math.max(1,...items.map(x=>x[1]));
  return items.map(([label,n,color=''])=>'<div class="dash-bar"><span>'+esc(label)+'</span><div class="dash-track"><div class="dash-fill '+color+'" style="width:'+(n/max*100)+'%"></div></div><b>'+n+'</b></div>').join('');
}
function renderAnalytics(){
  const area=$('#dashArea'), chosen=area.value;
  const areas=[...new Set(rows.map(x=>x.dados.area).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  area.innerHTML='<option value="">Todas as áreas</option>'+areas.map(a=>'<option value="'+esc(a)+'">'+esc(a)+'</option>').join('');
  area.value=areas.includes(chosen)?chosen:'';
  const f={start:$('#dashStart').value,end:$('#dashEnd').value,model:$('#dashModel').value,area:area.value,status:$('#dashStatus').value,shift:$('#dashShift').value};
  if(f.start&&f.end&&f.start>f.end){
    $('#dashMessage').textContent='A data final deve ser igual ou posterior à data inicial.';
    ['dashCards','dashCompare','dashSituations','dashModels','dashTimeline'].forEach(id=>$('#'+id).innerHTML='');return;
  }
  const d=analyticsData(rows,f),c=d.counts;
  $('#dashMessage').textContent=d.relevant.length?d.relevant.length+' tomada(s) com etapas no período selecionado.':'Nenhuma etapa encontrada para os filtros selecionados.';
  $('#dashCards').innerHTML=[['Filmagens planejadas',c.filmPlan],['Filmagens realizadas',c.filmDone],['Análises planejadas',c.analysisPlan],['Análises realizadas',c.analysisDone]].map(([label,n])=>'<div class="card"><strong>'+n+'</strong><span>'+label+'</span></div>').join('');
  const compare=c=>[['Filmagem · planejado',c.filmPlan],['Filmagem · realizado',c.filmDone,'actual'],['Análise · planejado',c.analysisPlan],['Análise · realizado',c.analysisDone,'actual']];
  $('#dashCompare').innerHTML=dashBars(compare(c));
  const r=d.relevant;
  $('#dashSituations').innerHTML=dashBars([['Planejadas',r.filter(x=>!x.filmDone&&!x.analysisDone&&status(x)!=='late').length],['Em andamento',r.filter(x=>!!(x.filmDone||x.analysisDone)&&!(x.filmDone&&x.analysisDone)).length,'progress'],['Concluídas',r.filter(x=>x.filmDone&&x.analysisDone).length,'actual']])+ '<p class="hint">Atrasadas (podem estar em andamento): <b>'+r.filter(x=>status(x)==='late').length+'</b>. Situação atual, não histórica.</p>';
  $('#dashModels').innerHTML=['HB20','I20','Creta'].map(m=>'<h4>'+esc(m)+'</h4>'+dashBars(compare(d.countsFor(r.filter(x=>x.model===m))))).join('');
  const days=[...new Set(r.flatMap(x=>['filmPlan','filmDone','analysisPlan','analysisDone'].map(k=>x[k]).filter(d.inPeriod)))].sort();
  $('#dashTimeline').innerHTML=days.map(day=>{const planned=r.reduce((n,x)=>n+(x.filmPlan===day)+(x.analysisPlan===day),0), actual=r.reduce((n,x)=>n+(x.filmDone===day)+(x.analysisDone===day),0);return {day,planned,actual}}).map((x,i,all)=>{
    const max=Math.max(1,...all.flatMap(x=>[x.planned,x.actual]));
    return '<div><b>'+date(x.day)+'</b>'+[['Planejado',x.planned,''],['Realizado',x.actual,'actual']].map(([label,n,color])=>'<div class="dash-bar"><span>'+label+'</span><div class="dash-track"><div class="dash-fill '+color+'" style="width:'+(n/max*100)+'%"></div></div><b>'+n+'</b></div>').join('')+'</div>';
  }).join('')||'<p class="hint">Sem dados no período.</p>';
}
['dashStart','dashEnd','dashModel','dashArea','dashStatus','dashShift'].forEach(id=>$('#'+id).addEventListener('change',renderAnalytics));
$('#dashClear').onclick=()=>{['dashStart','dashEnd','dashModel','dashArea','dashStatus','dashShift'].forEach(id=>$('#'+id).value='');renderAnalytics()};

$('#pdfDashboard').onclick=()=>{
  renderAnalytics();
  if($('#dashStart').value&&$('#dashEnd').value&&$('#dashStart').value>$('#dashEnd').value){alert('Corrija o período antes de imprimir.');return}
  const popup=window.open('','_blank');
  if(!popup){alert('Permita abrir a janela de impressão neste navegador e tente novamente.');return}
  const filterText=['Período: '+($('#dashStart').value?date($('#dashStart').value):'Início')+' a '+($('#dashEnd').value?date($('#dashEnd').value):'Fim'),...['dashModel','dashArea','dashStatus','dashShift'].map(id=>$('#'+id).selectedOptions[0].textContent)].join(' · ');
  const sections=[['Resumo',$('#dashCards').innerHTML],['Filmagens e análises',$('#dashCompare').innerHTML],['Situação das tomadas',$('#dashSituations').innerHTML],['Planejado × realizado por modelo',$('#dashModels').innerHTML],['Evolução por data',$('#dashTimeline').innerHTML]];
  const css=document.querySelector('style').textContent;
  popup.document.open();
  popup.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dashboard — Planejado e realizado</title><style>'+css+`
body{background:#e6edf4;padding:18px}.print-controls{background:white;border-radius:10px;padding:18px;max-width:1100px;margin:0 auto 20px}.print-controls label{display:inline-block;margin:6px 16px 6px 0}.print-controls input[type=number]{width:90px}.paper{background:white;box-shadow:0 3px 20px #19324c22;margin:auto;box-sizing:border-box;overflow:visible;padding:10mm}.report-section{margin-bottom:18px}.report-section h2{font-size:17px}.report-section:first-of-type>div{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.paper h1{font-size:23px;color:#0b3764}.paper h4{margin:14px 0 5px}.paper .card{padding:12px}.paper .card strong{font-size:25px}.paper .dash-bar{break-inside:avoid}.paper .hint{font-size:12px}.break-before{border-top:2px dashed #bd5d28;padding-top:12px}.break-before:before{content:'Quebra de página';display:block;color:#bd5d28;font-size:12px;margin-bottom:8px}#scaleInfo{display:block;font-size:13px;color:#43617a;margin-top:10px}@media print{html,body{margin:0!important;padding:0!important;background:white}.print-controls{display:none!important}.paper{box-shadow:none;margin:0;padding:0!important;width:100%!important}.break-before{border:0;padding-top:0;break-before:page;page-break-before:always}.break-before:before{display:none}.report-section h2{break-after:avoid}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style><style id="pageStyle"></style></head><body>
<div class="print-controls"><h1>Configurar impressão / PDF</h1><p>Escolha o formato e confira a prévia abaixo. Clique em Imprimir / Salvar PDF e selecione “Salvar como PDF” no destino.</p>
<label>Orientação <select id="orientation"><option value="landscape">Paisagem</option><option value="portrait">Retrato</option></select></label>
<label>Zoom <input id="zoom" type="number" min="10" max="200" step="5" value="100"> %</label>
<label><input id="onePage" type="checkbox"> Ajustar em 1 folha A4</label>
<fieldset><legend>Quebra de página antes de</legend>`+sections.slice(1).map((x,i)=>'<label><input class="pageBreak" type="checkbox" value="'+(i+1)+'"> '+esc(x[0])+'</label>').join('')+`</fieldset>
<button id="printNow">Imprimir / Salvar PDF</button> <button id="closePreview" class="secondary">Fechar</button><span id="scaleInfo" role="status"></span><p class="hint">Na janela do navegador, mantenha papel A4, escala 100%, margens padrão e desative cabeçalhos e rodapés. O modo 1 folha reduz o conteúdo e desativa as quebras manuais.</p></div>
<main id="paper" class="paper"><h1>Dashboard · Planejado × realizado</h1><p>`+esc(filterText)+'</p><p>'+esc($('#dashMessage').textContent)+'</p>'+sections.map(([title,content],i)=>'<section class="report-section" id="section'+i+'"><h2>'+esc(title)+'</h2><div>'+content+'</div></section>').join('')+`</main></body></html>`);
  popup.document.close();
  const doc=popup.document, paper=doc.getElementById('paper');
  function updatePrint(){
    const landscape=doc.getElementById('orientation').value==='landscape';
    const single=doc.getElementById('onePage').checked;
    const zoomInput=doc.getElementById('zoom');
    let zoom=Math.min(200,Math.max(10,Number(zoomInput.value)||100))/100;
    const width=landscape?277:190, height=landscape?190:277;
    paper.style.width=width+'mm';paper.style.padding='0';paper.style.zoom='1';
    doc.querySelectorAll('.pageBreak').forEach(box=>{box.disabled=single;doc.getElementById('section'+box.value).classList.toggle('break-before',!single&&box.checked)});
    zoomInput.disabled=single;
    if(single){
      const pxPerMm=96/25.4;
      zoom=Math.min(1,height*pxPerMm/Math.max(1,paper.scrollHeight),width*pxPerMm/Math.max(1,paper.scrollWidth))*0.97;
    }
    paper.style.zoom=String(zoom);
    doc.getElementById('pageStyle').textContent='@page{size:A4 '+(landscape?'landscape':'portrait')+';margin:10mm}';
    doc.getElementById('scaleInfo').textContent='Escala aplicada: '+Math.round(zoom*100)+'%'+(single?' · Ajuste automático em uma folha.':' · As quebras marcadas iniciam uma nova página.');
  }
  ['orientation','zoom','onePage'].forEach(id=>doc.getElementById(id).addEventListener('input',updatePrint));
  doc.querySelectorAll('.pageBreak').forEach(box=>box.addEventListener('change',updatePrint));
  doc.getElementById('printNow').onclick=()=>{updatePrint();popup.focus();popup.print()};
  doc.getElementById('closePreview').onclick=()=>popup.close();
  updatePrint();
};

async function refreshDashboard(){
  try{
    const {data:{user},error:authError}=await db.auth.getUser();
    if(authError||!user){location.replace('index.html');return}
    const {data:allowed,error:accessError}=await db.rpc('controle_autorizado',{});
    if(accessError)throw accessError;
    if(!allowed){$('#dashboardContent').hidden=true;$('#dashboardConnection').textContent='Acesso não autorizado. Retorne ao planejamento.';return}
    const {data,error}=await db.from('controle_tomadas').select('id,dados').order('atualizado_em',{ascending:false});
    if(error)throw error;
    rows=data;renderAnalytics();$('#dashboardContent').hidden=false;
    $('#dashboardConnection').textContent='Dados atualizados · '+user.email;
  }catch(err){$('#dashboardConnection').textContent='Não foi possível atualizar os dados. Verifique a conexão e recarregue a página.'}
}
await refreshDashboard();
setInterval(refreshDashboard,10000);
db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){rows=[];$('#dashboardContent').hidden=true;location.replace('index.html')}});

import { useState, useMemo, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://dmugffjkrrgndrtbdotm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdWdmZmprcnJnbmRydGJkb3RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNDQ2NTEsImV4cCI6MjA5NTYyMDY1MX0.pt2Z_UA2Y3eTBvYTWN3gShlG1v3-WIfDDVpJ0DnGVjc";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BLUE="#1565C0",BLUE_LIGHT="#E3F0FF",RED="#C62828",RED_LIGHT="#FFEBEE",GRAY="#F5F6FA",BORDER="#DDE3F0",TEXT="#1A2340",TEXT2="#5A6580";

const CATEGORIES={
  dp:{label:"Dep. Pessoal",color:"#6A1B9A",bg:"#F3E5F5",icon:"👥"},
  fiscal:{label:"Fiscal",color:BLUE,bg:BLUE_LIGHT,icon:"📊"},
  contabil:{label:"Contábil",color:"#00838F",bg:"#E0F7FA",icon:"📒"},
  financeiro:{label:"Financeiro",color:RED,bg:RED_LIGHT,icon:"💰"},
  administrativo:{label:"Administrativo",color:"#E65100",bg:"#FFF3E0",icon:"📋"},
  cliente:{label:"Cliente",color:"#2E7D32",bg:"#E8F5E9",icon:"🤝"},
  rescisao:{label:"Rescisão",color:"#B71C1C",bg:"#FFEBEE",icon:"📄"},
};
const PRIORITIES={
  urgente:{label:"Urgente",color:RED,bg:RED_LIGHT,dot:"●"},
  alta:{label:"Alta",color:"#E65100",bg:"#FFF3E0",dot:"●"},
  media:{label:"Média",color:"#F9A825",bg:"#FFFDE7",dot:"●"},
  baixa:{label:"Baixa",color:"#2E7D32",bg:"#E8F5E9",dot:"●"},
};

const PROCESS_TEMPLATES={
  folha:{label:"Folha de Pagamento",icon:"💼",category:"dp",color:"#6A1B9A",steps:[
    {title:"Aguardar informações do cliente (comissão, horas extras, adicional noturno, adiantamento, faltas)",priority:"alta",daysFromNow:0},
    {title:"Lançar variáveis no sistema",priority:"alta",daysFromNow:1},
    {title:"Apurar e fechar a folha",priority:"urgente",daysFromNow:2},
    {title:"Enviar para o cliente conferir",priority:"urgente",daysFromNow:3},
    {title:"Aguardar OK do cliente",priority:"alta",daysFromNow:4},
    {title:"Liberar holerites",priority:"urgente",daysFromNow:5},
    {title:"Gerar DARF INSS e FGTS",priority:"urgente",daysFromNow:6},
    {title:"Enviar guias para o cliente pagar",priority:"urgente",daysFromNow:7},
  ]},
  rescisao:{label:"Rescisão Trabalhista",icon:"📄",category:"rescisao",color:"#B71C1C",steps:[
    {title:"Receber comunicado de rescisão",priority:"urgente",daysFromNow:0},
    {title:"Verificar tipo de rescisão (justa causa, pedido, acordo...)",priority:"alta",daysFromNow:1},
    {title:"Calcular verbas rescisórias (TRCT)",priority:"urgente",daysFromNow:2},
    {title:"Emitir guia FGTS + baixa na CTPS/eSocial",priority:"urgente",daysFromNow:3},
    {title:"Emitir Termo de Rescisão (TRCT)",priority:"alta",daysFromNow:4},
    {title:"Arquivar documentação da rescisão",priority:"media",daysFromNow:5},
  ]},
  admissao:{label:"Admissão de Funcionário",icon:"👤",category:"dp",color:"#6A1B9A",steps:[
    {title:"Receber documentos do novo funcionário",priority:"urgente",daysFromNow:0},
    {title:"Verificar documentação (RG, CPF, CTPS)",priority:"alta",daysFromNow:0},
    {title:"Registrar admissão no eSocial",priority:"urgente",daysFromNow:1},
    {title:"Assinar contrato de trabalho",priority:"alta",daysFromNow:1},
    {title:"Incluir na folha de pagamento",priority:"alta",daysFromNow:3},
    {title:"Arquivar documentação de admissão",priority:"baixa",daysFromNow:5},
  ]},
  ferias:{label:"Férias de Funcionário",icon:"🏖️",category:"dp",color:"#6A1B9A",steps:[
    {title:"Verificar período aquisitivo de férias",priority:"media",daysFromNow:0},
    {title:"Notificar funcionário com 30 dias de antecedência",priority:"alta",daysFromNow:0},
    {title:"Calcular valores das férias + 1/3",priority:"alta",daysFromNow:5},
    {title:"Emitir recibo de férias",priority:"alta",daysFromNow:7},
    {title:"Pagar férias (até 2 dias antes do início)",priority:"urgente",daysFromNow:8},
    {title:"Registrar férias no eSocial",priority:"alta",daysFromNow:9},
  ]},
};

const RECURRING_TEMPLATES=[
  {title:"Folha de Pagamento",category:"dp",priority:"urgente",dayOfMonth:25,notes:"Processar folha do mês"},
  {title:"FGTS Mensal",category:"dp",priority:"urgente",dayOfMonth:7,notes:"Gerar e pagar guia FGTS"},
  {title:"DARF IRRF",category:"fiscal",priority:"urgente",dayOfMonth:20,notes:"Recolhimento IRRF mensal"},
  {title:"DARF INSS",category:"dp",priority:"urgente",dayOfMonth:20,notes:"Recolhimento INSS mensal"},
  {title:"Apuração de Impostos",category:"fiscal",priority:"alta",dayOfMonth:10,notes:"Apurar DAS/Simples/Presumido"},
  {title:"Emitir Relatório Gerencial",category:"contabil",priority:"media",dayOfMonth:15,notes:"Relatório mensal para clientes"},
  {title:"Backup de Documentos",category:"administrativo",priority:"baixa",dayOfMonth:28,notes:"Backup mensal dos arquivos digitais"},
];

const FOLHA_ATIVA=["Acervo Chop","AutoBraz","Blindar Contagem","Cantina Freitas","Cleiton Martins","Cledson Elevadores","Control Vt","Decora","Deposito Cerveja MTZ","Di France","Espaço Presentes","Espaço Vitta Pilates","Flavia FSA","FOCO","Ge Car","Guindaumaq","HJ Peças","Jeovane","Ligeirinho","M&R Placas","M3 Comércio","Magnus Imóveis","Marcelo Transporte","MDC Locação","MG5","Milton Tem Tem","Natal MTZ","Natalia Mota","Nivair","OMR Entregas","Opção Locação","Opção Visual","PRONTOVET Ibirité","R&E Top Diesel","RDS","Frutos de Minas Barreiro","Frutos de Minas Barreiro FL","Rede Frutos de Minas Betim","Frutos de Minas Betim FL","Res Lealdo","Rodrigar","Rosálio Duarte","SEGUROBRAS","Stenner","Shopping das Peças","Tower","T&R"];
const DOMESTICAS=["Elza Maria","Maria dos Anjos","Leonídia","Eliane","Eduardo Freitas","Sandra","Geraldo"];
const SEM_MOVIMENTO=["Antonio Clareti","Blindar Ibirité","By Tracker","CT Treinamento","Deposito Cerveja FL","EABorges","Heleno","Marc Textil","Merc. Manhumirim","Natal FL","NetForce","Piazza Peças","Pulga Car","Quintal Fornalha","Protagon","PROFISS","Ramon Carvalho MEI","RDL Holding","Tiago Alves","Valente"];
const FOLHA_COLS=["Folha","DARF","FGTS","Adiantamento","REINF","eCons"];
const DOM_COLS=["Folha","Guia","Status"];
const STATUS_CYCLE=["pendente","andamento","entregue"];
const STATUS_ICON={"pendente":"⬜","andamento":"🟡","entregue":"✅"};

// MENU INFERIOR — ícones e labels
const NAV_ITEMS=[
  {id:"agenda",icon:"📅",label:"Hoje"},
  {id:"semana",icon:"🗓",label:"Semana"},
  {id:"mes",icon:"📆",label:"Mês"},
  {id:"clientes",icon:"👥",label:"Clientes"},
  {id:"tarefas",icon:"📋",label:"Tarefas"},
  {id:"mapa",icon:"📊",label:"Mapa"},
  {id:"fechamento",icon:"📁",label:"Fechamento"},
];

function norm(s){return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();}
function findEmpresa(txt,lista){let best=null;let bestScore=0;for(const emp of lista){const e=norm(emp);const t=norm(txt);if(t.includes(e))return emp;const words=e.split(" ").filter(w=>w.length>2);const score=words.filter(w=>t.includes(w)).length/Math.max(words.length,1);if(score>bestScore&&score>=0.5){bestScore=score;best=emp;}}return best;}
const COL_MAP={"folha":"Folha","foia":"Folha","foi":"Folha","darf":"DARF","dar":"DARF","daf":"DARF","fgts":"FGTS","fts":"FGTS","fgds":"FGTS","efegates":"FGTS","adiantamento":"Adiantamento","adiant":"Adiantamento","reinf":"REINF","rein":"REINF","reif":"REINF","econs":"eCons","econ":"eCons","e cons":"eCons","icons":"eCons"};
function findCol(txt){for(const[k,v]of Object.entries(COL_MAP)){if(txt.includes(k))return v;}return null;}
function getCurrentMonthKey(){const n=new Date();return`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;}

const today=new Date();today.setHours(0,0,0,0);
const todayStr=today.toISOString().split("T")[0];
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function fmtDate(d){return d.toISOString().split("T")[0];}
function ptDate(str){if(!str)return"—";const[y,m,d]=str.split("-");return`${d}/${m}/${y}`;}
function getWeekStart(d){const x=new Date(d);const day=x.getDay();x.setDate(x.getDate()-day+(day===0?-6:1));x.setHours(0,0,0,0);return x;}
function diffDays(str){const d=new Date(str+"T00:00:00");return Math.ceil((d-today)/86400000);}
function fmtDayOfMonth(day){const d=new Date(today.getFullYear(),today.getMonth(),day);if(d<today)d.setMonth(d.getMonth()+1);return fmtDate(d);}
const WDAYS=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
const WFULL=["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"];
const MONTHS_PT=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
function scoreTask(t){const d=diffDays(t.due);const p={urgente:100,alta:60,media:30,baixa:10}[t.priority]||0;const u=d<=0?200:d===1?150:d<=3?80:d<=7?40:10;return p+u;}
function statusInfo(t){const d=diffDays(t.due);if(d<0)return{label:`${Math.abs(d)}d atraso`,color:RED,bg:RED_LIGHT};if(d===0)return{label:"Hoje",color:BLUE,bg:BLUE_LIGHT};if(d===1)return{label:"Amanhã",color:"#E65100",bg:"#FFF3E0"};return{label:`Em ${d}d`,color:TEXT2,bg:GRAY};}

export default function App(){
  const [tasks,setTasks]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [view,setView]=useState("agenda");
  const [agendaTab,setAgendaTab]=useState("urgentes"); // "urgentes" | "comuns"
  const [showForm,setShowForm]=useState(false);
  const [showTemplates,setShowTemplates]=useState(false);
  const [showRecurring,setShowRecurring]=useState(false);
  const [showQuickMenu,setShowQuickMenu]=useState(false);
  const [editId,setEditId]=useState(null);
  const [toast,setToast]=useState(null);
  const [filterCat,setFilterCat]=useState("all");
  const [filterPri,setFilterPri]=useState("all");
  const [filterClient,setFilterClient]=useState("all");
  const [showDone,setShowDone]=useState(false);
  const [mesOffset,setMesOffset]=useState(0);
  const [selectedTemplate,setSelectedTemplate]=useState(null);
  const [templateClient,setTemplateClient]=useState("");
  const [recurringClient,setRecurringClient]=useState("");
  const [selectedRecurring,setSelectedRecurring]=useState([]);
  const [fechaView,setFechaView]=useState("folha");
  const [listening,setListening]=useState(false);
  const [voiceLog,setVoiceLog]=useState("");
  const [fechaMap,setFechaMap]=useState({});
  const [fechaLoading,setFechaLoading]=useState(false);
  const recognitionRef=useRef(null);
  const monthKey=getCurrentMonthKey();
  const emptyForm={title:"",category:"dp",priority:"media",due:todayStr,client:"",notes:"",created_at:todayStr,completed_at:""};
  const [form,setForm]=useState(emptyForm);

  useEffect(()=>{fetchTasks();},[]);
  useEffect(()=>{if(view==="fechamento")fetchFechamento();},[view]);

  async function fetchTasks(){
    setLoading(true);
    const{data}=await supabase.from("tasks").select("*").order("due",{ascending:true});
    setTasks(data||[]);setLoading(false);
  }

  async function fetchFechamento(){
    setFechaLoading(true);
    const{data,error}=await supabase.from("fechamento_mensal").select("*").eq("month_key",monthKey);
    if(error){showToast("Erro ao carregar fechamento","err");setFechaLoading(false);return;}
    const map={};
    (data||[]).forEach(r=>{map[`${r.tipo}|${r.empresa}|${r.coluna}`]={status:r.status,via:r.via||"",data_entrega:r.data_entrega||"",id:r.id};});
    setFechaMap(map);setFechaLoading(false);
  }

  function getCell(tipo,empresa,coluna){return fechaMap[`${tipo}|${empresa}|${coluna}`]||{status:"pendente",via:"",data_entrega:"",id:null};}

  async function upsertCell(tipo,empresa,coluna,status,via="",data_entrega=""){
    const existing=getCell(tipo,empresa,coluna);
    const payload={month_key:monthKey,tipo,empresa,coluna,status,via,data_entrega,updated_at:new Date().toISOString()};
    let error;
    if(existing.id){({error}=await supabase.from("fechamento_mensal").update(payload).eq("id",existing.id));}
    else{({error}=await supabase.from("fechamento_mensal").insert([payload]));}
    if(error){showToast("Erro ao salvar","err");return;}
    setFechaMap(prev=>({...prev,[`${tipo}|${empresa}|${coluna}`]:{...payload,id:existing.id||"new"}}));
  }

  async function cycleFolhaStatus(empresa,col){const cell=getCell("folha",empresa,col);const next=STATUS_CYCLE[(STATUS_CYCLE.indexOf(cell.status)+1)%STATUS_CYCLE.length];await upsertCell("folha",empresa,col,next,cell.via,next==="entregue"?new Date().toLocaleDateString("pt-BR"):"");}
  async function setFolhaVia(empresa,col,via){const cell=getCell("folha",empresa,col);await upsertCell("folha",empresa,col,cell.status,via,cell.data_entrega);}
  async function cycleDomStatus(empresa,col){const cell=getCell("dom",empresa,col);const next=STATUS_CYCLE[(STATUS_CYCLE.indexOf(cell.status)+1)%STATUS_CYCLE.length];await upsertCell("dom",empresa,col,next,"","");}
  async function toggleSem(empresa){const cell=getCell("sem",empresa,"conferido");await upsertCell("sem",empresa,"conferido",cell.status==="entregue"?"pendente":"entregue","","");}
  async function resetFechamento(){if(!window.confirm("Resetar painel?"))return;await supabase.from("fechamento_mensal").delete().eq("month_key",monthKey);setFechaMap({});showToast("Painel resetado!");}

  function startVoice(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){showToast("Use o Google Chrome para comando de voz","err");return;}
    if(recognitionRef.current){try{recognitionRef.current.stop();}catch(e){}}
    const r=new SR();
    r.lang="pt-BR";r.continuous=false;r.interimResults=false;r.maxAlternatives=5;
    r.onstart=()=>{setListening(true);setVoiceLog("🎤 Ouvindo...");};
    r.onend=()=>setListening(false);
    r.onerror=(e)=>{setListening(false);if(e.error==="not-allowed")showToast("❌ Permita o microfone no navegador","err");else if(e.error==="no-speech")showToast("Nenhuma fala detectada","err");else showToast(`Erro: ${e.error}`,"err");};
    r.onresult=(e)=>{
      const alts=Array.from(e.results[0]).map(x=>x.transcript);
      setVoiceLog(`Entendido: "${alts[0]}"`);
      let ok=false;
      for(const txt of alts){if(processVoice(norm(txt))){ok=true;break;}}
      if(!ok)showToast(`❌ Não entendi: "${alts[0]}"\nEx: "AutoBraz folha entregue"`,"err");
    };
    recognitionRef.current=r;
    try{r.start();}catch(e){showToast("Erro ao iniciar microfone","err");}
  }

  function processVoice(txt){
    const hoje=new Date().toLocaleDateString("pt-BR");
    const via=txt.includes("whats")||txt.includes("zap")?"WhatsApp":txt.includes("email")||txt.includes("correio")?"E-mail":"";
    if(txt.includes("tudo")){
      const emp=findEmpresa(txt.replace(/tudo|entregue/g,""),FOLHA_ATIVA);
      if(emp){FOLHA_COLS.forEach(col=>upsertCell("folha",emp,col,"entregue",via,hoje));showToast(`✅ ${emp} — tudo entregue!`);return true;}
    }
    const col=findCol(txt);
    if(col){
      const semCol=txt.replace(/marcar|entregue|whatsapp|email|whats|zap/g,"").replace(norm(col),"");
      const emp=findEmpresa(semCol,FOLHA_ATIVA);
      if(emp){upsertCell("folha",emp,col,"entregue",via,hoje);showToast(`✅ ${emp} — ${col}${via?" via "+via:""} entregue`);return true;}
    }
    return false;
  }

  function showToast(msg,type="ok"){setToast({msg,type});setTimeout(()=>setToast(null),4000);}

  async function saveForm(){
    if(!form.title.trim())return;
    setSaving(true);
    const payload={title:form.title,category:form.category,priority:form.priority,due:form.due,client:form.client,notes:form.notes,created_at:form.created_at,completed_at:form.completed_at||null,done:false};
    if(editId){await supabase.from("tasks").update(payload).eq("id",editId);showToast("Tarefa atualizada!");}
    else{await supabase.from("tasks").insert([payload]);showToast("Tarefa criada!");}
    setShowForm(false);setEditId(null);setForm(emptyForm);setSaving(false);fetchTasks();
  }

  async function toggleDone(t){
    const now=!t.done;const completed_at=now?todayStr:null;
    await supabase.from("tasks").update({done:now,completed_at}).eq("id",t.id);
    setTasks(prev=>prev.map(x=>x.id===t.id?{...x,done:now,completed_at}:x));
    showToast(now?"Concluída! ✓":"Reaberta");
  }

  async function deleteTask(id){await supabase.from("tasks").delete().eq("id",id);setTasks(prev=>prev.filter(x=>x.id!==id));showToast("Removida");}
  function openEdit(t){setForm({title:t.title,category:t.category,priority:t.priority,due:t.due,client:t.client||"",notes:t.notes||"",created_at:t.created_at||todayStr,completed_at:t.completed_at||""});setEditId(t.id);setShowForm(true);}

  async function createProcess(){
    if(!selectedTemplate||!templateClient.trim())return;
    setSaving(true);
    const tpl=PROCESS_TEMPLATES[selectedTemplate];
    await supabase.from("tasks").insert(tpl.steps.map(s=>({title:s.title,category:tpl.category,priority:s.priority,due:fmtDate(addDays(today,s.daysFromNow)),client:templateClient,notes:`Processo: ${tpl.label}`,created_at:todayStr,completed_at:null,done:false})));
    showToast(`${tpl.steps.length} tarefas criadas!`);setShowTemplates(false);setSelectedTemplate(null);setTemplateClient("");setSaving(false);fetchTasks();
  }

  async function createRecurring(){
    if(!recurringClient.trim()||selectedRecurring.length===0)return;
    setSaving(true);
    await supabase.from("tasks").insert(selectedRecurring.map(idx=>{const r=RECURRING_TEMPLATES[idx];return{title:r.title,category:r.category,priority:r.priority,due:fmtDayOfMonth(r.dayOfMonth),client:recurringClient,notes:r.notes,created_at:todayStr,completed_at:null,done:false};}));
    showToast(`${selectedRecurring.length} tarefas criadas!`);setShowRecurring(false);setRecurringClient("");setSelectedRecurring([]);setSaving(false);fetchTasks();
  }

  const weekStart=getWeekStart(today);
  const weekDays=Array.from({length:7},(_,i)=>addDays(weekStart,i));
  const in7days=fmtDate(addDays(today,7));
  const pending=tasks.filter(t=>!t.done);
  const done=tasks.filter(t=>t.done);
  const allClients=useMemo(()=>[...new Set(tasks.map(t=>t.client).filter(Boolean))].sort(),[tasks]);

  // AGENDA: urgentes = vencidas + hoje + urgente/alta próx 7d | comuns = resto do dia
  const allTodayPending=useMemo(()=>pending.filter(t=>t.due<=todayStr).sort((a,b)=>scoreTask(b)-scoreTask(a)),[tasks]);
  const prox7Urgentes=useMemo(()=>pending.filter(t=>t.due>todayStr&&t.due<=in7days&&(t.priority==="urgente"||t.priority==="alta")).sort((a,b)=>scoreTask(b)-scoreTask(a)),[tasks]);
  const urgentesTab=useMemo(()=>{
    const base=allTodayPending.filter(t=>t.priority==="urgente"||t.priority==="alta"||t.due<todayStr);
    const ids=new Set(base.map(t=>t.id));
    return[...base,...prox7Urgentes.filter(t=>!ids.has(t.id))];
  },[tasks]);
  const comunsTab=useMemo(()=>allTodayPending.filter(t=>t.priority==="media"||t.priority==="baixa"),[tasks]);

  const weekTasksFor=(ds)=>tasks.filter(t=>!t.done&&t.due===ds).sort((a,b)=>scoreTask(b)-scoreTask(a));
  const allFiltered=useMemo(()=>[...pending].filter(t=>filterCat==="all"||t.category===filterCat).filter(t=>filterPri==="all"||t.priority===filterPri).sort((a,b)=>scoreTask(b)-scoreTask(a)),[tasks,filterCat,filterPri]);
  const clientPanel=useMemo(()=>{
    const filtered=filterClient==="all"?pending:pending.filter(t=>t.client===filterClient);
    const grouped={};
    filtered.forEach(t=>{const c=t.client||"(sem cliente)";if(!grouped[c])grouped[c]=[];grouped[c].push(t);});
    Object.keys(grouped).forEach(c=>grouped[c].sort((a,b)=>scoreTask(b)-scoreTask(a)));
    return grouped;
  },[tasks,filterClient]);

  const mesRef=useMemo(()=>{const d=new Date(today);d.setDate(1);d.setMonth(d.getMonth()+mesOffset);return d;},[mesOffset]);
  const mesNome=MONTHS_PT[mesRef.getMonth()];const mesAno=mesRef.getFullYear();
  const diasNoMes=new Date(mesAno,mesRef.getMonth()+1,0).getDate();
  const primeiroDiaSemana=new Date(mesAno,mesRef.getMonth(),1).getDay();
  const offsetInicio=primeiroDiaSemana===0?6:primeiroDiaSemana-1;
  const mesDias=Array.from({length:diasNoMes},(_,i)=>i+1);
  function mesDateStr(d){return`${mesAno}-${String(mesRef.getMonth()+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}
  const mesTasksFor=(ds)=>tasks.filter(t=>!t.done&&t.due===ds).sort((a,b)=>scoreTask(b)-scoreTask(a));

  const stats=[
    {label:"Urgentes",val:urgentesTab.length,color:RED,bg:RED_LIGHT},
    {label:"Comuns Hoje",val:comunsTab.length,color:BLUE,bg:BLUE_LIGHT},
    {label:"Esta Semana",val:pending.filter(t=>t.due>=fmtDate(weekStart)&&t.due<=fmtDate(addDays(weekStart,6))).length,color:"#00838F",bg:"#E0F7FA"},
    {label:"Concluídas",val:done.length,color:"#2E7D32",bg:"#E8F5E9"},
  ];

  const S={
    root:{fontFamily:"'Segoe UI',Arial,sans-serif",background:"#F0F3FA",minHeight:"100vh",color:TEXT,paddingBottom:72},
    header:{background:"#fff",borderBottom:`2px solid ${BLUE}`,padding:"0 14px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,gap:5},
    logoMark:{width:30,height:30,borderRadius:7,background:BLUE,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:12,flexShrink:0},
    logoName:{fontSize:11.5,fontWeight:700,color:BLUE},
    logoSub:{fontSize:8,color:TEXT2,textTransform:"uppercase",letterSpacing:"1px"},
    // MENU INFERIOR
    bottomNav:{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:`1.5px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"space-around",height:62,zIndex:200,padding:"0 4px"},
    navItem:(active)=>({display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,padding:"6px 4px",cursor:"pointer",flex:1,borderRadius:8,background:active?BLUE_LIGHT:"transparent",transition:"background .15s"}),
    navIcon:(active)=>({fontSize:18,lineHeight:1}),
    navLabel:(active)=>({fontSize:9,fontWeight:active?700:400,color:active?BLUE:TEXT2,lineHeight:1}),
    // CONTEÚDO
    main:{maxWidth:900,margin:"0 auto",padding:"14px 12px"},
    card:{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:10,padding:"11px 13px",display:"flex",alignItems:"flex-start",gap:9,marginBottom:7},
    badge:(c,bg)=>({background:bg,color:c,border:`1px solid ${c}33`,borderRadius:5,padding:"1px 6px",fontSize:9.5,fontWeight:600,whiteSpace:"nowrap"}),
    circle:(c)=>({width:22,height:22,borderRadius:"50%",border:`2px solid ${c}`,flexShrink:0,cursor:"pointer",marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:c}),
    doneDot:{width:22,height:22,borderRadius:"50%",background:"#2E7D32",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",cursor:"pointer",marginTop:2},
    section:{fontWeight:700,fontSize:17,color:TEXT,marginBottom:3},
    sub:{fontSize:11,color:TEXT2,marginBottom:12},
    overlay:{position:"fixed",inset:0,background:"rgba(20,40,80,0.4)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:0},
    modal:{background:"#fff",borderRadius:"16px 16px 0 0",padding:"20px 16px 32px",width:"100%",maxWidth:540,maxHeight:"92vh",overflowY:"auto"},
    lbl:{fontSize:10,color:TEXT2,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.5px",fontWeight:600},
    inp:{width:"100%",background:GRAY,border:`1px solid ${BORDER}`,borderRadius:8,padding:"10px 11px",color:TEXT,fontSize:14,fontFamily:"inherit"},
  };

  if(loading)return(
    <div style={{...S.root,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14,paddingBottom:0}}>
      <div style={{width:32,height:32,borderRadius:"50%",border:`3px solid ${BORDER}`,borderTop:`3px solid ${BLUE}`,animation:"spin .8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{color:TEXT2,fontSize:13}}>Carregando...</div>
    </div>
  );

  return(
    <div style={S.root}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .tc:hover{box-shadow:0 2px 10px rgba(21,101,192,.10)}
        .cb:hover{opacity:.8;transform:scale(1.12)}
        * {box-sizing:border-box;}
      `}</style>
      {toast&&<div style={{position:"fixed",bottom:72,right:16,zIndex:999,background:toast.type==="err"?RED:BLUE,color:"#fff",borderRadius:10,padding:"10px 16px",fontSize:12.5,fontWeight:600,boxShadow:"0 4px 16px rgba(0,0,0,.25)",maxWidth:300,whiteSpace:"pre-line"}}>{toast.msg}</div>}

      {/* HEADER */}
      <div style={S.header}>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <div style={S.logoMark}>BM</div>
          <div><div style={S.logoName}>BM CONTABILIDADE</div><div style={S.logoSub}>Agenda Inteligente Contábil</div></div>
        </div>
        {/* Botões de ação rápida no header */}
        <div style={{display:"flex",gap:5}}>
          <button onClick={()=>setShowTemplates(true)} style={{background:"#6A1B9A",color:"#fff",border:"none",borderRadius:7,padding:"6px 10px",fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>⚡</button>
          <button onClick={()=>setShowRecurring(true)} style={{background:"#00838F",color:"#fff",border:"none",borderRadius:7,padding:"6px 10px",fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>🔄</button>
          <button onClick={()=>{setEditId(null);setForm(emptyForm);setShowForm(true)}} style={{background:RED,color:"#fff",border:"none",borderRadius:7,padding:"6px 12px",fontSize:12,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>+ Nova</button>
        </div>
      </div>

      <div style={S.main}>

        {/* STATS */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
          {stats.map(s=>(
            <div key={s.label} style={{background:s.bg,border:`1px solid ${BORDER}`,borderRadius:10,padding:"10px 10px"}}>
              <div style={{fontSize:22,fontWeight:700,color:s.color,lineHeight:1}}>{s.val}</div>
              <div style={{fontSize:9.5,color:s.color,marginTop:3,fontWeight:500,lineHeight:1.2}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── HOJE ── */}
        {view==="agenda"&&<>
          <div style={S.section}>Agenda de Hoje</div>
          <div style={S.sub}>{today.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</div>

          {/* ABAS URGENTES / COMUNS */}
          <div style={{display:"flex",gap:0,marginBottom:14,background:"#fff",borderRadius:10,border:`1px solid ${BORDER}`,overflow:"hidden"}}>
            <button onClick={()=>setAgendaTab("urgentes")} style={{flex:1,background:agendaTab==="urgentes"?RED:"#fff",color:agendaTab==="urgentes"?"#fff":TEXT2,border:"none",padding:"11px 0",fontSize:13,fontWeight:700,fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"all .15s"}}>
              🔴 Urgentes
              {urgentesTab.length>0&&<span style={{background:agendaTab==="urgentes"?"rgba(255,255,255,0.3)":RED_LIGHT,color:agendaTab==="urgentes"?"#fff":RED,borderRadius:10,padding:"1px 7px",fontSize:11,fontWeight:700}}>{urgentesTab.length}</span>}
            </button>
            <div style={{width:1,background:BORDER}}/>
            <button onClick={()=>setAgendaTab("comuns")} style={{flex:1,background:agendaTab==="comuns"?BLUE:"#fff",color:agendaTab==="comuns"?"#fff":TEXT2,border:"none",padding:"11px 0",fontSize:13,fontWeight:700,fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"all .15s"}}>
              📋 Tarefas do Dia
              {comunsTab.length>0&&<span style={{background:agendaTab==="comuns"?"rgba(255,255,255,0.3)":BLUE_LIGHT,color:agendaTab==="comuns"?"#fff":BLUE,borderRadius:10,padding:"1px 7px",fontSize:11,fontWeight:700}}>{comunsTab.length}</span>}
            </button>
          </div>

          {agendaTab==="urgentes"&&<>
            {urgentesTab.length===0
              ?<Empty icon="✅" msg="Nenhuma tarefa urgente!" sub="Você está em dia com as prioridades."/>
              :urgentesTab.map((t,i)=><Card key={t.id} t={t} i={i} S={S} onToggle={()=>toggleDone(t)} onEdit={()=>openEdit(t)} onDelete={()=>deleteTask(t.id)}/>)
            }
          </>}

          {agendaTab==="comuns"&&<>
            {comunsTab.length===0
              ?<Empty icon="🎉" msg="Nenhuma tarefa comum para hoje!" sub="Clique em '+ Nova' para adicionar."/>
              :comunsTab.map((t,i)=><Card key={t.id} t={t} i={i} S={S} onToggle={()=>toggleDone(t)} onEdit={()=>openEdit(t)} onDelete={()=>deleteTask(t.id)}/>)
            }
          </>}
        </>}

        {/* ── SEMANA ── */}
        {view==="semana"&&<>
          <div style={S.section}>Agenda da Semana</div>
          <div style={S.sub}>{weekStart.toLocaleDateString("pt-BR",{day:"numeric",month:"short"})} – {addDays(weekStart,6).toLocaleDateString("pt-BR",{day:"numeric",month:"short",year:"numeric"})}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:14}}>
            {weekDays.map((day,i)=>{const ds=fmtDate(day);const dt=weekTasksFor(ds);const isToday=ds===todayStr;const isPast=ds<todayStr;
              return(<div key={ds} style={{background:isToday?BLUE_LIGHT:"#fff",border:`1px solid ${isToday?BLUE:BORDER}`,borderRadius:8,padding:"6px 5px",minHeight:90}}>
                <div style={{fontSize:8.5,color:isToday?BLUE:TEXT2,fontWeight:600,textTransform:"uppercase"}}>{WDAYS[i]}</div>
                <div style={{fontSize:15,fontWeight:700,color:isToday?BLUE:isPast?"#C5CAD8":TEXT}}>{day.getDate()}</div>
                <div style={{display:"flex",flexDirection:"column",gap:2,marginTop:3}}>
                  {dt.map(t=><div key={t.id} style={{background:CATEGORIES[t.category]?.bg||BLUE_LIGHT,color:CATEGORIES[t.category]?.color||BLUE,borderRadius:3,padding:"2px 3px",fontSize:8,lineHeight:1.3,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{CATEGORIES[t.category]?.icon} {t.title}</div>)}
                  {dt.length===0&&<div style={{fontSize:9,color:"#C5CAD8",textAlign:"center",marginTop:4}}>—</div>}
                </div>
              </div>);})}
          </div>
          {weekDays.map((day,i)=>{const ds=fmtDate(day);const dt=weekTasksFor(ds);if(!dt.length)return null;const isToday=ds===todayStr;
            return(<div key={ds} style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:isToday?BLUE:TEXT2,marginBottom:6,display:"flex",alignItems:"center",gap:5}}>{WFULL[i]}, {day.toLocaleDateString("pt-BR",{day:"numeric",month:"short"})}{isToday&&<span style={{fontSize:9,background:BLUE_LIGHT,color:BLUE,borderRadius:4,padding:"1px 5px"}}>HOJE</span>}</div>
              {dt.map((t,i)=><Card key={t.id} t={t} i={i} S={S} compact onToggle={()=>toggleDone(t)} onEdit={()=>openEdit(t)} onDelete={()=>deleteTask(t.id)}/>)}
            </div>);})}
        </>}

        {/* ── MÊS ── */}
        {view==="mes"&&<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
            <div style={S.section}>Panorama Mensal</div>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <button onClick={()=>setMesOffset(o=>o-1)} style={{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:6,padding:"5px 12px",cursor:"pointer",fontSize:14,color:TEXT}}>‹</button>
              <span style={{fontWeight:700,fontSize:12,color:BLUE,minWidth:110,textAlign:"center"}}>{mesNome} {mesAno}</span>
              <button onClick={()=>setMesOffset(o=>o+1)} style={{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:6,padding:"5px 12px",cursor:"pointer",fontSize:14,color:TEXT}}>›</button>
              {mesOffset!==0&&<button onClick={()=>setMesOffset(0)} style={{background:BLUE_LIGHT,border:`1px solid ${BLUE}`,borderRadius:6,padding:"5px 8px",cursor:"pointer",fontSize:10,color:BLUE,fontWeight:600}}>Hoje</button>}
            </div>
          </div>
          <div style={{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:10,padding:10,marginBottom:14}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>{WDAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:9,fontWeight:600,color:TEXT2,padding:"2px 0"}}>{d}</div>)}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
              {Array.from({length:offsetInicio},(_,i)=><div key={"e"+i}/>)}
              {mesDias.map(d=>{const ds=mesDateStr(d);const dt=mesTasksFor(ds);const isToday=ds===todayStr;const isPast=ds<todayStr;const temUrg=dt.some(t=>t.priority==="urgente");const temAlta=dt.some(t=>t.priority==="alta");
                return(<div key={d} style={{minHeight:44,border:`1px solid ${isToday?BLUE:BORDER}`,borderRadius:5,padding:"3px 4px",background:isToday?BLUE_LIGHT:isPast?"#FAFAFA":"#fff",position:"relative"}}>
                  <div style={{fontSize:10,fontWeight:isToday?700:400,color:isToday?BLUE:isPast?"#C5CAD8":TEXT}}>{d}</div>
                  {dt.slice(0,2).map(t=><div key={t.id} style={{fontSize:7,background:CATEGORIES[t.category]?.bg||BLUE_LIGHT,color:CATEGORIES[t.category]?.color||BLUE,borderRadius:2,padding:"1px 2px",marginTop:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{t.title}</div>)}
                  {dt.length>2&&<div style={{fontSize:7,color:TEXT2}}>+{dt.length-2}</div>}
                  {temUrg&&<div style={{position:"absolute",top:2,right:2,width:5,height:5,borderRadius:"50%",background:RED}}/>}
                  {!temUrg&&temAlta&&<div style={{position:"absolute",top:2,right:2,width:5,height:5,borderRadius:"50%",background:"#E65100"}}/>}
                </div>);})}
            </div>
          </div>
          {mesDias.map(d=>{const ds=mesDateStr(d);const dt=mesTasksFor(ds);if(!dt.length)return null;const isToday=ds===todayStr;
            return(<div key={d} style={{marginBottom:10}}>
              <div style={{fontSize:10.5,fontWeight:700,color:isToday?BLUE:TEXT2,marginBottom:5,display:"flex",alignItems:"center",gap:5}}>{WFULL[new Date(ds+"T12:00:00").getDay()===0?6:new Date(ds+"T12:00:00").getDay()-1]}, {ptDate(ds)}{isToday&&<span style={{fontSize:8.5,background:BLUE_LIGHT,color:BLUE,borderRadius:4,padding:"1px 5px"}}>HOJE</span>}</div>
              {dt.map((t,i)=><Card key={t.id} t={t} i={i} S={S} compact onToggle={()=>toggleDone(t)} onEdit={()=>openEdit(t)} onDelete={()=>deleteTask(t.id)}/>)}
            </div>);})}
          {!mesDias.some(d=>mesTasksFor(mesDateStr(d)).length>0)&&<Empty icon="📅" msg={`Nenhuma tarefa em ${mesNome}.`}/>}
        </>}

        {/* ── CLIENTES ── */}
        {view==="clientes"&&<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,gap:8,flexWrap:"wrap"}}>
            <div style={S.section}>Painel por Cliente</div>
            <select value={filterClient} onChange={e=>setFilterClient(e.target.value)} style={{...S.inp,width:"auto",padding:"8px 10px",fontSize:13}}>
              <option value="all">Todos os clientes</option>
              {allClients.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {Object.keys(clientPanel).length===0&&<Empty icon="👥" msg="Nenhuma tarefa pendente."/>}
          {Object.entries(clientPanel).sort((a,b)=>b[1].length-a[1].length).map(([client,ctasks])=>{
            const temUrg=ctasks.some(t=>t.priority==="urgente");const temAtras=ctasks.some(t=>t.due<todayStr);
            return(<div key={client} style={{background:"#fff",border:`1.5px solid ${temUrg||temAtras?RED:BORDER}`,borderRadius:10,padding:"12px 14px",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:BLUE_LIGHT,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:BLUE}}>{client.charAt(0).toUpperCase()}</div>
                  <div><div style={{fontWeight:700,fontSize:13,color:TEXT}}>{client}</div><div style={{fontSize:10,color:TEXT2}}>{ctasks.length} pendente{ctasks.length!==1?"s":""}</div></div>
                </div>
                <div style={{display:"flex",gap:5}}>
                  {temAtras&&<span style={{fontSize:9.5,background:RED_LIGHT,color:RED,borderRadius:5,padding:"2px 6px",fontWeight:600}}>⚠️ Atraso</span>}
                  {temUrg&&<span style={{fontSize:9.5,background:RED_LIGHT,color:RED,borderRadius:5,padding:"2px 6px",fontWeight:600}}>🔴 Urgente</span>}
                </div>
              </div>
              {ctasks.map((t,i)=><Card key={t.id} t={t} i={i} S={S} compact onToggle={()=>toggleDone(t)} onEdit={()=>openEdit(t)} onDelete={()=>deleteTask(t.id)}/>)}
            </div>);})}
        </>}

        {/* ── TAREFAS ── */}
        {view==="tarefas"&&<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
            <div style={S.section}>Todas as Tarefas</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{...S.inp,width:"auto",padding:"7px 9px",fontSize:12}}>
                <option value="all">Todas categorias</option>
                {Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
              <select value={filterPri} onChange={e=>setFilterPri(e.target.value)} style={{...S.inp,width:"auto",padding:"7px 9px",fontSize:12}}>
                <option value="all">Todas prioridades</option>
                {Object.entries(PRIORITIES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          {allFiltered.length===0?<Empty icon="🔍" msg="Nenhuma tarefa encontrada."/>:allFiltered.map((t,i)=><Card key={t.id} t={t} i={i} S={S} showDates onToggle={()=>toggleDone(t)} onEdit={()=>openEdit(t)} onDelete={()=>deleteTask(t.id)}/>)}
          {done.length>0&&(
            <div style={{marginTop:16}}>
              <div style={{fontSize:11,fontWeight:600,color:TEXT2,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6,cursor:"pointer",display:"flex",alignItems:"center",gap:5}} onClick={()=>setShowDone(v=>!v)}>✅ Concluídas ({done.length}) {showDone?"▲":"▼"}</div>
              {showDone&&done.map(t=>(
                <div key={t.id} style={{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:9,padding:"9px 12px",display:"flex",alignItems:"center",gap:8,marginBottom:5,opacity:.55}}>
                  <span onClick={()=>toggleDone(t)} style={S.doneDot}>✓</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,textDecoration:"line-through",color:TEXT2}}>{t.title}</div>
                    <div style={{fontSize:10,color:"#B0B8CC",marginTop:2}}>{t.client&&<span style={{marginRight:8}}>👤 {t.client}</span>}<span>Entrada: {ptDate(t.created_at)}</span>{t.completed_at&&<span style={{marginLeft:8}}>✅ {ptDate(t.completed_at)}</span>}</div>
                  </div>
                  <span onClick={()=>deleteTask(t.id)} style={{cursor:"pointer",color:"#C5CAD8",fontSize:13}}>✕</span>
                </div>
              ))}
            </div>
          )}
        </>}

        {/* ── MAPA ── */}
        {view==="mapa"&&<>
          <div style={S.section}>Mapa de Prazos</div>
          <div style={S.sub}>Visão geral por categoria</div>
          {Object.entries(CATEGORIES).map(([k,v])=>{const cat=pending.filter(t=>t.category===k).sort((a,b)=>scoreTask(b)-scoreTask(a));if(!cat.length)return null;
            return(<div key={k} style={{background:"#fff",borderLeft:`4px solid ${v.color}`,border:`1px solid ${v.color}33`,borderRadius:9,padding:"11px 14px",marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:700,color:v.color,marginBottom:7}}>{v.icon} {v.label} <span style={{fontWeight:400,color:TEXT2,fontSize:10.5}}>({cat.length})</span></div>
              {cat.map(t=>{const st=statusInfo(t);const pri=PRIORITIES[t.priority];
                return(<div key={t.id} style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:6,paddingBottom:6,borderBottom:`1px solid ${BORDER}`}}>
                  <span style={{fontSize:10,fontWeight:700,color:pri.color,minWidth:50}}>{pri.dot} {pri.label}</span>
                  <span style={{fontSize:12,color:TEXT,flex:1,minWidth:90}}>{t.title}</span>
                  {t.client&&<span style={{fontSize:10,color:TEXT2}}>👤 {t.client}</span>}
                  <span style={{fontSize:10,background:st.bg,color:st.color,borderRadius:5,padding:"2px 6px",fontWeight:600}}>{st.label}</span>
                  <span style={{fontSize:10,color:TEXT2}}>{ptDate(t.due)}</span>
                </div>);})}
            </div>);})}
          {pending.length===0&&<Empty icon="🎯" msg="Sem tarefas pendentes." sub="Você está em dia!"/>}
        </>}

        {/* ── FECHAMENTO ── */}
        {view==="fechamento"&&<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,flexWrap:"wrap",gap:8}}>
            <div style={S.section}>📁 Fechamento — {MONTHS_PT[new Date().getMonth()]}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <button onClick={startVoice} style={{background:listening?"#C62828":BLUE,color:"#fff",border:"none",borderRadius:7,padding:"8px 14px",fontSize:12,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
                {listening?"🔴 Ouvindo...":"🎤 Voz"}
              </button>
              <button onClick={fetchFechamento} style={{background:"#fff",border:`1px solid ${BORDER}`,color:BLUE,borderRadius:7,padding:"8px 12px",fontSize:12,fontFamily:"inherit",cursor:"pointer"}}>↻</button>
              <button onClick={resetFechamento} style={{background:"#fff",border:`1px solid ${BORDER}`,color:TEXT2,borderRadius:7,padding:"8px 12px",fontSize:12,fontFamily:"inherit",cursor:"pointer"}}>🔄</button>
            </div>
          </div>
          <div style={{background:"#F3E5F5",border:"1px solid #CE93D8",borderRadius:8,padding:"8px 12px",marginBottom:8,fontSize:11,color:"#6A1B9A"}}>
            🎤 Ex: <em>"AutoBraz folha entregue"</em> · <em>"Tower tudo entregue"</em> · <em>"Ligeirinho FGTS WhatsApp"</em>
          </div>
          {voiceLog&&<div style={{background:BLUE_LIGHT,border:`1px solid ${BLUE}`,borderRadius:7,padding:"6px 12px",fontSize:11.5,color:BLUE,marginBottom:8}}>{voiceLog}</div>}
          {fechaLoading?<div style={{textAlign:"center",padding:"30px",color:TEXT2}}>Carregando...</div>:<>
            <div style={{display:"flex",gap:0,marginBottom:14,background:"#fff",borderRadius:10,border:`1px solid ${BORDER}`,overflow:"hidden"}}>
              {[["folha","📋 Folha Ativa"],["dom","🏠 Domésticas"],["sem","📁 Sem Movimento"]].map(([v,l])=>(
                <button key={v} style={{flex:1,background:fechaView===v?BLUE:"#fff",color:fechaView===v?"#fff":TEXT2,border:"none",borderRight:v!=="sem"?`1px solid ${BORDER}`:"none",padding:"11px 4px",fontSize:11.5,fontFamily:"inherit",fontWeight:500,cursor:"pointer"}} onClick={()=>setFechaView(v)}>{l}</button>
              ))}
            </div>

            {fechaView==="folha"&&(
              <div style={{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:10,overflow:"auto",WebkitOverflowScrolling:"touch"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}>
                  <thead>
                    <tr style={{background:BLUE_LIGHT,borderBottom:`2px solid ${BLUE}`}}>
                      <th style={{padding:"8px 10px",textAlign:"left",color:BLUE,fontWeight:700,fontSize:11,minWidth:140,position:"sticky",left:0,background:BLUE_LIGHT}}>Empresa</th>
                      {FOLHA_COLS.map(c=><th key={c} style={{padding:"8px 6px",textAlign:"center",color:BLUE,fontWeight:700,fontSize:10,minWidth:72}}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {FOLHA_ATIVA.map((emp,idx)=>{
                      const allDone=FOLHA_COLS.every(c=>getCell("folha",emp,c).status==="entregue");
                      return(
                        <tr key={emp} style={{borderBottom:`1px solid ${BORDER}`,background:allDone?"#F1FBF4":idx%2===0?"#FAFBFF":"#fff"}}>
                          <td style={{padding:"8px 10px",fontWeight:500,color:TEXT,position:"sticky",left:0,background:allDone?"#F1FBF4":idx%2===0?"#FAFBFF":"#fff",fontSize:12}}>{emp}</td>
                          {FOLHA_COLS.map(col=>{
                            const cell=getCell("folha",emp,col);
                            const entregue=cell.status==="entregue";
                            return(
                              <td key={col} style={{padding:"5px 4px",textAlign:"center",verticalAlign:"middle"}}>
                                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                  <span className="cb" onClick={()=>cycleFolhaStatus(emp,col)} style={{fontSize:18,cursor:"pointer",transition:"transform .15s"}}>{STATUS_ICON[cell.status]}</span>
                                  {entregue&&<select value={cell.via||""} onChange={e=>setFolhaVia(emp,col,e.target.value)} style={{fontSize:8,border:`1px solid ${BORDER}`,borderRadius:3,padding:"1px",background:GRAY,color:TEXT2,cursor:"pointer",maxWidth:60}}>
                                    <option value="">via?</option>
                                    <option value="E-mail">E-mail</option>
                                    <option value="WhatsApp">WhatsApp</option>
                                  </select>}
                                  {entregue&&cell.data_entrega&&<span style={{fontSize:7.5,color:TEXT2}}>{cell.data_entrega}</span>}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{padding:"8px 12px",fontSize:10,color:TEXT2,borderTop:`1px solid ${BORDER}`,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:4}}>
                  <span>⬜→🟡→✅ Clique para avançar</span>
                  <span style={{color:"#2E7D32",fontWeight:600}}>✅ {FOLHA_ATIVA.filter(e=>FOLHA_COLS.every(c=>getCell("folha",e,c).status==="entregue")).length}/{FOLHA_ATIVA.length}</span>
                </div>
              </div>
            )}

            {fechaView==="dom"&&(
              <div style={{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:10,overflow:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead>
                    <tr style={{background:"#F3E5F5",borderBottom:`2px solid #6A1B9A`}}>
                      <th style={{padding:"10px",textAlign:"left",color:"#6A1B9A",fontWeight:700,fontSize:12}}>Empregada</th>
                      {DOM_COLS.map(c=><th key={c} style={{padding:"10px 16px",textAlign:"center",color:"#6A1B9A",fontWeight:700,fontSize:12}}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {DOMESTICAS.map((emp,idx)=>(
                      <tr key={emp} style={{borderBottom:`1px solid ${BORDER}`,background:idx%2===0?"#FAFBFF":"#fff"}}>
                        <td style={{padding:"10px",fontWeight:500,color:TEXT}}>{emp}</td>
                        {DOM_COLS.map(col=>{
                          const cell=getCell("dom",emp,col);
                          return(<td key={col} style={{padding:"8px",textAlign:"center"}}>
                            <span className="cb" onClick={()=>cycleDomStatus(emp,col)} style={{fontSize:22,cursor:"pointer",transition:"transform .15s"}}>{STATUS_ICON[cell.status]}</span>
                          </td>);
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {fechaView==="sem"&&(
              <div style={{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:10,padding:14}}>
                <div style={{fontSize:12,color:TEXT2,marginBottom:12}}>Marque como conferido:</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>
                  {SEM_MOVIMENTO.map(emp=>{
                    const conf=getCell("sem",emp,"conferido").status==="entregue";
                    return(
                      <div key={emp} onClick={()=>toggleSem(emp)} style={{border:`1.5px solid ${conf?"#2E7D32":BORDER}`,borderRadius:8,padding:"10px 12px",cursor:"pointer",background:conf?"#F1FBF4":"#fff",display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:18}}>{conf?"✅":"⬜"}</span>
                        <span style={{fontSize:12.5,color:TEXT,fontWeight:conf?600:400}}>{emp}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{marginTop:12,fontSize:11.5,color:TEXT2,fontWeight:600}}>
                  ✅ {SEM_MOVIMENTO.filter(e=>getCell("sem",e,"conferido").status==="entregue").length}/{SEM_MOVIMENTO.length} conferidas
                </div>
              </div>
            )}
          </>}
        </>}
      </div>

      {/* MENU INFERIOR FIXO */}
      <div style={S.bottomNav}>
        {NAV_ITEMS.map(item=>(
          <div key={item.id} style={S.navItem(view===item.id)} onClick={()=>setView(item.id)}>
            <span style={S.navIcon(view===item.id)}>{item.icon}</span>
            <span style={S.navLabel(view===item.id)}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* MODAL NOVA TAREFA — sobe da base no celular */}
      {showForm&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div style={S.modal}>
            <div style={{width:36,height:4,background:BORDER,borderRadius:2,margin:"0 auto 16px"}}/>
            <div style={{fontWeight:700,fontSize:16,color:BLUE,marginBottom:15,borderBottom:`2px solid ${BLUE_LIGHT}`,paddingBottom:10}}>{editId?"✏️ Editar Tarefa":"✨ Nova Tarefa"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div><label style={S.lbl}>Título *</label><input style={S.inp} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Folha de pagamento maio..."/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div><label style={S.lbl}>Categoria</label><select style={S.inp} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}</select></div>
                <div><label style={S.lbl}>Prioridade</label><select style={S.inp} value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>{Object.entries(PRIORITIES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div><label style={S.lbl}>Prazo</label><input type="date" style={S.inp} value={form.due} onChange={e=>setForm(f=>({...f,due:e.target.value}))}/></div>
                <div><label style={S.lbl}>Data de Entrada</label><input type="date" style={S.inp} value={form.created_at} onChange={e=>setForm(f=>({...f,created_at:e.target.value}))}/></div>
              </div>
              <div><label style={S.lbl}>Cliente</label><input style={S.inp} value={form.client} onChange={e=>setForm(f=>({...f,client:e.target.value}))} placeholder="Nome do cliente..."/></div>
              <div><label style={S.lbl}>Observações</label><textarea style={{...S.inp,resize:"none"}} rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Detalhes adicionais..."/></div>
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button onClick={()=>setShowForm(false)} style={{flex:1,background:"#fff",border:`1px solid ${BORDER}`,color:TEXT2,borderRadius:8,padding:"12px",fontSize:14,fontFamily:"inherit",cursor:"pointer"}}>Cancelar</button>
                <button onClick={saveForm} disabled={saving} style={{flex:2,background:saving?"#90A4AE":BLUE,color:"#fff",border:"none",borderRadius:8,padding:"12px",fontSize:14,fontWeight:700,fontFamily:"inherit",cursor:saving?"not-allowed":"pointer"}}>{saving?"Salvando...":editId?"Salvar":"Criar tarefa"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PROCESSO */}
      {showTemplates&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&(setShowTemplates(false),setSelectedTemplate(null),setTemplateClient(""))}>
          <div style={S.modal}>
            <div style={{width:36,height:4,background:BORDER,borderRadius:2,margin:"0 auto 16px"}}/>
            <div style={{fontWeight:700,fontSize:16,color:"#6A1B9A",marginBottom:14,borderBottom:"2px solid #F3E5F5",paddingBottom:10}}>⚡ Criar Processo</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {Object.entries(PROCESS_TEMPLATES).map(([k,v])=>(
                <div key={k} onClick={()=>setSelectedTemplate(selectedTemplate===k?null:k)} style={{border:`2px solid ${selectedTemplate===k?v.color:BORDER}`,borderRadius:10,padding:"12px",cursor:"pointer",background:selectedTemplate===k?`${v.color}11`:"#fff"}}>
                  <div style={{fontSize:20,marginBottom:4}}>{v.icon}</div>
                  <div style={{fontSize:13,fontWeight:700,color:selectedTemplate===k?v.color:TEXT}}>{v.label}</div>
                  <div style={{fontSize:10,color:TEXT2,marginTop:2}}>{v.steps.length} etapas</div>
                </div>
              ))}
            </div>
            {selectedTemplate&&<>
              <div style={{background:GRAY,borderRadius:8,padding:"10px 12px",marginBottom:12}}>
                {PROCESS_TEMPLATES[selectedTemplate].steps.map((s,i)=>(
                  <div key={i} style={{fontSize:11,color:TEXT,marginBottom:4,display:"flex",alignItems:"flex-start",gap:6}}>
                    <span style={{color:PRIORITIES[s.priority].color,fontWeight:700,fontSize:9,marginTop:2}}>●</span>
                    <span>{s.title} <span style={{color:TEXT2}}>({s.daysFromNow===0?"hoje":"+"+s.daysFromNow+"d"})</span></span>
                  </div>
                ))}
              </div>
              <div style={{marginBottom:12}}><label style={S.lbl}>Cliente *</label><input style={S.inp} value={templateClient} onChange={e=>setTemplateClient(e.target.value)} placeholder="Nome do cliente..."/></div>
            </>}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setShowTemplates(false);setSelectedTemplate(null);setTemplateClient("");}} style={{flex:1,background:"#fff",border:`1px solid ${BORDER}`,color:TEXT2,borderRadius:8,padding:"12px",fontSize:14,fontFamily:"inherit",cursor:"pointer"}}>Cancelar</button>
              <button onClick={createProcess} disabled={!selectedTemplate||!templateClient.trim()||saving} style={{flex:2,background:(!selectedTemplate||!templateClient.trim()||saving)?"#90A4AE":"#6A1B9A",color:"#fff",border:"none",borderRadius:8,padding:"12px",fontSize:14,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>{saving?"Criando...":"Criar etapas"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECORRENTE */}
      {showRecurring&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&(setShowRecurring(false),setRecurringClient(""),setSelectedRecurring([]))}>
          <div style={S.modal}>
            <div style={{width:36,height:4,background:BORDER,borderRadius:2,margin:"0 auto 16px"}}/>
            <div style={{fontWeight:700,fontSize:16,color:"#00838F",marginBottom:14,borderBottom:"2px solid #E0F7FA",paddingBottom:10}}>🔄 Tarefas Recorrentes</div>
            <div style={{marginBottom:12}}><label style={S.lbl}>Cliente *</label><input style={S.inp} value={recurringClient} onChange={e=>setRecurringClient(e.target.value)} placeholder="Nome do cliente..."/></div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:11,color:TEXT2,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.5px"}}>Selecione as tarefas</span>
              <div style={{display:"flex",gap:8}}>
                <span style={{fontSize:11,color:BLUE,cursor:"pointer",fontWeight:600}} onClick={()=>setSelectedRecurring(RECURRING_TEMPLATES.map((_,i)=>i))}>Todas</span>
                <span style={{fontSize:11,color:TEXT2,cursor:"pointer"}} onClick={()=>setSelectedRecurring([])}>Limpar</span>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14,maxHeight:280,overflowY:"auto"}}>
              {RECURRING_TEMPLATES.map((r,i)=>{const sel=selectedRecurring.includes(i);
                return(<div key={i} onClick={()=>setSelectedRecurring(prev=>sel?prev.filter(x=>x!==i):[...prev,i])} style={{border:`1.5px solid ${sel?BLUE:BORDER}`,borderRadius:8,padding:"10px 12px",cursor:"pointer",background:sel?BLUE_LIGHT:"#fff",display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${sel?BLUE:BORDER}`,background:sel?BLUE:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{sel&&<span style={{color:"#fff",fontSize:11,fontWeight:700}}>✓</span>}</div>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:TEXT}}>{CATEGORIES[r.category]?.icon} {r.title}</div><div style={{fontSize:10.5,color:TEXT2}}>Dia {r.dayOfMonth} · {PRIORITIES[r.priority].label}</div></div>
                </div>);})}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setShowRecurring(false);setRecurringClient("");setSelectedRecurring([]);}} style={{flex:1,background:"#fff",border:`1px solid ${BORDER}`,color:TEXT2,borderRadius:8,padding:"12px",fontSize:14,fontFamily:"inherit",cursor:"pointer"}}>Cancelar</button>
              <button onClick={createRecurring} disabled={!recurringClient.trim()||selectedRecurring.length===0||saving} style={{flex:2,background:(!recurringClient.trim()||selectedRecurring.length===0||saving)?"#90A4AE":"#00838F",color:"#fff",border:"none",borderRadius:8,padding:"12px",fontSize:14,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>{saving?"Criando...":"Criar "+selectedRecurring.length+" tarefa"+(selectedRecurring.length!==1?"s":"")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({t,i,S,onToggle,onEdit,onDelete,compact,showDates}){
  const cat=CATEGORIES[t.category]||CATEGORIES.fiscal;
  const pri=PRIORITIES[t.priority]||PRIORITIES.media;
  const st=statusInfo(t);
  const isProx=diffDays(t.due)>0;
  return(
    <div className="tc" style={{...S.card,borderLeft:`4px solid ${cat.color}`,background:isProx&&(t.priority==="urgente"||t.priority==="alta")?"#FFFBF0":"#fff"}}>
      <span onClick={onToggle} style={S.circle(cat.color)} title="Concluir"/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:compact?0:4}}>
          <span style={{fontSize:compact?12:13.5,fontWeight:600,color:TEXT,lineHeight:1.3}}>{t.title}</span>
        </div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:4}}>
          <span style={S.badge(cat.color,cat.bg)}>{cat.icon} {cat.label}</span>
          <span style={S.badge(pri.color,pri.bg)}>{pri.dot} {pri.label}</span>
          {isProx&&(t.priority==="urgente"||t.priority==="alta")&&<span style={S.badge("#E65100","#FFF3E0")}>⚡ próx.7d</span>}
        </div>
        {!compact&&(t.client||t.notes||showDates)&&<div style={{fontSize:10.5,color:TEXT2,display:"flex",gap:10,flexWrap:"wrap",marginTop:5}}>
          {t.client&&<span>👤 {t.client}</span>}
          {t.notes&&<span>📝 {t.notes}</span>}
          {showDates&&<span>📅 {ptDate(t.created_at)}</span>}
        </div>}
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
        <span style={{fontSize:10,background:st.bg,color:st.color,borderRadius:5,padding:"3px 7px",fontWeight:600,whiteSpace:"nowrap"}}>{st.label}</span>
        <div style={{display:"flex",gap:4}}>
          <span onClick={onEdit} style={{cursor:"pointer",color:"#90A4AE",fontSize:14,padding:"2px 4px"}}>✏️</span>
          <span onClick={onDelete} style={{cursor:"pointer",color:"#CFD8DC",fontSize:14,padding:"2px 4px"}}>✕</span>
        </div>
      </div>
    </div>
  );
}

function Empty({icon,msg,sub}){
  return(<div style={{textAlign:"center",padding:"44px 0",color:"#B0B8CC"}}>
    <div style={{fontSize:36,marginBottom:8}}>{icon}</div>
    <div style={{fontWeight:600,fontSize:14,color:TEXT2}}>{msg}</div>
    {sub&&<div style={{fontSize:12,marginTop:4}}>{sub}</div>}
  </div>);
}

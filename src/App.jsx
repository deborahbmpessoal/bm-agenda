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

// PROCESSOS CORRIGIDOS
const PROCESS_TEMPLATES={
  folha:{
    label:"Folha de Pagamento",icon:"💼",category:"dp",color:"#6A1B9A",
    steps:[
      {title:"Aguardar informações do cliente (comissão, horas extras, adicional noturno, adiantamento, faltas)",priority:"alta",daysFromNow:0},
      {title:"Lançar variáveis no sistema",priority:"alta",daysFromNow:1},
      {title:"Apurar e fechar a folha",priority:"urgente",daysFromNow:2},
      {title:"Enviar para o cliente conferir",priority:"urgente",daysFromNow:3},
      {title:"Aguardar OK do cliente",priority:"alta",daysFromNow:4},
      {title:"Liberar holerites",priority:"urgente",daysFromNow:5},
      {title:"Gerar DARF INSS e FGTS",priority:"urgente",daysFromNow:6},
      {title:"Enviar guias para o cliente pagar",priority:"urgente",daysFromNow:7},
    ]
  },
  rescisao:{
    label:"Rescisão Trabalhista",icon:"📄",category:"rescisao",color:"#B71C1C",
    steps:[
      {title:"Receber comunicado de rescisão",priority:"urgente",daysFromNow:0},
      {title:"Verificar tipo de rescisão (justa causa, pedido, acordo...)",priority:"alta",daysFromNow:1},
      {title:"Calcular verbas rescisórias (TRCT)",priority:"urgente",daysFromNow:2},
      {title:"Emitir guia FGTS + baixa na CTPS/eSocial",priority:"urgente",daysFromNow:3},
      {title:"Emitir Termo de Rescisão (TRCT)",priority:"alta",daysFromNow:4},
      {title:"Arquivar documentação da rescisão",priority:"media",daysFromNow:5},
    ]
  },
  admissao:{
    label:"Admissão de Funcionário",icon:"👤",category:"dp",color:"#6A1B9A",
    steps:[
      {title:"Receber documentos do novo funcionário",priority:"urgente",daysFromNow:0},
      {title:"Verificar documentação (RG, CPF, CTPS)",priority:"alta",daysFromNow:0},
      {title:"Registrar admissão no eSocial",priority:"urgente",daysFromNow:1},
      {title:"Assinar contrato de trabalho",priority:"alta",daysFromNow:1},
      {title:"Incluir na folha de pagamento",priority:"alta",daysFromNow:3},
      {title:"Arquivar documentação de admissão",priority:"baixa",daysFromNow:5},
    ]
  },
  ferias:{
    label:"Férias de Funcionário",icon:"🏖️",category:"dp",color:"#6A1B9A",
    steps:[
      {title:"Verificar período aquisitivo de férias",priority:"media",daysFromNow:0},
      {title:"Notificar funcionário com 30 dias de antecedência",priority:"alta",daysFromNow:0},
      {title:"Calcular valores das férias + 1/3",priority:"alta",daysFromNow:5},
      {title:"Emitir recibo de férias",priority:"alta",daysFromNow:7},
      {title:"Pagar férias (até 2 dias antes do início)",priority:"urgente",daysFromNow:8},
      {title:"Registrar férias no eSocial",priority:"alta",daysFromNow:9},
    ]
  },
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

// FECHAMENTO MENSAL — EMPRESAS
const FOLHA_ATIVA=[
  "Acervo Chop","AutoBraz","Blindar Contagem","Cantina Freitas","Cleiton Martins","Cledson Elevadores",
  "Control Vt","Decora","Deposito Cerveja MTZ","Di France","Espaço Presentes","Espaço Vitta Pilates",
  "Flavia FSA","FOCO","Ge Car","Guindaumaq","HJ Peças","Jeovane","Ligeirinho","M&R Placas",
  "M3 Comércio","Magnus Imóveis","Marcelo Transporte","MDC Locação","MG5","Milton Tem Tem",
  "Natal MTZ","Natalia Mota","Nivair","OMR Entregas","Opção Locação","Opção Visual",
  "PRONTOVET Ibirité","R&E Top Diesel","RDS","Frutos de Minas Barreiro","Frutos de Minas Barreiro FL",
  "Rede Frutos de Minas Betim","Frutos de Minas Betim FL","Res Lealdo","Rodrigar","Rosálio Duarte",
  "SEGUROBRAS","Stenner","Shopping das Peças","Tower","T&R"
];
const DOMESTICAS=["Elza Maria","Maria dos Anjos","Leonídia","Eliane","Eduardo Freitas","Sandra","Geraldo"];
const SEM_MOVIMENTO=[
  "Antonio Clareti","Blindar Ibirité","By Tracker","CT Treinamento","Deposito Cerveja FL",
  "EABorges","Heleno","Marc Textil","Merc. Manhumirim","Natal FL","NetForce","Piazza Peças",
  "Pulga Car","Quintal Fornalha","Protagon","PROFISS","Ramon Carvalho MEI","RDL Holding",
  "Tiago Alves","Valente"
];
const FOLHA_COLS=["Folha","DARF","FGTS","Adiantamento","REINF","eCons"];
const DOM_COLS=["Folha","Guia","Status"];
const STATUS_CYCLE=["pendente","andamento","entregue"];
const STATUS_ICON={"pendente":"⬜","andamento":"🟡","entregue":"✅"};

function getCurrentMonthKey(){ const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; }
function getFechamentoKey(){ return `fechamento_${getCurrentMonthKey()}`; }
function buildInitialFechamento(){
  const folha={};
  FOLHA_ATIVA.forEach(e=>{
    folha[e]={};
    FOLHA_COLS.forEach(c=>{ folha[e][c]={status:"pendente",via:"",data:""}; });
  });
  const dom={};
  DOMESTICAS.forEach(e=>{ dom[e]={}; DOM_COLS.forEach(c=>{ dom[e][c]={status:"pendente"}; }); });
  const sem={};
  SEM_MOVIMENTO.forEach(e=>{ sem[e]={conferido:false}; });
  return {folha,dom,sem,monthKey:getCurrentMonthKey()};
}

function normalizeStr(s){ return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g," ").trim(); }
function fuzzyMatch(query,target){ const q=normalizeStr(query); const t=normalizeStr(target); if(t.includes(q)||q.includes(t))return true; const qw=q.split(" ").filter(x=>x.length>2); return qw.length>0&&qw.every(w=>t.includes(w)); }

const today=new Date(); today.setHours(0,0,0,0);
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
function statusInfo(t){const d=diffDays(t.due);if(d<0)return{label:`${Math.abs(d)}d em atraso`,color:RED,bg:RED_LIGHT};if(d===0)return{label:"Hoje",color:BLUE,bg:BLUE_LIGHT};if(d===1)return{label:"Amanhã",color:"#E65100",bg:"#FFF3E0"};return{label:`Em ${d}d`,color:TEXT2,bg:GRAY};}

export default function App(){
  const [tasks,setTasks]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [view,setView]=useState("agenda");
  const [showForm,setShowForm]=useState(false);
  const [showTemplates,setShowTemplates]=useState(false);
  const [showRecurring,setShowRecurring]=useState(false);
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
  const [fechamento,setFechamento]=useState(null);
  const [fechaView,setFechaView]=useState("folha");
  const [listening,setListening]=useState(false);
  const [voiceLog,setVoiceLog]=useState("");
  const recognitionRef=useRef(null);
  const emptyForm={title:"",category:"dp",priority:"media",due:todayStr,client:"",notes:"",created_at:todayStr,completed_at:""};
  const [form,setForm]=useState(emptyForm);

  useEffect(()=>{fetchTasks();loadFechamento();},[]);

  async function fetchTasks(){
    setLoading(true);
    const{data}=await supabase.from("tasks").select("*").order("due",{ascending:true});
    setTasks(data||[]);setLoading(false);
  }

  function loadFechamento(){
    const key=getFechamentoKey();
    const stored=localStorage.getItem(key);
    if(stored){
      const parsed=JSON.parse(stored);
      if(parsed.monthKey===getCurrentMonthKey()){setFechamento(parsed);return;}
    }
    const fresh=buildInitialFechamento();
    localStorage.setItem(key,JSON.stringify(fresh));
    setFechamento(fresh);
  }

  function saveFechamento(updated){
    const key=getFechamentoKey();
    localStorage.setItem(key,JSON.stringify(updated));
    setFechamento({...updated});
  }

  function cycleFolhaStatus(empresa,col){
    const f={...fechamento};
    const cur=f.folha[empresa][col].status;
    const next=STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur)+1)%STATUS_CYCLE.length];
    const data=next==="entregue"?new Date().toLocaleDateString("pt-BR"):"";
    f.folha[empresa][col]={...f.folha[empresa][col],status:next,data};
    saveFechamento(f);
  }

  function setFolhaVia(empresa,col,via){
    const f={...fechamento};
    f.folha[empresa][col]={...f.folha[empresa][col],via};
    saveFechamento(f);
  }

  function cycleDomStatus(empresa,col){
    const f={...fechamento};
    const cur=f.dom[empresa][col].status;
    const next=STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur)+1)%STATUS_CYCLE.length];
    f.dom[empresa][col]={status:next};
    saveFechamento(f);
  }

  function toggleSem(empresa){
    const f={...fechamento};
    f.sem[empresa].conferido=!f.sem[empresa].conferido;
    saveFechamento(f);
  }

  function resetFechamento(){
    const fresh=buildInitialFechamento();
    const key=getFechamentoKey();
    localStorage.setItem(key,JSON.stringify(fresh));
    setFechamento(fresh);
    showToast("Painel resetado para novo ciclo!");
  }

  // VOZ
  function startVoice(){
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SpeechRecognition){showToast("Navegador não suporta voz","err");return;}
    const r=new SpeechRecognition();
    r.lang="pt-BR"; r.continuous=false; r.interimResults=false;
    r.onstart=()=>setListening(true);
    r.onend=()=>setListening(false);
    r.onerror=()=>{setListening(false);showToast("Erro no microfone","err");};
    r.onresult=(e)=>{
      const txt=e.results[0][0].transcript.toLowerCase();
      setVoiceLog(`"${txt}"`);
      processVoiceCommand(txt);
    };
    recognitionRef.current=r;
    r.start();
  }

  function processVoiceCommand(txt){
    const f={...fechamento};
    let matched=false;

    // "tudo entregue"
    const tudoMatch=txt.match(/(.+?)\s+tudo entregue/);
    if(tudoMatch){
      const q=tudoMatch[1].trim();
      FOLHA_ATIVA.forEach(emp=>{
        if(fuzzyMatch(q,emp)){
          FOLHA_COLS.forEach(col=>{
            f.folha[emp][col]={status:"entregue",via:f.folha[emp][col].via,data:new Date().toLocaleDateString("pt-BR")};
          });
          matched=true;
          showToast(`✅ ${emp} — tudo entregue!`);
        }
      });
    }

    // "via whatsapp" ou "adiantamento whatsapp"
    const viaMatch=txt.match(/(.+?)\s+(adiantamento|folha|darf|fgts|reinf|econs?)\s+(whatsapp|email|e-mail)/);
    if(!matched&&viaMatch){
      const q=viaMatch[1].trim();
      const colRaw=viaMatch[2];
      const viaRaw=viaMatch[3];
      const colMap={adiantamento:"Adiantamento",folha:"Folha",darf:"DARF",fgts:"FGTS",reinf:"REINF",econs:"eCons",econ:"eCons"};
      const col=colMap[colRaw]||null;
      const via=viaRaw.includes("whats")?"WhatsApp":"E-mail";
      if(col){
        FOLHA_ATIVA.forEach(emp=>{
          if(fuzzyMatch(q,emp)){
            f.folha[emp][col]={status:"entregue",via,data:new Date().toLocaleDateString("pt-BR")};
            matched=true;
            showToast(`✅ ${emp} — ${col} via ${via}`);
          }
        });
      }
    }

    // "marcar X coluna entregue"
    const marcarMatch=txt.match(/marcar\s+(.+?)\s+(folha|darf|fgts|adiantamento|reinf|econs?)\s+entregue/);
    if(!matched&&marcarMatch){
      const q=marcarMatch[1].trim();
      const colRaw=marcarMatch[2];
      const colMap={folha:"Folha",darf:"DARF",fgts:"FGTS",adiantamento:"Adiantamento",reinf:"REINF",econs:"eCons",econ:"eCons"};
      const col=colMap[colRaw]||null;
      if(col){
        FOLHA_ATIVA.forEach(emp=>{
          if(fuzzyMatch(q,emp)){
            f.folha[emp][col]={status:"entregue",via:f.folha[emp][col].via,data:new Date().toLocaleDateString("pt-BR")};
            matched=true;
            showToast(`✅ ${emp} — ${col} entregue`);
          }
        });
      }
    }

    if(!matched)showToast(`Não entendi: ${txt}`,"err");
    else saveFechamento(f);
  }

  function showToast(msg,type="ok"){setToast({msg,type});setTimeout(()=>setToast(null),3500);}

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

  async function deleteTask(id){
    await supabase.from("tasks").delete().eq("id",id);
    setTasks(prev=>prev.filter(x=>x.id!==id));showToast("Removida");
  }

  function openEdit(t){
    setForm({title:t.title,category:t.category,priority:t.priority,due:t.due,client:t.client||"",notes:t.notes||"",created_at:t.created_at||todayStr,completed_at:t.completed_at||""});
    setEditId(t.id);setShowForm(true);
  }

  async function createProcess(){
    if(!selectedTemplate||!templateClient.trim())return;
    setSaving(true);
    const tpl=PROCESS_TEMPLATES[selectedTemplate];
    const inserts=tpl.steps.map(s=>({title:s.title,category:tpl.category,priority:s.priority,due:fmtDate(addDays(today,s.daysFromNow)),client:templateClient,notes:`Processo: ${tpl.label}`,created_at:todayStr,completed_at:null,done:false}));
    await supabase.from("tasks").insert(inserts);
    showToast(`${tpl.steps.length} tarefas criadas!`);
    setShowTemplates(false);setSelectedTemplate(null);setTemplateClient("");setSaving(false);fetchTasks();
  }

  async function createRecurring(){
    if(!recurringClient.trim()||selectedRecurring.length===0)return;
    setSaving(true);
    const inserts=selectedRecurring.map(idx=>{const r=RECURRING_TEMPLATES[idx];return{title:r.title,category:r.category,priority:r.priority,due:fmtDayOfMonth(r.dayOfMonth),client:recurringClient,notes:r.notes,created_at:todayStr,completed_at:null,done:false};});
    await supabase.from("tasks").insert(inserts);
    showToast(`${inserts.length} tarefas criadas!`);
    setShowRecurring(false);setRecurringClient("");setSelectedRecurring([]);setSaving(false);fetchTasks();
  }

  const weekStart=getWeekStart(today);
  const weekDays=Array.from({length:7},(_,i)=>addDays(weekStart,i));
  const in7days=fmtDate(addDays(today,7));
  const pending=tasks.filter(t=>!t.done);
  const done=tasks.filter(t=>t.done);
  const allClients=useMemo(()=>[...new Set(tasks.map(t=>t.client).filter(Boolean))].sort(),[tasks]);

  const todayTasks=useMemo(()=>{
    const base=pending.filter(t=>t.due<=todayStr);
    const prox7=pending.filter(t=>t.due>todayStr&&t.due<=in7days&&(t.priority==="urgente"||t.priority==="alta"));
    const ids=new Set(base.map(t=>t.id));
    return[...base,...prox7.filter(t=>!ids.has(t.id))].sort((a,b)=>scoreTask(b)-scoreTask(a));
  },[tasks]);

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
    {label:"Agenda Hoje",val:todayTasks.length,color:BLUE,bg:BLUE_LIGHT},
    {label:"Em Atraso",val:pending.filter(t=>t.due<todayStr).length,color:RED,bg:RED_LIGHT},
    {label:"Esta Semana",val:pending.filter(t=>t.due>=fmtDate(weekStart)&&t.due<=fmtDate(addDays(weekStart,6))).length,color:"#00838F",bg:"#E0F7FA"},
    {label:"Clientes",val:allClients.length,color:"#2E7D32",bg:"#E8F5E9"},
  ];

  const S={
    root:{fontFamily:"'Segoe UI',Arial,sans-serif",background:"#F0F3FA",minHeight:"100vh",color:TEXT},
    header:{background:"#fff",borderBottom:`2px solid ${BLUE}`,padding:"0 14px",height:60,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,gap:5},
    logoMark:{width:32,height:32,borderRadius:7,background:BLUE,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:13,flexShrink:0},
    logoName:{fontSize:12,fontWeight:700,color:BLUE},
    logoSub:{fontSize:8.5,color:TEXT2,textTransform:"uppercase",letterSpacing:"1px"},
    nav:{display:"flex",gap:2,flexWrap:"wrap"},
    navBtn:(a)=>({background:a?BLUE:"transparent",color:a?"#fff":TEXT2,border:`1px solid ${a?BLUE:BORDER}`,borderRadius:6,padding:"4px 8px",fontSize:11,fontFamily:"inherit",fontWeight:500,cursor:"pointer"}),
    addBtn:{background:RED,color:"#fff",border:"none",borderRadius:7,padding:"6px 11px",fontSize:11.5,fontWeight:700,fontFamily:"inherit",cursor:"pointer",flexShrink:0},
    quickBtn:(c)=>({background:c,color:"#fff",border:"none",borderRadius:7,padding:"6px 10px",fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:"pointer",flexShrink:0}),
    main:{maxWidth:1200,margin:"0 auto",padding:"16px 12px"},
    card:{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:10,padding:"10px 13px",display:"flex",alignItems:"flex-start",gap:9,marginBottom:6},
    badge:(c,bg)=>({background:bg,color:c,border:`1px solid ${c}33`,borderRadius:5,padding:"1px 6px",fontSize:9.5,fontWeight:600,whiteSpace:"nowrap"}),
    circle:(c)=>({width:20,height:20,borderRadius:"50%",border:`2px solid ${c}`,flexShrink:0,cursor:"pointer",marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:c}),
    doneDot:{width:20,height:20,borderRadius:"50%",background:"#2E7D32",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",cursor:"pointer",marginTop:2},
    section:{fontWeight:700,fontSize:18,color:TEXT,marginBottom:3},
    sub:{fontSize:11,color:TEXT2,marginBottom:13},
    overlay:{position:"fixed",inset:0,background:"rgba(20,40,80,0.4)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:12},
    modal:{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:14,padding:20,width:"100%",maxWidth:520,maxHeight:"92vh",overflowY:"auto"},
    label:{fontSize:10,color:TEXT2,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.5px",fontWeight:600},
    input:{width:"100%",background:GRAY,border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 10px",color:TEXT,fontSize:13,fontFamily:"inherit"},
  };

  if(loading)return(
    <div style={{...S.root,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14}}>
      <div style={{width:32,height:32,borderRadius:"50%",border:`3px solid ${BORDER}`,borderTop:`3px solid ${BLUE}`,animation:"spin .8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{color:TEXT2,fontSize:13}}>Carregando...</div>
    </div>
  );

  return(
    <div style={S.root}>
      <style>{`.tc:hover{box-shadow:0 2px 10px rgba(21,101,192,.10)} .cell-btn:hover{opacity:.8}`}</style>
      {toast&&<div style={{position:"fixed",bottom:20,right:20,zIndex:999,background:toast.type==="err"?RED:BLUE,color:"#fff",borderRadius:10,padding:"10px 16px",fontSize:12.5,fontWeight:600,boxShadow:"0 4px 16px rgba(0,0,0,.2)"}}>{toast.msg}</div>}

      {/* HEADER */}
      <div style={S.header}>
        <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
          <div style={S.logoMark}>BM</div>
          <div><div style={S.logoName}>BM CONTABILIDADE</div><div style={S.logoSub}>Agenda Inteligente Contábil</div></div>
        </div>
        <div style={S.nav}>
          {[["agenda","📅 Hoje"],["semana","🗓 Semana"],["mes","📆 Mês"],["clientes","👥 Clientes"],["tarefas","📋 Tarefas"],["mapa","📊 Mapa"],["fechamento","📁 Fechamento"]].map(([v,l])=>(
            <button key={v} style={S.navBtn(view===v)} onClick={()=>setView(v)}>{l}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:4}}>
          <button style={S.quickBtn("#6A1B9A")} onClick={()=>setShowTemplates(true)}>⚡ Processo</button>
          <button style={S.quickBtn("#00838F")} onClick={()=>setShowRecurring(true)}>🔄 Recorrente</button>
          <button style={S.addBtn} onClick={()=>{setEditId(null);setForm(emptyForm);setShowForm(true)}}>+ Nova</button>
        </div>
      </div>

      <div style={S.main}>
        {/* STATS */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
          {stats.map(s=>(
            <div key={s.label} style={{background:s.bg,border:`1px solid ${BORDER}`,borderRadius:11,padding:"11px 14px"}}>
              <div style={{fontSize:24,fontWeight:700,color:s.color,lineHeight:1}}>{s.val}</div>
              <div style={{fontSize:10.5,color:s.color,marginTop:3,fontWeight:500}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── HOJE ── */}
        {view==="agenda"&&<>
          <div style={S.section}>Agenda de Hoje</div>
          <div style={S.sub}>
            {today.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
            {todayTasks.filter(t=>diffDays(t.due)>0).length>0&&
              <span style={{marginLeft:8,background:"#FFF3E0",color:"#E65100",borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:600}}>
                ⚡ {todayTasks.filter(t=>diffDays(t.due)>0).length} urgente(s) dos próx. 7 dias
              </span>}
          </div>
          {todayTasks.length===0?<Empty icon="🎉" msg="Nenhuma tarefa urgente para hoje!"/>
            :todayTasks.map((t,i)=><Card key={t.id} t={t} i={i} S={S} onToggle={()=>toggleDone(t)} onEdit={()=>openEdit(t)} onDelete={()=>deleteTask(t.id)}/>)}
        </>}

        {/* ── SEMANA ── */}
        {view==="semana"&&<>
          <div style={S.section}>Agenda da Semana</div>
          <div style={S.sub}>{weekStart.toLocaleDateString("pt-BR",{day:"numeric",month:"short"})} – {addDays(weekStart,6).toLocaleDateString("pt-BR",{day:"numeric",month:"short",year:"numeric"})}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5,marginBottom:16}}>
            {weekDays.map((day,i)=>{const ds=fmtDate(day);const dt=weekTasksFor(ds);const isToday=ds===todayStr;const isPast=ds<todayStr;
              return(<div key={ds} style={{background:isToday?BLUE_LIGHT:"#fff",border:`1px solid ${isToday?BLUE:BORDER}`,borderRadius:8,padding:"7px 6px",minHeight:100}}>
                <div style={{fontSize:9,color:isToday?BLUE:TEXT2,fontWeight:600,textTransform:"uppercase"}}>{WDAYS[i]}</div>
                <div style={{fontSize:16,fontWeight:700,color:isToday?BLUE:isPast?"#C5CAD8":TEXT}}>{day.getDate()}</div>
                <div style={{display:"flex",flexDirection:"column",gap:2,marginTop:3}}>
                  {dt.map(t=><div key={t.id} style={{background:CATEGORIES[t.category]?.bg||BLUE_LIGHT,color:CATEGORIES[t.category]?.color||BLUE,borderRadius:3,padding:"2px 3px",fontSize:8.5,lineHeight:1.3,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{CATEGORIES[t.category]?.icon} {t.title}</div>)}
                  {dt.length===0&&<div style={{fontSize:9,color:"#C5CAD8",textAlign:"center",marginTop:4}}>—</div>}
                </div>
              </div>);
            })}
          </div>
          {weekDays.map((day,i)=>{const ds=fmtDate(day);const dt=weekTasksFor(ds);if(!dt.length)return null;const isToday=ds===todayStr;
            return(<div key={ds} style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:isToday?BLUE:TEXT2,marginBottom:6,display:"flex",alignItems:"center",gap:5}}>
                {WFULL[i]}, {day.toLocaleDateString("pt-BR",{day:"numeric",month:"short"})}
                {isToday&&<span style={{fontSize:9,background:BLUE_LIGHT,color:BLUE,borderRadius:4,padding:"1px 5px"}}>HOJE</span>}
              </div>
              {dt.map((t,i)=><Card key={t.id} t={t} i={i} S={S} compact onToggle={()=>toggleDone(t)} onEdit={()=>openEdit(t)} onDelete={()=>deleteTask(t.id)}/>)}
            </div>);
          })}
        </>}

        {/* ── MÊS ── */}
        {view==="mes"&&<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
            <div style={S.section}>Panorama Mensal</div>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <button onClick={()=>setMesOffset(o=>o-1)} style={{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:13,color:TEXT}}>‹</button>
              <span style={{fontWeight:700,fontSize:13,color:BLUE,minWidth:120,textAlign:"center"}}>{mesNome} {mesAno}</span>
              <button onClick={()=>setMesOffset(o=>o+1)} style={{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:13,color:TEXT}}>›</button>
              {mesOffset!==0&&<button onClick={()=>setMesOffset(0)} style={{background:BLUE_LIGHT,border:`1px solid ${BLUE}`,borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:10,color:BLUE,fontWeight:600}}>Hoje</button>}
            </div>
          </div>
          <div style={S.sub}>Visão completa do mês</div>
          <div style={{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:10,padding:11,marginBottom:16}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
              {WDAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:9,fontWeight:600,color:TEXT2,padding:"3px 0"}}>{d}</div>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
              {Array.from({length:offsetInicio},(_,i)=><div key={"e"+i}/>)}
              {mesDias.map(d=>{const ds=mesDateStr(d);const dt=mesTasksFor(ds);const isToday=ds===todayStr;const isPast=ds<todayStr;const temUrg=dt.some(t=>t.priority==="urgente");const temAlta=dt.some(t=>t.priority==="alta");
                return(<div key={d} style={{minHeight:48,border:`1px solid ${isToday?BLUE:BORDER}`,borderRadius:5,padding:"3px 4px",background:isToday?BLUE_LIGHT:isPast?"#FAFAFA":"#fff",position:"relative"}}>
                  <div style={{fontSize:10.5,fontWeight:isToday?700:400,color:isToday?BLUE:isPast?"#C5CAD8":TEXT}}>{d}</div>
                  {dt.slice(0,2).map(t=><div key={t.id} style={{fontSize:7.5,background:CATEGORIES[t.category]?.bg||BLUE_LIGHT,color:CATEGORIES[t.category]?.color||BLUE,borderRadius:2,padding:"1px 2px",marginTop:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{t.title}</div>)}
                  {dt.length>2&&<div style={{fontSize:7,color:TEXT2}}>+{dt.length-2}</div>}
                  {temUrg&&<div style={{position:"absolute",top:2,right:2,width:5,height:5,borderRadius:"50%",background:RED}}/>}
                  {!temUrg&&temAlta&&<div style={{position:"absolute",top:2,right:2,width:5,height:5,borderRadius:"50%",background:"#E65100"}}/>}
                </div>);
              })}
            </div>
          </div>
          {mesDias.map(d=>{const ds=mesDateStr(d);const dt=mesTasksFor(ds);if(!dt.length)return null;const isToday=ds===todayStr;
            return(<div key={d} style={{marginBottom:11}}>
              <div style={{fontSize:10.5,fontWeight:700,color:isToday?BLUE:TEXT2,marginBottom:5,display:"flex",alignItems:"center",gap:5}}>
                {WFULL[new Date(ds+"T12:00:00").getDay()===0?6:new Date(ds+"T12:00:00").getDay()-1]}, {ptDate(ds)}
                {isToday&&<span style={{fontSize:8.5,background:BLUE_LIGHT,color:BLUE,borderRadius:4,padding:"1px 5px"}}>HOJE</span>}
              </div>
              {dt.map((t,i)=><Card key={t.id} t={t} i={i} S={S} compact onToggle={()=>toggleDone(t)} onEdit={()=>openEdit(t)} onDelete={()=>deleteTask(t.id)}/>)}
            </div>);
          })}
          {!mesDias.some(d=>mesTasksFor(mesDateStr(d)).length>0)&&<Empty icon="📅" msg={`Nenhuma tarefa em ${mesNome}.`}/>}
        </>}

        {/* ── CLIENTES ── */}
        {view==="clientes"&&<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,flexWrap:"wrap",gap:8}}>
            <div style={S.section}>Painel por Cliente</div>
            <select value={filterClient} onChange={e=>setFilterClient(e.target.value)} style={{...S.input,width:"auto",padding:"5px 9px"}}>
              <option value="all">Todos os clientes</option>
              {allClients.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={S.sub}>Tarefas pendentes agrupadas por cliente</div>
          {Object.keys(clientPanel).length===0&&<Empty icon="👥" msg="Nenhuma tarefa pendente."/>}
          {Object.entries(clientPanel).sort((a,b)=>b[1].length-a[1].length).map(([client,ctasks])=>{
            const temUrg=ctasks.some(t=>t.priority==="urgente");const temAtras=ctasks.some(t=>t.due<todayStr);
            return(<div key={client} style={{background:"#fff",border:`1.5px solid ${temUrg||temAtras?RED:BORDER}`,borderRadius:10,padding:"12px 14px",marginBottom:11}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:30,height:30,borderRadius:"50%",background:BLUE_LIGHT,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:BLUE}}>{client.charAt(0).toUpperCase()}</div>
                  <div><div style={{fontWeight:700,fontSize:13,color:TEXT}}>{client}</div><div style={{fontSize:10,color:TEXT2}}>{ctasks.length} tarefa{ctasks.length!==1?"s":""} pendente{ctasks.length!==1?"s":""}</div></div>
                </div>
                <div style={{display:"flex",gap:5}}>
                  {temAtras&&<span style={{fontSize:9.5,background:RED_LIGHT,color:RED,borderRadius:5,padding:"2px 6px",fontWeight:600}}>⚠️ Atrasada</span>}
                  {temUrg&&<span style={{fontSize:9.5,background:RED_LIGHT,color:RED,borderRadius:5,padding:"2px 6px",fontWeight:600}}>🔴 Urgente</span>}
                </div>
              </div>
              {ctasks.map((t,i)=><Card key={t.id} t={t} i={i} S={S} compact onToggle={()=>toggleDone(t)} onEdit={()=>openEdit(t)} onDelete={()=>deleteTask(t.id)}/>)}
            </div>);
          })}
        </>}

        {/* ── TAREFAS ── */}
        {view==="tarefas"&&<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
            <div style={S.section}>Todas as Tarefas</div>
            <div style={{display:"flex",gap:5}}>
              <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{...S.input,width:"auto",padding:"5px 8px",fontSize:11.5}}>
                <option value="all">Todas categorias</option>
                {Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
              <select value={filterPri} onChange={e=>setFilterPri(e.target.value)} style={{...S.input,width:"auto",padding:"5px 8px",fontSize:11.5}}>
                <option value="all">Todas prioridades</option>
                {Object.entries(PRIORITIES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          {allFiltered.length===0?<Empty icon="🔍" msg="Nenhuma tarefa encontrada."/>:allFiltered.map((t,i)=><Card key={t.id} t={t} i={i} S={S} showDates onToggle={()=>toggleDone(t)} onEdit={()=>openEdit(t)} onDelete={()=>deleteTask(t.id)}/>)}
          {done.length>0&&(
            <div style={{marginTop:18}}>
              <div style={{fontSize:11,fontWeight:600,color:TEXT2,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6,cursor:"pointer",display:"flex",alignItems:"center",gap:5}} onClick={()=>setShowDone(v=>!v)}>
                ✅ Concluídas ({done.length}) {showDone?"▲":"▼"}
              </div>
              {showDone&&done.map(t=>(
                <div key={t.id} style={{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:9,padding:"8px 12px",display:"flex",alignItems:"center",gap:8,marginBottom:5,opacity:.55}}>
                  <span onClick={()=>toggleDone(t)} style={S.doneDot}>✓</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,textDecoration:"line-through",color:TEXT2}}>{t.title}</div>
                    <div style={{fontSize:10,color:"#B0B8CC",marginTop:2}}>
                      {t.client&&<span style={{marginRight:8}}>👤 {t.client}</span>}
                      <span>Entrada: {ptDate(t.created_at)}</span>
                      {t.completed_at&&<span style={{marginLeft:8}}>Concluída: {ptDate(t.completed_at)}</span>}
                    </div>
                  </div>
                  <span onClick={()=>deleteTask(t.id)} style={{cursor:"pointer",color:"#C5CAD8",fontSize:12}}>✕</span>
                </div>
              ))}
            </div>
          )}
        </>}

        {/* ── MAPA ── */}
        {view==="mapa"&&<>
          <div style={S.section}>Mapa de Prazos e Prioridades</div>
          <div style={S.sub}>Visão geral por categoria</div>
          {Object.entries(CATEGORIES).map(([k,v])=>{const cat=pending.filter(t=>t.category===k).sort((a,b)=>scoreTask(b)-scoreTask(a));if(!cat.length)return null;
            return(<div key={k} style={{background:"#fff",borderLeft:`4px solid ${v.color}`,border:`1px solid ${v.color}33`,borderRadius:9,padding:"11px 14px",marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:700,color:v.color,marginBottom:7}}>{v.icon} {v.label} <span style={{fontWeight:400,color:TEXT2,fontSize:10.5}}>({cat.length} tarefa{cat.length!==1?"s":""})</span></div>
              {cat.map(t=>{const st=statusInfo(t);const pri=PRIORITIES[t.priority];
                return(<div key={t.id} style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:5}}>
                  <span style={{fontSize:10,fontWeight:700,color:pri.color,minWidth:50}}>{pri.dot} {pri.label}</span>
                  <span style={{fontSize:12,color:TEXT,flex:1,minWidth:90}}>{t.title}</span>
                  {t.client&&<span style={{fontSize:10,color:TEXT2}}>👤 {t.client}</span>}
                  <span style={{fontSize:10,background:st.bg,color:st.color,borderRadius:5,padding:"2px 6px",fontWeight:600}}>{st.label}</span>
                  <span style={{fontSize:10,color:TEXT2}}>prazo {ptDate(t.due)}</span>
                </div>);
              })}
            </div>);
          })}
          {pending.length===0&&<Empty icon="🎯" msg="Sem tarefas pendentes." sub="Você está em dia!"/>}
        </>}

        {/* ── FECHAMENTO MENSAL ── */}
        {view==="fechamento"&&fechamento&&<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,flexWrap:"wrap",gap:8}}>
            <div style={S.section}>📁 Fechamento Mensal — {MONTHS_PT[new Date().getMonth()]} {new Date().getFullYear()}</div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {/* MICROFONE */}
              <button onClick={startVoice} style={{background:listening?"#E65100":BLUE,color:"#fff",border:"none",borderRadius:7,padding:"6px 12px",fontSize:11.5,fontWeight:700,fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                {listening?"🔴 Ouvindo...":"🎤 Voz"}
              </button>
              <button onClick={resetFechamento} style={{background:"#fff",border:`1px solid ${BORDER}`,color:TEXT2,borderRadius:7,padding:"6px 10px",fontSize:11,fontFamily:"inherit",cursor:"pointer"}}>🔄 Novo Ciclo</button>
            </div>
          </div>
          {voiceLog&&<div style={{background:"#FFF3E0",border:"1px solid #FFCC80",borderRadius:7,padding:"6px 12px",fontSize:11.5,color:"#E65100",marginBottom:10}}>🎤 Comando: {voiceLog}</div>}

          {/* SUB-ABAS */}
          <div style={{display:"flex",gap:4,marginBottom:14}}>
            {[["folha","📋 Folha Ativa"],["dom","🏠 Domésticas"],["sem","📁 Sem Movimento"]].map(([v,l])=>(
              <button key={v} style={{background:fechaView===v?BLUE:"#fff",color:fechaView===v?"#fff":TEXT2,border:`1px solid ${fechaView===v?BLUE:BORDER}`,borderRadius:7,padding:"6px 14px",fontSize:12,fontFamily:"inherit",fontWeight:500,cursor:"pointer"}} onClick={()=>setFechaView(v)}>{l}</button>
            ))}
          </div>

          {/* FOLHA ATIVA */}
          {fechaView==="folha"&&(
            <div style={{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:10,overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}>
                <thead>
                  <tr style={{background:BLUE_LIGHT,borderBottom:`2px solid ${BLUE}`}}>
                    <th style={{padding:"8px 10px",textAlign:"left",color:BLUE,fontWeight:700,fontSize:11,minWidth:140,position:"sticky",left:0,background:BLUE_LIGHT}}>Empresa</th>
                    {FOLHA_COLS.map(c=><th key={c} style={{padding:"8px 8px",textAlign:"center",color:BLUE,fontWeight:700,fontSize:11,minWidth:90}}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {FOLHA_ATIVA.map((emp,idx)=>{
                    const row=fechamento.folha[emp]||{};
                    const allDone=FOLHA_COLS.every(c=>row[c]?.status==="entregue");
                    return(
                      <tr key={emp} style={{borderBottom:`1px solid ${BORDER}`,background:allDone?"#F1FBF4":idx%2===0?"#FAFBFF":"#fff"}}>
                        <td style={{padding:"7px 10px",fontWeight:500,color:TEXT,position:"sticky",left:0,background:allDone?"#F1FBF4":idx%2===0?"#FAFBFF":"#fff",fontSize:11.5}}>{emp}</td>
                        {FOLHA_COLS.map(col=>{
                          const cell=row[col]||{status:"pendente",via:"",data:""};
                          const isEntregue=cell.status==="entregue";
                          return(
                            <td key={col} style={{padding:"5px 6px",textAlign:"center",verticalAlign:"middle"}}>
                              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                <span className="cell-btn" onClick={()=>cycleFolhaStatus(emp,col)} style={{fontSize:14,cursor:"pointer",title:"Clique para avançar status"}}>{STATUS_ICON[cell.status]}</span>
                                {isEntregue&&(
                                  <select value={cell.via||""} onChange={e=>setFolhaVia(emp,col,e.target.value)} style={{fontSize:8.5,border:`1px solid ${BORDER}`,borderRadius:3,padding:"1px 2px",background:GRAY,color:TEXT2,cursor:"pointer"}}>
                                    <option value="">via?</option>
                                    <option value="E-mail">E-mail</option>
                                    <option value="WhatsApp">WhatsApp</option>
                                  </select>
                                )}
                                {isEntregue&&cell.data&&<span style={{fontSize:8,color:TEXT2}}>{cell.data}</span>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{padding:"8px 12px",fontSize:10,color:TEXT2,borderTop:`1px solid ${BORDER}`}}>
                ⬜ Pendente → 🟡 Em andamento → ✅ Entregue &nbsp;|&nbsp; Clique no ícone para avançar o status
              </div>
            </div>
          )}

          {/* DOMÉSTICAS */}
          {fechaView==="dom"&&(
            <div style={{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:10,overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{background:"#F3E5F5",borderBottom:`2px solid #6A1B9A`}}>
                    <th style={{padding:"8px 10px",textAlign:"left",color:"#6A1B9A",fontWeight:700,fontSize:11}}>Empregada</th>
                    {DOM_COLS.map(c=><th key={c} style={{padding:"8px 12px",textAlign:"center",color:"#6A1B9A",fontWeight:700,fontSize:11}}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {DOMESTICAS.map((emp,idx)=>{
                    const row=fechamento.dom[emp]||{};
                    return(
                      <tr key={emp} style={{borderBottom:`1px solid ${BORDER}`,background:idx%2===0?"#FAFBFF":"#fff"}}>
                        <td style={{padding:"8px 10px",fontWeight:500,color:TEXT}}>{emp}</td>
                        {DOM_COLS.map(col=>{
                          const cell=row[col]||{status:"pendente"};
                          return(
                            <td key={col} style={{padding:"6px",textAlign:"center"}}>
                              <span className="cell-btn" onClick={()=>cycleDomStatus(emp,col)} style={{fontSize:16,cursor:"pointer"}}>{STATUS_ICON[cell.status]}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* SEM MOVIMENTO */}
          {fechaView==="sem"&&(
            <div style={{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:10,padding:14}}>
              <div style={{fontSize:11.5,color:TEXT2,marginBottom:12}}>Empresas sem movimento — entregue mensalmente via automação. Marque como conferido:</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:7}}>
                {SEM_MOVIMENTO.map(emp=>{
                  const conf=fechamento.sem[emp]?.conferido||false;
                  return(
                    <div key={emp} onClick={()=>toggleSem(emp)} style={{border:`1.5px solid ${conf?"#2E7D32":BORDER}`,borderRadius:8,padding:"8px 12px",cursor:"pointer",background:conf?"#F1FBF4":"#fff",display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:16}}>{conf?"✅":"⬜"}</span>
                      <span style={{fontSize:12,color:TEXT,fontWeight:conf?600:400}}>{emp}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:12,fontSize:11,color:TEXT2}}>
                ✅ {SEM_MOVIMENTO.filter(e=>fechamento.sem[e]?.conferido).length} de {SEM_MOVIMENTO.length} conferidas
              </div>
            </div>
          )}
        </>}
      </div>

      {/* MODAL NOVA TAREFA */}
      {showForm&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div style={S.modal}>
            <div style={{fontWeight:700,fontSize:16,color:BLUE,marginBottom:15,borderBottom:`2px solid ${BLUE_LIGHT}`,paddingBottom:10}}>{editId?"✏️ Editar Tarefa":"✨ Nova Tarefa"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:11}}>
              <div><label style={S.label}>Título *</label><input style={S.input} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Folha de pagamento maio..."/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div><label style={S.label}>Categoria</label>
                  <select style={S.input} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                    {Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>Prioridade</label>
                  <select style={S.input} value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
                    {Object.entries(PRIORITIES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div><label style={S.label}>Prazo</label><input type="date" style={S.input} value={form.due} onChange={e=>setForm(f=>({...f,due:e.target.value}))}/></div>
                <div><label style={S.label}>Data de Entrada</label><input type="date" style={S.input} value={form.created_at} onChange={e=>setForm(f=>({...f,created_at:e.target.value}))}/></div>
              </div>
              <div><label style={S.label}>Cliente</label><input style={S.input} value={form.client} onChange={e=>setForm(f=>({...f,client:e.target.value}))} placeholder="Nome do cliente..."/></div>
              <div><label style={S.label}>Observações</label><textarea style={{...S.input,resize:"none"}} rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Detalhes adicionais..."/></div>
              <div style={{display:"flex",gap:8,marginTop:2}}>
                <button onClick={()=>setShowForm(false)} style={{flex:1,background:"#fff",border:`1px solid ${BORDER}`,color:TEXT2,borderRadius:7,padding:"9px",fontSize:12,fontFamily:"inherit",cursor:"pointer"}}>Cancelar</button>
                <button onClick={saveForm} disabled={saving} style={{flex:2,background:saving?"#90A4AE":BLUE,color:"#fff",border:"none",borderRadius:7,padding:"9px",fontSize:12,fontWeight:700,fontFamily:"inherit",cursor:saving?"not-allowed":"pointer"}}>
                  {saving?"Salvando...":editId?"Salvar alterações":"Criar tarefa"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PROCESSO */}
      {showTemplates&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&(setShowTemplates(false),setSelectedTemplate(null),setTemplateClient(""))}>
          <div style={S.modal}>
            <div style={{fontWeight:700,fontSize:16,color:"#6A1B9A",marginBottom:14,borderBottom:"2px solid #F3E5F5",paddingBottom:10}}>⚡ Criar Processo Completo</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:12}}>
              {Object.entries(PROCESS_TEMPLATES).map(([k,v])=>(
                <div key={k} onClick={()=>setSelectedTemplate(selectedTemplate===k?null:k)} style={{border:`2px solid ${selectedTemplate===k?v.color:BORDER}`,borderRadius:8,padding:"9px 11px",cursor:"pointer",background:selectedTemplate===k?`${v.color}11`:"#fff"}}>
                  <div style={{fontSize:17,marginBottom:2}}>{v.icon}</div>
                  <div style={{fontSize:12,fontWeight:700,color:selectedTemplate===k?v.color:TEXT}}>{v.label}</div>
                  <div style={{fontSize:9.5,color:TEXT2,marginTop:1}}>{v.steps.length} etapas</div>
                </div>
              ))}
            </div>
            {selectedTemplate&&(
              <>
                <div style={{background:GRAY,borderRadius:7,padding:"9px 11px",marginBottom:11}}>
                  <div style={{fontSize:10.5,fontWeight:600,color:TEXT2,marginBottom:5}}>ETAPAS:</div>
                  {PROCESS_TEMPLATES[selectedTemplate].steps.map((s,i)=>(
                    <div key={i} style={{fontSize:10.5,color:TEXT,marginBottom:3,display:"flex",alignItems:"center",gap:5}}>
                      <span style={{color:PRIORITIES[s.priority].color,fontWeight:700,fontSize:9}}>●</span>
                      {s.title} <span style={{color:TEXT2,fontSize:9.5}}>– {s.daysFromNow===0?"hoje":s.daysFromNow===1?"amanhã":"+"+s.daysFromNow+"d"}</span>
                    </div>
                  ))}
                </div>
                <div style={{marginBottom:11}}>
                  <label style={S.label}>Cliente *</label>
                  <input style={S.input} value={templateClient} onChange={e=>setTemplateClient(e.target.value)} placeholder="Nome do cliente..."/>
                </div>
              </>
            )}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setShowTemplates(false);setSelectedTemplate(null);setTemplateClient("");}} style={{flex:1,background:"#fff",border:`1px solid ${BORDER}`,color:TEXT2,borderRadius:7,padding:"9px",fontSize:12,fontFamily:"inherit",cursor:"pointer"}}>Cancelar</button>
              <button onClick={createProcess} disabled={!selectedTemplate||!templateClient.trim()||saving} style={{flex:2,background:(!selectedTemplate||!templateClient.trim()||saving)?"#90A4AE":"#6A1B9A",color:"#fff",border:"none",borderRadius:7,padding:"9px",fontSize:12,fontWeight:700,fontFamily:"inherit",cursor:(!selectedTemplate||!templateClient.trim())?"not-allowed":"pointer"}}>
                {saving?"Criando...":"Criar todas as etapas"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECORRENTE */}
      {showRecurring&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&(setShowRecurring(false),setRecurringClient(""),setSelectedRecurring([]))}>
          <div style={S.modal}>
            <div style={{fontWeight:700,fontSize:16,color:"#00838F",marginBottom:14,borderBottom:"2px solid #E0F7FA",paddingBottom:10}}>🔄 Tarefas Recorrentes do Mês</div>
            <div style={{marginBottom:11}}>
              <label style={S.label}>Cliente *</label>
              <input style={S.input} value={recurringClient} onChange={e=>setRecurringClient(e.target.value)} placeholder="Nome do cliente..."/>
            </div>
            <div style={{marginBottom:4}}>
              <label style={S.label}>Selecione as tarefas</label>
              <div style={{display:"flex",justifyContent:"flex-end",marginBottom:5}}>
                <span style={{fontSize:10.5,color:BLUE,cursor:"pointer",fontWeight:600}} onClick={()=>setSelectedRecurring(RECURRING_TEMPLATES.map((_,i)=>i))}>Selecionar todas</span>
                <span style={{fontSize:10.5,color:TEXT2,margin:"0 5px"}}>|</span>
                <span style={{fontSize:10.5,color:TEXT2,cursor:"pointer"}} onClick={()=>setSelectedRecurring([])}>Limpar</span>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:13,maxHeight:240,overflowY:"auto"}}>
              {RECURRING_TEMPLATES.map((r,i)=>{
                const sel=selectedRecurring.includes(i);
                return(
                  <div key={i} onClick={()=>setSelectedRecurring(prev=>sel?prev.filter(x=>x!==i):[...prev,i])} style={{border:`1.5px solid ${sel?BLUE:BORDER}`,borderRadius:7,padding:"7px 10px",cursor:"pointer",background:sel?BLUE_LIGHT:"#fff",display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:15,height:15,borderRadius:3,border:`2px solid ${sel?BLUE:BORDER}`,background:sel?BLUE:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {sel&&<span style={{color:"#fff",fontSize:9,fontWeight:700}}>✓</span>}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11.5,fontWeight:600,color:TEXT}}>{CATEGORIES[r.category]?.icon} {r.title}</div>
                      <div style={{fontSize:9.5,color:TEXT2}}>Todo dia {r.dayOfMonth} · {PRIORITIES[r.priority].label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setShowRecurring(false);setRecurringClient("");setSelectedRecurring([]);}} style={{flex:1,background:"#fff",border:`1px solid ${BORDER}`,color:TEXT2,borderRadius:7,padding:"9px",fontSize:12,fontFamily:"inherit",cursor:"pointer"}}>Cancelar</button>
              <button onClick={createRecurring} disabled={!recurringClient.trim()||selectedRecurring.length===0||saving} style={{flex:2,background:(!recurringClient.trim()||selectedRecurring.length===0||saving)?"#90A4AE":"#00838F",color:"#fff",border:"none",borderRadius:7,padding:"9px",fontSize:12,fontWeight:700,fontFamily:"inherit",cursor:(!recurringClient.trim()||selectedRecurring.length===0)?"not-allowed":"pointer"}}>
                {saving?`Criando...`:`Criar ${selectedRecurring.length} tarefa${selectedRecurring.length!==1?"s":""}`}
              </button>
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
        <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:compact?0:3}}>
          <span style={{fontSize:compact?11.5:13,fontWeight:600,color:TEXT}}>{t.title}</span>
          <span style={S.badge(cat.color,cat.bg)}>{cat.icon} {cat.label}</span>
          <span style={S.badge(pri.color,pri.bg)}>{pri.dot} {pri.label}</span>
          {isProx&&(t.priority==="urgente"||t.priority==="alta")&&<span style={{fontSize:8.5,background:"#FFF3E0",color:"#E65100",borderRadius:4,padding:"1px 5px",fontWeight:600}}>⚡ próx. 7d</span>}
        </div>
        {!compact&&<div style={{fontSize:10,color:TEXT2,display:"flex",gap:10,flexWrap:"wrap",marginTop:2}}>
          {t.client&&<span>👤 {t.client}</span>}
          {t.notes&&<span>📝 {t.notes}</span>}
          {showDates&&<span>📅 Entrada: {ptDate(t.created_at)}</span>}
        </div>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
        <span style={{fontSize:9.5,background:st.bg,color:st.color,borderRadius:5,padding:"2px 6px",fontWeight:600,whiteSpace:"nowrap"}}>{st.label}</span>
        <span onClick={onEdit} style={{cursor:"pointer",color:"#90A4AE",fontSize:11,padding:"2px 3px"}}>✏️</span>
        <span onClick={onDelete} style={{cursor:"pointer",color:"#CFD8DC",fontSize:11,padding:"2px 3px"}}>✕</span>
      </div>
    </div>
  );
}

function Empty({icon,msg,sub}){
  return(<div style={{textAlign:"center",padding:"40px 0",color:"#B0B8CC"}}>
    <div style={{fontSize:32,marginBottom:7}}>{icon}</div>
    <div style={{fontWeight:600,fontSize:13,color:TEXT2}}>{msg}</div>
    {sub&&<div style={{fontSize:11,marginTop:3}}>{sub}</div>}
  </div>);
}

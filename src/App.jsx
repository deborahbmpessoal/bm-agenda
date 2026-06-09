import { useState, useMemo, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://dmugffjkrrgndrtbdotm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdWdmZmprcnJnbmRydGJkb3RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNDQ2NTEsImV4cCI6MjA5NTYyMDY1MX0.pt2Z_UA2Y3eTBvYTWN3gShlG1v3-WIfDDVpJ0DnGVjc";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ═══════════════════════════════════════════════
// DESIGN TOKENS — OFF WHITE + AZUL MARINHO + VERMELHO
// ═══════════════════════════════════════════════
const NM   = "#0F2040";   // azul marinho
const NM2  = "#1A3560";   // azul marinho médio
const NML  = "#E8EDF5";   // azul marinho claro
const NML2 = "#F0F3F8";   // azul marinho muito claro
const RD   = "#C41E3A";   // vermelho
const RDL  = "#FCEEF1";   // vermelho claro
const OW   = "#F8F7F4";   // off-white fundo
const OW2  = "#FFFFFF";   // branco puro cards
const BD   = "#E2E6EE";   // borda
const TX   = "#0F2040";   // texto principal
const TX2  = "#6B7A99";   // texto secundário
const TX3  = "#A0AABF";   // texto terciário

// Remapear cores existentes para novo design
const BLUE       = NM;
const BLUE_LIGHT = NML;
const RED        = RD;
const RED_LIGHT  = RDL;
const GRAY       = OW;
const BORDER     = BD;
const TEXT       = TX;
const TEXT2      = TX2;

const NAV_ITEMS=[
  {id:"agenda",  icon:"📅", label:"Agenda"},
  {id:"clientes",icon:"👥", label:"Clientes"},
  {id:"tarefas", icon:"📋", label:"Tarefas"},
  {id:"dashboard",icon:"📈",label:"Dashboard"},
  {id:"fechamento",icon:"📁",label:"Fechamento"},
];

// ── LÓGICA DE AGENDA INTELIGENTE ──
const TEMPO_POR_CATEGORIA = {
  dp:30, fiscal:60, contabil:60, financeiro:30,
  administrativo:30, cliente:30, rescisao:60,
};
const BLOCOS_ATENDIMENTO = [
  {inicio:"09:00",fim:"09:30"},{inicio:"10:30",fim:"11:00"},
  {inicio:"14:00",fim:"14:30"},{inicio:"15:30",fim:"16:00"},
];
const SLOTS_DISPONIVEIS = [
  "08:15","08:45","09:00","09:30","10:00","10:30","11:00","11:30",
  "14:00","14:30","15:00","15:30","16:00","16:30",
];

function toMin(t){const[h,m]=t.split(":").map(Number);return h*60+m;}
function addMin(t,m){const tot=toMin(t)+m;return`${String(Math.floor(tot/60)).padStart(2,"0")}:${String(tot%60).padStart(2,"0")}`;}
function slotLivre(hora,duracaoMin,agendados){
  const inicio=toMin(hora); const fim=inicio+duracaoMin;
  if(fim>toMin("12:00")&&inicio<toMin("14:00"))return false;
  if(fim>toMin("17:00"))return false;
  return!agendados.some(a=>{
    const ai=toMin(a.inicio); const af=toMin(a.fim);
    return inicio<af&&fim>ai;
  });
}

// ── REGRAS DE NEGÓCIO AUTOMÁTICAS ──
const FERIAS_PERIODO = {inicio:"2026-07-13",fim:"2026-07-24"};

function isFerias(dateStr){
  return dateStr>=FERIAS_PERIODO.inicio&&dateStr<=FERIAS_PERIODO.fim;
}

function diaUtilAnterior(dateStr){
  const d=new Date(dateStr+"T12:00:00");
  while(d.getDay()===0||d.getDay()===6){d.setDate(d.getDate()-1);}
  return d.toISOString().split("T")[0];
}

function isDiaMarketing(){
  const dow=new Date().getDay();
  return dow===1||dow===3||dow===5;
}

// Gera alertas de rotinas mensais baseados na data atual
function gerarAlertasRotinas(){
  const hoje=new Date();
  const dia=hoje.getDate();
  const alertas=[];
  if(dia>=25||dia<=5)alertas.push("📥 Período de folha — receber pontos dos clientes (dia 25–01)");
  if(dia>=1&&dia<=5)alertas.push("⚙️ Processamento de folha em andamento (prazo: dia 05)");
  if(dia>=8&&dia<=12)alertas.push("📊 REINF e PER/DCOMP vencendo próximo ao dia 10");
  if(dia>=10&&dia<=15)alertas.push("📋 Emissão de guias — prazo até dia 15");
  if(dia===1||dia===15)alertas.push("⚖️ Verificar convenções coletivas e atualizações sindicais");
  if(dia===1||dia===16)alertas.push("🏛 Revisar processos na RFB (quinzenal)");
  return alertas;
}


function montarAgendaDia(tasks){
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  const todayS=hoje.toISOString().split("T")[0];

  // Bloquear férias
  if(isFerias(todayS)){
    return[{hora:"08:00",horaFim:"17:00",titulo:"🏖️ Período de Férias — Agenda Bloqueada",tipo:"ferias",cor:"#C41E3A",obs:"13/07 a 24/07/2026"}];
  }

  // TODAS as tarefas pendentes — sem filtro de data
  // Deduplicar por título+dia (evitar múltiplas postagens no mesmo dia)
  const vistosHoje=new Set();
  const candidatas=[...tasks]
    .filter(t=>{
      if(t.done)return false;
      const chave=`${t.title}|${t.due}`;
      if(vistosHoje.has(chave))return false;
      vistosHoje.add(chave);
      return true;
    })
    .sort((a,b)=>{
      // Atrasadas sempre primeiro
      const aAtras=a.due<todayS; const bAtras=b.due<todayS;
      if(aAtras&&!bAtras)return -1;
      if(!aAtras&&bAtras)return 1;
      // Admissões com documentação completa — prioridade máxima
      const isAdmA=(a.tipo_atividade==="admissao"&&a.documentacao_completa)||(a.title||"").toLowerCase().includes("admiss");
      const isAdmB=(b.tipo_atividade==="admissao"&&b.documentacao_completa)||(b.title||"").toLowerCase().includes("admiss");
      if(isAdmA&&!isAdmB)return -1;
      if(!isAdmA&&isAdmB)return 1;
      // Prioridade
      const ordemPri={urgente:0,alta:1,media:2,baixa:3};
      const pa=ordemPri[a.priority]||2; const pb=ordemPri[b.priority]||2;
      if(pa!==pb)return pa-pb;
      // Prazo mais próximo primeiro
      if(a.due&&b.due)return a.due<b.due?-1:1;
      return 0;
    });

  // Blocos fixos reservados
  const agendados=[
    {inicio:"08:00",fim:"08:15",tipo:"checkin"},
    {inicio:"09:00",fim:"09:30",tipo:"atendimento"},
    {inicio:"10:30",fim:"11:00",tipo:"atendimento"},
    {inicio:"14:00",fim:"14:30",tipo:"atendimento"},
    {inicio:"15:30",fim:"16:00",tipo:"atendimento"},
    {inicio:"16:45",fim:"17:00",tipo:"checkout"},
  ];

  // Marketing Seg/Qua/Sex — 10:20 às 10:30
  if(isDiaMarketing()){
    agendados.push({inicio:"10:20",fim:"10:30",tipo:"marketing"});
  }

  const agenda=[];
  // Check-in sempre primeiro
  agenda.push({hora:"08:00",horaFim:"08:15",titulo:"✅ Check-in Diário",tipo:"ritual",cor:"#0F2040",obs:"Revisar agenda · Prioridades · Urgências · Planejar o dia"});
  // Marketing
  if(isDiaMarketing()){
    agenda.push({hora:"10:20",horaFim:"10:30",titulo:"📣 Postagem Instagram",tipo:"marketing",cor:"#AD1457",obs:"Publicação de conteúdo — 10 minutos"});
  }

  let horaAtual="08:15";
  let tarefasInseridas=0;

  for(const t of candidatas){
    // Usar tempo_estimado do tipo_atividade se disponível
    const tipoInfo=TIPOS_ATIVIDADE[t.tipo_atividade];
    const duracao=t.tempo_estimado||tipoInfo?.tempo||TEMPO_POR_CATEGORIA[t.category]||60;
    // Só pular se EXPLICITAMENTE marcado false — null/undefined = pode agendar
    if(t.permite_agendamento===false)continue;
    // Só pular se status operacional estiver explicitamente bloqueado
    if(t.status_operacional==="aguardando_info"||t.status_operacional==="aguardando_cliente")continue;
    // Não mostrar tarefas já concluídas
    if(t.done)continue;
    // Avançar sobre blocos fixos
    let tentativas=0;
    while(tentativas<15){
      tentativas++;
      if(toMin(horaAtual)>=toMin("12:00")&&toMin(horaAtual)<toMin("14:00")){horaAtual="14:00";}
      let pulou=false;
      for(const b of agendados){
        if(toMin(horaAtual)>=toMin(b.inicio)&&toMin(horaAtual)<toMin(b.fim)){horaAtual=b.fim;pulou=true;break;}
      }
      if(!pulou)break;
    }
    if(toMin(horaAtual)+duracao>toMin("17:00"))continue;
    if(!slotLivre(horaAtual,duracao,agendados))continue;
    let colide=false;
    for(const b of agendados){
      if(toMin(horaAtual)<toMin(b.fim)&&toMin(horaAtual)+duracao>toMin(b.inicio)){colide=true;break;}
    }
    if(colide){horaAtual=addMin(horaAtual,15);continue;}
    const horaFim=addMin(horaAtual,duracao);
    agenda.push({hora:horaAtual,horaFim,titulo:t.title,tipo:"tarefa",cor:CATEGORIES[t.category]?.color||"#0F2040",cat:t.category,pri:t.priority,cliente:t.client,id:t.id,atrasada:t.due<todayS,tipoAtiv:t.tipo_atividade,statusOp:t.status_operacional});
    agendados.push({inicio:horaAtual,fim:horaFim});
    horaAtual=addMin(horaFim,5);
    tarefasInseridas++;
    if(tarefasInseridas>=10)break;
  }

  // Blocos de atendimento
  BLOCOS_ATENDIMENTO.forEach(b=>{
    agenda.push({hora:b.inicio,horaFim:b.fim,titulo:"👥 Atendimento Clientes",tipo:"atendimento",cor:"#2E7D32",obs:"Reservado — ligações, reuniões, retornos, suporte"});
  });

  // Check-out
  agenda.push({hora:"16:45",horaFim:"17:00",titulo:"🔍 Check-out Diário",tipo:"ritual",cor:"#0F2040",obs:"Revisar entregas · Pendências · Planejar amanhã"});

  return agenda.sort((a,b)=>toMin(a.hora)-toMin(b.hora));
}

function gerarResumoIA(tasks,agenda){
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  const todayS=hoje.toISOString().split("T")[0];
  const atrasadas=tasks.filter(t=>!t.done&&t.due<todayS);
  const urgentes=tasks.filter(t=>!t.done&&(t.priority==="urgente"||t.priority==="alta"));
  const tarefasHoje=agenda.filter(a=>a.tipo==="tarefa");
  const carga=Math.min(Math.round((tarefasHoje.length/7)*100),100);
  const hora=hoje.getHours();
  const saudacao=hora<12?"Bom dia":hora<18?"Boa tarde":"Boa noite";

  const alertas=[...gerarAlertasRotinas()];
  if(atrasadas.length>0)alertas.unshift(`⚠️ ${atrasadas.length} tarefa${atrasadas.length>1?"s":""} em atraso`);
  if(isFerias(todayS))alertas.unshift("🏖️ Período de férias — agenda bloqueada");
  const admissoes=tasks.filter(t=>!t.done&&(t.tipo_atividade==="admissao"||(t.title||"").toLowerCase().includes("admiss")));
  const semDocAdm=admissoes.filter(t=>!t.documentacao_completa);
  if(semDocAdm.length>0)alertas.push(`📋 ${semDocAdm.length} admissão${semDocAdm.length>1?"ões":""} aguardando documentação`);
  if(admissoes.length>0)alertas.push(`${admissoes.length} admissão${admissoes.length>1?"ões":""} pendente${admissoes.length>1?"s":""}`);

  const prioMax=urgentes[0]?.title||"Nenhuma urgência";

  return{saudacao:`${saudacao}, Deborah!`,alertas,carga,prioMax,totalHoje:tarefasHoje.length};
}


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

const TIPOS_ATIVIDADE = {
  admissao:      { label:"Admissão",          icon:"👤", tempo:30,  prioridade:"urgente" },
  rescisao:      { label:"Rescisão",           icon:"📄", tempo:60,  prioridade:"urgente" },
  folha:         { label:"Folha",              icon:"💼", tempo:90,  prioridade:"alta"    },
  guia:          { label:"Guia/DARF/FGTS",     icon:"📋", tempo:60,  prioridade:"alta"    },
  atendimento:   { label:"Atendimento",        icon:"🤝", tempo:30,  prioridade:"alta"    },
  reuniao:       { label:"Reunião",            icon:"👥", tempo:30,  prioridade:"media"   },
  processo_rfb:  { label:"Processo RFB",       icon:"🏛", tempo:30,  prioridade:"media"   },
  convencao:     { label:"Convenção Coletiva", icon:"⚖️", tempo:30,  prioridade:"media"   },
  marketing:     { label:"Marketing",          icon:"📣", tempo:10,  prioridade:"baixa"   },
  parametrizacao:{ label:"Parametrização",     icon:"⚙️", tempo:60,  prioridade:"media"   },
  estudo:        { label:"Estudo/Curso",        icon:"📚", tempo:90,  prioridade:"baixa"   },
  administrativo:{ label:"Administrativo",     icon:"🗂", tempo:30,  prioridade:"baixa"   },
  outros:        { label:"Outros",             icon:"📌", tempo:30,  prioridade:"media"   },
};

const STATUS_OPERACIONAL = {
  aguardando_info:    "Aguardando informações",
  pronto:             "Pronto para execução",
  em_andamento:       "Em andamento",
  aguardando_cliente: "Aguardando cliente",
  concluido:          "Concluído",
};


// ── TAREFAS RECORRENTES FIXAS ──
// Definição completa de todas as rotinas que devem existir mensalmente
function getRecorrentesDoMes(){
  const hoje = new Date();
  const ano  = hoje.getFullYear();
  const mes  = String(hoje.getMonth()+1).padStart(2,"0");
  const mesProx = hoje.getMonth()===11 ? "01" : String(hoje.getMonth()+2).padStart(2,"0");
  const anoProx = hoje.getMonth()===11 ? ano+1 : ano;

  function d(dia){ return `${ano}-${mes}-${String(dia).padStart(2,"0")}`; }
  function dProx(dia){ return `${anoProx}-${mesProx}-${String(dia).padStart(2,"0")}`; }

  // Antecipa para dia útil se cair em fim de semana
  function dUtil(dateStr){
    const dt = new Date(dateStr+"T12:00:00");
    while(dt.getDay()===0||dt.getDay()===6){ dt.setDate(dt.getDate()-1); }
    return dt.toISOString().split("T")[0];
  }

  // Próximas terças-feiras (para RFB quinzenal)
  function proximasTercas(){
    const dts=[];
    const dt=new Date(hoje); dt.setDate(1);
    while(dt.getMonth()===hoje.getMonth()){
      if(dt.getDay()===2) dts.push(dt.toISOString().split("T")[0]);
      dt.setDate(dt.getDate()+1);
    }
    return dts.filter((_,i)=>i===0||i===2); // 1ª e 3ª terças
  }

  // Seg/Qua/Sex do mês (marketing)
  function diasMarketing(){
    const dts=[];
    const dt=new Date(hoje); dt.setDate(1);
    while(dt.getMonth()===hoje.getMonth()){
      const dow=dt.getDay();
      if(dow===1||dow===3||dow===5) dts.push(dt.toISOString().split("T")[0]);
      dt.setDate(dt.getDate()+1);
    }
    return dts;
  }

  const tarefas=[];
  const mesKey=`${ano}-${mes}`;

  // REINF — dia 10 (antecipa se fim de semana)
  tarefas.push({title:"📊 REINF",category:"fiscal",priority:"urgente",due:dUtil(d(10)),client:"",notes:"Entrega REINF mensal",tipo_atividade:"guia",tempo_estimado:60,status_operacional:"pronto",permite_agendamento:true,recorrente_key:`reinf-${mesKey}`});

  // PER/DCOMP — dia 10 (antecipa se fim de semana)
  tarefas.push({title:"📊 PER/DCOMP",category:"fiscal",priority:"urgente",due:dUtil(d(10)),client:"",notes:"Entrega PER/DCOMP mensal",tipo_atividade:"guia",tempo_estimado:60,status_operacional:"pronto",permite_agendamento:true,recorrente_key:`perdcomp-${mesKey}`});

  // Emissão de guias — dia 15
  tarefas.push({title:"📋 Emissão de Guias FGTS/INSS",category:"dp",priority:"urgente",due:dUtil(d(15)),client:"",notes:"Todas as guias tratadas em conjunto",tipo_atividade:"guia",tempo_estimado:90,status_operacional:"pronto",permite_agendamento:true,recorrente_key:`guias-${mesKey}`});

  // Recebimento de pontos — dia 25
  tarefas.push({title:"📥 Recebimento de Pontos",category:"dp",priority:"alta",due:d(25),client:"",notes:"Período: 25 ao dia 01 — alertar se não recebido",tipo_atividade:"folha",tempo_estimado:30,status_operacional:"aguardando_info",permite_agendamento:false,recorrente_key:`recponto-${mesKey}`});

  // Processamento de folha — dia 5 do mês seguinte
  tarefas.push({title:"⚙️ Processamento de Folha",category:"dp",priority:"urgente",due:dProx(5),client:"",notes:"Fluxo: Recebimento → Processamento → Conferência → Envio",tipo_atividade:"folha",tempo_estimado:120,status_operacional:"aguardando_info",permite_agendamento:true,recorrente_key:`folha-${anoProx}-${mesProx}`});

  // Convenções coletivas — quinzenal (dia 1 e 16)
  tarefas.push({title:"⚖️ Convenções Coletivas",category:"dp",priority:"media",due:d(1),client:"",notes:"Verificar atualizações sindicais, pisos e cláusulas",tipo_atividade:"convencao",tempo_estimado:30,status_operacional:"pronto",permite_agendamento:true,recorrente_key:`convencao1-${mesKey}`});
  tarefas.push({title:"⚖️ Convenções Coletivas",category:"dp",priority:"media",due:d(16),client:"",notes:"Verificar atualizações sindicais, pisos e cláusulas",tipo_atividade:"convencao",tempo_estimado:30,status_operacional:"pronto",permite_agendamento:true,recorrente_key:`convencao2-${mesKey}`});

  // RFB — quinzenal, preferencialmente terças
  const tercas=proximasTercas();
  tercas.forEach((dt,i)=>{
    tarefas.push({title:"🏛 Revisão Processos RFB",category:"fiscal",priority:"media",due:dt,client:"",notes:"Verificar andamento, status e exigências na Receita Federal",tipo_atividade:"processo_rfb",tempo_estimado:30,status_operacional:"pronto",permite_agendamento:true,recorrente_key:`rfb${i+1}-${mesKey}`});
  });

  // Alinhamento DP — mensal (1ª semana)
  tarefas.push({title:"👥 Alinhamento DP — Mariana e Mirian",category:"dp",priority:"media",due:d(7),client:"Interno",notes:"Alinhamento operacional, pendências e melhorias de processo",tipo_atividade:"reuniao",tempo_estimado:60,status_operacional:"pronto",permite_agendamento:true,recorrente_key:`alinhDP-${mesKey}`});

  // Planejamento de Marketing — mensal
  tarefas.push({title:"📣 Planejamento de Marketing",category:"administrativo",priority:"baixa",due:d(5),client:"Interno",notes:"Definição de temas, campanhas e planejamento de conteúdo",tipo_atividade:"marketing",tempo_estimado:60,status_operacional:"pronto",permite_agendamento:true,recorrente_key:`mktplan-${mesKey}`});

  // Parametrização — a cada 10 dias (dias 1, 11, 21)
  [1,11,21].forEach(dia=>{
    tarefas.push({title:"⚙️ Parametrização e Automação",category:"administrativo",priority:"media",due:d(dia),client:"Interno",notes:"Parametrizar sistema, criar automações, melhorar processos",tipo_atividade:"parametrizacao",tempo_estimado:60,status_operacional:"pronto",permite_agendamento:true,recorrente_key:`param${dia}-${mesKey}`});
  });

  // Marketing — 1 postagem por Seg/Qua/Sex (sem duplicar)
  diasMarketing().forEach((dt,i)=>{
    tarefas.push({
      title:"📣 Postagem Instagram",category:"administrativo",priority:"baixa",
      due:dt,client:"Interno",notes:"Publicação de conteúdo — 10 minutos",
      tipo_atividade:"marketing",tempo_estimado:10,
      status_operacional:"pronto",permite_agendamento:true,
      hora_agendada:"10:20",
      recorrente_key:`mkt-${dt}` // chave única por DIA, não por índice
    });
  });

  return tarefas;
}


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
  const emptyForm={
    title:"",category:"dp",priority:"media",due:todayStr,client:"",notes:"",
    created_at:todayStr,completed_at:"",
    tipo_atividade:"outros",tempo_estimado:30,
    status_operacional:"pronto",documentacao_completa:false,
    permite_agendamento:true,dependencia:"",
  };
  const [form,setForm]=useState(emptyForm);

  useEffect(()=>{ fetchTasks(); criarRecorrentesDoMes(); },[]);
  useEffect(()=>{if(view==="fechamento"||view==="dashboard")fetchFechamento();},[view]);

  async function fetchTasks(){
    setLoading(true);
    const{data}=await supabase.from("tasks").select("*").order("due",{ascending:true});
    setTasks(data||[]);setLoading(false);
  }

  async function criarRecorrentesDoMes(){
    const recorrentes=getRecorrentesDoMes();
    const hoje=new Date().toISOString().split("T")[0];

    // Buscar TODAS as tarefas do mês atual para verificar duplicatas
    const mesAtual=hoje.substring(0,7); // "2026-06"
    const{data:exist}=await supabase.from("tasks")
      .select("recorrente_key,title,due")
      .gte("due",mesAtual+"-01")
      .lte("due",mesAtual+"-31");

    const keysExist=new Set((exist||[]).map(r=>r.recorrente_key).filter(Boolean));
    // Também verificar por título+dia para evitar duplicatas sem recorrente_key
    const titleDueExist=new Set((exist||[]).map(r=>`${r.title}|${r.due}`));

    const novas=recorrentes.filter(t=>{
      if(!t.recorrente_key)return false;
      if(keysExist.has(t.recorrente_key))return false;
      // Verificar também por título+dia
      if(titleDueExist.has(`${t.title}|${t.due}`))return false;
      return true;
    });

    if(novas.length===0)return;
    const payload=novas.map(t=>({...t,done:false,created_at:hoje,completed_at:null}));
    await supabase.from("tasks").insert(payload);
    const{data}=await supabase.from("tasks").select("*").order("due",{ascending:true});
    setTasks(data||[]);
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
    const payload={month_key:monthKey,tipo,empresa,coluna,status,via,data_entrega,updated_at:new Date().toISOString()};
    // Usa upsert com onConflict — evita erro de id "new" e não precisa saber se existe
    const{error}=await supabase.from("fechamento_mensal").upsert(payload,{onConflict:"month_key,tipo,empresa,coluna"});
    if(error){
      showToast("Erro ao salvar: "+error.message,"err");
      // Recarrega do banco para garantir sincronização
      await fetchFechamento();
      return;
    }
    // Atualiza mapa local imediatamente
    setFechaMap(prev=>({...prev,[`${tipo}|${empresa}|${coluna}`]:{...payload}}));
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
    // Auto-definir prioridade e tempo por tipo de atividade
    const tipo=TIPOS_ATIVIDADE[form.tipo_atividade];
    const prioridade=form.tipo_atividade!=="outros"?tipo?.prioridade||form.priority:form.priority;
    const tempo=form.tempo_estimado||tipo?.tempo||60;
    const payload={
      title:form.title,category:form.category,priority:prioridade,due:form.due,
      client:form.client,notes:form.notes,created_at:form.created_at,
      completed_at:form.completed_at||null,done:false,
      tipo_atividade:form.tipo_atividade,tempo_estimado:tempo,
      status_operacional:form.status_operacional,
      documentacao_completa:form.documentacao_completa,
      permite_agendamento:form.permite_agendamento,
      dependencia:form.dependencia,
    };
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
  function openEdit(t){
    setForm({
      title:t.title,category:t.category,priority:t.priority,due:t.due,
      client:t.client||"",notes:t.notes||"",created_at:t.created_at||todayStr,
      completed_at:t.completed_at||"",
      tipo_atividade:t.tipo_atividade||"outros",
      tempo_estimado:t.tempo_estimado||60,
      status_operacional:t.status_operacional||"pronto",
      documentacao_completa:t.documentacao_completa||false,
      permite_agendamento:t.permite_agendamento!==false,
      dependencia:t.dependencia||"",
    });
    setEditId(t.id);setShowForm(true);
  }

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
  const todayTasks=useMemo(()=>pending.filter(t=>t.due<=todayStr).sort((a,b)=>scoreTask(b)-scoreTask(a)),[tasks]);
  const allTodayPending=todayTasks;
  const prox7Urgentes=useMemo(()=>pending.filter(t=>t.due>todayStr&&t.due<=in7days&&(t.priority==="urgente"||t.priority==="alta")).sort((a,b)=>scoreTask(b)-scoreTask(a)),[tasks]);
  const urgentesTab=useMemo(()=>{
    const base=allTodayPending.filter(t=>t.priority==="urgente"||t.priority==="alta"||t.due<todayStr);
    const ids=new Set(base.map(t=>t.id));
    return[...base,...prox7Urgentes.filter(t=>!ids.has(t.id))];
  },[tasks]);
  const in2days=fmtDate(addDays(today,2));
  const comunsTab=useMemo(()=>{
    const base=allTodayPending.filter(t=>t.priority==="media"||t.priority==="baixa");
    const prox2=pending.filter(t=>t.due>todayStr&&t.due<=in2days&&t.priority==="media");
    const ids=new Set(base.map(t=>t.id));
    return[...base,...prox2.filter(t=>!ids.has(t.id))].sort((a,b)=>scoreTask(b)-scoreTask(a));
  },[tasks]);

  const weekTasksFor=(ds)=>tasks.filter(t=>!t.done&&t.due===ds).sort((a,b)=>scoreTask(b)-scoreTask(a));
  const allFiltered=useMemo(()=>[...pending]
    .filter(t=>filterCat==="all"||t.category===filterCat)
    .filter(t=>filterPri==="all"||t.priority===filterPri)
    .sort((a,b)=>{
      // Admissões com doc completa sempre no topo
      const aAdm=a.tipo_atividade==="admissao"&&a.documentacao_completa;
      const bAdm=b.tipo_atividade==="admissao"&&b.documentacao_completa;
      if(aAdm&&!bAdm)return -1; if(!aAdm&&bAdm)return 1;
      return scoreTask(b)-scoreTask(a);
    }),[tasks,filterCat,filterPri]);
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
    {label:"Urgentes",val:urgentesTab.length,color:RD,bg:RDL,onClick:()=>{setView("agenda");}},
    {label:"Comuns Hoje",val:comunsTab.length,color:NM,bg:NML,onClick:()=>{setView("agenda");}},
    {label:"Esta Semana",val:pending.filter(t=>t.due>=fmtDate(weekStart)&&t.due<=fmtDate(addDays(weekStart,6))).length,color:"#00838F",bg:"#E0F7FA",onClick:()=>setView("tarefas")},
    {label:"Concluídas",val:done.length,color:"#1B6B3A",bg:"#E8F5E9",onClick:()=>setView("tarefas")},
  ];

  const S={
    root:{fontFamily:"'Inter','Segoe UI',Arial,sans-serif",background:OW,minHeight:"100vh",color:TX,paddingBottom:72},
    // HEADER
    header:{background:NM,padding:"0 20px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,gap:8,boxShadow:"0 2px 12px rgba(15,32,64,.18)"},
    logoMark:{width:32,height:32,borderRadius:7,background:RD,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:13,flexShrink:0,letterSpacing:"-0.5px"},
    logoName:{fontSize:13,fontWeight:700,color:"#fff",letterSpacing:"-0.2px"},
    logoSub:{fontSize:8.5,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"1.2px"},
    addBtn:{background:RD,color:"#fff",border:"none",borderRadius:7,padding:"7px 14px",fontSize:12,fontWeight:700,fontFamily:"inherit",cursor:"pointer",flexShrink:0,letterSpacing:"0.2px"},
    quickBtn:(c)=>({background:"rgba(255,255,255,0.12)",color:"#fff",border:"1px solid rgba(255,255,255,0.2)",borderRadius:7,padding:"6px 10px",fontSize:11,fontWeight:600,fontFamily:"inherit",cursor:"pointer",flexShrink:0}),
    // MENU INFERIOR
    bottomNav:{position:"fixed",bottom:0,left:0,right:0,background:NM,borderTop:"none",display:"flex",alignItems:"center",justifyContent:"space-around",height:64,zIndex:200,padding:"0 4px",boxShadow:"0 -2px 16px rgba(15,32,64,.2)"},
    navItem:(a)=>({display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,padding:"6px 8px",cursor:"pointer",flex:1,borderRadius:8,background:a?"rgba(196,30,58,0.15)":"transparent",transition:"background .15s"}),
    navIcon:()=>({fontSize:19,lineHeight:1}),
    navLabel:(a)=>({fontSize:9,fontWeight:a?700:400,color:a?"#fff":"rgba(255,255,255,0.5)",lineHeight:1,letterSpacing:"0.3px"}),
    // CONTEÚDO
    main:{maxWidth:1100,margin:"0 auto",padding:"20px 16px"},
    // CARDS
    card:{background:OW2,border:`1px solid ${BD}`,borderRadius:12,padding:"13px 16px",display:"flex",alignItems:"flex-start",gap:10,marginBottom:8,boxShadow:"0 1px 4px rgba(15,32,64,.04)"},
    badge:(c,bg)=>({background:bg,color:c,border:`1px solid ${c}22`,borderRadius:5,padding:"2px 7px",fontSize:9.5,fontWeight:600,whiteSpace:"nowrap",letterSpacing:"0.2px"}),
    circle:(c)=>({width:22,height:22,borderRadius:"50%",border:`2px solid ${c}`,flexShrink:0,cursor:"pointer",marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:c,transition:"transform .15s"}),
    doneDot:{width:22,height:22,borderRadius:"50%",background:"#1B6B3A",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",cursor:"pointer",marginTop:2},
    section:{fontWeight:700,fontSize:20,color:TX,marginBottom:3,letterSpacing:"-0.3px"},
    sub:{fontSize:12,color:TX2,marginBottom:16},
    overlay:{position:"fixed",inset:0,background:"rgba(15,32,64,0.55)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:0},
    modal:{background:OW2,borderRadius:"20px 20px 0 0",padding:"20px 20px 36px",width:"100%",maxWidth:540,maxHeight:"93vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(15,32,64,.2)"},
    lbl:{fontSize:10.5,color:TX2,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.6px",fontWeight:600},
    inp:{width:"100%",background:OW,border:`1.5px solid ${BD}`,borderRadius:9,padding:"10px 13px",color:TX,fontSize:13.5,fontFamily:"inherit",transition:"border-color .15s"},
  };

  if(loading)return(
    <div style={{fontFamily:"'Inter','Segoe UI',sans-serif",background:"#F8F7F4",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{width:40,height:40,borderRadius:"50%",border:"3px solid #E2E6EE",borderTop:"3px solid #0F2040",animation:"spin .8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{fontSize:15,fontWeight:600,color:"#0F2040",letterSpacing:"-0.2px"}}>BM CONTABILIDADE</div>
      <div style={{fontSize:12,color:"#6B7A99"}}>Carregando agenda...</div>
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

        {/* ── AGENDA INTELIGENTE ── */}
        {view==="agenda"&&<AgendaInteligente
          tasks={tasks} pending={pending} done={done}
          todayTasks={todayTasks} urgentesTab={urgentesTab} comunsTab={comunsTab}
          weekDays={weekDays} weekStart={weekStart} weekTasksFor={weekTasksFor}
          mesDias={mesDias} mesDateStr={mesDateStr} mesTasksFor={mesTasksFor}
          mesNome={mesNome} mesAno={mesAno} mesOffset={mesOffset} setMesOffset={setMesOffset}
          offsetInicio={offsetInicio} todayStr={todayStr}
          onToggle={toggleDone} onEdit={openEdit} onDelete={deleteTask}
          S={S} in2days={in2days}
        />}

        

                {/* ── DASHBOARD ── */}
        {/* ── CLIENTES ── */}
        {view==="clientes"&&<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,flexWrap:"wrap",gap:8}}>
            <div style={{fontWeight:800,fontSize:22,color:TX,letterSpacing:"-0.5px"}}>Painel por Cliente</div>
            <select value={filterClient} onChange={e=>setFilterClient(e.target.value)} style={{background:OW2,border:`1px solid ${BD}`,borderRadius:9,padding:"8px 12px",color:TX,fontSize:13,fontFamily:"inherit"}}>
              <option value="all">Todos os clientes</option>
              {allClients.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{fontSize:12,color:TX2,marginBottom:16}}>Tarefas pendentes agrupadas por cliente</div>
          {Object.keys(clientPanel).length===0&&<Empty icon="👥" msg="Nenhuma tarefa pendente."/>}
          {Object.entries(clientPanel).sort((a,b)=>b[1].length-a[1].length).map(([client,ctasks])=>{
            const temUrg=ctasks.some(t=>t.priority==="urgente");
            const temAtras=ctasks.some(t=>t.due<todayStr);
            return(<div key={client} style={{background:OW2,border:`1.5px solid ${temUrg||temAtras?RD:BD}`,borderRadius:12,padding:"14px 16px",marginBottom:12,boxShadow:"0 1px 4px rgba(15,32,64,.04)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:34,height:34,borderRadius:"50%",background:NML,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:NM}}>{client.charAt(0).toUpperCase()}</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:TX}}>{client}</div>
                    <div style={{fontSize:11,color:TX2}}>{ctasks.length} tarefa{ctasks.length!==1?"s":""} pendente{ctasks.length!==1?"s":""}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  {temAtras&&<span style={{fontSize:10,background:RDL,color:RD,borderRadius:6,padding:"3px 8px",fontWeight:700}}>⚠️ Atraso</span>}
                  {temUrg&&<span style={{fontSize:10,background:RDL,color:RD,borderRadius:6,padding:"3px 8px",fontWeight:700}}>🔴 Urgente</span>}
                </div>
              </div>
              {ctasks.map((t,i)=><Card key={t.id} t={t} i={i} S={S} compact onToggle={()=>toggleDone(t)} onEdit={()=>openEdit(t)} onDelete={()=>deleteTask(t.id)}/>)}
            </div>);
          })}
        </>}

        {/* ── TAREFAS ── */}
        {view==="tarefas"&&<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div style={{fontWeight:800,fontSize:22,color:TX,letterSpacing:"-0.5px"}}>Todas as Tarefas</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{background:OW2,border:`1px solid ${BD}`,borderRadius:9,padding:"8px 12px",color:TX,fontSize:13,fontFamily:"inherit"}}>
                <option value="all">Todas categorias</option>
                {Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
              <select value={filterPri} onChange={e=>setFilterPri(e.target.value)} style={{background:OW2,border:`1px solid ${BD}`,borderRadius:9,padding:"8px 12px",color:TX,fontSize:13,fontFamily:"inherit"}}>
                <option value="all">Todas prioridades</option>
                {Object.entries(PRIORITIES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          {allFiltered.length===0?<Empty icon="🔍" msg="Nenhuma tarefa encontrada."/>
            :allFiltered.map((t,i)=><Card key={t.id} t={t} i={i} S={S} showDates onToggle={()=>toggleDone(t)} onEdit={()=>openEdit(t)} onDelete={()=>deleteTask(t.id)}/>)}
          {done.length>0&&(
            <div style={{marginTop:20}}>
              <div style={{fontSize:11,fontWeight:700,color:TX2,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",gap:6}} onClick={()=>setShowDone(v=>!v)}>
                <span style={{width:3,height:14,background:BD,borderRadius:2,display:"inline-block"}}/>
                Concluídas ({done.length}) {showDone?"▲":"▼"}
              </div>
              {showDone&&done.map(t=>(
                <div key={t.id} style={{background:OW2,border:`1px solid ${BD}`,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,marginBottom:6,opacity:.55}}>
                  <span onClick={()=>toggleDone(t)} style={{width:22,height:22,borderRadius:"50%",background:"#1B6B3A",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",cursor:"pointer"}}>✓</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,textDecoration:"line-through",color:TX2}}>{t.title}</div>
                    <div style={{fontSize:10.5,color:TX3,marginTop:2}}>
                      {t.client&&<span style={{marginRight:10}}>👤 {t.client}</span>}
                      <span>Entrada: {ptDate(t.created_at)}</span>
                      {t.completed_at&&<span style={{marginLeft:10}}>✅ {ptDate(t.completed_at)}</span>}
                    </div>
                  </div>
                  <span onClick={()=>deleteTask(t.id)} style={{cursor:"pointer",color:"#D0D6E2",fontSize:13}}>✕</span>
                </div>
              ))}
            </div>
          )}
        </>}

        {view==="dashboard"&&<DashboardView fechaMap={fechaMap} fechaLoading={fechaLoading} onRefresh={fetchFechamento} getCell={getCell}/>}

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

      {/* MODAL NOVA TAREFA */}
      {showForm&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div style={S.modal}>
            <div style={{width:36,height:4,background:"#E2E6EE",borderRadius:2,margin:"0 auto 16px"}}/>
            <div style={{fontWeight:700,fontSize:16,color:"#0F2040",marginBottom:15,borderBottom:"2px solid #E8EDF5",paddingBottom:10}}>{editId?"✏️ Editar Tarefa":"✨ Nova Tarefa"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>

              {/* Título */}
              <div><label style={S.lbl}>Título *</label>
                <input style={S.inp} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Admissão João Silva, Folha Cantina..."/>
              </div>

              {/* Tipo de atividade — determina tempo e prioridade automaticamente */}
              <div><label style={S.lbl}>Tipo de Atividade</label>
                <select style={S.inp} value={form.tipo_atividade} onChange={e=>{
                  const tipo=TIPOS_ATIVIDADE[e.target.value];
                  setForm(f=>({...f,tipo_atividade:e.target.value,tempo_estimado:tipo?.tempo||f.tempo_estimado,priority:tipo?.prioridade||f.priority}));
                }}>
                  {Object.entries(TIPOS_ATIVIDADE).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div><label style={S.lbl}>Categoria</label>
                  <select style={S.inp} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                    {Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div><label style={S.lbl}>Prioridade</label>
                  <select style={S.inp} value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
                    {Object.entries(PRIORITIES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div><label style={S.lbl}>Status Operacional</label>
                  <select style={S.inp} value={form.status_operacional} onChange={e=>setForm(f=>({...f,status_operacional:e.target.value}))}>
                    {Object.entries(STATUS_OPERACIONAL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div><label style={S.lbl}>Tempo estimado (min)</label>
                  <input type="number" style={S.inp} value={form.tempo_estimado} min={10} step={10}
                    onChange={e=>setForm(f=>({...f,tempo_estimado:Number(e.target.value)}))}/>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div><label style={S.lbl}>Prazo</label>
                  <input type="date" style={S.inp} value={form.due} onChange={e=>setForm(f=>({...f,due:e.target.value}))}/>
                </div>
                <div><label style={S.lbl}>Data de Entrada</label>
                  <input type="date" style={S.inp} value={form.created_at} onChange={e=>setForm(f=>({...f,created_at:e.target.value}))}/>
                </div>
              </div>

              <div><label style={S.lbl}>Cliente</label>
                <input style={S.inp} value={form.client} onChange={e=>setForm(f=>({...f,client:e.target.value}))} placeholder="Nome do cliente..."/>
              </div>

              {/* Campos condicionais */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {form.tipo_atividade==="admissao"&&(
                  <div style={{display:"flex",alignItems:"center",gap:8,background:"#F3E5F5",borderRadius:8,padding:"10px 12px"}}>
                    <input type="checkbox" id="doc" checked={form.documentacao_completa} onChange={e=>setForm(f=>({...f,documentacao_completa:e.target.checked}))} style={{width:16,height:16,cursor:"pointer"}}/>
                    <label htmlFor="doc" style={{fontSize:12.5,fontWeight:600,color:"#6A1B9A",cursor:"pointer"}}>Documentação completa</label>
                  </div>
                )}
                <div style={{display:"flex",alignItems:"center",gap:8,background:"#E8EDF5",borderRadius:8,padding:"10px 12px"}}>
                  <input type="checkbox" id="ag" checked={form.permite_agendamento} onChange={e=>setForm(f=>({...f,permite_agendamento:e.target.checked}))} style={{width:16,height:16,cursor:"pointer"}}/>
                  <label htmlFor="ag" style={{fontSize:12.5,fontWeight:600,color:"#0F2040",cursor:"pointer"}}>Agendar automaticamente</label>
                </div>
              </div>

              {/* Dependência */}
              <div><label style={S.lbl}>Dependência / Observações</label>
                <textarea style={{...S.inp,resize:"none"}} rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Ex: Aguardando retorno do cliente, documentação pendente..."/>
              </div>

              {/* Alerta admissão */}
              {form.tipo_atividade==="admissao"&&form.documentacao_completa&&(
                <div style={{background:"#F3E5F5",border:"1px solid #9C27B0",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#6A1B9A",fontWeight:500}}>
                  ⚡ Admissão com documentação completa — será priorizada automaticamente na agenda. Prazo: 3 dias.
                </div>
              )}

              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button onClick={()=>setShowForm(false)} style={{flex:1,background:"#fff",border:"1px solid #E2E6EE",color:"#6B7A99",borderRadius:8,padding:"12px",fontSize:14,fontFamily:"inherit",cursor:"pointer"}}>Cancelar</button>
                <button onClick={saveForm} disabled={saving} style={{flex:2,background:saving?"#90A4AE":"#0F2040",color:"#fff",border:"none",borderRadius:8,padding:"12px",fontSize:14,fontWeight:700,fontFamily:"inherit",cursor:saving?"not-allowed":"pointer"}}>
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


// ═══════════════════════════════════════════════════════════
// COMPONENTE: AGENDA INTELIGENTE
// ═══════════════════════════════════════════════════════════
function AgendaInteligente({tasks,pending,done,todayTasks,urgentesTab,comunsTab,weekDays,weekStart,weekTasksFor,mesDias,mesDateStr,mesTasksFor,mesNome,mesAno,mesOffset,setMesOffset,offsetInicio,todayStr,onToggle,onEdit,onDelete,S,in2days}){
  const [subView,setSubView]=useState("dia");
  const [agendaTab,setAgendaTab]=useState("urgentes");
  const [dragAgendaIdx,setDragAgendaIdx]=useState(null);
  const [agendaLocal,setAgendaLocal]=useState(null);

  const NM="#0F2040",NML="#E8EDF5",RD="#C41E3A",RDL="#FCEEF1",OW="#F8F7F4",OW2="#FFFFFF",BD="#E2E6EE",TX="#0F2040",TX2="#6B7A99",TX3="#A0AABF";

  // Gerar agenda inteligente do dia
  const agendaDia = useMemo(()=>{ setAgendaLocal(null); return montarAgendaDia(tasks); },[tasks]);
  const resumo = useMemo(()=>gerarResumoIA(tasks,agendaDia),[tasks,agendaDia]);

  const today=new Date();today.setHours(0,0,0,0);
  const weekDaysAll = Array.from({length:7},(_,i)=>addDays(weekStart,i));
  const WDAYS_SHORT=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
  const WFULL_PT=["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"];

  function SubBtn({id,label}){
    const active=subView===id;
    return(
      <button onClick={()=>setSubView(id)} style={{background:active?OW2:"transparent",color:active?NM:TX2,border:"none",borderRadius:8,padding:"7px 18px",fontSize:12.5,fontFamily:"inherit",fontWeight:active?700:400,cursor:"pointer",transition:"all .15s",boxShadow:active?"0 1px 4px rgba(15,32,64,.1)":"none"}}>
        {label}
      </button>
    );
  }

  return(
    <div>
      {/* SUB-NAV */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontWeight:800,fontSize:22,color:TX,letterSpacing:"-0.5px"}}>
            {subView==="dia"?"Agenda de Hoje":subView==="semana"?"Agenda da Semana":"Panorama Mensal"}
          </div>
          <div style={{fontSize:12,color:TX2,marginTop:2}}>
            {subView==="dia"&&today.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
            {subView==="semana"&&`${weekDays[0]?.toLocaleDateString("pt-BR",{day:"numeric",month:"short"})} – ${addDays(weekDays[0]||today,6).toLocaleDateString("pt-BR",{day:"numeric",month:"short",year:"numeric"})}`}
            {subView==="mes"&&`${mesNome} ${mesAno}`}
          </div>
        </div>
        <div style={{background:"#F0F2F7",borderRadius:10,padding:"4px",display:"flex",gap:2}}>
          <SubBtn id="dia" label="📅 Dia"/>
          <SubBtn id="semana" label="🗓 Semana"/>
          <SubBtn id="mes" label="📆 Mês"/>
        </div>
      </div>

      {/* ── VISÃO DIA ── */}
      {subView==="dia"&&<>
        {/* Painel IA */}
        <div style={{background:NM,borderRadius:16,padding:"20px 22px",marginBottom:20,color:"#fff",display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>{resumo.saudacao}</div>
            <div style={{fontSize:12,opacity:0.75,marginBottom:10}}>
              {resumo.totalHoje} tarefa{resumo.totalHoje!==1?"s":""} distribuída{resumo.totalHoje!==1?"s":""} automaticamente na agenda
            </div>
            {resumo.alertas.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {resumo.alertas.map((a,i)=>(
                <span key={i} style={{background:"rgba(196,30,58,0.3)",color:"#FFB3C0",borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:600}}>⚠️ {a}</span>
              ))}
            </div>}
          </div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:28,fontWeight:800,letterSpacing:"-1px"}}>{resumo.carga}%</div>
              <div style={{fontSize:10,opacity:0.6,marginTop:2}}>Ocupação</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:28,fontWeight:800,letterSpacing:"-1px",color:RD==="#C41E3A"?"#FF8FA3":"#FF8FA3"}}>{urgentesTab.length}</div>
              <div style={{fontSize:10,opacity:0.6,marginTop:2}}>Urgentes</div>
            </div>
          </div>
        </div>

        {/* Agenda montada pela IA */}
        <div style={{marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:14,color:TX,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{width:3,height:16,background:RD,borderRadius:2,display:"inline-block"}}/>
            Agenda Montada pela IA
          </div>
          <div style={{background:OW2,borderRadius:12,border:`1px solid ${BD}`,overflow:"hidden"}}
            onDragOver={e=>e.preventDefault()}
            onDrop={e=>{
              e.preventDefault();
              const fromIdx=Number(e.dataTransfer.getData("blocoIdx"));
              if(isNaN(fromIdx))return;
              const lista=agendaLocal||[...agendaDia];
              const item=lista[fromIdx];
              // Calcular posição baseada em Y
              const rect=e.currentTarget.getBoundingClientRect();
              const y=e.clientY-rect.top;
              const toIdx=Math.min(Math.floor(y/(rect.height/lista.length)),lista.length-1);
              if(fromIdx===toIdx)return;
              const nova=[...lista];
              nova.splice(fromIdx,1);
              nova.splice(toIdx,0,item);
              setAgendaLocal(nova);
              setDragAgendaIdx(null);
            }}>
            {(agendaLocal||agendaDia).map((item,i)=>{
              const cat=item.cat?CATEGORIES[item.cat]:null;
              const corBorda=item.tipo==="ritual"?NM:item.tipo==="atendimento"?"#2E7D32":cat?.color||NM;
              const isDrag=item.tipo==="tarefa";
              const lista=agendaLocal||agendaDia;
              return(
                <div key={i}
                  draggable={isDrag}
                  onDragStart={e=>{if(isDrag){e.dataTransfer.setData("idx",String(i));setDragAgendaIdx(i);}}}
                  onDragEnd={()=>setDragAgendaIdx(null)}
                  onDragOver={e=>{e.preventDefault();e.currentTarget.style.background="#E8EDF5";}}
                  onDragLeave={e=>{e.currentTarget.style.background="";}}
                  onDrop={e=>{
                    e.preventDefault();
                    e.currentTarget.style.background="";
                    const from=Number(e.dataTransfer.getData("idx"));
                    if(isNaN(from)||from===i)return;
                    const nova=[...lista];
                    const [moved]=nova.splice(from,1);
                    nova.splice(i,0,moved);
                    setAgendaLocal(nova);
                    setDragAgendaIdx(null);
                  }}
                  style={{display:"flex",gap:0,borderBottom:i<lista.length-1?`1px solid ${BD}`:"none",opacity:dragAgendaIdx===i?0.4:1,transition:"opacity .15s",cursor:isDrag?"grab":"default"}}>
                  <div style={{width:72,padding:"12px 10px 12px 14px",borderRight:`1px solid ${BD}`,flexShrink:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:TX}}>{item.hora}</div>
                    <div style={{fontSize:10,color:TX3,marginTop:1}}>{item.horaFim}</div>
                    {isDrag&&<div style={{fontSize:9,color:TX3,marginTop:2,textAlign:"center"}}>⠿</div>}
                  </div>
                  <div style={{flex:1,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,borderLeft:`3px solid ${corBorda}`,background:i%2===0?"#FAFBFD":OW2}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:TX}}>{item.titulo}</div>
                      <div style={{display:"flex",gap:5,marginTop:4,flexWrap:"wrap"}}>
                        {item.tipo==="tarefa"&&cat&&<span style={{fontSize:9.5,background:cat.bg,color:cat.color,border:`1px solid ${cat.color}22`,borderRadius:5,padding:"1px 7px",fontWeight:600}}>{cat.icon} {cat.label}</span>}
                        {item.tipoAtiv&&TIPOS_ATIVIDADE[item.tipoAtiv]&&<span style={{fontSize:9.5,background:"#F0F2F7",color:"#0F2040",borderRadius:5,padding:"1px 7px",fontWeight:500}}>{TIPOS_ATIVIDADE[item.tipoAtiv].icon} {TIPOS_ATIVIDADE[item.tipoAtiv].label}</span>}
                        {item.cliente&&<span style={{fontSize:9.5,color:TX2}}>👤 {item.cliente}</span>}
                        {item.atrasada&&<span style={{fontSize:9.5,background:"#FCEEF1",color:"#C41E3A",borderRadius:5,padding:"1px 7px",fontWeight:700}}>⚠️ Atrasada</span>}
                        {item.obs&&<span style={{fontSize:9.5,color:TX3,fontStyle:"italic"}}>{item.obs}</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
                      {item.tipo==="tarefa"&&<span style={{fontSize:9.5,background:NML,color:NM,borderRadius:5,padding:"2px 7px",fontWeight:600}}>
                        {Math.round(toMin(item.horaFim)-toMin(item.hora))}min
                      </span>}
                      {isDrag&&item.id&&<div style={{display:"flex",gap:4}}>
                        <span onClick={e=>{e.stopPropagation();const t=tasks?.find(x=>x.id===item.id);if(t)onEdit(t);}} style={{cursor:"pointer",fontSize:11,color:TX3}} title="Editar">✏️</span>
                        <span onClick={e=>{e.stopPropagation();const t=tasks?.find(x=>x.id===item.id);if(t)onToggle(t);}} style={{cursor:"pointer",fontSize:11,color:"#1B6B3A"}} title="Concluir">✓</span>
                      </div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Abas urgentes / comuns */}
        <div style={{display:"flex",gap:0,marginBottom:14,background:OW2,borderRadius:12,border:`1px solid ${BD}`,overflow:"hidden"}}>
          <button onClick={()=>setAgendaTab("urgentes")} style={{flex:1,background:agendaTab==="urgentes"?RD:OW2,color:agendaTab==="urgentes"?"#fff":TX2,border:"none",padding:"12px 0",fontSize:13,fontWeight:700,fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7,transition:"all .15s"}}>
            🔴 Urgentes
            {urgentesTab.length>0&&<span style={{background:agendaTab==="urgentes"?"rgba(255,255,255,0.25)":RDL,color:agendaTab==="urgentes"?"#fff":RD,borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:700}}>{urgentesTab.length}</span>}
          </button>
          <div style={{width:1,background:BD}}/>
          <button onClick={()=>setAgendaTab("comuns")} style={{flex:1,background:agendaTab==="comuns"?NM:OW2,color:agendaTab==="comuns"?"#fff":TX2,border:"none",padding:"12px 0",fontSize:13,fontWeight:700,fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7,transition:"all .15s"}}>
            📋 Tarefas do Dia
            {comunsTab.length>0&&<span style={{background:agendaTab==="comuns"?"rgba(255,255,255,0.25)":NML,color:agendaTab==="comuns"?"#fff":NM,borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:700}}>{comunsTab.length}</span>}
          </button>
        </div>

        {agendaTab==="urgentes"&&(urgentesTab.length===0
          ?<Empty icon="✅" msg="Nenhuma tarefa urgente!" sub="Você está em dia com as prioridades."/>
          :urgentesTab.map((t,i)=><Card key={t.id} t={t} i={i} S={S} onToggle={()=>onToggle(t)} onEdit={()=>onEdit(t)} onDelete={()=>onDelete(t.id)}/>)
        )}
        {agendaTab==="comuns"&&(comunsTab.length===0
          ?<Empty icon="🎉" msg="Nenhuma tarefa comum para hoje!"/>
          :comunsTab.map((t,i)=><Card key={t.id} t={t} i={i} S={S} onToggle={()=>onToggle(t)} onEdit={()=>onEdit(t)} onDelete={()=>onDelete(t.id)}/>)
        )}
      </>}

      {/* ── VISÃO SEMANA ── */}
      {subView==="semana"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6,marginBottom:18}}>
          {weekDaysAll.map((day,i)=>{
            const ds=fmtDate(day); const dt=weekTasksFor(ds);
            const isToday=ds===todayStr; const isPast=ds<todayStr;
            return(
              <div key={ds} style={{background:isToday?NML:OW2,border:`1.5px solid ${isToday?NM:BD}`,borderRadius:12,padding:"10px 8px",minHeight:110,boxShadow:isToday?"0 2px 8px rgba(15,32,64,.1)":"0 1px 3px rgba(15,32,64,.04)"}}>
                <div style={{fontSize:9.5,color:isToday?NM:TX2,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>{WDAYS_SHORT[i]}</div>
                <div style={{fontSize:18,fontWeight:800,color:isToday?NM:isPast?TX3:TX,letterSpacing:"-0.5px",marginTop:1}}>{day.getDate()}</div>
                <div style={{display:"flex",flexDirection:"column",gap:3,marginTop:5}}>
                  {dt.map(t=><div key={t.id} style={{background:CATEGORIES[t.category]?.bg||NML,color:CATEGORIES[t.category]?.color||NM,borderRadius:5,padding:"2px 5px",fontSize:9,lineHeight:1.4,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",fontWeight:500}}>{CATEGORIES[t.category]?.icon} {t.title}</div>)}
                  {dt.length===0&&<div style={{fontSize:10,color:TX3,textAlign:"center",marginTop:6}}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
        {weekDaysAll.map((day,i)=>{
          const ds=fmtDate(day); const dt=weekTasksFor(ds); if(!dt.length)return null;
          const isToday=ds===todayStr;
          return(
            <div key={ds} style={{marginBottom:16}}>
              <div style={{fontSize:11.5,fontWeight:700,color:isToday?NM:TX2,marginBottom:8,display:"flex",alignItems:"center",gap:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>
                <span style={{width:3,height:14,background:isToday?RD:BD,borderRadius:2,display:"inline-block"}}/>
                {WFULL_PT[i]}, {day.toLocaleDateString("pt-BR",{day:"numeric",month:"short"})}
                {isToday&&<span style={{fontSize:9.5,background:RD,color:"#fff",borderRadius:5,padding:"2px 7px",fontWeight:700}}>HOJE</span>}
              </div>
              {dt.map((t,j)=><Card key={t.id} t={t} i={j} S={S} compact onToggle={()=>onToggle(t)} onEdit={()=>onEdit(t)} onDelete={()=>onDelete(t.id)}/>)}
            </div>
          );
        })}
      </>}

      {/* ── VISÃO MÊS ── */}
      {subView==="mes"&&<>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,justifyContent:"flex-end"}}>
          <button onClick={()=>setMesOffset(o=>o-1)} style={{background:OW2,border:`1px solid ${BD}`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:14,color:TX}}>‹</button>
          <span style={{fontWeight:700,fontSize:13,color:NM,minWidth:120,textAlign:"center"}}>{mesNome} {mesAno}</span>
          <button onClick={()=>setMesOffset(o=>o+1)} style={{background:OW2,border:`1px solid ${BD}`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:14,color:TX}}>›</button>
          {mesOffset!==0&&<button onClick={()=>setMesOffset(0)} style={{background:NML,border:`1px solid ${NM}`,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:10.5,color:NM,fontWeight:700}}>Hoje</button>}
        </div>
        <div style={{background:OW2,border:`1px solid ${BD}`,borderRadius:14,padding:14,marginBottom:18,boxShadow:"0 1px 4px rgba(15,32,64,.04)"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:6}}>
            {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:600,color:TX2,padding:"3px 0"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {Array.from({length:offsetInicio},(_,i)=><div key={"e"+i}/>)}
            {mesDias.map(d=>{
              const ds=mesDateStr(d); const dt=mesTasksFor(ds);
              const isToday=ds===todayStr; const isPast=ds<todayStr;
              const temUrg=dt.some(t=>t.priority==="urgente"); const temAlta=dt.some(t=>t.priority==="alta");
              return(
                <div key={d} style={{minHeight:50,border:`1.5px solid ${isToday?NM:BD}`,borderRadius:8,padding:"4px 5px",background:isToday?NML:isPast?"#FAFBFD":OW2,position:"relative"}}>
                  <div style={{fontSize:11,fontWeight:isToday?800:400,color:isToday?NM:isPast?TX3:TX}}>{d}</div>
                  {dt.slice(0,2).map(t=><div key={t.id} style={{fontSize:7.5,background:CATEGORIES[t.category]?.bg||NML,color:CATEGORIES[t.category]?.color||NM,borderRadius:3,padding:"1px 3px",marginTop:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{t.title}</div>)}
                  {dt.length>2&&<div style={{fontSize:7.5,color:TX3}}>+{dt.length-2}</div>}
                  {temUrg&&<div style={{position:"absolute",top:3,right:3,width:6,height:6,borderRadius:"50%",background:RD}}/>}
                  {!temUrg&&temAlta&&<div style={{position:"absolute",top:3,right:3,width:6,height:6,borderRadius:"50%",background:"#E65100"}}/>}
                </div>
              );
            })}
          </div>
        </div>
        {mesDias.map(d=>{
          const ds=mesDateStr(d); const dt=mesTasksFor(ds); if(!dt.length)return null;
          const isToday=ds===todayStr;
          return(
            <div key={d} style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:isToday?NM:TX2,marginBottom:6,display:"flex",alignItems:"center",gap:7,textTransform:"uppercase",letterSpacing:"0.5px"}}>
                <span style={{width:3,height:12,background:isToday?RD:BD,borderRadius:2,display:"inline-block"}}/>
                {WFULL_PT[new Date(ds+"T12:00:00").getDay()===0?6:new Date(ds+"T12:00:00").getDay()-1]}, {ptDate(ds)}
                {isToday&&<span style={{fontSize:9,background:RD,color:"#fff",borderRadius:4,padding:"1px 6px",fontWeight:700}}>HOJE</span>}
              </div>
              {dt.map((t,j)=><Card key={t.id} t={t} i={j} S={S} compact onToggle={()=>onToggle(t)} onEdit={()=>onEdit(t)} onDelete={()=>onDelete(t.id)}/>)}
            </div>
          );
        })}
        {!mesDias.some(d=>mesTasksFor(mesDateStr(d)).length>0)&&<Empty icon="📅" msg={`Nenhuma tarefa em ${mesNome}.`}/>}
      </>}
    </div>
  );
}


function Card({t,i,S,onToggle,onEdit,onDelete,compact,showDates}){
  const cat=CATEGORIES[t.category]||CATEGORIES.fiscal;
  const pri=PRIORITIES[t.priority]||PRIORITIES.media;
  const st=statusInfo(t);
  const isProx=diffDays(t.due)>0;
  const NM="#0F2040",NML="#E8EDF5",RD="#C41E3A",RDL="#FCEEF1",BD="#E2E6EE",TX="#0F2040",TX2="#6B7A99";
  return(
    <div className="tc" style={{background:"#FFFFFF",border:`1px solid ${BD}`,borderLeft:`3px solid ${cat.color}`,borderRadius:12,padding:compact?"10px 14px":"14px 16px",display:"flex",alignItems:"flex-start",gap:12,marginBottom:8,boxShadow:"0 1px 4px rgba(15,32,64,.04)",transition:"box-shadow .15s"}}>
      <span onClick={onToggle} style={{width:24,height:24,borderRadius:"50%",border:`2px solid ${cat.color}22`,flexShrink:0,cursor:"pointer",marginTop:1,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:cat.color,background:cat.bg,transition:"transform .15s"}} title="Concluir"/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:compact?12.5:14,fontWeight:600,color:TX,lineHeight:1.3,marginBottom:5}}>{t.title}</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{background:cat.bg,color:cat.color,border:`1px solid ${cat.color}22`,borderRadius:5,padding:"2px 7px",fontSize:9.5,fontWeight:600}}>{cat.icon} {cat.label}</span>
          {t.tipo_atividade&&t.tipo_atividade!=="outros"&&TIPOS_ATIVIDADE[t.tipo_atividade]&&<span style={{background:"#F0F2F7",color:"#0F2040",borderRadius:5,padding:"2px 7px",fontSize:9.5,fontWeight:500}}>{TIPOS_ATIVIDADE[t.tipo_atividade].icon} {TIPOS_ATIVIDADE[t.tipo_atividade].label}</span>}
          <span style={{background:pri.bg||"#F5F6FA",color:pri.color,borderRadius:5,padding:"2px 7px",fontSize:9.5,fontWeight:600}}>{pri.dot} {pri.label}</span>
          {t.status_operacional&&t.status_operacional!=="pronto"&&t.status_operacional!=="concluido"&&<span style={{background:"#FFF8E1",color:"#F57F17",borderRadius:5,padding:"2px 7px",fontSize:9.5,fontWeight:500}}>⏳ {STATUS_OPERACIONAL[t.status_operacional]}</span>}
          {t.tipo_atividade==="admissao"&&!t.documentacao_completa&&<span style={{background:"#FFF3E0",color:"#E65100",borderRadius:5,padding:"2px 7px",fontSize:9.5,fontWeight:600}}>📋 Aguard. doc</span>}
          {isProx&&(t.priority==="urgente"||t.priority==="alta")&&<span style={{background:RDL,color:RD,borderRadius:5,padding:"2px 7px",fontSize:9.5,fontWeight:600}}>⚡ próx.7d</span>}
          {!compact&&t.client&&<span style={{fontSize:10,color:TX2}}>👤 {t.client}</span>}
          {!compact&&showDates&&t.created_at&&<span style={{fontSize:10,color:TX2}}>📅 {ptDate(t.created_at)}</span>}
          {!compact&&t.notes&&<span style={{fontSize:10,color:TX2,fontStyle:"italic"}}>📝 {t.notes}</span>}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
        <span style={{fontSize:10,background:st.bg,color:st.color,borderRadius:6,padding:"3px 9px",fontWeight:700,whiteSpace:"nowrap"}}>{st.label}</span>
        <div style={{display:"flex",gap:3}}>
          <span onClick={onEdit} style={{cursor:"pointer",color:"#B0BAD0",fontSize:13,padding:"3px 5px",borderRadius:5}} title="Editar">✏️</span>
          <span onClick={onDelete} style={{cursor:"pointer",color:"#D0D6E2",fontSize:13,padding:"3px 5px",borderRadius:5}} title="Excluir">✕</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CENTRAL DE PLANEJAMENTO INTELIGENTE
// ═══════════════════════════════════════════════════════════

const FERIAS_INICIO = "2026-07-13";
const FERIAS_FIM    = "2026-07-24";
const NOME_USUARIO  = "Deborah";

const CP_CATS = {
  admissao:      { label:"Admissão",            color:"#7B1FA2", bg:"#F3E5F5", icon:"👤", tempo:30,  prioBase:"urgente" },
  rescisao:      { label:"Rescisão",             color:"#C62828", bg:"#FFEBEE", icon:"📄", tempo:60,  prioBase:"urgente" },
  folha:         { label:"Folha de Pagamento",   color:"#1565C0", bg:"#E3F0FF", icon:"💼", tempo:120, prioBase:"alta"    },
  guias:         { label:"Guias/DARF/FGTS",      color:"#E65100", bg:"#FFF3E0", icon:"📋", tempo:60,  prioBase:"alta"    },
  reinf:         { label:"REINF/PER-DCOMP",      color:"#00838F", bg:"#E0F7FA", icon:"📊", tempo:60,  prioBase:"alta"    },
  atendimento:   { label:"Atendimento Cliente",  color:"#2E7D32", bg:"#E8F5E9", icon:"🤝", tempo:30,  prioBase:"alta"    },
  reuniao:       { label:"Reunião",              color:"#1565C0", bg:"#E3F0FF", icon:"👥", tempo:60,  prioBase:"media"   },
  marketing:     { label:"Marketing",            color:"#AD1457", bg:"#FCE4EC", icon:"📣", tempo:10,  prioBase:"baixa"   },
  convencao:     { label:"Convenção Coletiva",   color:"#6A1B9A", bg:"#F3E5F5", icon:"⚖️", tempo:30,  prioBase:"media"   },
  parametrizacao:{ label:"Parametrização",       color:"#37474F", bg:"#ECEFF1", icon:"⚙️", tempo:60,  prioBase:"media"   },
  estudo:        { label:"Estudos",              color:"#558B2F", bg:"#F1F8E9", icon:"📚", tempo:90,  prioBase:"baixa"   },
  gestao:        { label:"Gestão Interna",       color:"#455A64", bg:"#ECEFF1", icon:"🏢", tempo:30,  prioBase:"media"   },
  checkin:       { label:"Check-in Diário",      color:"#1565C0", bg:"#E3F0FF", icon:"✅", tempo:15,  prioBase:"urgente" },
  checkout:      { label:"Check-out Diário",     color:"#1565C0", bg:"#E3F0FF", icon:"🔍", tempo:15,  prioBase:"urgente" },
};

const CP_PRIOS = {
  urgente: { label:"Urgente",  color:"#C62828", bg:"#FFEBEE", ordem:1 },
  alta:    { label:"Alta",     color:"#E65100", bg:"#FFF3E0", ordem:2 },
  media:   { label:"Média",    color:"#F9A825", bg:"#FFFDE7", ordem:3 },
  baixa:   { label:"Baixa",    color:"#2E7D32", bg:"#E8F5E9", ordem:4 },
};

const HORARIOS_ATENDIMENTO = [
  { inicio:"09:00", fim:"09:30" },
  { inicio:"11:30", fim:"12:00" },
  { inicio:"14:00", fim:"14:30" },
  { inicio:"16:00", fim:"16:30" },
];

const BLOCOS_FIXOS_BASE = [
  { titulo:"✅ Check-in Diário",  categoria:"checkin",  hora_inicio:"08:00", hora_fim:"08:15", prioridade:"urgente", observacoes:"Revisão de prioridades · Urgências · Organização do dia", ritual:true },
  { titulo:"🔍 Check-out Diário", categoria:"checkout", hora_inicio:"16:45", hora_fim:"17:00", prioridade:"urgente", observacoes:"Conferência de entregas · Pendências · Planejamento amanhã",  ritual:true },
  { titulo:"👥 Atendimento Clientes", categoria:"atendimento", hora_inicio:"09:00", hora_fim:"09:30", prioridade:"media", observacoes:"Reservado para atendimento", ritual:true },
  { titulo:"👥 Atendimento Clientes", categoria:"atendimento", hora_inicio:"11:30", hora_fim:"12:00", prioridade:"media", observacoes:"Reservado para atendimento", ritual:true },
  { titulo:"👥 Atendimento Clientes", categoria:"atendimento", hora_inicio:"14:00", hora_fim:"14:30", prioridade:"media", observacoes:"Reservado para atendimento", ritual:true },
  { titulo:"👥 Atendimento Clientes", categoria:"atendimento", hora_inicio:"16:00", hora_fim:"16:30", prioridade:"media", observacoes:"Reservado para atendimento", ritual:true },
];

function cpToMin(t){ const[h,m]=t.split(":").map(Number); return h*60+m; }
function cpAddMin(t,m){ const tot=cpToMin(t)+m; return `${String(Math.floor(tot/60)).padStart(2,"0")}:${String(tot%60).padStart(2,"0")}`; }
function cpFmtDate(d){ return d.toISOString().split("T")[0]; }
function cpPtDate(s){ if(!s)return"—"; const[y,m,d]=s.split("-"); return`${d}/${m}/${y}`; }
function cpGetWeekDates(offset=0){
  const now=new Date(); const day=now.getDay();
  const diff=now.getDate()-day+(day===0?-6:1)+offset*7;
  return Array.from({length:5},(_,i)=>{ const d=new Date(now); d.setDate(diff+i); return d; });
}
function cpIsFerias(dateStr){ return dateStr>=FERIAS_INICIO&&dateStr<=FERIAS_FIM; }
function cpNextWeekday(dateStr){
  const d=new Date(dateStr+"T12:00:00");
  do{ d.setDate(d.getDate()-1); }while(d.getDay()===0||d.getDay()===6);
  return cpFmtDate(d);
}

const CP_DIAS=["Segunda","Terça","Quarta","Quinta","Sexta"];
const CP_MESES=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function CentralPlanejamento({ supabase, tasks, pending }){
  const [blocos,setBlocos]   = useState([]);
  const [log,setLog]         = useState([]);
  const [reunioes,setReunioes] = useState([]);
  const [loading,setLoading] = useState(true);
  const [subView,setSubView] = useState("painel"); // painel | dia | semana | mes | historico | log | reunioes
  const [weekOffset,setWeekOffset] = useState(0);
  const [diaOffset,setDiaOffset]   = useState(0);
  const [mesOffset,setMesOffset]   = useState(0);
  const [showFormCp,setShowFormCp] = useState(false);
  const [showFormReuniao,setShowFormReuniao] = useState(false);
  const [editBlocoId,setEditBlocoId] = useState(null);
  const [toastCp,setToastCp] = useState(null);
  const [painelIA,setPainelIA] = useState(null);
  const [loadingIA,setLoadingIA] = useState(false);
  const [dragId,setDragId]   = useState(null);
  const [buscaHist,setBuscaHist] = useState("");
  const [filtroHistCliente,setFiltroHistCliente] = useState("");

  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = cpFmtDate(today);
  const diaAtual = new Date(today); diaAtual.setDate(today.getDate()+diaOffset);
  const diaStr   = cpFmtDate(diaAtual);

  const weekDates = cpGetWeekDates(weekOffset);
  const mesRef    = useMemo(()=>{ const d=new Date(today); d.setDate(1); d.setMonth(d.getMonth()+mesOffset); return d; },[mesOffset]);

  const emptyBloco = { titulo:"", categoria:"folha", prioridade:"alta", data:todayStr, hora_inicio:"08:15", hora_fim:"09:15", tempo_previsto:60, tempo_realizado:0, observacoes:"", cliente:"", concluido:false, ritual:false, recorrencia:"nenhuma" };
  const [formCp,setFormCp] = useState(emptyBloco);
  const emptyReuniao = { cliente:"", assunto:"", data:todayStr, hora:"09:00", duracao:60, observacoes:"", status:"agendada" };
  const [formReuniao,setFormReuniao] = useState(emptyReuniao);

  useEffect(()=>{ fetchAll(); },[weekOffset]);

  async function fetchAll(){
    setLoading(true);
    const start=cpFmtDate(weekDates[0]); const end=cpFmtDate(weekDates[4]);
    const [b,l,r] = await Promise.all([
      supabase.from("planejamento").select("*").gte("data",start).lte("data",end).order("hora_inicio"),
      supabase.from("planejamento_log").select("*").order("created_at",{ascending:false}).limit(50),
      supabase.from("reunioes_clientes").select("*").order("data",{ascending:false}).limit(30),
    ]);
    setBlocos(b.data||[]); setLog(l.data||[]); setReunioes(r.data||[]);
    setLoading(false);
  }

  async function fetchHistorico(){
    const{data}=await supabase.from("planejamento").select("*").eq("concluido",true).order("created_at",{ascending:false});
    return data||[];
  }

  function showToastCp(msg,type="ok"){ setToastCp({msg,type}); setTimeout(()=>setToastCp(null),4000); }

  async function registrarLog(tipo,descricao,dados={}){
    await supabase.from("planejamento_log").insert([{tipo,descricao,dados}]);
  }

  // ── CRIAR RITUAIS AUTOMÁTICOS ──
  async function criarRituaisSemana(){
    const start=cpFmtDate(weekDates[0]); const end=cpFmtDate(weekDates[4]);
    const{data:exist}=await supabase.from("planejamento").select("id").eq("ritual",true).gte("data",start).lte("data",end);
    if(exist&&exist.length>0) return;
    const inserts=[];
    weekDates.forEach(d=>{
      const ds=cpFmtDate(d);
      if(cpIsFerias(ds)) return;
      BLOCOS_FIXOS_BASE.forEach(b=>{ inserts.push({...b,data:ds,tempo_previsto:cpToMin(b.hora_fim)-cpToMin(b.hora_inicio),tempo_realizado:0,cliente:""}); });
    });
    if(inserts.length>0){ await supabase.from("planejamento").insert(inserts); await fetchAll(); showToastCp("✅ Rituais da semana criados!"); await registrarLog("ritual","Rituais automáticos criados para a semana"); }
  }

  useEffect(()=>{ if(!loading) criarRituaisSemana(); },[loading]);

  // ── CRIAR RECORRENTES AUTOMÁTICOS ──
  async function criarRecorrentesSemanais(){
    const start=cpFmtDate(weekDates[0]);
    const{data:exist}=await supabase.from("planejamento").select("id").eq("recorrencia","semanal_auto").gte("data",start).lte("data",cpFmtDate(weekDates[4]));
    if(exist&&exist.length>0) return;
    const inserts=[];
    weekDates.forEach((d,i)=>{
      const ds=cpFmtDate(d); if(cpIsFerias(ds)) return;
      // Marketing: Seg(0), Qua(2), Sex(4) às 10:00
      if([0,2,4].includes(i)) inserts.push({titulo:"📣 Publicação de Conteúdo",categoria:"marketing",prioridade:"baixa",data:ds,hora_inicio:"10:00",hora_fim:"10:10",tempo_previsto:10,tempo_realizado:0,observacoes:"Publicação de conteúdo nas redes",cliente:"",concluido:false,ritual:false,recorrencia:"semanal_auto"});
    });
    if(inserts.length>0){ await supabase.from("planejamento").insert(inserts); showToastCp("📣 Marketing da semana criado!"); }
  }

  // ── REORGANIZAÇÃO AUTOMÁTICA ──
  async function reorganizarAgenda(novaUrgencia){
    const ds=novaUrgencia.data;
    const{data:blocosDia}=await supabase.from("planejamento").select("*").eq("data",ds).eq("concluido",false).order("hora_inicio");
    if(!blocosDia||blocosDia.length===0) return;
    const urgentes=blocosDia.filter(b=>b.prioridade==="urgente"||b.categoria==="admissao"||b.categoria==="rescisao");
    const outros=blocosDia.filter(b=>b.prioridade!=="urgente"&&b.categoria!=="admissao"&&b.categoria!=="rescisao"&&!b.ritual);
    const justificativas=[];
    let horaAtual=cpAddMin(novaUrgencia.hora_fim,5);
    for(const b of outros){
      if(cpToMin(horaAtual)+b.tempo_previsto>cpToMin("12:00")&&cpToMin(horaAtual)<cpToMin("14:00")) horaAtual="14:00";
      if(cpToMin(horaAtual)+b.tempo_previsto>cpToMin("17:00")) break;
      const novaHoraFim=cpAddMin(horaAtual,b.tempo_previsto);
      if(b.hora_inicio!==horaAtual){
        await supabase.from("planejamento").update({hora_inicio:horaAtual,hora_fim:novaHoraFim}).eq("id",b.id);
        justificativas.push(`"${b.titulo}" reagendado de ${b.hora_inicio} para ${horaAtual}`);
      }
      horaAtual=cpAddMin(novaHoraFim,5);
    }
    if(justificativas.length>0){
      const desc=`Urgência "${novaUrgencia.titulo}" inserida. ${justificativas.join(". ")}`;
      await registrarLog("reorganizacao",desc,{tarefa:novaUrgencia.titulo,afetadas:justificativas});
      showToastCp(`⚡ Agenda reorganizada! ${justificativas.length} tarefa(s) realocada(s)`);
      await fetchAll();
    }
  }

  // ── SALVAR BLOCO ──
  async function saveBloco(){
    if(!formCp.titulo.trim()) return;
    const cat=CP_CATS[formCp.categoria];
    const payload={...formCp, tempo_previsto:cpToMin(formCp.hora_fim)-cpToMin(formCp.hora_inicio), cor:cat?.color||"#1565C0"};
    if(cpIsFerias(payload.data)){ showToastCp("⚠️ Período de férias! Agenda bloqueada.","err"); return; }
    if(editBlocoId){
      await supabase.from("planejamento").update(payload).eq("id",editBlocoId);
      showToastCp("Bloco atualizado!");
    } else {
      const{data}=await supabase.from("planejamento").insert([payload]).select();
      showToastCp("Bloco criado!");
      if(data&&data[0]&&(payload.prioridade==="urgente"||payload.categoria==="admissao"||payload.categoria==="rescisao")){
        await reorganizarAgenda(data[0]);
      }
    }
    setShowFormCp(false); setEditBlocoId(null); setFormCp(emptyBloco); fetchAll();
  }

  async function deleteBloco(id){ await supabase.from("planejamento").delete().eq("id",id); setBlocos(prev=>prev.filter(b=>b.id!==id)); }
  async function toggleConcluido(b){
    const v=!b.concluido;
    await supabase.from("planejamento").update({concluido:v}).eq("id",b.id);
    setBlocos(prev=>prev.map(x=>x.id===b.id?{...x,concluido:v}:x));
    if(v) await registrarLog("conclusao",`"${b.titulo}" concluído`,{cliente:b.cliente,data:b.data});
  }
  async function duplicar(b){ const{id,...r}=b; await supabase.from("planejamento").insert([{...r,concluido:false,titulo:r.titulo+" (cópia)"}]); fetchAll(); showToastCp("Duplicado!"); }
  async function moverDia(b,novaData){ await supabase.from("planejamento").update({data:novaData}).eq("id",b.id); await registrarLog("movimentacao",`"${b.titulo}" movido para ${cpPtDate(novaData)}`); fetchAll(); }

  async function saveReuniao(){
    if(!formReuniao.cliente.trim()) return;
    await supabase.from("reunioes_clientes").insert([formReuniao]);
    showToastCp("Reunião registrada!"); setShowFormReuniao(false); setFormReuniao(emptyReuniao);
    const{data}=await supabase.from("reunioes_clientes").select("*").order("data",{ascending:false}).limit(30);
    setReunioes(data||[]);
  }

  // ── PAINEL IA ──
  async function gerarPainelIA(){
    setLoadingIA(true);
    const hoje=blocos.filter(b=>b.data===todayStr).sort((a,b)=>cpToMin(a.hora_inicio)-cpToMin(b.hora_inicio));
    const atrasadas=pending?.filter(t=>t.due<todayStr)||[];
    const urgentes=pending?.filter(t=>t.priority==="urgente"||t.priority==="alta")||[];
    const prompt=`Você é um assistente de gestão do tempo para um escritório contábil chamado BM Contabilidade, da Deborah.

Hoje é ${new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}.

Blocos já agendados para hoje:
${hoje.map(b=>`- ${b.hora_inicio}–${b.hora_fim}: ${b.titulo} (${b.categoria})`).join("\n")||"Nenhum bloco agendado"}

Tarefas atrasadas (${atrasadas.length}):
${atrasadas.slice(0,5).map(t=>`- ${t.title} (cliente: ${t.client||"—"}, prazo: ${t.due})`).join("\n")||"Nenhuma"}

Tarefas urgentes/altas pendentes (${urgentes.length}):
${urgentes.slice(0,5).map(t=>`- ${t.title} (cliente: ${t.client||"—"}, prazo: ${t.due})`).join("\n")||"Nenhuma"}

Gere um resumo inteligente do dia no seguinte formato JSON:
{
  "saudacao": "Bom dia Deborah! [frase motivadora breve]",
  "resumo": "[2 frases resumindo o dia]",
  "sugestao_agenda": [
    {"horario": "08:15–08:45", "tarefa": "...", "motivo": "..."},
    {"horario": "08:45–10:15", "tarefa": "...", "motivo": "..."}
  ],
  "carga_prevista": 85,
  "prioridade_maxima": "...",
  "alertas": ["...", "..."]
}

Responda APENAS com o JSON, sem texto adicional.`;

    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{role:"user",content:prompt}] })
      });
      const data=await res.json();
      const txt=data.content?.[0]?.text||"{}";
      const clean=txt.replace(/```json|```/g,"").trim();
      setPainelIA(JSON.parse(clean));
    } catch(e){ showToastCp("Erro ao carregar IA","err"); }
    setLoadingIA(false);
  }

  useEffect(()=>{ if(subView==="painel"&&!painelIA) gerarPainelIA(); },[subView]);

  // Utilitários
  function blocosDia(ds){ return blocos.filter(b=>b.data===ds).sort((a,b)=>cpToMin(a.hora_inicio)-cpToMin(b.hora_inicio)); }
  const horasPlanejadasHoje = blocos.filter(b=>b.data===todayStr).reduce((s,b)=>s+(b.tempo_previsto||0),0);
  const concluidosHoje = blocos.filter(b=>b.data===todayStr&&b.concluido).length;
  const pendentesHoje  = blocos.filter(b=>b.data===todayStr&&!b.concluido).length;

  const C="#1565C0",CL="#E3F0FF",BD="#DDE3F0",TX="#1A2340",TX2="#5A6580",GR="#F5F6FA",RD="#C62828",RL="#FFEBEE";
  const inp={width:"100%",background:GR,border:`1px solid ${BD}`,borderRadius:8,padding:"9px 11px",color:TX,fontSize:13,fontFamily:"inherit"};
  const lbl={fontSize:10,color:TX2,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.5px",fontWeight:600};

  function BlocoItem({b,showDate}){
    const cat=CP_CATS[b.categoria]||CP_CATS.gestao;
    const pri=CP_PRIOS[b.prioridade]||CP_PRIOS.media;
    const cor=b.cor||cat.color;
    return(
      <div draggable onDragStart={()=>setDragId(b.id)} onDragEnd={()=>setDragId(null)}
        style={{background:b.concluido?"#F9F9F9":cat.bg,border:`1.5px solid ${cor}`,borderLeft:`4px solid ${cor}`,borderRadius:8,padding:"9px 12px",marginBottom:6,opacity:b.concluido?0.6:1,cursor:"grab"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700,color:b.concluido?"#999":TX,textDecoration:b.concluido?"line-through":"none"}}>{b.titulo}</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:3}}>
              <span style={{fontSize:9.5,background:cat.bg,color:cat.color,border:`1px solid ${cat.color}44`,borderRadius:4,padding:"1px 6px",fontWeight:600}}>{cat.icon} {cat.label}</span>
              <span style={{fontSize:9.5,background:pri.bg,color:pri.color,borderRadius:4,padding:"1px 6px",fontWeight:600}}>{pri.label}</span>
              {b.cliente&&<span style={{fontSize:9.5,color:TX2}}>👤 {b.cliente}</span>}
              {showDate&&<span style={{fontSize:9.5,color:TX2}}>📅 {cpPtDate(b.data)}</span>}
            </div>
            <div style={{fontSize:10.5,color:TX2,marginTop:3}}>{b.hora_inicio}–{b.hora_fim} · {b.tempo_previsto}min</div>
            {b.observacoes&&<div style={{fontSize:10,color:TX2,marginTop:2,fontStyle:"italic"}}>{b.observacoes}</div>}
          </div>
          <div style={{display:"flex",gap:4,flexShrink:0}}>
            <span onClick={()=>toggleConcluido(b)} style={{cursor:"pointer",fontSize:14,color:b.concluido?"#E65100":cat.color}} title={b.concluido?"Reabrir":"Concluir"}>{b.concluido?"↩":"✓"}</span>
            <span onClick={()=>{setFormCp({titulo:b.titulo,categoria:b.categoria,prioridade:b.prioridade,data:b.data,hora_inicio:b.hora_inicio,hora_fim:b.hora_fim,tempo_previsto:b.tempo_previsto||60,tempo_realizado:b.tempo_realizado||0,observacoes:b.observacoes||"",cliente:b.cliente||"",concluido:b.concluido,ritual:b.ritual,recorrencia:"nenhuma"});setEditBlocoId(b.id);setShowFormCp(true);}} style={{cursor:"pointer",fontSize:11,color:"#90A4AE"}}>✏️</span>
            <span onClick={()=>duplicar(b)} style={{cursor:"pointer",fontSize:11,color:"#90A4AE"}} title="Duplicar">⧉</span>
            <span onClick={()=>deleteBloco(b.id)} style={{cursor:"pointer",fontSize:11,color:"#CFD8DC"}}>✕</span>
          </div>
        </div>
        {/* Mover para outro dia */}
        {!b.ritual&&<div style={{display:"flex",gap:4,marginTop:5,flexWrap:"wrap"}}>
          {weekDates.map((d,i)=>{ const ds=cpFmtDate(d); if(ds===b.data) return null;
            return<button key={i} onClick={()=>moverDia(b,ds)} style={{fontSize:9,background:"#fff",border:`1px solid ${BD}`,borderRadius:4,padding:"2px 6px",cursor:"pointer",color:TX2}}>→ {CP_DIAS[i].slice(0,3)}</button>; })}
        </div>}
      </div>
    );
  }

  // ── GRADE SEMANAL ──
  const SLOT=15; // px por 15min
  const MANHA_PX=(4*60/15)*SLOT;
  const TARDE_PX=(3*60/15)*SLOT;

  function GradeDia({ds,idx}){
    const db=blocosDia(ds);
    return(
      <div onDragOver={e=>e.preventDefault()} onDrop={async()=>{if(dragId){const b=blocos.find(x=>x.id===dragId);if(b)await moverDia(b,ds);setDragId(null);}}} style={{position:"relative",borderLeft:`1px solid ${BD}`,flex:1,minHeight:MANHA_PX+TARDE_PX+20}}>
        {cpIsFerias(ds)&&<div style={{position:"absolute",inset:0,background:"rgba(255,235,238,.7)",zIndex:2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:RD}}>🏖 Férias</div>}
        {/* Manhã */}
        {["08:00","08:15","08:30","08:45","09:00","09:15","09:30","09:45","10:00","10:15","10:30","10:45","11:00","11:15","11:30","11:45"].map((h,hi)=>(
          <div key={h} style={{height:SLOT,borderTop:`1px solid ${h.endsWith("00")?"#DDE3F0":"#F0F3FA"}`}}/>
        ))}
        {/* Intervalo almoço */}
        <div style={{height:10,background:"#F0F3FA",borderTop:`1px solid ${BD}`,borderBottom:`1px solid ${BD}`}}/>
        {/* Tarde */}
        {["14:00","14:15","14:30","14:45","15:00","15:15","15:30","15:45","16:00","16:15","16:30","16:45"].map(h=>(
          <div key={h} style={{height:SLOT,borderTop:`1px solid ${h.endsWith("00")?"#DDE3F0":"#F0F3FA"}`}}/>
        ))}
        {/* Blocos */}
        {db.map(b=>{
          const cat=CP_CATS[b.categoria]||CP_CATS.gestao;
          const cor=b.cor||cat.color;
          const isManha=cpToMin(b.hora_inicio)<720;
          const base=isManha?cpToMin(b.hora_inicio)-480:cpToMin(b.hora_inicio)-840+MANHA_PX+10;
          const top=Math.floor(base/15)*SLOT;
          const height=Math.max(Math.floor((cpToMin(b.hora_fim)-cpToMin(b.hora_inicio))/15)*SLOT,20);
          return(
            <div key={b.id} draggable onDragStart={()=>setDragId(b.id)} onDragEnd={()=>setDragId(null)} onClick={()=>{setFormCp({titulo:b.titulo,categoria:b.categoria,prioridade:b.prioridade,data:b.data,hora_inicio:b.hora_inicio,hora_fim:b.hora_fim,tempo_previsto:b.tempo_previsto||60,tempo_realizado:b.tempo_realizado||0,observacoes:b.observacoes||"",cliente:b.cliente||"",concluido:b.concluido,ritual:b.ritual,recorrencia:"nenhuma"});setEditBlocoId(b.id);setShowFormCp(true);}}
              style={{position:"absolute",top,left:2,right:2,height,background:b.concluido?"#F5F5F5":cat.bg,border:`1.5px solid ${cor}`,borderLeft:`3px solid ${cor}`,borderRadius:5,padding:"2px 4px",overflow:"hidden",cursor:"pointer",zIndex:1,opacity:b.concluido?0.6:1}}>
              <div style={{fontSize:9,fontWeight:700,color:cor,lineHeight:1.2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{b.titulo}</div>
              <div style={{fontSize:8,color:TX2}}>{b.hora_inicio}</div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── GRADE MÊS ──
  const mesAno=mesRef.getFullYear(); const mesNomeAtual=CP_MESES[mesRef.getMonth()];
  const diasMes=new Date(mesAno,mesRef.getMonth()+1,0).getDate();
  const primeiroDia=new Date(mesAno,mesRef.getMonth(),1).getDay();
  const offsetMes=primeiroDia===0?6:primeiroDia-1;
  function mesDateStr(d){ return`${mesAno}-${String(mesRef.getMonth()+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }

  if(loading) return <div style={{textAlign:"center",padding:"40px",color:TX2,fontSize:13}}>Carregando Central de Planejamento...</div>;

  return(
    <div>
      {toastCp&&<div style={{position:"fixed",bottom:80,right:16,zIndex:999,background:toastCp.type==="err"?RD:C,color:"#fff",borderRadius:10,padding:"10px 16px",fontSize:12.5,fontWeight:600,boxShadow:"0 4px 16px rgba(0,0,0,.2)",maxWidth:320,whiteSpace:"pre-line"}}>{toastCp.msg}</div>}

      {/* HEADER PLANEJAMENTO */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{fontWeight:700,fontSize:18,color:TX}}>🗂 Central de Planejamento</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          <button onClick={()=>setShowFormReuniao(true)} style={{background:"#2E7D32",color:"#fff",border:"none",borderRadius:7,padding:"7px 12px",fontSize:11.5,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>👥 Reunião</button>
          <button onClick={()=>{setEditBlocoId(null);setFormCp(emptyBloco);setShowFormCp(true);}} style={{background:RD,color:"#fff",border:"none",borderRadius:7,padding:"7px 14px",fontSize:12,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>+ Bloco</button>
        </div>
      </div>

      {/* SUB-NAVEGAÇÃO */}
      <div style={{display:"flex",gap:0,marginBottom:14,background:"#fff",borderRadius:10,border:`1px solid ${BD}`,overflow:"hidden",flexWrap:"wrap"}}>
        {[["painel","🧠 Painel IA"],["dia","📅 Dia"],["semana","🗓 Semana"],["mes","📆 Mês"],["historico","✅ Histórico"],["log","📋 Decisões"],["reunioes","👥 Reuniões"]].map(([v,l])=>(
          <button key={v} style={{flex:1,minWidth:60,background:subView===v?C:"#fff",color:subView===v?"#fff":TX2,border:"none",borderRight:`1px solid ${BD}`,padding:"10px 6px",fontSize:11,fontFamily:"inherit",fontWeight:subView===v?700:400,cursor:"pointer",transition:"all .15s"}} onClick={()=>setSubView(v)}>{l}</button>
        ))}
      </div>

      {/* ── PAINEL IA ── */}
      {subView==="painel"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
          {[
            {l:"Hoje Planejado",v:`${Math.floor(horasPlanejadasHoje/60)}h${horasPlanejadasHoje%60>0?horasPlanejadasHoje%60+"m":""}`,c:C,bg:CL},
            {l:"Concluídos",v:concluidosHoje,c:"#2E7D32",bg:"#E8F5E9"},
            {l:"Pendentes",v:pendentesHoje,c:RD,bg:RL},
            {l:"Atrasadas",v:pending?.filter(t=>t.due<todayStr).length||0,c:"#E65100",bg:"#FFF3E0"},
          ].map(s=>(
            <div key={s.l} style={{background:s.bg,border:`1px solid ${s.c}33`,borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:22,fontWeight:700,color:s.c,lineHeight:1}}>{s.v}</div>
              <div style={{fontSize:9.5,color:s.c,marginTop:2,fontWeight:500}}>{s.l}</div>
            </div>
          ))}
        </div>

        {loadingIA&&<div style={{background:"#fff",border:`1px solid ${BD}`,borderRadius:12,padding:"24px",textAlign:"center",color:TX2}}>
          <div style={{width:28,height:28,borderRadius:"50%",border:`3px solid ${BD}`,borderTop:`3px solid ${C}`,animation:"spin .8s linear infinite",margin:"0 auto 10px"}}/>
          Gerando análise inteligente do dia...
        </div>}

        {painelIA&&!loadingIA&&<>
          {/* Saudação */}
          <div style={{background:`linear-gradient(135deg,${C},#0D47A1)`,borderRadius:12,padding:"16px 20px",marginBottom:12,color:"#fff"}}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{painelIA.saudacao}</div>
            <div style={{fontSize:12.5,opacity:0.9}}>{painelIA.resumo}</div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            {/* Sugestão de agenda */}
            <div style={{background:"#fff",border:`1px solid ${BD}`,borderRadius:12,padding:"14px"}}>
              <div style={{fontSize:12,fontWeight:700,color:TX,marginBottom:10}}>⚡ Sugestão de Agenda para Hoje</div>
              {(painelIA.sugestao_agenda||[]).map((s,i)=>(
                <div key={i} style={{display:"flex",gap:10,marginBottom:8,paddingBottom:8,borderBottom:i<painelIA.sugestao_agenda.length-1?`1px solid ${BD}`:"none"}}>
                  <div style={{background:CL,color:C,borderRadius:6,padding:"4px 8px",fontSize:10,fontWeight:700,flexShrink:0,whiteSpace:"nowrap"}}>{s.horario}</div>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:TX}}>{s.tarefa}</div>
                    <div style={{fontSize:10,color:TX2,marginTop:1}}>{s.motivo}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Indicadores + alertas */}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{background:"#fff",border:`1px solid ${BD}`,borderRadius:12,padding:"14px"}}>
                <div style={{fontSize:12,fontWeight:700,color:TX,marginBottom:8}}>📊 Carga do Dia</div>
                <div style={{background:GR,borderRadius:8,height:12,overflow:"hidden",marginBottom:6}}>
                  <div style={{width:`${Math.min(painelIA.carga_prevista||0,100)}%`,height:"100%",background:(painelIA.carga_prevista||0)>85?RD:(painelIA.carga_prevista||0)>60?"#E65100":C,borderRadius:8,transition:"width .5s"}}/>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:(painelIA.carga_prevista||0)>85?RD:C}}>{painelIA.carga_prevista||0}% ocupado</div>
                <div style={{fontSize:11,color:TX2,marginTop:4}}>🎯 Prioridade máxima: <strong>{painelIA.prioridade_maxima}</strong></div>
              </div>
              {(painelIA.alertas||[]).length>0&&<div style={{background:RL,border:`1px solid ${RD}33`,borderRadius:12,padding:"12px"}}>
                <div style={{fontSize:11,fontWeight:700,color:RD,marginBottom:6}}>⚠️ Alertas</div>
                {painelIA.alertas.map((a,i)=><div key={i} style={{fontSize:11,color:RD,marginBottom:3}}>• {a}</div>)}
              </div>}
            </div>
          </div>

          <button onClick={gerarPainelIA} style={{background:"#fff",border:`1px solid ${BD}`,color:TX2,borderRadius:8,padding:"8px 16px",fontSize:12,fontFamily:"inherit",cursor:"pointer",marginBottom:12}}>↻ Atualizar análise IA</button>
        </>}

        {/* Blocos de hoje */}
        <div style={{fontSize:12,fontWeight:700,color:TX,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>📅 Agenda de Hoje — {new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"short"})}</div>
        {blocosDia(todayStr).length===0?<div style={{textAlign:"center",padding:"24px",color:TX2,fontSize:13,background:"#fff",borderRadius:10,border:`1px solid ${BD}`}}>Nenhum bloco agendado para hoje.</div>
          :blocosDia(todayStr).map(b=><BlocoItem key={b.id} b={b}/>)}
      </>}

      {/* ── DIA ── */}
      {subView==="dia"&&<>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <button onClick={()=>setDiaOffset(o=>o-1)} style={{background:"#fff",border:`1px solid ${BD}`,borderRadius:6,padding:"5px 11px",cursor:"pointer",fontSize:13}}>‹</button>
          <span style={{fontWeight:700,fontSize:13,color:C,minWidth:200,textAlign:"center"}}>{diaAtual.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</span>
          <button onClick={()=>setDiaOffset(o=>o+1)} style={{background:"#fff",border:`1px solid ${BD}`,borderRadius:6,padding:"5px 11px",cursor:"pointer",fontSize:13}}>›</button>
          {diaOffset!==0&&<button onClick={()=>setDiaOffset(0)} style={{background:CL,border:`1px solid ${C}`,borderRadius:6,padding:"5px 8px",cursor:"pointer",fontSize:10,color:C,fontWeight:600}}>Hoje</button>}
        </div>
        {cpIsFerias(diaStr)&&<div style={{background:RL,border:`1px solid ${RD}`,borderRadius:8,padding:"10px 14px",marginBottom:10,fontSize:12,color:RD,fontWeight:600}}>🏖️ Período de férias — Agenda bloqueada (13/07 a 24/07/2026)</div>}
        {blocosDia(diaStr).length===0?<div style={{textAlign:"center",padding:"32px",color:TX2,background:"#fff",borderRadius:10,border:`1px solid ${BD}`}}>Nenhum bloco para este dia.</div>
          :blocosDia(diaStr).map(b=><BlocoItem key={b.id} b={b}/>)}
      </>}

      {/* ── SEMANA ── */}
      {subView==="semana"&&<>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,flexWrap:"wrap"}}>
          <button onClick={()=>setWeekOffset(o=>o-1)} style={{background:"#fff",border:`1px solid ${BD}`,borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:13}}>‹</button>
          <span style={{fontWeight:700,fontSize:12,color:C,minWidth:180,textAlign:"center"}}>{cpFmtDate(weekDates[0]).split("-").reverse().join("/").slice(0,5)} – {cpFmtDate(weekDates[4]).split("-").reverse().join("/").slice(0,5)}</span>
          <button onClick={()=>setWeekOffset(o=>o+1)} style={{background:"#fff",border:`1px solid ${BD}`,borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:13}}>›</button>
          {weekOffset!==0&&<button onClick={()=>setWeekOffset(0)} style={{background:CL,border:`1px solid ${C}`,borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:10,color:C,fontWeight:600}}>Hoje</button>}
        </div>
        <div style={{background:"#fff",border:`1px solid ${BD}`,borderRadius:12,overflow:"auto",WebkitOverflowScrolling:"touch"}}>
          {/* Cabeçalho */}
          <div style={{display:"grid",gridTemplateColumns:"44px repeat(5,1fr)",borderBottom:`1.5px solid ${BD}`,background:GR}}>
            <div style={{padding:"6px 4px",fontSize:9,color:TX2,textAlign:"center"}}>h</div>
            {weekDates.map((d,i)=>{
              const ds=cpFmtDate(d); const isHoje=ds===todayStr;
              return<div key={i} style={{padding:"6px 4px",textAlign:"center",borderLeft:`1px solid ${BD}`,background:isHoje?CL:"transparent"}}>
                <div style={{fontSize:9,color:isHoje?C:TX2,fontWeight:600,textTransform:"uppercase"}}>{CP_DIAS[i].slice(0,3)}</div>
                <div style={{fontSize:15,fontWeight:700,color:isHoje?C:TX}}>{d.getDate()}</div>
              </div>;
            })}
          </div>
          {/* Grade */}
          <div style={{display:"flex"}}>
            {/* Coluna horas */}
            <div style={{width:44,flexShrink:0}}>
              {["08:00","09:00","10:00","11:00","12:00","","14:00","15:00","16:00","17:00"].map((h,i)=>(
                <div key={i} style={{height:h===""?10:SLOT*4,borderTop:`1px solid ${h===""?BD:"transparent"}`,fontSize:8,color:TX2,paddingLeft:2,paddingTop:1}}>{h}</div>
              ))}
            </div>
            {/* Dias */}
            {weekDates.map((d,i)=><GradeDia key={i} ds={cpFmtDate(d)} idx={i}/>)}
          </div>
        </div>
      </>}

      {/* ── MÊS ── */}
      {subView==="mes"&&<>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
          <button onClick={()=>setMesOffset(o=>o-1)} style={{background:"#fff",border:`1px solid ${BD}`,borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:13}}>‹</button>
          <span style={{fontWeight:700,fontSize:13,color:C,minWidth:130,textAlign:"center"}}>{mesNomeAtual} {mesAno}</span>
          <button onClick={()=>setMesOffset(o=>o+1)} style={{background:"#fff",border:`1px solid ${BD}`,borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:13}}>›</button>
          {mesOffset!==0&&<button onClick={()=>setMesOffset(0)} style={{background:CL,border:`1px solid ${C}`,borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:10,color:C,fontWeight:600}}>Hoje</button>}
        </div>
        <div style={{background:"#fff",border:`1px solid ${BD}`,borderRadius:10,padding:10}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
            {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d=><div key={d} style={{textAlign:"center",fontSize:9,fontWeight:600,color:TX2,padding:"2px 0"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
            {Array.from({length:offsetMes},(_,i)=><div key={"e"+i}/>)}
            {Array.from({length:diasMes},(_,i)=>i+1).map(d=>{
              const ds=mesDateStr(d); const isHoje=ds===todayStr; const isFer=cpIsFerias(ds);
              const{data:mesDb}=supabase.from?{data:[]}:{data:[]}; // placeholder — usamos blocos do estado
              const db=blocos.filter(b=>b.data===ds);
              const temUrg=db.some(b=>b.prioridade==="urgente");
              return<div key={d} style={{minHeight:44,border:`1px solid ${isHoje?C:BD}`,borderRadius:5,padding:"3px 4px",background:isFer?"#FFEBEE":isHoje?CL:"#fff",position:"relative"}}>
                <div style={{fontSize:10,fontWeight:isHoje?700:400,color:isFer?RD:isHoje?C:TX}}>{d}</div>
                {db.slice(0,2).map(b=><div key={b.id} style={{fontSize:7,background:(CP_CATS[b.categoria]||CP_CATS.gestao).bg,color:(CP_CATS[b.categoria]||CP_CATS.gestao).color,borderRadius:2,padding:"1px 2px",marginTop:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{b.titulo}</div>)}
                {db.length>2&&<div style={{fontSize:7,color:TX2}}>+{db.length-2}</div>}
                {temUrg&&<div style={{position:"absolute",top:2,right:2,width:5,height:5,borderRadius:"50%",background:RD}}/>}
                {isFer&&<div style={{position:"absolute",top:1,right:1,fontSize:7}}>🏖</div>}
              </div>;
            })}
          </div>
        </div>
      </>}

      {/* ── HISTÓRICO ── */}
      {subView==="historico"&&<HistoricoView supabase={supabase} TX={TX} TX2={TX2} BD={BD} C={C} CL={CL} GR={GR} CP_CATS={CP_CATS}/>}

      {/* ── LOG DE DECISÕES ── */}
      {subView==="log"&&<>
        <div style={{fontSize:12,fontWeight:700,color:TX,marginBottom:10}}>📋 Central de Decisões da IA</div>
        {log.length===0?<div style={{textAlign:"center",padding:"32px",color:TX2,background:"#fff",borderRadius:10,border:`1px solid ${BD}`}}>Nenhuma decisão registrada ainda.</div>
          :log.map(l=>(
            <div key={l.id} style={{background:"#fff",border:`1px solid ${BD}`,borderRadius:8,padding:"10px 14px",marginBottom:7}}>
              <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                <span style={{fontSize:16,flexShrink:0}}>{l.tipo==="reorganizacao"?"⚡":l.tipo==="ritual"?"✅":l.tipo==="conclusao"?"✓":"📝"}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:12.5,color:TX,fontWeight:500}}>{l.descricao}</div>
                  <div style={{fontSize:10,color:TX2,marginTop:2}}>{new Date(l.created_at).toLocaleDateString("pt-BR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>
                </div>
              </div>
            </div>
          ))}
      </>}

      {/* ── REUNIÕES ── */}
      {subView==="reunioes"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:12,fontWeight:700,color:TX}}>👥 Reuniões com Clientes</div>
          <button onClick={()=>setShowFormReuniao(true)} style={{background:"#2E7D32",color:"#fff",border:"none",borderRadius:7,padding:"7px 12px",fontSize:11.5,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>+ Registrar</button>
        </div>
        {reunioes.length===0?<div style={{textAlign:"center",padding:"32px",color:TX2,background:"#fff",borderRadius:10,border:`1px solid ${BD}`}}>Nenhuma reunião registrada.</div>
          :reunioes.map(r=>(
            <div key={r.id} style={{background:"#fff",border:`1px solid ${BD}`,borderRadius:8,padding:"10px 14px",marginBottom:7}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:TX}}>👤 {r.cliente}</div>
                  <div style={{fontSize:12,color:TX2,marginTop:2}}>{r.assunto}</div>
                  {r.observacoes&&<div style={{fontSize:11,color:TX2,marginTop:2,fontStyle:"italic"}}>{r.observacoes}</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:11,fontWeight:600,color:C}}>{cpPtDate(r.data)}</div>
                  {r.hora&&<div style={{fontSize:10,color:TX2}}>{r.hora} · {r.duracao}min</div>}
                  <div style={{fontSize:10,background:r.status==="realizada"?"#E8F5E9":"#E3F0FF",color:r.status==="realizada"?"#2E7D32":C,borderRadius:4,padding:"1px 6px",marginTop:3,display:"inline-block",fontWeight:600}}>{r.status}</div>
                </div>
              </div>
            </div>
          ))}
      </>}

      {/* MODAL NOVO BLOCO */}
      {showFormCp&&(
        <div style={{position:"fixed",inset:0,background:"rgba(20,40,80,0.4)",zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&setShowFormCp(false)}>
          <div style={{background:"#fff",borderRadius:"16px 16px 0 0",padding:"20px 16px 32px",width:"100%",maxWidth:540,maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{width:36,height:4,background:BD,borderRadius:2,margin:"0 auto 14px"}}/>
            <div style={{fontWeight:700,fontSize:16,color:C,marginBottom:14,borderBottom:`2px solid ${CL}`,paddingBottom:10}}>{editBlocoId?"✏️ Editar Bloco":"✨ Novo Bloco"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:11}}>
              <div><label style={lbl}>Título *</label>
                <input style={inp} value={formCp.titulo} onChange={e=>{
                  const t=e.target.value;
                  const cat=Object.entries(CP_CATS).find(([k,v])=>t.toLowerCase().includes(v.label.toLowerCase()));
                  if(cat) setFormCp(f=>({...f,titulo:t,categoria:cat[0],prioridade:cat[1].prioBase,hora_fim:cpAddMin(f.hora_inicio,cat[1].tempo)}));
                  else setFormCp(f=>({...f,titulo:t}));
                }} placeholder="Ex: Admissão João Silva, Folha Cantina..."/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div><label style={lbl}>Categoria</label>
                  <select style={inp} value={formCp.categoria} onChange={e=>{const cat=CP_CATS[e.target.value];setFormCp(f=>({...f,categoria:e.target.value,prioridade:cat?.prioBase||"media",hora_fim:cpAddMin(f.hora_inicio,cat?.tempo||60)}));}}>
                    {Object.entries(CP_CATS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Prioridade</label>
                  <select style={inp} value={formCp.prioridade} onChange={e=>setFormCp(f=>({...f,prioridade:e.target.value}))}>
                    {Object.entries(CP_PRIOS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={lbl}>Cliente</label><input style={inp} value={formCp.cliente} onChange={e=>setFormCp(f=>({...f,cliente:e.target.value}))} placeholder="Nome do cliente..."/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                <div><label style={lbl}>Data</label><input type="date" style={inp} value={formCp.data} onChange={e=>setFormCp(f=>({...f,data:e.target.value}))}/></div>
                <div><label style={lbl}>Início</label>
                  <select style={inp} value={formCp.hora_inicio} onChange={e=>{const hi=e.target.value;setFormCp(f=>({...f,hora_inicio:hi,hora_fim:cpAddMin(hi,f.tempo_previsto)}));}}>
                    {["08:00","08:15","08:30","08:45","09:00","09:15","09:30","09:45","10:00","10:15","10:30","10:45","11:00","11:15","11:30","11:45","14:00","14:15","14:30","14:45","15:00","15:15","15:30","15:45","16:00","16:15","16:30","16:45"].map(h=><option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Fim</label>
                  <select style={inp} value={formCp.hora_fim} onChange={e=>setFormCp(f=>({...f,hora_fim:e.target.value,tempo_previsto:cpToMin(e.target.value)-cpToMin(f.hora_inicio)}))}>
                    {["08:15","08:30","08:45","09:00","09:15","09:30","09:45","10:00","10:15","10:30","10:45","11:00","11:15","11:30","11:45","12:00","14:15","14:30","14:45","15:00","15:15","15:30","15:45","16:00","16:15","16:30","16:45","17:00"].map(h=><option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={lbl}>Observações</label><textarea style={{...inp,resize:"none"}} rows={2} value={formCp.observacoes} onChange={e=>setFormCp(f=>({...f,observacoes:e.target.value}))} placeholder="Notas adicionais..."/></div>
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button onClick={()=>setShowFormCp(false)} style={{flex:1,background:"#fff",border:`1px solid ${BD}`,color:TX2,borderRadius:8,padding:"12px",fontSize:14,fontFamily:"inherit",cursor:"pointer"}}>Cancelar</button>
                <button onClick={saveBloco} style={{flex:2,background:C,color:"#fff",border:"none",borderRadius:8,padding:"12px",fontSize:14,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>{editBlocoId?"Salvar":"Criar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REUNIÃO */}
      {showFormReuniao&&(
        <div style={{position:"fixed",inset:0,background:"rgba(20,40,80,0.4)",zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&setShowFormReuniao(false)}>
          <div style={{background:"#fff",borderRadius:"16px 16px 0 0",padding:"20px 16px 32px",width:"100%",maxWidth:540,maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{width:36,height:4,background:BD,borderRadius:2,margin:"0 auto 14px"}}/>
            <div style={{fontWeight:700,fontSize:16,color:"#2E7D32",marginBottom:14,borderBottom:"2px solid #E8F5E9",paddingBottom:10}}>👥 Registrar Reunião</div>
            <div style={{display:"flex",flexDirection:"column",gap:11}}>
              <div><label style={lbl}>Cliente *</label><input style={inp} value={formReuniao.cliente} onChange={e=>setFormReuniao(f=>({...f,cliente:e.target.value}))} placeholder="Nome do cliente..."/></div>
              <div><label style={lbl}>Assunto</label><input style={inp} value={formReuniao.assunto} onChange={e=>setFormReuniao(f=>({...f,assunto:e.target.value}))} placeholder="Pauta da reunião..."/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                <div><label style={lbl}>Data</label><input type="date" style={inp} value={formReuniao.data} onChange={e=>setFormReuniao(f=>({...f,data:e.target.value}))}/></div>
                <div><label style={lbl}>Hora</label><input type="time" style={inp} value={formReuniao.hora} onChange={e=>setFormReuniao(f=>({...f,hora:e.target.value}))}/></div>
                <div><label style={lbl}>Duração (min)</label><input type="number" style={inp} value={formReuniao.duracao} onChange={e=>setFormReuniao(f=>({...f,duracao:Number(e.target.value)}))} min={15} step={15}/></div>
              </div>
              <div><label style={lbl}>Status</label>
                <select style={inp} value={formReuniao.status} onChange={e=>setFormReuniao(f=>({...f,status:e.target.value}))}>
                  <option value="agendada">Agendada</option>
                  <option value="realizada">Realizada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div><label style={lbl}>Observações</label><textarea style={{...inp,resize:"none"}} rows={2} value={formReuniao.observacoes} onChange={e=>setFormReuniao(f=>({...f,observacoes:e.target.value}))} placeholder="Pauta, decisões, próximos passos..."/></div>
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button onClick={()=>setShowFormReuniao(false)} style={{flex:1,background:"#fff",border:`1px solid ${BD}`,color:TX2,borderRadius:8,padding:"12px",fontSize:14,fontFamily:"inherit",cursor:"pointer"}}>Cancelar</button>
                <button onClick={saveReuniao} style={{flex:2,background:"#2E7D32",color:"#fff",border:"none",borderRadius:8,padding:"12px",fontSize:14,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>Registrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoricoView({ supabase, TX, TX2, BD, C, CL, GR, CP_CATS }){
  const [hist,setHist]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busca,setBusca]=useState("");
  const [filtroCliente,setFiltroCliente]=useState("");

  useEffect(()=>{ fetchHist(); },[]);

  async function fetchHist(){
    setLoading(true);
    const{data}=await supabase.from("planejamento").select("*").eq("concluido",true).order("updated_at",{ascending:false}).limit(100);
    setHist(data||[]); setLoading(false);
  }

  const filtrado=hist.filter(h=>{
    const q=busca.toLowerCase();
    const matchBusca=!busca||(h.titulo||"").toLowerCase().includes(q)||(h.cliente||"").toLowerCase().includes(q)||(h.observacoes||"").toLowerCase().includes(q);
    const matchCliente=!filtroCliente||(h.cliente||"").toLowerCase().includes(filtroCliente.toLowerCase());
    return matchBusca&&matchCliente;
  });

  const clientes=[...new Set(hist.map(h=>h.cliente).filter(Boolean))].sort();

  if(loading) return<div style={{textAlign:"center",padding:"24px",color:TX2}}>Carregando histórico...</div>;

  return(
    <div>
      <div style={{fontSize:12,fontWeight:700,color:TX,marginBottom:10}}>✅ Histórico de Concluídos ({hist.length})</div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <input style={{flex:2,background:"#fff",border:`1px solid ${BD}`,borderRadius:8,padding:"8px 11px",color:TX,fontSize:13,fontFamily:"inherit"}} placeholder="🔍 Buscar por tarefa, cliente..." value={busca} onChange={e=>setBusca(e.target.value)}/>
        <select style={{flex:1,background:"#fff",border:`1px solid ${BD}`,borderRadius:8,padding:"8px 10px",color:TX,fontSize:12,fontFamily:"inherit"}} value={filtroCliente} onChange={e=>setFiltroCliente(e.target.value)}>
          <option value="">Todos clientes</option>
          {clientes.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {filtrado.length===0?<div style={{textAlign:"center",padding:"32px",color:TX2,background:"#fff",borderRadius:10,border:`1px solid ${BD}`}}>Nenhum resultado.</div>
        :filtrado.map(h=>{
          const cat=CP_CATS[h.categoria]||{label:h.categoria,color:C,bg:CL,icon:"📋"};
          return(
            <div key={h.id} style={{background:"#fff",border:`1px solid ${BD}`,borderLeft:`4px solid ${cat.color}`,borderRadius:8,padding:"9px 12px",marginBottom:6,opacity:0.85}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12.5,fontWeight:600,color:TX,textDecoration:"line-through"}}>{h.titulo}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:3}}>
                    <span style={{fontSize:9.5,background:cat.bg,color:cat.color,border:`1px solid ${cat.color}44`,borderRadius:4,padding:"1px 6px",fontWeight:600}}>{cat.icon} {cat.label}</span>
                    {h.cliente&&<span style={{fontSize:9.5,color:TX2}}>👤 {h.cliente}</span>}
                    <span style={{fontSize:9.5,color:TX2}}>⏱ {h.tempo_previsto||0}min</span>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:10.5,color:C,fontWeight:600}}>{h.data?.split("-").reverse().join("/")}</div>
                  <div style={{fontSize:9.5,color:TX2}}>{h.hora_inicio}–{h.hora_fim}</div>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// MÓDULO: PLANEJAMENTO SEMANAL
// Inserir este bloco ANTES da função Empty no App.jsx
// ─────────────────────────────────────────────────────────────

const PL_CATS = {
  estrategico: { label:"Estratégico", color:"#7B1FA2", bg:"#F3E5F5", icon:"🎯",
    subs:["Planejamento","Metas","Reunião de Sócios"] },
  tatico:      { label:"Tático",      color:"#1565C0", bg:"#E3F0FF", icon:"⚙️",
    subs:["Reunião de Equipe","Gestão de Processos","Alinhamentos"] },
  operacional: { label:"Operacional", color:"#C62828", bg:"#FFEBEE", icon:"🔧",
    subs:["Folha de Pagamento","Rescisões","Admissões","Execução de Tarefas"] },
  comercial:   { label:"Comercial",   color:"#E65100", bg:"#FFF3E0", icon:"🤝",
    subs:["Reunião com Cliente","Prospecção","Follow-up"] },
  desenvolvimento:{ label:"Desenvolvimento", color:"#2E7D32", bg:"#E8F5E9", icon:"📚",
    subs:["Estudos","Cursos","Leitura Técnica","Inovação"] },
};

const PL_PRIS = {
  alta:  { label:"Alta",  color:"#C62828", dot:"🔴" },
  media: { label:"Média", color:"#E65100", dot:"🟡" },
  baixa: { label:"Baixa", color:"#2E7D32", dot:"🟢" },
};

const PL_URG = {
  urgente:      { label:"Urgente",       color:"#C62828", bg:"#FFEBEE" },
  esta_semana:  { label:"Esta Semana",   color:"#1565C0", bg:"#E3F0FF" },
  planejada:    { label:"Planejada",     color:"#5A6580", bg:"#F5F6FA" },
};

const TEMPO_PADRAO = {
  "Atendimento ao Cliente":30, "Reunião com Cliente":60, "Cliente Estratégico":60,
  "Cliente Operacional":30, "Cliente Novo":60, "Alinhamento Rápido":15,
  "Admissões":30, "Rescisões":60, "Folha de Pagamento":120,
  "Auditoria Trabalhista":120, "Planejamento":60, "Estudos":90,
  "Cursos":90, "Execução de Tarefas":60, "Reunião de Equipe":60,
  "Gestão de Processos":60, "Metas":60, "Reunião de Sócios":60,
  "Resposta Rápida":15, "Follow-up":30,
};

const DIAS_SEMANA = ["Segunda","Terça","Quarta","Quinta","Sexta"];
const HORAS_MANHA = ["08:00","08:15","08:30","08:45","09:00","09:15","09:30","09:45","10:00","10:15","10:30","10:45","11:00","11:15","11:30","11:45","12:00"];
const HORAS_TARDE = ["14:00","14:15","14:30","14:45","15:00","15:15","15:30","15:45","16:00","16:15","16:30","16:45","17:00"];
const TODAS_HORAS = [...HORAS_MANHA.slice(0,-1), ...HORAS_TARDE];

function getWeekDates(weekOffset=0){
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day===0?-6:1) + weekOffset*7;
  return Array.from({length:5},(_,i)=>{ const d=new Date(now); d.setDate(diff+i); return d; });
}

function fmtDatePl(d){ return d.toISOString().split("T")[0]; }
function timeToMin(t){ const[h,m]=t.split(":").map(Number); return h*60+m; }
function minToTime(m){ return `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`; }
function addMinutes(t,m){ return minToTime(timeToMin(t)+m); }

const RITUAIS_BASE = [
  { titulo:"✅ Check-in Diário", categoria:"tatico", subcategoria:"Alinhamentos",
    prioridade:"alta", urgencia:"urgente", hora_inicio:"08:00", hora_fim:"08:15",
    tempo_previsto:15, observacoes:"Revisão da agenda · Prioridades do dia · Demandas urgentes", ritual:true, cor:"#1565C0" },
  { titulo:"🔍 Check-out Diário", categoria:"tatico", subcategoria:"Alinhamentos",
    prioridade:"alta", urgencia:"urgente", hora_inicio:"16:45", hora_fim:"17:00",
    tempo_previsto:15, observacoes:"Revisão das entregas · Pendências · Planejamento amanhã", ritual:true, cor:"#1565C0" },
  { titulo:"🎯 Foco Profundo — Manhã", categoria:"operacional", subcategoria:"Execução de Tarefas",
    prioridade:"alta", urgencia:"esta_semana", hora_inicio:"10:00", hora_fim:"12:00",
    tempo_previsto:120, observacoes:"Produção · Folha · Rescisões · Demandas técnicas", ritual:true, cor:"#C62828" },
  { titulo:"🎯 Foco Profundo — Tarde", categoria:"operacional", subcategoria:"Execução de Tarefas",
    prioridade:"alta", urgencia:"esta_semana", hora_inicio:"15:00", hora_fim:"16:30",
    tempo_previsto:90, observacoes:"Produção · Auditorias · Demandas técnicas", ritual:true, cor:"#C62828" },
  { titulo:"👥 Atendimento a Clientes", categoria:"comercial", subcategoria:"Reunião com Cliente",
    prioridade:"media", urgencia:"esta_semana", hora_inicio:"09:00", hora_fim:"10:00",
    tempo_previsto:60, observacoes:"Ligações · Reuniões · Retornos · Suporte", ritual:true, cor:"#E65100" },
  { titulo:"👥 Atendimento a Clientes", categoria:"comercial", subcategoria:"Reunião com Cliente",
    prioridade:"media", urgencia:"esta_semana", hora_inicio:"14:00", hora_fim:"15:00",
    tempo_previsto:60, observacoes:"Ligações · Reuniões · Retornos · Suporte", ritual:true, cor:"#E65100" },
];

function PlanejamentoView({ supabase }){
  const [blocos,setBlocos] = useState([]);
  const [loadingPl,setLoadingPl] = useState(true);
  const [weekOffset,setWeekOffset] = useState(0);
  const [viewMode,setViewMode] = useState("semanal"); // semanal | diario
  const [diaIdx,setDiaIdx] = useState(0);
  const [showFormPl,setShowFormPl] = useState(false);
  const [editBloco,setEditBloco] = useState(null);
  const [dragId,setDragId] = useState(null);
  const [toastPl,setToastPl] = useState(null);
  const [rituaisOk,setRituaisOk] = useState(false);

  const weekDates = getWeekDates(weekOffset);
  const weekLabel = `${weekDates[0].toLocaleDateString("pt-BR",{day:"numeric",month:"short"})} – ${weekDates[4].toLocaleDateString("pt-BR",{day:"numeric",month:"short",year:"numeric"})}`;

  const emptyBloco = {
    titulo:"", categoria:"operacional", subcategoria:"", prioridade:"media",
    urgencia:"esta_semana", data:fmtDatePl(weekDates[diaIdx]||weekDates[0]),
    hora_inicio:"09:00", hora_fim:"10:00", tempo_previsto:60,
    tempo_realizado:0, observacoes:"", recorrencia:"nenhuma", concluido:false, ritual:false, cor:""
  };
  const [formPl,setFormPl] = useState(emptyBloco);

  useEffect(()=>{ fetchBlocos(); },[weekOffset]);

  async function fetchBlocos(){
    setLoadingPl(true);
    const startDate = fmtDatePl(weekDates[0]);
    const endDate   = fmtDatePl(weekDates[4]);
    const{data}=await supabase.from("planejamento").select("*")
      .gte("data",startDate).lte("data",endDate).order("hora_inicio");
    setBlocos(data||[]);
    setLoadingPl(false);
  }

  async function criarRituais(){
    if(rituaisOk) return;
    const startDate = fmtDatePl(weekDates[0]);
    const{data:exist}=await supabase.from("planejamento").select("id")
      .eq("ritual",true).gte("data",startDate).lte("data",fmtDatePl(weekDates[4]));
    if(exist&&exist.length>0){ setRituaisOk(true); return; }
    const inserts=[];
    weekDates.forEach(d=>{
      RITUAIS_BASE.forEach(r=>{
        inserts.push({...r, data:fmtDatePl(d), recorrencia:"diaria", tempo_realizado:0, concluido:false});
      });
    });
    await supabase.from("planejamento").insert(inserts);
    setRituaisOk(true);
    await fetchBlocos();
    showToastPl("✅ Rituais da semana criados!");
  }

  useEffect(()=>{ if(!loadingPl) criarRituais(); },[loadingPl]);

  function showToastPl(msg,type="ok"){ setToastPl({msg,type}); setTimeout(()=>setToastPl(null),3000); }

  async function saveBloco(){
    if(!formPl.titulo.trim()) return;
    const payload={...formPl};
    if(!payload.cor) payload.cor = PL_CATS[payload.categoria]?.color||"#1565C0";
    if(editBloco){
      await supabase.from("planejamento").update(payload).eq("id",editBloco);
      showToastPl("Bloco atualizado!");
    } else {
      if(formPl.recorrencia!=="nenhuma"){
        const inserts=[];
        const dias = formPl.recorrencia==="diaria"?5:formPl.recorrencia==="semanal"?1:1;
        weekDates.slice(0,dias).forEach(d=>{
          inserts.push({...payload, data:fmtDatePl(d)});
        });
        await supabase.from("planejamento").insert(inserts);
        showToastPl(`${inserts.length} blocos criados!`);
      } else {
        await supabase.from("planejamento").insert([payload]);
        showToastPl("Bloco criado!");
      }
    }
    setShowFormPl(false); setEditBloco(null); setFormPl(emptyBloco);
    fetchBlocos();
  }

  async function deleteBloco(id){
    await supabase.from("planejamento").delete().eq("id",id);
    setBlocos(prev=>prev.filter(b=>b.id!==id));
    showToastPl("Removido");
  }

  async function toggleConcluido(bloco){
    const v=!bloco.concluido;
    await supabase.from("planejamento").update({concluido:v}).eq("id",bloco.id);
    setBlocos(prev=>prev.map(b=>b.id===bloco.id?{...b,concluido:v}:b));
  }

  async function duplicarBloco(bloco){
    const{id,...rest}=bloco;
    await supabase.from("planejamento").insert([{...rest,concluido:false,titulo:rest.titulo+" (cópia)"}]);
    fetchBlocos(); showToastPl("Bloco duplicado!");
  }

  async function moverBloco(bloco,novoDia){
    const novaData=fmtDatePl(weekDates[novoDia]);
    await supabase.from("planejamento").update({data:novaData}).eq("id",bloco.id);
    setBlocos(prev=>prev.map(b=>b.id===bloco.id?{...b,data:novaData}:b));
    showToastPl(`Movido para ${DIAS_SEMANA[novoDia]}!`);
  }

  function openEdit(b){
    setFormPl({titulo:b.titulo,categoria:b.categoria,subcategoria:b.subcategoria||"",
      prioridade:b.prioridade,urgencia:b.urgencia,data:b.data,
      hora_inicio:b.hora_inicio,hora_fim:b.hora_fim,tempo_previsto:b.tempo_previsto||60,
      tempo_realizado:b.tempo_realizado||0,observacoes:b.observacoes||"",
      recorrencia:"nenhuma",concluido:b.concluido,ritual:b.ritual,cor:b.cor||""});
    setEditBloco(b.id); setShowFormPl(true);
  }

  // Indicadores
  const totalMin = blocos.reduce((s,b)=>s+(b.tempo_previsto||0),0);
  const realizadoMin = blocos.filter(b=>b.concluido).reduce((s,b)=>s+(b.tempo_previsto||0),0);
  const pendentes = blocos.filter(b=>!b.concluido&&!b.ritual).length;
  const concluidos = blocos.filter(b=>b.concluido).length;
  const disponivel = 5*(4*60+3*60) - totalMin; // 5 dias * (4h manhã + 3h tarde) em min
  const ocupacao = Math.min(100,Math.round((totalMin/Math.max(1,5*7*60))*100));

  // Blocos do dia
  function blocosNoDia(dateStr){
    return blocos.filter(b=>b.data===dateStr).sort((a,b)=>timeToMin(a.hora_inicio)-timeToMin(b.hora_inicio));
  }

  // Calcular altura e top na grade (1px = 1min, base 8h=0)
  function calcTop(h){ const m=timeToMin(h); return m<720?(m-480):(m-840+240); }
  function calcHeight(hi,hf){ return Math.max(timeToMin(hf)-timeToMin(hi),15); }

  const SLOT_H=15; // px por 15min
  const MANHA_H=(4*60/15)*SLOT_H; // 240px para manhã (4h)
  const TARDE_H=(3*60/15)*SLOT_H; // 180px para tarde (3h)

  const C="#1565C0",CL="#E3F0FF",BD="#DDE3F0",TX="#1A2340",TX2="#5A6580",GR="#F5F6FA";

  const inputStyle={width:"100%",background:GR,border:`1px solid ${BD}`,borderRadius:8,padding:"9px 11px",color:TX,fontSize:13,fontFamily:"inherit"};
  const lblStyle={fontSize:10,color:TX2,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.5px",fontWeight:600};

  function BlocoCard({b,compact}){
    const cat=PL_CATS[b.categoria]||PL_CATS.operacional;
    const pri=PL_PRIS[b.prioridade]||PL_PRIS.media;
    const urg=PL_URG[b.urgencia]||PL_URG.esta_semana;
    const cor=b.cor||cat.color;
    return(
      <div
        draggable={true}
        onDragStart={()=>setDragId(b.id)}
        onDragEnd={()=>setDragId(null)}
        style={{background:b.concluido?"#F5F5F5":cat.bg,border:`1.5px solid ${cor}`,borderLeft:`4px solid ${cor}`,borderRadius:8,padding:compact?"5px 7px":"9px 11px",marginBottom:5,opacity:b.concluido?0.6:1,cursor:"grab",transition:"box-shadow .15s"}}
      >
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:5}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:compact?11:12.5,fontWeight:700,color:b.concluido?"#999":TX,textDecoration:b.concluido?"line-through":"none",lineHeight:1.3}}>{b.titulo}</div>
            {!compact&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>
              <span style={{fontSize:9,background:cat.bg,color:cat.color,border:`1px solid ${cat.color}44`,borderRadius:4,padding:"1px 5px",fontWeight:600}}>{cat.icon} {cat.label}</span>
              <span style={{fontSize:9,background:urg.bg,color:urg.color,borderRadius:4,padding:"1px 5px",fontWeight:600}}>{urg.label}</span>
              <span style={{fontSize:9,color:pri.color,fontWeight:700}}>{pri.dot}</span>
            </div>}
            <div style={{fontSize:10,color:TX2,marginTop:3}}>{b.hora_inicio}–{b.hora_fim} · {b.tempo_previsto}min</div>
          </div>
          <div style={{display:"flex",gap:3,flexShrink:0}}>
            <span onClick={()=>toggleConcluido(b)} style={{cursor:"pointer",fontSize:13}} title={b.concluido?"Reabrir":"Concluir"}>{b.concluido?"↩":"✓"}</span>
            <span onClick={()=>openEdit(b)} style={{cursor:"pointer",fontSize:11,color:"#90A4AE"}}>✏️</span>
            <span onClick={()=>duplicarBloco(b)} style={{cursor:"pointer",fontSize:11,color:"#90A4AE"}} title="Duplicar">⧉</span>
            <span onClick={()=>deleteBloco(b.id)} style={{cursor:"pointer",fontSize:11,color:"#CFD8DC"}}>✕</span>
          </div>
        </div>
        {/* Botões de mover (mobile) */}
        {!compact&&<div style={{display:"flex",gap:4,marginTop:5,flexWrap:"wrap"}}>
          {DIAS_SEMANA.map((d,i)=>{
            const ds=fmtDatePl(weekDates[i]);
            if(ds===b.data) return null;
            return<button key={i} onClick={()=>moverBloco(b,i)} style={{fontSize:9,background:"#fff",border:`1px solid ${BD}`,borderRadius:4,padding:"2px 6px",cursor:"pointer",color:TX2}}>→ {d.slice(0,3)}</button>;
          })}
        </div>}
      </div>
    );
  }

  return(
    <div>
      {toastPl&&<div style={{position:"fixed",bottom:80,right:16,zIndex:999,background:toastPl.type==="err"?"#C62828":"#1565C0",color:"#fff",borderRadius:10,padding:"10px 16px",fontSize:12.5,fontWeight:600,boxShadow:"0 4px 16px rgba(0,0,0,.2)"}}>{toastPl.msg}</div>}

      {/* HEADER */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,flexWrap:"wrap",gap:8}}>
        <div style={{fontWeight:700,fontSize:18,color:TX}}>🗂 Planejamento Semanal</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          <div style={{display:"flex",gap:0,background:"#fff",borderRadius:8,border:`1px solid ${BD}`,overflow:"hidden"}}>
            <button onClick={()=>setViewMode("semanal")} style={{background:viewMode==="semanal"?C:"#fff",color:viewMode==="semanal"?"#fff":TX2,border:"none",padding:"6px 12px",fontSize:11.5,fontFamily:"inherit",fontWeight:500,cursor:"pointer"}}>📅 Semanal</button>
            <button onClick={()=>setViewMode("diario")} style={{background:viewMode==="diario"?C:"#fff",color:viewMode==="diario"?"#fff":TX2,border:"none",padding:"6px 12px",fontSize:11.5,fontFamily:"inherit",fontWeight:500,cursor:"pointer"}}>📋 Diário</button>
          </div>
          <button onClick={()=>setWeekOffset(o=>o-1)} style={{background:"#fff",border:`1px solid ${BD}`,borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:13,color:TX}}>‹</button>
          <span style={{fontSize:11.5,fontWeight:600,color:C,minWidth:180,textAlign:"center"}}>{weekLabel}</span>
          <button onClick={()=>setWeekOffset(o=>o+1)} style={{background:"#fff",border:`1px solid ${BD}`,borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:13,color:TX}}>›</button>
          {weekOffset!==0&&<button onClick={()=>setWeekOffset(0)} style={{background:CL,border:`1px solid ${C}`,borderRadius:7,padding:"6px 8px",cursor:"pointer",fontSize:10,color:C,fontWeight:600}}>Hoje</button>}
          <button onClick={()=>{setEditBloco(null);setFormPl({...emptyBloco,data:fmtDatePl(weekDates[diaIdx]||weekDates[0])});setShowFormPl(true);}} style={{background:"#C62828",color:"#fff",border:"none",borderRadius:7,padding:"7px 14px",fontSize:12,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>+ Bloco</button>
        </div>
      </div>

      {/* INDICADORES */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:14}}>
        {[
          {l:"Planejadas",v:`${Math.floor(totalMin/60)}h${totalMin%60>0?totalMin%60+"m":""}`,c:C,bg:CL},
          {l:"Executadas",v:`${Math.floor(realizadoMin/60)}h${realizadoMin%60>0?realizadoMin%60+"m":""}`,c:"#2E7D32",bg:"#E8F5E9"},
          {l:"Disponível",v:`${Math.max(0,Math.floor(disponivel/60))}h`,c:TX2,bg:GR},
          {l:"Ocupação",v:`${ocupacao}%`,c:ocupacao>80?"#C62828":ocupacao>50?"#E65100":C,bg:ocupacao>80?"#FFEBEE":ocupacao>50?"#FFF3E0":CL},
          {l:"Pendentes",v:pendentes,c:"#C62828",bg:"#FFEBEE"},
        ].map(s=>(
          <div key={s.l} style={{background:s.bg,border:`1px solid ${s.c}33`,borderRadius:10,padding:"9px 10px"}}>
            <div style={{fontSize:18,fontWeight:700,color:s.c,lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:9.5,color:s.c,marginTop:2,fontWeight:500}}>{s.l}</div>
          </div>
        ))}
      </div>

      {loadingPl&&<div style={{textAlign:"center",padding:"30px",color:TX2}}>Carregando...</div>}

      {/* VISÃO SEMANAL */}
      {!loadingPl&&viewMode==="semanal"&&(
        <div style={{background:"#fff",border:`1px solid ${BD}`,borderRadius:12,overflow:"auto",WebkitOverflowScrolling:"touch"}}>
          {/* Cabeçalho dias */}
          <div style={{display:"grid",gridTemplateColumns:"56px repeat(5,1fr)",borderBottom:`1.5px solid ${BD}`}}>
            <div style={{padding:"8px 6px",fontSize:9,fontWeight:600,color:TX2,textAlign:"center"}}>Hora</div>
            {weekDates.map((d,i)=>{
              const isHoje=fmtDatePl(d)===fmtDatePl(new Date());
              return(
                <div key={i} onClick={()=>{setDiaIdx(i);setViewMode("diario");}} style={{padding:"8px 6px",textAlign:"center",cursor:"pointer",background:isHoje?CL:"#fff",borderLeft:`1px solid ${BD}`}}>
                  <div style={{fontSize:9.5,color:isHoje?C:TX2,fontWeight:600,textTransform:"uppercase"}}>{DIAS_SEMANA[i]}</div>
                  <div style={{fontSize:16,fontWeight:700,color:isHoje?C:TX}}>{d.getDate()}</div>
                  <div style={{fontSize:9,color:TX2}}>{blocosNoDia(fmtDatePl(d)).length} blocos</div>
                </div>
              );
            })}
          </div>

          {/* Grade manhã */}
          <div style={{padding:"4px 0 2px 0",background:"#FAFBFF",borderBottom:`1.5px dashed ${BD}`}}>
            <div style={{paddingLeft:6,fontSize:9,fontWeight:600,color:"#1565C0",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:2}}>☀️ Manhã · 08h–12h</div>
            <div style={{display:"grid",gridTemplateColumns:"56px repeat(5,1fr)",minHeight:MANHA_H}}>
              {/* Horários */}
              <div style={{position:"relative"}}>
                {HORAS_MANHA.slice(0,-1).filter((_,i)=>i%2===0).map(h=>(
                  <div key={h} style={{position:"absolute",top:(timeToMin(h)-480)/60*SLOT_H*4,left:0,right:0,fontSize:8.5,color:TX2,paddingLeft:4,lineHeight:1}}>{h}</div>
                ))}
              </div>
              {weekDates.map((d,di)=>{
                const ds=fmtDatePl(d);
                const dayBlocos=blocosNoDia(ds).filter(b=>timeToMin(b.hora_inicio)<720);
                return(
                  <div key={di} onDragOver={e=>e.preventDefault()} onDrop={async()=>{
                    if(dragId){await moverBloco(blocos.find(b=>b.id===dragId),di);setDragId(null);}
                  }} style={{position:"relative",minHeight:MANHA_H,borderLeft:`1px solid ${BD}`}}>
                    {HORAS_MANHA.slice(0,-1).map(h=>(
                      <div key={h} style={{position:"absolute",top:(timeToMin(h)-480)/60*SLOT_H*4,left:0,right:0,height:SLOT_H,borderTop:`1px solid ${h.endsWith("00")?"#DDE3F0":"#F0F3FA"}`}}/>
                    ))}
                    {dayBlocos.map(b=>{
                      const top=(timeToMin(b.hora_inicio)-480)/60*SLOT_H*4;
                      const height=Math.max((timeToMin(b.hora_fim)-timeToMin(b.hora_inicio))/60*SLOT_H*4,22);
                      const cat=PL_CATS[b.categoria]||PL_CATS.operacional;
                      const cor=b.cor||cat.color;
                      return(
                        <div key={b.id} draggable onDragStart={()=>setDragId(b.id)} onDragEnd={()=>setDragId(null)} onClick={()=>openEdit(b)}
                          style={{position:"absolute",top,left:2,right:2,height,background:b.concluido?"#F5F5F5":cat.bg,border:`1.5px solid ${cor}`,borderLeft:`3px solid ${cor}`,borderRadius:5,padding:"2px 4px",overflow:"hidden",cursor:"grab",zIndex:1,opacity:b.concluido?0.6:1}}>
                          <div style={{fontSize:9.5,fontWeight:700,color:cor,lineHeight:1.2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{b.titulo}</div>
                          <div style={{fontSize:8.5,color:TX2}}>{b.hora_inicio}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grade tarde */}
          <div style={{padding:"4px 0 2px 0",background:"#FFFBF0"}}>
            <div style={{paddingLeft:6,fontSize:9,fontWeight:600,color:"#E65100",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:2}}>🌤 Tarde · 14h–17h</div>
            <div style={{display:"grid",gridTemplateColumns:"56px repeat(5,1fr)",minHeight:TARDE_H}}>
              <div style={{position:"relative"}}>
                {HORAS_TARDE.slice(0,-1).filter((_,i)=>i%2===0).map(h=>(
                  <div key={h} style={{position:"absolute",top:(timeToMin(h)-840)/60*SLOT_H*4,left:0,right:0,fontSize:8.5,color:TX2,paddingLeft:4,lineHeight:1}}>{h}</div>
                ))}
              </div>
              {weekDates.map((d,di)=>{
                const ds=fmtDatePl(d);
                const dayBlocos=blocosNoDia(ds).filter(b=>timeToMin(b.hora_inicio)>=840);
                return(
                  <div key={di} onDragOver={e=>e.preventDefault()} onDrop={async()=>{
                    if(dragId){await moverBloco(blocos.find(b=>b.id===dragId),di);setDragId(null);}
                  }} style={{position:"relative",minHeight:TARDE_H,borderLeft:`1px solid ${BD}`}}>
                    {HORAS_TARDE.slice(0,-1).map(h=>(
                      <div key={h} style={{position:"absolute",top:(timeToMin(h)-840)/60*SLOT_H*4,left:0,right:0,height:SLOT_H,borderTop:`1px solid ${h.endsWith("00")?"#DDE3F0":"#F0F3FA"}`}}/>
                    ))}
                    {dayBlocos.map(b=>{
                      const top=(timeToMin(b.hora_inicio)-840)/60*SLOT_H*4;
                      const height=Math.max((timeToMin(b.hora_fim)-timeToMin(b.hora_inicio))/60*SLOT_H*4,22);
                      const cat=PL_CATS[b.categoria]||PL_CATS.operacional;
                      const cor=b.cor||cat.color;
                      return(
                        <div key={b.id} draggable onDragStart={()=>setDragId(b.id)} onDragEnd={()=>setDragId(null)} onClick={()=>openEdit(b)}
                          style={{position:"absolute",top,left:2,right:2,height,background:b.concluido?"#F5F5F5":cat.bg,border:`1.5px solid ${cor}`,borderLeft:`3px solid ${cor}`,borderRadius:5,padding:"2px 4px",overflow:"hidden",cursor:"grab",zIndex:1,opacity:b.concluido?0.6:1}}>
                          <div style={{fontSize:9.5,fontWeight:700,color:cor,lineHeight:1.2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{b.titulo}</div>
                          <div style={{fontSize:8.5,color:TX2}}>{b.hora_inicio}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VISÃO DIÁRIA */}
      {!loadingPl&&viewMode==="diario"&&(
        <div>
          {/* Seletor de dia */}
          <div style={{display:"flex",gap:5,marginBottom:14,overflowX:"auto"}}>
            {weekDates.map((d,i)=>{
              const isHoje=fmtDatePl(d)===fmtDatePl(new Date());
              return(
                <button key={i} onClick={()=>setDiaIdx(i)} style={{background:diaIdx===i?"#1565C0":isHoje?"#E3F0FF":"#fff",color:diaIdx===i?"#fff":isHoje?"#1565C0":"#5A6580",border:`1px solid ${diaIdx===i?"#1565C0":isHoje?"#1565C0":"#DDE3F0"}`,borderRadius:8,padding:"7px 14px",fontSize:12,fontFamily:"inherit",fontWeight:diaIdx===i?700:400,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                  {DIAS_SEMANA[i]} {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Grade do dia selecionado */}
          <div style={{background:"#fff",border:`1px solid ${BD}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"10px 14px",borderBottom:`1.5px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontWeight:700,fontSize:14,color:TX}}>{DIAS_SEMANA[diaIdx]}, {weekDates[diaIdx]?.toLocaleDateString("pt-BR",{day:"numeric",month:"long"})}</div>
              <div style={{fontSize:11,color:TX2}}>{blocosNoDia(fmtDatePl(weekDates[diaIdx]||new Date())).length} blocos · {Math.floor(blocosNoDia(fmtDatePl(weekDates[diaIdx]||new Date())).reduce((s,b)=>s+(b.tempo_previsto||0),0)/60)}h planejadas</div>
            </div>
            {[{label:"☀️ Manhã",horas:HORAS_MANHA,min:480,max:720},
              {label:"🌤 Tarde",horas:HORAS_TARDE,min:840,max:1020}].map(periodo=>{
              const ds=fmtDatePl(weekDates[diaIdx]||new Date());
              const perioBlocos=blocosNoDia(ds).filter(b=>timeToMin(b.hora_inicio)>=periodo.min&&timeToMin(b.hora_inicio)<periodo.max);
              return(
                <div key={periodo.label} style={{borderBottom:`1.5px dashed ${BD}`}}>
                  <div style={{padding:"6px 14px",background:"#FAFBFF",fontSize:10,fontWeight:600,color:TX2,textTransform:"uppercase",letterSpacing:"0.5px"}}>{periodo.label}</div>
                  {periodo.horas.slice(0,-1).map(h=>{
                    const blocoNaHora=perioBlocos.filter(b=>b.hora_inicio===h);
                    const isOcupado=perioBlocos.some(b=>timeToMin(b.hora_inicio)<=timeToMin(h)&&timeToMin(b.hora_fim)>timeToMin(h)&&b.hora_inicio!==h);
                    return(
                      <div key={h} style={{display:"flex",borderTop:`1px solid ${h.endsWith("00")?BD:"#F0F3FA"}`,minHeight:36}}>
                        <div style={{width:56,padding:"4px 8px",fontSize:10,color:TX2,flexShrink:0,borderRight:`1px solid ${BD}`,lineHeight:"28px"}}>{h.endsWith("00")||h.endsWith("30")?h:""}</div>
                        <div style={{flex:1,padding:"2px 6px",background:isOcupado?"#FAFBFF":"#fff"}}>
                          {blocoNaHora.map(b=><BlocoCard key={b.id} b={b}/>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL NOVO BLOCO */}
      {showFormPl&&(
        <div style={{position:"fixed",inset:0,background:"rgba(20,40,80,0.4)",zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:0}} onClick={e=>e.target===e.currentTarget&&setShowFormPl(false)}>
          <div style={{background:"#fff",borderRadius:"16px 16px 0 0",padding:"20px 16px 32px",width:"100%",maxWidth:540,maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{width:36,height:4,background:"#DDE3F0",borderRadius:2,margin:"0 auto 16px"}}/>
            <div style={{fontWeight:700,fontSize:16,color:C,marginBottom:14,borderBottom:`2px solid ${CL}`,paddingBottom:10}}>
              {editBloco?"✏️ Editar Bloco":"✨ Novo Bloco"}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:11}}>
              <div>
                <label style={lblStyle}>Título *</label>
                <input style={inputStyle} value={formPl.titulo} onChange={e=>{
                  const t=e.target.value;
                  const tp=Object.entries(TEMPO_PADRAO).find(([k])=>t.toLowerCase().includes(k.toLowerCase()));
                  setFormPl(f=>({...f,titulo:t,tempo_previsto:tp?tp[1]:f.tempo_previsto,hora_fim:tp?addMinutes(f.hora_inicio,tp[1]):f.hora_fim}));
                }} placeholder="Ex: Folha de Pagamento, Reunião com cliente..."/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={lblStyle}>Categoria</label>
                  <select style={inputStyle} value={formPl.categoria} onChange={e=>setFormPl(f=>({...f,categoria:e.target.value,subcategoria:""}))}>
                    {Object.entries(PL_CATS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lblStyle}>Subcategoria</label>
                  <select style={inputStyle} value={formPl.subcategoria} onChange={e=>setFormPl(f=>({...f,subcategoria:e.target.value}))}>
                    <option value="">— Selecione —</option>
                    {(PL_CATS[formPl.categoria]?.subs||[]).map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={lblStyle}>Prioridade</label>
                  <select style={inputStyle} value={formPl.prioridade} onChange={e=>setFormPl(f=>({...f,prioridade:e.target.value}))}>
                    {Object.entries(PL_PRIS).map(([k,v])=><option key={k} value={k}>{v.dot} {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lblStyle}>Urgência</label>
                  <select style={inputStyle} value={formPl.urgencia} onChange={e=>setFormPl(f=>({...f,urgencia:e.target.value}))}>
                    {Object.entries(PL_URG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                <div>
                  <label style={lblStyle}>Data</label>
                  <input type="date" style={inputStyle} value={formPl.data} onChange={e=>setFormPl(f=>({...f,data:e.target.value}))}/>
                </div>
                <div>
                  <label style={lblStyle}>Início</label>
                  <select style={inputStyle} value={formPl.hora_inicio} onChange={e=>{
                    const hi=e.target.value;
                    setFormPl(f=>({...f,hora_inicio:hi,hora_fim:addMinutes(hi,f.tempo_previsto)}));
                  }}>
                    {TODAS_HORAS.map(h=><option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lblStyle}>Fim</label>
                  <select style={inputStyle} value={formPl.hora_fim} onChange={e=>setFormPl(f=>({...f,hora_fim:e.target.value,tempo_previsto:timeToMin(e.target.value)-timeToMin(f.hora_inicio)}))}>
                    {TODAS_HORAS.map(h=><option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={lblStyle}>Tempo previsto (min)</label>
                  <input type="number" style={inputStyle} value={formPl.tempo_previsto} onChange={e=>setFormPl(f=>({...f,tempo_previsto:Number(e.target.value),hora_fim:addMinutes(f.hora_inicio,Number(e.target.value))}))} min={15} step={15}/>
                </div>
                <div>
                  <label style={lblStyle}>Tempo realizado (min)</label>
                  <input type="number" style={inputStyle} value={formPl.tempo_realizado||0} onChange={e=>setFormPl(f=>({...f,tempo_realizado:Number(e.target.value)}))} min={0} step={15}/>
                </div>
              </div>
              {!editBloco&&<div>
                <label style={lblStyle}>Recorrência</label>
                <select style={inputStyle} value={formPl.recorrencia} onChange={e=>setFormPl(f=>({...f,recorrencia:e.target.value}))}>
                  <option value="nenhuma">Sem recorrência</option>
                  <option value="diaria">Diária (toda a semana)</option>
                  <option value="semanal">Semanal</option>
                </select>
              </div>}
              <div>
                <label style={lblStyle}>Observações</label>
                <textarea style={{...inputStyle,resize:"none"}} rows={2} value={formPl.observacoes} onChange={e=>setFormPl(f=>({...f,observacoes:e.target.value}))} placeholder="Notas, links, contexto..."/>
              </div>
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button onClick={()=>setShowFormPl(false)} style={{flex:1,background:"#fff",border:`1px solid ${BD}`,color:TX2,borderRadius:8,padding:"12px",fontSize:14,fontFamily:"inherit",cursor:"pointer"}}>Cancelar</button>
                <button onClick={saveBloco} style={{flex:2,background:C,color:"#fff",border:"none",borderRadius:8,padding:"12px",fontSize:14,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>{editBloco?"Salvar":"Criar bloco"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────
// DASHBOARD COMPONENT
// ─────────────────────────────────────────────
const FOLHA_ATIVA_D=["Acervo Chop","AutoBraz","Blindar Contagem","Cantina Freitas","Cleiton Martins","Cledson Elevadores","Control Vt","Decora","Deposito Cerveja MTZ","Di France","Espaço Presentes","Espaço Vitta Pilates","Flavia FSA","FOCO","Ge Car","Guindaumaq","HJ Peças","Jeovane","Ligeirinho","M&R Placas","M3 Comércio","Magnus Imóveis","Marcelo Transporte","MDC Locação","MG5","Milton Tem Tem","Natal MTZ","Natalia Mota","Nivair","OMR Entregas","Opção Locação","Opção Visual","PRONTOVET Ibirité","R&E Top Diesel","RDS","Frutos de Minas Barreiro","Frutos de Minas Barreiro FL","Rede Frutos de Minas Betim","Frutos de Minas Betim FL","Res Lealdo","Rodrigar","Rosálio Duarte","SEGUROBRAS","Stenner","Shopping das Peças","Tower","T&R"];
const DOMESTICAS_D=["Elza Maria","Maria dos Anjos","Leonídia","Eliane","Eduardo Freitas","Sandra","Geraldo"];
const SEM_MOVIMENTO_D=["Antonio Clareti","Blindar Ibirité","By Tracker","CT Treinamento","Deposito Cerveja FL","EABorges","Heleno","Marc Textil","Merc. Manhumirim","Natal FL","NetForce","Piazza Peças","Pulga Car","Quintal Fornalha","Protagon","PROFISS","Ramon Carvalho MEI","RDL Holding","Tiago Alves","Valente"];
const FOLHA_COLS_D=["Folha","DARF","FGTS","Adiantamento","REINF","eCons"];
const DOM_COLS_D=["Folha","Guia","Status"];
const BLUE_D="#1565C0",BLUE_LIGHT_D="#E3F0FF",RED_D="#C62828",RED_LIGHT_D="#FFEBEE",BORDER_D="#DDE3F0",TEXT_D="#1A2340",TEXT2_D="#5A6580",GRAY_D="#F5F6FA";

function MiniBar({val,total,color}){
  const pct=total===0?0:Math.round((val/total)*100);
  return(
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{flex:1,height:8,background:"#EEF0F5",borderRadius:4,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:4,transition:"width .4s ease"}}/>
      </div>
      <span style={{fontSize:11,fontWeight:700,color,minWidth:32}}>{pct}%</span>
    </div>
  );
}

function DonutChart({segments,size=120}){
  const total=segments.reduce((s,x)=>s+x.val,0);
  if(total===0)return<div style={{width:size,height:size,borderRadius:"50%",background:"#EEF0F5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:TEXT2_D}}>Vazio</div>;
  let offset=0;
  const r=40,cx=60,cy=60,circ=2*Math.PI*r;
  return(
    <svg width={size} height={size} viewBox="0 0 120 120">
      {segments.map((seg,i)=>{
        const pct=seg.val/total;
        const dash=pct*circ;
        const gap=circ-dash;
        const el=<circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={18} strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset*circ} style={{transition:"stroke-dasharray .4s ease"}}/>;
        offset+=pct;
        return el;
      })}
      <text x={60} y={55} textAnchor="middle" fontSize={18} fontWeight={700} fill={TEXT_D}>{total}</text>
      <text x={60} y={72} textAnchor="middle" fontSize={9} fill={TEXT2_D}>total</text>
    </svg>
  );
}

function DashboardView({fechaMap,fechaLoading,onRefresh,getCell}){
  const [dashTab,setDashTab]=useState("folha");

  // ── FOLHA ATIVA stats ──
  const folhaStats=useMemo(()=>{
    let entregue=0,andamento=0,pendente=0,aguardando=0;
    const porColuna={};
    FOLHA_COLS_D.forEach(c=>{porColuna[c]={entregue:0,andamento:0,pendente:0};});
    FOLHA_ATIVA_D.forEach(emp=>{
      let todosEntregue=true,algumAndamento=false,algumAguardando=false;
      FOLHA_COLS_D.forEach(col=>{
        const cell=getCell("folha",emp,col);
        porColuna[col][cell.status]=(porColuna[col][cell.status]||0)+1;
        if(cell.status!=="entregue")todosEntregue=false;
        if(cell.status==="andamento")algumAndamento=true;
        // "aguardando cliente" = folha entregue mas DARF/FGTS pendente
        if(col==="Folha"&&cell.status==="entregue")algumAguardando=true;
      });
      const darfOk=getCell("folha",emp,"DARF").status==="entregue";
      const fgtsOk=getCell("folha",emp,"FGTS").status==="entregue";
      if(todosEntregue)entregue++;
      else if(algumAguardando&&!darfOk&&!fgtsOk)aguardando++;
      else if(algumAndamento)andamento++;
      else pendente++;
    });
    return{entregue,andamento,pendente,aguardando,porColuna,total:FOLHA_ATIVA_D.length};
  },[fechaMap]);

  // ── DOMÉSTICAS stats ──
  const domStats=useMemo(()=>{
    let entregue=0,andamento=0,pendente=0;
    DOMESTICAS_D.forEach(emp=>{
      const statuses=DOM_COLS_D.map(c=>getCell("dom",emp,c).status);
      if(statuses.every(s=>s==="entregue"))entregue++;
      else if(statuses.some(s=>s==="andamento"))andamento++;
      else pendente++;
    });
    return{entregue,andamento,pendente,total:DOMESTICAS_D.length};
  },[fechaMap]);

  // ── SEM MOVIMENTO stats ──
  const semStats=useMemo(()=>{
    const conf=SEM_MOVIMENTO_D.filter(e=>getCell("sem",e,"conferido").status==="entregue").length;
    return{conferido:conf,pendente:SEM_MOVIMENTO_D.length-conf,total:SEM_MOVIMENTO_D.length};
  },[fechaMap]);

  // Empresas por status (folha)
  const empresasPorStatus=useMemo(()=>{
    const entregues=[],aguardando=[],andamento=[],pendentes=[];
    FOLHA_ATIVA_D.forEach(emp=>{
      const folhaOk=getCell("folha",emp,"Folha").status==="entregue";
      const darfOk=getCell("folha",emp,"DARF").status==="entregue";
      const fgtsOk=getCell("folha",emp,"FGTS").status==="entregue";
      const tudo=FOLHA_COLS_D.every(c=>getCell("folha",emp,c).status==="entregue");
      const algumAnd=FOLHA_COLS_D.some(c=>getCell("folha",emp,c).status==="andamento");
      if(tudo)entregues.push(emp);
      else if(folhaOk&&(!darfOk||!fgtsOk))aguardando.push(emp);
      else if(algumAnd)andamento.push(emp);
      else pendentes.push(emp);
    });
    return{entregues,aguardando,andamento,pendentes};
  },[fechaMap]);

  if(fechaLoading)return<div style={{textAlign:"center",padding:"40px",color:TEXT2_D,fontSize:13}}>Carregando dashboard...</div>;

  const tabStyle=(active,color)=>({
    flex:1,background:active?color:"#fff",color:active?"#fff":TEXT2_D,
    border:`1px solid ${active?color:BORDER_D}`,borderRadius:8,padding:"8px 4px",
    fontSize:11.5,fontFamily:"inherit",fontWeight:500,cursor:"pointer",transition:"all .15s"
  });

  const statCard=(val,label,color,bg)=>(
    <div style={{background:bg,border:`1px solid ${color}33`,borderRadius:10,padding:"12px 14px",flex:1,minWidth:0}}>
      <div style={{fontSize:26,fontWeight:700,color,lineHeight:1}}>{val}</div>
      <div style={{fontSize:10.5,color,marginTop:3,fontWeight:500,lineHeight:1.2}}>{label}</div>
    </div>
  );

  const groupCard=(title,icon,color,bg,empresas)=>(
    empresas.length===0?null:
    <div style={{background:"#fff",border:`1.5px solid ${color}33`,borderLeft:`4px solid ${color}`,borderRadius:10,padding:"12px 14px",marginBottom:10}}>
      <div style={{fontSize:12,fontWeight:700,color,marginBottom:8}}>{icon} {title} <span style={{fontWeight:400,color:TEXT2_D,fontSize:11}}>({empresas.length})</span></div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
        {empresas.map(e=><span key={e} style={{background:bg,color,border:`1px solid ${color}44`,borderRadius:5,padding:"3px 8px",fontSize:11,fontWeight:500}}>{e}</span>)}
      </div>
    </div>
  );

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
        <div style={{fontWeight:700,fontSize:18,color:TEXT_D}}>📈 Dashboard de Entregas</div>
        <button onClick={onRefresh} style={{background:"#fff",border:`1px solid ${BORDER_D}`,color:BLUE_D,borderRadius:7,padding:"6px 12px",fontSize:12,fontFamily:"inherit",cursor:"pointer"}}>↻ Atualizar</button>
      </div>
      <div style={{fontSize:11,color:TEXT2_D,marginBottom:14}}>{new Date().toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</div>

      {/* SUB-ABAS */}
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        <button style={tabStyle(dashTab==="folha",BLUE_D)} onClick={()=>setDashTab("folha")}>📋 Folha Ativa</button>
        <button style={tabStyle(dashTab==="dom","#6A1B9A")} onClick={()=>setDashTab("dom")}>🏠 Domésticas</button>
        <button style={tabStyle(dashTab==="sem","#00838F")} onClick={()=>setDashTab("sem")}>📁 Sem Movimento</button>
      </div>

      {/* ── FOLHA ATIVA ── */}
      {dashTab==="folha"&&<>
        {/* Cards de resumo */}
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {statCard(folhaStats.entregue,"Concluídas","#2E7D32","#E8F5E9")}
          {statCard(folhaStats.aguardando,"Aguard. Cliente","#E65100","#FFF3E0")}
          {statCard(folhaStats.andamento,"Em Andamento",BLUE_D,BLUE_LIGHT_D)}
          {statCard(folhaStats.pendente,"Pendentes",RED_D,RED_LIGHT_D)}
        </div>

        {/* Donut + progresso por coluna */}
        <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
          {/* Donut */}
          <div style={{background:"#fff",border:`1px solid ${BORDER_D}`,borderRadius:12,padding:"16px",display:"flex",flexDirection:"column",alignItems:"center",gap:10,minWidth:160}}>
            <div style={{fontSize:12,fontWeight:700,color:TEXT_D}}>Visão Geral</div>
            <DonutChart segments={[
              {val:folhaStats.entregue,color:"#2E7D32"},
              {val:folhaStats.aguardando,color:"#E65100"},
              {val:folhaStats.andamento,color:BLUE_D},
              {val:folhaStats.pendente,color:RED_D},
            ]} size={120}/>
            <div style={{display:"flex",flexDirection:"column",gap:4,width:"100%"}}>
              {[["#2E7D32","Concluídas",folhaStats.entregue],["#E65100","Aguard. Cliente",folhaStats.aguardando],[BLUE_D,"Em andamento",folhaStats.andamento],[RED_D,"Pendentes",folhaStats.pendente]].map(([c,l,v])=>(
                <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10.5}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:c,flexShrink:0}}/>
                  <span style={{flex:1,color:TEXT2_D}}>{l}</span>
                  <span style={{fontWeight:700,color:c}}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Progresso por coluna */}
          <div style={{background:"#fff",border:`1px solid ${BORDER_D}`,borderRadius:12,padding:"16px",flex:1,minWidth:200}}>
            <div style={{fontSize:12,fontWeight:700,color:TEXT_D,marginBottom:12}}>Progresso por Coluna</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {FOLHA_COLS_D.map(col=>{
                const e=folhaStats.porColuna[col]?.entregue||0;
                const total=folhaStats.total;
                return(
                  <div key={col}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:11.5,fontWeight:600,color:TEXT_D}}>{col}</span>
                      <span style={{fontSize:11,color:TEXT2_D}}>{e}/{total}</span>
                    </div>
                    <MiniBar val={e} total={total} color={e===total?"#2E7D32":e>total/2?BLUE_D:RED_D}/>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Empresas por status */}
        <div style={{fontSize:12,fontWeight:700,color:TEXT_D,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>Empresas por Status</div>
        {groupCard("Concluídas — tudo entregue","✅","#2E7D32","#E8F5E9",empresasPorStatus.entregues)}
        {groupCard("Aguardando Cliente — folha enviada, guias pendentes","⏳","#E65100","#FFF3E0",empresasPorStatus.aguardando)}
        {groupCard("Em Andamento","🟡",BLUE_D,BLUE_LIGHT_D,empresasPorStatus.andamento)}
        {groupCard("Pendentes — nenhuma etapa iniciada","⬜",RED_D,RED_LIGHT_D,empresasPorStatus.pendentes)}
      </>}

      {/* ── DOMÉSTICAS ── */}
      {dashTab==="dom"&&<>
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {statCard(domStats.entregue,"Concluídas","#2E7D32","#E8F5E9")}
          {statCard(domStats.andamento,"Em Andamento",BLUE_D,BLUE_LIGHT_D)}
          {statCard(domStats.pendente,"Pendentes",RED_D,RED_LIGHT_D)}
        </div>
        <div style={{background:"#fff",border:`1px solid ${BORDER_D}`,borderRadius:12,padding:"16px",marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:TEXT_D,marginBottom:12}}>Status por Empregada</div>
          {DOMESTICAS_D.map(emp=>{
            const statuses=DOM_COLS_D.map(c=>getCell("dom",emp,c).status);
            const tudo=statuses.every(s=>s==="entregue");
            const algum=statuses.some(s=>s==="entregue"||s==="andamento");
            const cor=tudo?"#2E7D32":algum?BLUE_D:RED_D;
            const bg=tudo?"#E8F5E9":algum?BLUE_LIGHT_D:RED_LIGHT_D;
            const icon=tudo?"✅":algum?"🟡":"⬜";
            return(
              <div key={emp} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${BORDER_D}`}}>
                <span style={{fontSize:16}}>{icon}</span>
                <span style={{flex:1,fontSize:13,fontWeight:500,color:TEXT_D}}>{emp}</span>
                <div style={{display:"flex",gap:5}}>
                  {DOM_COLS_D.map(col=>{
                    const s=getCell("dom",emp,col).status;
                    return<span key={col} style={{fontSize:9.5,background:s==="entregue"?"#E8F5E9":s==="andamento"?BLUE_LIGHT_D:"#F5F6FA",color:s==="entregue"?"#2E7D32":s==="andamento"?BLUE_D:TEXT2_D,border:`1px solid ${s==="entregue"?"#2E7D32":s==="andamento"?BLUE_D:BORDER_D}44`,borderRadius:4,padding:"2px 6px",fontWeight:500}}>{col}</span>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </>}

      {/* ── SEM MOVIMENTO ── */}
      {dashTab==="sem"&&<>
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {statCard(semStats.conferido,"Conferidas","#2E7D32","#E8F5E9")}
          {statCard(semStats.pendente,"Pendentes",RED_D,RED_LIGHT_D)}
          {statCard(semStats.total,"Total","#00838F","#E0F7FA")}
        </div>
        <div style={{background:"#fff",border:`1px solid ${BORDER_D}`,borderRadius:12,padding:"14px",marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:TEXT_D,marginBottom:8}}>Progresso Geral</div>
          <MiniBar val={semStats.conferido} total={semStats.total} color="#2E7D32"/>
          <div style={{fontSize:11,color:TEXT2_D,marginTop:6}}>{semStats.conferido} de {semStats.total} conferidas</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:7}}>
          {SEM_MOVIMENTO_D.map(emp=>{
            const conf=getCell("sem",emp,"conferido").status==="entregue";
            return(
              <div key={emp} style={{border:`1.5px solid ${conf?"#2E7D32":BORDER_D}`,borderRadius:8,padding:"9px 12px",background:conf?"#F1FBF4":"#fff",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16}}>{conf?"✅":"⬜"}</span>
                <span style={{fontSize:12,color:TEXT_D,fontWeight:conf?600:400}}>{emp}</span>
              </div>
            );
          })}
        </div>
      </>}
    </div>
  );
}


function Empty({icon,msg,sub}){
  const TX2="#6B7A99";
  return(<div style={{textAlign:"center",padding:"52px 0",color:"#B0BACC"}}>
    <div style={{fontSize:40,marginBottom:12}}>{icon}</div>
    <div style={{fontWeight:700,fontSize:15,color:TX2,letterSpacing:"-0.2px"}}>{msg}</div>
    {sub&&<div style={{fontSize:12.5,marginTop:5,color:"#A0AABF"}}>{sub}</div>}
  </div>);
}

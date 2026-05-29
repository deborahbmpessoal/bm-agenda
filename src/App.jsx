import { useState, useMemo, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://dmugffjkrrgndrtbdotm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdWdmZmprcnJnbmRydGJkb3RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNDQ2NTEsImV4cCI6MjA5NTYyMDY1MX0.pt2Z_UA2Y3eTBvYTWN3gShlG1v3-WIfDDVpJ0DnGVjc";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BLUE = "#1565C0";
const BLUE_LIGHT = "#E3F0FF";
const BLUE_MID = "#1976D2";
const RED = "#C62828";
const RED_LIGHT = "#FFEBEE";
const GRAY = "#F5F6FA";
const BORDER = "#DDE3F0";
const TEXT = "#1A2340";
const TEXT2 = "#5A6580";

const CATEGORIES = {
  fiscal:        { label: "Fiscal",          color: BLUE,    bg: BLUE_LIGHT,  icon: "📊" },
  dp:            { label: "Dep. Pessoal",    color: "#6A1B9A", bg: "#F3E5F5", icon: "👥" },
  contabil:      { label: "Contábil",        color: "#00838F", bg: "#E0F7FA", icon: "📒" },
  financeiro:    { label: "Financeiro",      color: RED,     bg: RED_LIGHT,   icon: "💰" },
  administrativo:{ label: "Administrativo",  color: "#E65100", bg: "#FFF3E0", icon: "📋" },
  cliente:       { label: "Cliente",         color: "#2E7D32", bg: "#E8F5E9", icon: "🤝" },
};

const PRIORITIES = {
  urgente: { label: "Urgente", color: RED,      bg: RED_LIGHT,   dot: "●" },
  alta:    { label: "Alta",    color: "#E65100", bg: "#FFF3E0",   dot: "●" },
  media:   { label: "Média",   color: "#F9A825", bg: "#FFFDE7",   dot: "●" },
  baixa:   { label: "Baixa",   color: "#2E7D32", bg: "#E8F5E9",   dot: "●" },
};

const today = new Date(); today.setHours(0,0,0,0);
const todayStr = today.toISOString().split("T")[0];

function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function fmtDate(d) { return d.toISOString().split("T")[0]; }
function ptDate(str) { if (!str) return "—"; const [y,m,d] = str.split("-"); return `${d}/${m}/${y}`; }
function getWeekStart(d) { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate()-day+(day===0?-6:1)); x.setHours(0,0,0,0); return x; }
function diffDays(str) { const d = new Date(str+"T00:00:00"); return Math.ceil((d-today)/(86400000)); }

const WDAYS = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
const WFULL  = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"];

function scoreTask(t) {
  const d = diffDays(t.due);
  const p = {urgente:100,alta:60,media:30,baixa:10}[t.priority]||0;
  const u = d<=0?200:d===1?150:d<=3?80:d<=7?40:10;
  return p+u;
}

function statusInfo(t) {
  const d = diffDays(t.due);
  if (d<0)  return { label:`${Math.abs(d)}d em atraso`, color:RED, bg:RED_LIGHT };
  if (d===0) return { label:"Hoje",    color:BLUE,    bg:BLUE_LIGHT };
  if (d===1) return { label:"Amanhã",  color:"#E65100", bg:"#FFF3E0" };
  return       { label:`Em ${d}d`,  color:TEXT2,   bg:GRAY };
}

export default function App() {
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [view, setView]       = useState("agenda");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]   = useState(null);
  const [toast, setToast]     = useState(null);
  const [filterCat, setFilterCat] = useState("all");
  const [filterPri, setFilterPri] = useState("all");
  const [showDone, setShowDone]   = useState(false);

  const emptyForm = { title:"", category:"fiscal", priority:"media", due:todayStr, client:"", notes:"", created_at: todayStr, completed_at: "" };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchTasks(); }, []);

  async function fetchTasks() {
    setLoading(true);
    const { data } = await supabase.from("tasks").select("*").order("due",{ascending:true});
    setTasks(data||[]); setLoading(false);
  }

  function showToast(msg, type="ok") { setToast({msg,type}); setTimeout(()=>setToast(null),3000); }

  async function saveForm() {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = { title:form.title, category:form.category, priority:form.priority, due:form.due, client:form.client, notes:form.notes, created_at:form.created_at, completed_at:form.completed_at||null, done:false };
    if (editId) {
      await supabase.from("tasks").update(payload).eq("id",editId);
      showToast("Tarefa atualizada!");
    } else {
      await supabase.from("tasks").insert([payload]);
      showToast("Tarefa criada!");
    }
    setShowForm(false); setEditId(null); setForm(emptyForm); setSaving(false); fetchTasks();
  }

  async function toggleDone(t) {
    const now = !t.done;
    const completed_at = now ? todayStr : null;
    await supabase.from("tasks").update({done:now, completed_at}).eq("id",t.id);
    setTasks(prev=>prev.map(x=>x.id===t.id?{...x,done:now,completed_at}:x));
    showToast(now?"Concluída! ✓":"Reaberta");
  }

  async function deleteTask(id) {
    await supabase.from("tasks").delete().eq("id",id);
    setTasks(prev=>prev.filter(x=>x.id!==id)); showToast("Removida");
  }

  function openEdit(t) {
    setForm({ title:t.title, category:t.category, priority:t.priority, due:t.due, client:t.client||"", notes:t.notes||"", created_at:t.created_at||todayStr, completed_at:t.completed_at||"" });
    setEditId(t.id); setShowForm(true);
  }

  const weekStart = getWeekStart(today);
  const weekDays  = Array.from({length:7},(_,i)=>addDays(weekStart,i));

  const pending = tasks.filter(t=>!t.done);
  const done    = tasks.filter(t=>t.done);

  const todayTasks = useMemo(()=>[...pending].filter(t=>t.due<=todayStr).sort((a,b)=>scoreTask(b)-scoreTask(a)),[tasks]);
  const weekTasks  = (ds) => tasks.filter(t=>!t.done&&t.due===ds).sort((a,b)=>scoreTask(b)-scoreTask(a));
  const allFiltered = useMemo(()=>[...pending]
    .filter(t=>filterCat==="all"||t.category===filterCat)
    .filter(t=>filterPri==="all"||t.priority===filterPri)
    .sort((a,b)=>scoreTask(b)-scoreTask(a)),[tasks,filterCat,filterPri]);

  const stats = [
    { label:"Hoje",       val: todayTasks.length,                                                          color:BLUE,    bg:BLUE_LIGHT },
    { label:"Em Atraso",  val: pending.filter(t=>t.due<todayStr).length,                                   color:RED,     bg:RED_LIGHT  },
    { label:"Esta Semana",val: pending.filter(t=>t.due>=fmtDate(weekStart)&&t.due<=fmtDate(addDays(weekStart,6))).length, color:"#00838F", bg:"#E0F7FA" },
    { label:"Concluídas", val: done.length,                                                                 color:"#2E7D32", bg:"#E8F5E9" },
  ];

  const S = {
    root:{ fontFamily:"'Segoe UI',Arial,sans-serif", background:"#F0F3FA", minHeight:"100vh", color:TEXT },
    header:{ background:"#fff", borderBottom:`2px solid ${BLUE}`, padding:"0 28px", height:60, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 },
    logo:{ display:"flex", alignItems:"center", gap:10 },
    logoMark:{ width:36, height:36, borderRadius:8, background:BLUE, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:15 },
    logoText:{ lineHeight:1.1 },
    logoName:{ fontSize:14, fontWeight:700, color:BLUE, letterSpacing:"-0.2px" },
    logoSub:{ fontSize:10.5, color:TEXT2, textTransform:"uppercase", letterSpacing:"1px" },
    nav:{ display:"flex", gap:4 },
    navBtn:(active)=>({ background:active?BLUE:"transparent", color:active?"#fff":TEXT2, border:`1px solid ${active?BLUE:BORDER}`, borderRadius:7, padding:"6px 14px", fontSize:12.5, fontFamily:"inherit", fontWeight:500, cursor:"pointer" }),
    addBtn:{ background:RED, color:"#fff", border:"none", borderRadius:8, padding:"8px 18px", fontSize:13, fontWeight:700, fontFamily:"inherit", cursor:"pointer" },
    main:{ maxWidth:1100, margin:"0 auto", padding:"24px 16px" },
    statsGrid:{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 },
    statCard:(bg)=>({ background:bg, border:`1px solid ${BORDER}`, borderRadius:12, padding:"14px 18px" }),
    statVal:(color)=>({ fontSize:28, fontWeight:700, color, lineHeight:1 }),
    statLabel:{ fontSize:11.5, color:TEXT2, marginTop:4 },
    section:{ fontWeight:700, fontSize:20, color:TEXT, marginBottom:4 },
    sub:{ fontSize:12, color:TEXT2, marginBottom:20 },
    card:{ background:"#fff", border:`1px solid ${BORDER}`, borderRadius:10, padding:"13px 16px", display:"flex", alignItems:"flex-start", gap:12, marginBottom:8, transition:"box-shadow .15s" },
    badge:(color,bg)=>({ background:bg, color, border:`1px solid ${color}33`, borderRadius:5, padding:"2px 8px", fontSize:10.5, fontWeight:600, whiteSpace:"nowrap" }),
    circle:(color)=>({ width:22, height:22, borderRadius:"50%", border:`2px solid ${color}`, flexShrink:0, cursor:"pointer", marginTop:2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color }),
    doneDot:{ width:22, height:22, borderRadius:"50%", background:"#2E7D32", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", cursor:"pointer", marginTop:2 },
    icon:(color)=>({ cursor:"pointer", color, fontSize:13, padding:"3px 6px" }),
    dayCol:(isToday)=>({ background:isToday?"#E3F0FF":"#fff", border:`1px solid ${isToday?BLUE:BORDER}`, borderRadius:10, padding:"10px 8px", minHeight:140 }),
    dayNum:(isToday,isPast)=>({ fontSize:20, fontWeight:700, color:isToday?BLUE:isPast?"#C5CAD8":TEXT }),
    dayLbl:(isToday)=>({ fontSize:10, color:isToday?BLUE:TEXT2, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px" }),
    pill:(c,bg,active)=>({ background:active?bg:"#fff", border:`1px solid ${active?c:BORDER}`, color:active?c:TEXT2, borderRadius:20, padding:"4px 12px", fontSize:11.5, fontWeight:500, cursor:"pointer" }),
    overlay:{ position:"fixed", inset:0, background:"rgba(20,40,80,0.35)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 },
    modal:{ background:"#fff", border:`1px solid ${BORDER}`, borderRadius:16, padding:28, width:"100%", maxWidth:500, maxHeight:"92vh", overflowY:"auto" },
    label:{ fontSize:11, color:TEXT2, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.5px", fontWeight:600 },
    input:{ width:"100%", background:GRAY, border:`1px solid ${BORDER}`, borderRadius:8, padding:"9px 12px", color:TEXT, fontSize:13.5, fontFamily:"inherit" },
    toastOk:{ position:"fixed", bottom:24, right:24, zIndex:999, background:BLUE, color:"#fff", borderRadius:10, padding:"11px 20px", fontSize:13, fontWeight:600 },
    toastErr:{ position:"fixed", bottom:24, right:24, zIndex:999, background:RED, color:"#fff", borderRadius:10, padding:"11px 20px", fontSize:13, fontWeight:600 },
  };

  if (loading) return (
    <div style={{...S.root, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:14}}>
      <div style={{width:36,height:36,borderRadius:"50%",border:`3px solid ${BORDER}`,borderTop:`3px solid ${BLUE}`,animation:"spin .8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{color:TEXT2,fontSize:14}}>Carregando agenda...</div>
    </div>
  );

  return (
    <div style={S.root}>
      <style>{`.tc:hover{box-shadow:0 2px 12px rgba(21,101,192,.10)}`}</style>

      {toast && <div style={toast.type==="err"?S.toastErr:S.toastOk}>{toast.msg}</div>}

      {/* HEADER */}
      <div style={S.header}>
        <div style={S.logo}>
          <div style={S.logoMark}>BM</div>
          <div style={S.logoText}>
            <div style={S.logoName}>BM CONTABILIDADE</div>
            <div style={S.logoSub}>Agenda Inteligente Contábil</div>
          </div>
        </div>
        <div style={S.nav}>
          {[["agenda","📅 Hoje"],["semana","🗓 Semana"],["tarefas","📋 Tarefas"],["mapa","📊 Mapa"]].map(([v,l])=>(
            <button key={v} style={S.navBtn(view===v)} onClick={()=>setView(v)}>{l}</button>
          ))}
        </div>
        <button style={S.addBtn} onClick={()=>{setEditId(null);setForm(emptyForm);setShowForm(true)}}>+ Nova Tarefa</button>
      </div>

      <div style={S.main}>

        {/* STATS */}
        <div style={S.statsGrid}>
          {stats.map(s=>(
            <div key={s.label} style={S.statCard(s.bg)}>
              <div style={S.statVal(s.color)}>{s.val}</div>
              <div style={S.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── HOJE ── */}
        {view==="agenda" && <>
          <div style={S.section}>Agenda de Hoje</div>
          <div style={S.sub}>{today.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
          {todayTasks.length===0
            ? <Empty icon="🎉" msg="Nenhuma tarefa para hoje!" sub="Clique em '+ Nova Tarefa' para adicionar." />
            : todayTasks.map((t,i)=><Card key={t.id} t={t} i={i} S={S} onToggle={()=>toggleDone(t)} onEdit={()=>openEdit(t)} onDelete={()=>deleteTask(t.id)} />)
          }
        </>}

        {/* ── SEMANA ── */}
        {view==="semana" && <>
          <div style={S.section}>Agenda da Semana</div>
          <div style={S.sub}>{weekStart.toLocaleDateString("pt-BR",{day:"numeric",month:"short"})} – {addDays(weekStart,6).toLocaleDateString("pt-BR",{day:"numeric",month:"short",year:"numeric"})}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8,marginBottom:24}}>
            {weekDays.map((day,i)=>{
              const ds=fmtDate(day); const dt=weekTasks(ds);
              const isToday=ds===todayStr; const isPast=ds<todayStr;
              return (
                <div key={ds} style={S.dayCol(isToday)}>
                  <div style={S.dayLbl(isToday)}>{WDAYS[i]}</div>
                  <div style={S.dayNum(isToday,isPast)}>{day.getDate()}</div>
                  <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:3}}>
                    {dt.map(t=>(
                      <div key={t.id} style={{background:CATEGORIES[t.category].bg, color:CATEGORIES[t.category].color, border:`1px solid ${CATEGORIES[t.category].color}44`, borderRadius:5, padding:"3px 5px", fontSize:10, lineHeight:1.35}}>
                        {CATEGORIES[t.category].icon} {t.title}
                      </div>
                    ))}
                    {dt.length===0&&<div style={{fontSize:11,color:"#C5CAD8",textAlign:"center",marginTop:6}}>—</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {weekDays.map((day,i)=>{
            const ds=fmtDate(day); const dt=weekTasks(ds); if(!dt.length) return null;
            const isToday=ds===todayStr;
            return (
              <div key={ds} style={{marginBottom:18}}>
                <div style={{fontSize:12,fontWeight:700,color:isToday?BLUE:TEXT2,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px",display:"flex",alignItems:"center",gap:8}}>
                  {WFULL[i]}, {day.toLocaleDateString("pt-BR",{day:"numeric",month:"short"})}
                  {isToday&&<span style={{fontSize:10,background:BLUE_LIGHT,color:BLUE,borderRadius:4,padding:"2px 7px"}}>HOJE</span>}
                </div>
                {dt.map((t,i)=><Card key={t.id} t={t} i={i} S={S} compact onToggle={()=>toggleDone(t)} onEdit={()=>openEdit(t)} onDelete={()=>deleteTask(t.id)} />)}
              </div>
            );
          })}
        </>}

        {/* ── TAREFAS ── */}
        {view==="tarefas" && <>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <div style={S.section}>Todas as Tarefas</div>
            <div style={{display:"flex",gap:8}}>
              <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{...S.input,width:"auto",padding:"6px 10px"}}>
                <option value="all">Todas categorias</option>
                {Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
              <select value={filterPri} onChange={e=>setFilterPri(e.target.value)} style={{...S.input,width:"auto",padding:"6px 10px"}}>
                <option value="all">Todas prioridades</option>
                {Object.entries(PRIORITIES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:18}}>
            {Object.entries(CATEGORIES).map(([k,v])=>(
              <span key={k} style={S.pill(v.color,v.bg,filterCat===k)} onClick={()=>setFilterCat(filterCat===k?"all":k)}>
                {v.icon} {v.label}
              </span>
            ))}
          </div>
          {allFiltered.length===0
            ? <Empty icon="🔍" msg="Nenhuma tarefa encontrada." />
            : allFiltered.map((t,i)=><Card key={t.id} t={t} i={i} S={S} showDates onToggle={()=>toggleDone(t)} onEdit={()=>openEdit(t)} onDelete={()=>deleteTask(t.id)} />)
          }
          {done.length>0&&(
            <div style={{marginTop:24}}>
              <div style={{fontSize:12,fontWeight:600,color:TEXT2,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10,cursor:"pointer",display:"flex",alignItems:"center",gap:6}} onClick={()=>setShowDone(v=>!v)}>
                ✅ Concluídas ({done.length}) {showDone?"▲":"▼"}
              </div>
              {showDone&&done.map(t=>(
                <div key={t.id} style={{background:"#fff",border:`1px solid ${BORDER}`,borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,marginBottom:6,opacity:.55}}>
                  <span onClick={()=>toggleDone(t)} style={{...S.doneDot}}>✓</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,textDecoration:"line-through",color:TEXT2}}>{t.title}</div>
                    <div style={{fontSize:11,color:"#B0B8CC",marginTop:2}}>
                      {t.client&&<span style={{marginRight:10}}>👤 {t.client}</span>}
                      <span>Entrada: {ptDate(t.created_at)}</span>
                      {t.completed_at&&<span style={{marginLeft:10}}>Concluída: {ptDate(t.completed_at)}</span>}
                    </div>
                  </div>
                  <span onClick={()=>deleteTask(t.id)} style={{cursor:"pointer",color:"#C5CAD8",fontSize:13}}>✕</span>
                </div>
              ))}
            </div>
          )}
        </>}

        {/* ── MAPA ── */}
        {view==="mapa" && <>
          <div style={S.section}>Mapa de Prazos e Prioridades</div>
          <div style={S.sub}>Visão geral de todas as tarefas pendentes por categoria e urgência</div>
          {Object.entries(CATEGORIES).map(([k,v])=>{
            const cat = pending.filter(t=>t.category===k).sort((a,b)=>scoreTask(b)-scoreTask(a));
            if(!cat.length) return null;
            return (
              <div key={k} style={{background:"#fff",border:`2px solid ${v.color}33`,borderLeft:`4px solid ${v.color}`,borderRadius:10,padding:"14px 18px",marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,color:v.color,marginBottom:10}}>{v.icon} {v.label} <span style={{fontWeight:400,color:TEXT2,fontSize:12}}>({cat.length} tarefa{cat.length!==1?"s":""})</span></div>
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {cat.map(t=>{
                    const st=statusInfo(t); const pri=PRIORITIES[t.priority];
                    return (
                      <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:11,fontWeight:700,color:pri.color,minWidth:56}}>{pri.dot} {pri.label}</span>
                        <span style={{fontSize:13,color:TEXT,flex:1,minWidth:120}}>{t.title}</span>
                        {t.client&&<span style={{fontSize:11,color:TEXT2}}>👤 {t.client}</span>}
                        <span style={{fontSize:11,background:st.bg,color:st.color,borderRadius:5,padding:"2px 8px",fontWeight:600}}>{st.label}</span>
                        <span style={{fontSize:11,color:TEXT2}}>prazo {ptDate(t.due)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {pending.length===0&&<Empty icon="🎯" msg="Sem tarefas pendentes." sub="Você está em dia!" />}
        </>}
      </div>

      {/* MODAL */}
      {showForm&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div style={S.modal}>
            <div style={{fontWeight:700,fontSize:18,color:BLUE,marginBottom:20,borderBottom:`2px solid ${BLUE_LIGHT}`,paddingBottom:12}}>
              {editId?"✏️ Editar Tarefa":"✨ Nova Tarefa"}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:13}}>
              <div>
                <label style={S.label}>Título *</label>
                <input style={S.input} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Enviar DARF IRRF..." />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <label style={S.label}>Categoria</label>
                  <select style={S.input} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                    {Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Prioridade</label>
                  <select style={S.input} value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
                    {Object.entries(PRIORITIES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <label style={S.label}>Prazo (data limite)</label>
                  <input type="date" style={S.input} value={form.due} onChange={e=>setForm(f=>({...f,due:e.target.value}))} />
                </div>
                <div>
                  <label style={S.label}>Data de Entrada</label>
                  <input type="date" style={S.input} value={form.created_at} onChange={e=>setForm(f=>({...f,created_at:e.target.value}))} />
                </div>
              </div>
              <div>
                <label style={S.label}>Cliente</label>
                <input style={S.input} value={form.client} onChange={e=>setForm(f=>({...f,client:e.target.value}))} placeholder="Nome do cliente..." />
              </div>
              <div>
                <label style={S.label}>Observações</label>
                <textarea style={{...S.input,resize:"none"}} rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Detalhes adicionais..." />
              </div>
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button onClick={()=>setShowForm(false)} style={{flex:1,background:"#fff",border:`1px solid ${BORDER}`,color:TEXT2,borderRadius:8,padding:"10px",fontSize:13,fontFamily:"inherit",cursor:"pointer"}}>Cancelar</button>
                <button onClick={saveForm} disabled={saving} style={{flex:2,background:saving?"#90A4AE":BLUE,color:"#fff",border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:700,fontFamily:"inherit",cursor:saving?"not-allowed":"pointer"}}>
                  {saving?"Salvando...":editId?"Salvar alterações":"Criar tarefa"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ t, i, S, onToggle, onEdit, onDelete, compact, showDates }) {
  const cat = CATEGORIES[t.category];
  const pri = PRIORITIES[t.priority];
  const st  = statusInfo(t);
  return (
    <div className="tc" style={{...S.card, borderLeft:`4px solid ${cat.color}`}}>
      <span onClick={onToggle} style={S.circle(cat.color)} title="Marcar como concluída" />
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:compact?0:4}}>
          <span style={{fontSize:compact?13:14,fontWeight:600,color:"#1A2340"}}>{t.title}</span>
          <span style={S.badge(cat.color,cat.bg)}>{cat.icon} {cat.label}</span>
          <span style={S.badge(pri.color,pri.bg)}>{pri.dot} {pri.label}</span>
        </div>
        {!compact&&(
          <div style={{fontSize:11.5,color:"#5A6580",display:"flex",gap:14,flexWrap:"wrap",marginTop:2}}>
            {t.client&&<span>👤 {t.client}</span>}
            {t.notes&&<span>📝 {t.notes}</span>}
            {showDates&&<span>📅 Entrada: {t.created_at?t.created_at.split("-").reverse().join("/"):"—"}</span>}
          </div>
        )}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
        <span style={{fontSize:11,background:st.bg,color:st.color,borderRadius:5,padding:"3px 9px",fontWeight:600,whiteSpace:"nowrap"}}>{st.label}</span>
        <span onClick={onEdit} style={{cursor:"pointer",color:"#90A4AE",fontSize:13,padding:"2px 5px"}} title="Editar">✏️</span>
        <span onClick={onDelete} style={{cursor:"pointer",color:"#CFD8DC",fontSize:13,padding:"2px 5px"}} title="Excluir">✕</span>
      </div>
    </div>
  );
}

function Empty({ icon, msg, sub }) {
  return (
    <div style={{textAlign:"center",padding:"52px 0",color:"#B0B8CC"}}>
      <div style={{fontSize:38,marginBottom:10}}>{icon}</div>
      <div style={{fontWeight:600,fontSize:15,color:"#5A6580"}}>{msg}</div>
      {sub&&<div style={{fontSize:13,marginTop:4}}>{sub}</div>}
    </div>
  );
}

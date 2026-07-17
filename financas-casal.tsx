import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://cwcubpyrrlxueovnacgb.supabase.co",
  "sb_publishable_QBreakw-EbTsoZBeDx2kvQ_LmJwTS0B"
);

// ── Design tokens ──────────────────────────────────────────────
const T = {
  erick: "#2563EB",
  erickLight: "#DBEAFE",
  erickMid: "#93C5FD",
  bia: "#DB2777",
  biaLight: "#FCE7F3",
  biaMid: "#F9A8D4",
  income: "#059669",
  incomeLight: "#D1FAE5",
  expense: "#DC2626",
  expenseLight: "#FEE2E2",
  bg: "#F0F4FF",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  subtle: "#94A3B8",
};

const CATEGORIES = ["Moradia","Alimentação","Transporte","Saúde","Educação","Lazer","Roupas","Assinaturas","Investimento","Outros"];
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MONTHS_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const CAT_ICONS = {
  "Moradia":"🏠","Alimentação":"🛒","Transporte":"🚗","Saúde":"❤️‍🩹",
  "Educação":"📚","Lazer":"🎉","Roupas":"👗","Assinaturas":"📱",
  "Investimento":"📈","Outros":"📦"
};

function fmt(n) {
  return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n||0);
}
function today() { return new Date().toISOString().slice(0,10); }

// ── Reusable UI ────────────────────────────────────────────────
function OwnerDot({ owner, size = 8 }) {
  return <span style={{ display:"inline-block", width:size, height:size, borderRadius:"50%", background: owner==="Erick" ? T.erick : T.bia, flexShrink:0 }} />;
}

function OwnerBadge({ owner }) {
  const isE = owner === "Erick";
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      background: isE ? T.erickLight : T.biaLight,
      color: isE ? T.erick : T.bia,
      fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:99,
    }}>
      <OwnerDot owner={owner} size={6} />
      {owner}
    </span>
  );
}

function Pill({ label, active, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding:"8px 16px", border:"none", borderRadius:99,
      background: active ? color : "transparent",
      color: active ? "#fff" : T.muted,
      fontWeight: active ? 700 : 500, fontSize:13,
      cursor:"pointer", transition:"all 0.15s", whiteSpace:"nowrap",
    }}>{label}</button>
  );
}

function Card({ children, style={} }) {
  return (
    <div style={{
      background: T.surface, borderRadius:20,
      border:`1px solid ${T.border}`,
      boxShadow:"0 2px 8px rgba(15,23,42,0.06)",
      ...style
    }}>{children}</div>
  );
}

function Bar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100,(value/max)*100) : 0;
  return (
    <div style={{ background:"#F1F5F9", borderRadius:99, height:6, overflow:"hidden" }}>
      <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:99, transition:"width 0.5s ease" }} />
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:T.bg, flexDirection:"column", gap:12 }}>
      <div style={{ fontSize:40 }}>💑</div>
      <div style={{ color:T.muted, fontSize:14, fontWeight:500 }}>Carregando...</div>
    </div>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign:"center", padding:"40px 20px", color:T.muted }}>
      <div style={{ fontSize:36, marginBottom:10 }}>{icon}</div>
      <div style={{ fontWeight:700, fontSize:15, color:T.text, marginBottom:4 }}>{title}</div>
      <div style={{ fontSize:13 }}>{sub}</div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("dashboard");
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear] = useState(new Date().getFullYear());
  const [filterOwner, setFilterOwner] = useState("all");
  const [addGoalMode, setAddGoalMode] = useState(false);

  const [form, setForm] = useState({
    type:"expense", description:"", amount:"",
    category:"Alimentação", owner:"Erick", date:today(),
  });
  const [goalForm, setGoalForm] = useState({ name:"", target:"", owner:"Erick", saved:"0" });

  function showToast(msg, type="success") {
    setToast({msg,type});
    setTimeout(()=>setToast(null), 2800);
  }

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const [{ data: txs }, { data: gs }] = await Promise.all([
          supabase.from("transactions").select("*").order("date", { ascending: false }),
          supabase.from("goals").select("*").order("id", { ascending: true }),
        ]);
        setTransactions(txs || []);
        setGoals(gs || []);
      } catch(e) { showToast("Erro ao carregar dados","error"); }
      finally { setLoading(false); }
    })();
  }, []);

  // Realtime
  useEffect(() => {
    const chT = supabase.channel("transactions-rt")
      .on("postgres_changes",{ event:"*", schema:"public", table:"transactions" }, payload => {
        if(payload.eventType==="INSERT") setTransactions(p=>[payload.new,...p]);
        if(payload.eventType==="DELETE") setTransactions(p=>p.filter(t=>t.id!==payload.old.id));
        if(payload.eventType==="UPDATE") setTransactions(p=>p.map(t=>t.id===payload.new.id?payload.new:t));
      }).subscribe();
    const chG = supabase.channel("goals-rt")
      .on("postgres_changes",{ event:"*", schema:"public", table:"goals" }, payload => {
        if(payload.eventType==="INSERT") setGoals(p=>[...p,payload.new]);
        if(payload.eventType==="DELETE") setGoals(p=>p.filter(g=>g.id!==payload.old.id));
        if(payload.eventType==="UPDATE") setGoals(p=>p.map(g=>g.id===payload.new.id?payload.new:g));
      }).subscribe();
    return () => { supabase.removeChannel(chT); supabase.removeChannel(chG); };
  }, []);

  async function addTransaction() {
    if(!form.description.trim()||!form.amount) return;
    setSyncing(true);
    const { error } = await supabase.from("transactions").insert({
      type:form.type, description:form.description.trim(),
      amount:parseFloat(form.amount), category:form.category,
      owner:form.owner, date:form.date,
    });
    setSyncing(false);
    if(error) { showToast("Erro ao salvar","error"); return; }
    setForm({ type:"expense", description:"", amount:"", category:"Alimentação", owner:"Erick", date:today() });
    showToast(form.type==="income" ? "Receita adicionada! 💚" : "Despesa adicionada! 📝");
    setScreen("dashboard");
  }

  async function deleteTransaction(id) {
    await supabase.from("transactions").delete().eq("id",id);
    showToast("Removido","info");
  }

  async function addGoal() {
    if(!goalForm.name.trim()||!goalForm.target) return;
    setSyncing(true);
    const { error } = await supabase.from("goals").insert({
      name:goalForm.name.trim(), target:parseFloat(goalForm.target),
      saved:parseFloat(goalForm.saved||0), owner:goalForm.owner,
    });
    setSyncing(false);
    if(error) { showToast("Erro ao criar meta","error"); return; }
    setGoalForm({ name:"", target:"", owner:"Erick", saved:"0" });
    setAddGoalMode(false);
    showToast("Meta criada! 🎯");
  }

  async function updateGoalSaved(id, delta) {
    const g = goals.find(x=>x.id===id);
    if(!g) return;
    const newSaved = Math.max(0, Math.min(g.saved+delta, g.target));
    await supabase.from("goals").update({ saved:newSaved }).eq("id",id);
  }

  async function deleteGoal(id) {
    await supabase.from("goals").delete().eq("id",id);
    showToast("Meta removida","info");
  }

  // Stats
  const stats = useMemo(() => {
    const monthTx = transactions.filter(t => {
      const d = new Date(t.date+"T12:00:00");
      return d.getMonth()===filterMonth && d.getFullYear()===filterYear;
    });
    const calc = owner => {
      const mine = monthTx.filter(t=>t.owner===owner);
      const income = mine.filter(t=>t.type==="income").reduce((s,t)=>s+parseFloat(t.amount),0);
      const expense = mine.filter(t=>t.type==="expense").reduce((s,t)=>s+parseFloat(t.amount),0);
      return { income, expense, balance:income-expense };
    };
    const erick = calc("Erick"), bia = calc("Bia");
    const totalIncome = erick.income+bia.income;
    const totalExpense = erick.expense+bia.expense;
    const catMap = {};
    monthTx.filter(t=>t.type==="expense").forEach(t=>{
      catMap[t.category]=(catMap[t.category]||0)+parseFloat(t.amount);
    });
    const cats = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
    return { erick, bia, totalIncome, totalExpense, totalBalance:totalIncome-totalExpense, cats, monthTx };
  }, [transactions, filterMonth, filterYear]);

  const filteredHistory = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date+"T12:00:00");
      const mOk = d.getMonth()===filterMonth && d.getFullYear()===filterYear;
      const oOk = filterOwner==="all" || t.owner===filterOwner;
      return mOk && oOk;
    });
  }, [transactions, filterMonth, filterYear, filterOwner]);

  if(loading) return <Spinner />;

  return (
    <div style={{ maxWidth:430, margin:"0 auto", minHeight:"100vh", background:T.bg, fontFamily:"'Inter',sans-serif", paddingBottom:90 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position:"fixed", top:20, left:"50%", transform:"translateX(-50%)",
          background: toast.type==="error" ? T.expense : toast.type==="info" ? T.muted : "#0F172A",
          color:"#fff", padding:"12px 24px", borderRadius:99, fontSize:13,
          fontWeight:600, zIndex:999, boxShadow:"0 8px 24px rgba(0,0,0,0.2)",
          whiteSpace:"nowrap",
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{
        background:"#0F172A",
        padding:"52px 20px 20px",
      }}>
        {/* Month pills */}
        <div style={{ display:"flex", gap:4, overflowX:"auto", paddingBottom:16, scrollbarWidth:"none" }}>
          {MONTHS_SHORT.map((m,i) => (
            <button key={i} onClick={()=>setFilterMonth(i)} style={{
              padding:"5px 14px", border:"none", borderRadius:99, cursor:"pointer",
              background: filterMonth===i ? "#fff" : "rgba(255,255,255,0.08)",
              color: filterMonth===i ? "#0F172A" : "rgba(255,255,255,0.5)",
              fontSize:12, fontWeight: filterMonth===i ? 700 : 400,
              whiteSpace:"nowrap", transition:"all 0.15s",
            }}>{m}</button>
          ))}
        </div>

        {/* Title */}
        <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11, fontWeight:600, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>
          {screen==="dashboard" && "Visão Geral"}
          {screen==="add" && "Novo Lançamento"}
          {screen==="history" && "Histórico"}
          {screen==="goals" && "Metas do Casal"}
        </div>
        <div style={{ color:"#fff", fontSize:26, fontWeight:800, letterSpacing:-0.5 }}>
          {MONTHS[filterMonth]} {filterYear}
        </div>

        {/* Syncing indicator */}
        {syncing && (
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11, marginTop:4 }}>Sincronizando...</div>
        )}
      </div>

      {/* ── DASHBOARD ── */}
      {screen==="dashboard" && (
        <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>

          {/* Total card */}
          <Card style={{ padding:24, background:"linear-gradient(135deg,#1E40AF,#3730A3)", border:"none" }}>
            <div style={{ color:"rgba(255,255,255,0.6)", fontSize:12, fontWeight:600, letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>Saldo Total</div>
            <div style={{ color:"#fff", fontSize:36, fontWeight:800, letterSpacing:-1, marginBottom:16 }}>
              {fmt(stats.totalBalance)}
            </div>
            <div style={{ display:"flex", gap:24 }}>
              <div>
                <div style={{ color:"rgba(255,255,255,0.5)", fontSize:11, marginBottom:2 }}>Entradas</div>
                <div style={{ color:"#6EE7B7", fontSize:18, fontWeight:700 }}>{fmt(stats.totalIncome)}</div>
              </div>
              <div>
                <div style={{ color:"rgba(255,255,255,0.5)", fontSize:11, marginBottom:2 }}>Saídas</div>
                <div style={{ color:"#FCA5A5", fontSize:18, fontWeight:700 }}>{fmt(stats.totalExpense)}</div>
              </div>
            </div>
          </Card>

          {/* Person cards */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[
              { name:"Erick", data:stats.erick, c:T.erick, cl:T.erickLight },
              { name:"Bia", data:stats.bia, c:T.bia, cl:T.biaLight },
            ].map(({ name, data, c, cl }) => (
              <Card key={name} style={{ padding:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
                  <OwnerDot owner={name} size={8} />
                  <span style={{ fontSize:13, fontWeight:700, color:c }}>{name}</span>
                </div>
                <div style={{ fontSize:22, fontWeight:800, color:data.balance>=0?T.income:T.expense, letterSpacing:-0.5, marginBottom:8 }}>
                  {fmt(data.balance)}
                </div>
                <div style={{ fontSize:11, color:T.subtle }}>
                  <span style={{ color:T.income }}>↑</span> {fmt(data.income)}
                </div>
                <div style={{ fontSize:11, color:T.subtle }}>
                  <span style={{ color:T.expense }}>↓</span> {fmt(data.expense)}
                </div>
              </Card>
            ))}
          </div>

          {/* Categories */}
          {stats.cats.length>0 && (
            <Card style={{ padding:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:16 }}>Gastos por Categoria</div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {stats.cats.slice(0,6).map(([cat,val])=>(
                  <div key={cat}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:14 }}>{CAT_ICONS[cat]||"📦"}</span>
                        <span style={{ fontSize:12, color:T.muted, fontWeight:500 }}>{cat}</span>
                      </div>
                      <span style={{ fontSize:12, fontWeight:700, color:T.text }}>{fmt(val)}</span>
                    </div>
                    <Bar value={val} max={stats.totalExpense} color="#3730A3" />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recent */}
          <Card style={{ padding:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:T.text }}>Últimos lançamentos</div>
              <button onClick={()=>setScreen("history")} style={{
                fontSize:12, color:T.erick, background:"none", border:"none",
                cursor:"pointer", fontWeight:600, padding:0,
              }}>Ver todos →</button>
            </div>
            {stats.monthTx.length===0 ? (
              <EmptyState icon="💸" title="Nenhum lançamento" sub="Toque em + para adicionar" />
            ) : (
              <div>
                {stats.monthTx.slice(0,5).map((t,i)=>(
                  <div key={t.id} style={{
                    display:"flex", alignItems:"center", justifyContent:"space-between",
                    padding:"11px 0",
                    borderBottom: i<Math.min(stats.monthTx.length,5)-1 ? `1px solid ${T.border}` : "none",
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{
                        width:38, height:38, borderRadius:12, fontSize:16,
                        background: t.type==="income" ? T.incomeLight : T.expenseLight,
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>{CAT_ICONS[t.category]||"📦"}</div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{t.description}</div>
                        <div style={{ display:"flex", gap:5, alignItems:"center", marginTop:3 }}>
                          <OwnerBadge owner={t.owner} />
                          <span style={{ fontSize:11, color:T.subtle }}>{t.date.slice(5).replace("-","/")}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize:14, fontWeight:700, color:t.type==="income"?T.income:T.expense }}>
                      {t.type==="income"?"+":"-"}{fmt(t.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── ADD ── */}
      {screen==="add" && (
        <div style={{ padding:16 }}>
          <Card style={{ padding:20 }}>
            {/* Type */}
            <div style={{ display:"flex", background:"#F8FAFC", borderRadius:14, padding:4, marginBottom:20 }}>
              {[["expense","Despesa",T.expense],["income","Receita",T.income]].map(([v,l,c])=>(
                <button key={v} onClick={()=>setForm(f=>({...f,type:v}))} style={{
                  flex:1, padding:"10px 0", border:"none", borderRadius:10,
                  background:form.type===v?c:"transparent",
                  color:form.type===v?"#fff":T.muted,
                  fontWeight:700, fontSize:14, cursor:"pointer", transition:"all 0.15s",
                }}>{l}</button>
              ))}
            </div>

            {/* Owner */}
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:12, fontWeight:600, color:T.muted, marginBottom:8, letterSpacing:0.5 }}>RESPONSÁVEL</div>
              <div style={{ display:"flex", background:"#F8FAFC", borderRadius:14, padding:4 }}>
                {[["Erick",T.erick],["Bia",T.bia]].map(([v,c])=>(
                  <button key={v} onClick={()=>setForm(f=>({...f,owner:v}))} style={{
                    flex:1, padding:"10px 0", border:"none", borderRadius:10,
                    background:form.owner===v?c:"transparent",
                    color:form.owner===v?"#fff":T.muted,
                    fontWeight:700, fontSize:14, cursor:"pointer", transition:"all 0.15s",
                  }}>{v}</button>
                ))}
              </div>
            </div>

            {/* Fields */}
            {[
              { label:"DESCRIÇÃO", key:"description", type:"text", placeholder:"Ex: Conta de luz" },
              { label:"VALOR (R$)", key:"amount", type:"number", placeholder:"0,00" },
            ].map(({label,key,type,placeholder})=>(
              <div key={key} style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:T.muted, marginBottom:7, letterSpacing:0.5 }}>{label}</div>
                <input type={type} value={form[key]} placeholder={placeholder}
                  onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
                  style={{
                    width:"100%", padding:"13px 16px", border:`1.5px solid ${T.border}`,
                    borderRadius:12, fontSize:15, outline:"none", boxSizing:"border-box",
                    fontFamily:"inherit", color:T.text, background:"#FAFAFA",
                  }} />
              </div>
            ))}

            {/* Category */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:600, color:T.muted, marginBottom:7, letterSpacing:0.5 }}>CATEGORIA</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {CATEGORIES.map(c=>(
                  <button key={c} onClick={()=>setForm(f=>({...f,category:c}))} style={{
                    padding:"6px 12px", border:`1.5px solid ${form.category===c?"#3730A3":T.border}`,
                    borderRadius:99, background:form.category===c?"#EEF2FF":"#FAFAFA",
                    color:form.category===c?"#3730A3":T.muted,
                    fontSize:12, fontWeight:form.category===c?700:400, cursor:"pointer",
                    display:"flex", alignItems:"center", gap:4,
                  }}>
                    {CAT_ICONS[c]} {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:12, fontWeight:600, color:T.muted, marginBottom:7, letterSpacing:0.5 }}>DATA</div>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{
                width:"100%", padding:"13px 16px", border:`1.5px solid ${T.border}`,
                borderRadius:12, fontSize:14, outline:"none", boxSizing:"border-box",
                fontFamily:"inherit", color:T.text, background:"#FAFAFA",
              }} />
            </div>

            <button onClick={addTransaction} disabled={syncing} style={{
              width:"100%", padding:"15px", border:"none", borderRadius:14,
              background:form.type==="income"?T.income:T.expense,
              color:"#fff", fontSize:16, fontWeight:700, cursor:"pointer",
              opacity:syncing?0.7:1,
            }}>
              {syncing ? "Salvando..." : `Salvar ${form.type==="income"?"receita":"despesa"}`}
            </button>
          </Card>
        </div>
      )}

      {/* ── HISTORY ── */}
      {screen==="history" && (
        <div style={{ padding:16 }}>
          {/* Filter */}
          <div style={{ display:"flex", background:T.surface, borderRadius:14, padding:4, marginBottom:14, border:`1px solid ${T.border}` }}>
            {[["all","Todos"],["Erick","Erick"],["Bia","Bia"]].map(([v,l])=>(
              <Pill key={v} label={l} active={filterOwner===v} color={v==="Bia"?T.bia:v==="Erick"?T.erick:"#0F172A"} onClick={()=>setFilterOwner(v)} />
            ))}
          </div>

          {filteredHistory.length===0 ? (
            <Card style={{ padding:20 }}>
              <EmptyState icon="📋" title="Nenhum lançamento" sub="Sem dados para este período" />
            </Card>
          ) : (
            <Card style={{ padding:20 }}>
              {filteredHistory.map((t,i)=>(
                <div key={t.id} style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"12px 0",
                  borderBottom: i<filteredHistory.length-1 ? `1px solid ${T.border}` : "none",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{
                      width:40, height:40, borderRadius:12, fontSize:18,
                      background: t.type==="income" ? T.incomeLight : T.expenseLight,
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>{CAT_ICONS[t.category]||"📦"}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{t.description}</div>
                      <div style={{ display:"flex", gap:5, alignItems:"center", marginTop:3 }}>
                        <OwnerBadge owner={t.owner} />
                        <span style={{ fontSize:11, color:T.subtle }}>{t.date.slice(5).replace("-","/")}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:t.type==="income"?T.income:T.expense, textAlign:"right" }}>
                      {t.type==="income"?"+":"-"}{fmt(t.amount)}
                    </div>
                    <button onClick={()=>deleteTransaction(t.id)} style={{
                      width:28, height:28, borderRadius:8, border:"none",
                      background:T.expenseLight, color:T.expense,
                      fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                    }}>×</button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* ── GOALS ── */}
      {screen==="goals" && (
        <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
          {!addGoalMode ? (
            <button onClick={()=>setAddGoalMode(true)} style={{
              width:"100%", padding:16, border:`2px dashed ${T.erickMid}`,
              borderRadius:16, background:T.erickLight, color:T.erick,
              fontSize:14, fontWeight:700, cursor:"pointer",
            }}>+ Nova meta</button>
          ) : (
            <Card style={{ padding:20 }}>
              <div style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:16 }}>Nova Meta</div>
              {[
                { label:"NOME DA META", key:"name", type:"text", placeholder:"Ex: Viagem, Carro..." },
                { label:"VALOR ALVO (R$)", key:"target", type:"number", placeholder:"5000" },
                { label:"JÁ GUARDADO (R$)", key:"saved", type:"number", placeholder:"0" },
              ].map(({label,key,type,placeholder})=>(
                <div key={key} style={{ marginBottom:14 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:T.muted, marginBottom:6, letterSpacing:0.5 }}>{label}</div>
                  <input type={type} value={goalForm[key]} placeholder={placeholder}
                    onChange={e=>setGoalForm(f=>({...f,[key]:e.target.value}))}
                    style={{
                      width:"100%", padding:"12px 14px", border:`1.5px solid ${T.border}`,
                      borderRadius:12, fontSize:14, outline:"none", boxSizing:"border-box",
                      fontFamily:"inherit", color:T.text, background:"#FAFAFA",
                    }} />
                </div>
              ))}
              <div style={{ marginBottom:18 }}>
                <div style={{ fontSize:12, fontWeight:600, color:T.muted, marginBottom:8, letterSpacing:0.5 }}>RESPONSÁVEL</div>
                <div style={{ display:"flex", background:"#F8FAFC", borderRadius:14, padding:4 }}>
                  {[["Erick",T.erick],["Bia",T.bia]].map(([v,c])=>(
                    <button key={v} onClick={()=>setGoalForm(f=>({...f,owner:v}))} style={{
                      flex:1, padding:"10px 0", border:"none", borderRadius:10,
                      background:goalForm.owner===v?c:"transparent",
                      color:goalForm.owner===v?"#fff":T.muted,
                      fontWeight:700, fontSize:14, cursor:"pointer",
                    }}>{v}</button>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setAddGoalMode(false)} style={{
                  flex:1, padding:"12px", border:`1.5px solid ${T.border}`, borderRadius:12,
                  background:"#fff", color:T.muted, fontSize:14, fontWeight:600, cursor:"pointer",
                }}>Cancelar</button>
                <button onClick={addGoal} style={{
                  flex:2, padding:"12px", border:"none", borderRadius:12,
                  background:"#0F172A", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer",
                }}>Criar meta</button>
              </div>
            </Card>
          )}

          {goals.length===0 && !addGoalMode && (
            <Card style={{ padding:20 }}>
              <EmptyState icon="🎯" title="Nenhuma meta ainda" sub="Criem metas juntos e acompanhem o progresso!" />
            </Card>
          )}

          {goals.map(g=>{
            const pct = g.target>0 ? Math.min(100,(g.saved/g.target)*100) : 0;
            const c = g.owner==="Erick" ? T.erick : T.bia;
            const cl = g.owner==="Erick" ? T.erickLight : T.biaLight;
            return (
              <Card key={g.id} style={{ padding:20 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:16, fontWeight:800, color:T.text, marginBottom:4 }}>{g.name}</div>
                    <OwnerBadge owner={g.owner} />
                  </div>
                  <button onClick={()=>deleteGoal(g.id)} style={{
                    background:"#F8FAFC", border:`1px solid ${T.border}`, borderRadius:8,
                    width:30, height:30, cursor:"pointer", color:T.subtle, fontSize:14,
                  }}>×</button>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <span style={{ fontSize:13, color:T.muted }}>{fmt(g.saved)} guardado</span>
                  <span style={{ fontSize:14, fontWeight:800, color:c }}>{pct.toFixed(0)}%</span>
                </div>
                <Bar value={g.saved} max={g.target} color={c} />
                <div style={{ fontSize:12, color:T.subtle, marginTop:6, marginBottom:14 }}>
                  Meta: {fmt(g.target)} · Faltam {fmt(Math.max(0,g.target-g.saved))}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  {[50,100,500].map(v=>(
                    <button key={v} onClick={()=>updateGoalSaved(g.id,v)} style={{
                      flex:1, padding:"8px 0", border:`1.5px solid ${c}`, borderRadius:10,
                      background:cl, color:c, fontSize:12, fontWeight:700, cursor:"pointer",
                    }}>+{fmt(v)}</button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bottom nav */}
      <div style={{
        position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:430, background:T.surface,
        borderTop:`1px solid ${T.border}`,
        display:"flex", alignItems:"center", justifyContent:"space-around",
        padding:"10px 20px 28px", boxSizing:"border-box",
        boxShadow:"0 -4px 24px rgba(15,23,42,0.08)",
      }}>
        {[
          { id:"dashboard", icon:"📊", label:"Resumo" },
          { id:"history", icon:"📋", label:"Histórico" },
          { id:"add", icon:null },
          { id:"goals", icon:"🎯", label:"Metas" },
        ].map(item => {
          if(item.id==="add") return (
            <button key="add" onClick={()=>setScreen("add")} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}>
              <div style={{
                width:54, height:54, borderRadius:"50%",
                background:"linear-gradient(135deg,#1E40AF,#3730A3)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:28, color:"#fff",
                boxShadow:"0 6px 20px rgba(55,48,163,0.4)",
                marginTop:-20,
              }}>+</div>
            </button>
          );
          const active = screen===item.id;
          return (
            <button key={item.id} onClick={()=>setScreen(item.id)} style={{
              display:"flex", flexDirection:"column", alignItems:"center",
              background:"none", border:"none", cursor:"pointer", padding:"4px 12px", gap:3,
            }}>
              <span style={{ fontSize:22, filter:active?"none":"grayscale(100%) opacity(0.4)" }}>{item.icon}</span>
              <span style={{ fontSize:10, fontWeight:active?700:500, color:active?"#3730A3":T.subtle }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

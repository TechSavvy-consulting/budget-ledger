(async()=>{
  const parts=["1","2","3","4","5","6","7a","7b","7c","7d"];
  const KEY="budget-ledger-state-v4";
  const $=id=>document.getElementById(id);
  let normalizingDailyBars=false;
  let patchingRegister=false;
  const today=()=>new Date(new Date().getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
  const monthStart=value=>`${value}-01`;
  const monthEnd=value=>{const d=new Date(`${value}-01T12:00:00`);return new Date(d.getFullYear(),d.getMonth()+1,0,12).toISOString().slice(0,10)};

  function addCss(){
    if($("budget-ledger-runtime-css")) return;
    const style=document.createElement("style");
    style.id="budget-ledger-runtime-css";
    style.textContent=`
      .header-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.header-controls>select{width:auto;min-width:160px;max-width:230px;flex:0 0 auto}.header-controls .sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}.graphical-month-picker{position:relative;display:inline-flex;align-items:center;gap:8px;flex:0 0 auto}.month-display-button{min-height:42px;border:1px solid var(--line,#d9ded7);border-radius:6px;background:var(--surface-strong,#fff);color:var(--ink,#1d2523);padding:0 14px;font-weight:850}.month-popover{position:absolute;right:0;top:calc(100% + 8px);z-index:30;width:min(330px,calc(100vw - 28px));border:1px solid var(--line,#d9ded7);border-radius:8px;background:var(--surface,#fffdf8);box-shadow:0 16px 40px rgba(34,42,38,.16);padding:12px}.month-popover[hidden]{display:none}.month-popover-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.month-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.month-cell{min-height:42px;border:1px solid var(--line,#d9ded7);border-radius:6px;background:var(--surface-strong,#fff);color:var(--teal-dark,#0b5f58);font-weight:850}.month-cell.is-active{background:var(--teal,#0f8b7d);color:#fff;border-color:var(--teal,#0f8b7d)}.month-nav-button{min-height:36px;border:1px solid var(--line,#d9ded7);border-radius:6px;background:transparent;color:var(--teal-dark,#0b5f58);padding:0 10px;font-weight:850}.dashboard-stack{display:grid!important;align-content:start!important;gap:16px!important}.home-layout,.report-analysis-layout,.accounts-working-layout{align-items:start!important}.bar-chart{display:grid!important;align-items:end!important;gap:6px!important;height:188px!important;min-height:188px!important;padding:10px 0 24px!important;overflow:hidden!important;border-bottom:1px solid var(--line,#d9ded7)!important}.bar-chart .bar{align-self:end!important;display:block!important;width:100%!important;min-height:4px!important;max-height:154px!important;border-radius:4px 4px 0 0!important;background:linear-gradient(180deg,var(--coral,#d95f43),#f2aa62)!important;position:relative!important}.bar-chart .bar span{position:absolute!important;left:50%!important;bottom:-20px!important;transform:translateX(-50%)!important;color:var(--muted,#69736f)!important;font-size:.68rem!important;white-space:nowrap!important;line-height:1!important}.register-filters{display:grid;grid-template-columns:repeat(2,minmax(130px,1fr)) auto;gap:10px;align-items:end;margin-bottom:12px}.inline-check{display:inline-flex;align-items:center;gap:6px;min-height:30px;white-space:nowrap}.inline-check input{width:16px;min-height:16px}.inline-check span{margin:0;color:var(--muted,#69736f);font-size:.78rem;font-weight:800;text-transform:none}.reconcile-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.reconcile-summary>div{border:1px solid var(--line,#d9ded7);border-radius:8px;background:var(--surface-strong,#fff);padding:12px}.reconcile-summary span{display:block;margin-bottom:6px;color:var(--muted,#69736f);font-size:.72rem;font-weight:800;text-transform:uppercase}.reconcile-summary strong{font-size:1.05rem}.help-text{margin:0;color:var(--muted,#69736f);font-size:.86rem}.quiet-pill.is-good{border-color:rgba(47,143,70,.35);color:var(--green,#2f8f46)}.quiet-pill.is-alert{border-color:rgba(217,95,67,.35);color:var(--coral,#d95f43)}.modal{width:min(920px,calc(100vw - 28px));border:1px solid var(--line,#d9ded7);border-radius:8px;background:var(--surface,#fffdf8);color:var(--ink,#1d2523);box-shadow:0 16px 40px rgba(34,42,38,.16);padding:0}.modal::backdrop{background:rgba(23,32,27,.42)}.modal-content{display:grid;gap:16px;padding:18px}@media(max-width:980px){.home-layout,.report-analysis-layout,.accounts-working-layout{grid-template-columns:1fr!important}}@media(max-width:640px){.header-controls{align-items:stretch}.header-controls>*{flex:1 1 140px}.graphical-month-picker{width:100%}.month-display-button{width:100%}.month-popover{left:0;right:auto}.bar-chart{gap:3px!important}.register-filters,.reconcile-summary{grid-template-columns:1fr!important}}
    `;
    document.head.appendChild(style);
  }

  function section(title, body){const s=document.createElement("section");s.className="tool-panel";s.innerHTML=body?`<div class="section-heading"><h2>${title}</h2></div>${body}`:`<div class="section-heading"><h2>${title}</h2></div>`;return s;}
  function ensureStack(parent, cls){let node=parent.querySelector(`.${cls}`);if(!node){node=document.createElement("div");node.className=`dashboard-stack ${cls}`;parent.appendChild(node)}return node;}
  function ensureReportLayout(){const reports=$("reports");if(!reports)return null;let layout=reports.querySelector(".report-analysis-layout");if(!layout){layout=document.createElement("div");layout.className="analysis-grid report-analysis-layout";const first=reports.querySelector(".analysis-grid")||reports.lastElementChild;reports.insertBefore(layout,first)}return layout;}

  function patchDashboardLayout(){
    const dashboard=$("dashboard"), quick=$("quickTransactionForm")?.closest(".tool-panel"), budget=$("budgetProgress")?.closest(".tool-panel"), chart=$("dailyBars")?.closest(".tool-panel");
    if(!dashboard||!quick||!budget||!chart)return;
    quick.querySelector("h2")&&(quick.querySelector("h2").textContent="Quick Add");
    budget.querySelector("h2")&&(budget.querySelector("h2").textContent="Budget Categories");
    let layout=dashboard.querySelector(".dashboard-layout")||document.createElement("div");layout.classList.add("dashboard-layout","home-layout");dashboard.prepend(layout);
    const left=ensureStack(layout,"home-left-stack"), right=ensureStack(layout,"home-right-stack");
    left.appendChild(quick);right.appendChild(budget);
    dashboard.querySelectorAll("#homeAccountList,#homeUpcomingList").forEach(n=>n.closest(".tool-panel")?.remove());
    const reportsLayout=ensureReportLayout(), reportLeft=reportsLayout&&ensureStack(reportsLayout,"report-left-stack");
    if(reportLeft){chart.querySelector("h2")&&(chart.querySelector("h2").textContent="Daily Expense Flow");reportLeft.prepend(chart)}
  }

  function patchReportsLayout(){
    const layout=ensureReportLayout();if(!layout)return;
    const left=ensureStack(layout,"report-left-stack");
    const categories=$("reportCategories")?.closest(".tool-panel"), accounts=$("reportAccounts")?.closest(".tool-panel"), upcoming=$("reportUpcoming")?.closest(".tool-panel"), budgets=$("reportBudgets")?.closest(".tool-panel");
    [categories,accounts,upcoming].filter(Boolean).forEach(n=>left.appendChild(n));
    if(budgets)layout.appendChild(budgets);
    $("reports")?.querySelectorAll(".analysis-grid").forEach(g=>{if(g!==layout&&!g.children.length)g.remove()});
  }

  function patchAccountsLayout(){
    const accountsView=$("accounts"), accountForm=$("accountForm")?.closest(".tool-panel"), accountList=$("accountList")?.closest(".tool-panel"), register=$("registerRows")?.closest(".tool-panel"), reconcileForm=$("reconcileForm");
    if(!accountsView||!accountForm||!accountList||!register||!reconcileForm)return;
    let layout=accountsView.querySelector(".accounts-working-layout");
    if(!layout){layout=document.createElement("div");layout.className="dashboard-layout accounts-working-layout";const band=accountsView.querySelector(".net-worth-band");band?.insertAdjacentElement("afterend",layout)}
    const left=ensureStack(layout,"accounts-left-stack"), right=ensureStack(layout,"accounts-right-stack");
    left.appendChild(accountForm);right.appendChild(accountList);right.appendChild(register);
    let reconcilePanel=$("reconcilePanel");
    if(!reconcilePanel){reconcilePanel=section("Reconcile",`<form id="reconcileFormWrap" class="form-grid reconciliation-form"></form>`);reconcilePanel.id="reconcilePanel";left.appendChild(reconcilePanel)}
    const wrap=$("reconcileFormWrap");
    reconcilePanel.querySelector(".section-heading").innerHTML='<h2>Reconcile</h2><span id="reconcileStatus" class="quiet-pill">$0 difference</span>';
    wrap.innerHTML="";wrap.appendChild(reconcileForm);
    reconcileForm.classList.add("form-grid");
    if(!$("reconcileClearedBalance")){
      const summary=document.createElement("div");summary.className="reconcile-summary wide";summary.innerHTML='<div><span>Bank-cleared balance</span><strong id="reconcileClearedBalance">$0.00</strong></div><div><span>Outstanding before date</span><strong id="reconcileOutstanding">$0.00</strong></div>';
      reconcileForm.appendChild(summary);
      const help=document.createElement("p");help.id="reconcileHelp";help.className="help-text wide";help.textContent="Check transactions that appear in your bank, enter the statement balance, then reconcile when the difference is $0.00.";reconcileForm.appendChild(help);
    }
    const actions=reconcileForm.querySelector(".form-actions");if(actions){actions.classList.add("wide");actions.querySelector("#reconcileStatus")?.remove()}
    let filters=register.querySelector(".register-filters");
    if(!filters){filters=document.createElement("div");filters.className="register-filters";filters.innerHTML='<label><span>From</span><input id="registerStartDate" type="date"></label><label><span>To</span><input id="registerEndDate" type="date"></label><button id="registerThisMonthBtn" class="ghost-button" type="button">This Month</button>';register.querySelector(".table-wrap")?.before(filters)}
    const header=register.querySelector("thead tr");if(header)header.innerHTML='<th>Date</th><th>Description</th><th>In Bank</th><th>Reconciled</th><th class="numeric">Change</th><th class="numeric">Running</th>';
  }

  function patchDom(){
    addCss();
    const controls=document.querySelector(".header-controls,.topbar-actions")||document.querySelector("header")||document.body;
    if(!$("periodLabelBtn")){
      const wrap=document.createElement("div");wrap.className="month-picker graphical-month-picker";wrap.innerHTML='<button id="periodLabelBtn" class="month-display-button" type="button" aria-haspopup="dialog" aria-expanded="false"><span id="periodPickerLabel">Select Month</span></button><div id="monthPickerPanel" class="month-popover" hidden><div class="month-popover-header"><button id="pickerPrevYearBtn" class="month-nav-button" type="button">Prev</button><strong id="pickerYearLabel"></strong><button id="pickerNextYearBtn" class="month-nav-button" type="button">Next</button></div><div id="pickerMonthGrid" class="month-grid"></div></div>';controls.insertBefore(wrap,$("monthFilter")||$("monthSelect")||controls.firstChild);
    }
    ["monthFilter","monthSelect","yearInput"].forEach(id=>$(id)?.classList.add("sr-only"));
    if(!$("undoBtn")){const undo=document.createElement("button");undo.id="undoBtn";undo.className="ghost-button";undo.type="button";undo.textContent="Undo";controls.appendChild(undo)}
    if(!$("redoBtn")){const redo=document.createElement("button");redo.id="redoBtn";redo.className="ghost-button";redo.type="button";redo.textContent="Redo";controls.appendChild(redo)}
    const txnAdd=$("transactionAddBtn");if(txnAdd&&!$("recurringAddBtn")){const add=document.createElement("button");add.id="recurringAddBtn";add.className="ghost-button";add.type="button";add.textContent="Add Recurring";const view=document.createElement("button");view.id="viewRecurringBtn";view.className="ghost-button";view.type="button";view.textContent="View Recurring";txnAdd.insertAdjacentElement("afterend",view);txnAdd.insertAdjacentElement("afterend",add)}
    const form=$("recurringForm");if(form&&!$("recurringDialog")){const dlg=document.createElement("dialog");dlg.id="recurringDialog";dlg.className="modal";dlg.innerHTML='<div class="modal-content"><div class="section-heading wide"><h2 id="recurringDialogTitle">Add Recurring Transaction</h2><button id="closeRecurringDialog" class="ghost-button" type="button">Close</button></div></div>';document.body.appendChild(dlg);dlg.querySelector(".modal-content").appendChild(form)}
    patchDashboardLayout();patchReportsLayout();patchAccountsLayout();
  }

  function getState(){try{return JSON.parse(localStorage.getItem(KEY)||"null")}catch{return null}}
  function putState(s){localStorage.setItem(KEY,JSON.stringify(s));fetch("/api/state",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)}).catch(()=>{})}
  function activeLedger(s){const bid=$("activeBookSelect")?.value||s?.activeBookId;return s?.ledgers?.[bid]}
  function activeAccount(s,l){const id=$("registerAccountSelect")?.value||s?.activeRegisterAccountId;return l?.accounts?.find(a=>a.id===id)}
  function money(v){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(+v||0)}
  function fmt(d){return d?new Date(`${d}T12:00:00`).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):""}
  function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
  function delta(t,id){const amt=+t.amount||0;if(t.type==="income")return t.accountId===id?amt:0;if(t.type==="expense")return t.accountId===id?-amt:0;if(t.type==="transfer")return t.toAccountId===id?amt:t.accountId===id?-amt:0;return 0}
  function accountTxns(l,a){return (l?.transactions||[]).filter(t=>t.accountId===a.id||t.toAccountId===a.id)}
  function reconcileMath(s,l,a){const date=$("statementDate")?.value||today(),statement=+($("statementBalance")?.value||0),txns=accountTxns(l,a);const cleared=(+a.openingBalance||0)+txns.filter(t=>t.date<=date&&(t.cleared||t.reconciled)).reduce((n,t)=>n+delta(t,a.id),0);const outstanding=txns.filter(t=>t.date<=date&&!t.cleared&&!t.reconciled).reduce((n,t)=>n+delta(t,a.id),0);return{date,statement,cleared,outstanding,difference:statement-cleared}}

  function renderPatchedRegister(){
    if(patchingRegister)return;const s=getState(),l=activeLedger(s),a=activeAccount(s,l),rowsEl=$("registerRows");if(!s||!l||!a||!rowsEl)return;patchingRegister=true;
    const currentMonth=s.currentMonth||today().slice(0,7);s.registerStartDate=s.registerStartDate||monthStart(currentMonth);s.registerEndDate=s.registerEndDate||monthEnd(currentMonth);
    if($("registerStartDate"))$("registerStartDate").value=s.registerStartDate;if($("registerEndDate"))$("registerEndDate").value=s.registerEndDate;
    if($("statementDate")&&!$("statementDate").value)$("statementDate").value=a.statementDate||today();if($("statementBalance")&&!$("statementBalance").value&&a.statementBalance)$("statementBalance").value=a.statementBalance;
    let run=+a.openingBalance||0;const start=s.registerStartDate,end=s.registerEndDate,rows=[{opening:true,description:start?`Balance before ${fmt(start)}`:"Opening balance",delta:run,running:run}];
    accountTxns(l,a).sort((x,y)=>x.date.localeCompare(y.date)).forEach(t=>{const d=delta(t,a.id);if(!d)return;run+=d;if((!start||t.date>=start)&&(!end||t.date<=end))rows.push({t,date:t.date,description:t.description,delta:d,running:run})});
    rowsEl.innerHTML=rows.map(r=>r.opening?`<tr><td></td><td>${esc(r.description)}</td><td></td><td></td><td class="numeric amount ${r.delta>=0?"income":"expense"}">${money(r.delta)}</td><td class="numeric">${money(r.running)}</td></tr>`:`<tr><td>${fmt(r.date)}</td><td><strong>${esc(r.t.payee||r.description)}</strong><div class="item-meta">${esc(r.description)}</div></td><td><label class="inline-check"><input type="checkbox" ${r.t.cleared||r.t.reconciled?"checked":""} ${r.t.reconciled?"disabled":""} onchange="patchedToggleCleared('${r.t.id}',this.checked)"><span>Seen</span></label></td><td><label class="inline-check"><input type="checkbox" ${r.t.reconciled?"checked":""} disabled><span>Locked</span></label></td><td class="numeric amount ${r.delta>=0?"income":"expense"}">${money(r.delta)}</td><td class="numeric">${money(r.running)}</td></tr>`).join("");
    if($("registerBalance"))$("registerBalance").textContent=`${money((+a.openingBalance||0)+accountTxns(l,a).reduce((n,t)=>n+delta(t,a.id),0))} balance`;
    renderPatchedReconcile();patchingRegister=false;
  }

  function renderPatchedReconcile(){const s=getState(),l=activeLedger(s),a=activeAccount(s,l);if(!s||!l||!a)return;const m=reconcileMath(s,l,a);if($("reconcileClearedBalance"))$("reconcileClearedBalance").textContent=money(m.cleared);if($("reconcileOutstanding"))$("reconcileOutstanding").textContent=money(m.outstanding);const pill=$("reconcileStatus");if(pill){pill.textContent=`${money(m.difference)} difference`;pill.classList.toggle("is-good",Math.abs(m.difference)<.01);pill.classList.toggle("is-alert",Math.abs(m.difference)>=.01)}}

  function installRegisterPatch(){
    patchDom();renderPatchedRegister();
    if($("registerStartDate"))$("registerStartDate").onchange=()=>{const s=getState();if(!s)return;s.registerStartDate=$("registerStartDate").value||monthStart(s.currentMonth||today().slice(0,7));putState(s);renderPatchedRegister()};
    if($("registerEndDate"))$("registerEndDate").onchange=()=>{const s=getState();if(!s)return;s.registerEndDate=$("registerEndDate").value||monthEnd(s.currentMonth||today().slice(0,7));putState(s);renderPatchedRegister()};
    if($("registerThisMonthBtn"))$("registerThisMonthBtn").onclick=()=>{const s=getState();if(!s)return;const m=s.currentMonth||today().slice(0,7);s.registerStartDate=monthStart(m);s.registerEndDate=monthEnd(m);putState(s);renderPatchedRegister()};
    if($("statementDate"))$("statementDate").oninput=renderPatchedReconcile;if($("statementBalance"))$("statementBalance").oninput=renderPatchedReconcile;
    if($("reconcileForm"))$("reconcileForm").onsubmit=e=>{e.preventDefault();const s=getState(),l=activeLedger(s),a=activeAccount(s,l);if(!s||!l||!a)return;const m=reconcileMath(s,l,a);if(Math.abs(m.difference)>=.01){alert("Difference must be $0.00 before reconciling.");return}a.statementDate=m.date;a.statementBalance=m.statement;accountTxns(l,a).forEach(t=>{if(t.date<=a.statementDate&&(t.cleared||t.reconciled))t.reconciled=true});putState(s);renderPatchedRegister()};
    window.patchedToggleCleared=(id,checked)=>{const s=getState(),l=activeLedger(s);if(!s||!l)return;const t=(l.transactions||[]).find(x=>x.id===id);if(!t||t.reconciled)return;t.cleared=checked;putState(s);renderPatchedRegister()};
    ["registerRows","accountList","registerAccountSelect","activeBookSelect"].forEach(id=>{const n=$(id);if(n&&!n.dataset.patchWatch){n.dataset.patchWatch="1";new MutationObserver(()=>setTimeout(renderPatchedRegister,0)).observe(n,{childList:true,subtree:true,attributes:true})}});
  }

  function normalizeDailyBars(){const chart=$("dailyBars");if(!chart||normalizingDailyBars)return;normalizingDailyBars=true;chart.querySelectorAll(".bar").forEach(bar=>{const raw=bar.style.height||"";if(raw.endsWith("%")){const pct=Math.max(2,Math.min(100,parseFloat(raw)||0));bar.style.height=`${Math.max(4,Math.round(pct*1.5))}px`}});normalizingDailyBars=false}
  function watchDailyBars(){const chart=$("dailyBars");if(!chart||chart.dataset.normalizedBars==="1")return;chart.dataset.normalizedBars="1";normalizeDailyBars();new MutationObserver(normalizeDailyBars).observe(chart,{childList:true,subtree:true,attributes:true,attributeFilter:["style"]})}
  function fail(err){console.error(err);document.body.innerHTML='<main class="app-shell"><section class="tool-panel"><h1>Budget Ledger</h1><p>App failed to load. Check the deployment bundle files.</p></section></main>'}

  try{
    if(document.readyState==="loading")await new Promise(resolve=>document.addEventListener("DOMContentLoaded",resolve,{once:true}));
    patchDom();
    const text=await Promise.all(parts.map(async name=>{const response=await fetch(`/app.b64.${name}.txt`,{cache:"no-store"});if(!response.ok)throw new Error(`Missing app bundle part ${name}`);return response.text()}));
    let b64=text.join("").replace(/\s+/g,"");if(b64[35535]==="[")b64=b64.slice(0,35535)+"b"+b64.slice(35536);
    const binary=atob(b64),bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));let code=new TextDecoder().decode(bytes),movedInit=false;code=code.replace("m();const ze=",()=>{movedInit=true;return "const ze="});
    (0,eval)(code+(movedInit?"\n;m();":"")+"\n//# sourceURL=budget-ledger.bundle.js");
    patchDom();watchDailyBars();installRegisterPatch();setTimeout(installRegisterPatch,800);
  }catch(err){fail(err)}
})();
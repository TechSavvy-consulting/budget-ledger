(async()=>{
  const parts=["1","2","3","4","5","6","7a","7b","7c","7d"];
  const $=id=>document.getElementById(id);
  let normalizingDailyBars=false;

  function addCss(){
    if($("budget-ledger-runtime-css")) return;
    const style=document.createElement("style");
    style.id="budget-ledger-runtime-css";
    style.textContent=`
      .header-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.header-controls>select{width:auto;min-width:160px;max-width:230px;flex:0 0 auto}.header-controls .sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}.graphical-month-picker{position:relative;display:inline-flex;align-items:center;gap:8px;flex:0 0 auto}.month-display-button{min-height:42px;border:1px solid var(--line,#d9ded7);border-radius:6px;background:var(--surface-strong,#fff);color:var(--ink,#1d2523);padding:0 14px;font-weight:850}.month-popover{position:absolute;right:0;top:calc(100% + 8px);z-index:30;width:min(330px,calc(100vw - 28px));border:1px solid var(--line,#d9ded7);border-radius:8px;background:var(--surface,#fffdf8);box-shadow:0 16px 40px rgba(34,42,38,.16);padding:12px}.month-popover[hidden]{display:none}.month-popover-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.month-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.month-cell{min-height:42px;border:1px solid var(--line,#d9ded7);border-radius:6px;background:var(--surface-strong,#fff);color:var(--teal-dark,#0b5f58);font-weight:850}.month-cell.is-active{background:var(--teal,#0f8b7d);color:#fff;border-color:var(--teal,#0f8b7d)}.month-nav-button{min-height:36px;border:1px solid var(--line,#d9ded7);border-radius:6px;background:transparent;color:var(--teal-dark,#0b5f58);padding:0 10px;font-weight:850}.bar-chart{display:grid!important;align-items:end!important;gap:6px!important;height:188px!important;min-height:188px!important;padding:10px 0 24px!important;overflow:hidden!important;border-bottom:1px solid var(--line,#d9ded7)!important}.bar-chart .bar{align-self:end!important;display:block!important;width:100%!important;min-height:4px!important;max-height:154px!important;border-radius:4px 4px 0 0!important;background:linear-gradient(180deg,var(--coral,#d95f43),#f2aa62)!important;position:relative!important}.bar-chart .bar span{position:absolute!important;left:50%!important;bottom:-20px!important;transform:translateX(-50%)!important;color:var(--muted,#69736f)!important;font-size:.68rem!important;white-space:nowrap!important;line-height:1!important}.modal{width:min(920px,calc(100vw - 28px));border:1px solid var(--line,#d9ded7);border-radius:8px;background:var(--surface,#fffdf8);color:var(--ink,#1d2523);box-shadow:0 16px 40px rgba(34,42,38,.16);padding:0}.modal::backdrop{background:rgba(23,32,27,.42)}.modal-content{display:grid;gap:16px;padding:18px}@media(max-width:640px){.header-controls{align-items:stretch}.header-controls>*{flex:1 1 140px}.graphical-month-picker{width:100%}.month-display-button{width:100%}.month-popover{left:0;right:auto}.bar-chart{gap:3px!important}}
    `;
    document.head.appendChild(style);
  }

  function patchDom(){
    addCss();
    const controls=document.querySelector(".header-controls,.topbar-actions")||document.querySelector("header")||document.body;
    if(!$("periodLabelBtn")){
      const wrap=document.createElement("div");
      wrap.className="month-picker graphical-month-picker";
      wrap.innerHTML='<button id="periodLabelBtn" class="month-display-button" type="button" aria-haspopup="dialog" aria-expanded="false"><span id="periodPickerLabel">Select Month</span></button><div id="monthPickerPanel" class="month-popover" hidden><div class="month-popover-header"><button id="pickerPrevYearBtn" class="month-nav-button" type="button">Prev</button><strong id="pickerYearLabel"></strong><button id="pickerNextYearBtn" class="month-nav-button" type="button">Next</button></div><div id="pickerMonthGrid" class="month-grid"></div></div>';
      controls.insertBefore(wrap,$("monthFilter")||$("monthSelect")||controls.firstChild);
    }
    ["monthFilter","monthSelect","yearInput"].forEach(id=>$(id)?.classList.add("sr-only"));
    if(!$("undoBtn")){
      const undo=document.createElement("button"); undo.id="undoBtn"; undo.className="ghost-button"; undo.type="button"; undo.textContent="Undo"; controls.appendChild(undo);
    }
    if(!$("redoBtn")){
      const redo=document.createElement("button"); redo.id="redoBtn"; redo.className="ghost-button"; redo.type="button"; redo.textContent="Redo"; controls.appendChild(redo);
    }
    const txnAdd=$("transactionAddBtn");
    if(txnAdd && !$("recurringAddBtn")){
      const add=document.createElement("button"); add.id="recurringAddBtn"; add.className="ghost-button"; add.type="button"; add.textContent="Add Recurring";
      const view=document.createElement("button"); view.id="viewRecurringBtn"; view.className="ghost-button"; view.type="button"; view.textContent="View Recurring";
      txnAdd.insertAdjacentElement("afterend",view); txnAdd.insertAdjacentElement("afterend",add);
    }
    const form=$("recurringForm");
    if(form && !$("recurringDialog")){
      const dlg=document.createElement("dialog"); dlg.id="recurringDialog"; dlg.className="modal";
      dlg.innerHTML='<div class="modal-content"><div class="section-heading wide"><h2 id="recurringDialogTitle">Add Recurring Transaction</h2><button id="closeRecurringDialog" class="ghost-button" type="button">Close</button></div></div>';
      document.body.appendChild(dlg);
      dlg.querySelector(".modal-content").appendChild(form);
    }
  }

  function normalizeDailyBars(){
    const chart=$("dailyBars");
    if(!chart||normalizingDailyBars) return;
    normalizingDailyBars=true;
    chart.querySelectorAll(".bar").forEach(bar=>{
      const raw=bar.style.height||"";
      if(raw.endsWith("%")){
        const pct=Math.max(2,Math.min(100,parseFloat(raw)||0));
        bar.style.height=`${Math.max(4,Math.round(pct*1.5))}px`;
      }
    });
    normalizingDailyBars=false;
  }

  function watchDailyBars(){
    const chart=$("dailyBars");
    if(!chart||chart.dataset.normalizedBars==="1") return;
    chart.dataset.normalizedBars="1";
    normalizeDailyBars();
    new MutationObserver(normalizeDailyBars).observe(chart,{childList:true,subtree:true,attributes:true,attributeFilter:["style"]});
  }

  function fail(err){
    console.error(err);
    document.body.innerHTML='<main class="app-shell"><section class="tool-panel"><h1>Budget Ledger</h1><p>App failed to load. Check the deployment bundle files.</p></section></main>';
  }

  try{
    if(document.readyState==="loading") await new Promise(resolve=>document.addEventListener("DOMContentLoaded",resolve,{once:true}));
    patchDom();
    const text=await Promise.all(parts.map(async name=>{
      const response=await fetch(`/app.b64.${name}.txt`,{cache:"no-store"});
      if(!response.ok) throw new Error(`Missing app bundle part ${name}`);
      return response.text();
    }));
    let b64=text.join("").replace(/\s+/g,"");
    if(b64[35535]==="[") b64=b64.slice(0,35535)+"b"+b64.slice(35536);
    const binary=atob(b64);
    const bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));
    let code=new TextDecoder().decode(bytes);
    let movedInit=false;
    code=code.replace("m();const ze=",()=>{movedInit=true;return "const ze="});
    (0,eval)(code+(movedInit?"\n;m();":"")+"\n//# sourceURL=budget-ledger.bundle.js");
    watchDailyBars();
  }catch(err){fail(err)}
})();
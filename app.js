const STORAGE_KEY = "budget-ledger-state-v3";
const LEGACY_KEYS = ["budget-ledger-state-v1"];
const HISTORY_LIMIT = 3;

const today = toDateInput(new Date());
const currentMonth = today.slice(0, 7);

let state = loadState();
let undoStack = [];
let redoStack = [];
let toastTimer;

const els = {
  activeUserSelect: document.querySelector("#activeUserSelect"),
  activeBookSelect: document.querySelector("#activeBookSelect"),
  periodButtons: document.querySelectorAll(".period-button"),
  monthFilter: document.querySelector("#monthFilter"),
  monthSelect: document.querySelector("#monthSelect"),
  yearInput: document.querySelector("#yearInput"),
  prevMonthBtn: document.querySelector("#prevMonthBtn"),
  nextMonthBtn: document.querySelector("#nextMonthBtn"),
  todayMonthBtn: document.querySelector("#todayMonthBtn"),
  addTransactionBtn: document.querySelector("#addTransactionBtn"),
  transactionAddBtn: document.querySelector("#transactionAddBtn"),
  undoBtn: document.querySelector("#undoBtn"),
  redoBtn: document.querySelector("#redoBtn"),
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  incomeTotal: document.querySelector("#incomeTotal"),
  expenseTotal: document.querySelector("#expenseTotal"),
  remainderTotal: document.querySelector("#remainderTotal"),
  aumTotal: document.querySelector("#aumTotal"),
  quickTransactionForm: document.querySelector("#quickTransactionForm"),
  quickClearBtn: document.querySelector("#quickClearBtn"),
  quickDate: document.querySelector("#quickDate"),
  quickType: document.querySelector("#quickType"),
  quickCategory: document.querySelector("#quickCategory"),
  quickAmount: document.querySelector("#quickAmount"),
  quickDescription: document.querySelector("#quickDescription"),
  budgetProgress: document.querySelector("#budgetProgress"),
  dailyAverage: document.querySelector("#dailyAverage"),
  dailyBars: document.querySelector("#dailyBars"),
  searchTransactions: document.querySelector("#searchTransactions"),
  filterType: document.querySelector("#filterType"),
  transactionRows: document.querySelector("#transactionRows"),
  budgetForm: document.querySelector("#budgetForm"),
  budgetId: document.querySelector("#budgetId"),
  budgetCategory: document.querySelector("#budgetCategory"),
  budgetLimit: document.querySelector("#budgetLimit"),
  budgetPeriod: document.querySelector("#budgetPeriod"),
  budgetGroup: document.querySelector("#budgetGroup"),
  budgetSubmitLabel: document.querySelector("#budgetSubmitLabel"),
  resetBudgetForm: document.querySelector("#resetBudgetForm"),
  budgetList: document.querySelector("#budgetList"),
  budgetCount: document.querySelector("#budgetCount"),
  reportPeriodLabel: document.querySelector("#reportPeriodLabel"),
  reportIncome: document.querySelector("#reportIncome"),
  reportExpense: document.querySelector("#reportExpense"),
  reportRemaining: document.querySelector("#reportRemaining"),
  reportNetWorth: document.querySelector("#reportNetWorth"),
  reportCategories: document.querySelector("#reportCategories"),
  reportBudgets: document.querySelector("#reportBudgets"),
  assetTotal: document.querySelector("#assetTotal"),
  debtTotal: document.querySelector("#debtTotal"),
  netWorthTotal: document.querySelector("#netWorthTotal"),
  accountForm: document.querySelector("#accountForm"),
  accountId: document.querySelector("#accountId"),
  accountName: document.querySelector("#accountName"),
  accountType: document.querySelector("#accountType"),
  accountValue: document.querySelector("#accountValue"),
  accountOwed: document.querySelector("#accountOwed"),
  accountBalance: document.querySelector("#accountBalance"),
  accountSubmitLabel: document.querySelector("#accountSubmitLabel"),
  resetAccountForm: document.querySelector("#resetAccountForm"),
  accountSummary: document.querySelector("#accountSummary"),
  accountList: document.querySelector("#accountList"),
  userForm: document.querySelector("#userForm"),
  userId: document.querySelector("#userId"),
  userName: document.querySelector("#userName"),
  userEmail: document.querySelector("#userEmail"),
  userSubmitLabel: document.querySelector("#userSubmitLabel"),
  resetUserForm: document.querySelector("#resetUserForm"),
  userCount: document.querySelector("#userCount"),
  userList: document.querySelector("#userList"),
  bookForm: document.querySelector("#bookForm"),
  bookId: document.querySelector("#bookId"),
  bookName: document.querySelector("#bookName"),
  bookOwner: document.querySelector("#bookOwner"),
  bookSubmitLabel: document.querySelector("#bookSubmitLabel"),
  resetBookForm: document.querySelector("#resetBookForm"),
  bookCount: document.querySelector("#bookCount"),
  bookList: document.querySelector("#bookList"),
  shareForm: document.querySelector("#shareForm"),
  shareUserSelect: document.querySelector("#shareUserSelect"),
  shareList: document.querySelector("#shareList"),
  themeSelect: document.querySelector("#themeSelect"),
  exportCsvBtn: document.querySelector("#exportCsvBtn"),
  exportWorkbookBtn: document.querySelector("#exportWorkbookBtn"),
  backupZipBtn: document.querySelector("#backupZipBtn"),
  addDemoBtn: document.querySelector("#addDemoBtn"),
  deleteDemoBtn: document.querySelector("#deleteDemoBtn"),
  transactionDialog: document.querySelector("#transactionDialog"),
  transactionForm: document.querySelector("#transactionForm"),
  transactionDialogTitle: document.querySelector("#transactionDialogTitle"),
  closeTransactionDialog: document.querySelector("#closeTransactionDialog"),
  transactionId: document.querySelector("#transactionId"),
  txnDate: document.querySelector("#txnDate"),
  txnType: document.querySelector("#txnType"),
  txnPayee: document.querySelector("#txnPayee"),
  txnAccount: document.querySelector("#txnAccount"),
  txnCategory: document.querySelector("#txnCategory"),
  txnAmount: document.querySelector("#txnAmount"),
  txnDescription: document.querySelector("#txnDescription"),
  txnNotes: document.querySelector("#txnNotes"),
  txnPayPeriod: document.querySelector("#txnPayPeriod"),
  txnCleared: document.querySelector("#txnCleared"),
  txnSubmitLabel: document.querySelector("#txnSubmitLabel"),
  addSplitBtn: document.querySelector("#addSplitBtn"),
  splitRows: document.querySelector("#splitRows"),
  splitStatus: document.querySelector("#splitStatus"),
  emptyTemplate: document.querySelector("#emptyStateTemplate"),
  toast: document.querySelector("#toast"),
};

init();

function init() {
  document.body.dataset.theme = state.theme || "classic";
  syncMonthControls(state.currentMonth || currentMonth);
  els.themeSelect.value = state.theme || "classic";
  setPeriodMode(state.periodMode || "month", false);
  resetQuickForm();
  resetBudgetForm();
  resetAccountForm();
  resetUserForm();
  resetBookForm();
  resetTransactionForm();
  bindEvents();
  ensureActiveBookAccess();
  render();
}

function bindEvents() {
  els.activeUserSelect.addEventListener("change", () => {
    state.activeUserId = els.activeUserSelect.value;
    ensureActiveBookAccess();
    saveState();
    render();
  });
  els.activeBookSelect.addEventListener("change", () => {
    state.activeBookId = els.activeBookSelect.value;
    saveState();
    render();
  });
  els.periodButtons.forEach((button) => {
    button.addEventListener("click", () => setPeriodMode(button.dataset.period));
  });
  els.monthSelect.addEventListener("change", updateMonthFromControls);
  els.yearInput.addEventListener("change", updateMonthFromControls);
  els.prevMonthBtn.addEventListener("click", () => shiftMonth(-1));
  els.nextMonthBtn.addEventListener("click", () => shiftMonth(1));
  els.todayMonthBtn.addEventListener("click", () => setCurrentMonth(currentMonth));
  els.monthFilter.addEventListener("change", () => setCurrentMonth(els.monthFilter.value || currentMonth));
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => setTab(tab.dataset.tab));
  });
  els.addTransactionBtn.addEventListener("click", () => openTransactionDialog());
  els.transactionAddBtn.addEventListener("click", () => openTransactionDialog());
  els.closeTransactionDialog.addEventListener("click", () => els.transactionDialog.close());
  els.undoBtn.addEventListener("click", undoChange);
  els.redoBtn.addEventListener("click", redoChange);
  els.quickType.addEventListener("change", renderCategoryOptions);
  els.quickTransactionForm.addEventListener("submit", saveQuickTransaction);
  els.quickClearBtn.addEventListener("click", resetQuickForm);
  els.searchTransactions.addEventListener("input", renderTransactions);
  els.filterType.addEventListener("change", renderTransactions);
  els.budgetForm.addEventListener("submit", saveBudget);
  els.resetBudgetForm.addEventListener("click", resetBudgetForm);
  els.accountForm.addEventListener("submit", saveAccount);
  els.resetAccountForm.addEventListener("click", resetAccountForm);
  els.accountType.addEventListener("change", autofillBalanceFromValueOwed);
  els.accountValue.addEventListener("input", autofillBalanceFromValueOwed);
  els.accountOwed.addEventListener("input", autofillBalanceFromValueOwed);
  els.userForm.addEventListener("submit", saveUser);
  els.resetUserForm.addEventListener("click", resetUserForm);
  els.bookForm.addEventListener("submit", saveBook);
  els.resetBookForm.addEventListener("click", resetBookForm);
  els.shareForm.addEventListener("submit", shareCurrentBook);
  els.themeSelect.addEventListener("change", changeTheme);
  els.exportCsvBtn.addEventListener("click", exportCsv);
  els.exportWorkbookBtn.addEventListener("click", exportWorkbook);
  els.backupZipBtn.addEventListener("click", backupZip);
  els.addDemoBtn.addEventListener("click", addDemoData);
  els.deleteDemoBtn.addEventListener("click", deleteDemoData);
  els.txnType.addEventListener("change", renderCategoryOptions);
  els.txnAmount.addEventListener("input", renderSplitStatus);
  els.transactionForm.addEventListener("submit", saveDetailedTransaction);
  els.addSplitBtn.addEventListener("click", () => addSplitRow());
}

function loadState() {
  const stored = safeJson(localStorage.getItem(STORAGE_KEY));
  if (stored) return normalizeState(stored);

  for (const key of LEGACY_KEYS) {
    const legacy = safeJson(localStorage.getItem(key));
    if (legacy) return normalizeState(migrateLegacyState(legacy));
  }

  return normalizeState(createBaseState());
}

function createBaseState() {
  const userId = id();
  const bookId = id();
  return {
    version: 3,
    theme: "classic",
    currentMonth,
    periodMode: "month",
    activeUserId: userId,
    activeBookId: bookId,
    users: [{ id: userId, name: "Main User", email: "", demo: false }],
    books: [{ id: bookId, name: "My Budget", ownerUserId: userId, sharedUserIds: [], demo: false }],
    ledgers: {
      [bookId]: createLedger({
        transactions: starterTransactions(),
        accounts: starterAccounts(),
        budgets: starterBudgets(),
      }),
    },
  };
}

function migrateLegacyState(legacy) {
  const base = createBaseState();
  const ledger = currentLedger(base);
  ledger.transactions = (legacy.transactions || []).map((txn) => ({
    ...txn,
    payee: txn.payee || "",
    accountId: txn.accountId || "",
    notes: txn.notes || "",
    splits: Array.isArray(txn.splits) ? txn.splits : [],
  }));
  ledger.budgets = (legacy.budgets || starterBudgets()).map(normalizeBudget);
  ledger.accounts = (legacy.accounts || starterAccounts()).map(normalizeAccount);
  base.currentMonth = legacy.currentMonth || currentMonth;
  base.periodMode = legacy.periodMode || "month";
  return base;
}

function normalizeState(input) {
  const base = createBaseState();
  const normalized = {
    ...base,
    ...input,
    users: Array.isArray(input.users) && input.users.length ? input.users : base.users,
    books: Array.isArray(input.books) && input.books.length ? input.books : base.books,
    ledgers: input.ledgers && typeof input.ledgers === "object" ? input.ledgers : base.ledgers,
  };
  normalized.periodMode = ["week", "month", "year"].includes(normalized.periodMode)
    ? normalized.periodMode
    : "month";
  normalized.theme = ["classic", "slate", "forest", "berry"].includes(normalized.theme)
    ? normalized.theme
    : "classic";
  normalized.users = normalized.users.map((user) => ({
    id: user.id || id(),
    name: user.name || "User",
    email: user.email || "",
    demo: Boolean(user.demo),
  }));
  normalized.books = normalized.books.map((book) => ({
    id: book.id || id(),
    name: book.name || "Budget Book",
    ownerUserId: book.ownerUserId || normalized.users[0].id,
    sharedUserIds: Array.isArray(book.sharedUserIds) ? book.sharedUserIds : [],
    demo: Boolean(book.demo),
  }));
  normalized.books.forEach((book) => {
    normalized.ledgers[book.id] = createLedger(normalized.ledgers[book.id] || {});
  });
  if (!normalized.users.some((user) => user.id === normalized.activeUserId)) {
    normalized.activeUserId = normalized.users[0].id;
  }
  if (!normalized.books.some((book) => book.id === normalized.activeBookId)) {
    normalized.activeBookId = normalized.books[0].id;
  }
  return normalized;
}

function createLedger(data = {}) {
  return {
    transactions: Array.isArray(data.transactions) ? data.transactions.map(normalizeTransaction) : [],
    budgets: Array.isArray(data.budgets) ? data.budgets.map(normalizeBudget) : starterBudgets(),
    accounts: Array.isArray(data.accounts) ? data.accounts.map(normalizeAccount) : starterAccounts(),
  };
}

function normalizeTransaction(txn) {
  return {
    id: txn.id || id(),
    date: txn.date || today,
    type: ["expense", "income", "transfer"].includes(txn.type) ? txn.type : "expense",
    payee: txn.payee || "",
    accountId: txn.accountId || "",
    category: txn.category || "Other",
    description: txn.description || txn.payee || "Transaction",
    amount: Number(txn.amount) || 0,
    cleared: Boolean(txn.cleared),
    payPeriod: txn.payPeriod || "none",
    notes: txn.notes || "",
    splits: Array.isArray(txn.splits) ? txn.splits.map(normalizeSplit) : [],
    demo: Boolean(txn.demo),
  };
}

function normalizeSplit(split) {
  return {
    id: split.id || id(),
    category: split.category || "Other",
    amount: Number(split.amount) || 0,
    memo: split.memo || "",
    type: split.type || "expense",
  };
}

function normalizeBudget(budget) {
  return {
    id: budget.id || id(),
    category: budget.category || "Other",
    monthlyLimit: Number(budget.monthlyLimit) || 0,
    period: ["week", "month", "year"].includes(budget.period) ? budget.period : "month",
    group: budget.group || "expense",
    demo: Boolean(budget.demo),
  };
}

function normalizeAccount(account) {
  const type = account.type === "liability" ? "liability" : "asset";
  const value = Number(account.value) || 0;
  const owed = Number(account.owed) || 0;
  return {
    id: account.id || id(),
    name: account.name || "Account",
    type,
    value,
    owed,
    balance: Number(account.balance ?? (type === "asset" ? value - owed : owed || value)) || 0,
    demo: Boolean(account.demo),
  };
}

function starterBudgets() {
  return [
    ["Giving", 300, "month"],
    ["Savings", 600, "month"],
    ["Utilities", 350, "month"],
    ["Debt Payment", 500, "month"],
    ["Fuel", 220, "month"],
    ["Grocery", 650, "month"],
    ["Entertainment", 180, "month"],
    ["Health", 160, "month"],
    ["Travel", 200, "month"],
    ["Other", 250, "month"],
  ].map(([category, monthlyLimit, period]) =>
    normalizeBudget({ category, monthlyLimit, period, group: "expense" }),
  );
}

function starterAccounts() {
  return [
    normalizeAccount({ name: "Checking", type: "asset", balance: 0 }),
    normalizeAccount({ name: "Savings", type: "asset", balance: 0 }),
    normalizeAccount({ name: "Credit Card", type: "liability", balance: 0 }),
  ];
}

function starterTransactions() {
  return [
    normalizeTransaction({
      date: today,
      type: "income",
      category: "Income",
      description: "Example paycheck",
      amount: 2500,
      cleared: true,
      payPeriod: "first",
    }),
    normalizeTransaction({
      date: today,
      type: "expense",
      category: "Grocery",
      description: "Example grocery run",
      amount: 86.42,
      cleared: true,
      payPeriod: "first",
    }),
  ];
}

function currentLedger(source = state) {
  return source.ledgers[source.activeBookId] || createLedger();
}

function currentBook() {
  return state.books.find((book) => book.id === state.activeBookId) || state.books[0];
}

function accessibleBooks() {
  return state.books.filter(
    (book) => book.ownerUserId === state.activeUserId || book.sharedUserIds.includes(state.activeUserId),
  );
}

function ensureActiveBookAccess() {
  const books = accessibleBooks();
  if (!books.some((book) => book.id === state.activeBookId)) {
    state.activeBookId = books[0]?.id || state.books[0]?.id;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function syncMonthControls(value) {
  const safeValue = /^\d{4}-\d{2}$/.test(value) ? value : currentMonth;
  const [year, month] = safeValue.split("-").map(Number);
  state.currentMonth = safeValue;
  els.monthFilter.value = safeValue;
  els.monthSelect.value = String(month - 1);
  els.yearInput.value = String(year);
}

function setCurrentMonth(value) {
  syncMonthControls(value);
  saveState();
  render();
}

function updateMonthFromControls() {
  const year = Math.min(2200, Math.max(1900, Number(els.yearInput.value) || Number(currentMonth.slice(0, 4))));
  const month = Number(els.monthSelect.value) + 1;
  setCurrentMonth(`${year}-${String(month).padStart(2, "0")}`);
}

function shiftMonth(delta) {
  const [year, month] = (state.currentMonth || currentMonth).split("-").map(Number);
  const next = new Date(year, month - 1 + delta, 1, 12);
  setCurrentMonth(toDateInput(next).slice(0, 7));
}

function snapshotState() {
  return JSON.stringify(state);
}

function restoreSnapshot(snapshot) {
  state = normalizeState(JSON.parse(snapshot));
  document.body.dataset.theme = state.theme;
  syncMonthControls(state.currentMonth || currentMonth);
  els.themeSelect.value = state.theme || "classic";
  setPeriodMode(state.periodMode, false);
  saveState();
  render();
}

function recordHistory() {
  undoStack.push(snapshotState());
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = [];
  renderHistoryControls();
}

function undoChange() {
  if (!undoStack.length) return;
  redoStack.push(snapshotState());
  if (redoStack.length > HISTORY_LIMIT) redoStack.shift();
  restoreSnapshot(undoStack.pop());
  notify("Undid last change.");
}

function redoChange() {
  if (!redoStack.length) return;
  undoStack.push(snapshotState());
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  restoreSnapshot(redoStack.pop());
  notify("Redid last change.");
}

function render() {
  ensureActiveBookAccess();
  renderUsersAndBooks();
  renderCategoryOptions();
  renderAccountOptions();
  renderSummary();
  renderBudgetProgress();
  renderSpendingPace();
  renderTransactions();
  renderBudgets();
  renderReports();
  renderAccounts();
  renderSettings();
  renderHistoryControls();
  renderSplitStatus();
}

function renderUsersAndBooks() {
  els.activeUserSelect.innerHTML = state.users
    .map((user) => `<option value="${user.id}">${escapeHtml(user.name)}</option>`)
    .join("");
  els.activeUserSelect.value = state.activeUserId;

  const books = accessibleBooks();
  els.activeBookSelect.innerHTML = books
    .map((book) => `<option value="${book.id}">${escapeHtml(book.name)}</option>`)
    .join("");
  els.activeBookSelect.value = state.activeBookId;
}

function setTab(tabName) {
  els.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === tabName));
  els.views.forEach((view) => view.classList.toggle("is-active", view.id === tabName));
}

function setPeriodMode(period, shouldRender = true) {
  state.periodMode = ["week", "month", "year"].includes(period) ? period : "month";
  els.periodButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.period === state.periodMode);
  });
  saveState();
  if (shouldRender) render();
}

function getSelectedPeriod() {
  const mode = state.periodMode || "month";
  const month = els.monthFilter.value || currentMonth;
  const [year, monthNumber] = month.split("-").map(Number);
  const anchorDay = month === currentMonth ? Number(today.slice(-2)) : 1;
  const anchor = new Date(year, monthNumber - 1, anchorDay, 12);
  if (mode === "week") {
    const start = new Date(anchor);
    start.setDate(anchor.getDate() - anchor.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { mode, start: toDateInput(start), end: toDateInput(end), label: `${formatDate(toDateInput(start))} - ${formatDate(toDateInput(end))}` };
  }
  if (mode === "year") {
    return { mode, start: `${year}-01-01`, end: `${year}-12-31`, label: `${year}` };
  }
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return { mode, start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, "0")}`, label: anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
}

function periodTransactions() {
  const period = getSelectedPeriod();
  return currentLedger().transactions.filter((txn) => txn.date >= period.start && txn.date <= period.end);
}

function renderSummary() {
  const txns = periodTransactions();
  const income = total(txns.filter((txn) => txn.type === "income"));
  const expenses = total(txns.filter((txn) => txn.type === "expense"));
  const { assets, liabilities, netWorth } = netWorthTotals();
  els.incomeTotal.textContent = money(income);
  els.expenseTotal.textContent = money(expenses);
  els.remainderTotal.textContent = money(income - expenses);
  els.aumTotal.textContent = money(netWorth);
  els.assetTotal.textContent = money(assets);
  els.debtTotal.textContent = money(liabilities);
  els.netWorthTotal.textContent = money(netWorth);
  els.accountSummary.textContent = `${money(netWorth)} net`;
}

function renderBudgetProgress() {
  const ledger = currentLedger();
  const txns = periodTransactions().filter((txn) => txn.type === "expense");
  const spentByCategory = expenseTotalsByCategory(txns);
  const budgets = ledger.budgets.filter((budget) => budget.group === "expense");
  if (!budgets.length) return showEmpty(els.budgetProgress);
  els.budgetProgress.innerHTML = budgets
    .map((budget) => progressCard(budget, spentByCategory[budget.category] || 0))
    .join("");
}

function renderSpendingPace() {
  const period = getSelectedPeriod();
  const buckets = buildBuckets(period);
  periodTransactions()
    .filter((txn) => txn.type === "expense")
    .forEach((txn) => {
      const bucket = buckets.find((item) => txn.date >= item.start && txn.date <= item.end);
      if (bucket) bucket.amount += transactionExpenseAmount(txn);
    });
  const max = Math.max(...buckets.map((bucket) => bucket.amount), 1);
  const spent = buckets.reduce((sum, bucket) => sum + bucket.amount, 0);
  els.dailyAverage.textContent = `${money(spent / Math.max(buckets.length, 1))}${period.mode === "year" ? "/month" : "/day"}`;
  els.dailyBars.style.gridTemplateColumns = `repeat(${buckets.length}, minmax(7px, 1fr))`;
  els.dailyBars.innerHTML = buckets
    .map((bucket) => {
      const height = Math.max((bucket.amount / max) * 100, bucket.amount ? 8 : 2);
      return `<div class="bar" title="${bucket.label}: ${money(bucket.amount)}" style="height:${height}%"><span>${bucket.shortLabel}</span></div>`;
    })
    .join("");
}

function renderTransactions() {
  const query = els.searchTransactions.value.trim().toLowerCase();
  const type = els.filterType.value;
  const txns = periodTransactions()
    .filter((txn) => type === "all" || txn.type === type)
    .filter((txn) => `${txn.date} ${txn.payee} ${txn.description} ${txn.category}`.toLowerCase().includes(query))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!txns.length) {
    els.transactionRows.innerHTML = `<tr><td colspan="7"><div class="empty-state"><strong>No transactions</strong><span>Add one to start tracking.</span></div></td></tr>`;
    return;
  }
  els.transactionRows.innerHTML = txns
    .map((txn) => {
      const account = currentLedger().accounts.find((item) => item.id === txn.accountId);
      const splitLabel = txn.splits.length ? `Split (${txn.splits.length})` : txn.category;
      return `
        <tr>
          <td>${formatDate(txn.date)}</td>
          <td><strong>${escapeHtml(txn.payee || txn.description)}</strong><div class="item-meta">${escapeHtml(txn.description)}</div></td>
          <td>${escapeHtml(splitLabel)}</td>
          <td>${escapeHtml(account?.name || "No account")}</td>
          <td>${txn.cleared ? "Cleared" : "Open"}</td>
          <td class="numeric amount ${txn.type}">${txn.type === "income" ? "+" : txn.type === "expense" ? "-" : ""}${money(txn.amount)}</td>
          <td><div class="actions"><button class="row-button" type="button" onclick="editTransaction('${txn.id}')">Edit</button><button class="row-button danger" type="button" onclick="deleteTransaction('${txn.id}')">Delete</button></div></td>
        </tr>
      `;
    })
    .join("");
}

function renderBudgets() {
  const budgets = currentLedger().budgets;
  els.budgetCount.textContent = `${budgets.length} categor${budgets.length === 1 ? "y" : "ies"}`;
  if (!budgets.length) return showEmpty(els.budgetList);
  els.budgetList.innerHTML = budgets
    .map((budget) => `
      <article class="budget-item">
        <div class="item-row">
          <div><div class="item-title">${escapeHtml(budget.category)}</div><div class="item-meta">${budget.group} / ${money(budget.monthlyLimit)} ${periodLabel(budget.period)}</div></div>
          <div class="actions"><button class="row-button" type="button" onclick="editBudget('${budget.id}')">Edit</button><button class="row-button danger" type="button" onclick="deleteBudget('${budget.id}')">Delete</button></div>
        </div>
      </article>
    `)
    .join("");
}

function renderReports() {
  const txns = periodTransactions();
  const income = total(txns.filter((txn) => txn.type === "income"));
  const expenses = total(txns.filter((txn) => txn.type === "expense"));
  const { netWorth } = netWorthTotals();
  els.reportPeriodLabel.textContent = getSelectedPeriod().label;
  els.reportIncome.textContent = money(income);
  els.reportExpense.textContent = money(expenses);
  els.reportRemaining.textContent = money(income - expenses);
  els.reportNetWorth.textContent = money(netWorth);

  const categoryTotals = Object.entries(expenseTotalsByCategory(txns.filter((txn) => txn.type === "expense")))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  if (!categoryTotals.length) showEmpty(els.reportCategories);
  else {
    const max = Math.max(...categoryTotals.map(([, amount]) => amount), 1);
    els.reportCategories.innerHTML = categoryTotals
      .map(([category, amount]) => simpleBar(category, amount, max))
      .join("");
  }

  const spentByCategory = expenseTotalsByCategory(txns.filter((txn) => txn.type === "expense"));
  const budgets = currentLedger().budgets.filter((budget) => budget.group === "expense");
  if (!budgets.length) showEmpty(els.reportBudgets);
  else els.reportBudgets.innerHTML = budgets.map((budget) => progressCard(budget, spentByCategory[budget.category] || 0)).join("");
}

function renderAccounts() {
  const accounts = currentLedger().accounts;
  if (!accounts.length) return showEmpty(els.accountList);
  els.accountList.innerHTML = accounts
    .map((account) => `
      <article class="account-item">
        <div class="item-row">
          <div><div class="item-title">${escapeHtml(account.name)}</div><div class="item-meta">${account.type}${account.value || account.owed ? ` / value ${money(account.value)} / owed ${money(account.owed)}` : ""}</div></div>
          <div><div class="amount ${account.type}">${money(account.balance)}</div><div class="actions"><button class="row-button" type="button" onclick="editAccount('${account.id}')">Edit</button><button class="row-button danger" type="button" onclick="deleteAccount('${account.id}')">Delete</button></div></div>
        </div>
      </article>
    `)
    .join("");
}

function renderSettings() {
  const userOptions = state.users
    .map((user) => `<option value="${user.id}">${escapeHtml(user.name)}</option>`)
    .join("");
  els.bookOwner.innerHTML = userOptions;
  if ([...els.bookOwner.options].some((option) => option.value === state.activeUserId)) {
    els.bookOwner.value = state.activeUserId;
  }

  els.userCount.textContent = `${state.users.length} user${state.users.length === 1 ? "" : "s"}`;
  els.userList.innerHTML = state.users
    .map((user) => `
      <article class="user-item">
        <div class="item-row">
          <div><div class="item-title">${escapeHtml(user.name)}</div><div class="item-meta">${escapeHtml(user.email || "No email")}${user.demo ? " / demo" : ""}</div></div>
          <div class="actions">
            <button class="row-button" type="button" onclick="editUser('${user.id}')">Edit</button>
            <button class="row-button danger" type="button" onclick="deleteUser('${user.id}')">Delete</button>
          </div>
        </div>
      </article>
    `)
    .join("");
  els.bookCount.textContent = `${state.books.length} book${state.books.length === 1 ? "" : "s"}`;
  els.bookList.innerHTML = state.books
    .map((book) => {
      const owner = state.users.find((user) => user.id === book.ownerUserId);
      const shared = book.sharedUserIds.map((id) => state.users.find((user) => user.id === id)?.name).filter(Boolean);
      return `
        <article class="book-item">
          <div class="item-row">
            <div><div class="item-title">${escapeHtml(book.name)}</div><div class="item-meta">Owner: ${escapeHtml(owner?.name || "Unknown")}${shared.length ? ` / Shared with ${escapeHtml(shared.join(", "))}` : ""}${book.demo ? " / demo" : ""}</div></div>
            <div class="actions">
              <button class="row-button" type="button" onclick="editBook('${book.id}')">Edit</button>
              <button class="row-button danger" type="button" onclick="deleteBook('${book.id}')">Delete</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
  const book = currentBook();
  const owner = state.users.find((user) => user.id === book.ownerUserId);
  const sharedUsers = book.sharedUserIds
    .map((id) => state.users.find((user) => user.id === id))
    .filter(Boolean);
  els.shareUserSelect.innerHTML = state.users
    .filter((user) => user.id !== currentBook().ownerUserId && !currentBook().sharedUserIds.includes(user.id))
    .map((user) => `<option value="${user.id}">${escapeHtml(user.name)}</option>`)
    .join("");
  els.shareForm.querySelector("button").disabled = !els.shareUserSelect.options.length;
  els.shareList.innerHTML = `
    <div class="share-summary">
      <div>
        <div class="item-title">${escapeHtml(book.name)}</div>
        <div class="item-meta">Owner: ${escapeHtml(owner?.name || "Unknown")}</div>
      </div>
      ${
        sharedUsers.length
          ? sharedUsers
              .map(
                (user) => `
                  <div class="share-chip">
                    <span>${escapeHtml(user.name)}</span>
                    <button class="row-button danger" type="button" onclick="unshareBook('${book.id}', '${user.id}')">Remove</button>
                  </div>
                `,
              )
              .join("")
          : `<div class="item-meta">Not shared yet.</div>`
      }
    </div>
  `;
}

function renderCategoryOptions() {
  const ledger = currentLedger();
  const optionHtml = ledger.budgets
    .map((budget) => `<option value="${escapeHtml(budget.category)}">${escapeHtml(budget.category)}</option>`)
    .join("");
  els.quickCategory.innerHTML = optionHtml || `<option value="Other">Other</option>`;
  els.txnCategory.innerHTML = optionHtml || `<option value="Other">Other</option>`;
  document.querySelectorAll(".split-category").forEach((select) => {
    const selected = select.value;
    select.innerHTML = optionHtml || `<option value="Other">Other</option>`;
    if ([...select.options].some((option) => option.value === selected)) select.value = selected;
  });
}

function renderAccountOptions() {
  const options = currentLedger().accounts
    .map((account) => `<option value="${account.id}">${escapeHtml(account.name)}</option>`)
    .join("");
  els.txnAccount.innerHTML = `<option value="">No account</option>${options}`;
}

function resetQuickForm() {
  els.quickDate.value = today;
  els.quickType.value = "expense";
  els.quickAmount.value = "";
  els.quickDescription.value = "";
  renderCategoryOptions();
}

function saveQuickTransaction(event) {
  event.preventDefault();
  const txn = normalizeTransaction({
    date: els.quickDate.value,
    type: els.quickType.value,
    category: els.quickCategory.value,
    description: els.quickDescription.value.trim(),
    amount: Number(els.quickAmount.value),
    cleared: false,
  });
  if (!txn.description || !txn.amount) return notify("Add a description and amount first.");
  recordHistory();
  currentLedger().transactions.push(txn);
  saveState();
  resetQuickForm();
  render();
  notify("Transaction added.");
}

function openTransactionDialog(txn = null) {
  resetTransactionForm();
  if (txn) fillTransactionForm(txn);
  els.transactionDialogTitle.textContent = txn ? "Edit Transaction" : "Add Transaction";
  els.transactionDialog.showModal();
  els.txnDescription.focus();
}

function resetTransactionForm() {
  els.transactionId.value = "";
  els.txnDate.value = today;
  els.txnType.value = "expense";
  els.txnPayee.value = "";
  els.txnAccount.value = "";
  els.txnCategory.value = currentLedger().budgets[0]?.category || "Other";
  els.txnAmount.value = "";
  els.txnDescription.value = "";
  els.txnNotes.value = "";
  els.txnPayPeriod.value = "none";
  els.txnCleared.checked = false;
  els.splitRows.innerHTML = "";
  els.txnSubmitLabel.textContent = "Save Transaction";
  renderAccountOptions();
  renderCategoryOptions();
  renderSplitStatus();
}

function fillTransactionForm(txn) {
  els.transactionId.value = txn.id;
  els.txnDate.value = txn.date;
  els.txnType.value = txn.type;
  els.txnPayee.value = txn.payee || "";
  els.txnAccount.value = txn.accountId || "";
  els.txnCategory.value = txn.category;
  els.txnAmount.value = txn.amount;
  els.txnDescription.value = txn.description;
  els.txnNotes.value = txn.notes || "";
  els.txnPayPeriod.value = txn.payPeriod || "none";
  els.txnCleared.checked = Boolean(txn.cleared);
  els.splitRows.innerHTML = "";
  txn.splits.forEach((split) => addSplitRow(split));
  els.txnSubmitLabel.textContent = "Update Transaction";
}

function saveDetailedTransaction(event) {
  event.preventDefault();
  const amount = Number(els.txnAmount.value) || 0;
  const splits = readSplits();
  if (splits.length) {
    const splitTotal = total(splits);
    if (Math.abs(splitTotal - amount) > 0.009) {
      return notify(`Splits must equal ${money(amount)}. Remaining: ${money(amount - splitTotal)}.`);
    }
  }
  const txn = normalizeTransaction({
    id: els.transactionId.value || id(),
    date: els.txnDate.value,
    type: els.txnType.value,
    payee: els.txnPayee.value.trim(),
    accountId: els.txnAccount.value,
    category: els.txnCategory.value,
    description: els.txnDescription.value.trim(),
    amount,
    cleared: els.txnCleared.checked,
    payPeriod: els.txnPayPeriod.value,
    notes: els.txnNotes.value.trim(),
    splits,
  });
  if (!txn.description || !txn.amount) return notify("Add a description and amount first.");
  recordHistory();
  const list = currentLedger().transactions;
  const index = list.findIndex((item) => item.id === txn.id);
  if (index >= 0) list[index] = txn;
  else list.push(txn);
  saveState();
  render();
  els.transactionDialog.close();
  notify(index >= 0 ? "Transaction updated." : "Transaction added.");
}

function addSplitRow(split = {}) {
  const row = document.createElement("div");
  row.className = "split-row";
  row.innerHTML = `
    <select class="split-category"></select>
    <input class="split-amount" type="number" min="0" step="0.01" placeholder="Amount" />
    <input class="split-memo" type="text" maxlength="80" placeholder="Memo" />
    <button class="row-button danger" type="button">Remove</button>
  `;
  els.splitRows.append(row);
  renderCategoryOptions();
  row.querySelector(".split-category").value = split.category || currentLedger().budgets[0]?.category || "Other";
  row.querySelector(".split-amount").value = split.amount || "";
  row.querySelector(".split-memo").value = split.memo || "";
  row.querySelector(".split-amount").addEventListener("input", renderSplitStatus);
  row.querySelector(".row-button").addEventListener("click", () => {
    row.remove();
    renderSplitStatus();
  });
  renderSplitStatus();
}

function readSplits() {
  return [...els.splitRows.querySelectorAll(".split-row")]
    .map((row) => normalizeSplit({
      category: row.querySelector(".split-category").value,
      amount: Number(row.querySelector(".split-amount").value),
      memo: row.querySelector(".split-memo").value.trim(),
      type: els.txnType.value,
    }))
    .filter((split) => split.amount > 0);
}

function renderSplitStatus() {
  if (!els.splitStatus) return;
  const amount = Number(els.txnAmount.value) || 0;
  const splitTotal = total(readSplits());
  if (!splitTotal) {
    els.splitStatus.textContent = "No splits";
    return;
  }
  const remaining = amount - splitTotal;
  els.splitStatus.textContent = `Split total ${money(splitTotal)} / Remaining ${money(remaining)}`;
  els.splitStatus.classList.toggle("is-error", Math.abs(remaining) > 0.009);
}

function editTransaction(idValue) {
  const txn = currentLedger().transactions.find((item) => item.id === idValue);
  if (txn) openTransactionDialog(txn);
}

function deleteTransaction(idValue) {
  const txn = currentLedger().transactions.find((item) => item.id === idValue);
  if (!txn || !window.confirm(`Delete "${txn.description}" for ${money(txn.amount)}?`)) return;
  recordHistory();
  currentLedger().transactions = currentLedger().transactions.filter((item) => item.id !== idValue);
  saveState();
  render();
  notify("Transaction deleted. Use Undo to bring it back.");
}

function saveBudget(event) {
  event.preventDefault();
  const budget = normalizeBudget({
    id: els.budgetId.value || id(),
    category: titleCase(els.budgetCategory.value.trim()),
    monthlyLimit: Number(els.budgetLimit.value),
    period: els.budgetPeriod.value,
    group: els.budgetGroup.value,
  });
  if (!budget.category) return notify("Add a category first.");
  recordHistory();
  const list = currentLedger().budgets;
  const index = list.findIndex((item) => item.id === budget.id);
  if (index >= 0) list[index] = budget;
  else list.push(budget);
  saveState();
  resetBudgetForm();
  render();
  notify(index >= 0 ? "Budget updated." : "Budget added.");
}

function editBudget(idValue) {
  const budget = currentLedger().budgets.find((item) => item.id === idValue);
  if (!budget) return;
  els.budgetId.value = budget.id;
  els.budgetCategory.value = budget.category;
  els.budgetLimit.value = budget.monthlyLimit;
  els.budgetPeriod.value = budget.period;
  els.budgetGroup.value = budget.group;
  els.budgetSubmitLabel.textContent = "Update Budget";
}

function deleteBudget(idValue) {
  const budget = currentLedger().budgets.find((item) => item.id === idValue);
  if (!budget || !window.confirm(`Delete budget "${budget.category}"?`)) return;
  recordHistory();
  currentLedger().budgets = currentLedger().budgets.filter((item) => item.id !== idValue);
  saveState();
  render();
  notify("Budget deleted. Use Undo to bring it back.");
}

function resetBudgetForm() {
  els.budgetId.value = "";
  els.budgetCategory.value = "";
  els.budgetLimit.value = "";
  els.budgetPeriod.value = "month";
  els.budgetGroup.value = "expense";
  els.budgetSubmitLabel.textContent = "Save Budget";
}

function autofillBalanceFromValueOwed() {
  const value = Number(els.accountValue.value);
  const owed = Number(els.accountOwed.value);
  if (!els.accountValue.value && !els.accountOwed.value) return;
  els.accountBalance.value =
    els.accountType.value === "asset" ? Number(value || 0) - Number(owed || 0) : Number(owed || value || 0);
}

function saveAccount(event) {
  event.preventDefault();
  const account = normalizeAccount({
    id: els.accountId.value || id(),
    name: els.accountName.value.trim(),
    type: els.accountType.value,
    value: Number(els.accountValue.value) || 0,
    owed: Number(els.accountOwed.value) || 0,
    balance: Number(els.accountBalance.value),
  });
  if (!account.name) return notify("Add a name first.");
  recordHistory();
  const list = currentLedger().accounts;
  const index = list.findIndex((item) => item.id === account.id);
  if (index >= 0) list[index] = account;
  else list.push(account);
  saveState();
  resetAccountForm();
  render();
  notify(index >= 0 ? "Account updated." : "Account added.");
}

function editAccount(idValue) {
  const account = currentLedger().accounts.find((item) => item.id === idValue);
  if (!account) return;
  els.accountId.value = account.id;
  els.accountName.value = account.name;
  els.accountType.value = account.type;
  els.accountValue.value = account.value || "";
  els.accountOwed.value = account.owed || "";
  els.accountBalance.value = account.balance;
  els.accountSubmitLabel.textContent = "Update Account";
}

function deleteAccount(idValue) {
  const account = currentLedger().accounts.find((item) => item.id === idValue);
  if (!account || !window.confirm(`Delete "${account.name}"?`)) return;
  recordHistory();
  currentLedger().accounts = currentLedger().accounts.filter((item) => item.id !== idValue);
  saveState();
  render();
  notify("Account deleted. Use Undo to bring it back.");
}

function resetAccountForm() {
  els.accountId.value = "";
  els.accountName.value = "";
  els.accountType.value = "asset";
  els.accountValue.value = "";
  els.accountOwed.value = "";
  els.accountBalance.value = "";
  els.accountSubmitLabel.textContent = "Save Account";
}

function resetUserForm() {
  els.userId.value = "";
  els.userName.value = "";
  els.userEmail.value = "";
  els.userSubmitLabel.textContent = "Add User";
}

function saveUser(event) {
  event.preventDefault();
  const name = els.userName.value.trim();
  if (!name) return;
  recordHistory();
  const existingIndex = state.users.findIndex((user) => user.id === els.userId.value);
  if (existingIndex >= 0) {
    state.users[existingIndex] = {
      ...state.users[existingIndex],
      name,
      email: els.userEmail.value.trim(),
    };
  } else {
    const user = { id: id(), name, email: els.userEmail.value.trim(), demo: false };
    state.users.push(user);
    const book = { id: id(), name: `${name}'s Budget`, ownerUserId: user.id, sharedUserIds: [], demo: false };
    state.books.push(book);
    state.ledgers[book.id] = createLedger();
  }
  resetUserForm();
  saveState();
  render();
  notify(existingIndex >= 0 ? "User updated." : "User added with a separate budget book.");
}

function editUser(idValue) {
  const user = state.users.find((item) => item.id === idValue);
  if (!user) return;
  els.userId.value = user.id;
  els.userName.value = user.name;
  els.userEmail.value = user.email || "";
  els.userSubmitLabel.textContent = "Update User";
  setTab("settings");
  els.userName.focus();
}

function deleteUser(idValue) {
  if (state.users.length <= 1) return notify("Keep at least one user.");
  const user = state.users.find((item) => item.id === idValue);
  if (!user || !window.confirm(`Delete user "${user.name}" and their owned books?`)) return;
  recordHistory();
  const ownedBookIds = state.books.filter((book) => book.ownerUserId === idValue).map((book) => book.id);
  state.users = state.users.filter((item) => item.id !== idValue);
  state.books = state.books
    .filter((book) => book.ownerUserId !== idValue)
    .map((book) => ({ ...book, sharedUserIds: book.sharedUserIds.filter((sharedId) => sharedId !== idValue) }));
  ownedBookIds.forEach((bookId) => delete state.ledgers[bookId]);
  state.activeUserId = state.users[0].id;
  ensureActiveBookAccess();
  resetUserForm();
  resetBookForm();
  saveState();
  render();
}

function resetBookForm() {
  els.bookId.value = "";
  els.bookName.value = "";
  els.bookOwner.value = state.activeUserId;
  els.bookSubmitLabel.textContent = "Add Book";
}

function saveBook(event) {
  event.preventDefault();
  const name = els.bookName.value.trim();
  if (!name) return;
  recordHistory();
  const ownerUserId = els.bookOwner.value || state.activeUserId;
  const existingIndex = state.books.findIndex((book) => book.id === els.bookId.value);
  if (existingIndex >= 0) {
    const book = state.books[existingIndex];
    state.books[existingIndex] = {
      ...book,
      name,
      ownerUserId,
      sharedUserIds: book.sharedUserIds.filter((userId) => userId !== ownerUserId),
    };
  } else {
    const book = { id: id(), name, ownerUserId, sharedUserIds: [], demo: false };
    state.books.push(book);
    state.ledgers[book.id] = createLedger();
    state.activeBookId = book.id;
  }
  resetBookForm();
  saveState();
  render();
  notify(existingIndex >= 0 ? "Book updated." : "Book added.");
}

function editBook(idValue) {
  const book = state.books.find((item) => item.id === idValue);
  if (!book) return;
  els.bookId.value = book.id;
  els.bookName.value = book.name;
  els.bookOwner.value = book.ownerUserId;
  els.bookSubmitLabel.textContent = "Update Book";
  setTab("settings");
  els.bookName.focus();
}

function deleteBook(idValue) {
  if (state.books.length <= 1) return notify("Keep at least one book.");
  const book = state.books.find((item) => item.id === idValue);
  if (!book || !window.confirm(`Delete book "${book.name}"?`)) return;
  recordHistory();
  state.books = state.books.filter((item) => item.id !== idValue);
  delete state.ledgers[idValue];
  ensureActiveBookAccess();
  resetBookForm();
  saveState();
  render();
}

function shareCurrentBook(event) {
  event.preventDefault();
  const userId = els.shareUserSelect.value;
  const book = currentBook();
  if (!userId || book.sharedUserIds.includes(userId)) return;
  recordHistory();
  book.sharedUserIds.push(userId);
  saveState();
  render();
  notify("Ledger shared.");
}

function unshareBook(bookId, userId) {
  const book = state.books.find((item) => item.id === bookId);
  const user = state.users.find((item) => item.id === userId);
  if (!book || !user) return;
  recordHistory();
  book.sharedUserIds = book.sharedUserIds.filter((idValue) => idValue !== userId);
  ensureActiveBookAccess();
  saveState();
  render();
  notify(`Removed ${user.name} from ${book.name}.`);
}

function changeTheme() {
  recordHistory();
  state.theme = els.themeSelect.value;
  document.body.dataset.theme = state.theme;
  saveState();
  notify("Color scheme updated.");
}

function addDemoData() {
  recordHistory();
  const demo = buildDemoData();
  state.users = [...state.users.filter((user) => !user.demo), ...demo.users];
  state.books = [...state.books.filter((book) => !book.demo), ...demo.books];
  Object.keys(state.ledgers).forEach((bookId) => {
    if (!state.books.some((book) => book.id === bookId)) delete state.ledgers[bookId];
  });
  state.ledgers = { ...state.ledgers, ...demo.ledgers };
  state.activeUserId = demo.users[0].id;
  state.activeBookId = demo.books[0].id;
  saveState();
  render();
  notify("Demo data added.");
}

function deleteDemoData() {
  recordHistory();
  const demoBookIds = state.books.filter((book) => book.demo).map((book) => book.id);
  state.users = state.users.filter((user) => !user.demo);
  state.books = state.books.filter((book) => !book.demo);
  demoBookIds.forEach((bookId) => delete state.ledgers[bookId]);
  if (!state.users.length || !state.books.length) state = createBaseState();
  ensureActiveBookAccess();
  saveState();
  render();
  notify("Demo data removed.");
}

async function exportWorkbook() {
  await postDownload("/api/export-workbook", `budget-ledger-${dateStamp()}.xlsx`);
}

async function backupZip() {
  await postDownload("/api/backup-zip", `budget-ledger-backup-${dateStamp()}.zip`);
}

async function postDownload(url, filename) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    if (!response.ok) throw new Error(await response.text());
    download(await response.blob(), filename);
    notify("Export ready.");
  } catch (error) {
    notify(error.message || "Export failed.");
  }
}

function exportCsv() {
  const header = ["book", "date", "type", "payee", "description", "account", "category", "amount", "cleared", "notes"];
  const ledger = currentLedger();
  const rows = periodTransactions().map((txn) => {
    const account = ledger.accounts.find((item) => item.id === txn.accountId);
    return [
      currentBook().name,
      txn.date,
      txn.type,
      txn.payee,
      txn.description,
      account?.name || "",
      txn.splits.length ? "Split" : txn.category,
      txn.amount,
      txn.cleared,
      txn.notes,
    ].map(csvEscape).join(",");
  });
  download(new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" }), `budget-ledger-${dateStamp()}.csv`);
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildDemoData() {
  const users = [
    { id: id(), name: "Alex Rivera", email: "alex@example.com", demo: true },
    { id: id(), name: "Jamie Rivera", email: "jamie@example.com", demo: true },
    { id: id(), name: "Morgan Lee", email: "morgan@example.com", demo: true },
    { id: id(), name: "Taylor Brooks", email: "taylor@example.com", demo: true },
  ];
  const books = [
    { id: id(), name: "Rivera Household", ownerUserId: users[0].id, sharedUserIds: [users[1].id], demo: true },
    { id: id(), name: "Morgan Apartment", ownerUserId: users[2].id, sharedUserIds: [], demo: true },
    { id: id(), name: "Taylor Family Budget", ownerUserId: users[3].id, sharedUserIds: [], demo: true },
  ];
  const ledgers = {};
  books.forEach((book, index) => {
    const income = [7200, 4300, 9100][index];
    const grocery = [780, 420, 940][index];
    ledgers[book.id] = createLedger({
      budgets: [
        normalizeBudget({ category: "Housing", monthlyLimit: [2200, 1350, 2800][index], period: "month", group: "expense", demo: true }),
        normalizeBudget({ category: "Grocery", monthlyLimit: grocery, period: "month", group: "expense", demo: true }),
        normalizeBudget({ category: "Utilities", monthlyLimit: [390, 210, 480][index], period: "month", group: "expense", demo: true }),
        normalizeBudget({ category: "Fuel", monthlyLimit: [260, 120, 360][index], period: "month", group: "expense", demo: true }),
        normalizeBudget({ category: "Savings", monthlyLimit: [800, 350, 1200][index], period: "month", group: "expense", demo: true }),
        normalizeBudget({ category: "Other", monthlyLimit: [400, 250, 500][index], period: "month", group: "expense", demo: true }),
      ],
      accounts: [
        normalizeAccount({ name: "Checking", type: "asset", balance: [4200, 1800, 6100][index], demo: true }),
        normalizeAccount({ name: "Savings", type: "asset", balance: [14500, 5200, 24000][index], demo: true }),
        normalizeAccount({ name: "Credit Card", type: "liability", balance: [1200, 640, 2100][index], demo: true }),
      ],
      transactions: [
        normalizeTransaction({ date: today, type: "income", category: "Income", description: "Paycheck", payee: "Employer", amount: income / 2, cleared: true, demo: true }),
        normalizeTransaction({ date: today, type: "expense", category: "Grocery", description: "Weekly groceries", payee: "Market", amount: grocery / 4, cleared: true, demo: true }),
        normalizeTransaction({ date: today, type: "expense", category: "Utilities", description: "Electric bill", payee: "Utility Co.", amount: [142, 86, 188][index], cleared: false, demo: true }),
      ],
    });
  });
  return { users, books, ledgers };
}

function progressCard(budget, spent) {
  const limit = budgetLimitForPeriod(budget, state.periodMode);
  const pct = limit ? Math.min((spent / limit) * 100, 100) : 0;
  const fillClass = pct >= 100 ? "over" : pct >= 80 ? "warning" : "";
  return `
    <article class="progress-item">
      <div class="item-row">
        <div><div class="item-title">${escapeHtml(budget.category)}</div><div class="item-meta">Budgeted ${money(limit)} / Spent ${money(spent)}</div></div>
        <div class="amount ${limit - spent < 0 ? "expense" : "income"}">${money(limit - spent)}</div>
      </div>
      <div class="progress-track"><div class="progress-fill ${fillClass}" style="width:${pct}%"></div></div>
    </article>
  `;
}

function simpleBar(label, amount, max) {
  return `
    <article class="progress-item">
      <div class="item-row"><div class="item-title">${escapeHtml(label)}</div><div class="amount expense">${money(amount)}</div></div>
      <div class="progress-track"><div class="progress-fill warning" style="width:${Math.max((amount / max) * 100, 8)}%"></div></div>
    </article>
  `;
}

function expenseTotalsByCategory(txns) {
  return txns.reduce((groups, txn) => {
    if (txn.splits.length) {
      txn.splits.forEach((split) => {
        groups[split.category] = (groups[split.category] || 0) + split.amount;
      });
    } else {
      groups[txn.category] = (groups[txn.category] || 0) + txn.amount;
    }
    return groups;
  }, {});
}

function transactionExpenseAmount(txn) {
  return txn.splits.length ? total(txn.splits) : Number(txn.amount) || 0;
}

function netWorthTotals() {
  const accounts = currentLedger().accounts;
  const assets = total(accounts.filter((account) => account.type === "asset"), "balance");
  const liabilities = total(accounts.filter((account) => account.type === "liability"), "balance");
  return { assets, liabilities, netWorth: assets - liabilities };
}

function budgetLimitForPeriod(budget, targetPeriod) {
  const amount = Number(budget.monthlyLimit) || 0;
  const source = budget.period || "month";
  const yearly = source === "year" ? amount : source === "month" ? amount * 12 : amount * 52;
  if (targetPeriod === "year") return yearly;
  if (targetPeriod === "week") return yearly / 52;
  return yearly / 12;
}

function buildBuckets(period) {
  if (period.mode === "year") {
    const year = Number(period.start.slice(0, 4));
    return Array.from({ length: 12 }, (_, index) => {
      const month = `${year}-${String(index + 1).padStart(2, "0")}`;
      const endDay = new Date(year, index + 1, 0).getDate();
      const label = new Date(year, index, 1).toLocaleDateString("en-US", { month: "short" });
      return { start: `${month}-01`, end: `${month}-${String(endDay).padStart(2, "0")}`, label, shortLabel: label, amount: 0 };
    });
  }
  const buckets = [];
  const cursor = new Date(`${period.start}T12:00:00`);
  const end = new Date(`${period.end}T12:00:00`);
  while (cursor <= end) {
    const date = toDateInput(cursor);
    buckets.push({ start: date, end: date, label: formatDate(date), shortLabel: String(cursor.getDate()), amount: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}

function renderHistoryControls() {
  els.undoBtn.disabled = !undoStack.length;
  els.redoBtn.disabled = !redoStack.length;
}

function showEmpty(container) {
  container.innerHTML = "";
  container.append(els.emptyTemplate.content.cloneNode(true));
}

function notify(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 2600);
}

function total(items, key = "amount") {
  return items.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
}

function periodLabel(period) {
  return { week: "weekly", month: "monthly", year: "yearly" }[period || "month"];
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toDateInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function titleCase(value) {
  return value.toLowerCase().split(/\s+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function safeJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function id() {
  return crypto.randomUUID();
}

window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
window.editBudget = editBudget;
window.deleteBudget = deleteBudget;
window.editAccount = editAccount;
window.deleteAccount = deleteAccount;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.editBook = editBook;
window.deleteBook = deleteBook;
window.unshareBook = unshareBook;

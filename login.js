const form = document.querySelector("#loginForm");
const message = document.querySelector("#loginMessage");

const choiceForm = document.createElement("form");
choiceForm.id = "ledgerChoiceForm";
choiceForm.className = "login-form";
choiceForm.hidden = true;
choiceForm.innerHTML = `
  <label>
    <span>User</span>
    <select id="loginUserSelect"></select>
  </label>
  <label>
    <span>Ledger</span>
    <select id="loginBookSelect"></select>
  </label>
  <button class="primary-button wide" type="submit">Open Ledger</button>
`;
form.insertAdjacentElement("afterend", choiceForm);

const userSelect = choiceForm.querySelector("#loginUserSelect");
const bookSelect = choiceForm.querySelector("#loginBookSelect");
let availablePairs = [];

function option(value, label) {
  return `<option value="${String(value).replaceAll('"', '&quot;')}">${String(label).replaceAll("<", "&lt;")}</option>`;
}

async function loadState() {
  const response = await fetch("/api/state", { cache: "no-store" });
  if (!response.ok) return null;
  const result = await response.json().catch(() => ({}));
  return result.state || result;
}

function buildPairs(state) {
  if (!state || !Array.isArray(state.users) || !Array.isArray(state.books)) return [];
  const pairs = [];
  state.users.forEach((user) => {
    state.books.forEach((book) => {
      const shared = Array.isArray(book.sharedUserIds) ? book.sharedUserIds : [];
      if (book.ownerUserId === user.id || shared.includes(user.id)) {
        pairs.push({ user, book });
      }
    });
  });
  return pairs;
}

function saveSelection(pair) {
  if (!pair) return;
  sessionStorage.setItem(
    "budget-ledger-open-selection",
    JSON.stringify({ userId: pair.user.id, bookId: pair.book.id }),
  );
}

function renderBooks() {
  const userId = userSelect.value;
  const books = availablePairs.filter((pair) => pair.user.id === userId);
  bookSelect.innerHTML = books.map((pair) => option(pair.book.id, pair.book.name)).join("");
}

function showChooser(pairs) {
  availablePairs = pairs;
  const users = [...new Map(pairs.map((pair) => [pair.user.id, pair.user])).values()];
  userSelect.innerHTML = users.map((user) => option(user.id, user.name)).join("");
  renderBooks();
  form.hidden = true;
  choiceForm.hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";

  const data = new FormData(form);
  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: data.get("username"),
        password: data.get("password"),
      }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      message.textContent = result.message || "Unable to sign in.";
      return;
    }

    sessionStorage.removeItem("budget-ledger-open-selection");
    const pairs = buildPairs(await loadState());
    if (pairs.length > 1) {
      showChooser(pairs);
      return;
    }
    if (pairs.length === 1) saveSelection(pairs[0]);
    window.location.assign("/");
  } catch {
    message.textContent = "Unable to reach the server.";
  } finally {
    submit.disabled = false;
  }
});

userSelect.addEventListener("change", renderBooks);
choiceForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const pair = availablePairs.find(
    (item) => item.user.id === userSelect.value && item.book.id === bookSelect.value,
  );
  saveSelection(pair);
  window.location.assign("/");
});

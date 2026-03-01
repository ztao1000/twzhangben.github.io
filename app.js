// ==== Supabase 初始化（请替换为你的项目配置） ====
const SUPABASE_URL = "https://tiocyqavswmkpppwnwvh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jtGLHTcxeR4MpL97MXkfzA_HQ43yCYd";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==== 全局状态 ====
const state = {
  user: null, // { id, username, is_admin }
  details: {
    type: null, // 'income' | 'expense'
    rows: [],
    modified: new Set(),
    deleted: new Set(),
    sort: { key: null, direction: null },
  },
};

// ==== 工具函数 ====
function $(selector) {
  return document.querySelector(selector);
}

function createElement(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else {
      el.setAttribute(k, v);
    }
  });
  children.forEach((child) => el.appendChild(child));
  return el;
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("page-active"));
  const page = document.getElementById(pageId);
  if (page) {
    page.classList.add("page-active");
  }
}

function saveSession(user) {
  state.user = user;
  localStorage.setItem("family_bookkeeping_user", JSON.stringify(user));
}

function loadSession() {
  try {
    const raw = localStorage.getItem("family_bookkeeping_user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    state.user = user;
    return user;
  } catch {
    return null;
  }
}

function clearSession() {
  state.user = null;
  localStorage.removeItem("family_bookkeeping_user");
}

function formatDateTimeLocal(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

// ==== 登录逻辑 ====
async function handleLogin(event) {
  event.preventDefault();
  const username = $("#login-username").value.trim();
  const password = $("#login-password").value;
  const errorEl = $("#login-error");
  errorEl.textContent = "";

  if (!username || !password) {
    errorEl.textContent = "请输入用户名和密码";
    return;
  }

  const { data, error } = await supabaseClient
    .from("users")
    .select("id, username, password, is_admin")
    .eq("username", username)
    .single();

  if (error || !data || data.password !== password) {
    errorEl.textContent = "用户名或密码错误";
    return;
  }

  const user = { id: data.id, username: data.username, is_admin: !!data.is_admin };
  saveSession(user);
  initAfterLogin();
}

function initAfterLogin() {
  if (!state.user) return;
  $("#home-username").textContent = `当前用户：${state.user.username}`;
  $("#income-user").value = state.user.username;
  $("#expense-user").value = state.user.username;
  resetIncomeForm();
  resetExpenseForm();
  showPage("page-home");
}

// ==== 首页导航 ====
function setupNavigation() {
  document.querySelectorAll("#page-home .btn-menu[data-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-target");
      if (target === "page-users" || target === "page-accounts") {
        if (!state.user?.is_admin) {
          alert("只有管理员可以访问该页面");
          return;
        }
      }
      showPage(target);
      if (target === "page-accounts") {
        loadAccounts();
      } else if (target === "page-users") {
        loadUsers();
      } else if (target === "page-details") {
        resetDetailsView();
      }
    });
  });

  document.querySelectorAll("[data-back-home]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showPage("page-home");
    });
  });

  $("#btn-logout").addEventListener("click", () => {
    clearSession();
    showPage("page-login");
  });
}

// ==== 收入类型联动 ====
function updateIncomeType2Options() {
  const type1 = $("#income-type-1").value;
  const select = $("#income-type-2");
  select.innerHTML = '<option value="">请选择</option>';
  let options = [];
  if (type1 === "工资") {
    options = ["月薪", "年终奖", "其他工资"];
  } else if (type1 === "其他收入") {
    options = ["房租", "其他收入"];
  }
  options.forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    select.appendChild(o);
  });
}

// ==== 动态财帐行 ====
async function fetchAccountsForSelect() {
  const { data, error } = await supabaseClient
    .from("accounts")
    .select("id, name")
    .order("id");
  if (error) {
    console.error("加载财帐失败", error);
    return [];
  }
  return data || [];
}

async function addAccountRow(listEl, isIncome) {
  const accounts = await fetchAccountsForSelect();
  const row = document.createElement("div");
  row.className = "account-row";

  const select = document.createElement("select");
  select.required = true;
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "选择财帐";
  select.appendChild(defaultOpt);
  accounts.forEach((acc) => {
    const o = document.createElement("option");
    o.value = acc.id;
    o.textContent = acc.name;
    select.appendChild(o);
  });

  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "0.01";
  input.required = true;
  input.placeholder = isIncome ? "计入金额" : "支出金额";

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "btn btn-danger btn-ghost-small";
  delBtn.textContent = "-";
  delBtn.addEventListener("click", () => {
    const rows = listEl.querySelectorAll(".account-row");
    if (rows.length <= 1) return;
    row.remove();
  });

  row.appendChild(select);
  row.appendChild(input);
  row.appendChild(delBtn);
  listEl.appendChild(row);
}

function resetIncomeForm() {
  $("#income-datetime").value = formatDateTimeLocal();
  $("#income-type-1").value = "";
  updateIncomeType2Options();
  $("#income-type-2").value = "";
  $("#income-net").value = "";
  $("#income-gross").value = "";
  $("#income-tax").value = "";
  $("#income-note").value = "";
  $("#income-error").textContent = "";
  const list = $("#income-accounts-list");
  list.innerHTML = "";
  addAccountRow(list, true);
}

function resetExpenseForm() {
  $("#expense-datetime").value = formatDateTimeLocal();
  $("#expense-type-1").value = "";
  $("#expense-note").value = "";
  $("#expense-amount").value = "";
  $("#expense-error").textContent = "";
  const list = $("#expense-accounts-list");
  list.innerHTML = "";
  addAccountRow(list, false);
}

// ==== 记收入提交 ====
async function handleIncomeSubmit() {
  const errorEl = $("#income-error");
  errorEl.textContent = "";
  const user = state.user;
  if (!user) {
    errorEl.textContent = "请先登录";
    return;
  }

  const datetime = $("#income-datetime").value;
  const type1 = $("#income-type-1").value;
  const type2 = $("#income-type-2").value;
  const net = parseFloat($("#income-net").value || "0");
  const gross = $("#income-gross").value ? parseFloat($("#income-gross").value) : null;
  const tax = $("#income-tax").value ? parseFloat($("#income-tax").value) : null;
  const note = $("#income-note").value.trim();

  if (!datetime || !type1 || !type2 || !net) {
    errorEl.textContent = "请完整填写必填字段";
    return;
  }
  if ((type2 === "其他工资" || type2 === "其他收入") && !note) {
    errorEl.textContent = "当类型为“其他工资”或“其他收入”时，备注必填";
    return;
  }

  const list = $("#income-accounts-list");
  const rows = list.querySelectorAll(".account-row");
  if (rows.length === 0) {
    errorEl.textContent = "至少需要一个财帐";
    return;
  }
  const accountRows = [];
  let sum = 0;
  for (const row of rows) {
    const sel = row.querySelector("select");
    const input = row.querySelector("input");
    const accId = sel.value;
    const amount = parseFloat(input.value || "0");
    if (!accId || !amount) {
      errorEl.textContent = "财帐和金额均需填写";
      return;
    }
    sum += amount;
    accountRows.push({ account_id: Number(accId), amount });
  }
  const diff = Math.abs(sum - net);
  if (diff > 3) {
    errorEl.textContent = "计入财帐金额总和与实际到手金额差异不可大于 3.0";
    return;
  }

  const { data, error } = await supabaseClient
    .from("transactions")
    .insert({
      type: "income",
      user_id: user.id,
      record_time: new Date(datetime).toISOString(),
      income_type_1: type1,
      income_type_2: type2,
      income_net: net,
      income_gross: gross,
      income_tax: tax,
      note,
      total_account_amount: sum,
    })
    .select("id")
    .single();

  if (error) {
    console.error(error);
    errorEl.textContent = "保存收入记录失败";
    return;
  }

  const transactionId = data.id;
  const { error: accErr } = await supabaseClient.from("transaction_accounts").insert(
    accountRows.map((r) => ({
      transaction_id: transactionId,
      account_id: r.account_id,
      amount: r.amount,
    }))
  );

  if (accErr) {
    console.error(accErr);
    errorEl.textContent = "保存财帐分配失败";
    return;
  }

  alert("记收入成功");
  resetIncomeForm();
}

// ==== 记支出提交 ====
async function handleExpenseSubmit() {
  const errorEl = $("#expense-error");
  errorEl.textContent = "";
  const user = state.user;
  if (!user) {
    errorEl.textContent = "请先登录";
    return;
  }

  const datetime = $("#expense-datetime").value;
  const type1 = $("#expense-type-1").value;
  const note = $("#expense-note").value.trim();
  const amount = parseFloat($("#expense-amount").value || "0");

  if (!datetime || !type1 || !note || !amount) {
    errorEl.textContent = "请完整填写必填字段";
    return;
  }

  const list = $("#expense-accounts-list");
  const rows = list.querySelectorAll(".account-row");
  if (rows.length === 0) {
    errorEl.textContent = "至少需要一个支出财帐";
    return;
  }

  const accountRows = [];
  for (const row of rows) {
    const sel = row.querySelector("select");
    const input = row.querySelector("input");
    const accId = sel.value;
    const amt = parseFloat(input.value || "0");
    if (!accId || !amt) {
      errorEl.textContent = "财帐和金额均需填写";
      return;
    }
    accountRows.push({ account_id: Number(accId), amount: amt });
  }

  const { data, error } = await supabaseClient
    .from("transactions")
    .insert({
      type: "expense",
      user_id: user.id,
      record_time: new Date(datetime).toISOString(),
      expense_type_1: type1,
      expense_note: note,
      expense_amount: amount,
      total_account_amount: accountRows.reduce((s, r) => s + r.amount, 0),
    })
    .select("id")
    .single();

  if (error) {
    console.error(error);
    errorEl.textContent = "保存支出记录失败";
    return;
  }

  const transactionId = data.id;
  const { error: accErr } = await supabaseClient.from("transaction_accounts").insert(
    accountRows.map((r) => ({
      transaction_id: transactionId,
      account_id: r.account_id,
      amount: r.amount,
    }))
  );

  if (accErr) {
    console.error(accErr);
    errorEl.textContent = "保存支出财帐分配失败";
    return;
  }

  alert("记支出成功");
  resetExpenseForm();
}

// ==== 明细管理 ====
function resetDetailsView() {
  state.details = {
    type: null,
    rows: [],
    modified: new Set(),
    deleted: new Set(),
    sort: { key: null, direction: null },
  };
  $("#details-tip").style.display = "block";
  $("#details-table thead").innerHTML = "";
  $("#details-table tbody").innerHTML = "";
}

async function loadDetails(type) {
  state.details.type = type;
  state.details.modified.clear();
  state.details.deleted.clear();

  const { data, error } = await supabaseClient
    .from("transactions")
    .select("* , users!inner(username)")
    .eq("type", type)
    .order("record_time", { ascending: false });

  if (error) {
    console.error(error);
    alert("加载明细失败");
    return;
  }

  state.details.rows = data || [];
  renderDetailsTable();
}

function renderDetailsTable() {
  const type = state.details.type;
  const thead = $("#details-table thead");
  const tbody = $("#details-table tbody");
  $("#details-tip").style.display = "none";

  thead.innerHTML = "";
  tbody.innerHTML = "";

  if (!type) return;

  let columns;
  if (type === "income") {
    columns = [
      { key: "typeLabel", label: "类型" },
      { key: "username", label: "记账人" },
      { key: "record_time", label: "记录时间" },
      { key: "income_type_1", label: "收入类型I" },
      { key: "income_type_2", label: "收入类型II" },
      { key: "income_net", label: "实际到手" },
      { key: "income_gross", label: "税前" },
      { key: "income_tax", label: "税额" },
      { key: "note", label: "备注" },
    ];
  } else {
    columns = [
      { key: "typeLabel", label: "类型" },
      { key: "username", label: "记账人" },
      { key: "record_time", label: "记录时间" },
      { key: "expense_type_1", label: "支出类型I" },
      { key: "expense_note", label: "支出备注" },
      { key: "expense_amount", label: "支出金额" },
    ];
  }

  const headerRow = document.createElement("tr");
  headerRow.appendChild(createElement("th", { class: "table-delete-cell" }));
  columns.forEach((col) => {
    const th = createElement("th", { text: col.label });
    th.addEventListener("click", () => toggleDetailsSort(col.key));
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  state.details.rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.dataset.id = row.id;

    const delCell = createElement("td", { class: "table-delete-cell" });
    const delBtn = createElement(
      "button",
      {
        class: "table-delete-btn",
        type: "button",
        onClick: () => {
          state.details.deleted.add(row.id);
          tr.style.display = "none";
        },
      },
      []
    );
    delBtn.textContent = "-";
    delCell.appendChild(delBtn);
    tr.appendChild(delCell);

    columns.forEach((col) => {
      const td = document.createElement("td");
      let value;
      if (col.key === "typeLabel") {
        value = type === "income" ? "收入" : "支出";
      } else if (col.key === "username") {
        value = row.users?.username || "";
      } else if (col.key === "record_time") {
        value = row.record_time ? row.record_time.slice(0, 16).replace("T", " ") : "";
      } else {
        value = row[col.key] ?? "";
      }

      const input = document.createElement("input");
      input.type = "text";
      input.value = value;
      input.className = "table-input";
      const readonly =
        col.key === "typeLabel" || col.key === "username" || col.key === "record_time";
      if (readonly) {
        input.readOnly = true;
      } else {
        input.addEventListener("change", () => {
          td.classList.add("cell-modified");
          state.details.modified.add(row.id);
          if (col.key === "income_net" || col.key === "income_gross" || col.key === "income_tax") {
            row[col.key] = input.value ? parseFloat(input.value) : null;
          } else if (col.key === "expense_amount") {
            row[col.key] = input.value ? parseFloat(input.value) : null;
          } else {
            row[col.key] = input.value;
          }
        });
      }

      td.appendChild(input);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

function toggleDetailsSort(key) {
  const sort = state.details.sort;
  if (sort.key === key) {
    sort.direction = sort.direction === "asc" ? "desc" : "asc";
  } else {
    sort.key = key;
    sort.direction = "asc";
  }

  const dir = sort.direction === "asc" ? 1 : -1;
  state.details.rows.sort((a, b) => {
    let va;
    let vb;
    if (key === "username") {
      va = a.users?.username || "";
      vb = b.users?.username || "";
    } else if (key === "record_time") {
      va = a.record_time || "";
      vb = b.record_time || "";
    } else {
      va = a[key];
      vb = b[key];
    }
    if (va == null) va = "";
    if (vb == null) vb = "";
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });

  renderDetailsTable();
}

async function saveDetailsChanges() {
  const type = state.details.type;
  if (!type) return;
  const modifiedIds = Array.from(state.details.modified);
  const deletedIds = Array.from(state.details.deleted);

  for (const id of deletedIds) {
    await supabaseClient.from("transactions").delete().eq("id", id);
  }
  for (const id of modifiedIds) {
    const row = state.details.rows.find((r) => r.id === id);
    if (!row) continue;
    const patch = {};
    if (type === "income") {
      patch.income_type_1 = row.income_type_1 ?? null;
      patch.income_type_2 = row.income_type_2 ?? null;
      patch.income_net = row.income_net ?? null;
      patch.income_gross = row.income_gross ?? null;
      patch.income_tax = row.income_tax ?? null;
      patch.note = row.note ?? null;
    } else {
      patch.expense_type_1 = row.expense_type_1 ?? null;
      patch.expense_note = row.expense_note ?? null;
      patch.expense_amount = row.expense_amount ?? null;
    }
    await supabaseClient.from("transactions").update(patch).eq("id", id);
  }

  alert("明细已保存");
  await loadDetails(type);
}

// ==== 财帐管理 ====
async function loadAccounts() {
  const tbody = $("#accounts-table tbody");
  tbody.innerHTML = "";
  const { data, error } = await supabaseClient.from("accounts").select("*").order("id");
  if (error) {
    console.error(error);
    $("#accounts-error").textContent = "加载财帐失败";
    return;
  }
  $("#accounts-error").textContent = "";

  (data || []).forEach((acc) => appendAccountRow(acc));
}

function appendAccountRow(acc, isNew = false) {
  const tbody = $("#accounts-table tbody");
  const tr = document.createElement("tr");
  tr.dataset.id = acc.id || "";
  tr.dataset.new = isNew ? "1" : "0";

  const delCell = document.createElement("td");
  delCell.className = "table-delete-cell";
  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "table-delete-btn";
  delBtn.textContent = "-";
  delBtn.addEventListener("click", () => {
    tr.dataset.deleted = "1";
    tr.style.display = "none";
  });
  delCell.appendChild(delBtn);
  tr.appendChild(delCell);

  const idCell = document.createElement("td");
  idCell.textContent = acc.id ?? "";
  tr.appendChild(idCell);

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = acc.name || "";
  nameInput.className = "table-input";
  const nameCell = document.createElement("td");
  nameCell.appendChild(nameInput);
  tr.appendChild(nameCell);

  const usageInput = document.createElement("input");
  usageInput.type = "text";
  usageInput.value = acc.usage || "";
  usageInput.className = "table-input";
  const usageCell = document.createElement("td");
  usageCell.appendChild(usageInput);
  tr.appendChild(usageCell);

  const cardInput = document.createElement("input");
  cardInput.type = "text";
  cardInput.value = acc.bank_card || "";
  cardInput.className = "table-input";
  const cardCell = document.createElement("td");
  cardCell.appendChild(cardInput);
  tr.appendChild(cardCell);

  tbody.appendChild(tr);
}

async function saveAccounts() {
  const rows = Array.from($("#accounts-table tbody").querySelectorAll("tr"));
  const names = [];
  for (const tr of rows) {
    if (tr.dataset.deleted === "1") continue;
    const name = tr.children[2].querySelector("input").value.trim();
    if (!name) {
      $("#accounts-error").textContent = "财帐名称不能为空";
      return;
    }
    names.push(name);
  }
  const nameSet = new Set(names);
  if (nameSet.size !== names.length) {
    $("#accounts-error").textContent = "财帐名称必须唯一";
    return;
  }

  for (const tr of rows) {
    const id = tr.dataset.id ? Number(tr.dataset.id) : null;
    const name = tr.children[2].querySelector("input").value.trim();
    const usage = tr.children[3].querySelector("input").value.trim();
    const bank_card = tr.children[4].querySelector("input").value.trim();

    if (tr.dataset.deleted === "1" && id) {
      await supabaseClient.from("accounts").delete().eq("id", id);
      continue;
    }

    if (!name) continue;

    if (!id) {
      await supabaseClient.from("accounts").insert({ name, usage, bank_card });
    } else {
      await supabaseClient.from("accounts").update({ name, usage, bank_card }).eq("id", id);
    }
  }

  alert("财帐已保存");
  loadAccounts();
}

function resetAccounts() {
  loadAccounts();
}

// ==== 用户管理 ====
async function loadUsers() {
  const tbody = $("#users-table tbody");
  tbody.innerHTML = "";
  const { data, error } = await supabaseClient.from("users").select("*").order("id");
  if (error) {
    console.error(error);
    $("#users-error").textContent = "加载用户失败";
    return;
  }
  $("#users-error").textContent = "";

  (data || []).forEach((u) => appendUserRow(u));
}

function appendUserRow(user, isNew = false) {
  const tbody = $("#users-table tbody");
  const tr = document.createElement("tr");
  tr.dataset.id = user.id || "";
  tr.dataset.new = isNew ? "1" : "0";

  const isInitialAdmin = user.id === 1 && user.username === "tz";

  const delCell = document.createElement("td");
  delCell.className = "table-delete-cell";
  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "table-delete-btn";
  delBtn.textContent = "-";
  if (isInitialAdmin) {
    delBtn.disabled = true;
  } else {
    delBtn.addEventListener("click", () => {
      tr.dataset.deleted = "1";
      tr.style.display = "none";
    });
  }
  delCell.appendChild(delBtn);
  tr.appendChild(delCell);

  const idCell = document.createElement("td");
  idCell.textContent = user.id ?? "";
  tr.appendChild(idCell);

  const usernameInput = document.createElement("input");
  usernameInput.type = "text";
  usernameInput.value = user.username || "";
  usernameInput.className = "table-input";
  if (isInitialAdmin) {
    usernameInput.readOnly = true;
  }
  const usernameCell = document.createElement("td");
  usernameCell.appendChild(usernameInput);
  tr.appendChild(usernameCell);

  const passwordInput = document.createElement("input");
  passwordInput.type = "text";
  passwordInput.value = user.password || "";
  passwordInput.className = "table-input";
  if (isInitialAdmin) {
    passwordInput.readOnly = true;
  }
  const passwordCell = document.createElement("td");
  passwordCell.appendChild(passwordInput);
  tr.appendChild(passwordCell);

  tbody.appendChild(tr);
}

async function saveUsers() {
  const rows = Array.from($("#users-table tbody").querySelectorAll("tr"));
  const usernames = [];
  for (const tr of rows) {
    if (tr.dataset.deleted === "1") continue;
    const username = tr.children[2].querySelector("input").value.trim();
    if (!username) {
      $("#users-error").textContent = "用户名不能为空";
      return;
    }
    usernames.push(username);
  }
  const set = new Set(usernames);
  if (set.size !== usernames.length) {
    $("#users-error").textContent = "用户名必须唯一";
    return;
  }

  for (const tr of rows) {
    const id = tr.dataset.id ? Number(tr.dataset.id) : null;
    const username = tr.children[2].querySelector("input").value.trim();
    const password = tr.children[3].querySelector("input").value.trim();
    const isInitialAdmin = id === 1 && username === "tz";

    if (tr.dataset.deleted === "1" && id && !isInitialAdmin) {
      await supabaseClient.from("users").delete().eq("id", id);
      continue;
    }

    if (!username || !password) continue;

    if (!id) {
      await supabaseClient.from("users").insert({ username, password, is_admin: false });
    } else if (!isInitialAdmin) {
      await supabaseClient
        .from("users")
        .update({ username, password })
        .eq("id", id);
    }
  }

  alert("用户信息已保存");
  loadUsers();
}

function resetUsers() {
  loadUsers();
}

// ==== 事件绑定 ====
function setupEventListeners() {
  $("#login-form").addEventListener("submit", handleLogin);
  $("#income-type-1").addEventListener("change", updateIncomeType2Options);
  $("#income-accounts-add").addEventListener("click", () =>
    addAccountRow($("#income-accounts-list"), true)
  );
  $("#expense-accounts-add").addEventListener("click", () =>
    addAccountRow($("#expense-accounts-list"), false)
  );
  $("#income-submit").addEventListener("click", (e) => {
    e.preventDefault();
    handleIncomeSubmit();
  });
  $("#income-reset").addEventListener("click", (e) => {
    e.preventDefault();
    resetIncomeForm();
  });
  $("#expense-submit").addEventListener("click", (e) => {
    e.preventDefault();
    handleExpenseSubmit();
  });
  $("#expense-reset").addEventListener("click", (e) => {
    e.preventDefault();
    resetExpenseForm();
  });

  $("#details-income").addEventListener("click", () => loadDetails("income"));
  $("#details-expense").addEventListener("click", () => loadDetails("expense"));
  $("#details-save").addEventListener("click", saveDetailsChanges);
  $("#details-reset").addEventListener("click", () => {
    if (!state.details.type) return;
    loadDetails(state.details.type);
  });

  $("#accounts-add").addEventListener("click", () =>
    appendAccountRow({ id: null, name: "", usage: "", bank_card: "" }, true)
  );
  $("#accounts-save").addEventListener("click", saveAccounts);
  $("#accounts-reset").addEventListener("click", (e) => {
    e.preventDefault();
    resetAccounts();
  });

  $("#users-add").addEventListener("click", () =>
    appendUserRow({ id: null, username: "", password: "" }, true)
  );
  $("#users-save").addEventListener("click", saveUsers);
  $("#users-reset").addEventListener("click", (e) => {
    e.preventDefault();
    resetUsers();
  });
}

// ==== 初始化 ====
window.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupEventListeners();

  const user = loadSession();
  if (user) {
    initAfterLogin();
  } else {
    showPage("page-login");
  }
});


const SUPABASE_URL = "https://fpwucoinxomhvtqrpabw.supabase.co";
const SUPABASE_KEY = "sb_publishable_F8ON8ZRtSct2f44fgEuNHw_yVsaFyjj";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentConversation = null;
let allProducts = [];

const $ = (id) => document.getElementById(id);

function toast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

function showPage(page) {
  document.querySelectorAll(".page").forEach(p => {
    p.classList.remove("active-page");
  });

  const target = $(page + "Page");
  if (target) target.classList.add("active-page");

  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  if (page === "home") loadProducts();
  if (page === "search") renderSearch();
  if (page === "favorites") loadFavorites();
  if (page === "chat") loadConversations();
  if (page === "account") updateAccountUI();
}

document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-page]");
  if (!button) return;

  e.preventDefault();
  showPage(button.dataset.page);

  const nav = $("mainNav");
  if (nav) nav.classList.remove("open");
});

const menuBtn = $("menuBtn");

if (menuBtn) {
  menuBtn.addEventListener("click", () => {
    $("mainNav")?.classList.toggle("open");
  });
}

async function loadProducts() {
  const { data, error } = await db
    .from("products")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    toast("خطا در دریافت آگهی‌ها");
    return;
  }

  allProducts = data || [];
  renderProducts(allProducts, $("homeProducts"));
  renderProducts(allProducts, $("searchProducts"));
}

function renderProducts(products, container) {
  if (!container) return;

  if (!products.length) {
    container.innerHTML =
      `<p class="muted">هنوز آگهی‌ای ثبت نشده است.</p>`;
    return;
  }

  container.innerHTML = products.map(product => {
    const image = product.image_url
      ? `<img src="${escapeHtml(product.image_url)}" alt="">`
      : `<div class="no-image">🛍️</div>`;

    return `
      <article class="product-card">
        ${image}
        <div class="product-info">
          <h3>${escapeHtml(product.title)}</h3>
          <strong>${Number(product.price || 0).toLocaleString("fa-AF")} افغانی</strong>
          <p>${escapeHtml(product.city || "")}</p>
          <small>${escapeHtml(product.category || "سایر")}</small>
          <p>${escapeHtml(product.description || "")}</p>

          <div class="card-actions">
            <button class="secondary favorite-btn" data-product="${product.id}">
              ⭐ علاقه‌مندی
            </button>

            ${
              currentUser && currentUser.id !== product.user_id
              ? `<button class="primary chat-btn"
                    data-product="${product.id}"
                    data-seller="${product.user_id}">
                    💬 چت با فروشنده
                 </button>`
              : ""
            }

            ${
              currentUser && currentUser.id === product.user_id
              ? `<button class="danger delete-product"
                    data-product="${product.id}">
                    حذف
                 </button>`
              : ""
            }
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function addProduct(e) {
  e.preventDefault();

  if (!currentUser) {
    toast("اول وارد حساب شو");
    showPage("account");
    return;
  }

  const product = {
    user_id: currentUser.id,
    title: $("productTitle").value.trim(),
    price: Number($("productPrice").value),
    category: $("productCategory").value,
    city: $("productCity").value,
    description: $("productDescription").value.trim(),
    image_url: $("productImage").value.trim() || null,
    status: "active"
  };

  const { error } = await db.from("products").insert(product);

  if (error) {
    console.error(error);
    toast("ثبت آگهی ناموفق بود");
    return;
  }

  $("productForm").reset();
  toast("آگهی با موفقیت ثبت شد");
  await loadProducts();
  showPage("home");
}

$("productForm")?.addEventListener("submit", addProduct);

async function deleteProduct(productId) {
  if (!currentUser) return;

  const { error } = await db
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("user_id", currentUser.id);

  if (error) {
    toast("حذف ناموفق بود");
    return;
  }

  toast("آگهی حذف شد");
  loadProducts();
}

async function toggleFavorite(productId) {
  if (!currentUser) {
    toast("برای علاقه‌مندی اول وارد حساب شو");
    showPage("account");
    return;
  }

  const { data } = await db
    .from("favorites")
    .select("product_id")
    .eq("user_id", currentUser.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (data) {
    await db
      .from("favorites")
      .delete()
      .eq("user_id", currentUser.id)
      .eq("product_id", productId);

    toast("از علاقه‌مندی حذف شد");
  } else {
    await db.from("favorites").insert({
      user_id: currentUser.id,
      product_id: productId
    });

    toast("به علاقه‌مندی اضافه شد");
  }
}

async function loadFavorites() {
  if (!currentUser) {
    $("favoriteProducts").innerHTML =
      `<p class="muted">برای دیدن علاقه‌مندی‌ها وارد حساب شو.</p>`;
    return;
  }

  const { data, error } = await db
    .from("favorites")
    .select("product_id, products(*)")
    .eq("user_id", currentUser.id);

  if (error) {
    console.error(error);
    return;
  }

  const products = (data || [])
    .map(x => x.products)
    .filter(Boolean);

  renderProducts(products, $("favoriteProducts"));
}

function renderSearch() {
  const text = ($("searchInput")?.value || "").toLowerCase();
  const category = $("categoryFilter")?.value || "";
  const city = $("cityFilter")?.value || "";

  const filtered = allProducts.filter(p => {
    const matchText =
      !text ||
      p.title.toLowerCase().includes(text) ||
      (p.description || "").toLowerCase().includes(text);

    const matchCategory =
      !category || p.category === category;

    const matchCity =
      !city || p.city === city;

    return matchText && matchCategory && matchCity;
  });

  renderProducts(filtered, $("searchProducts"));
}

$("searchInput")?.addEventListener("input", renderSearch);
$("categoryFilter")?.addEventListener("change", renderSearch);
$("cityFilter")?.addEventListener("change", renderSearch);

async function updateAccountUI() {
  const status = $("accountStatus");
  const profileForm = $("profileForm");
  const logoutBtn = $("logoutBtn");

  if (!currentUser) {
    status.innerHTML =
      `<p class="muted">وارد حساب نشده‌ای.</p>`;
    if (profileForm) profileForm.hidden = true;
    if (logoutBtn) logoutBtn.hidden = true;
    return;
  }

  status.innerHTML =
    `<p>وارد شده با: <b>${escapeHtml(currentUser.email)}</b></p>`;

  if (profileForm) profileForm.hidden = false;
  if (logoutBtn) logoutBtn.hidden = false;

  const { data } = await db
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (data) {
    $("displayName").value = data.display_name || "";
    $("profileCity").value = data.city || "";
  }
}

$("profileForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) return;

  const { error } = await db.from("profiles").upsert({
    id: currentUser.id,
    display_name: $("displayName").value.trim() || "کاربر بازارچه",
    city: $("profileCity").value || null
  });

  if (error) {
    console.error(error);
    toast("ذخیره پروفایل ناموفق بود");
    return;
  }

  toast("پروفایل ذخیره شد");
});

$("authForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = $("email").value.trim();
  const password = $("password").value;

  const { error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    toast("ورود ناموفق: " + error.message);
    return;
  }

  toast("با موفقیت وارد شدی");
});

$("signupBtn")?.addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || password.length < 6) {
    toast("ایمیل و رمز حداقل ۶ حرف وارد کن");
    return;
  }

  const { data, error } = await db.auth.signUp({
    email,
    password
  });

  if (error) {
    toast("ثبت‌نام ناموفق: " + error.message);
    return;
  }

  if (data.session) {
    toast("ثبت‌نام انجام شد");
  } else {
    toast("ثبت‌نام شد؛ ایمیل تأیید را بررسی کن");
  }
});

$("logoutBtn")?.addEventListener("click", async () => {
  await db.auth.signOut();
  currentUser = null;
  toast("از حساب خارج شدی");
  updateAccountUI();
  loadProducts();
});

$("resetBtn")?.addEventListener("click", async () => {
  const email = $("email").value.trim();

  if (!email) {
    toast("اول ایمیل خود را وارد کن");
    return;
  }

  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });

  if (error) {
    toast("خطا در ارسال لینک");
    return;
  }

  toast("لینک تغییر رمز به ایمیل فرستاده شد");
});

async function startChat(productId, sellerId) {
  if (!currentUser) {
    toast("اول وارد حساب شو");
    showPage("account");
    return;
  }

  if (currentUser.id === sellerId) {
    toast("نمی‌توانی با خودت چت کنی");
    return;
  }

  let { data: conversation } = await db
    .from("conversations")
    .select("*")
    .eq("product_id", productId)
    .eq("buyer_id", currentUser.id)
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (!conversation) {
    const result = await db
      .from("conversations")
      .insert({
        product_id: productId,
        buyer_id: currentUser.id,
        seller_id: sellerId
      })
      .select()
      .single();

    if (result.error) {
      console.error(result.error);
      toast("ساخت گفتگو ناموفق بود");
      return;
    }

    conversation = result.data;
  }

  currentConversation = conversation.id;
  showPage("chat");
  await loadConversations();
  await loadMessages(conversation.id);
}

async function loadConversations() {
  const list = $("conversationList");

  if (!list) return;

  if (!currentUser) {
    list.innerHTML =
      `<p class="muted">برای دیدن گفتگوها وارد حساب شو.</p>`;
    return;
  }

  const { data, error } = await db
    .from("conversations")
    .select("*")
    .or(`buyer_id.eq.${currentUser.id},seller_id.eq.${currentUser.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  if (!data?.length) {
    list.innerHTML =
      `<p class="muted">هنوز گفتگویی نداری.</p>`;
    return;
  }

  list.innerHTML = data.map(c => `
    <button class="conversation-item"
      data-conversation="${c.id}">
      💬 گفتگوی آگهی #${c.product_id || ""}
    </button>
  `).join("");
}

async function loadMessages(conversationId) {
  currentConversation = conversationId;

  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  const box = $("messages");

  if (!box) return;

  box.innerHTML = (data || []).map(m => `
    <div class="${m.sender_id === currentUser?.id ? "message mine" : "message"}">
      ${escapeHtml(m.body)}
    </div>
  `).join("");

  box.scrollTop = box.scrollHeight;

  if ($("chatHeader")) {
    $("chatHeader").textContent = "💬 گفتگو";
  }
}

$("conversationList")?.addEventListener("click", (e) => {
  const item = e.target.closest("[data-conversation]");
  if (!item) return;

  loadMessages(Number(item.dataset.conversation));
});

$("chatPage")?.addEventListener("click", (e) => {
  const favorite = e.target.closest(".favorite-btn");
  if (favorite) {
    toggleFavorite(Number(favorite.dataset.product));
    return;
  }

  const chat = e.target.closest(".chat-btn");
  if (chat) {
    startChat(
      Number(chat.dataset.product),
      chat.dataset.seller
    );
    return;
  }

  const del = e.target.closest(".delete-product");
  if (del) {
    deleteProduct(Number(del.dataset.product));
  }
});

document.addEventListener("click", (e) => {
  const favorite = e.target.closest(".favorite-btn");
  if (favorite) {
    toggleFavorite(Number(favorite.dataset.product));
  }

  const chat = e.target.closest(".chat-btn");
  if (chat) {
    startChat(
      Number(chat.dataset.product),
      chat.dataset.seller
    );
  }

  const del = e.target.closest(".delete-product");
  if (del) {
    deleteProduct(Number(del.dataset.product));
  }
});

$("messageForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser || !currentConversation) {
    toast("یک گفتگو را انتخاب کن");
    return;
  }

  const body = $("messageInput").value.trim();

  if (!body) return;

  const { error } = await db.from("messages").insert({
    conversation_id: currentConversation,
    sender_id: currentUser.id,
    body
  });

  if (error) {
    console.error(error);
    toast("ارسال پیام ناموفق بود");
    return;
  }

  $("messageInput").value = "";
  loadMessages(currentConversation);
});

$("darkToggle")?.addEventListener("change", (e) => {
  document.body.classList.toggle("dark", e.target.checked);
  localStorage.setItem("bazaarDark", e.target.checked ? "1" : "0");
});

function loadDarkMode() {
  const dark = localStorage.getItem("bazaarDark") === "1";

  document.body.classList.toggle("dark", dark);

  if ($("darkToggle")) {
    $("darkToggle").checked = dark;
  }
}

async function init() {
  loadDarkMode();

  const { data } = await db.auth.getSession();
  currentUser = data.session?.user || null;

  await loadProducts();
  await updateAccountUI();

  db.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    await updateAccountUI();
    await loadProducts();
  });
}

init();
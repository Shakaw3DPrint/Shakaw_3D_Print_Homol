// =============================================
// VARIÁVEIS GLOBAIS
// =============================================
const catalog         = document.getElementById("catalog");
const loader          = document.getElementById("loader");
const resultsCount    = document.getElementById("resultsCount");
const backToTopBtn    = document.getElementById("backToTopBtn");
const interestPanel   = document.getElementById("interestPanel");
const interestList    = document.getElementById("interestList");
const interestTotalEl = document.getElementById("interestTotal");
const imgModal        = document.getElementById("imgModal");
const modalImg        = document.getElementById("modalImg");
const contactModal    = document.getElementById("contactModal");
const selectedSummary = document.getElementById("selectedItemsSummary");
const itemsDataInput  = document.getElementById("itemsData");

const interests = [];
let interestPanelTimeoutId = null;

// Modal / zoom / pan
let currentProductImages = [];
let currentImageIndex    = 0;
let currentZoomLevel     = 1;
let isPanning            = false;
let panStartX = 0, panStartY = 0;
let panStartImgX = 0, panStartImgY = 0;
let currentImgTranslateX = 0, currentImgTranslateY = 0;

const ZOOM_INCREMENT = 0.15;
const MAX_ZOOM       = 5;
const MIN_ZOOM       = 1;

// Todos os produtos carregados (para filtro)
let allProducts = [];

// =============================================
// CARREGAMENTO DE PRODUTOS
// =============================================
async function loadProducts() {
  if (loader) loader.style.display = "block";
  try {
    const res = await fetch("assets/json/outros_produtos.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allProducts = await res.json();
    renderProducts(allProducts);
  } catch (err) {
    console.error("Erro ao carregar produtos:", err);
    if (catalog) catalog.innerHTML =
      "<p style='color:white;text-align:center;padding:40px'>Erro ao carregar produtos.</p>";
  } finally {
    if (loader) loader.style.display = "none";
  }
}

// =============================================
// RENDERIZAÇÃO
// =============================================
function renderProducts(products) {
  if (!catalog) return;
  catalog.innerHTML = "";

  if (products.length === 0) {
    catalog.innerHTML = `
      <div class="no-products">
        <i class="fas fa-box-open" style="font-size:3rem;opacity:0.4;display:block;margin-bottom:15px"></i>
        Nenhum produto encontrado nesta categoria.
      </div>`;
    if (resultsCount) resultsCount.textContent = "";
    return;
  }

  if (resultsCount) {
    resultsCount.textContent = `${products.length} produto${products.length > 1 ? "s" : ""} encontrado${products.length > 1 ? "s" : ""}`;
  }

  products.forEach((product, i) => {
    const validThumbs = Array.isArray(product.thumbnails)
      ? product.thumbnails.filter(t => t && typeof t === "string")
      : [];

    let allImgs = [];
    if (product.mainImage) allImgs.push(product.mainImage);
    allImgs = [...new Set([...allImgs, ...validThumbs])];

    // Badge de categoria
    const badgeClass = product.category === "action-figures"
      ? "badge-action-figures"
      : "badge-produtos-funcionais";
    const badgeLabel = product.category === "action-figures"
      ? "Action Figure"
      : "Produto Funcional";

    // Preço (opcional)
    const priceHTML = product.price
      ? `<p class="price">${product.price}</p>`
      : "";

    // Controle de quantidade (só se tiver preço)
    const qtyHTML = `
      <div class="quantity-control">
        <button class="qty-btn minus">-</button>
        <input type="number" class="quantity" value="1" min="1" readonly>
        <button class="qty-btn plus">+</button>
      </div>`;

    const productDiv = document.createElement("div");
    productDiv.className = "product";
    productDiv.style.animationDelay = `${i * 0.06}s`;

    // Coluna de imagem
    const imageCol = document.createElement("div");
    imageCol.className = "image-column";

    const mainImgEl = document.createElement("img");
    mainImgEl.src       = product.mainImage || "";
    mainImgEl.alt       = product.name;
    mainImgEl.className = "main-img";
    mainImgEl.addEventListener("click", () => openModal(mainImgEl.src, allImgs));
    imageCol.appendChild(mainImgEl);

    // Miniaturas
    const thumbContainer = document.createElement("div");
    thumbContainer.className = "thumbnail-container";
    validThumbs.forEach(src => {
      const t = document.createElement("img");
      t.src = src;
      t.alt = product.name;
      t.onerror = () => t.style.display = "none";
      t.addEventListener("click", () => { mainImgEl.src = src; });
      thumbContainer.appendChild(t);
    });
    imageCol.appendChild(thumbContainer);
    productDiv.appendChild(imageCol);

    // Detalhes
    const details = document.createElement("div");
    details.className = "product-details";
    details.innerHTML = `
      <span class="category-badge ${badgeClass}">${badgeLabel}</span>
      <h2>${product.name}</h2>
      <p>${product.description}</p>
      ${priceHTML}
      ${qtyHTML}
      <button class="add-interest-btn">Tenho Interesse</button>
    `;
    productDiv.appendChild(details);

    // Eventos de quantidade e interesse
    const qtyInput = details.querySelector(".quantity");
    details.querySelector(".qty-btn.minus").addEventListener("click", () => changeQty(qtyInput, -1));
    details.querySelector(".qty-btn.plus").addEventListener("click",  () => changeQty(qtyInput,  1));
    details.querySelector(".add-interest-btn").addEventListener("click", () => {
      addInterest(product.name, product.price || "", qtyInput.value);
    });

    catalog.appendChild(productDiv);
  });
}

// =============================================
// FILTROS
// =============================================
function initFilters() {
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const cat = btn.dataset.category;
      const filtered = cat === "all"
        ? allProducts
        : allProducts.filter(p => p.category === cat);

      renderProducts(filtered);
    });
  });
}

// =============================================
// QUANTIDADE
// =============================================
function changeQty(input, delta) {
  if (!input) return;
  let v = parseInt(input.value) + delta;
  if (v < 1) v = 1;
  input.value = v;
}

// =============================================
// MODAL — ZOOM E PAN
// =============================================
function checkImage(url) {
  return new Promise(resolve => {
    if (!url) { resolve({ url, status: "invalid" }); return; }
    const img = new Image();
    img.onload  = () => resolve({ url, status: "loaded" });
    img.onerror = () => resolve({ url, status: "error" });
    img.src = url;
  });
}

async function openModal(clickedSrc, allUrls) {
  if (!imgModal || !modalImg) return;

  let urls = [...new Set((allUrls || []).filter(u => u))];
  if (clickedSrc && !urls.includes(clickedSrc)) urls.unshift(clickedSrc);
  if (urls.length === 0) return;

  modalImg.style.opacity = "0";
  imgModal.style.display = "block";
  document.body.style.overflow = "hidden";

  const results = await Promise.all(urls.map(checkImage));
  currentProductImages = results.filter(r => r.status === "loaded").map(r => r.url);

  if (currentProductImages.length === 0) { closeModal(); return; }

  currentImageIndex = currentProductImages.indexOf(clickedSrc);
  if (currentImageIndex === -1) currentImageIndex = 0;

  loadModalImage(currentProductImages[currentImageIndex]);

  document.removeEventListener("keydown", handleModalKeydown);
  document.addEventListener("keydown", handleModalKeydown);
}

function loadModalImage(src) {
  if (!modalImg) return;
  modalImg.style.opacity = "0";
  modalImg.style.transition = "none";

  const onLoad = () => {
    resetZoomAndPan();
    modalImg.style.transition = "opacity 0.25s ease";
    modalImg.style.opacity    = "1";
    modalImg.removeEventListener("load",  onLoad);
    modalImg.removeEventListener("error", onErr);
  };
  const onErr = () => {
    modalImg.style.opacity = "1";
    modalImg.removeEventListener("load",  onLoad);
    modalImg.removeEventListener("error", onErr);
  };

  modalImg.addEventListener("load",  onLoad);
  modalImg.addEventListener("error", onErr);
  modalImg.src = src;
}

function closeModal() {
  if (!imgModal) return;
  imgModal.style.display = "none";
  document.body.style.overflow = "auto";
  document.removeEventListener("keydown", handleModalKeydown);
  resetZoomAndPan();
}

function navigateModal(step) {
  if (!modalImg || currentProductImages.length <= 1) return;
  currentImageIndex = (currentImageIndex + step + currentProductImages.length) % currentProductImages.length;
  loadModalImage(currentProductImages[currentImageIndex]);
}

function applyTransform() {
  if (!modalImg) return;
  modalImg.style.transform = `translate(${currentImgTranslateX}px, ${currentImgTranslateY}px) scale(${currentZoomLevel})`;
  modalImg.style.cursor = currentZoomLevel > MIN_ZOOM
    ? (isPanning ? "grabbing" : "grab")
    : "zoom-in";
}

function constrainPan() {
  if (!modalImg || !imgModal) return;
  const nW = modalImg.naturalWidth  || modalImg.offsetWidth;
  const nH = modalImg.naturalHeight || modalImg.offsetHeight;
  const mW = imgModal.clientWidth;
  const mH = imgModal.clientHeight;
  const ratio = nW / nH;
  const mRatio = mW / mH;

  let dW, dH;
  if (ratio > mRatio) { dW = mW; dH = mW / ratio; }
  else                { dH = mH; dW = mH * ratio; }

  const sW = dW * currentZoomLevel;
  const sH = dH * currentZoomLevel;
  const maxX = Math.max(0, (sW - mW) / 2);
  const maxY = Math.max(0, (sH - mH) / 2);

  currentImgTranslateX = Math.min(maxX, Math.max(-maxX, currentImgTranslateX));
  currentImgTranslateY = Math.min(maxY, Math.max(-maxY, currentImgTranslateY));
}

function zoomImage(amount, focal = null) {
  if (!modalImg || !imgModal) return;
  const oldZoom = currentZoomLevel;
  currentZoomLevel = Math.min(Math.max(currentZoomLevel + amount, MIN_ZOOM), MAX_ZOOM);

  if (currentZoomLevel === MIN_ZOOM && amount < 0) { resetZoomAndPan(); return; }

  const mW = imgModal.clientWidth;
  const mH = imgModal.clientHeight;
  const fX = focal ? focal.x - mW / 2 : 0;
  const fY = focal ? focal.y - mH / 2 : 0;
  const ratio = currentZoomLevel / oldZoom;

  currentImgTranslateX = fX + (currentImgTranslateX - fX) * ratio;
  currentImgTranslateY = fY + (currentImgTranslateY - fY) * ratio;

  constrainPan();
  applyTransform();
}

function resetZoomAndPan() {
  currentZoomLevel     = MIN_ZOOM;
  currentImgTranslateX = 0;
  currentImgTranslateY = 0;
  isPanning            = false;
  if (modalImg) {
    modalImg.style.transition = "transform 0.3s ease";
    applyTransform();
    setTimeout(() => { if (modalImg) modalImg.style.transition = "opacity 0.25s ease"; }, 320);
  }
}

function handlePanStart(e) {
  if (!modalImg || currentZoomLevel <= MIN_ZOOM) return;
  if (e.type === "mousedown" && e.button !== 0) return;
  e.preventDefault();
  isPanning = true;
  const p = e.type === "touchstart" ? e.touches[0] : e;
  panStartX = p.clientX; panStartY = p.clientY;
  panStartImgX = currentImgTranslateX; panStartImgY = currentImgTranslateY;
  modalImg.style.transition = "none";
  applyTransform();
  document.addEventListener("mousemove", handlePanMove);
  document.addEventListener("touchmove", handlePanMove, { passive: false });
  document.addEventListener("mouseup",   handlePanEnd);
  document.addEventListener("touchend",  handlePanEnd);
}

function handlePanMove(e) {
  if (!isPanning) return;
  e.preventDefault();
  const p = e.type === "touchmove" ? e.touches[0] : e;
  currentImgTranslateX = panStartImgX + (p.clientX - panStartX);
  currentImgTranslateY = panStartImgY + (p.clientY - panStartY);
  constrainPan();
  applyTransform();
}

function handlePanEnd() {
  if (!isPanning) return;
  isPanning = false;
  constrainPan();
  applyTransform();
  document.removeEventListener("mousemove", handlePanMove);
  document.removeEventListener("touchmove", handlePanMove);
  document.removeEventListener("mouseup",   handlePanEnd);
  document.removeEventListener("touchend",  handlePanEnd);
}

function handleWheelZoom(e) {
  if (!imgModal || imgModal.style.display !== "block") return;
  e.preventDefault();
  const rect = imgModal.getBoundingClientRect();
  const focal = {
    x: e.clientX - rect.left - rect.width  / 2,
    y: e.clientY - rect.top  - rect.height / 2
  };
  zoomImage(e.deltaY < 0 ? ZOOM_INCREMENT : -ZOOM_INCREMENT, focal);
}

function handleModalKeydown(e) {
  if (!imgModal || imgModal.style.display !== "block") return;
  switch (e.key) {
    case "ArrowRight": navigateModal(1);            break;
    case "ArrowLeft":  navigateModal(-1);           break;
    case "+": case "=": zoomImage(ZOOM_INCREMENT);  break;
    case "-":           zoomImage(-ZOOM_INCREMENT); break;
    case "0":           resetZoomAndPan();          break;
    case "Escape":      closeModal();               break;
  }
}

// =============================================
// SCROLL
// =============================================
window.onscroll = () => {
  if (backToTopBtn) {
    backToTopBtn.style.display =
      (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100)
        ? "block" : "none";
  }
};

// =============================================
// PREÇO
// =============================================
function parsePrice(str) {
  if (!str || typeof str !== "string") return 0;
  return parseFloat(str.replace("R$","").replace(".","").replace(",",".").trim()) || 0;
}

// =============================================
// PAINEL DE INTERESSES
// =============================================
function showInterestPanel(autoHide = false) {
  if (!interestPanel) return;
  interestPanel.classList.add("visible");
  interestPanel.classList.remove("hidden-fade");
  clearTimeout(interestPanelTimeoutId);
  if (autoHide && interests.length > 0) {
    interestPanelTimeoutId = setTimeout(hideInterestPanel, 5000);
  }
}

function hideInterestPanel() {
  if (!interestPanel) return;
  clearTimeout(interestPanelTimeoutId);
  interestPanel.classList.remove("visible");
  interestPanel.classList.add("hidden-fade");
}

function toggleInterestPanel() {
  if (!interestPanel) return;
  if (interestPanel.classList.contains("visible")) hideInterestPanel();
  else showInterestPanel(false);
}

function addInterest(name, priceStr, qty) {
  const quantity = parseInt(qty);
  const price    = parsePrice(priceStr);
  const existing = interests.find(i => i.name === name);
  if (existing) existing.quantity += quantity;
  else interests.push({ name, price, quantity, originalPriceString: priceStr });
  updateInterestPanel();
  showInterestPanel(true);
}

function updateInterestPanel() {
  if (!interestList) return;
  interestList.innerHTML = "";
  let total = 0;

  if (interests.length === 0) {
    interestList.innerHTML = "<li>Nenhum item adicionado.</li>";
    if (interestTotalEl) interestTotalEl.innerHTML = "";
    return;
  }

  interests.forEach((item, idx) => {
    const li = document.createElement("li");
    const priceLabel = item.originalPriceString || "Sob consulta";
    li.innerHTML = `
      ${item.name} (Qtd: ${item.quantity}) — ${priceLabel}
      <button class="remove-interest-item-btn" data-index="${idx}">Remover</button>
    `;
    interestList.appendChild(li);
    total += item.price * item.quantity;
  });

  document.querySelectorAll(".remove-interest-item-btn").forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener("click", () => removeInterest(parseInt(clone.dataset.index)));
  });

  if (interestTotalEl) {
    interestTotalEl.innerHTML = total > 0
      ? `<strong>Total: R$ ${total.toFixed(2).replace(".", ",")}</strong>`
      : "";
  }
}

function removeInterest(index) {
  interests.splice(index, 1);
  updateInterestPanel();
  if (interestPanel.classList.contains("visible")) showInterestPanel(true);
}

// =============================================
// MODAL DE CONTATO
// =============================================
function showContactModal() {
  if (interests.length === 0) {
    alert("Por favor, adicione itens à sua lista de interesses primeiro.");
    return;
  }
  if (selectedSummary) selectedSummary.innerHTML = "";
  let text = "";
  let total = 0;

  interests.forEach(item => {
    const div = document.createElement("div");
    const label = item.originalPriceString || "Sob consulta";
    div.innerHTML = `<strong>${item.quantity}x</strong> ${item.name} (${label})`;
    if (selectedSummary) selectedSummary.appendChild(div);
    text  += `${item.quantity}x ${item.name} (${label})\n`;
    total += item.price * item.quantity;
  });

  if (total > 0) text += `\nTotal Geral: R$ ${total.toFixed(2).replace(".", ",")}`;
  if (itemsDataInput) itemsDataInput.value = text.trim();
  if (contactModal) contactModal.style.display = "block";
  hideInterestPanel();
}

window.onclick = e => {
  if (imgModal    && e.target === imgModal)    closeModal();
  if (contactModal && e.target === contactModal) contactModal.style.display = "none";
};

// =============================================
// FORMULÁRIO
// =============================================
function initForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const orig = btn ? btn.innerHTML : "";
    if (btn) { btn.innerHTML = "Enviando..."; btn.disabled = true; }
    fetch(form.action, { method: "POST", body: new FormData(form) })
      .then(() => { window.location.href = "obrigado.html"; })
      .catch(err => {
        console.error(err);
        alert("Erro ao enviar. Tente novamente.");
        if (btn) { btn.innerHTML = orig; btn.disabled = false; }
      });
  });
}

// =============================================
// INICIALIZAÇÃO
// =============================================
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  initFilters();
  updateInterestPanel();

  if (interestPanel) {
    interestPanel.classList.remove("visible");
    interestPanel.classList.add("hidden-fade");
  }

  // Zoom com scroll
  if (imgModal) imgModal.addEventListener("wheel", handleWheelZoom, { passive: false });

  // Pan
  if (modalImg) {
    modalImg.addEventListener("mousedown", handlePanStart);
    modalImg.addEventListener("touchstart", handlePanStart, { passive: false });
    modalImg.addEventListener("contextmenu", e => e.preventDefault());
  }

  // Botões do modal
  const closeBtn  = document.querySelector("#imgModal .close");
  const prevBtn   = document.querySelector("#imgModal .modal-prev");
  const nextBtn   = document.querySelector("#imgModal .modal-next");
  const zoomCtrls = document.querySelector(".zoom-controls");

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (prevBtn)  prevBtn.addEventListener("click",  () => navigateModal(-1));
  if (nextBtn)  nextBtn.addEventListener("click",  () => navigateModal(1));

  if (zoomCtrls) {
    const [zIn, zOut, zReset] = zoomCtrls.children;
    if (zIn)    zIn.addEventListener("click",    () => zoomImage(ZOOM_INCREMENT));
    if (zOut)   zOut.addEventListener("click",   () => zoomImage(-ZOOM_INCREMENT));
    if (zReset) zReset.addEventListener("click", resetZoomAndPan);
  }

  // Topo
  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  // Painel
  const interestBtn    = document.querySelector(".interest-btn");
  const closePanelBtn  = document.getElementById("closeInterestPanelBtn");
  if (interestBtn)   interestBtn.addEventListener("click",   toggleInterestPanel);
  if (closePanelBtn) closePanelBtn.addEventListener("click", hideInterestPanel);

  // Contato
  const closeContact = document.querySelector("#contactModal .close-contact");
  if (closeContact) closeContact.addEventListener("click", () => {
    if (contactModal) contactModal.style.display = "none";
  });

  initForm();
});

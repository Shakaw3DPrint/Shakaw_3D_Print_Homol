// =============================================
// VARIÁVEIS GLOBAIS
// =============================================
const catalog = document.getElementById("catalog");
const loader = document.getElementById("loader");
const interests = [];
const backToTopBtn = document.getElementById("backToTopBtn");
const interestPanel = document.getElementById("interestPanel");
const interestList = document.getElementById("interestList");
const interestTotalElement = document.getElementById("interestTotal");
const imgModal = document.getElementById("imgModal");
const modalImg = document.getElementById("modalImg");
const contactModal = document.getElementById("contactModal");
const selectedItemsSummary = document.getElementById("selectedItemsSummary");
const itemsDataInput = document.getElementById("itemsData");

let currentImageIndex = 0;
let currentProductImages = [];
let currentZoomLevel = 1;
let interestPanelTimeoutId = null;

// Pan
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panStartImgX = 0;
let panStartImgY = 0;
let currentImgTranslateX = 0;
let currentImgTranslateY = 0;

const ZOOM_INCREMENT = 0.15;
const MAX_ZOOM = 5;
const MIN_ZOOM = 1;

// =============================================
// VERIFICAR IMAGEM
// =============================================
function checkImage(url) {
  return new Promise((resolve) => {
    if (!url || typeof url !== "string") {
      resolve({ url, status: "invalid_url" });
      return;
    }
    const img = new Image();
    img.onload  = () => resolve({ url, status: "loaded" });
    img.onerror = () => resolve({ url, status: "error" });
    img.src = url;
  });
}

// =============================================
// CARREGAMENTO DE PRODUTOS
// =============================================
async function loadProducts() {
  if (loader) loader.style.display = "block";
  try {
    const response = await fetch("assets/json/products.json");
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    const products = await response.json();
    displayProducts(products);
  } catch (error) {
    console.error("Falha ao carregar produtos:", error);
    if (catalog) catalog.innerHTML = "<p>Erro ao carregar produtos. Tente novamente mais tarde.</p>";
  } finally {
    if (loader) loader.style.display = "none";
  }
}

// =============================================
// EXIBIÇÃO DE PRODUTOS
// =============================================
function displayProducts(products) {
  if (!catalog) return;
  catalog.innerHTML = "";

  products.forEach(product => {
    const productDiv = document.createElement("div");
    productDiv.className = "product";

    const validThumbnails = product.thumbnails
      ? product.thumbnails.filter(t => t && typeof t === "string")
      : [];

    let allPotentialImages = [];
    if (product.mainImage && typeof product.mainImage === "string") {
      allPotentialImages.push(product.mainImage);
    }
    allPotentialImages = [...new Set([...allPotentialImages, ...validThumbnails])];

    // --- Coluna de imagem ---
    const imageColumn = document.createElement("div");
    imageColumn.className = "image-column";

    const mainImgElement = document.createElement("img");
    if (product.mainImage && typeof product.mainImage === "string") {
      mainImgElement.src = product.mainImage;
      mainImgElement.alt = product.name;
      mainImgElement.className = "main-img";
      mainImgElement.addEventListener("click", () => {
        openModal(mainImgElement.src, allPotentialImages);
      });
    } else {
      mainImgElement.style.display = "none";
    }
    imageColumn.appendChild(mainImgElement);

    const thumbnailContainer = document.createElement("div");
    thumbnailContainer.className = "thumbnail-container";
    validThumbnails.forEach(thumbSrc => {
      const thumbImg = document.createElement("img");
      thumbImg.src = thumbSrc;
      thumbImg.alt = `Thumbnail de ${product.name}`;
      thumbImg.onerror = function() {
        this.style.display = "none";
      };
      thumbImg.addEventListener("click", () => {
        mainImgElement.src = thumbSrc;
      });
      thumbnailContainer.appendChild(thumbImg);
    });
    imageColumn.appendChild(thumbnailContainer);
    productDiv.appendChild(imageColumn);

    // --- Detalhes ---
    const productDetails = document.createElement("div");
    productDetails.className = "product-details";
    productDetails.innerHTML = `
      <h2>${product.name}</h2>
      <p>${product.description}</p>
      <p class="price">${product.price}</p>
      <div class="quantity-control">
        <button class="qty-btn minus">-</button>
        <input type="number" class="quantity" value="1" min="1" readonly>
        <button class="qty-btn plus">+</button>
      </div>
      <button class="add-interest-btn">Tenho Interesse</button>
    `;
    productDiv.appendChild(productDetails);

    const quantityInput = productDetails.querySelector(".quantity");
    productDetails.querySelector(".qty-btn.minus").addEventListener("click", () => changeQuantity(quantityInput, -1));
    productDetails.querySelector(".qty-btn.plus").addEventListener("click",  () => changeQuantity(quantityInput,  1));
    productDetails.querySelector(".add-interest-btn").addEventListener("click", () => {
      addInterest(product.name, product.price, quantityInput.value);
    });

    catalog.appendChild(productDiv);
  });
}

// =============================================
// CARROSSEL
// =============================================
const carousel = document.getElementById("carousel");
const carouselIndicators = document.getElementById("carouselIndicators");
let carouselImagesData = [];
let currentCarouselIndex = 0;

async function loadCarouselImages() {
  if (!carousel || !carouselIndicators) return;
  try {
    const response = await fetch("assets/json/carousel.json");
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    carouselImagesData = await response.json();
    renderCarousel();
    startCarouselAutoPlay();
  } catch (error) {
    console.error("Falha ao carregar carrossel:", error);
  }
}

function renderCarousel() {
  if (!carousel || !carouselIndicators) return;
  carousel.innerHTML = "";
  carouselIndicators.innerHTML = "";
  carouselImagesData.forEach((image, index) => {
    const imgEl = document.createElement("img");
    imgEl.src = image.src;
    imgEl.alt = image.alt;
    carousel.appendChild(imgEl);

    const dot = document.createElement("div");
    dot.className = "carousel-indicator";
    dot.addEventListener("click", () => goToSlide(index));
    carouselIndicators.appendChild(dot);
  });
  updateCarousel();
}

function updateCarousel() {
  if (!carousel || carouselImagesData.length === 0) return;
  carousel.style.transform = `translateX(-${currentCarouselIndex * 100}%)`;
  document.querySelectorAll(".carousel-indicator").forEach((dot, i) => {
    dot.classList.toggle("active", i === currentCarouselIndex);
  });
}

function moveSlide(step) {
  if (carouselImagesData.length === 0) return;
  currentCarouselIndex = (currentCarouselIndex + step + carouselImagesData.length) % carouselImagesData.length;
  updateCarousel();
}

function goToSlide(index) {
  currentCarouselIndex = index;
  updateCarousel();
}

function startCarouselAutoPlay() {
  if (carouselImagesData.length > 1) setInterval(() => moveSlide(1), 5000);
}

// =============================================
// QUANTIDADE
// =============================================
function changeQuantity(input, delta) {
  if (!input) return;
  let val = parseInt(input.value) + delta;
  if (val < 1) val = 1;
  input.value = val;
}

// =============================================
// MODAL — ZOOM E PAN DINÂMICO
// =============================================
async function openModal(clickedSrc, allUrls) {
  if (!imgModal || !modalImg) return;

  let uniqueUrls = Array.isArray(allUrls)
    ? [...new Set(allUrls.filter(u => u && typeof u === "string"))]
    : [];

  if (clickedSrc && !uniqueUrls.includes(clickedSrc)) {
    uniqueUrls.unshift(clickedSrc);
    uniqueUrls = [...new Set(uniqueUrls)];
  }

  if (uniqueUrls.length === 0) { closeModal(); return; }

  // Mostra modal com loader
  modalImg.src = "";
  modalImg.style.opacity = "0";
  imgModal.style.display = "block";
  document.body.style.overflow = "hidden";

  const results = await Promise.all(uniqueUrls.map(u => checkImage(u)));
  currentProductImages = results.filter(r => r.status === "loaded").map(r => r.url);

  if (currentProductImages.length === 0) {
    alert("Não foi possível carregar nenhuma imagem.");
    closeModal();
    return;
  }

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
    // Fade in suave
    modalImg.style.transition = "opacity 0.25s ease";
    modalImg.style.opacity = "1";
    modalImg.removeEventListener("load",  onLoad);
    modalImg.removeEventListener("error", onError);
  };
  const onError = () => {
    modalImg.style.opacity = "1";
    modalImg.removeEventListener("load",  onLoad);
    modalImg.removeEventListener("error", onError);
  };

  modalImg.addEventListener("load",  onLoad);
  modalImg.addEventListener("error", onError);
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

// --- Transformação ---
function applyTransform() {
  if (!modalImg) return;
  modalImg.style.transform = `translate(${currentImgTranslateX}px, ${currentImgTranslateY}px) scale(${currentZoomLevel})`;
  modalImg.style.cursor = currentZoomLevel > MIN_ZOOM
    ? (isPanning ? "grabbing" : "grab")
    : "zoom-in";
}

// --- Limita pan para imagem nunca sair da tela ---
function constrainPan() {
  if (!modalImg || !imgModal) return;

  // Dimensões naturais da imagem (sem transform)
  const naturalW = modalImg.naturalWidth  || modalImg.offsetWidth;
  const naturalH = modalImg.naturalHeight || modalImg.offsetHeight;

  // Dimensões do modal (viewport do modal)
  const mW = imgModal.clientWidth;
  const mH = imgModal.clientHeight;

  // Tamanho que a imagem ocupa com object-fit:contain
  const imgRatio   = naturalW / naturalH;
  const modalRatio = mW / mH;

  let displayW, displayH;
  if (imgRatio > modalRatio) {
    displayW = mW;
    displayH = mW / imgRatio;
  } else {
    displayH = mH;
    displayW = mH * imgRatio;
  }

  // Tamanho escalado
  const scaledW = displayW * currentZoomLevel;
  const scaledH = displayH * currentZoomLevel;

  // Máximo deslocamento permitido em cada eixo
  const maxX = Math.max(0, (scaledW - mW) / 2);
  const maxY = Math.max(0, (scaledH - mH) / 2);

  currentImgTranslateX = Math.min(maxX, Math.max(-maxX, currentImgTranslateX));
  currentImgTranslateY = Math.min(maxY, Math.max(-maxY, currentImgTranslateY));
}

// --- Zoom com ponto focal ---
function zoomImage(amount, focalPoint = null) {
  if (!modalImg || !imgModal) return;

  const oldZoom = currentZoomLevel;
  currentZoomLevel = Math.min(Math.max(currentZoomLevel + amount, MIN_ZOOM), MAX_ZOOM);

  if (currentZoomLevel === MIN_ZOOM && amount < 0) {
    resetZoomAndPan();
    return;
  }

  const mW = imgModal.clientWidth;
  const mH = imgModal.clientHeight;

  // Ponto de foco relativo ao centro do modal
  const focusX = focalPoint ? focalPoint.x - mW / 2 : 0;
  const focusY = focalPoint ? focalPoint.y - mH / 2 : 0;

  // Ajusta translação para manter o ponto de foco fixo
  const zoomRatio = currentZoomLevel / oldZoom;
  currentImgTranslateX = focusX + (currentImgTranslateX - focusX) * zoomRatio;
  currentImgTranslateY = focusY + (currentImgTranslateY - focusY) * zoomRatio;

  constrainPan();
  applyTransform();
}

// --- Reset ---
function resetZoomAndPan() {
  currentZoomLevel = MIN_ZOOM;
  currentImgTranslateX = 0;
  currentImgTranslateY = 0;
  isPanning = false;
  if (modalImg) {
    modalImg.style.transition = "transform 0.3s ease";
    applyTransform();
    // Remove transição após animação para não interferir no pan
    setTimeout(() => {
      if (modalImg) modalImg.style.transition = "opacity 0.25s ease";
    }, 320);
  }
}

// --- Pan ---
function handlePanStart(e) {
  if (!modalImg || currentZoomLevel <= MIN_ZOOM) return;
  if (e.type === "mousedown" && e.button !== 0) return;
  e.preventDefault();
  isPanning = true;

  const point = e.type === "touchstart" ? e.touches[0] : e;
  panStartX = point.clientX;
  panStartY = point.clientY;
  panStartImgX = currentImgTranslateX;
  panStartImgY = currentImgTranslateY;

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

  const point = e.type === "touchmove" ? e.touches[0] : e;
  currentImgTranslateX = panStartImgX + (point.clientX - panStartX);
  currentImgTranslateY = panStartImgY + (point.clientY - panStartY);

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

// --- Zoom com scroll do mouse ---
function handleWheelZoom(e) {
  if (!imgModal || imgModal.style.display !== "block") return;
  e.preventDefault();

  const rect = imgModal.getBoundingClientRect();
  const focal = {
    x: e.clientX - rect.left - rect.width  / 2,
    y: e.clientY - rect.top  - rect.height / 2
  };

  const delta = e.deltaY < 0 ? ZOOM_INCREMENT : -ZOOM_INCREMENT;
  zoomImage(delta, focal);
}

// --- Teclado ---
function handleModalKeydown(e) {
  if (!imgModal || imgModal.style.display !== "block") return;
  switch (e.key) {
    case "ArrowRight": navigateModal(1);           break;
    case "ArrowLeft":  navigateModal(-1);          break;
    case "+": case "=": zoomImage(ZOOM_INCREMENT); break;
    case "-":           zoomImage(-ZOOM_INCREMENT);break;
    case "0":           resetZoomAndPan();         break;
    case "Escape":      closeModal();              break;
  }
}

// =============================================
// SCROLL — BOTÃO TOPO
// =============================================
window.onscroll = function() {
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
  if (typeof str !== "string") return 0;
  return parseFloat(str.replace("R$", "").replace(".", "").replace(",", ".").trim());
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
    interestPanelTimeoutId = setTimeout(() => hideInterestPanel(), 5000);
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
  if (existing) {
    existing.quantity += quantity;
  } else {
    interests.push({ name, price, quantity, originalPriceString: priceStr });
  }
  updateInterestPanel();
  showInterestPanel(true);
}

function updateInterestPanel() {
  if (!interestList) return;
  interestList.innerHTML = "";
  let total = 0;

  if (interests.length === 0) {
    interestList.innerHTML = "<li>Nenhum item adicionado.</li>";
    if (interestTotalElement) interestTotalElement.innerHTML = "";
    return;
  }

  interests.forEach((item, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${item.name} (Qtd: ${item.quantity}) — ${item.originalPriceString}
      <button class="remove-interest-item-btn" data-index="${idx}">Remover</button>
    `;
    interestList.appendChild(li);
    total += item.price * item.quantity;
  });

  // Reatribuir listeners para evitar duplicatas
  document.querySelectorAll(".remove-interest-item-btn").forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener("click", () => removeInterest(parseInt(clone.dataset.index)));
  });

  if (interestTotalElement) {
    interestTotalElement.innerHTML =
      `<strong>Total: R$ ${total.toFixed(2).replace(".", ",")}</strong>`;
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
  if (selectedItemsSummary) selectedItemsSummary.innerHTML = "";
  let itemsText = "";
  let total = 0;

  interests.forEach(item => {
    const div = document.createElement("div");
    div.innerHTML = `<strong>${item.quantity}x</strong> ${item.name} (${item.originalPriceString})`;
    if (selectedItemsSummary) selectedItemsSummary.appendChild(div);
    itemsText += `${item.quantity}x ${item.name} (${item.originalPriceString})\n`;
    total += item.price * item.quantity;
  });

  itemsText += `\nTotal Geral: R$ ${total.toFixed(2).replace(".", ",")}`;
  if (itemsDataInput) itemsDataInput.value = itemsText.trim();
  if (contactModal) contactModal.style.display = "block";
  hideInterestPanel();
}

// Fechar modais clicando fora
window.onclick = function(event) {
  if (imgModal   && event.target === imgModal)   closeModal();
  if (contactModal && event.target === contactModal) contactModal.style.display = "none";
};

// =============================================
// FORMULÁRIO DE CONTATO
// =============================================
function initContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;

  form.addEventListener("submit", function(e) {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) { submitBtn.innerHTML = "Enviando..."; submitBtn.disabled = true; }

    fetch(form.action, { method: "POST", body: new FormData(form) })
      .then(() => { window.location.href = "obrigado.html"; })
      .catch(err => {
        console.error("Erro:", err);
        alert("Ocorreu um erro ao enviar. Tente novamente.");
        if (submitBtn) { submitBtn.innerHTML = originalText; submitBtn.disabled = false; }
      });
  });
}

// =============================================
// INICIALIZAÇÃO
// =============================================
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  loadCarouselImages();
  updateInterestPanel();

  if (interestPanel) {
    interestPanel.classList.remove("visible");
    interestPanel.classList.add("hidden-fade");
  }

  // Zoom com scroll (no modal inteiro, não só na imagem)
  if (imgModal) {
    imgModal.addEventListener("wheel", handleWheelZoom, { passive: false });
  }

  // Pan na imagem do modal
  if (modalImg) {
    modalImg.addEventListener("mousedown", handlePanStart);
    modalImg.addEventListener("touchstart", handlePanStart, { passive: false });
    modalImg.addEventListener("contextmenu", e => e.preventDefault());
  }

  // Carrossel
  const prevBtn = document.querySelector(".carousel-btn.prev");
  const nextBtn = document.querySelector(".carousel-btn.next");
  if (prevBtn) prevBtn.addEventListener("click", () => moveSlide(-1));
  if (nextBtn) nextBtn.addEventListener("click", () => moveSlide(1));

  // Controles do modal de imagem
  const closeBtn = document.querySelector("#imgModal .close");
  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  const modalPrev = document.querySelector("#imgModal .modal-prev");
  if (modalPrev) modalPrev.addEventListener("click", () => navigateModal(-1));

  const modalNext = document.querySelector("#imgModal .modal-next");
  if (modalNext) modalNext.addEventListener("click", () => navigateModal(1));

  // Botões de zoom (+, -, Reset)
  const zoomControls = document.querySelector(".zoom-controls");
  if (zoomControls) {
    const [zIn, zOut, zReset] = zoomControls.children;
    if (zIn)    zIn.addEventListener("click",    () => zoomImage(ZOOM_INCREMENT));
    if (zOut)   zOut.addEventListener("click",   () => zoomImage(-ZOOM_INCREMENT));
    if (zReset) zReset.addEventListener("click", resetZoomAndPan);
  }

  // Voltar ao topo
  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  // Painel de interesses
  const interestBtn = document.querySelector(".interest-btn");
  if (interestBtn) interestBtn.addEventListener("click", toggleInterestPanel);

  const closePanelBtn = document.getElementById("closeInterestPanelBtn");
  if (closePanelBtn) closePanelBtn.addEventListener("click", hideInterestPanel);

  // Formulário de contato
  initContactForm();

  // Fechar modal de contato
  const closeContactBtn = document.querySelector("#contactModal .close-contact");
  if (closeContactBtn) closeContactBtn.addEventListener("click", () => {
    if (contactModal) contactModal.style.display = "none";
  });
});

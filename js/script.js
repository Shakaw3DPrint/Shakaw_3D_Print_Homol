const GITHUB_OWNER = "Shakaw3DPrint";
const GITHUB_REPO = "Shakaw_3D_Print";
const GITHUB_BRANCH = "main";
const BASE_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/`;

let allProducts = [];
let carouselItems = [];
let currentSlide = 0;
let slideInterval;
let currentZoom = 1;
let currentImageIndex = 0;
let filteredImages = []; // Para o modal de imagem
let modalImages = []; // Armazena todas as imagens do produto para o modal
let currentModalImageIndex = 0; // Índice da imagem atual no modal

// Variáveis DOM (inicializadas em DOMContentLoaded)
let catalogGrid;
let loader;
let resultsCount;
let backToTopBtn;
let interestPanel;
let interestList;
let interestTotalEl;
let imgModal;
let modalImg;
let contactModal;
let selectedSummary;
let itemsDataInput;
let openInterestPanelFromHeaderBtn;

// Constantes para zoom
const ZOOM_INCREMENT = 0.1; // Incremento/decremento do zoom
const MAX_ZOOM = 5;         // Zoom máximo
const MIN_ZOOM = 0.5;       // Zoom mínimo

// Variáveis para pan (movimento da imagem)
let isPanning = false;
let panStartX, panStartY;
let panStartImgX, panStartImgY;
let currentImgTranslateX = 0;
let currentImgTranslateY = 0;

// Variáveis para o painel de interesses
let interestItems = JSON.parse(localStorage.getItem('interestItems')) || [];
let interestPanelTimeoutId;

const categoryBadgeMap = {
    "diorama-garagem": '<span class="cat-badge cat-diorama-garagem">Diorama Garagem</span>',
    "miniaturas-3d": '<span class="cat-badge cat-miniaturas-3d">Miniaturas 3D</span>',
    "miniaturas-rpg": '<span class="cat-badge cat-miniaturas-rpg">Miniaturas RPG</span>',
    "produtos-funcionais": '<span class="cat-badge cat-produtos-funcionais">Funcional</span>',
    "action-figures": '<span class="cat-badge cat-miniaturas-3d">Miniaturas 3D</span>' // Mapeia Action Figures para Miniaturas 3D
};

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

function showLoader() {
    if (loader) loader.style.display = "block";
}

function hideLoader() {
    if (loader) loader.style.display = "none";
}

function parsePrice(priceStr) {
    if (typeof priceStr === 'number') return priceStr;
    if (typeof priceStr === 'string') {
        const cleaned = priceStr.replace('R$', '').replace('.', '').replace(',', '.').trim();
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}

// ============================================================
// CARREGAMENTO DE DADOS (PRODUTOS E CARROSSEL)
// ============================================================

async function loadAllData() {
    showLoader();
    try {
        const [productsDioramaRes, productsOutrosRes, carouselRes] = await Promise.all([
            fetch(BASE_URL + "assets/json/products.json?t=" + Date.now()),
            fetch(BASE_URL + "assets/json/outros_produtos.json?t=" + Date.now()),
            fetch(BASE_URL + "assets/json/carousel.json?t=" + Date.now())
        ]);

        const productsDiorama = productsDioramaRes.ok ? await productsDioramaRes.json() : [];
        const productsOutros = productsOutrosRes.ok ? await productsOutrosRes.json() : [];
        carouselItems = carouselRes.ok ? await carouselRes.json() : [];

        // Garante que todos os produtos tenham uma categoria
        productsDiorama.forEach(p => { if (!p.category) p.category = "diorama-garagem"; });
        productsOutros.forEach(p => {
            if (!p.category) p.category = "produtos-funcionais";
            // Mapeia "action-figures" para "miniaturas-3d"
            if (p.category === "action-figures") p.category = "miniaturas-3d";
        });

        allProducts = productsDiorama.concat(productsOutros);

        // Renderiza o carrossel do Instagram na home
        if (document.getElementById("instagramCarousel")) {
            renderInstagramCarousel();
        }

        // Renderiza produtos se estiver em uma página de catálogo
        if (catalogGrid) {
            renderProducts(allProducts);
        }

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        if (catalogGrid) {
            catalogGrid.innerHTML = '<p class="loading-message" style="color:#ff6b6b;">Erro ao carregar produtos. Tente novamente mais tarde.</p>';
        }
        if (document.getElementById("instagramCarousel")) {
            document.getElementById("instagramCarousel").innerHTML = '<p class="loading-message" style="color:#ff6b6b;">Erro ao carregar posts do Instagram.</p>';
        }
    } finally {
        hideLoader();
    }
}

// ============================================================
// CARROSSEL (HOME - ÚLTIMAS DO INSTAGRAM)
// ============================================================

function renderInstagramCarousel() {
    const instagramCarouselContainer = document.getElementById("instagramCarousel");
    if (!instagramCarouselContainer) return;

    instagramCarouselContainer.innerHTML = ""; // Limpa o conteúdo existente

    if (carouselItems.length === 0) {
        instagramCarouselContainer.innerHTML = '<p class="loading-message">Nenhum post do Instagram encontrado.</p>';
        return;
    }

    carouselItems.forEach(item => {
        const carouselItemDiv = document.createElement("div");
        carouselItemDiv.className = "instagram-carousel-item";
        carouselItemDiv.innerHTML = `
            <img src="${BASE_URL + item.image}" alt="${item.alt}">
            <div class="instagram-caption">${item.caption}</div>
        `;
        instagramCarouselContainer.appendChild(carouselItemDiv);
    });
}


// ============================================================
// RENDERIZAÇÃO E FILTRO DE PRODUTOS (CATÁLOGO)
// ============================================================

function renderProducts(productsToRender) {
    if (!catalogGrid) return; // Garante que só renderiza se estiver na página de catálogo
    catalogGrid.innerHTML = ""; // Limpa o conteúdo existente

    if (productsToRender.length === 0) {
        catalogGrid.innerHTML = '<p class="loading-message">Nenhum produto encontrado nesta categoria.</p>';
        if (resultsCount) resultsCount.textContent = "0 produtos encontrados.";
        return;
    }

    productsToRender.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";
        card.dataset.productId = product.id; // Adiciona ID para identificar o produto no modal

        const badge = categoryBadgeMap[product.category] || '';
        const imgSrc = product.mainImage ? BASE_URL + product.mainImage : 'https://via.placeholder.com/200x200?text=Sem+Imagem';

        card.innerHTML = `
            <img src="${imgSrc}" alt="${product.name}">
            <div class="product-card-content">
                <h3>${product.name} ${badge}</h3>
                <p>${product.description}</p>
                <div class="price ${product.price ? '' : 'consult'}">
                    ${product.price ? `R$ ${product.price.toFixed(2).replace('.', ',')}` : 'Sob consulta'}
                </div>
                <button class="add-to-interest-btn" data-product-id="${product.id}">
                    <i class="fas fa-heart"></i> Adicionar à lista
                </button>
            </div>
        `;
        catalogGrid.appendChild(card);
    });

    if (resultsCount) resultsCount.textContent = `${productsToRender.length} produtos encontrados.`;

    // Adiciona event listeners para abrir o modal de imagem
    document.querySelectorAll('.product-card img').forEach(img => {
        img.addEventListener('click', (e) => {
            const productId = e.target.closest('.product-card').dataset.productId;
            const product = allProducts.find(p => p.id === productId);
            if (product) openImageModal(product);
        });
    });

    // Adiciona event listeners para o botão "Adicionar à lista"
    document.querySelectorAll('.add-to-interest-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const productId = e.target.dataset.productId;
            const product = allProducts.find(p => p.id === productId);
            if (product) addToInterests(product);
        });
    });
}

function filterProducts(category) {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.filter-btn[data-filter="${category}"]`).classList.add('active');

    let productsToRender = [];
    if (category === "all") {
        productsToRender = allProducts;
    } else {
        productsToRender = allProducts.filter(product => product.category === category);
    }
    renderProducts(productsToRender);
}

function initFilters() {
    const filterButtonsContainer = document.getElementById("filterButtons");
    if (filterButtonsContainer) {
        filterButtonsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                filterProducts(e.target.dataset.filter);
            }
        });
    }
}

// =============================================
// MODAL DE IMAGEM (ZOOM E PAN)
// =============================================

function openImageModal(product) {
    if (!imgModal || !modalImg) return;

    modalImages = [];
    if (product.mainImage) {
        modalImages.push(BASE_URL + product.mainImage);
    }
    if (product.thumbnails && product.thumbnails.length > 0) {
        product.thumbnails.forEach(thumb => {
            modalImages.push(BASE_URL + thumb);
        });
    }

    if (modalImages.length === 0) {
        modalImages.push('https://via.placeholder.com/800x600?text=Sem+Imagem');
    }

    currentModalImageIndex = 0;
    renderModalImage();
    imgModal.classList.add('open');
    document.addEventListener('keydown', handleModalKeydown);
}

function closeImageModal() {
    if (!imgModal) return;
    imgModal.classList.remove('open');
    resetZoomAndPan();
    document.removeEventListener('keydown', handleModalKeydown);
}

function renderModalImage() {
    if (!modalImg || modalImages.length === 0) return;
    modalImg.src = modalImages[currentModalImageIndex];
    resetZoomAndPan(); // Reseta zoom e pan ao carregar nova imagem
}

function navigateModalImages(direction) {
    if (modalImages.length <= 1) return;
    currentModalImageIndex = (currentModalImageIndex + direction + modalImages.length) % modalImages.length;
    renderModalImage();
}

function applyTransform() {
    if (!modalImg) return;
    modalImg.style.transform = `scale(${currentZoom}) translate(${currentImgTranslateX}px, ${currentImgTranslateY}px)`;
}

function constrainPan() {
    if (!modalImg) return;
    const imgRect = modalImg.getBoundingClientRect();
    const modalRect = imgModal.getBoundingClientRect();

    const effectiveWidth = imgRect.width * currentZoom;
    const effectiveHeight = imgRect.height * currentZoom;

    const maxPanX = Math.max(0, (effectiveWidth - modalRect.width) / 2 / currentZoom);
    const maxPanY = Math.max(0, (effectiveHeight - modalRect.height) / 2 / currentZoom);

    currentImgTranslateX = Math.max(-maxPanX, Math.min(maxPanX, currentImgTranslateX));
    currentImgTranslateY = Math.max(-maxPanY, Math.min(maxPanY, currentImgTranslateY));
}

function zoomImage(delta, focalPoint = null) {
    const oldZoom = currentZoom;
    currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + delta));

    if (focalPoint && modalImg) {
        // Ajusta o pan para manter o foco no ponto do mouse
        const zoomRatio = currentZoom / oldZoom;
        currentImgTranslateX = focalPoint.x - (focalPoint.x - currentImgTranslateX) * zoomRatio;
        currentImgTranslateY = focalPoint.y - (focalPoint.y - currentImgTranslateY) * zoomRatio;
    }

    constrainPan();
    applyTransform();
}

function resetZoomAndPan() {
    currentZoom = 1;
    currentImgTranslateX = 0;
    currentImgTranslateY = 0;
    applyTransform();
}

function handlePanStart(e) {
    if (!modalImg || currentZoom === 1) return; // Só permite pan se houver zoom
    e.preventDefault();
    isPanning = true;
    const p = e.type === "touchstart" ? e.touches[0] : e;
    panStartX = p.clientX;
    panStartY = p.clientY;
    panStartImgX = currentImgTranslateX;
    panStartImgY = currentImgTranslateY;
    document.addEventListener("mousemove", handlePanMove);
    document.addEventListener("touchmove", handlePanMove, { passive: false });
    document.addEventListener("mouseup", handlePanEnd);
    document.addEventListener("touchend", handlePanEnd);
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
    document.removeEventListener("mouseup", handlePanEnd);
    document.removeEventListener("touchend", handlePanEnd);
}

function handleWheelZoom(e) {
    if (!imgModal || !imgModal.classList.contains('open')) return;
    e.preventDefault();
    const rect = modalImg.getBoundingClientRect(); // Usar modalImg para o foco
    const modalRect = imgModal.getBoundingClientRect();

    // Calcula o ponto focal relativo à imagem (não ao modal)
    const focal = {
        x: (e.clientX - rect.left) - (rect.width / 2),
        y: (e.clientY - rect.top) - (rect.height / 2)
    };

    zoomImage(e.deltaY < 0 ? ZOOM_INCREMENT : -ZOOM_INCREMENT, focal);
}

function handleModalKeydown(e) {
    if (!imgModal || !imgModal.classList.contains('open')) return;
    switch (e.key) {
        case "ArrowRight": navigateModalImages(1); break;
        case "ArrowLeft": navigateModalImages(-1); break;
        case "+": case "=": zoomImage(ZOOM_INCREMENT); break;
        case "-": zoomImage(-ZOOM_INCREMENT); break;
        case "0": resetZoomAndPan(); break;
        case "Escape": closeImageModal(); break;
    }
}

// =============================================
// PAINEL DE INTERESSES
// =============================================

function showInterestPanel(autoHide = false) {
    if (!interestPanel) return;
    interestPanel.classList.add("open"); // Usa a classe 'open'
    clearTimeout(interestPanelTimeoutId);
    if (autoHide && interestItems.length > 0) {
        interestPanelTimeoutId = setTimeout(hideInterestPanel, 5000);
    }
}

function hideInterestPanel() {
    if (!interestPanel) return;
    clearTimeout(interestPanelTimeoutId);
    interestPanel.classList.remove("open");
}

function toggleInterestPanel() {
    if (!interestPanel) return;
    if (interestPanel.classList.contains("open")) hideInterestPanel();
    else showInterestPanel(false);
}

function addToInterests(product) {
    const existing = interestItems.find(item => item.id === product.id);
    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1; // Incrementa quantidade
    } else {
        interestItems.push({
            id: product.id,
            name: product.name,
            price: product.price || 'Sob consulta',
            quantity: 1 // Adiciona quantidade inicial
        });
    }
    updateInterestPanel();
    showInterestPanel(true);
}

function updateInterestPanel() {
    if (!interestList) return;
    interestList.innerHTML = "";
    let total = 0;

    if (interestItems.length === 0) {
        interestList.innerHTML = '<li>Nenhum item adicionado.</li>';
        if (interestTotalEl) interestTotalEl.textContent = 'Total: R$ 0,00';
        return;
    }

    interestItems.forEach((item, index) => {
        const li = document.createElement('li');
        const price = parsePrice(item.price) * (item.quantity || 1);
        total += price;

        li.innerHTML = `
            <div class="item-info">
                <span class="item-name">${item.name} (Qtd: ${item.quantity || 1})</span>
                <span class="item-price">${typeof item.price === 'number' ? `R$ ${item.price.toFixed(2).replace('.', ',')}` : item.price}</span>
            </div>
            <button class="remove-item-btn" data-index="${index}">&times;</button>
        `;
        interestList.appendChild(li);
    });

    if (interestTotalEl) {
        interestTotalEl.textContent = `Total: R$ ${total.toFixed(2).replace('.', ',')}`;
    }
    localStorage.setItem('interestItems', JSON.stringify(interestItems));

    // Adiciona event listeners para remover itens
    document.querySelectorAll('.remove-item-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const indexToRemove = parseInt(e.target.dataset.index);
            interestItems.splice(indexToRemove, 1);
            updateInterestPanel();
        });
    });
}

// =============================================
// MODAL DE CONTATO
// =============================================

function showContactModal() {
    if (interestItems.length === 0) {
        alert("Por favor, adicione itens à sua lista de interesses primeiro.");
        return;
    }
    if (selectedSummary) selectedSummary.innerHTML = "";
    let text = "";
    let total = 0;

    interestItems.forEach(item => {
        const div = document.createElement("div");
        const label = typeof item.price === 'number' ? `R$ ${item.price.toFixed(2).replace('.', ',')}` : item.price;
        div.innerHTML = `<strong>${item.quantity}x</strong> ${item.name} (${label})`;
        if (selectedSummary) selectedSummary.appendChild(div);
        text += `${item.quantity}x ${item.name} (${label})\n`;
        total += parsePrice(item.price) * (item.quantity || 1);
    });

    if (total > 0) text += `\nTotal Geral: R$ ${total.toFixed(2).replace(".", ",")}`;
    if (itemsDataInput) itemsDataInput.value = text.trim();
    if (contactModal) contactModal.classList.add('open'); // Usa a classe 'open'
    hideInterestPanel();
}

function closeContactModal() {
    if (contactModal) contactModal.classList.remove('open');
}

// =============================================
// FORMULÁRIO DE CONTATO (ENVIO)
// =============================================

function initContactForm() {
    const form = document.getElementById("contactForm");
    if (!form) return;
    form.addEventListener("submit", e => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const orig = btn ? btn.innerHTML : "";
        if (btn) { btn.innerHTML = "Enviando..."; btn.disabled = true; }

        // Usando FormSubmit.co
        fetch(form.action, { method: "POST", body: new FormData(form) })
            .then(response => {
                if (response.ok) {
                    alert("Sua lista de interesses foi enviada com sucesso!");
                    closeContactModal();
                    interestItems = []; // Limpa a lista após o envio
                    updateInterestPanel();
                    // Redireciona para a página de obrigado se o FormSubmit estiver configurado para isso
                    // window.location.href = "obrigado.html";
                } else {
                    alert("Erro ao enviar. Tente novamente.");
                }
            })
            .catch(err => {
                console.error(err);
                alert("Erro ao enviar. Tente novamente.");
            })
            .finally(() => {
                if (btn) { btn.innerHTML = orig; btn.disabled = false; }
            });
    });
}

// =============================================
// BOTÃO VOLTAR AO TOPO
// =============================================

function setupBackToTopButton() {
    if (!backToTopBtn) return;
    window.onscroll = function() {
        if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
            backToTopBtn.style.display = "block";
        } else {
            backToTopBtn.style.display = "none";
        }
    };
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({top: 0, behavior: 'smooth'});
    });
}

// =============================================
// INICIALIZAÇÃO
// =============================================

document.addEventListener("DOMContentLoaded", () => {
    // Atribui elementos DOM às variáveis
    catalogGrid = document.getElementById("catalog"); // Pode ser nulo se não for página de catálogo
    loader = document.getElementById("loader");
    resultsCount = document.getElementById("resultsCount");
    backToTopBtn = document.getElementById("backToTopBtn");
    interestPanel = document.getElementById("interestPanel");
    interestList = document.getElementById("interestList");
    interestTotalEl = document.getElementById("interestTotal");
    imgModal = document.getElementById("imgModal");
    modalImg = document.getElementById("modalImg");
    contactModal = document.getElementById("contactModal");
    selectedSummary = document.getElementById("selectedItemsSummary");
    itemsDataInput = document.getElementById("itemsData");
    openInterestPanelFromHeaderBtn = document.getElementById("openInterestPanelFromHeader");

    // Carrega todos os dados (produtos e carrossel)
    loadAllData();
    updateInterestPanel(); // Atualiza o painel de interesses ao carregar a página

    // Event Listeners para o painel de interesses
    if (openInterestPanelFromHeaderBtn) {
        openInterestPanelFromHeaderBtn.addEventListener("click", toggleInterestPanel);
    }
    const closePanelBtn = document.getElementById("closeInterestPanelBtn");
    if (closePanelBtn) closePanelBtn.addEventListener("click", hideInterestPanel);

    // Event Listeners para o modal de imagem
    if (imgModal) {
        imgModal.addEventListener("wheel", handleWheelZoom, { passive: false });
        imgModal.querySelector('.close').addEventListener('click', closeImageModal);
        imgModal.querySelector('.modal-nav.modal-prev').addEventListener('click', () => navigateModalImages(-1));
        imgModal.querySelector('.modal-nav.modal-next').addEventListener('click', () => navigateModalImages(1));
        imgModal.querySelector('#zoomInBtn').addEventListener('click', () => zoomImage(ZOOM_INCREMENT));
        imgModal.querySelector('#zoomOutBtn').addEventListener('click', () => zoomImage(-ZOOM_INCREMENT));
        imgModal.querySelector('#zoomResetBtn').addEventListener('click', resetZoomAndPan);
        // Fechar modal ao clicar fora da imagem (mas dentro do modal)
        imgModal.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                closeImageModal();
            }
        });
    }
    if (modalImg) {
        modalImg.addEventListener("mousedown", handlePanStart);
        modalImg.addEventListener("touchstart", handlePanStart, { passive: false });
        modalImg.addEventListener("contextmenu", e => e.preventDefault()); // Impede menu de contexto no clique direito
    }

    // Event Listeners para o modal de contato
    const openContactModalBtn = document.getElementById("openContactModalBtn"); // Botão para abrir o modal de contato (dentro do painel de interesses)
    if (openContactModalBtn) openContactModalBtn.addEventListener("click", showContactModal);
    const closeContactModalBtn = document.querySelector('.contact-modal .close-contact');
    if (closeContactModalBtn) closeContactModalBtn.addEventListener('click', closeContactModal);

    initContactForm(); // Inicializa o formulário de contato

    // Inicializa filtros se estiver em uma página de catálogo
    if (document.querySelector('.filter-section')) {
        initFilters();
    }

    setupBackToTopButton(); // Configura o botão "Voltar ao Topo"
});

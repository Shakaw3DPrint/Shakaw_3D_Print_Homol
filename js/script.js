const GITHUB_OWNER = "Shakaw3DPrint";
const GITHUB_REPO = "Shakaw_3D_Print";
const GITHUB_BRANCH = "main";

let allProducts = [];
let carouselItems = [];
let currentSlide = 0;
let currentZoom = 1; // Zoom inicial padrão
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
let interestCountEl; // Elemento para exibir a contagem de itens no carrinho
let modalProductDescription; // Para a descrição do produto no modal
let modalThumbnailsContainer; // Para as miniaturas no modal
let modalProductName; // Para o nome do produto no modal

// Constantes para zoom
const ZOOM_INCREMENT = 0.1; // Incremento/decremento do zoom
const MAX_ZOOM = 5;         // Zoom máximo
const MIN_ZOOM = 0.2;       // Zoom mínimo (ajustado para permitir mais redução)
const DEFAULT_ZOOM = 1;     // Zoom padrão ao abrir o modal ou resetar

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
    "produtos-funcionais": '<span class="cat-badge cat-produtos-funcionais">Funcional</span>'
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
            fetch("assets/json/products.json?t=" + Date.now()),
            fetch("assets/json/outros_produtos.json?t=" + Date.now()),
            fetch("assets/json/carousel.json?t=" + Date.now())
        ]);

        const productsDiorama = productsDioramaRes.ok ? await productsDioramaRes.json() : [];
        const productsOutros = productsOutrosRes.ok ? await productsOutrosRes.json() : [];
        carouselItems = carouselRes.ok ? await carouselRes.json() : [];

        productsDiorama.forEach(p => { if (!p.category) p.category = "diorama-garagem"; });
        productsOutros.forEach(p => {
            if (!p.category) p.category = "produtos-funcionais";
            if (p.category === "action-figures") p.category = "miniaturas-3d";
        });

        allProducts = productsDiorama.concat(productsOutros);

        // Renderiza o carrossel do Instagram na home (se o elemento existir)
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

    instagramCarouselContainer.innerHTML = "";

    if (carouselItems.length === 0) {
        instagramCarouselContainer.innerHTML = '<p class="loading-message">Nenhum post do Instagram encontrado.</p>';
        return;
    }

    carouselItems.forEach(item => {
        const carouselItemDiv = document.createElement("div");
        carouselItemDiv.className = "instagram-carousel-item";
        carouselItemDiv.innerHTML = `
            <img src="${item.src}" alt="${item.alt}">
            <div class="instagram-caption">${item.caption || ''}</div>
        `;
        instagramCarouselContainer.appendChild(carouselItemDiv);
    });
}

// ============================================================
// RENDERIZAÇÃO E FILTRO DE PRODUTOS (CATÁLOGO)
// ============================================================

function renderProducts(productsToRender) {
    if (!catalogGrid) return;
    catalogGrid.innerHTML = "";

    if (productsToRender.length === 0) {
        catalogGrid.innerHTML = '<p class="loading-message">Nenhum produto encontrado nesta categoria.</p>';
        if (resultsCount) resultsCount.textContent = "0 produtos encontrados.";
        return;
    }

    productsToRender.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";
        card.dataset.productId = product.id;

        const imgSrc = product.mainImage ? product.mainImage : 'https://via.placeholder.com/200x200?text=Sem+Imagem';
        const categoryBadge = categoryBadgeMap[product.category] || '';

        card.innerHTML = `
            <img src="${imgSrc}" alt="${product.name}" class="product-image">
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-price">R$ ${parsePrice(product.price).toFixed(2).replace('.', ',')}</p>
                <div class="product-actions">
                    <button class="add-to-interest" data-product-id="${product.id}">Adicionar à Lista</button>
                    <button class="view-details" data-product-id="${product.id}">Ver Detalhes</button>
                </div>
                ${categoryBadge}
            </div>
        `;
        catalogGrid.appendChild(card);
    });

    if (resultsCount) resultsCount.textContent = `${productsToRender.length} produtos encontrados.`;

    catalogGrid.querySelectorAll('.add-to-interest').forEach(button => {
        button.addEventListener('click', (e) => {
            const productId = e.target.dataset.productId;
            const product = allProducts.find(p => p.id === productId);
            if (product) {
                addToInterest(product);
            }
        });
    });

    catalogGrid.querySelectorAll('.view-details').forEach(button => {
        button.addEventListener('click', (e) => {
            const productId = e.target.dataset.productId;
            const product = allProducts.find(p => p.id === productId);
            if (product) {
                openImageModal(product);
            }
        });
    });
}

function initFilters() {
    const categoryFilter = document.getElementById("categoryFilter");
    const searchInput = document.getElementById("searchInput");
    const sortSelect = document.getElementById("sortSelect");

    if (categoryFilter) categoryFilter.addEventListener("change", applyFilters);
    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (sortSelect) sortSelect.addEventListener("change", applyFilters);
}

function applyFilters() {
    const categoryFilter = document.getElementById("categoryFilter");
    const searchInput = document.getElementById("searchInput");
    const sortSelect = document.getElementById("sortSelect");

    const selectedCategory = categoryFilter ? categoryFilter.value : "all";
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    const sortBy = sortSelect ? sortSelect.value : "price-asc";

    let filteredProducts = allProducts.filter(product => {
        const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                              product.description.toLowerCase().includes(searchTerm);
        return matchesCategory && matchesSearch;
    });

    filteredProducts.sort((a, b) => {
        const priceA = parsePrice(a.price);
        const priceB = parsePrice(b.price);

        if (sortBy === "price-asc") {
            return priceA - priceB;
        } else if (sortBy === "price-desc") {
            return priceB - priceA;
        }
        return 0;
    });

    renderProducts(filteredProducts);
}

// ============================================================
// MODAL DE IMAGEM (DETALHES DO PRODUTO)
// ============================================================

function openImageModal(product) {
    if (!imgModal || !modalImg || !modalProductName || !modalProductDescription || !modalThumbnailsContainer) return;

    modalProductName.textContent = product.name;
    modalProductDescription.innerHTML = product.description; // Usar innerHTML para tags <br> e <strong>
    modalImages = product.thumbnails && product.thumbnails.length > 0 ? product.thumbnails : [product.mainImage];
    currentModalImageIndex = 0;

    resetZoomAndPan(); // Reseta zoom e pan ao abrir o modal
    showModalImage(currentModalImageIndex);
    renderModalThumbnails();

    imgModal.style.display = "block";
    document.body.classList.add('modal-open'); // Adiciona classe para desabilitar scroll do body
}

function closeImageModal() {
    if (imgModal) {
        imgModal.style.display = "none";
        document.body.classList.remove('modal-open'); // Remove classe para reabilitar scroll do body
    }
}

function showModalImage(index) {
    if (!modalImg || modalImages.length === 0) return;

    currentModalImageIndex = (index + modalImages.length) % modalImages.length;
    modalImg.src = modalImages[currentModalImageIndex];
    modalImg.alt = `Imagem ${currentModalImageIndex + 1} de ${modalProductName.textContent}`;

    // Resetar zoom e pan ao trocar de imagem
    resetZoomAndPan();
    updateActiveThumbnail();
}

function navigateModalImages(direction) {
    showModalImage(currentModalImageIndex + direction);
}

function zoomImage(amount) {
    currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + amount));
    applyZoomAndPan();
    updatePanCursor();
}

function resetZoomAndPan() {
    currentZoom = DEFAULT_ZOOM;
    currentImgTranslateX = 0;
    currentImgTranslateY = 0;
    applyZoomAndPan();
    updatePanCursor();
}

function applyZoomAndPan() {
    if (modalImg) {
        modalImg.style.transform = `scale(${currentZoom}) translate(${currentImgTranslateX}px, ${currentImgTranslateY}px)`;
    }
}

function handleWheelZoom(e) {
    if (!imgModal || imgModal.style.display !== "block") return; // Apenas se o modal estiver aberto
    e.preventDefault(); // Impede o scroll da página

    const zoomDirection = e.deltaY < 0 ? ZOOM_INCREMENT : -ZOOM_INCREMENT;
    zoomImage(zoomDirection);
}

function handlePanStart(e) {
    if (currentZoom <= DEFAULT_ZOOM) return; // Só permite pan se houver zoom
    e.preventDefault(); // Impede o comportamento padrão (ex: arrastar imagem)

    isPanning = true;
    modalImg.style.cursor = 'grabbing';

    if (e.type === 'mousedown') {
        panStartX = e.clientX;
        panStartY = e.clientY;
    } else if (e.type === 'touchstart') {
        panStartX = e.touches[0].clientX;
        panStartY = e.touches[0].clientY;
    }
    panStartImgX = currentImgTranslateX;
    panStartImgY = currentImgTranslateY;

    document.addEventListener('mousemove', handlePanMove);
    document.addEventListener('mouseup', handlePanEnd);
    document.addEventListener('touchmove', handlePanMove, { passive: false });
    document.addEventListener('touchend', handlePanEnd);
}

function handlePanMove(e) {
    if (!isPanning) return;
    e.preventDefault();

    let clientX, clientY;
    if (e.type === 'mousemove') {
        clientX = e.clientX;
        clientY = e.clientY;
    } else if (e.type === 'touchmove') {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }

    const dx = (clientX - panStartX) / currentZoom; // Divide pelo zoom para movimento mais natural
    const dy = (clientY - panStartY) / currentZoom;

    currentImgTranslateX = panStartImgX + dx;
    currentImgTranslateY = panStartImgY + dy;

    applyZoomAndPan();
}

function handlePanEnd() {
    isPanning = false;
    modalImg.style.cursor = 'grab'; // Volta para cursor de grab
    document.removeEventListener('mousemove', handlePanMove);
    document.removeEventListener('mouseup', handlePanEnd);
    document.removeEventListener('touchmove', handlePanMove);
    document.removeEventListener('touchend', handlePanEnd);
}

function updatePanCursor() {
    if (modalImg) {
        modalImg.classList.toggle('zoomable', currentZoom > DEFAULT_ZOOM);
    }
}

function renderModalThumbnails() {
    if (!modalThumbnailsContainer) return;
    modalThumbnailsContainer.innerHTML = '';

    modalImages.forEach((src, index) => {
        const thumb = document.createElement('img');
        thumb.src = src;
        thumb.alt = `Miniatura ${index + 1}`;
        thumb.className = 'modal-thumbnail';
        if (index === currentModalImageIndex) {
            thumb.classList.add('active');
        }
        thumb.addEventListener('click', () => showModalImage(index));
        modalThumbnailsContainer.appendChild(thumb);
    });
}

function updateActiveThumbnail() {
    if (!modalThumbnailsContainer) return;
    modalThumbnailsContainer.querySelectorAll('.modal-thumbnail').forEach((thumb, index) => {
        if (index === currentModalImageIndex) {
            thumb.classList.add('active');
        } else {
            thumb.classList.remove('active');
        }
    });
}

// ============================================================
// PAINEL DE INTERESSES (CARRINHO)
// ============================================================

function addToInterest(product) {
    const existingItem = interestItems.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        interestItems.push({
            id: product.id,
            name: product.name,
            price: parsePrice(product.price), // Garante que o preço é um número
            mainImage: product.mainImage,
            quantity: 1
        });
    }
    saveInterestItems();
    updateInterestPanel();
    showInterestPanel();
    updateInterestCount();
}

function removeFromInterest(productId) {
    interestItems = interestItems.filter(item => item.id !== productId);
    saveInterestItems();
    updateInterestPanel();
    updateInterestCount();
}

function updateInterestQuantity(productId, change) {
    const item = interestItems.find(item => item.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromInterest(productId);
        } else {
            saveInterestItems();
            updateInterestPanel();
            updateInterestCount();
        }
    }
}

function saveInterestItems() {
    localStorage.setItem('interestItems', JSON.stringify(interestItems));
}

function calculateInterestTotal() {
    return interestItems.reduce((total, item) => total + (item.price * item.quantity), 0);
}

function updateInterestPanel() {
    if (!interestList || !interestTotalEl) return;

    interestList.innerHTML = '';
    if (interestItems.length === 0) {
        interestList.innerHTML = '<li class="empty-list-message">Sua lista de interesses está vazia.</li>';
    } else {
        interestItems.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <img src="${item.mainImage}" alt="${item.name}" class="interest-item-thumb">
                <div class="interest-item-details">
                    <span>${item.name}</span>
                    <span>R$ ${item.price.toFixed(2).replace('.', ',')} x ${item.quantity}</span>
                </div>
                <div class="interest-item-controls">
                    <button class="quantity-btn" data-id="${item.id}" data-action="decrease">-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn" data-id="${item.id}" data-action="increase">+</button>
                    <button class="remove-item-btn" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
            interestList.appendChild(li);
            addInterestItemEventListeners(li); // Adiciona listeners para os botões
        });
    }
    interestTotalEl.textContent = calculateInterestTotal().toFixed(2).replace('.', ',');
    updateContactFormSummary();
}

function addInterestItemEventListeners(li) {
    li.querySelector('.quantity-btn[data-action="decrease"]').addEventListener('click', (e) => {
        const productId = e.target.dataset.id;
        updateInterestQuantity(productId, -1);
    });
    li.querySelector('.quantity-btn[data-action="increase"]').addEventListener('click', (e) => {
        const productId = e.target.dataset.id;
        updateInterestQuantity(productId, 1);
    });
    li.querySelector('.remove-item-btn').addEventListener('click', (e) => {
        const productId = e.target.dataset.id;
        removeFromInterest(productId);
    });
}

function toggleInterestPanel() {
    if (interestPanel) {
        interestPanel.classList.toggle('open');
        if (interestPanel.classList.contains('open')) {
            clearTimeout(interestPanelTimeoutId); // Cancela qualquer fechamento automático
        } else {
            // Opcional: fechar automaticamente após um tempo se o usuário não interagir
            // interestPanelTimeoutId = setTimeout(hideInterestPanel, 5000);
        }
    }
}

function showInterestPanel() {
    if (interestPanel) {
        interestPanel.classList.add('open');
        clearTimeout(interestPanelTimeoutId);
    }
}

function hideInterestPanel() {
    if (interestPanel) {
        interestPanel.classList.remove('open');
    }
}

function updateInterestCount() {
    if (interestCountEl) {
        const totalQuantity = interestItems.reduce((total, item) => total + item.quantity, 0);
        interestCountEl.textContent = totalQuantity;
    }
}

// ============================================================
// MODAL DE CONTATO
// ============================================================

function showContactModal() {
    if (contactModal) {
        contactModal.style.display = "block";
        document.body.classList.add('modal-open');
        hideInterestPanel(); // Fecha o painel de interesses ao abrir o modal de contato
    }
}

function closeContactModal() {
    if (contactModal) {
        contactModal.style.display = "none";
        document.body.classList.remove('modal-open');
    }
}

function updateContactFormSummary() {
    if (!selectedSummary || !itemsDataInput) return;

    let summaryText = "Itens na lista de interesses:\n";
    const itemsData = [];
    interestItems.forEach(item => {
        summaryText += `- ${item.name} (R$ ${item.price.toFixed(2).replace('.', ',')} x ${item.quantity})\n`;
        itemsData.push({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        });
    });
    summaryText += `\nTotal: R$ ${calculateInterestTotal().toFixed(2).replace('.', ',')}`;

    selectedSummary.value = summaryText;
    itemsDataInput.value = JSON.stringify(itemsData); // Envia os dados como JSON
}

function initContactForm() {
    const contactForm = contactModal ? contactModal.querySelector('form') : null;
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            // O FormSubmit lida com o envio, mas podemos adicionar validações extras aqui se necessário
            // Por exemplo, garantir que a lista de interesses não está vazia antes de enviar
            if (interestItems.length === 0) {
                alert("Sua lista de interesses está vazia. Adicione produtos antes de enviar a solicitação.");
                e.preventDefault(); // Impede o envio do formulário
            }
        });
    }
}

// ============================================================
// BOTÃO VOLTAR AO TOPO
// ============================================================

function setupBackToTopButton() {
    if (!backToTopBtn) return;

    window.addEventListener("scroll", () => {
        if (window.scrollY > 300) { // Mostra o botão após rolar 300px
            backToTopBtn.classList.add("show");
        } else {
            backToTopBtn.classList.remove("show");
        }
    });

    backToTopBtn.addEventListener("click", () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });
}

// ============================================================
// INICIALIZAÇÃO GERAL
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    // Inicializa variáveis DOM
    catalogGrid = document.getElementById("catalogGrid");
    loader = document.getElementById("loader");
    resultsCount = document.getElementById("resultsCount");
    backToTopBtn = document.getElementById("backToTopBtn");
    interestPanel = document.getElementById("interestPanel");
    interestList = document.getElementById("interestList");
    interestTotalEl = document.getElementById("interestTotal");
    imgModal = document.getElementById("imgModal");
    modalImg = document.getElementById("modalImg");
    modalProductName = document.getElementById("modalProductName"); // Inicializa
    modalProductDescription = document.getElementById("modalProductDescription"); // Inicializa
    modalThumbnailsContainer = document.getElementById("modalThumbnails"); // Inicializa
    contactModal = document.getElementById("contactModal");
    selectedSummary = document.getElementById("selectedItemsSummary");
    itemsDataInput = document.getElementById("itemsData");
    openInterestPanelFromHeaderBtn = document.getElementById("openInterestPanelFromHeader");
    interestCountEl = document.querySelector('.interest-count');

    // Carrega todos os dados (produtos e carrossel)
    loadAllData();
    updateInterestPanel(); // Atualiza o painel de interesses ao carregar a página
    updateInterestCount(); // Garante que a contagem inicial esteja correta

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
        imgModal.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                closeImageModal();
            }
        });
    }
    if (modalImg) {
        modalImg.addEventListener("mousedown", handlePanStart);
        modalImg.addEventListener("touchstart", handlePanStart, { passive: false });
        modalImg.addEventListener("contextmenu", e => e.preventDefault());
        modalImg.addEventListener('click', e => e.stopPropagation());
    }

    // Event Listeners para o modal de contato
    const openContactModalBtn = document.getElementById("openContactModalBtn");
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

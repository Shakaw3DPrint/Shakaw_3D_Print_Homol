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
let modalProductDescription; // Novo: para a descrição do produto no modal
let modalThumbnailsContainer; // Novo: para as miniaturas no modal

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
        // Garante que a string seja tratada corretamente para float
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

        if (document.getElementById("instagramCarousel")) {
            renderInstagramCarousel();
        }

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

// ============================================================
// FILTROS (CATÁLOGO)
// ============================================================

function initFilters() {
    const categoryFilter = document.getElementById("categoryFilter");
    const searchInput = document.getElementById("searchInput");
    const sortSelect = document.getElementById("sortSelect");

    if (categoryFilter) {
        categoryFilter.addEventListener("change", applyFilters);
    }
    if (searchInput) {
        searchInput.addEventListener("input", applyFilters);
    }
    if (sortSelect) {
        sortSelect.addEventListener("change", applyFilters);
    }
}

function applyFilters() {
    const categoryFilter = document.getElementById("categoryFilter");
    const searchInput = document.getElementById("searchInput");
    const sortSelect = document.getElementById("sortSelect");

    const selectedCategory = categoryFilter ? categoryFilter.value : "all";
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    const sortBy = sortSelect ? sortSelect.value : "name-asc";

    let filteredProducts = allProducts.filter(product => {
        const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                              product.description.toLowerCase().includes(searchTerm);
        return matchesCategory && matchesSearch;
    });

    filteredProducts.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        const priceA = parsePrice(a.price);
        const priceB = parsePrice(b.price);

        if (sortBy === "name-asc") return nameA.localeCompare(nameB);
        if (sortBy === "name-desc") return nameB.localeCompare(nameA);
        if (sortBy === "price-asc") return priceA - priceB;
        if (sortBy === "price-desc") return priceB - priceA;
        return 0;
    });

    renderProducts(filteredProducts);
}

// ============================================================
// MODAL DE IMAGEM (DETALHES DO PRODUTO)
// ============================================================

function openImageModal(product) {
    if (!imgModal || !modalImg || !modalProductDescription || !modalThumbnailsContainer) return;

    // Atualiza o título do modal com o nome do produto
    const modalTitle = imgModal.querySelector('.modal-content h2');
    if (modalTitle) modalTitle.textContent = product.name;

    // Atualiza a descrição do produto no modal
    modalProductDescription.innerHTML = product.description || 'Sem descrição.';

    modalImages = [];
    if (product.mainImage) {
        modalImages.push(product.mainImage);
    }
    if (product.thumbnails && product.thumbnails.length > 0) {
        product.thumbnails.forEach(thumb => {
            modalImages.push(thumb);
        });
    }

    if (modalImages.length === 0) {
        modalImages.push('https://via.placeholder.com/600x400?text=Sem+Imagem');
    }

    currentModalImageIndex = 0;
    showModalImage(currentModalImageIndex);
    renderModalThumbnails(); // Renderiza as miniaturas
    resetZoomAndPan();
    imgModal.classList.add('open');
}

function closeImageModal() {
    if (imgModal) {
        imgModal.classList.remove('open');
        resetZoomAndPan();
    }
}

function showModalImage(index) {
    if (!modalImg || modalImages.length === 0) return;
    currentModalImageIndex = (index + modalImages.length) % modalImages.length;
    modalImg.src = modalImages[currentModalImageIndex];
    resetZoomAndPan(); // Reseta zoom e pan ao trocar de imagem
    updateActiveThumbnail(); // Atualiza a miniatura ativa
}

function navigateModalImages(direction) {
    showModalImage(currentModalImageIndex + direction);
}

function renderModalThumbnails() {
    if (!modalThumbnailsContainer) return;
    modalThumbnailsContainer.innerHTML = ''; // Limpa miniaturas existentes

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

function zoomImage(amount) {
    currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + amount));
    applyZoomAndPan();
}

function resetZoomAndPan() {
    currentZoom = DEFAULT_ZOOM;
    currentImgTranslateX = 0;
    currentImgTranslateY = 0;
    applyZoomAndPan();
}

function applyZoomAndPan() {
    if (modalImg) {
        modalImg.style.transform = `scale(${currentZoom}) translate(${currentImgTranslateX}px, ${currentImgTranslateY}px)`;
        // Adiciona/remove a classe 'zoomable' para mudar o cursor
        if (currentZoom > DEFAULT_ZOOM) {
            modalImg.classList.add('zoomable');
        } else {
            modalImg.classList.remove('zoomable');
        }
    }
}

function handleWheelZoom(e) {
    if (!imgModal.classList.contains('open')) return; // Só aplica zoom se o modal estiver aberto
    e.preventDefault(); // Impede o scroll da página
    const zoomDirection = e.deltaY < 0 ? ZOOM_INCREMENT : -ZOOM_INCREMENT;
    zoomImage(zoomDirection);
}

function handlePanStart(e) {
    if (currentZoom <= DEFAULT_ZOOM) return; // Só permite pan se houver zoom
    e.preventDefault();
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
    let clientX, clientY;
    if (e.type === 'mousemove') {
        clientX = e.clientX;
        clientY = e.clientY;
    } else if (e.type === 'touchmove') {
        e.preventDefault(); // Impede o scroll da página em dispositivos touch
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }

    const dx = clientX - panStartX;
    const dy = clientY - panStartY;

    currentImgTranslateX = panStartImgX + dx / currentZoom;
    currentImgTranslateY = panStartImgY + dy / currentZoom;

    applyZoomAndPan();
}

function handlePanEnd() {
    isPanning = false;
    if (modalImg) modalImg.style.cursor = 'grab';
    document.removeEventListener('mousemove', handlePanMove);
    document.removeEventListener('mouseup', handlePanEnd);
    document.removeEventListener('touchmove', handlePanMove);
    document.removeEventListener('touchend', handlePanEnd);
}

// =============================================
// PAINEL DE INTERESSES (CARRINHO)
// =============================================

function saveInterestItems() {
    localStorage.setItem('interestItems', JSON.stringify(interestItems));
    updateInterestCount();
}

function addToInterest(product) {
    const existingItem = interestItems.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 1) + 1;
    } else {
        interestItems.push({
            id: product.id,
            name: product.name,
            price: parsePrice(product.price), // Garante que o preço é um número aqui
            mainImage: product.mainImage,
            quantity: 1
        });
    }
    saveInterestItems();
    updateInterestPanel();
    showInterestPanel(); // Mostra o painel ao adicionar item
}

function removeFromInterest(productId) {
    interestItems = interestItems.filter(item => item.id !== productId);
    saveInterestItems();
    updateInterestPanel();
}

function updateInterestQuantity(productId, change) {
    const item = interestItems.find(item => item.id === productId);
    if (item) {
        item.quantity = (item.quantity || 1) + change;
        if (item.quantity <= 0) {
            removeFromInterest(productId);
        } else {
            saveInterestItems();
            updateInterestPanel();
        }
    }
}

function updateInterestPanel() {
    if (!interestList || !interestTotalEl) return;

    interestList.innerHTML = "";
    let total = 0;

    if (interestItems.length === 0) {
        interestList.innerHTML = '<p class="empty-list-message">Sua lista de interesses está vazia.</p>';
    } else {
        interestItems.forEach(item => {
            const listItem = document.createElement("li");
            const itemPrice = parsePrice(item.price); // Garante que o preço é um número
            const subtotal = itemPrice * (item.quantity || 1);
            total += subtotal;

            listItem.innerHTML = `
                <img src="${item.mainImage}" alt="${item.name}" class="interest-item-thumb">
                <div class="interest-item-details">
                    <span>${item.name}</span>
                    <div class="interest-item-controls">
                        <button class="quantity-btn" data-id="${item.id}" data-change="-1">-</button>
                        <span>${item.quantity || 1}</span>
                        <button class="quantity-btn" data-id="${item.id}" data-change="1">+</button>
                        <span>R$ ${itemPrice.toFixed(2).replace('.', ',')}</span>
                        <button class="remove-item-btn" data-id="${item.id}"><i class="fas fa-times"></i></button>
                    </div>
                </div>
            `;
            interestList.appendChild(listItem);
        });

        interestList.querySelectorAll('.quantity-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.dataset.id;
                const change = parseInt(e.target.dataset.change);
                updateInterestQuantity(productId, change);
            });
        });

        interestList.querySelectorAll('.remove-item-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.dataset.id;
                removeFromInterest(productId);
            });
        });
    }

    interestTotalEl.textContent = `Total: R$ ${total.toFixed(2).replace('.', ',')}`;
}

function toggleInterestPanel() {
    if (!interestPanel) return;
    if (interestPanel.classList.contains('open')) {
        hideInterestPanel();
    } else {
        showInterestPanel();
    }
}

function showInterestPanel() {
    if (!interestPanel) return;
    clearTimeout(interestPanelTimeoutId);
    interestPanel.classList.add('open');
}

function hideInterestPanel() {
    if (!interestPanel) return;
    // Adiciona um pequeno atraso para permitir interações antes de fechar
    interestPanelTimeoutId = setTimeout(() => {
        interestPanel.classList.remove('open');
    }, 300); // 300ms de atraso
}

function updateInterestCount() {
    if (interestCountEl) {
        const count = interestItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
        interestCountEl.textContent = count;
        if (count > 0) {
            interestCountEl.classList.add('has-items');
        } else {
            interestCountEl.classList.remove('has-items');
        }
    }
}

// =============================================
// MODAL DE CONTATO (FINALIZAR PEDIDO)
// =============================================

function showContactModal() {
    if (!contactModal || !selectedSummary || !itemsDataInput) return;

    selectedSummary.innerHTML = "";
    let text = "";
    let total = 0;

    if (interestItems.length === 0) {
        selectedSummary.innerHTML = '<p>Sua lista de interesses está vazia. Adicione itens antes de solicitar um orçamento.</p>';
        itemsDataInput.value = "Nenhum item selecionado.";
    } else {
        interestItems.forEach(item => {
            const div = document.createElement("div");
            const itemPrice = parsePrice(item.price);
            const subtotal = itemPrice * (item.quantity || 1);
            div.innerHTML = `<strong>${item.quantity}x</strong> ${item.name} (R$ ${itemPrice.toFixed(2).replace('.', ',')}) - Subtotal: R$ ${subtotal.toFixed(2).replace('.', ',')}`;
            if (selectedSummary) selectedSummary.appendChild(div);
            text += `${item.quantity}x ${item.name} (R$ ${itemPrice.toFixed(2).replace('.', ',')}) - Subtotal: R$ ${subtotal.toFixed(2).replace('.', ',')}\n`;
            total += subtotal;
        });

        if (total > 0) text += `\nTotal Geral: R$ ${total.toFixed(2).replace(".", ",")}`;
        if (itemsDataInput) itemsDataInput.value = text.trim();
    }

    if (contactModal) contactModal.classList.add('open');
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

        fetch(form.action, { method: "POST", body: new FormData(form) })
            .then(response => {
                if (response.ok) {
                    alert("Sua lista de interesses foi enviada com sucesso!");
                    closeContactModal();
                    interestItems = [];
                    saveInterestItems();
                    updateInterestPanel();
                    window.location.href = "obrigado.html";
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
    catalogGrid = document.getElementById("catalog");
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
    interestCountEl = document.querySelector('.interest-count');
    modalProductDescription = document.getElementById("modalProductDescription"); // Inicializa o novo elemento
    modalThumbnailsContainer = document.getElementById("modalThumbnails"); // Inicializa o novo elemento

    loadAllData();
    updateInterestPanel();
    updateInterestCount();

    if (openInterestPanelFromHeaderBtn) {
        openInterestPanelFromHeaderBtn.addEventListener("click", toggleInterestPanel);
    }
    const closePanelBtn = document.getElementById("closeInterestPanelBtn");
    if (closePanelBtn) closePanelBtn.addEventListener("click", hideInterestPanel);

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

    const openContactModalBtn = document.getElementById("openContactModalBtn");
    if (openContactModalBtn) openContactModalBtn.addEventListener("click", showContactModal);
    const closeContactModalBtn = document.querySelector('.contact-modal .close-contact');
    if (closeContactModalBtn) closeContactModalBtn.addEventListener('click', closeContactModal);

    initContactForm();

    if (document.querySelector('.filter-section')) {
        initFilters();
    }

    setupBackToTopButton();
});
// Garantir que o script seja executado quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    const openInterestPanelFromHeaderBtn = document.getElementById("openInterestPanelFromHeader");
    const interestPanel = document.getElementById("interestPanel");
    const closeInterestPanelBtn = document.querySelector(".close-interest-panel-btn");

    if (openInterestPanelFromHeaderBtn && interestPanel) {
        openInterestPanelFromHeaderBtn.addEventListener("click", function() {
            interestPanel.classList.add('open');
        });
    }

    if (closeInterestPanelBtn && interestPanel) {
        closeInterestPanelBtn.addEventListener("click", function() {
            interestPanel.classList.remove('open');
        });
    }
});

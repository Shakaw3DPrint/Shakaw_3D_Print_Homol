const GITHUB_OWNER = "Shakaw3DPrint";
const GITHUB_REPO = "Shakaw_3D_Print";
const GITHUB_BRANCH = "main";
// A BASE_URL foi removida pois os caminhos das imagens nos JSONs agora são absolutos a partir da raiz do site
// const BASE_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/`;

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
    // CORREÇÃO AQUI: Usando < e > diretamente, não < e >
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
        // Os caminhos para os JSONs permanecem os mesmos, pois são relativos à raiz do site
        const [productsDioramaRes, productsOutrosRes, carouselRes] = await Promise.all([
            fetch("assets/json/products.json?t=" + Date.now()),
            fetch("assets/json/outros_produtos.json?t=" + Date.now()),
            fetch("assets/json/carousel.json?t=" + Date.now())
        ]);

        const productsDiorama = productsDioramaRes.ok ? await productsDioramaRes.json() : [];
        const productsOutros = productsOutrosRes.ok ? await productsOutrosRes.json() : [];
        carouselItems = carouselRes.ok ? await carouselRes.json() : [];

        // Garante que todos os produtos tenham uma categoria
        productsDiorama.forEach(p => { if (!p.category) p.category = "diorama-garagem"; });
        productsOutros.forEach(p => {
            if (!p.category) p.category = "produtos-funcionais";
            // Mapeia "action-figures" para "miniaturas-3d" se a categoria original fosse essa
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
        // item.src já deve ser o caminho completo /assets/img/...
        // CORREÇÃO AQUI: A tag <img> estava faltando no innerHTML
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
        card.dataset.productId = product.id;

        // product.mainImage já deve ser o caminho completo /assets/img/...
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

    // Adiciona event listeners para os botões "Adicionar à Lista" e "Ver Detalhes"
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

    // Ordenação
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
    if (!imgModal || !modalImg) return;

    modalImages = [];
    if (product.mainImage) {
        modalImages.push(product.mainImage); // Caminho já completo
    }
    if (product.thumbnails && product.thumbnails.length > 0) {
        product.thumbnails.forEach(thumb => {
            modalImages.push(thumb); // Caminho já completo
        });
    }

    if (modalImages.length === 0) {
        modalImages.push('https://via.placeholder.com/600x400?text=Sem+Imagem');
    }

    currentModalImageIndex = 0;
    showModalImage(currentModalImageIndex);
    resetZoomAndPan(); // Garante que o zoom e pan sejam resetados ao abrir o modal
    imgModal.classList.add('open'); // Adiciona a classe 'open' para exibir o modal
}

function closeImageModal() {
    if (imgModal) {
        imgModal.classList.remove('open'); // Remove a classe 'open' para esconder o modal
        resetZoomAndPan(); // Garante que o zoom e pan sejam resetados ao fechar o modal
    }
}

function showModalImage(index) {
    if (!modalImg || modalImages.length === 0) return;
    currentModalImageIndex = (index + modalImages.length) % modalImages.length;
    modalImg.src = modalImages[currentModalImageIndex];
    resetZoomAndPan(); // Reseta zoom e pan ao trocar de imagem
}

function navigateModalImages(direction) {
    showModalImage(currentModalImageIndex + direction);
}

function zoomImage(amount) {
    currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + amount));
    applyZoomAndPan();
}

function resetZoomAndPan() {
    currentZoom = DEFAULT_ZOOM; // Usa o zoom padrão
    currentImgTranslateX = 0;
    currentImgTranslateY = 0;
    applyZoomAndPan();
}

function applyZoomAndPan() {
    if (modalImg) {
        modalImg.style.transform = `scale(${currentZoom}) translate(${currentImgTranslateX}px, ${currentImgTranslateY}px)`;
        modalImg.style.cursor = currentZoom > DEFAULT_ZOOM ? 'grab' : 'zoom-in'; // Cursor muda se houver zoom
    }
}

function handleWheelZoom(e) {
    if (!imgModal || !imgModal.classList.contains('open')) return; // Só aplica zoom se o modal estiver aberto
    e.preventDefault(); // Impede o scroll da página
    const zoomDirection = e.deltaY < 0 ? ZOOM_INCREMENT : -ZOOM_INCREMENT;
    zoomImage(zoomDirection);
}

function handlePanStart(e) {
    if (currentZoom <= DEFAULT_ZOOM) return; // Só permite pan se houver zoom
    isPanning = true;
    modalImg.style.cursor = 'grabbing';
    panStartX = e.clientX || e.touches[0].clientX;
    panStartY = e.clientY || e.touches[0].clientY;
    panStartImgX = currentImgTranslateX;
    panStartImgY = currentImgTranslateY;

    document.addEventListener('mousemove', handlePanMove);
    document.addEventListener('mouseup', handlePanEnd);
    document.addEventListener('touchmove', handlePanMove, { passive: false });
    document.addEventListener('touchend', handlePanEnd);
}

function handlePanMove(e) {
    if (!isPanning) return;
    e.preventDefault(); // Impede o scroll em dispositivos touch

    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;

    const dx = (clientX - panStartX) / currentZoom; // Ajusta o movimento pelo zoom
    const dy = (clientY - panStartY) / currentZoom;

    currentImgTranslateX = panStartImgX + dx;
    currentImgTranslateY = panStartImgY + dy;

    applyZoomAndPan();
}

function handlePanEnd() {
    isPanning = false;
    if (modalImg) modalImg.style.cursor = currentZoom > DEFAULT_ZOOM ? 'grab' : 'zoom-in';
    document.removeEventListener('mousemove', handlePanMove);
    document.removeEventListener('mouseup', handlePanEnd);
    document.removeEventListener('touchmove', handlePanMove);
    document.removeEventListener('touchend', handlePanEnd);
}

// ============================================================
// PAINEL DE INTERESSES
// ============================================================

function addToInterest(product) {
    const existingItem = interestItems.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        interestItems.push({
            id: product.id,
            name: product.name,
            price: parsePrice(product.price),
            quantity: 1
        });
    }
    saveInterestItems();
    updateInterestPanel();
    showInterestPanelTemporarily();
}

function removeFromInterest(productId) {
    interestItems = interestItems.filter(item => item.id !== productId);
    saveInterestItems();
    updateInterestPanel();
    showInterestPanelTemporarily();
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
            showInterestPanelTemporarily();
        }
    }
}

function saveInterestItems() {
    localStorage.setItem('interestItems', JSON.stringify(interestItems));
}

function updateInterestPanel() {
    if (!interestList || !interestTotalEl) return;

    interestList.innerHTML = ""; // Limpa o conteúdo existente
    let total = 0;

    if (interestItems.length === 0) {
        interestList.innerHTML = '<li class="empty-message">Sua lista de interesses está vazia.</li>';
    } else {
        interestItems.forEach(item => {
            const listItem = document.createElement("li");
            listItem.className = "interest-item";
            listItem.innerHTML = `
                <span>${item.name}</span>
                <div class="item-controls">
                    <button class="quantity-btn decrease" data-id="${item.id}">-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn increase" data-id="${item.id}">+</button>
                    <span>R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                    <button class="remove-item" data-id="${item.id}"><i class="fas fa-times"></i></button>
                </div>
            `;
            interestList.appendChild(listItem);
            total += item.price * item.quantity;
        });
    }

    interestTotalEl.textContent = `Total: R$ ${total.toFixed(2).replace('.', ',')}`;

    // Adiciona event listeners para os botões de controle de quantidade e remoção
    interestList.querySelectorAll('.quantity-btn.decrease').forEach(button => {
        button.addEventListener('click', (e) => updateInterestQuantity(e.target.dataset.id, -1));
    });
    interestList.querySelectorAll('.quantity-btn.increase').forEach(button => {
        button.addEventListener('click', (e) => updateInterestQuantity(e.target.dataset.id, 1));
    });
    interestList.querySelectorAll('.remove-item').forEach(button => {
        button.addEventListener('click', (e) => removeFromInterest(e.target.dataset.id));
    });

    updateInterestCount(); // Garante que a contagem seja atualizada
}

function toggleInterestPanel() {
    if (interestPanel) {
        interestPanel.classList.toggle('open');
        if (interestPanel.classList.contains('open')) {
            clearTimeout(interestPanelTimeoutId); // Cancela qualquer timeout existente
        }
    }
}

function showInterestPanelTemporarily() {
    if (interestPanel) {
        interestPanel.classList.add('open');
        clearTimeout(interestPanelTimeoutId);
        interestPanelTimeoutId = setTimeout(() => {
            interestPanel.classList.remove('open');
        }, 5000); // Fecha automaticamente após 5 segundos
    }
}

function hideInterestPanel() {
    if (interestPanel) {
        interestPanel.classList.remove('open');
        clearTimeout(interestPanelTimeoutId);
    }
}

function updateInterestCount() {
    if (interestCountEl) {
        const totalItems = interestItems.reduce((sum, item) => sum + item.quantity, 0);
        interestCountEl.textContent = totalItems;
        if (totalItems > 0) {
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
        // Opcional: desabilitar o botão de enviar ou impedir a abertura do modal se a lista estiver vazia
        // Ou simplesmente permitir que o usuário envie um contato geral
    } else {
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
    }

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
                    saveInterestItems(); // Salva a lista vazia no localStorage
                    updateInterestPanel();
                    window.location.href = "obrigado.html"; // Redireciona para a página de obrigado
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
    interestCountEl = document.querySelector('.interest-count'); // Inicializa o elemento de contagem

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
        modalImg.addEventListener('click', e => e.stopPropagation()); // Impede que o clique na imagem feche o modal
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

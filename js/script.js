// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
const GITHUB_OWNER  = "Shakaw3DPrint";
const GITHUB_REPO   = "Shakaw_3D_Print";
const GITHUB_BRANCH = "main";
const BASE_URL      = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/`;

// Elementos DOM (serão inicializados em DOMContentLoaded)
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
let openInterestPanelFromHeaderBtn; // Novo botão no cabeçalho

// Dados
let allProducts = [];
let carouselItems = [];
let interestItems = JSON.parse(localStorage.getItem('interestItems')) || []; // Carrega do localStorage
let interestPanelTimeoutId = null;

// Carrossel da Home
let currentSlide = 0;
let slideInterval;

// Modal de Imagem (Zoom e Pan)
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

// Mapeamento de categorias para badges (usado na renderização)
const categoryBadgeMap = {
    "diorama-garagem":     '<span class="cat-badge cat-diorama-garagem">Diorama Garagem</span>',
    "miniaturas-3d":       '<span class="cat-badge cat-miniaturas-3d">Miniaturas 3D</span>',
    "miniaturas-rpg":      '<span class="cat-badge cat-miniaturas-rpg">Miniaturas RPG</span>',
    "produtos-funcionais": '<span class="cat-badge cat-produtos-funcionais">Funcional</span>',
    "action-figures":      '<span class="cat-badge cat-action-figures">Action Figure</span>' // Adicionado para outros projetos
};

// =============================================
// FUNÇÕES AUXILIARES
// =============================================

function parsePrice(str) {
    if (!str || typeof str !== "string") return 0;
    return parseFloat(str.replace("R$", "").replace(".", "").replace(",", ".").trim()) || 0;
}

function showLoader() {
    if (loader) loader.style.display = 'block';
    if (catalogGrid) catalogGrid.style.display = 'none';
}

function hideLoader() {
    if (loader) loader.style.display = 'none';
    if (catalogGrid) catalogGrid.style.display = 'grid'; // Ou 'block' dependendo do layout
}

// =============================================
// CARREGAMENTO DE DADOS (PRODUTOS E CARROSSEL)
// =============================================

async function loadAllData() {
    showLoader();
    try {
        const [productsDioramaRes, productsOutrosRes, carouselRes] = await Promise.all([
            fetch(BASE_URL + "assets/json/products.json?t=" + Date.now()),
            fetch(BASE_URL + "assets/json/outros_produtos.json?t=" + Date.now()),
            fetch(BASE_URL + "assets/json/carousel.json?t=" + Date.now())
        ]);

        const productsDiorama = productsDioramaRes.ok ? await productsDioramaRes.json() : [];
        const productsOutros  = productsOutrosRes.ok ? await productsOutrosRes.json() : [];
        carouselItems         = carouselRes.ok ? await carouselRes.json() : [];

        // Garante que todos os produtos tenham uma categoria
        productsDiorama.forEach(p => { if (!p.category) p.category = "diorama-garagem"; });
        productsOutros.forEach(p => {
            if (!p.category) p.category = "produtos-funcionais"; // Assumindo "outros" são funcionais por padrão
            // Ajusta o caminho das imagens para os produtos "outros" se necessário
            if (p.mainImage && !p.mainImage.startsWith(BASE_URL)) p.mainImage = `assets/img/projects/${p.mainImage.split('/').pop()}`;
            if (p.thumbnails && Array.isArray(p.thumbnails)) {
                p.thumbnails = p.thumbnails.map(thumb => !thumb.startsWith(BASE_URL) ? `assets/img/projects/${thumb.split('/').pop()}` : thumb);
            }
        });

        allProducts = productsDiorama.concat(productsOutros);

        // Se estiver na página inicial, renderiza o carrossel do Instagram
        if (document.getElementById('instagramCarousel')) {
            renderInstagramCarousel();
        }

        // Se estiver em uma página de catálogo, renderiza os produtos
        if (catalogGrid) {
            renderProducts(allProducts);
        }

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        if (catalogGrid) {
            catalogGrid.innerHTML = '<p class="loading-message" style="color:#ff6b6b;">Erro ao carregar produtos. Tente novamente mais tarde.</p>';
        }
    } finally {
        hideLoader();
    }
}

// =============================================
// RENDERIZAÇÃO DE PRODUTOS (PARA CATÁLOGO)
// =============================================

function renderProducts(productsToRender) {
    if (!catalogGrid) return;
    catalogGrid.innerHTML = ""; // Limpa o conteúdo existente

    if (productsToRender.length === 0) {
        catalogGrid.innerHTML = '<p class="loading-message">Nenhum produto encontrado nesta categoria.</p>';
        if (resultsCount) resultsCount.textContent = "";
        return;
    }

    if (resultsCount) {
        resultsCount.textContent = `${productsToRender.length} produto${productsToRender.length > 1 ? "s" : ""} encontrado${productsToRender.length > 1 ? "s" : ""}`;
    }

    productsToRender.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";
        card.dataset.productId = product.id;

        const badge = categoryBadgeMap[product.category] || '';
        const imgSrc = product.mainImage ? BASE_URL + product.mainImage : 'https://via.placeholder.com/200x200?text=Sem+Imagem';
        const priceHTML = product.price ? `<div class="price">${product.price}</div>` : `<div class="price consult">Sob consulta</div>`;

        card.innerHTML = `
            <img src="${imgSrc}" alt="${product.name}">
            <div class="product-card-content">
                <h3>${product.name} ${badge}</h3>
                <p>${product.description}</p>
                ${priceHTML}
                <button class="add-interest-btn" data-product-id="${product.id}">Tenho Interesse</button>
            </div>
        `;
        catalogGrid.appendChild(card);

        // Adiciona evento de clique para abrir o modal de imagem
        card.querySelector('img').addEventListener('click', () => openImageModal(product));
        // Adiciona evento de clique para adicionar ao interesse
        card.querySelector('.add-interest-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Evita que o clique no botão abra o modal de imagem
            addToInterests(product);
        });
    });
}

// =============================================
// FILTROS DE PRODUTOS (PARA CATÁLOGO)
// =============================================

function initFilters() {
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const cat = btn.dataset.filter; // Mudado de 'category' para 'filter' para consistência
            const filtered = cat === "all"
                ? allProducts
                : allProducts.filter(p => p.category === cat);

            renderProducts(filtered);
        });
    });
}

// =============================================
// CARROSSEL DO INSTAGRAM (HOME)
// =============================================

function renderInstagramCarousel() {
    const instagramCarouselContainer = document.getElementById('instagramCarousel');
    if (!instagramCarouselContainer) return;

    instagramCarouselContainer.innerHTML = ''; // Limpa placeholders

    // Usando os itens do carousel.json para simular posts do Instagram
    // No futuro, aqui seria a integração real com a API do Instagram
    if (carouselItems.length === 0) {
        instagramCarouselContainer.innerHTML = '<p style="text-align:center; width:100%; color:rgba(255,255,255,0.6);">Nenhuma postagem do Instagram para exibir.</p>';
        return;
    }

    carouselItems.forEach(item => {
        const carouselItem = document.createElement('div');
        carouselItem.className = 'instagram-carousel-item';
        carouselItem.innerHTML = `<img src="${BASE_URL + item.src}" alt="${item.alt}">`;
        instagramCarouselContainer.appendChild(carouselItem);
    });
}

// =============================================
// MODAL DE IMAGEM (ZOOM E NAVEGAÇÃO)
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

async function openImageModal(product) {
    if (!imgModal || !modalImg) return;

    // Coleta todas as imagens do produto (principal + miniaturas)
    let productImages = [];
    if (product.mainImage) {
        productImages.push(BASE_URL + product.mainImage);
    }
    if (product.thumbnails && product.thumbnails.length > 0) {
        product.thumbnails.forEach(thumb => productImages.push(BASE_URL + thumb));
    }

    // Filtra imagens válidas
    const results = await Promise.all(productImages.map(checkImage));
    currentProductImages = results.filter(r => r.status === "loaded").map(r => r.url);

    if (currentProductImages.length === 0) {
        console.warn("Nenhuma imagem para exibir no modal.");
        return;
    }

    currentImageIndex = 0; // Sempre começa com a primeira imagem
    loadModalImage(currentProductImages[currentImageIndex]);

    imgModal.classList.add('open'); // Usa a classe 'open' para controlar display
    document.body.style.overflow = "hidden"; // Impede rolagem do body

    document.removeEventListener("keydown", handleModalKeydown);
    document.addEventListener("keydown", handleModalKeydown);
}

function loadModalImage(src) {
    if (!modalImg) return;
    modalImg.style.opacity = "0";
    modalImg.style.transition = "none"; // Desativa transição para troca rápida de imagem

    const onLoad = () => {
        resetZoomAndPan();
        modalImg.style.transition = "opacity 0.25s ease";
        modalImg.style.opacity    = "1";
        modalImg.removeEventListener("load",  onLoad);
        modalImg.removeEventListener("error", onErr);
    };
    const onErr = () => {
        modalImg.style.opacity = "1"; // Mostra mesmo com erro, se for o caso
        modalImg.removeEventListener("load",  onLoad);
        modalImg.removeEventListener("error", onErr);
    };

    modalImg.addEventListener("load",  onLoad);
    modalImg.addEventListener("error", onErr);
    modalImg.src = src;
}

function closeImageModal() {
    if (!imgModal) return;
    imgModal.classList.remove('open');
    document.body.style.overflow = "auto";
    document.removeEventListener("keydown", handleModalKeydown);
    resetZoomAndPan();
}

function navigateModalImages(direction) {
    if (!modalImg || currentProductImages.length <= 1) return;
    currentImageIndex = (currentImageIndex + direction + currentProductImages.length) % currentProductImages.length;
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
    if (!imgModal || !imgModal.classList.contains('open')) return;
    e.preventDefault();
    const rect = imgModal.getBoundingClientRect();
    const focal = {
        x: e.clientX - rect.left - rect.width  / 2,
        y: e.clientY - rect.top  - rect.height / 2
    };
    zoomImage(e.deltaY < 0 ? ZOOM_INCREMENT : -ZOOM_INCREMENT, focal);
}

function handleModalKeydown(e) {
    if (!imgModal || !imgModal.classList.contains('open')) return;
    switch (e.key) {
        case "ArrowRight": navigateModalImages(1);            break;
        case "ArrowLeft":  navigateModalImages(-1);           break;
        case "+": case "=": zoomImage(ZOOM_INCREMENT);  break;
        case "-":           zoomImage(-ZOOM_INCREMENT); break;
        case "0":           resetZoomAndPan();          break;
        case "Escape":      closeImageModal();               break;
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
                <span class="item-price">${item.price || 'Sob consulta'}</span>
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
        const label = item.price || "Sob consulta";
        div.innerHTML = `<strong>${item.quantity}x</strong> ${item.name} (${label})`;
        if (selectedSummary) selectedSummary.appendChild(div);
        text  += `${item.quantity}x ${item.name} (${label})\n`;
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

        // Simula o envio de e-mail (você precisará de um serviço de backend real)
        // Por exemplo, FormSubmit.co, EmailJS, Netlify Forms, etc.
        // Para demonstração, apenas simula sucesso e redireciona.
        setTimeout(() => {
            alert("Sua lista de interesses foi enviada com sucesso!");
            closeContactModal();
            interestItems = []; // Limpa a lista após o envio
            updateInterestPanel();
            // window.location.href = "obrigado.html"; // Redireciona para uma página de obrigado
            if (btn) { btn.innerHTML = orig; btn.disabled = false; }
        }, 1500);

        // Exemplo de como você faria com um serviço como FormSubmit:
        /*
        fetch(form.action, { method: "POST", body: new FormData(form) })
            .then(() => {
                alert("Sua lista de interesses foi enviada com sucesso!");
                closeContactModal();
                interestItems = [];
                updateInterestPanel();
                // window.location.href = "obrigado.html";
            })
            .catch(err => {
                console.error(err);
                alert("Erro ao enviar. Tente novamente.");
            })
            .finally(() => {
                if (btn) { btn.innerHTML = orig; btn.disabled = false; }
            });
        */
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

const GITHUB_OWNER  = "Shakaw3DPrint";
const GITHUB_REPO   = "Shakaw_3D_Print";
const GITHUB_BRANCH = "main";
const BASE_URL      = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/`;

let allProducts = [];
let carouselItems = [];
let currentSlide = 0;
let slideInterval;
let currentZoom = 1;
let currentImageIndex = 0;
let filteredImages = []; // Para o modal de imagem

const categoryBadgeMap = {
    "diorama-garagem":     '<span class="cat-badge cat-diorama-garagem">Diorama Garagem</span>',
    "miniaturas-3d":       '<span class="cat-badge cat-miniaturas-3d">Miniaturas 3D</span>',
    "miniaturas-rpg":      '<span class="cat-badge cat-miniaturas-rpg">Miniaturas RPG</span>',
    "produtos-funcionais": '<span class="cat-badge cat-produtos-funcionais">Funcional</span>'
};

// ============================================================
// CARREGAMENTO DE PRODUTOS E CARROSSEL
// ============================================================
async function loadProductsAndCarousel() {
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

        // Garante que todos os produtos tenham uma categoria, se não tiverem, define como 'diorama-garagem' por padrão
        productsDiorama.forEach(p => { if (!p.category) p.category = "diorama-garagem"; });
        productsOutros.forEach(p => { if (!p.category) p.category = "produtos-funcionais"; }); // Assumindo que os "outros" são funcionais por padrão

        allProducts = productsDiorama.concat(productsOutros);
        renderProducts(allProducts);
        renderCarousel();
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        document.getElementById("catalog").innerHTML = '<p class="loading-message" style="color:#ff6b6b;">Erro ao carregar produtos. Tente novamente mais tarde.</p>';
    } finally {
        hideLoader();
    }
}

function renderProducts(productsToRender) {
    const grid = document.getElementById("catalog");
    grid.innerHTML = ""; // Limpa o conteúdo existente

    if (productsToRender.length === 0) {
        grid.innerHTML = '<p class="loading-message">Nenhum produto encontrado nesta categoria.</p>';
        return;
    }

    productsToRender.forEach(product => {
        const card = document.createElement("div"); // Mudado para div para gerenciar o clique do modal
        card.className = "product-card";
        card.dataset.productId = product.id; // Adiciona ID para identificar o produto no modal

        const badge = categoryBadgeMap[product.category] || '';
        const imgSrc = product.mainImage ? BASE_URL + product.mainImage : 'https://via.placeholder.com/200x200?text=Sem+Imagem';

        card.innerHTML = `
            <img src="${imgSrc}" alt="${product.name}">
            <div class="product-card-content">
                <h3>${product.name} ${badge}</h3>
                <p>${product.description}</p>
                <div class="price ${product.price ? '' : 'consult'}">${product.price || 'Sob consulta'}</div>
            </div>
        `;
        grid.appendChild(card);

        // Adiciona evento de clique para abrir o modal de imagem
        card.addEventListener('click', () => openImageModal(product));
    });
}

function filterProducts(filterCategory) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.filter-btn[data-filter="${filterCategory}"]`).classList.add('active');

    if (filterCategory === 'all') {
        renderProducts(allProducts);
    } else {
        const filtered = allProducts.filter(p => p.category === filterCategory);
        renderProducts(filtered);
    }
}

// ============================================================
// FUNÇÕES DO CARROSSEL
// ============================================================
function renderCarousel() {
    const slideContainer = document.getElementById('carousel');
    const dotsContainer = document.getElementById('carouselIndicators');
    slideContainer.innerHTML = '';
    dotsContainer.innerHTML = '';

    if (carouselItems.length === 0) {
        document.querySelector('.carousel-container').style.display = 'none';
        return;
    } else {
        document.querySelector('.carousel-container').style.display = 'block';
    }

    carouselItems.forEach((item, index) => {
        const slide = document.createElement('div');
        slide.className = 'carousel-item';
        slide.innerHTML = `<img src="${BASE_URL + item.src}" alt="${item.alt}">`;
        slideContainer.appendChild(slide);

        const dot = document.createElement('span');
        dot.className = 'indicator';
        dot.onclick = () => goToSlide(index);
        dotsContainer.appendChild(dot);
    });

    goToSlide(0); // Inicia no primeiro slide
    startSlideShow();
}

function goToSlide(index) {
    const slideContainer = document.getElementById('carousel');
    const dots = document.querySelectorAll('.indicator');

    if (index >= carouselItems.length) {
        currentSlide = 0;
    } else if (index < 0) {
        currentSlide = carouselItems.length - 1;
    } else {
        currentSlide = index;
    }

    slideContainer.style.transform = `translateX(${-currentSlide * 100}%)`;
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlide);
    });
}

function moveSlide(direction) {
    goToSlide(currentSlide + direction);
    resetSlideShow();
}

function startSlideShow() {
    clearInterval(slideInterval);
    slideInterval = setInterval(() => {
        moveSlide(1);
    }, 5000); // Troca de slide a cada 5 segundos
}

function resetSlideShow() {
    clearInterval(slideInterval);
    startSlideShow();
}

// Event listeners para botões do carrossel
document.querySelector('.carousel-btn.prev').addEventListener('click', () => moveSlide(-1));
document.querySelector('.carousel-btn.next').addEventListener('click', () => moveSlide(1));


// ============================================================
// MODAL DE IMAGEM (ZOOM E NAVEGAÇÃO)
// ============================================================
function openImageModal(product) {
    const modal = document.getElementById('imgModal');
    const modalImg = document.getElementById('modalImg');

    // Coleta todas as imagens do produto (principal + miniaturas)
    filteredImages = [];
    if (product.mainImage) {
        filteredImages.push(BASE_URL + product.mainImage);
    }
    if (product.thumbnails && product.thumbnails.length > 0) {
        product.thumbnails.forEach(thumb => filteredImages.push(BASE_URL + thumb));
    }

    if (filteredImages.length === 0) {
        console.warn("Nenhuma imagem para exibir no modal.");
        return;
    }

    currentImageIndex = 0; // Sempre começa com a primeira imagem
    modalImg.src = filteredImages[currentImageIndex];
    modal.classList.add('open');
    resetZoom();
}

function closeImageModal() {
    document.getElementById('imgModal').classList.remove('open');
    resetZoom();
}

function navigateModalImages(direction) {
    currentImageIndex += direction;
    if (currentImageIndex >= filteredImages.length) {
        currentImageIndex = 0;
    } else if (currentImageIndex < 0) {
        currentImageIndex = filteredImages.length - 1;
    }
    document.getElementById('modalImg').src = filteredImages[currentImageIndex];
    resetZoom();
}

function zoomImage(factor) {
    currentZoom = Math.max(1, currentZoom + factor);
    document.getElementById('modalImg').style.transform = `scale(${currentZoom})`;
    document.getElementById('modalImg').style.cursor = currentZoom > 1 ? 'grab' : 'zoom-in';
}

function resetZoom() {
    currentZoom = 1;
    document.getElementById('modalImg').style.transform = `scale(1)`;
    document.getElementById('modalImg').style.cursor = 'zoom-in';
}

// Event listeners para o modal de imagem
document.querySelector('.modal .close').addEventListener('click', closeImageModal);
document.querySelector('.modal-nav.modal-prev').addEventListener('click', () => navigateModalImages(-1));
document.querySelector('.modal-nav.modal-next').addEventListener('click', () => navigateModalImages(1));
document.getElementById('zoomInBtn').addEventListener('click', () => zoomImage(0.2));
document.getElementById('zoomOutBtn').addEventListener('click', () => zoomImage(-0.2));
document.getElementById('zoomResetBtn').addEventListener('click', resetZoom);

// Fechar modal ao clicar fora da imagem (mas dentro do modal)
document.getElementById('imgModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        closeImageModal();
    }
});

// ============================================================
// PAINEL DE INTERESSES
// ============================================================
let interestItems = JSON.parse(localStorage.getItem('interestItems')) || [];

function updateInterestPanel() {
    const list = document.getElementById('interestList');
    const totalDiv = document.getElementById('interestTotal');
    list.innerHTML = '';
    let total = 0;

    if (interestItems.length === 0) {
        list.innerHTML = '<li>Nenhum item adicionado.</li>';
        totalDiv.textContent = 'Total: R$ 0,00';
        return;
    }

    interestItems.forEach((item, index) => {
        const li = document.createElement('li');
        const price = parseFloat(item.price.replace('R$', '').replace(',', '.')) || 0;
        total += price;

        li.innerHTML = `
            <div class="item-info">
                <span class="item-name">${item.name}</span>
                <span class="item-price">${item.price || 'Sob consulta'}</span>
            </div>
            <button class="remove-item-btn" data-index="${index}">&times;</button>
        `;
        list.appendChild(li);
    });

    totalDiv.textContent = `Total: R$ ${total.toFixed(2).replace('.', ',')}`;
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

function addToInterests(product) {
    interestItems.push({
        id: product.id,
        name: product.name,
        price: product.price || 'Sob consulta'
    });
    updateInterestPanel();
    showInterestPanel();
}

function showInterestPanel() {
    document.getElementById('interestPanel').classList.add('open');
}

function hideInterestPanel() {
    document.getElementById('interestPanel').classList.remove('open');
}

// Event listeners para o painel de interesses
document.querySelector('.interest-btn').addEventListener('click', showInterestPanel);
document.getElementById('closeInterestPanelBtn').addEventListener('click', hideInterestPanel);


// ============================================================
// MODAL DE CONTATO
// ============================================================
function showContactModal() {
    const modal = document.getElementById('contactModal');
    const summary = document.getElementById('selectedItemsSummary');
    const itemsDataInput = document.getElementById('itemsData');
    summary.innerHTML = '';

    if (interestItems.length === 0) {
        summary.innerHTML = '<div>Nenhum item na sua lista de interesses.</div>';
        itemsDataInput.value = '';
    } else {
        let itemsText = '';
        interestItems.forEach(item => {
            summary.innerHTML += `<div>${item.name} - ${item.price || 'Sob consulta'}</div>`;
            itemsText += `${item.name} (${item.price || 'Sob consulta'}); `;
        });
        itemsDataInput.value = itemsText.trim();
    }
    modal.classList.add('open');
}

function closeContactModal() {
    document.getElementById('contactModal').classList.remove('open');
}

document.querySelector('.contact-modal .close-contact').addEventListener('click', closeContactModal);

// ============================================================
// BOTÃO VOLTAR AO TOPO
// ============================================================
const backToTopBtn = document.getElementById("backToTopBtn");

window.onscroll = function() {
    if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
        backToTopBtn.style.display = "block";
    } else {
        backToTopBtn.style.display = "none";
    }
};

backToTopBtn.addEventListener('click', () => {
    document.body.scrollTop = 0; // Para Safari
    document.documentElement.scrollTop = 0; // Para Chrome, Firefox, IE e Opera
});

// ============================================================
// LOADER
// ============================================================
function showLoader() {
    document.getElementById('loader').style.display = 'block';
    document.getElementById('catalog').style.display = 'none'; // Esconde o catálogo enquanto carrega
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('catalog').style.display = 'grid'; // Mostra o catálogo após carregar
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    loadProductsAndCarousel();
    updateInterestPanel(); // Carrega interesses ao iniciar
});

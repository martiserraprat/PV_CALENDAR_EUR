// --- CONFIGURACIÓN ---
const JSON_URL = './eventos_2026.json';

// --- ESTADO DE LA APP ---
let allEvents = [];
let currentGender = 'all';
let dateStart = null;
let dateEnd = null;

// --- REFERENCIAS HTML ---
const eventGrid = document.getElementById('event-grid');
const searchInput = document.getElementById('search-input');
const monthSelect = document.getElementById('filter-month');
const countrySelect = document.getElementById('filter-country');
const levelSelect = document.getElementById('filter-level');
const eventCountText = document.getElementById('event-count');
const genderButtons = document.querySelectorAll('.g-btn');
const clearDateBtn = document.getElementById('clear-date');

// --- 1. CARGA E INICIALIZACIÓN ---
async function init() {
    try {
        const response = await fetch(JSON_URL);
        if (!response.ok) throw new Error("Error al obtener el JSON");
        allEvents = await response.json();
        
        // --- NUEVO: Ordenar por fecha (de más temprano a más tarde) ---
        allEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        
        setupFlatpickr();
        updateFilterOptions();
        applyFilters();
    } catch (error) {
        console.error("Error:", error);
        eventCountText.innerText = "Error cargando base de datos";
    }
}

// --- 2. FILTRADO MAESTRO (Aquí ocurre la magia) ---
function applyFilters() {
    const search = (searchInput.value || "").toLowerCase();
    const month = monthSelect.value;
    const selectedCode = countrySelect.value;
    const level = levelSelect.value;

    const filtered = allEvents.filter(ev => {
        // --- FILTROS FIJOS ---
        
        // 1. Solo Europa
        if (ev.area !== "Europe") return false;

        // 2. Excluir categorías de nivel muy bajo (E y F). 
        // Así no perdemos eventos que tengan otras nomenclaturas.
        if (['E', 'F'].includes(ev.category)) return false;

        // 3. ¿Tiene Pértiga (Pole Vault)?
        const pvDisciplines = ev.disciplines ? ev.disciplines.filter(d => d.name === "Pole Vault") : [];
        if (pvDisciplines.length === 0) return false;

        // --- FILTROS DINÁMICOS (USUARIO) ---

        // 4. Género (Pértiga)
        if (currentGender !== 'all') {
            const targetGender = currentGender === '🚹' ? 'Men' : 'Women';
            if (!pvDisciplines.some(d => d.gender === targetGender)) return false;
        }

        // 5. Búsqueda por texto (Nombre o Ciudad)
        const matchesSearch = ev.name.toLowerCase().includes(search) || 
                              ev.venue.toLowerCase().includes(search);
        if (!matchesSearch) return false;

        // 6. Mes
        const eventMonth = ev.startDate.split('-')[1]; // Extrae "05" de "2026-05-20"
        if (month !== 'all' && eventMonth !== month) return false;

        // 7. País
        const eventCountry = getCountryCode(ev.venue);
        if (selectedCode !== 'all' && eventCountry !== selectedCode) return false;

        // 8. Nivel específico
        if (level !== 'all' && ev.category !== level) return false;

        // 9. Rango de Fechas (Corregido para no mutar el objeto original)
        if (dateStart && dateEnd) {
            const evTime = new Date(ev.startDate).setHours(0,0,0,0);
            const start = new Date(dateStart).setHours(0,0,0,0);
            const end = new Date(dateEnd).setHours(0,0,0,0);
            if (evTime < start || evTime > end) return false;
        }

        return true;
    });

    renderEvents(filtered);
}

// --- 3. RENDERIZADO DE TARJETAS ---
function renderEvents(events) {
    eventGrid.innerHTML = '';
    eventCountText.innerText = `${events.length} Competiciones`;

    events.forEach(ev => {
        const dateStr = formatDate(ev.startDate);
        
        // Lógica de etiquetas de género
        const pvGenders = ev.disciplines.filter(d => d.name === "Pole Vault").map(d => d.gender);
        const isBoth = pvGenders.includes('Men') && pvGenders.includes('Women');
        const genderLabel = isBoth ? "M / F" : (pvGenders.includes('Men') ? "MASCULINO" : "FEMENINO");
        const genderClass = isBoth ? "tag-both" : (pvGenders.includes('Men') ? "tag-m" : "tag-f");

        // Lógica de Niveles y Colores (Adaptada al CSS de tu versión antigua)
        let levelName = ev.category || "N/A";
        let levelClass = "level-silver"; // Por defecto, si no es ninguna, le ponemos silver (como tenías antes)
        
        switch(ev.category) {
            case 'A': levelName = "GOLD"; levelClass = "level-gold"; break;
            case 'B': levelName = "SILVER"; levelClass = "level-silver"; break;
            case 'C': levelName = "BRONZE"; levelClass = "level-bronze"; break;
            case 'D': levelName = "CHALLENGER"; levelClass = "level-challenger"; break;
            default: levelName = ev.category || "UNRATED"; levelClass = "level-silver";
        }

        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <span class="card-date"><i class="far fa-calendar-check"></i> ${dateStr}</span>
            <h3>${ev.name}</h3>
            <div class="location-info">
                <i class="fas fa-map-marker-alt"></i> ${ev.venue}
            </div>
            <div class="card-tags">
                <span class="tag ${genderClass}">${genderLabel}</span>
                <span class="tag ${levelClass}">${levelName}</span>
            </div>
        `;
        card.onclick = () => openModal(ev);
        eventGrid.appendChild(card);
    });
}

// --- 4. VENTANA MODAL ---
function openModal(ev) {
    const modal = document.getElementById('event-modal');
    
    document.getElementById('modal-title').innerText = ev.name;
    document.getElementById('modal-location').innerText = ev.venue;
    document.getElementById('modal-area').innerText = ev.area;
    
    let catName = ev.category;
    if(catName === 'A') catName = 'GOLD';
    if(catName === 'B') catName = 'SILVER';
    if(catName === 'C') catName = 'BRONZE';
    if(catName === 'D') catName = 'CHALLENGER';
    document.getElementById('modal-cat').innerText = catName || 'N/A';
    
    const pvGenders = ev.disciplines.filter(d => d.name === "Pole Vault").map(d => d.gender);
    document.getElementById('modal-vault').innerText = pvGenders.join(' & ');
    
    document.getElementById('modal-date-tag').innerText = new Date(ev.startDate).toLocaleDateString('es-ES', { dateStyle: 'long' });

    // Enlaces (CORREGIDO PARA EVITAR ERROR 404)
    const linksCont = document.getElementById('modal-links');
    linksCont.innerHTML = '';
    if (ev.links?.web) {
        const safeWebUrl = formatUrl(ev.links.web);
        linksCont.innerHTML += `<a href="${safeWebUrl}" target="_blank" class="link-btn"><i class="fas fa-external-link-alt"></i> Web</a>`;
    }
    if (ev.links?.results) {
        const safeResultsUrl = formatUrl(ev.links.results);
        linksCont.innerHTML += `<a href="${safeResultsUrl}" target="_blank" class="link-btn"><i class="fas fa-poll"></i> Resultados</a>`;
    }

    // Contactos (MEJORADO con Título y Teléfono)
    const contactCont = document.getElementById('modal-contacts');
    contactCont.innerHTML = ev.contact && ev.contact.length > 0 
        ? ev.contact.map(p => `
            <div class="contact-card">
                <div class="contact-header">
                    <span class="contact-title">${p.title || 'Organizer'}</span>
                    <strong class="contact-name">${p.name}</strong>
                </div>
                <div class="contact-info">
                    ${p.email ? `<a href="mailto:${p.email}"><i class="fas fa-envelope"></i> ${p.email}</a>` : ''}
                    ${p.phoneNumber ? `<a href="tel:${p.phoneNumber}"><i class="fas fa-phone-alt"></i> ${p.phoneNumber}</a>` : ''}
                </div>
            </div>
        `).join('')
        : '<p class="no-data">Sin contactos disponibles.</p>';

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// --- 5. FUNCIONES AUXILIARES ---

// NUEVA FUNCIÓN PARA ARREGLAR LAS URLs
function formatUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    return 'https://' + url;
}

function getCountryCode(venue) {
    const match = venue.match(/\(([^)]+)\)$/); 
    return match ? match[1].toUpperCase() : "INT";
}

function formatDate(dateString) {
    const d = new Date(dateString);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit'});
}

function updateFilterOptions() {
    // Solo tomamos en cuenta los eventos que pasarían el filtro base (Pértiga + Europa + Sin E/F)
    const baseEvents = allEvents.filter(ev => 
        ev.area === "Europe" && 
        !['E', 'F'].includes(ev.category) &&
        ev.disciplines && ev.disciplines.some(d => d.name === "Pole Vault")
    );

    // Actualizar Países
    const countries = [...new Set(baseEvents.map(ev => getCountryCode(ev.venue)))].sort();
    countrySelect.innerHTML = '<option value="all">Países</option>' + 
        countries.map(c => `<option value="${c}">${c}</option>`).join('');

    // Actualizar Niveles (Solo los que existan en la DB)
    const levels = [...new Set(baseEvents.map(ev => ev.category))].filter(Boolean).sort();
    levelSelect.innerHTML = '<option value="all">Niveles</option>' + 
        levels.map(l => `<option value="${l}">${l}</option>`).join('');

    // Actualizar Meses
    const monthNames = { "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril", "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto", "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre" };
    const months = [...new Set(baseEvents.map(ev => ev.startDate.split('-')[1]))].sort();
    monthSelect.innerHTML = '<option value="all">Meses</option>' + 
        months.map(m => `<option value="${m}">${monthNames[m]}</option>`).join('');
}

function setupFlatpickr() {
    if (window.flatpickr) {
        window.flatpickr("#date-range", {
            mode: "range",
            dateFormat: "d/m/y",
            theme: "dark",
            locale: { firstDayOfWeek: 1 },
            disableMobile: "true",
            onChange: function(selectedDates) {
                if (selectedDates.length === 2) {
                    dateStart = selectedDates[0];
                    dateEnd = selectedDates[1];
                    if(clearDateBtn) clearDateBtn.style.display = "inline-block";
                } else {
                    dateStart = null;
                    dateEnd = null;
                }
                applyFilters();
            }
        });
    }
}

// --- 6. LISTENERS ---
searchInput.addEventListener('input', applyFilters);
monthSelect.addEventListener('change', applyFilters);
countrySelect.addEventListener('change', applyFilters);
levelSelect.addEventListener('change', applyFilters);

genderButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        genderButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentGender = btn.dataset.gender;
        applyFilters();
    });
});

document.getElementById('close-modal').onclick = () => {
    document.getElementById('event-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
};

if (clearDateBtn) {
    clearDateBtn.onclick = () => {
        dateStart = null;
        dateEnd = null;
        document.getElementById('date-range')._flatpickr.clear();
        clearDateBtn.style.display = "none";
        applyFilters();
    };
}

// Iniciar
init();
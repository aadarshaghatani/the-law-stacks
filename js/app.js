// js/app.js

let appCategories, appDocuments;

document.addEventListener('DOMContentLoaded', () => {
    loadCategoriesAndDocuments();
    setupMobileMenu();
    setupOutsideClickToCloseSidebar();
});

// ── Category mapping ──────────────────────────────────────
// Each document ID is assigned directly to a category name.
const categoryMapping = {
    // Core Human Rights
    "udhr":                                   "Core Human Rights",
    "iccpr":                                  "Core Human Rights",
    "icescr":                                 "Core Human Rights",
    "op-to-iccpr":                            "Core Human Rights",

    // Specialised Human Rights
    "cedaw":                                  "Specialised Human Rights",
    "crc":                                    "Specialised Human Rights",
    "crpd":                                   "Specialised Human Rights",
    "cat":                                    "Specialised Human Rights",
    "icerd":                                  "Specialised Human Rights",
    "cmw":                                    "Specialised Human Rights",
    "cped":                                   "Specialised Human Rights",

    // Regional Human Rights
    "echr":                                   "Regional Human Rights",
    "achr":                                   "Regional Human Rights",
    "african-charter":                        "Regional Human Rights",
    "asean-hr":                               "Regional Human Rights",

    // International Criminal Law
    "rome-statute":                           "International Criminal Law",

    // Refugee & Migration Law
    "convention-relating-to-status-of-refugees": "Refugee & Migration Law",
    "protocol-relating-to-status-of-refugee":    "Refugee & Migration Law",

    // Diplomatic & Consular Law
    "vcdr":                                   "Diplomatic & Consular Law",
    "vccr":                                   "Diplomatic & Consular Law",
    "convention-on-special-missions":         "Diplomatic & Consular Law",

    // Law of Treaties & Sources
    "vclt":                                   "Law of Treaties & Sources",
    "icj-statute":                            "Law of Treaties & Sources",

    // State Responsibility
    "intl-wrongul-acts":                      "State Responsibility",
    "resp-intl-orgn":                         "State Responsibility",
    "jurisdictional-immunity":                "State Responsibility",

    // International Economic Law
    "marrakesh-agreement":                    "International Economic Law",
    "icsid":                                  "International Economic Law",
    "permanent-sovereignty-over-resources":   "International Economic Law",

    // Environmental Law
    "unfccc":                                 "Environmental Law",
    "kyoto-protocol":                         "Environmental Law",
    "cbd":                                    "Environmental Law",
    "basel":                                  "Environmental Law",
    "rio-decl":                               "Environmental Law",

    // Regional Organisations
    "charter-of-oas":                         "Regional Organisations",
};

// The order categories appear in the sidebar
const categoryOrder = [
    "Core Human Rights",
    "Specialised Human Rights",
    "Regional Human Rights",
    "International Criminal Law",
    "Refugee & Migration Law",
    "Diplomatic & Consular Law",
    "Law of Treaties & Sources",
    "State Responsibility",
    "International Economic Law",
    "Environmental Law",
    "Regional Organisations",
];

// Documents to show under "Frequently Cited"
const popularIds = [
    "udhr", "iccpr", "icescr", "vclt", "rome-statute",
    "cat", "crc", "echr", "convention-relating-to-status-of-refugees", "icj-statute"
];

async function loadCategoriesAndDocuments() {
    try {
        const [categories, documents] = await Promise.all([
            fetch('data/categories.json').then(r => r.json()),
            fetch('data/documents.json').then(r => r.json())
        ]);
        appCategories = categories;
        appDocuments  = documents;
        renderSidebar(categories, documents);
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('sidebar-nav').innerHTML =
            '<p style="color:#8aa5bf;padding:1rem;font-style:italic;">Error loading categories. Please refresh.</p>';
    }
}

function renderSidebar(categories, documents) {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;

    let favorites = [];
    try {
        favorites = JSON.parse(localStorage.getItem('favorites')) || [];
    } catch (e) { /* ignore */ }

    // Group documents by category using direct ID mapping
    const grouped = {};
    categoryOrder.forEach(cat => { grouped[cat] = []; });

    documents.forEach(doc => {
        const cat = categoryMapping[doc.id] || 'Other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(doc);
    });

    // Sort documents within each category alphabetically by title
    Object.keys(grouped).forEach(cat => {
        grouped[cat].sort((a, b) => a.title.localeCompare(b.title));
    });

    let html = '';

    // My Favourites
    const favDocs = documents.filter(doc => favorites.includes(doc.id));
    if (favDocs.length > 0) {
        html += '<div class="category"><h3>My Favourites</h3><ul class="document-list">';
        favDocs.forEach(doc => {
            html += `<li><a href="#/document/${doc.id}" class="doc-link">${doc.title}</a></li>`;
        });
        html += '</ul></div>';
    }

    // Frequently Cited
    const popularDocs = popularIds
        .map(id => documents.find(d => d.id === id))
        .filter(Boolean);
    if (popularDocs.length > 0) {
        html += '<div class="category"><h3>Frequently Cited</h3><ul class="document-list">';
        popularDocs.forEach(doc => {
            html += `<li><a href="#/document/${doc.id}" class="doc-link">${doc.title}</a></li>`;
        });
        html += '</ul></div>';
    }

    // Subject categories in defined order
    categoryOrder.forEach(catName => {
        const docs = grouped[catName];
        if (!docs || !docs.length) return;
        html += `<div class="category"><h3>${catName}</h3><ul class="document-list">`;
        docs.forEach(doc => {
            html += `<li><a href="#/document/${doc.id}" class="doc-link">${doc.title}</a></li>`;
        });
        html += '</ul></div>';
    });

    nav.innerHTML = html;
}

function refreshSidebar() {
    if (appCategories && appDocuments) {
        renderSidebar(appCategories, appDocuments);
    }
}

window.refreshSidebar = refreshSidebar;

function setupMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar    = document.getElementById('sidebar');
    if (!menuToggle || !sidebar) return;

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    document.addEventListener('click', e => {
        if (e.target.closest('.doc-link') && window.innerWidth <= 768) {
            sidebar.classList.remove('open');
        }
    });
}

function setupOutsideClickToCloseSidebar() {
    const sidebar    = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');
    if (!sidebar || !menuToggle) return;

    document.addEventListener('click', e => {
        if (window.innerWidth > 768) return;
        if (
            sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            !menuToggle.contains(e.target)
        ) {
            sidebar.classList.remove('open');
        }
    });
}

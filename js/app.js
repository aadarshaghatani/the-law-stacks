// js/app.js

let appCategories, appDocuments;

document.addEventListener('DOMContentLoaded', () => {
    loadCategoriesAndDocuments();
    setupMobileMenu();
    setupOutsideClickToCloseSidebar();
});

const categoryMapping = {
    "Human Rights":                           "Human Rights",
    "Children's Rights":                      "Human Rights",
    "Women's Rights":                         "Human Rights",
    "Civil and Political Rights":             "Human Rights",
    "Economic, Social and Cultural Rights":   "Human Rights",
    "Prohibition of Torture":                 "Human Rights",
    "Non-Discrimination":                     "Human Rights",
    "Peoples' Rights":                        "Human Rights",
    "International Humanitarian Law":         "International Humanitarian Law",
    "International Criminal Law":             "International Criminal Law",
    "Law of Treaties":                        "Law of Treaties",
    "Diplomatic Law":                         "Diplomatic & Consular Law",
    "Consular Law":                           "Diplomatic & Consular Law",
    "Immunity":                               "Diplomatic & Consular Law",
    "State Immunity":                         "Diplomatic & Consular Law",
    "Law of the Sea":                         "Law of the Sea",
    "Environment":                            "Environmental Law",
    "Biodiversity":                           "Environmental Law",
    "Climate Change":                         "Environmental Law",
    "Natural Resources":                      "Environmental Law",
    "Trade":                                  "International Economic Law",
    "Investment Law":                         "International Economic Law",
    "International Economic Law":             "International Economic Law",
    "Sustainable Development":                "International Economic Law",
    "Dispute Resolution":                     "International Dispute Resolution",
    "International Courts":                   "International Dispute Resolution",
    "State Responsibility":                   "State Responsibility & Sovereignty",
    "Sovereignty":                            "State Responsibility & Sovereignty",
    "Jurisdiction":                           "State Responsibility & Sovereignty",
    "Responsibility":                         "State Responsibility & Sovereignty",
    "Non-Intervention":                       "State Responsibility & Sovereignty",
    "Foundations of International Law":       "Foundations & History",
    "History":                                "Foundations & History",
    "Regional Organization":                  "Regional Organizations",
    "Migration":                              "Migration & Refugees"
};

const popularIds = [
    "udhr", "iccpr", "icescr", "genocide", "refugee",
    "geneva", "vclt", "uncharter", "rome", "cat"
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

    // Group documents by mapped category
    const grouped = {};
    documents.forEach(doc => {
        let newCat = 'Other';
        if (Array.isArray(doc.subject)) {
            for (const subj of doc.subject) {
                if (categoryMapping[subj]) { newCat = categoryMapping[subj]; break; }
            }
        }
        if (!grouped[newCat]) grouped[newCat] = [];
        grouped[newCat].push(doc);
    });

    // Sort documents within each category by year descending
    Object.keys(grouped).forEach(cat => {
        grouped[cat].sort((a, b) => (b.year || 0) - (a.year || 0));
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
    const popularDocs = documents.filter(doc => popularIds.includes(doc.id));
    if (popularDocs.length > 0) {
        html += '<div class="category"><h3>Frequently Cited</h3><ul class="document-list">';
        popularDocs.forEach(doc => {
            html += `<li><a href="#/document/${doc.id}" class="doc-link">${doc.title}</a></li>`;
        });
        html += '</ul></div>';
    }

    // Subject categories (alphabetically)
    const sortedCategories = Object.keys(grouped).sort();
    sortedCategories.forEach(catName => {
        const docs = grouped[catName];
        if (!docs.length) return;
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

// Make refreshSidebar accessible from router.js
window.refreshSidebar = refreshSidebar;

function setupMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar    = document.getElementById('sidebar');
    if (!menuToggle || !sidebar) return;

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Close sidebar when a document link is clicked (mobile)
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
        if (window.innerWidth > 768) return; // desktop: sidebar is always present
        if (
            sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            !menuToggle.contains(e.target)
        ) {
            sidebar.classList.remove('open');
        }
    });
}

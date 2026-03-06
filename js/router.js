// js/router.js

window.addEventListener('hashchange', handleRoute);
window.addEventListener('DOMContentLoaded', handleRoute);

let currentDocId = null;

function handleRoute() {
    const hash    = window.location.hash.slice(1) || '/';
    const content = document.getElementById('content');

    if (hash === '/') {
        showHome(content);
    } else if (hash.startsWith('/document/')) {
        const docId = decodeURIComponent(hash.split('/')[2]);
        loadDocument(docId, content);
    } else {
        content.innerHTML = '<h2>404</h2><p>Page not found.</p>';
    }
}

function showHome(content) {
    content.innerHTML = `
    <div class="welcome-message">
        <h2>Welcome to The Law Stack</h2>
        <p>a small archive of international treaties, conventions, charters, and other documents.</p>
        <p>browse documents from the sidebar, or use the search bar to find a specific article or topic.</p>
        <p class="small-note">✦ all documents are available offline after your first visit.</p>
    </div>
`;
    if (window.ArticleNav) window.ArticleNav.setError('Open a document to see its table of contents.');
}

function isStructuralPart(number) {
    if (!number) return false;
    return /^(PART|SECTION|CHAPTER|TITLE)\s+[IVXLCDM0-9]+$/i.test(String(number).trim());
}

async function loadDocument(docId, content) {
    content.innerHTML = '<p class="loading">Loading document…</p>';
    currentDocId = docId;

    if (window.ArticleNav) window.ArticleNav.setLoading();

    try {
        const docsResponse = await fetch('data/documents.json');
        const documents    = await docsResponse.json();
        const docMeta      = documents.find(d => d.id === docId);
        if (!docMeta) throw new Error('Document not found');

        const response = await fetch(`data/articles/${docMeta.filename}`);
        if (!response.ok) throw new Error('Failed to load document');
        const data = await response.json();

        // --- Build document HTML ---
        let favorites = [];
        try { favorites = JSON.parse(localStorage.getItem('favorites')) || []; } catch(e) {}

        let html = `<div class="document-header">
            <h2>${docMeta.title}</h2>
            <span class="favorite-star" data-doc-id="${docMeta.id}">${favorites.includes(docMeta.id) ? '★' : '☆'}</span>
        </div>`;

        // Preamble
        if (data.content && data.content.preamble) {
            html += `<div class="preamble" id="preamble" data-article-id="preamble">
                <p>${data.content.preamble.replace(/\n/g, '<br>')}</p>
            </div>`;
        }

        // Articles
        if (data.content && Array.isArray(data.content.articles)) {
            data.content.articles.forEach((article, index) => {
                const safeNumber = String(article.number || '').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
                const articleId  = `article-${safeNumber || index}`;
                let   contentText = (article.text || '').replace(/\*/g, '');

                if (isStructuralPart(article.number)) {
                    html += `<h3 class="section-heading" id="${articleId}"
                        data-article-number="${article.number}">${article.number}</h3>`;
                } else {
                    let title = article.number ? `Article ${article.number}` : '';
                    if (article.heading) title += title ? `: ${article.heading}` : article.heading;

                    html += `<div class="article" id="${articleId}"
                        data-article-number="${article.number || index}">
                        <h3>${title}</h3>
                        <p>${contentText.replace(/\n/g, '<br>')}</p>
                    </div>`;
                }
            });
        }

        // Annexes
        if (data.content && Array.isArray(data.content.annexes)) {
            html += '<h3 class="section-heading">Annexes</h3>';
            data.content.annexes.forEach((annex, idx) => {
                html += `<div class="annex" id="annex-${idx}">
                    <h4>${annex.name || 'Annex'}</h4>
                    <p>${(annex.text || '').replace(/\n/g, '<br>')}</p>
                </div>`;
            });
        }

        content.innerHTML = html;

        // Favourite star handler
        const star = content.querySelector('.favorite-star');
        if (star) {
            star.addEventListener('click', e => {
                e.stopPropagation();
                const id = star.dataset.docId;
                let favs = [];
                try { favs = JSON.parse(localStorage.getItem('favorites')) || []; } catch(e2) {}
                if (favs.includes(id)) {
                    favs = favs.filter(f => f !== id);
                    star.textContent = '☆';
                } else {
                    favs.push(id);
                    star.textContent = '★';
                }
                localStorage.setItem('favorites', JSON.stringify(favs));
                if (typeof window.refreshSidebar === 'function') window.refreshSidebar();
            });
        }

        // Update article-nav sidebar
        if (window.ArticleNav) window.ArticleNav.update(data);

    } catch (error) {
        console.error('Error loading document:', error);
        content.innerHTML = '<h2>Error</h2><p>Could not load document. Please try again.</p>';
        if (window.ArticleNav) window.ArticleNav.setError('Could not load article list.');
    }
}

/**
 * js/article-nav.js
 *
 * Right-side article navigation sidebar.
 *
 * Public API (window.ArticleNav):
 *   update(docData)  — rebuild the sidebar from a loaded document object
 *   setLoading()     — show skeleton while document is fetching
 *   setError(msg)    — show an error message
 *   open() / close() — programmatic open/close
 */
(function () {
    'use strict';

    const sidebar  = document.getElementById('article-nav-sidebar');
    const toggle   = document.getElementById('article-nav-toggle');
    const closeBtn = document.getElementById('article-nav-close');
    const overlay  = document.getElementById('article-nav-overlay');
    const listEl   = document.getElementById('article-nav-list');

    if (!sidebar || !toggle || !listEl) {
        console.warn('[ArticleNav] Required DOM elements not found.');
        return;
    }

    let isOpen = false;
    let visibilityObserver = null;

    // ── Open / close ─────────────────────────────────────────────────────────
    function open() {
        isOpen = true;
        sidebar.classList.add('is-open');
        overlay.classList.add('is-visible');
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', 'Close article navigation');
        sidebar.setAttribute('aria-hidden', 'false');
        overlay.setAttribute('aria-hidden', 'false');
        closeBtn.focus();
    }

    function close() {
        isOpen = false;
        sidebar.classList.remove('is-open');
        overlay.classList.remove('is-visible');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open article navigation');
        sidebar.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('aria-hidden', 'true');
        toggle.focus();
    }

    // ── Skeleton loader ───────────────────────────────────────────────────────
    function setLoading() {
        listEl.innerHTML = `
            <div class="article-nav-skeleton" role="status" aria-label="Loading…">
                ${['sk-medium','sk-long','sk-short','sk-medium','sk-long','sk-medium','sk-short']
                    .map(c => `<div class="sk-line ${c}"></div>`).join('')}
            </div>`;
    }

    // ── Error state ───────────────────────────────────────────────────────────
    function setError(msg) {
        listEl.innerHTML = `<p class="article-nav-status" role="alert">${msg || 'Could not load article list.'}</p>`;
    }

    // ── Part heading heuristic ────────────────────────────────────────────────
    function isPartHeading(number) {
        return /^[A-Z\s]+$/i.test(String(number).trim());
    }

    // ── Scroll to article in main content ────────────────────────────────────
    function scrollToArticle(el) {
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ── Build sidebar from document data ─────────────────────────────────────
    function update(docData) {
        if (visibilityObserver) {
            visibilityObserver.disconnect();
            visibilityObserver = null;
        }

        listEl.innerHTML = '';

        if (!docData || !docData.content) {
            setError('No content available for this document.');
            return;
        }

        const { preamble, articles } = docData.content;
        const fragment = document.createDocumentFragment();

        // Preamble entry
        if (preamble) {
            const btn = makeNavButton({ articleId: 'preamble', number: '', heading: 'Preamble' });
            btn.addEventListener('click', () => {
                scrollToArticle(
                    document.querySelector('[data-article-id="preamble"], #preamble, .preamble')
                );
            });
            fragment.appendChild(btn);
        }

        // Articles
        if (!Array.isArray(articles) || articles.length === 0) {
            if (!preamble) {
                const msg = document.createElement('p');
                msg.className = 'article-nav-status';
                msg.textContent = 'No articles.';
                fragment.appendChild(msg);
            }
        } else {
            for (const article of articles) {
                const num = String(article.number || '').trim();

                if (isPartHeading(num)) {
                    const part = document.createElement('div');
                    part.className = 'article-nav-part';
                    part.setAttribute('role', 'separator');
                    part.textContent = num;
                    fragment.appendChild(part);
                } else {
                    const btn = makeNavButton({
                        articleId: `article-${num}`,
                        number:    num,
                        heading:   article.heading || '',
                    });
                    btn.addEventListener('click', () => {
                        const target =
                            document.querySelector(`[data-article-number="${CSS.escape(num)}"]`) ||
                            document.getElementById(`article-${num}`);
                        scrollToArticle(target);
                    });
                    fragment.appendChild(btn);
                }
            }
        }

        listEl.appendChild(fragment);
        setupVisibilityHighlight();
    }

    // ── Create a nav button element ───────────────────────────────────────────
    function makeNavButton({ articleId, number, heading }) {
        const btn = document.createElement('button');
        btn.className = 'article-nav-item';
        btn.setAttribute('role', 'listitem');
        btn.setAttribute('data-article-id', articleId);
        btn.setAttribute('type', 'button');

        const label = [number ? `Article ${number}` : '', heading].filter(Boolean).join(': ');
        btn.setAttribute('aria-label', label || articleId);

        if (number) {
            const numSpan = document.createElement('span');
            numSpan.className = 'article-nav-num';
            numSpan.textContent = number;
            btn.appendChild(numSpan);
        }

        const headSpan = document.createElement('span');
        headSpan.className = 'article-nav-heading';
        headSpan.textContent = heading || (number ? `Article ${number}` : '');
        btn.appendChild(headSpan);

        return btn;
    }

    // ── IntersectionObserver: highlight active article ────────────────────────
    function setupVisibilityHighlight() {
        const articleEls = document.querySelectorAll(
            '#content [data-article-number], #content [id^="article-"]'
        );
        if (!articleEls.length) return;

        const navItems = listEl.querySelectorAll('.article-nav-item');
        if (!navItems.length) return;

        const navMap = {};
        navItems.forEach(btn => {
            navMap[btn.getAttribute('data-article-id')] = btn;
        });

        visibilityObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const el  = entry.target;
                const num = el.getAttribute('data-article-number') ||
                            (el.id || '').replace('article-', '');
                const btn = navMap[`article-${num}`];
                if (!btn) return;

                navItems.forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
                btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            });
        }, { rootMargin: '-10% 0px -60% 0px', threshold: 0 });

        articleEls.forEach(el => visibilityObserver.observe(el));
    }

    // ── Event listeners ───────────────────────────────────────────────────────
    toggle.addEventListener('click', () => (isOpen ? close() : open()));
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', close);

    sidebar.addEventListener('keydown', e => {
        if (e.key === 'Escape') close();
    });

    // Basic tab trap
    sidebar.addEventListener('keydown', e => {
        if (!isOpen || e.key !== 'Tab') return;
        const focusable = Array.from(
            sidebar.querySelectorAll('button:not([disabled]), [tabindex="0"]')
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
        }
    });

    // Show skeleton on hash change (router will call update() after loading)
    window.addEventListener('hashchange', () => setLoading());

    // ── Public API ────────────────────────────────────────────────────────────
    window.ArticleNav = { update, setLoading, setError, open, close };

    // Initial skeleton if a document is already in the hash
    if (window.location.hash.startsWith('#/document/')) setLoading();

})();

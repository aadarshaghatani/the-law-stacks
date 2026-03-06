/**
 * js/search.js
 *
 * Real-time search for The Law Stack.
 * - Typing in the search bar shows a dropdown of quick results
 * - Clicking the Search button (or pressing Enter) shows full results in the main content area
 * - Clicking any result opens that document
 */

(() => {
    'use strict';

    // ── Configuration ─────────────────────────────────────────────────────────
    const DOCUMENTS_URL  = 'data/documents.json';
    const ARTICLES_BASE  = 'data/articles/';
    const DEBOUNCE_MS    = 300;
    const MIN_QUERY_LEN  = 3;
    const MAX_RESULTS    = 15;
    const SNIPPET_RADIUS = 100;

    const WEIGHT_HEADING = 3;
    const WEIGHT_DOC     = 2;
    const WEIGHT_BODY    = 1;

    // ── State ─────────────────────────────────────────────────────────────────
    let searchIndex = [];
    let indexReady  = false;
    let indexError  = false;

    // ── DOM refs ──────────────────────────────────────────────────────────────
    let inputEl, resultsEl;

    // ── Helpers ───────────────────────────────────────────────────────────────
    function countOccurrences(haystack, needle) {
        if (!needle) return 0;
        let count = 0, pos = 0;
        while ((pos = haystack.indexOf(needle, pos)) !== -1) { count++; pos += needle.length; }
        return count;
    }

    function extractSnippet(text, lowerText, lowerQuery) {
        const matchPos = lowerText.indexOf(lowerQuery);
        if (matchPos === -1) return text.slice(0, SNIPPET_RADIUS * 2);
        const start = Math.max(0, matchPos - SNIPPET_RADIUS);
        const end   = Math.min(text.length, matchPos + lowerQuery.length + SNIPPET_RADIUS);
        let snippet = text.slice(start, end);
        if (start > 0)         snippet = '…' + snippet;
        if (end < text.length) snippet = snippet + '…';
        return snippet;
    }

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function highlightText(snippet, query) {
        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        return snippet.split(regex).map(part =>
            regex.test(part) ? `<mark class="highlight">${part}</mark>` : part
        ).join('');
    }

    // ── Build index ───────────────────────────────────────────────────────────
    async function buildIndex() {
        try {
            const manifestRes = await fetch(DOCUMENTS_URL);
            if (!manifestRes.ok) throw new Error(`Failed to fetch ${DOCUMENTS_URL}`);
            const manifest = await manifestRes.json();

            const fetches = manifest.map(doc =>
                fetch(ARTICLES_BASE + doc.filename)
                    .then(res => {
                        if (!res.ok) throw new Error(`Failed: ${doc.filename}`);
                        return res.json();
                    })
                    .then(articleData => ({ doc, articleData }))
                    .catch(err => { console.warn('[search]', err.message); return null; })
            );

            const results = await Promise.all(fetches);

            for (const result of results) {
                if (!result) continue;
                const { doc, articleData } = result;
                const docTitle = articleData.title || doc.title || 'Untitled';
                const docId    = doc.id; // Always use doc.id from documents.json
                const content  = articleData.content || {};

                if (content.preamble) {
                    searchIndex.push({
                        docId, docTitle,
                        articleNumber:  'Preamble',
                        articleHeading: 'Preamble',
                        text:           content.preamble,
                        _lower:         content.preamble.toLowerCase(),
                        _docTitleLower: docTitle.toLowerCase(),
                        _headingLower:  'preamble',
                    });
                }

                if (Array.isArray(content.articles)) {
                    for (const article of content.articles) {
                        const heading = article.heading || '';
                        const text    = article.text    || '';
                        searchIndex.push({
                            docId, docTitle,
                            articleNumber:  String(article.number || ''),
                            articleHeading: heading,
                            text,
                            _lower:         text.toLowerCase(),
                            _docTitleLower: docTitle.toLowerCase(),
                            _headingLower:  heading.toLowerCase(),
                        });
                    }
                }
            }

            indexReady = true;
            console.info(`[search] Index ready — ${searchIndex.length} entries across ${manifest.length} documents.`);

        } catch (err) {
            indexError = true;
            console.error('[search] Failed to build index:', err);
        }
    }

    // ── Run a search query ────────────────────────────────────────────────────
    function runQuery(rawQuery) {
        const q = rawQuery.trim().toLowerCase();
        if (q.length < MIN_QUERY_LEN) return [];

        const scored = [];
        for (const entry of searchIndex) {
            const score =
                countOccurrences(entry._lower,         q) * WEIGHT_BODY    +
                countOccurrences(entry._headingLower,  q) * WEIGHT_HEADING +
                countOccurrences(entry._docTitleLower, q) * WEIGHT_DOC;
            if (score > 0) scored.push({ entry, score });
        }
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, MAX_RESULTS);
    }

    // ── DROPDOWN: quick results below the search bar ──────────────────────────
    function renderDropdown(rawQuery) {
        resultsEl.innerHTML = '';

        if (!indexReady && !indexError) {
            resultsEl.innerHTML = '<div class="result-status">Loading search index…</div>';
            showDropdown(); return;
        }
        if (indexError) {
            resultsEl.innerHTML = '<div class="result-status">Couldn\'t load search index. Please try again later.</div>';
            showDropdown(); return;
        }

        const trimmed = rawQuery.trim();
        if (trimmed.length < MIN_QUERY_LEN) { hideDropdown(); return; }

        const hits = runQuery(trimmed);
        if (hits.length === 0) {
            resultsEl.innerHTML = '<div class="result-status">No results found.</div>';
            showDropdown(); return;
        }

        const fragment = document.createDocumentFragment();
        for (const { entry } of hits) {
            const item = document.createElement('div');
            item.className = 'result-item';

            const titleEl = document.createElement('div');
            titleEl.className = 'result-doc-title';
            titleEl.textContent = entry.docTitle;

            const labelEl = document.createElement('div');
            labelEl.className = 'result-article-label';
            const labelParts = [];
            if (entry.articleNumber) labelParts.push(`Article ${entry.articleNumber}`);
            if (entry.articleHeading && entry.articleHeading !== entry.articleNumber) {
                labelParts.push(entry.articleHeading);
            }
            if (labelParts.length) labelEl.textContent = labelParts.join(' · ');

            const lowerQuery = trimmed.toLowerCase();
            const rawSnippet = extractSnippet(entry.text, entry._lower, lowerQuery);
            const snippetEl  = document.createElement('div');
            snippetEl.className = 'result-snippet';
            snippetEl.innerHTML = highlightText(rawSnippet, trimmed);

            item.appendChild(titleEl);
            if (labelParts.length) item.appendChild(labelEl);
            item.appendChild(snippetEl);

            item.addEventListener('click', () => {
                window.location.hash = '/document/' + encodeURIComponent(entry.docId);
                hideDropdown();
                inputEl.value = '';
            });

            item.setAttribute('role', 'option');
            item.setAttribute('tabindex', '0');
            item.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); }
            });

            fragment.appendChild(item);
        }

        resultsEl.appendChild(fragment);
        showDropdown();
    }

    // ── FULL PAGE: results inside the main content area ───────────────────────
    function renderFullResults(rawQuery) {
        const content = document.getElementById('content');
        if (!content) return;

        hideDropdown();

        if (!indexReady) {
            content.innerHTML = `
                <div class="welcome-message">
                    <p>Search index is still loading, please try again in a moment.</p>
                </div>`;
            return;
        }

        const trimmed = rawQuery.trim();
        const hits    = runQuery(trimmed);
        const q       = trimmed.toLowerCase();

        if (hits.length === 0) {
            content.innerHTML = `
                <div class="welcome-message">
                    <h2>No results for "${trimmed}"</h2>
                    <p>Try different keywords or browse the documents from the sidebar.</p>
                </div>`;
            return;
        }

        let html = `
            <div class="search-page-results">
                <h2 class="search-page-heading">Results for "<em>${trimmed}</em>"</h2>
                <p class="search-page-count">${hits.length} result${hits.length !== 1 ? 's' : ''} found</p>`;

        for (const { entry } of hits) {
            const rawSnippet  = extractSnippet(entry.text, entry._lower, q);
            const highlighted = highlightText(rawSnippet, trimmed);
            const articleLabel = entry.articleNumber
                ? `Article ${entry.articleNumber}${entry.articleHeading ? ': ' + entry.articleHeading : ''}`
                : entry.articleHeading || '';

            html += `
                <div class="search-page-item" data-doc-id="${entry.docId}">
                    <div class="search-page-doc-title">${entry.docTitle}</div>
                    ${articleLabel ? `<div class="search-page-article-label">${articleLabel}</div>` : ''}
                    <div class="search-page-snippet">${highlighted}</div>
                </div>`;
        }

        html += '</div>';
        content.innerHTML = html;

        // Each card opens its document when clicked
        content.querySelectorAll('.search-page-item').forEach(card => {
            card.addEventListener('click', () => {
                window.location.hash = '/document/' + encodeURIComponent(card.dataset.docId);
            });
        });
    }

    // ── Show / hide dropdown ──────────────────────────────────────────────────
    function showDropdown() {
        resultsEl.style.display = 'block';
        resultsEl.setAttribute('aria-expanded', 'true');
    }

    function hideDropdown() {
        resultsEl.style.display = 'none';
        resultsEl.setAttribute('aria-expanded', 'false');
    }

    // ── Debounce ──────────────────────────────────────────────────────────────
    function debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // ── Wire up all event listeners ───────────────────────────────────────────
    function attachListeners() {

        // Typing → dropdown (debounced)
        const onInput = debounce(() => renderDropdown(inputEl.value), DEBOUNCE_MS);
        inputEl.addEventListener('input', onInput);

        // Re-show dropdown when input is focused and already has text
        inputEl.addEventListener('focus', () => {
            if (inputEl.value.trim().length >= MIN_QUERY_LEN) renderDropdown(inputEl.value);
        });

        // Search button → full page results
        const searchBtn = document.getElementById('search-button');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const q = inputEl.value.trim();
                if (q.length < MIN_QUERY_LEN) return;
                renderFullResults(q);
            });
        }

        // Enter key → full page results
        inputEl.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                const q = inputEl.value.trim();
                if (q.length >= MIN_QUERY_LEN) renderFullResults(q);
                return;
            }
            if (e.key === 'Escape') { hideDropdown(); inputEl.blur(); return; }
            if (e.key === 'ArrowDown') {
                const first = resultsEl.querySelector('.result-item');
                if (first) first.focus();
            }
        });

        // Clicking outside hides dropdown
        document.addEventListener('click', e => {
            if (!inputEl.contains(e.target) && !resultsEl.contains(e.target)) hideDropdown();
        });

        // Arrow key navigation inside dropdown
        resultsEl.addEventListener('keydown', e => {
            const items = Array.from(resultsEl.querySelectorAll('.result-item'));
            const idx   = items.indexOf(document.activeElement);
            if (e.key === 'ArrowDown' && idx < items.length - 1) {
                items[idx + 1].focus();
            } else if (e.key === 'ArrowUp') {
                idx > 0 ? items[idx - 1].focus() : inputEl.focus();
            } else if (e.key === 'Escape') {
                hideDropdown(); inputEl.focus();
            }
        });
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    function init() {
        inputEl   = document.getElementById('search-input');
        resultsEl = document.getElementById('search-results');

        if (!inputEl || !resultsEl) {
            console.warn('[search] #search-input or #search-results not found.');
            return;
        }

        inputEl.setAttribute('role', 'combobox');
        inputEl.setAttribute('aria-autocomplete', 'list');
        inputEl.setAttribute('aria-controls', 'search-results');
        resultsEl.setAttribute('role', 'listbox');
        hideDropdown();

        attachListeners();
        buildIndex();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

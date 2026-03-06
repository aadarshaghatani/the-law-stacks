/**
 * js/search.js
 *
 * Real-time search for the International Law Library.
 * Builds an in-memory index from data/documents.json + data/articles/*.json,
 * then provides debounced, ranked, highlighted results in a dropdown.
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
        const start   = Math.max(0, matchPos - SNIPPET_RADIUS);
        const end     = Math.min(text.length, matchPos + lowerQuery.length + SNIPPET_RADIUS);
        let snippet   = text.slice(start, end);
        if (start > 0)          snippet = '…' + snippet;
        if (end < text.length)  snippet = snippet + '…';
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
                const docTitle = articleData.title  || doc.title || 'Untitled';
                const docId    = articleData.id      || doc.id;
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

    // ── Query ─────────────────────────────────────────────────────────────────
    function query(rawQuery) {
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

    // ── Render results ────────────────────────────────────────────────────────
    function renderResults(rawQuery) {
        resultsEl.innerHTML = '';

        if (!indexReady && !indexError) {
            resultsEl.innerHTML = '<div class="result-status">Loading search index…</div>';
            showResults(); return;
        }
        if (indexError) {
            resultsEl.innerHTML = '<div class="result-status">Couldn\'t load search index. Please try again later.</div>';
            showResults(); return;
        }

        const trimmed = rawQuery.trim();
        if (trimmed.length < MIN_QUERY_LEN) { hideResults(); return; }

        const hits = query(trimmed);
        if (hits.length === 0) {
            resultsEl.innerHTML = '<div class="result-status">No results found.</div>';
            showResults(); return;
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

            const lowerQuery  = trimmed.toLowerCase();
            const rawSnippet  = extractSnippet(entry.text, entry._lower, lowerQuery);
            const snippetEl   = document.createElement('div');
            snippetEl.className = 'result-snippet';
            snippetEl.innerHTML = highlightText(rawSnippet, trimmed);

            item.appendChild(titleEl);
            if (labelParts.length) item.appendChild(labelEl);
            item.appendChild(snippetEl);

            item.addEventListener('click', () => {
                window.location.hash = '/document/' + encodeURIComponent(entry.docId);
                hideResults();
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
        showResults();
    }

    // ── Show / hide ───────────────────────────────────────────────────────────
    function showResults() {
        resultsEl.style.display = 'block';
        resultsEl.setAttribute('aria-expanded', 'true');
    }

    function hideResults() {
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

    // ── Wire up listeners ─────────────────────────────────────────────────────
    function attachListeners() {
        const onInput = debounce(() => renderResults(inputEl.value), DEBOUNCE_MS);
        inputEl.addEventListener('input', onInput);

        inputEl.addEventListener('focus', () => {
            if (inputEl.value.trim().length >= MIN_QUERY_LEN) renderResults(inputEl.value);
        });

        document.addEventListener('click', e => {
            if (!inputEl.contains(e.target) && !resultsEl.contains(e.target)) hideResults();
        });

        inputEl.addEventListener('keydown', e => {
            if (e.key === 'Escape') { hideResults(); inputEl.blur(); }
            if (e.key === 'ArrowDown') {
                const first = resultsEl.querySelector('.result-item');
                if (first) first.focus();
            }
        });

        resultsEl.addEventListener('keydown', e => {
            const items = Array.from(resultsEl.querySelectorAll('.result-item'));
            const idx   = items.indexOf(document.activeElement);
            if (e.key === 'ArrowDown' && idx < items.length - 1) {
                items[idx + 1].focus();
            } else if (e.key === 'ArrowUp') {
                idx > 0 ? items[idx - 1].focus() : inputEl.focus();
            } else if (e.key === 'Escape') {
                hideResults(); inputEl.focus();
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
        hideResults();

        attachListeners();
        buildIndex();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

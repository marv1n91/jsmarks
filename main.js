let notes = [];
let currentEditId = null;
let currentModalMode = 'create';
let activeTab = 'notes';
let currentCreateType = 'note';
let currentSearchQuery = '';
let currentViewMode = 'grid';
let currentPinnedFilter = 'all';
let currentTagFilter = '';
let currentSortMode = 'updated_desc';
let draggedTaskRow = null;
let lastTagsToastTime = 0;

const MAX_TAGS_COUNT = 10;
const MAX_TAG_CHARACTERS = 15;
const DEFAULT_NOTE_COLOR = '#242424';
const SHARE_COLORS = ['#242424', '#ffffff', '#e6cf5e', '#1c5239', '#1d3f63', '#7a2f50'];
const COLOR_MIGRATION = {
    '#f8f32b': '#e6cf5e',
    '#173528': '#1c5239',
    '#182f3b': '#1d3f63',
    '#3b1d2d': '#7a2f50'
};

const modal = document.getElementById('editorModal');
const modalTitle = document.getElementById('modalTitle');
const titleInput = document.getElementById('noteTitleInput');
const bodyInput = document.getElementById('noteBodyInput');
const tagsInput = document.getElementById('noteTagsInput');
const colorSwatches = document.getElementById('colorSwatches');
const pinnedInput = document.getElementById('notePinnedInput');
const searchInput = document.getElementById('search');
const viewGridBtn = document.getElementById('viewGridBtn');
const viewListBtn = document.getElementById('viewListBtn');
const filterPinnedSelect = document.getElementById('filterPinnedSelect');
const filterTagInput = document.getElementById('filterTagInput');
const tagsList = document.getElementById('tagsList');
const sortSelect = document.getElementById('sortSelect');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const settingsModal = document.getElementById('settingsModal');
const themeSelect = document.getElementById('themeSelect');
const fontSelect = document.getElementById('fontSelect');
const importInput = document.getElementById('importInput');
const clearDataBtn = document.getElementById('clearDataBtn');
const settingsBtn = document.getElementById('settingsBtn');
const modalTaskItemsContainer = document.getElementById('modalTaskItems');

let selectedColorValue = DEFAULT_NOTE_COLOR;
let currentTheme = localStorage.getItem('notes_app_theme') || 'dark';
let currentFont = localStorage.getItem('notes_app_font') || 'Comfortaa';

function loadData() {
    const stored = localStorage.getItem('notes_app_data');
    notes = stored ? JSON.parse(stored).map(normalizeNote) : [];
    renderActiveTab();
}

function saveToLocal() {
    localStorage.setItem('notes_app_data', JSON.stringify(notes));
}

function normalizeNote(note) {
    const now = Date.now();
    const color = COLOR_MIGRATION[note.color] || note.color;
    return {
        id: note.id || now.toString(),
        title: note.title,
        content: note.content,
        type: note.type,
        color: color,
        tags: Array.isArray(note.tags) ? note.tags : [],
        items: normalizeTaskItems(note),
        pinned: Boolean(note.pinned),
        createdAt: note.createdAt,
        updatedAt: note.updatedAt || note.createdAt
    };
}

function normalizeTags(tagsText) {
    const seenTags = new Set();
    let wasTruncated = false;

    const allTags = tagsText
        .split(',')
        .map(tag => {
            let trimmed = tag.trim();
            if (trimmed.length > MAX_TAG_CHARACTERS) {
                trimmed = trimmed.substring(0, MAX_TAG_CHARACTERS);
                wasTruncated = true;
            }
            return trimmed;
        })
        .filter(Boolean)
        .filter(tag => {
            const tagKey = tag.toLowerCase();
            if (seenTags.has(tagKey)) return false;
            seenTags.add(tagKey);
            return true;
        });

    if (wasTruncated) {
        showToast(`Длина тега ограничена до ${MAX_TAG_CHARACTERS} символов`, 'info');
    }

    if (allTags.length > MAX_TAGS_COUNT) {
        showToast(`Максимальное количество тегов: ${MAX_TAGS_COUNT}`, 'info');
        return allTags.slice(0, MAX_TAGS_COUNT);
    }

    return allTags;
}

function normalizeTaskItems(note) {
    if(Array.isArray(note.items)) {
        return note.items
            .map(item => ({
                text: String(item.text || '').trim(),
                done: Boolean(item.done)
            }))
            .filter(item => item.text);
    }

    return String(note.content || '')
        .split('\n')
        .map(text => ({ text: text.trim(), done: false }))
        .filter(item => item.text);
}

function setSelectedColor(color) {
    selectedColorValue = color;
    if(!colorSwatches) return;
    colorSwatches.querySelectorAll('.color-swatch').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === color);
    });
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
    if(themeSelect) themeSelect.value = theme;
}

function applyFont(font) {
    if (font === 'Nunito') {
        document.documentElement.style.setProperty('--main-font', "'Nunito', sans-serif");
    } else if (font === 'Roboto') {
        document.documentElement.style.setProperty('--main-font', "'Roboto', sans-serif");
    } else {
        document.documentElement.style.setProperty('--main-font', "'Comfortaa', cursive, sans-serif");
    }
    if (fontSelect) fontSelect.value = font;
}

function getSortedItems() {
    return [...notes].sort((a, b) => {
        if(Boolean(a.pinned) !== Boolean(b.pinned)) {
            return Number(b.pinned) - Number(a.pinned);
        }
        if(currentSortMode === 'created_desc') {
            return (b.createdAt || 0) - (a.createdAt || 0);
        }
        if(currentSortMode === 'title_asc') {
            return (a.title || '').localeCompare(b.title || '', 'ru', { sensitivity: 'base' });
        }
        return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
    });
}

function passPinnedFilter(note) {
    if(currentPinnedFilter === 'all') return true;
    if(currentPinnedFilter === 'pinned') return Boolean(note.pinned);
    return !note.pinned;
}

function passTagFilter(note) {
    const query = currentTagFilter.trim().toLowerCase();
    if(!query) return true;
    return note.tags.some(tag => tag.toLowerCase().includes(query));
}

function getVisibleItemsForTab(tabType) {
    const itemsByTab = getSortedItems().filter(note => tabType === 'notes' ? note.type !== 'task' : note.type === 'task');

    return itemsByTab.filter(note => {
        return passPinnedFilter(note)
            && passTagFilter(note)
            && (!currentSearchQuery.trim() || filterBySearch(note, currentSearchQuery));
    });
}

function filterBySearch(note, query) {
    if (!query.trim()) return true;

    const lowerQuery = query.toLowerCase();
    const titleMatch = note.title.toLowerCase().includes(lowerQuery);
    const contentMatch = note.content.toLowerCase().includes(lowerQuery);
    const tagsMatch = note.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
    const itemsMatch = note.type === 'task' && note.items.some(item => item.text.toLowerCase().includes(lowerQuery));

    return titleMatch || contentMatch || tagsMatch || itemsMatch;
}

function updateViewClass(container) {
    if(!container) return;
    container.classList.toggle('notes-list', currentViewMode === 'list');
    container.classList.toggle('notes-grid-columns', currentViewMode !== 'list');
}

function updateTagsDatalist() {
    if(!tagsList) return;
    const allTags = Array.from(new Set(
        notes.flatMap(note => note.tags.map(tag => tag.trim())).filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base' }));
    tagsList.innerHTML = allTags.map(tag => `<option value="${escapeHtml(tag)}"></option>`).join('');
}

function resetFilters() {
    currentSearchQuery = '';
    currentPinnedFilter = 'all';
    currentTagFilter = '';
    currentSortMode = 'updated_desc';

    if(searchInput) searchInput.value = '';
    if(filterPinnedSelect) filterPinnedSelect.value = 'all';
    if(filterTagInput) filterTagInput.value = '';
    if(sortSelect) sortSelect.value = 'updated_desc';

    renderActiveTab();
}

function renderActiveTab() {
    if(activeTab === 'notes') {
        renderNotes();
    } else {
        renderTasks();
    }
}

function renderNotes() {
    const container = document.getElementById('notesContainer');
    if(!container || !searchInput) return;

    updateViewClass(container);
    const visibleNotes = getVisibleItemsForTab('notes');
    const emptyMessage = currentSearchQuery.trim() ? 'Ничего не найдено' : 'Пока нет заметок';
    searchInput.placeholder = 'Поиск заметок';

    if (currentViewMode === 'list') {
        container.innerHTML = visibleNotes.map(renderNoteCard).join('') || `<p class="empty-state">${emptyMessage}</p>`;
    } else {
        const colsCount = window.innerWidth > 1200 ? 4 : (window.innerWidth > 900 ? 3 : (window.innerWidth > 600 ? 2 : 1));
        const colSizes = Array(colsCount).fill(Math.floor(visibleNotes.length / colsCount));
        const remainder = visibleNotes.length % colsCount;
        for (let i = 0; i < remainder; i++) {
            colSizes[i]++;
        }

        let noteIndex = 0;
        let colsHtml = [];
        for (let col = 0; col < colsCount; col++) {
            let colHtml = '<div class="notes-column">';
            const size = colSizes[col];
            for (let j = 0; j < size; j++) {
                colHtml += renderNoteCard(visibleNotes[noteIndex++]);
            }
            colHtml += '</div>';
            colsHtml.push(colHtml);
        }

        container.innerHTML = colsHtml.join('') || `<p class="empty-state">${emptyMessage}</p>`;
    }
    attachCardEvents();
}

function renderTasks() {
    const container = document.getElementById('tasksContainer');
    if(!container || !searchInput) return;

    updateViewClass(container);
    const visibleTasks = getVisibleItemsForTab('tasks');
    const emptyMessage = currentSearchQuery.trim() ? 'Ничего не найдено' : 'Пока нет списков';
    searchInput.placeholder = 'Поиск списков';

    if (currentViewMode === 'list') {
        container.innerHTML = visibleTasks.map(renderNoteCard).join('') || `<p class="empty-state">${emptyMessage}</p>`;
    } else {
        const colsCount = window.innerWidth > 1200 ? 4 : (window.innerWidth > 900 ? 3 : (window.innerWidth > 600 ? 2 : 1));
        const colSizes = Array(colsCount).fill(Math.floor(visibleTasks.length / colsCount));
        const remainder = visibleTasks.length % colsCount;
        for (let i = 0; i < remainder; i++) {
            colSizes[i]++;
        }

        let noteIndex = 0;
        let colsHtml = [];
        for (let col = 0; col < colsCount; col++) {
            let colHtml = '<div class="notes-column">';
            const size = colSizes[col];
            for (let j = 0; j < size; j++) {
                colHtml += renderNoteCard(visibleTasks[noteIndex++]);
            }
            colHtml += '</div>';
            colsHtml.push(colHtml);
        }

        container.innerHTML = colsHtml.join('') || `<p class="empty-state">${emptyMessage}</p>`;
    }
    attachCardEvents();
}

function renderNoteCard(note) {
    const bgColor = note.color || DEFAULT_NOTE_COLOR;
    const isLight = bgColor.toLowerCase() === '#ffffff' || bgColor.toLowerCase() === '#e6cf5e';
    const bodyHtml = note.type === 'task' ? renderTaskList(note) : renderNoteText(note.content);
    const tagsHtml = note.tags.length
        ? `<div class="tags">${note.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}</div>`
        : '';

    return `
      <div class="note-card ${isLight ? 'light-card' : ''}" data-id="${note.id}" data-type="${note.type}" style="background: ${bgColor};">
        <button class="pin-note ${note.pinned ? 'pinned' : ''}" data-id="${note.id}" title="Закрепить" aria-label="Закрепить"></button>
        <div class="note-title" lang="ru">${escapeHtml(note.title)}</div>
        <div class="content-wrapper">${bodyHtml}</div>
        ${tagsHtml}
        <div class="note-footer">
          <span class="note-date">${formatDate(note.updatedAt)}</span>
          <span class="card-actions">
            <button class="share-note" data-id="${note.id}" title="Поделиться" aria-label="Поделиться">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
            </button>
          </span>
        </div>
      </div>
    `;
}

function renderNoteText(content) {
    return `<div class="note-preview" lang="ru">${escapeHtml(content)}</div>`;
}

function renderTaskList(note) {
    if(!note.items.length) {
        return '<div class="note-preview empty-task-text">Нет пунктов</div>';
    }

    return `
      <ul class="task-list">
        ${note.items.map((item, index) => `
          <li class="task-item ${item.done ? 'completed-task' : ''}">
            <input type="checkbox" class="task-checkbox" data-id="${note.id}" data-index="${index}" ${item.done ? 'checked' : ''}>
            <span>${escapeHtml(item.text)}</span>
          </li>
        `).join('')}
      </ul>
    `;
}

function renderModalTasks(items) {
    const container = document.getElementById('modalTaskItems');
    container.innerHTML = '';
    items.forEach(item => addModalTaskRow(item.text, null, item.done, false));
}

function addModalTaskRow(text = '', afterElement = null, done = false, focus = true) {
    const container = document.getElementById('modalTaskItems');
    const row = document.createElement('div');
    row.className = `modal-task-item ${done ? 'done' : ''}`;
    row.draggable = true;

    row.innerHTML = `
        <div class="drag-handle" title="Перетащить">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/></svg>
        </div>
        <input type="checkbox" class="modal-task-check" ${done ? 'checked' : ''}>
        <input type="text" class="modal-task-text" value="${escapeHtml(text)}" placeholder="Пункт списка">
        <button type="button" class="modal-task-delete" title="Удалить">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
    `;

    row.addEventListener('dragstart', function(e) {
        draggedTaskRow = this;
        e.dataTransfer.effectAllowed = 'move';
        this.style.opacity = '0.4';
    });
    row.addEventListener('dragover', e => e.preventDefault());
    row.addEventListener('drop', function(e) {
        e.stopPropagation();
        if (draggedTaskRow !== this) {
            const allRows = Array.from(container.querySelectorAll('.modal-task-item'));
            if (allRows.indexOf(draggedTaskRow) < allRows.indexOf(this)) {
                this.after(draggedTaskRow);
            } else {
                this.before(draggedTaskRow);
            }
        }
        return false;
    });
    row.addEventListener('dragend', function() {
        this.style.opacity = '1';
        draggedTaskRow = null;
    });

    if (afterElement && afterElement.nextSibling) {
        container.insertBefore(row, afterElement.nextSibling);
    } else {
        container.appendChild(row);
    }

    if (focus) row.querySelector('.modal-task-text').focus();
}

function openModalForCreate(forceType = 'note') {
    currentEditId = null;
    currentModalMode = 'create';
    currentCreateType = forceType;
    modalTitle.innerText = forceType === 'task' ? 'Новый список' : 'Новая заметка';
    titleInput.value = '';
    tagsInput.value = '';
    setSelectedColor(DEFAULT_NOTE_COLOR);
    pinnedInput.checked = false;

    document.getElementById('modalDelete').style.display = 'none';

    if (forceType === 'task') {
        document.getElementById('noteBodyInput').style.display = 'none';
        document.getElementById('modalTaskList').style.display = 'block';
        renderModalTasks([]);
        addModalTaskRow('');
    } else {
        document.getElementById('noteBodyInput').style.display = 'block';
        document.getElementById('modalTaskList').style.display = 'none';
        document.getElementById('noteBodyInput').value = '';
    }

    modal.style.display = 'flex';
    titleInput.focus();
}

function openModalForEdit(note) {
    currentEditId = note.id;
    currentModalMode = 'edit';
    currentCreateType = note.type || 'note';
    modalTitle.innerText = note.type === 'task' ? 'Редактировать список' : 'Редактировать заметку';
    titleInput.value = note.title || '';
    tagsInput.value = (note.tags || []).join(', ');
    setSelectedColor(note.color || DEFAULT_NOTE_COLOR);
    pinnedInput.checked = Boolean(note.pinned);

    document.getElementById('modalDelete').style.display = 'inline-block';

    if (currentCreateType === 'task') {
        document.getElementById('noteBodyInput').style.display = 'none';
        document.getElementById('modalTaskList').style.display = 'block';
        renderModalTasks(note.items || []);
    } else {
        document.getElementById('noteBodyInput').style.display = 'block';
        document.getElementById('modalTaskList').style.display = 'none';
        document.getElementById('noteBodyInput').value = note.content || '';
    }

    modal.style.display = 'flex';
    titleInput.focus();
}

function closeModal() {
    modal.style.display = 'none';
    currentEditId = null;
}

function saveFromModal() {
    const titleTrim = titleInput.value.trim();
    let newItems = [];
    let newContent = '';

    if (currentCreateType === 'task') {
        const rows = document.getElementById('modalTaskItems').querySelectorAll('.modal-task-item');
        rows.forEach(row => {
            const text = row.querySelector('.modal-task-text').value.trim();
            const done = row.querySelector('.modal-task-check').checked;
            if(text) {
                newItems.push({ text, done });
            }
        });

        if(newItems.length === 0) {
            showToast('Добавьте хотя бы один пункт в список', 'error');
            return;
        }
    } else {
        newContent = document.getElementById('noteBodyInput').value.trim();
        if(!titleTrim && !newContent) {
            showToast('Заполните заголовок или содержание заметки', 'error');
            return;
        }
    }

    const newTitle = titleTrim || 'Без названия';
    const newTags = normalizeTags(tagsInput.value);
    const selectedColor = selectedColorValue;
    const isPinned = pinnedInput.checked;

    if(currentModalMode === 'create') {
        const now = Date.now();
        notes.unshift({
            id: now.toString() + Math.random().toString(36).substring(2, 6),
            title: newTitle,
            content: newContent,
            type: currentCreateType,
            items: newItems,
            color: selectedColor,
            tags: newTags,
            pinned: isPinned,
            createdAt: now,
            updatedAt: now
        });
    } else if(currentEditId) {
        const idx = notes.findIndex(n => n.id === currentEditId);
        if(idx !== -1) {
            notes[idx] = {
                ...notes[idx],
                title: newTitle,
                content: newContent,
                items: newItems,
                color: selectedColor,
                tags: newTags,
                pinned: isPinned,
                updatedAt: Date.now()
            };
        }
    }

    saveToLocal();
    updateTagsDatalist();
    closeModal();
    renderActiveTab();
}

function switchTab(tabId) {
    activeTab = tabId;
    const notesPane = document.getElementById('notes-pane');
    const tasksPane = document.getElementById('tasks-pane');
    const btnNotes = document.querySelector('.tab-btn[data-tab="notes"]');
    const btnTasks = document.querySelector('.tab-btn[data-tab="tasks"]');

    if(tabId === 'notes') {
        notesPane.classList.add('active-pane');
        tasksPane.classList.remove('active-pane');
        btnNotes.classList.add('active');
        btnTasks.classList.remove('active');
    } else {
        notesPane.classList.remove('active-pane');
        tasksPane.classList.add('active-pane');
        btnNotes.classList.remove('active');
        btnTasks.classList.add('active');
    }

    renderActiveTab();
}

function setViewMode(mode) {
    currentViewMode = mode === 'list' ? 'list' : 'grid';
    if(viewGridBtn) viewGridBtn.classList.toggle('active', currentViewMode === 'grid');
    if(viewListBtn) viewListBtn.classList.toggle('active', currentViewMode === 'list');
    renderActiveTab();
}

function attachCardEvents() {
    document.querySelectorAll('.edit-note').forEach(el => {
        el.removeEventListener('click', handleEdit);
        el.addEventListener('click', handleEdit);
    });
    document.querySelectorAll('.delete-note').forEach(el => {
        el.removeEventListener('click', handleDelete);
        el.addEventListener('click', handleDelete);
    });
    document.querySelectorAll('.pin-note').forEach(el => {
        el.removeEventListener('click', handlePin);
        el.addEventListener('click', handlePin);
    });
    document.querySelectorAll('.task-checkbox').forEach(el => {
        el.removeEventListener('change', handleTaskCheck);
        el.addEventListener('change', handleTaskCheck);
    });
    document.querySelectorAll('.task-item').forEach(el => {
        el.removeEventListener('click', handleTaskItemClick);
        el.addEventListener('click', handleTaskItemClick);
    });
    document.querySelectorAll('.share-note').forEach(el => {
        el.removeEventListener('click', handleShare);
        el.addEventListener('click', handleShare);
    });
    document.querySelectorAll('.note-card').forEach(el => {
        el.removeEventListener('click', handleCardClick);
        el.addEventListener('click', handleCardClick);
    });
}

function handleCardClick(e) {
    if (e.target.closest('.pin-note') ||
        e.target.closest('.edit-note') ||
        e.target.closest('.delete-note') ||
        e.target.closest('.share-note') ||
        e.target.closest('.task-checkbox')) {
        return;
    }
    const card = e.currentTarget;
    const id = card.getAttribute('data-id');
    const note = notes.find(n => n.id === id);
    if (note) openModalForEdit(note);
}

function handleEdit(e) {
    e.stopPropagation();
    const id = e.currentTarget.getAttribute('data-id');
    const note = notes.find(n => n.id === id);
    if(note) openModalForEdit(note);
}

async function handleDelete(e) {
    e.stopPropagation();
    const id = e.currentTarget.getAttribute('data-id');
    await deleteNoteById(id);
}

async function deleteNoteById(id) {
    if (await showConfirm('Удалить заметку?')) {
        notes = notes.filter(n => n.id !== id);
        saveToLocal();
        updateTagsDatalist();
        renderActiveTab();
        return true;
    }
    return false;
}

function handlePin(e) {
    e.stopPropagation();
    const id = e.currentTarget.getAttribute('data-id');
    const note = notes.find(n => n.id === id);
    if(note) {
        note.pinned = !note.pinned;
        saveToLocal();
        renderActiveTab();
    }
}

function handleTaskCheck(e) {
    e.stopPropagation();
    const id = e.currentTarget.getAttribute('data-id');
    const index = Number(e.currentTarget.getAttribute('data-index'));
    setTaskDone(id, index, e.currentTarget.checked);
}

function setTaskDone(id, index, done) {
    const note = notes.find(n => n.id === id);
    if(note && note.items[index]) {
        note.items[index].done = done;
        saveToLocal();
        renderActiveTab();
    }
}

function handleTaskItemClick(e) {
    if(e.target.classList.contains('task-checkbox')) return;
    const checkbox = e.currentTarget.querySelector('.task-checkbox');
    const id = checkbox.getAttribute('data-id');
    const note = notes.find(n => n.id === id);
    if (note) {
        openModalForEdit(note);
    }
}

function handleShare(e) {
    e.stopPropagation();
    const id = e.currentTarget.getAttribute('data-id');
    const note = notes.find(n => n.id === id);
    if (note) showShareDialog(generateLink(note));
}

function generateLink(note) {
    const payload = { t: note.title };

    if (note.type === 'task') {
        payload.y = 1;
        payload.i = note.items.map(it => it.done ? [it.text, 1] : [it.text]);
    } else if (note.content) {
        payload.c = note.content;
    }

    const colorIndex = SHARE_COLORS.indexOf(note.color);
    if (note.color && colorIndex !== 0) {
        payload.k = colorIndex >= 0 ? colorIndex : note.color;
    }
    if (note.tags && note.tags.length) {
        payload.g = note.tags;
    }

    const encoded = bytesToBase64Url(JSON.stringify(payload));
    return `${window.location.origin}${window.location.pathname}#s=${encoded}`;
}

function bytesToBase64Url(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToStr(b64) {
    const binary = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

function expandSharedPayload(p) {
    const isTask = p.y === 1;
    let color;
    if (p.k === undefined) color = SHARE_COLORS[0];
    else if (typeof p.k === 'number') color = SHARE_COLORS[p.k] || SHARE_COLORS[0];
    else color = p.k;

    return {
        title: p.t || '',
        content: p.c || '',
        type: isTask ? 'task' : 'note',
        color,
        tags: Array.isArray(p.g) ? p.g : [],
        items: isTask && Array.isArray(p.i) ? p.i.map(it => ({ text: it[0] || '', done: it[1] === 1 })) : [],
        sharedAt: Date.now()
    };
}

function showSharedNote(sharedNote) {
    const isLight = sharedNote.color.toLowerCase() === '#ffffff' || sharedNote.color.toLowerCase() === '#e6cf5e';

    const modalHtml = `
        <div class="background-shared-note-card" id="sharedNoteModal">
            <div class="shared-note-card ${isLight ? 'light-card' : ''}" style="background: ${escapeHtml(sharedNote.color)};">
                <h2 class="shared-note-title">${escapeHtml(sharedNote.title)}</h2>
                <button class="close-note" id="closeSharedModal">✕</button>
                ${sharedNote.type === 'task' ? renderSharedTaskList(sharedNote, isLight) :
                `<div class="shared-note-content">${escapeHtml(sharedNote.content)}</div>`}
                ${sharedNote.tags?.length ? `
                <div class="tags" style="margin-top: 16px;">
                    ${sharedNote.tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}
                </div>` : ''}
                <div class="inscription-note">${new Date(sharedNote.sharedAt).toLocaleString()}</div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const closeModalBtn = document.getElementById('closeSharedModal');
    const modalRoot = document.getElementById('sharedNoteModal');
    if (closeModalBtn) closeModalBtn.onclick = () => modalRoot.remove();
    if (modalRoot) modalRoot.onclick = (e) => { if (e.target === modalRoot) modalRoot.remove(); };
    window.location.hash = '';
}

function renderSharedTaskList(note, isLight) {
    if (!note.items?.length) return '<div>Нет пунктов</div>';

    return `
      <ul class="task-list" style="padding: 0;">
        ${note.items.map(item => `
          <li class="task-item ${item.done ? 'completed-task' : ''}">
            <input type="checkbox" ${item.done ? 'checked' : ''} disabled style="accent-color: #ffc700;">
            <span>${escapeHtml(item.text)}</span>
          </li>
        `).join('')}
      </ul>
    `;
}

function checkForSharedNote() {
    const hash = window.location.hash;
    try {
        if (hash.includes('#s=')) {
            const encoded = hash.split('#s=')[1];
            const payload = JSON.parse(base64UrlToStr(encoded));
            showSharedNote(expandSharedPayload(payload));
        } else if (hash.includes('#shared=')) {
            const encoded = hash.split('#shared=')[1];
            const sharedNote = JSON.parse(decodeURIComponent(atob(encoded)));
            showSharedNote(sharedNote);
        }
    } catch (err) { console.error('Ошибка открытия заметки', err); }
}

function escapeHtml(str) {
    if(!str) return '';
    return String(str).replace(/[&<>"]/g, function(m) {
        if(m === '&') return '&amp;';
        if(m === '<') return '&lt;';
        if(m === '>') return '&gt;';
        if(m === '"') return '&quot;';
        return m;
    });
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if(!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 2600);
}

function showConfirm(message, { okText = 'Удалить', cancelText = 'Отмена', danger = true } = {}) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
            <div class="confirm-card">
                <p class="confirm-text">${escapeHtml(message)}</p>
                <div class="confirm-buttons">
                    <button class="secondary confirm-cancel">${escapeHtml(cancelText)}</button>
                    <button class="${danger ? 'danger' : 'primary'} confirm-ok">${escapeHtml(okText)}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const cleanup = result => { overlay.remove(); resolve(result); };
        overlay.querySelector('.confirm-ok').onclick = () => cleanup(true);
        overlay.querySelector('.confirm-cancel').onclick = () => cleanup(false);
        overlay.onclick = e => { if(e.target === overlay) cleanup(false); };
    });
}

function showShareDialog(link) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
        <div class="confirm-card share-card">
            <h3 class="share-title">Ссылка на заметку</h3>
            <textarea class="share-link" readonly rows="3"></textarea>
            <div class="confirm-buttons">
                <button class="secondary share-close">Закрыть</button>
                <button class="primary share-copy">Копировать</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const field = overlay.querySelector('.share-link');
    field.value = link;
    field.focus();
    field.select();
    const close = () => overlay.remove();
    overlay.querySelector('.share-close').onclick = close;
    overlay.onclick = e => { if(e.target === overlay) close(); };
    overlay.querySelector('.share-copy').onclick = async () => {
        try {
            await navigator.clipboard.writeText(link);
        } catch {
            field.select();
            document.execCommand('copy');
        }
        showToast('Ссылка скопирована', 'success');
    };
}

function showTagsToast(msg) {
    const now = Date.now();
    if (now - lastTagsToastTime > 3000) {
        showToast(msg, 'info');
        lastTagsToastTime = now;
    }
}

colorSwatches.addEventListener('click', e => {
    const btn = e.target.closest('.color-swatch');
    if(btn) setSelectedColor(btn.dataset.color);
});

document.querySelector('.modal-task-add').addEventListener('mousedown', (e) => {
    e.preventDefault();
    addModalTaskRow('');
});

document.getElementById('modalTaskAddInput').addEventListener('focus', (e) => {
    addModalTaskRow('');
    e.target.value = '';
    e.target.blur();
});

modalTaskItemsContainer.addEventListener('click', (e) => {
    if (e.target.closest('.modal-task-delete')) {
        e.target.closest('.modal-task-item').remove();
    }
});

modalTaskItemsContainer.addEventListener('change', (e) => {
    if (e.target.classList.contains('modal-task-check')) {
        const row = e.target.closest('.modal-task-item');
        row.classList.toggle('done', e.target.checked);
    }
});

modalTaskItemsContainer.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('modal-task-text')) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addModalTaskRow('', e.target.closest('.modal-task-item'));
        } else if (e.key === 'Backspace' && e.target.value === '') {
            e.preventDefault();
            const row = e.target.closest('.modal-task-item');
            const prev = row.previousElementSibling;
            if (prev) {
                const prevInput = prev.querySelector('.modal-task-text');
                prevInput.focus();
                prevInput.selectionStart = prevInput.selectionEnd = prevInput.value.length;
            } else {
                document.getElementById('modalTaskAddInput').focus();
            }
            row.remove();
        }
    }
});

searchInput.addEventListener('input', function(e) {
    currentSearchQuery = e.target.value;
    renderActiveTab();
});

searchInput.addEventListener('blur', function(e) {
    const trimmedValue = e.target.value.trim();
    if (e.target.value !== trimmedValue) {
        e.target.value = trimmedValue;
        currentSearchQuery = trimmedValue;
        renderActiveTab();
    }
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        switchTab(e.currentTarget.getAttribute('data-tab'));
    });
});

document.getElementById('createNoteBtn').addEventListener('click', () => openModalForCreate('note'));
document.getElementById('createTaskBtn').addEventListener('click', () => openModalForCreate('task'));
document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('modalSave').addEventListener('click', saveFromModal);

if(viewGridBtn) viewGridBtn.addEventListener('click', () => setViewMode('grid'));
if(viewListBtn) viewListBtn.addEventListener('click', () => setViewMode('list'));

filterPinnedSelect.addEventListener('change', (e) => {
    currentPinnedFilter = e.target.value;
    renderActiveTab();
});

filterTagInput.addEventListener('input', (e) => {
    currentTagFilter = e.target.value;
    renderActiveTab();
});

sortSelect.addEventListener('change', (e) => {
    currentSortMode = e.target.value;
    renderActiveTab();
});

resetFiltersBtn.addEventListener('click', resetFilters);

window.addEventListener('click', (e) => {
    if(e.target === modal) closeModal();
});

if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'flex';
    });
}

document.getElementById('closeSettingsBtn').addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.style.display = 'none';
    }
});

themeSelect.addEventListener('change', (e) => {
    currentTheme = e.target.value;
    localStorage.setItem('notes_app_theme', currentTheme);
    applyTheme(currentTheme);
    renderActiveTab();
});

if (fontSelect) {
    fontSelect.addEventListener('change', (e) => {
        currentFont = e.target.value;
        localStorage.setItem('notes_app_font', currentFont);
        applyFont(currentFont);
    });
}

if (clearDataBtn) {
    clearDataBtn.addEventListener('click', async () => {
        if (!await showConfirm('Удалить все заметки и списки без возможности восстановления?')) return;
        notes = [];
        saveToLocal();
        updateTagsDatalist();
        renderActiveTab();
        settingsModal.style.display = 'none';
    });
}

document.getElementById('exportBtn').addEventListener('click', () => {
    const dataStr = JSON.stringify(notes, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const parsed = JSON.parse(event.target.result);
            if (Array.isArray(parsed)) {
                notes = parsed.map(normalizeNote);
                saveToLocal();
                updateTagsDatalist();
                renderActiveTab();
                showToast('Данные успешно восстановлены', 'success');
                settingsModal.style.display = 'none';
            } else {
                showToast('Неверный формат файла', 'error');
            }
        } catch (err) {
            showToast('Ошибка чтения файла. Убедитесь, что это правильный JSON', 'error');
        }
        e.target.value = '';
    };
    reader.readAsText(file);
});

document.getElementById('modalDelete').addEventListener('click', async () => {
    if (currentEditId) {
        const isDeleted = await deleteNoteById(currentEditId);
        if (isDeleted) {
            closeModal();
        }
    }
});

if (tagsInput) {
    tagsInput.addEventListener('input', (e) => {
        const cursorPosition = e.target.selectionStart;
        const originalValue = e.target.value;

        let parts = originalValue.split(',');
        let changed = false;

        if (parts.length > MAX_TAGS_COUNT) {
            parts = parts.slice(0, MAX_TAGS_COUNT);
            changed = true;
            showTagsToast(`Максимальное количество тегов — ${MAX_TAGS_COUNT}`);
        }

        parts = parts.map(part => {
            const trimmed = part.trim();
            if (trimmed.length > MAX_TAG_CHARACTERS) {
                changed = true;
                showTagsToast(`Длина одного тега ограничена ${MAX_TAG_CHARACTERS} символами`);
                const leadingSpaces = part.match(/^\s*/)[0];
                const trailingSpaces = part.match(/\s*$/)[0];
                return leadingSpaces + trimmed.substring(0, MAX_TAG_CHARACTERS) + trailingSpaces;
            }
            return part;
        });

        if (changed) {
            e.target.value = parts.join(',');
            const newPos = Math.min(cursorPosition, e.target.value.length);
            e.target.setSelectionRange(newPos, newPos);
        }
    });
}

window.addEventListener('resize', () => {
    requestAnimationFrame(renderActiveTab);
});

applyTheme(currentTheme);
applyFont(currentFont);
loadData();
updateTagsDatalist();
checkForSharedNote();
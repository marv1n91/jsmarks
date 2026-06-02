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
const DEFAULT_NOTE_COLOR = '#242424';

const modal = document.getElementById('editorModal');
const modalTitle = document.getElementById('modalTitle');
const titleInput = document.getElementById('noteTitleInput');
const bodyInput = document.getElementById('noteBodyInput');
const tagsInput = document.getElementById('noteTagsInput');
const colorSelect = document.getElementById('noteColorInput');
const pinnedInput = document.getElementById('notePinnedInput');
const searchInput = document.getElementById('search');
const viewGridBtn = document.getElementById('viewGridBtn');
const viewListBtn = document.getElementById('viewListBtn');
const filterPinnedSelect = document.getElementById('filterPinnedSelect');
const filterTagInput = document.getElementById('filterTagInput');
const tagsList = document.getElementById('tagsList');
const sortSelect = document.getElementById('sortSelect');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

function loadData() {
    const stored = localStorage.getItem('notes_app_data');
    notes = stored ? JSON.parse(stored).map(normalizeNote) : [];
    renderActiveTab();
}

function normalizeNote(note) {
    const now = Date.now();
    return {
        id: note.id || now.toString(),
        title: note.title,
        content: note.content,
        type: note.type,
        color: note.color,
        tags: Array.isArray(note.tags) ? note.tags : [],
        items: normalizeTaskItems(note),
        pinned: Boolean(note.pinned),
        createdAt: note.createdAt,
        updatedAt: note.updatedAt || note.createdAt
    };
}

function saveToLocal() {
    localStorage.setItem('notes_app_data', JSON.stringify(notes));
}

function renderActiveTab() {
    if(activeTab === 'notes') {
        renderNotes();
    } else {
        renderTasks();
    }
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

function updateViewClass(container) {
    if(!container) return;
    container.classList.toggle('notes-list', currentViewMode === 'list');
    container.classList.toggle('notes-grid', currentViewMode !== 'list');
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

function renderNotes() {
    const container = document.getElementById('notesContainer');
    if(!container || !searchInput) return;

    updateViewClass(container);
    const visibleNotes = getVisibleItemsForTab('notes');
    const emptyMessage = currentSearchQuery.trim()
        ? 'Ничего не найдено'
        : 'Пока нет заметок';
    searchInput.placeholder = 'Поиск заметок';
    container.innerHTML = visibleNotes.map(renderNoteCard).join('') || `<p class="empty-state">${emptyMessage}</p>`;
    attachCardEvents();
}

function renderTasks() {
    const container = document.getElementById('tasksContainer');
    if(!container || !searchInput) return;

    updateViewClass(container);
    const visibleTasks = getVisibleItemsForTab('tasks');
    const emptyMessage = currentSearchQuery.trim()
        ? 'Ничего не найдено'
        : 'Пока нет задач';
    searchInput.placeholder = 'Поиск задач';
    container.innerHTML = visibleTasks.map(renderNoteCard).join('') || `<p class="empty-state">${emptyMessage}</p>`;
    attachCardEvents();
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

if (searchInput) {
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
}

function renderNoteCard(note) {
    const hasDefaultColor = !note.color || note.color === DEFAULT_NOTE_COLOR;
    const bgColor = note.color || DEFAULT_NOTE_COLOR;
    const isLight = bgColor === '#ffffff' || bgColor === '#f8f32b';
    const bodyHtml = note.type === 'task' ? renderTaskList(note) : renderNoteText(note.content);
    const tagsHtml = note.tags.length
        ? `<div class="tags">${note.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}</div>`
        : '';

    return `
      <div class="note-card ${isLight ? 'light-card' : ''}" data-id="${note.id}" data-type="${note.type}" style="background: ${bgColor};">
        <button class="pin-note ${note.pinned ? 'pinned' : ''}" data-id="${note.id}" title="Закрепить" aria-label="Закрепить"></button>
        <div class="note-title" lang="ru">${escapeHtml(note.title)}</div>
        ${bodyHtml}
        ${tagsHtml}
        <div class="note-dates">
          <span>${formatDate(note.updatedAt)}</span>
        </div>
        <div class="note-footer">
          <span class="card-actions">
            <button class="edit-note" data-id="${note.id}">Изменить</button>
            <button class="delete-note" data-id="${note.id}">Удалить</button>
            <button class="share-note" data-id="${note.id}">Поделиться</button>
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
        return '<div class="note-preview empty-task-text">Нет задач</div>';
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

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function normalizeTags(tagsText) {
    const seenTags = new Set();

    return tagsText
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean)
        .filter(tag => {
            const tagKey = tag.toLowerCase();
            if(seenTags.has(tagKey)) return false;
            seenTags.add(tagKey);
            return true;
        });
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

function getTaskTextForEditor(note) {
    return note.items.map(item => item.text).join('\n');
}

function mergeTaskItems(oldItems = [], newItems = []) {
    return newItems.map((item, index) => {
        const oldItem = oldItems[index];
        const sameText = oldItem && oldItem.text === item.text;

        return {
            text: item.text,
            done: sameText ? oldItem.done : false
        };
    });
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
}

function handleEdit(e) {
    e.stopPropagation();
    const id = e.currentTarget.getAttribute('data-id');
    const note = notes.find(n => n.id === id);
    if(note) openModalForEdit(note);
}

function handleDelete(e) {
    e.stopPropagation();
    const id = e.currentTarget.getAttribute('data-id');
    if(confirm('Удалить заметку?')) {
        notes = notes.filter(n => n.id !== id);
        saveToLocal();
        updateTagsDatalist();
        renderActiveTab();
    }
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

function handleTaskItemClick(e) {
    if(e.target.classList.contains('task-checkbox')) return;

    const checkbox = e.currentTarget.querySelector('.task-checkbox');
    checkbox.checked = !checkbox.checked;
    setTaskDone(
        checkbox.getAttribute('data-id'),
        Number(checkbox.getAttribute('data-index')),
        checkbox.checked
    );
}

function generateLink(note) {
    const shareData = {
        id: note.id,
        title: note.title,
        content: note.content,
        type: note.type,
        color: note.color,
        tags: note.tags,
        items: note.items,
        sharedAt: Date.now()
    };
    const jsonStr = JSON.stringify(shareData);
    const encoded = btoa(encodeURIComponent(jsonStr));
    return `${window.location.origin}${window.location.pathname}#shared=${encoded}`;
}

async function copyLink(note) {
    const link = generateLink(note);
    try {
        await navigator.clipboard.writeText(link);
        alert('Ссылка скопирована');
    } catch (err) {
        prompt('Скопируйте ссылку вручную:', link);
    }
}

function handleShare(e) {
    e.stopPropagation();
    const id = e.currentTarget.getAttribute('data-id');
    const note = notes.find(n => n.id === id);
    if (note) copyLink(note);
}

function showSharedNote(sharedNote) {
    const isLight = sharedNote.color === '#ffffff' || sharedNote.color === '#f8f32b';

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
    if (!note.items?.length) return '<div>Нет задач</div>';

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
    if (!window.location.hash.includes('#shared=')) return;
    try {
        const encoded = window.location.hash.split('#shared=')[1];
        const sharedNote = JSON.parse(decodeURIComponent(atob(encoded)));
        showSharedNote(sharedNote);
    } catch (err) { console.error('Ошибка открытия заметки', err); }
}

function setTaskDone(id, index, done) {
    const note = notes.find(n => n.id === id);

    if(note && note.items[index]) {
        note.items[index].done = done;
        note.updatedAt = Date.now();
        saveToLocal();
        renderActiveTab();
    }
}

function openModalForCreate(forceType = 'note') {
    currentEditId = null;
    currentModalMode = 'create';
    currentCreateType = forceType;
    modalTitle.innerText = forceType === 'task' ? 'Новая задача' : 'Новая заметка';
    bodyInput.placeholder = forceType === 'task' ? 'Каждая задача с новой строки' : 'Содержание';
    titleInput.value = '';
    bodyInput.value = '';
    tagsInput.value = '';
    colorSelect.value = DEFAULT_NOTE_COLOR;
    pinnedInput.checked = false;
    modal.style.display = 'flex';
    titleInput.focus();
}

function openModalForEdit(note) {
    currentEditId = note.id;
    currentModalMode = 'edit';
    currentCreateType = note.type || 'note';
    modalTitle.innerText = note.type === 'task' ? 'Редактировать задачу' : 'Редактировать заметку';
    bodyInput.placeholder = note.type === 'task' ? 'Каждая задача с новой строки' : 'Содержание';
    titleInput.value = note.title || '';
    bodyInput.value = note.type === 'task' ? getTaskTextForEditor(note) : note.content || '';
    tagsInput.value = (note.tags || []).join(', ');
    colorSelect.value = note.color || DEFAULT_NOTE_COLOR;
    pinnedInput.checked = Boolean(note.pinned);
    modal.style.display = 'flex';
    titleInput.focus();
}

function closeModal() {
    modal.style.display = 'none';
    currentEditId = null;
}

function saveFromModal() {
    const titleTrim = titleInput.value.trim();
    const contentTrim = bodyInput.value.trim();
    const newItems = currentCreateType === 'task' ? normalizeTaskItems({ content: bodyInput.value }) : [];

    if(currentCreateType === 'task') {
        if(newItems.length === 0) {
            alert('Вы ничего не написали. Добавьте хотя бы один пункт в список задач.');
            return;
        }
    } else if(!titleTrim && !contentTrim) {
        alert('Вы ничего не написали. Заполните заголовок или содержание заметки.');
        return;
    }

    const newTitle = titleTrim || 'Без названия';
    const newContent = contentTrim;
    const newTags = normalizeTags(tagsInput.value);
    const selectedColor = colorSelect.value;
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
                items: currentCreateType === 'task' ? mergeTaskItems(notes[idx].items, newItems) : [],
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
if(filterPinnedSelect) {
    filterPinnedSelect.addEventListener('change', (e) => {
        currentPinnedFilter = e.target.value;
        renderActiveTab();
    });
}
if(filterTagInput) {
    filterTagInput.addEventListener('input', (e) => {
        currentTagFilter = e.target.value;
        renderActiveTab();
    });
}
if(sortSelect) {
    sortSelect.addEventListener('change', (e) => {
        currentSortMode = e.target.value;
        renderActiveTab();
    });
}
if(resetFiltersBtn) resetFiltersBtn.addEventListener('click', resetFilters);

window.addEventListener('click', (e) => {
    if(e.target === modal) closeModal();
});

loadData();
updateTagsDatalist();
checkForSharedNote();

const settingsModal = document.getElementById('settingsModal');
const themeSelect = document.getElementById('themeSelect');
const fontSelect = document.getElementById('fontSelect');
const importInput = document.getElementById('importInput');
const clearDataBtn = document.getElementById('clearDataBtn');

let currentTheme = localStorage.getItem('notes_app_theme') || 'dark';
applyTheme(currentTheme);
renderActiveTab();

let currentFont = localStorage.getItem('notes_app_font') || 'Comfortaa';
applyFont(currentFont);

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

const settingsBtn = document.getElementById('settingsBtn');
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
    clearDataBtn.addEventListener('click', () => {
        if (!confirm('Удалить все заметки и задачи без возможности восстановления?')) return;
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
                alert('Данные успешно восстановлены!');
                settingsModal.style.display = 'none';
            } else {
                alert('Ошибка: Неверный формат файла.');
            }
        } catch (err) {
            alert('Ошибка чтения файла. Убедитесь, что это правильный JSON.');
        }
        e.target.value = '';
    };
    reader.readAsText(file);
});

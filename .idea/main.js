let notes = [];
let currentEditId = null;
let currentModalMode = 'create';
let activeTab = 'notes';
let currentCreateType = 'note';

const modal = document.getElementById('editorModal');
const modalTitle = document.getElementById('modalTitle');
const titleInput = document.getElementById('noteTitleInput');
const bodyInput = document.getElementById('noteBodyInput');
const tagsInput = document.getElementById('noteTagsInput');
const colorSelect = document.getElementById('noteColorInput');
const pinnedInput = document.getElementById('notePinnedInput');

// Данные держим локально: после перезагрузки страницы всё берётся из localStorage
function loadData() {
    const stored = localStorage.getItem('notes_app_data');
    notes = stored ? JSON.parse(stored).map(normalizeNote) : [];
    renderActiveTab();
}

// старые заметки могли быть без новых полей, поэтому добиваем значения по умолчанию
function normalizeNote(note) {
    const now = Date.now();
    return {
        id: note.id || now.toString(),
        title: note.title || 'Без названия',
        content: note.content || '',
        type: note.type || 'note',
        color: note.color || '#242424',
        tags: Array.isArray(note.tags) ? note.tags : [],
        pinned: Boolean(note.pinned),
        createdAt: note.createdAt || now,
        updatedAt: note.updatedAt || note.createdAt || now
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

// сначала показываем закреплённые, внутри групп сортируем по последнему изменению
function getSortedItems() {
    return [...notes].sort((a, b) => {
        if(Boolean(a.pinned) !== Boolean(b.pinned)) {
            return Number(b.pinned) - Number(a.pinned);
        }
        return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
    });
}

//фильтруем обычные заметки, чтобы задачи не смешивались с ними.
function renderNotes() {
    const container = document.getElementById('notesContainer');
    if(!container) return;

    const visibleNotes = getSortedItems().filter(note => note.type !== 'task');
    container.innerHTML = visibleNotes.map(renderNoteCard).join('') || '<p class="empty-state">Пока нет заметок</p>';
    attachCardEvents();
}

// Задачи пока используют ту же карточку, просто лежат на своей вкладке.
function renderTasks() {
    const container = document.getElementById('tasksContainer');
    if(!container) return;

    const visibleTasks = getSortedItems().filter(note => note.type === 'task');
    container.innerHTML = visibleTasks.map(renderNoteCard).join('') || '<p class="empty-state">Пока нет задач</p>';
    attachCardEvents();
}

// Собираем HTML карточки в одном месте,так проще добавлять теги, даты и действия
function renderNoteCard(note) {
    const bgColor = note.color || '#242424';
    const isLight = bgColor === '#ffffff';
    const tagsHtml = note.tags.length
        ? `<div class="tags">${note.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}</div>`
        : '';
    const updatedText = note.updatedAt && note.updatedAt !== note.createdAt
        ? `<span>Изм: ${formatDate(note.updatedAt)}</span>`
        : '';

    return `
      <div class="note-card ${isLight ? 'light-card' : ''}" data-id="${note.id}" data-type="${note.type}" style="background: ${bgColor};">
        <button class="pin-note ${note.pinned ? 'pinned' : ''}" data-id="${note.id}" title="Закрепить" aria-label="Закрепить"></button>
        <div class="note-color-tag" style="background: ${note.color === '#ffffff' ? '#e2e8f0' : note.color};"></div>
        <div class="note-title">${escapeHtml(note.title)}</div>
        <div class="note-preview">${escapeHtml(note.content)}</div>
        ${tagsHtml}
        <div class="note-dates">
          <span>Созд: ${formatDate(note.createdAt)}</span>
          ${updatedText}
        </div>
        <div class="note-footer">
          <span>${note.type === 'task' ? 'Задача' : 'Заметка'}</span>
          <span class="card-actions">
            <button class="edit-note" data-id="${note.id}">Изменить</button>
            <button class="delete-note" data-id="${note.id}">Удалить</button>
          </span>
        </div>
      </div>
    `;
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Экранируем пользовательский текст, чтобы HTML из заметки не выполнялся как код.
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

// После перерисовки карточек обработчики нужно повесить заново
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
}

function handleEdit(e) {
    e.stopPropagation();
    const id = e.currentTarget.getAttribute('data-id');
    const note = notes.find(n => n.id === id);
    if(note) {
        openModalForEdit(note);
    }
}

function handleDelete(e) {
    e.stopPropagation();
    const id = e.currentTarget.getAttribute('data-id');
    if(confirm('Удалить заметку?')) {
        notes = notes.filter(n => n.id !== id);
        saveToLocal();
        renderActiveTab();
    }
}

// закрепление не меняет updatedAt, иначе откреплённая карточка не вернётся на своё место.
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

// эта модалка работает и для заметок,и для задач
function openModalForCreate(forceType = 'note') {
    currentEditId = null;
    currentModalMode = 'create';
    currentCreateType = forceType;
    modalTitle.innerText = forceType === 'task' ? 'Новая задача' : 'Новая заметка';
    titleInput.value = '';
    bodyInput.value = '';
    tagsInput.value = '';
    colorSelect.value = '#242424';
    pinnedInput.checked = false;
    modal.style.display = 'flex';
    titleInput.focus();
}

// при редактировании просто раскладываем данные заметки обратно по полям формы.
function openModalForEdit(note) {
    currentEditId = note.id;
    currentModalMode = 'edit';
    currentCreateType = note.type || 'note';
    modalTitle.innerText = note.type === 'task' ? 'Редактировать задачу' : 'Редактировать заметку';
    titleInput.value = note.title || '';
    bodyInput.value = note.content || '';
    tagsInput.value = (note.tags || []).join(', ');
    colorSelect.value = note.color || '#242424';
    pinnedInput.checked = Boolean(note.pinned);
    modal.style.display = 'flex';
    titleInput.focus();
}

function closeModal() {
    modal.style.display = 'none';
    currentEditId = null;
}

// Сохранение разделено по режиму: новая запись или обновление существующей
function saveFromModal() {
    const newTitle = titleInput.value.trim() || 'Без названия';
    const newContent = bodyInput.value;
    const newTags = tagsInput.value
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);
    const selectedColor = colorSelect.value;
    const isPinned = pinnedInput.checked;

    if(currentModalMode === 'create') {
        const now = Date.now();
        notes.unshift({
            id: now.toString() + Math.random().toString(36).substring(2, 6),
            title: newTitle,
            content: newContent,
            type: currentCreateType,
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
                color: selectedColor,
                tags: newTags,
                pinned: isPinned,
                updatedAt: Date.now()
            };
        }
    }

    saveToLocal();
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

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        switchTab(tab);
    });
});

document.getElementById('createNoteBtn').addEventListener('click', () => openModalForCreate('note'));
document.getElementById('createTaskBtn').addEventListener('click', () => openModalForCreate('task'));
document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('modalSave').addEventListener('click', saveFromModal);
window.addEventListener('click', (e) => {
    if(e.target === modal) closeModal();
});

loadData();

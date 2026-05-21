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

// берём сохранённые заметки из браузера
function loadData() {
    const stored = localStorage.getItem('notes_app_data');
    notes = stored ? JSON.parse(stored).map(normalizeNote) : [];
    renderActiveTab();
}

// если в localStorage лежат старые заметки, добавляем им новые поля
function normalizeNote(note) {
    const now = Date.now();
    return {
        id: note.id || now.toString(),
        title: note.title || 'Без названия',
        content: note.content || '',
        type: note.type || 'note',
        color: note.color || '#242424',
        tags: Array.isArray(note.tags) ? note.tags : [],
        items: normalizeTaskItems(note),
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

// закреплённые всегда наверху, остальные идут по последнему изменению
function getSortedItems() {
    return [...notes].sort((a, b) => {
        if(Boolean(a.pinned) !== Boolean(b.pinned)) {
            return Number(b.pinned) - Number(a.pinned);
        }
        return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
    });
}

// на этой вкладке показываем только обычные заметки
function renderNotes() {
    const container = document.getElementById('notesContainer');
    if(!container) return;

    const visibleNotes = getSortedItems().filter(note => note.type !== 'task');
    container.innerHTML = visibleNotes.map(renderNoteCard).join('') || '<p class="empty-state">Пока нет заметок</p>';
    attachCardEvents();
}

// задачи рендерим отдельно, чтобы не мешать их с заметками
function renderTasks() {
    const container = document.getElementById('tasksContainer');
    if(!container) return;

    const visibleTasks = getSortedItems().filter(note => note.type === 'task');
    container.innerHTML = visibleTasks.map(renderNoteCard).join('') || '<p class="empty-state">Пока нет задач</p>';
    attachCardEvents();
}

// карточку собираем тут, чтобы не дублировать разметку для заметок и задач
function renderNoteCard(note) {
    const bgColor = note.color || '#242424';
    const isLight = bgColor === '#ffffff';
    const bodyHtml = note.type === 'task' ? renderTaskList(note) : renderNoteText(note.content);
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
        <div class="note-title" lang="ru">${escapeHtml(note.title)}</div>
        ${bodyHtml}
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

function renderNoteText(content) {
    return `<div class="note-preview" lang="ru">${escapeHtml(content)}</div>`;
}

// рисуем пункты задачи с чекбоксами прямо внутри карточки
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

// убираем пустые и повторяющиеся теги
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

// каждая строка в задаче становится отдельным пунктом чеклиста
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

// если текст пункта не поменялся, оставляем его старое состояние checked
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

// пользовательский текст выводим как текст, а не как HTML
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

// карточки пересоздаются через innerHTML, поэтому события вешаем заново
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

// закрепление не трогает updatedAt, иначе после открепления карточка прыгнет наверх
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

// даём отмечать задачу кликом по тексту, а не только по маленькому чекбоксу
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

// общее место, где меняется состояние пункта задачи
function setTaskDone(id, index, done) {
    const note = notes.find(n => n.id === id);

    if(note && note.items[index]) {
        note.items[index].done = done;
        note.updatedAt = Date.now();
        saveToLocal();
        renderActiveTab();
    }
}

// одна форма используется и для заметок, и для задач
function openModalForCreate(forceType = 'note') {
    currentEditId = null;
    currentModalMode = 'create';
    currentCreateType = forceType;
    modalTitle.innerText = forceType === 'task' ? 'Новая задача' : 'Новая заметка';
    bodyInput.placeholder = forceType === 'task' ? 'Каждая задача с новой строки' : 'Содержание';
    titleInput.value = '';
    bodyInput.value = '';
    tagsInput.value = '';
    colorSelect.value = '#242424';
    pinnedInput.checked = false;
    modal.style.display = 'flex';
    titleInput.focus();
}

// заполняем форму данными выбранной карточки
function openModalForEdit(note) {
    currentEditId = note.id;
    currentModalMode = 'edit';
    currentCreateType = note.type || 'note';
    modalTitle.innerText = note.type === 'task' ? 'Редактировать задачу' : 'Редактировать заметку';
    bodyInput.placeholder = note.type === 'task' ? 'Каждая задача с новой строки' : 'Содержание';
    titleInput.value = note.title || '';
    bodyInput.value = note.type === 'task' ? getTaskTextForEditor(note) : note.content || '';
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

// при сохранении либо создаём новую карточку, либо обновляем старую
function saveFromModal() {
    const newTitle = titleInput.value.trim() || 'Без названия';
    const newContent = bodyInput.value;
    const newItems = currentCreateType === 'task' ? normalizeTaskItems({ content: newContent }) : [];
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

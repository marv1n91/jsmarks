let notes = [];
let currentEditId = null;
let currentModalMode = 'create';
let activeTab = 'notes';

function loadData() {
    const stored = localStorage.getItem('notes_app_data');
    if(stored) {
        notes = JSON.parse(stored);
    } else {
        notes = [];
    }
    renderActiveTab();
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

function renderNotes() {
    const container = document.getElementById('notesContainer');
    if(!container) return;
    container.innerHTML = notes.map(note => renderNoteCard(note)).join('');
    attachCardEvents();
}

function renderTasks() {
    const container = document.getElementById('tasksContainer');
    if(!container) return;
    attachCardEvents();
}


function renderNoteCard(note, isTaskView = false) {
    const bgColor = note.color || 'rgba(0,0,0,0.52)';
    return `
      <div class="note-card" data-id="${note.id}" data-type="${note.type}" style="background: ${bgColor}; transition: 0.1s;">
        <div class="note-color-tag" style="background: ${note.color === '#ffffff' ? '#e2e8f0' : note.color}; height: 6px;"></div>
        <div class="note-title">${escapeHtml(note.title || 'Без названия')}</div>
        <div class="note-preview">${escapeHtml(note.content || '')}</div>
        <div class="note-footer">
          <span>${new Date(note.createdAt).toLocaleDateString()}
          </span>
          <span style="display:flex; gap:8px;">
            <span class="edit-note" data-id="${note.id}" style="cursor:pointer;">Изменить</span>
            <span class="delete-note" data-id="${note.id}" style="cursor:pointer;">Удалить</span>
          </span>
        </div>
      </div>
    `;
}

function escapeHtml(str) {
    if(!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if(m === '&') return '&amp;';
        if(m === '<') return '&lt;';
        if(m === '>') return '&gt;';
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

const modal = document.getElementById('editorModal');
const modalTitle = document.getElementById('modalTitle');
const titleInput = document.getElementById('noteTitleInput');
const bodyInput = document.getElementById('noteBodyInput');
const radioText = document.querySelector('input[value="text"]');
const radioChecklist = document.querySelector('input[value="checklist"]');

function openModalForCreate(forceType = null) {
    currentEditId = null;
    currentModalMode = 'create';
    modalTitle.innerText = 'Новая заметка';
    modal.style.display = 'flex';
}

function openModalForEdit(note) {
    currentEditId = note.id;
    currentModalMode = 'edit';
    modalTitle.innerText = 'Редактировать';
    titleInput.value = note.title || '';
    bodyInput.value = note.content || '';
    colorSelect.value = note.color || '#ffffff';
    if(note.type === 'text') radioText.checked = true;
    else radioChecklist.checked = true;
    modal.style.display = 'flex';
}

function closeModal() {
    modal.style.display = 'none';
    currentEditId = null;
}

function saveFromModal() {
    const newTitle = titleInput.value.trim() || 'Без названия';
    const newContent = bodyInput.value;

    if(currentModalMode === 'create') {
        const newId = Date.now().toString() + Math.random().toString(36).substr(2, 4);
        const newNote = {
            id: newId,
            title: newTitle,
            content: newContent,
            createdAt: Date.now()
        };
        notes.unshift(newNote);
    } else if (currentEditId) {
        const idx = notes.findIndex(n => n.id === currentEditId);
        if(idx !== -1) {
            notes[idx] = {
                ...notes[idx],
                title: newTitle,
                content: newContent,
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

document.getElementById('createNoteBtn').addEventListener('click', () => openModalForCreate('text'));
document.getElementById('createTaskBtn').addEventListener('click', () => openModalForCreate('checklist'));
document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('modalSave').addEventListener('click', saveFromModal);
window.addEventListener('click', (e) => { if(e.target === modal) closeModal(); });

loadData();
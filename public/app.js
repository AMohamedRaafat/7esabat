/* ═══════════════════════════════════════════════════════════════
   إدارة الحسابات — App.js
   Full SPA logic: routing, API, rendering, PDF export
   ═══════════════════════════════════════════════════════════════ */

// ─── State ───────────────────────────────────────────────────────
let state = {
  view: 'home',
  cards: [],
  currentCard: null,
  currentCardData: null,
  loading: false,
  addRowOpen: false,
  editingRow: -1 // index of row being edited, -1 = none
};

// ─── Theme Management ────────────────────────────────────────────
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
  }
}

initTheme();

// ─── Card color palette (cycle through for visual variety) ──────
const CARD_COLORS = [
  { bg: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.2)', icon: '💰' },
  { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.2)', icon: '📋' },
  { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)', icon: '🏦' },
  { bg: 'rgba(236, 72, 153, 0.08)', border: 'rgba(236, 72, 153, 0.2)', icon: '📑' },
  { bg: 'rgba(14, 165, 233, 0.08)', border: 'rgba(14, 165, 233, 0.2)', icon: '💳' },
  { bg: 'rgba(168, 85, 247, 0.08)', border: 'rgba(168, 85, 247, 0.2)', icon: '📊' },
];

// ─── API Client ──────────────────────────────────────────────────
const api = {
  async getCards() {
    const res = await fetch('/api/cards');
    if (!res.ok) throw new Error('Failed to fetch cards');
    return res.json();
  },

  async getCard(name) {
    const res = await fetch(`/api/cards/${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error('Failed to fetch card');
    return res.json();
  },

  async addRow(name, values) {
    const res = await fetch(`/api/cards/${encodeURIComponent(name)}/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    });
    if (!res.ok) throw new Error('Failed to add row');
    return res.json();
  },

  async createCard(name, columns) {
    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, columns })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to create card');
    }
    return res.json();
  },

  async editColumns(name, mappedColumns) {
    const res = await fetch(`/api/cards/${encodeURIComponent(name)}/columns`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mappedColumns })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to edit columns');
    }
    return res.json();
  },

  async updateRow(name, index, values) {
    const res = await fetch(`/api/cards/${encodeURIComponent(name)}/rows/${index}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    });
    if (!res.ok) throw new Error('Failed to update row');
    return res.json();
  },

  async deleteRow(name, index) {
    const res = await fetch(`/api/cards/${encodeURIComponent(name)}/rows/${index}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete row');
    return res.json();
  },

  async deleteCard(name) {
    const res = await fetch(`/api/cards/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete card');
    return res.json();
  },

  async renameCard(oldName, newName) {
    const res = await fetch(`/api/cards/${encodeURIComponent(oldName)}/rename`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to rename card');
    }
    return res.json();
  },

  async updateNotes(name, notes) {
    const res = await fetch(`/api/cards/${encodeURIComponent(name)}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    });
    if (!res.ok) throw new Error('Failed to update notes');
    return res.json();
  }
};

// ─── Router ──────────────────────────────────────────────────────
function navigateTo(view, params = {}) {
  if (view === 'home') {
    window.location.hash = '#/';
  } else if (view === 'card') {
    window.location.hash = `#/card/${encodeURIComponent(params.name)}`;
  }
}

function handleRoute() {
  const hash = window.location.hash || '#/';
  if (hash.startsWith('#/card/')) {
    const name = decodeURIComponent(hash.replace('#/card/', ''));
    state.view = 'card';
    state.currentCard = name;
    state.addRowOpen = false;
    renderCardView(name);
  } else {
    state.view = 'home';
    state.currentCard = null;
    state.currentCardData = null;
    renderHome();
  }
}

// ─── Render: Home ────────────────────────────────────────────────
async function renderHome() {
  const app = document.getElementById('app');
  const navActions = document.getElementById('navbar-actions');
  navActions.innerHTML = '';

  app.innerHTML = `
    <div class="page-header">
      <h2>📊 الحسابات</h2>
      <p>إدارة ومتابعة جميع الحسابات والأقساط الخاصة بك</p>
    </div>
    <div class="loading-screen">
      <div class="spinner"></div>
      <span class="loading-text">جاري تحميل البيانات...</span>
    </div>
  `;

  try {
    state.cards = await api.getCards();
    renderCardsGrid();
  } catch (e) {
    app.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>حدث خطأ</h3>
        <p>${e.message}</p>
        <button class="btn btn-primary" onclick="renderHome()" style="margin-top: 16px;">إعادة المحاولة</button>
      </div>
    `;
  }
}

function renderCardsGrid() {
  const app = document.getElementById('app');
  const cards = state.cards;

  const cardsHtml = cards.map((card, i) => {
    const color = CARD_COLORS[i % CARD_COLORS.length];
    return `
      <div class="card card-animate" onclick="navigateTo('card', { name: '${escapeAttr(card.name)}' })"
           style="--card-accent-bg: ${color.bg}; --card-accent-border: ${color.border};">
        <div class="card-icon" style="background: ${color.bg}; border-color: ${color.border};">
          ${color.icon}
        </div>
        <div class="card-title">${escapeHtml(card.name)}</div>
        <div class="card-subtitle">${card.headers.slice(0, 3).join(' · ') || 'لا توجد أعمدة'}</div>
        <div class="card-stats">
          <div class="card-stat">
            📄 <span class="stat-value">${card.rowCount}</span> صف
          </div>
          <div class="card-stat">
            📋 <span class="stat-value">${card.columnCount}</span> عمود
          </div>
        </div>
      </div>
    `;
  }).join('');

  app.innerHTML = `
    <div class="page-header">
      <h2>📊 الحسابات</h2>
      <p>إدارة ومتابعة جميع الحسابات والأقساط الخاصة بك — ${cards.length} حساب</p>
    </div>
    <div class="cards-grid">
      ${cardsHtml}
      <div class="card card-create card-animate" onclick="showCreateModal()">
        <div class="create-icon">+</div>
        <span>إنشاء حساب جديد</span>
      </div>
    </div>
  `;
}

// ─── Render: Card Detail View ────────────────────────────────────
async function renderCardView(name) {
  const app = document.getElementById('app');
  const navActions = document.getElementById('navbar-actions');

  navActions.innerHTML = `
    <button class="btn btn-outline" onclick="exportCardPDF()">
      📄 تصدير PDF
    </button>
  `;

  app.innerHTML = `
    <div class="page-header">
      <div class="breadcrumb">
        <a href="#/" onclick="navigateTo('home')">الرئيسية</a>
        <span class="sep">‹</span>
        <span>${escapeHtml(name)}</span>
      </div>
      <h2>${escapeHtml(name)}</h2>
    </div>
    <div class="loading-screen">
      <div class="spinner"></div>
      <span class="loading-text">جاري تحميل البيانات...</span>
    </div>
  `;

  try {
    state.currentCardData = await api.getCard(name);
    renderCardTable();
  } catch (e) {
    app.innerHTML = `
      <div class="page-header">
        <div class="breadcrumb">
          <a href="#/" onclick="navigateTo('home')">الرئيسية</a>
          <span class="sep">‹</span>
          <span>${escapeHtml(name)}</span>
        </div>
        <h2>${escapeHtml(name)}</h2>
      </div>
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>خطأ في تحميل البيانات</h3>
        <p>${e.message}</p>
      </div>
    `;
  }
}

function renderCardTable() {
  const { name, headers, rows } = state.currentCardData;
  const app = document.getElementById('app');

  const nextItemNum = rows.length + 1;

  // Table
  let tableContent = '';
  if (rows.length === 0) {
    tableContent = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <h3>لا توجد بيانات</h3>
        <p>ابدأ بإضافة أول عنصر في هذا الحساب</p>
      </div>
    `;
  } else {
    const headerCells = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
    const rowsHtml = rows.map((row, ri) => {
      const isEditing = state.editingRow === ri;

      if (isEditing) {
        // Render editable row with inputs
        const editCells = row.map((cell, ci) => {
          return `<td><input class="edit-input" id="edit-field-${ci}" value="${escapeAttr(cell || '')}" /></td>`;
        }).join('');

        return `
          <tr class="editing" id="editing-row">
            <td>
              <div class="edit-actions">
                <button class="edit-save-btn" onclick="event.stopPropagation(); saveEditRow(${ri})" title="حفظ">✓ حفظ</button>
                <button class="edit-cancel-btn" onclick="event.stopPropagation(); cancelEditRow()" title="إلغاء">✕</button>
              </div>
            </td>
            ${editCells}
          </tr>
        `;
      }

      const cells = row.map(cell => {
        const val = cell || '';
        if (val === 'TRUE' || val === 'true' || val === 'نعم') {
          return `<td><span class="cell-badge-true">✓ نعم</span></td>`;
        } else if (val === 'FALSE' || val === 'false' || val === 'لا') {
          return `<td><span class="cell-badge-false">✗ لا</span></td>`;
        }
        return `<td>${escapeHtml(val)}</td>`;
      }).join('');

      return `
        <tr>
          <td>
            ${ri + 1}
            <div class="row-actions">
              <button class="row-action-btn edit-btn" onclick="event.stopPropagation(); startEditRow(${ri})" title="تعديل">✏️</button>
              <button class="row-action-btn delete-btn" onclick="event.stopPropagation(); confirmDeleteRow(${ri})" title="حذف">🗑️</button>
            </div>
          </td>
          ${cells}
        </tr>
      `;
    }).join('');

    tableContent = `
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              ${headerCells}
              </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  // Add Row Form
  const formFields = headers.map((h, i) => {
    let example = '';
    if (rows.length > 0) {
      // Find the last valid value in this column for an example
      for (let r = rows.length - 1; r >= 0; r--) {
        if (rows[r][i]) {
          example = ` (مثال: ${escapeHtml(rows[r][i])})`;
          break;
        }
      }
    }
    return `
    <div class="form-group">
      <label>${escapeHtml(h)}</label>
      <input type="text" id="add-field-${i}" placeholder="أدخل ${escapeHtml(h)}${example}" />
    </div>
    `;
  }).join('');

  const isOpen = state.addRowOpen;

  app.innerHTML = `
    <div class="page-header">
      <div class="breadcrumb">
        <a href="#/" onclick="navigateTo('home')">الرئيسية</a>
        <span class="sep">‹</span>
        <span>${escapeHtml(name)}</span>
      </div>
      <h2>
        ${escapeHtml(name)}
        <button class="btn btn-outline" style="padding: 4px 10px; margin-right: 15px; font-size: 14px;" onclick="promptRenameCard()">✏️ تعديل الاسم</button>
      </h2>
      <p>${rows.length} عنصر · ${headers.length} عمود</p>
    </div>

    <div class="card" style="margin-bottom: 20px; padding: 20px;">
      <h3 style="margin-top:0; color: var(--text-main);">📝 ملاحظات الحساب</h3>
      <textarea id="card-notes" class="edit-input" style="width: 100%; min-height: 80px; resize: vertical; margin-bottom: 12px; font-family: inherit; font-size: 14px;" placeholder="أضف ملاحظات أو وصف لهذه البطاقة...">${escapeHtml(state.currentCardData.notes || '')}</textarea>
      <button class="btn btn-primary" onclick="saveNotes(event)">✓ حفظ الملاحظات</button>
    </div>

    <div class="table-wrapper">
      <div class="table-toolbar">
        <div class="table-info">
          عرض <strong>${rows.length}</strong> عنصر
        </div>
        <div class="table-toolbar-right">
          <button class="btn btn-outline" onclick="showEditColumnsModal()">⚙️ تعديل الأعمدة</button>
          <button class="btn btn-outline" onclick="exportCardExcel()">📊 تصدير Excel</button>
          <button class="btn btn-outline" onclick="showExportModal()">📄 تصدير PDF</button>
          <button class="btn btn-primary" onclick="toggleAddRow()">+ إضافة عنصر</button>
        </div>
      </div>
      ${tableContent}
    </div>

    <div class="add-row-section" id="add-row-section">
      <div class="add-row-header ${isOpen ? 'open' : ''}" onclick="toggleAddRow()">
        <div class="add-row-header-right">
          <h3>➕ إضافة عنصر جديد</h3>
          <span class="item-badge">عنصر رقم ${nextItemNum}</span>
        </div>
        <span class="toggle-icon">▼</span>
      </div>
      <div class="add-row-body ${isOpen ? 'open' : ''}" id="add-row-body">
        <div class="form-grid">
          ${formFields}
        </div>
        <button class="btn btn-success" onclick="submitNewRow()" id="submit-row-btn">
          ✓ حفظ العنصر
        </button>
      </div>
    </div>
  `;
}

// ─── Toggle Add Row Form ─────────────────────────────────────────
function toggleAddRow() {
  state.addRowOpen = !state.addRowOpen;
  const header = document.querySelector('.add-row-header');
  const body = document.getElementById('add-row-body');
  if (state.addRowOpen) {
    header.classList.add('open');
    body.classList.add('open');
    // Focus first field
    setTimeout(() => {
      const first = document.getElementById('add-field-0');
      if (first) first.focus();
    }, 300);
  } else {
    header.classList.remove('open');
    body.classList.remove('open');
  }
}

// ─── Submit New Row ──────────────────────────────────────────────
async function submitNewRow() {
  if (!state.currentCardData) return;

  const { name, headers } = state.currentCardData;
  const values = headers.map((_, i) => {
    const input = document.getElementById(`add-field-${i}`);
    return input ? input.value.trim() : '';
  });

  // Check at least one field has data
  if (values.every(v => v === '')) {
    showToast('يرجى ملء حقل واحد على الأقل', 'error');
    return;
  }

  const btn = document.getElementById('submit-row-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="btn-spinner"></div> جاري الحفظ...';

  try {
    const result = await api.addRow(name, values);
    showToast(`تم إضافة العنصر رقم ${result.rowNumber} بنجاح`, 'success');
    state.addRowOpen = true;
    state.currentCardData = await api.getCard(name);
    renderCardTable();
  } catch (e) {
    showToast('خطأ في إضافة العنصر: ' + e.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '✓ حفظ العنصر';
  }
}

// ─── Edit Row ────────────────────────────────────────────────────
function startEditRow(index) {
  state.editingRow = index;
  renderCardTable();
  // Focus first edit input
  setTimeout(() => {
    const first = document.getElementById('edit-field-0');
    if (first) first.focus();
  }, 50);
}

function cancelEditRow() {
  state.editingRow = -1;
  renderCardTable();
}

async function saveEditRow(index) {
  if (!state.currentCardData) return;

  const { name, headers } = state.currentCardData;
  const values = headers.map((_, i) => {
    const input = document.getElementById(`edit-field-${i}`);
    return input ? input.value : '';
  });

  try {
    await api.updateRow(name, index, values);
    showToast('تم تحديث العنصر بنجاح', 'success');
    state.editingRow = -1;
    state.currentCardData = await api.getCard(name);
    renderCardTable();
  } catch (e) {
    showToast('خطأ في تحديث العنصر: ' + e.message, 'error');
  }
}

// ─── Delete Row ──────────────────────────────────────────────────
function confirmDeleteRow(index) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-icon">⚠️</div>
      <h3>حذف العنصر</h3>
      <p>هل أنت متأكد من حذف العنصر رقم ${index + 1}؟ لا يمكن التراجع عن هذا الإجراء.</p>
      <div class="confirm-actions">
        <button class="btn btn-danger" onclick="executeDeleteRow(${index})">نعم، حذف</button>
        <button class="btn btn-outline" onclick="this.closest('.confirm-overlay').remove()">إلغاء</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function executeDeleteRow(index) {
  document.querySelector('.confirm-overlay')?.remove();

  try {
    await api.deleteRow(state.currentCard, index);
    showToast('تم حذف العنصر بنجاح', 'success');
    state.editingRow = -1;
    state.currentCardData = await api.getCard(state.currentCard);
    renderCardTable();
  } catch (e) {
    showToast('خطأ في حذف العنصر: ' + e.message, 'error');
  }
}

// ─── Create Card Modal ───────────────────────────────────────────
function showCreateModal() {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal-content');

  modal.innerHTML = `
    <div class="modal-header">
      <div>
        <h3>📋 إنشاء حساب جديد</h3>
        <p>أضف اسم الحساب وحدد الأعمدة المطلوبة</p>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group" style="margin-bottom: 20px;">
        <label>اسم الحساب</label>
        <input type="text" id="new-card-name" placeholder="مثال: حساب الكهرباء" />
      </div>
      <label style="font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
        الأعمدة
      </label>
      <div class="columns-list" id="columns-list">
        <div class="column-item">
          <span class="col-number">1</span>
          <input type="text" class="col-input" placeholder="اسم العمود" />
          <button class="col-remove" onclick="removeColumn(this)" title="حذف">✕</button>
        </div>
        <div class="column-item">
          <span class="col-number">2</span>
          <input type="text" class="col-input" placeholder="اسم العمود" />
          <button class="col-action" onclick="moveColumn(this, -1)" title="أعلى">↑</button>
          <button class="col-action" onclick="moveColumn(this, 1)" title="أسفل">↓</button>
          <button class="col-remove" onclick="removeColumn(this)" title="حذف">✕</button>
        </div>
      </div>
      <button class="add-column-btn" onclick="addColumnField()">
        + إضافة عمود
      </button>
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" onclick="submitCreateCard()" id="create-card-btn">
        ✓ إنشاء الحساب
      </button>
      <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
    </div>
  `;

  overlay.classList.add('active');
  setTimeout(() => {
    document.getElementById('new-card-name')?.focus();
  }, 300);
}

function addColumnField() {
  const list = document.getElementById('columns-list');
  const count = list.children.length + 1;
  const item = document.createElement('div');
  item.className = 'column-item';
  item.setAttribute('data-old-index', '-1');
  item.innerHTML = `
    <span class="col-number">${count}</span>
    <input type="text" class="col-input" placeholder="اسم العمود" />
    <button class="col-action" onclick="moveColumn(this, -1)" title="أعلى">↑</button>
    <button class="col-action" onclick="moveColumn(this, 1)" title="أسفل">↓</button>
    <button class="col-remove" onclick="removeColumn(this)" title="حذف">✕</button>
  `;
  list.appendChild(item);
  item.querySelector('input').focus();
}

function removeColumn(btn) {
  const list = document.getElementById('columns-list');
  if (list.children.length <= 1) {
    showToast('يجب أن يكون هناك عمود واحد على الأقل', 'error');
    return;
  }
  btn.closest('.column-item').remove();
  // Re-number
  Array.from(list.children).forEach((item, i) => {
    item.querySelector('.col-number').textContent = i + 1;
  });
}

async function submitCreateCard() {
  const nameInput = document.getElementById('new-card-name');
  const name = nameInput.value.trim();

  if (!name) {
    showToast('يرجى إدخال اسم الحساب', 'error');
    nameInput.focus();
    return;
  }

  const inputs = document.querySelectorAll('#columns-list .col-input');
  const columns = Array.from(inputs).map(inp => inp.value.trim()).filter(v => v !== '');

  if (columns.length === 0) {
    showToast('يرجى إضافة عمود واحد على الأقل', 'error');
    return;
  }

  const btn = document.getElementById('create-card-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="btn-spinner"></div> جاري الإنشاء...';

  try {
    await api.createCard(name, columns);
    showToast(`تم إنشاء حساب "${name}" بنجاح`, 'success');
    closeModal();
    renderHome();
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '✓ إنشاء الحساب';
  }
}

// ─── Edit Columns Modal ──────────────────────────────────────────
function showEditColumnsModal() {
  if (!state.currentCardData) return;
  const { name, headers } = state.currentCardData;

  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal-content');

  const columnsHtml = headers.map((h, i) => `
    <div class="column-item">
      <span class="col-number">${i + 1}</span>
      <input type="text" class="col-input" placeholder="اسم العمود" value="${escapeAttr(h)}" />
      <button class="col-remove" onclick="removeColumn(this)" title="حذف">✕</button>
    </div>
  `).join('');

  modal.innerHTML = `
    <div class="modal-header">
      <div>
        <h3>⚙️ تعديل أعمدة الحساب</h3>
        <p>قم بتعديل أو إضافة أو حذف أعمدة لـ "${escapeHtml(name)}"</p>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <label style="font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
        الأعمدة
      </label>
      <div class="columns-list" id="columns-list">
        ${columnsHtml}
      </div>
      <button class="add-column-btn" onclick="addColumnField()">
        + إضافة عمود جديد
      </button>
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" onclick="submitEditColumns()" id="edit-columns-btn">
        ✓ حفظ التعديلات
      </button>
      <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
    </div>
  `;

  overlay.classList.add('active');
}

async function submitEditColumns() {
  if (!state.currentCardData) return;
  const name = state.currentCardData.name;

  const items = document.querySelectorAll('#columns-list .column-item');
  const mappedColumns = [];
  
  items.forEach(item => {
    const inp = item.querySelector('.col-input');
    const val = inp.value.trim();
    const oldIndex = parseInt(item.getAttribute('data-old-index'), 10);
    if (val !== '') {
      mappedColumns.push({ name: val, oldIndex: isNaN(oldIndex) ? -1 : oldIndex });
    }
  });

  if (mappedColumns.length === 0) {
    showToast('يرجى ترك عمود واحد على الأقل', 'error');
    return;
  }

  const btn = document.getElementById('edit-columns-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="btn-spinner"></div> جاري الحفظ...';

  try {
    await api.editColumns(name, mappedColumns);
    showToast('تم تحديث الأعمدة بنجاح', 'success');
    closeModal();
    // Refresh card view
    renderCardView(name);
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '✓ حفظ التعديلات';
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

// Close modal on overlay click
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeModal();
});

// ─── PDF Export ──────────────────────────────────────────────────
function showExportModal() {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal-content');

  modal.innerHTML = `
    <div class="modal-header">
      <div>
        <h3>📄 تصدير كملف PDF</h3>
        <p>خيارات تصدير التقرير</p>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group" style="margin-bottom: 16px;">
        <label>نمط التصميم</label>
        <select id="pdf-style-select">
          <option value="classic">كلاسيكي (تقرير بيانات)</option>
          <option value="invoice">فاتورة (أنيق ورسمي)</option>
          <option value="modern">عصري (ألوان بارزة)</option>
        </select>
      </div>
      <div class="form-group">
        <label>التوقيع / ملاحظة (عربي أو إنجليزي)</label>
        <input type="text" id="pdf-signature-input" placeholder="مثال: مدير الحسابات - أحمد محمود" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" onclick="executeExportPDF()" id="export-confirm-btn">
        📄 بدء التصدير
      </button>
      <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
    </div>
  `;

  overlay.classList.add('active');
  setTimeout(() => document.getElementById('pdf-signature-input')?.focus(), 50);
}

async function executeExportPDF() {
  if (!state.currentCardData) return;

  const btn = document.getElementById('export-confirm-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="btn-spinner"></div> جاري التصدير...';
  }

  const { name, headers, rows } = state.currentCardData;
  const signature = document.getElementById('pdf-signature-input')?.value.trim() || '';
  const styleOpt = document.getElementById('pdf-style-select')?.value || 'classic';
  
  const exportDate = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  // Determine direction of signature based on first character to support English or Arabic properly
  const isEnglishSig = /^[A-Za-z]/.test(signature);
  const sigDirection = isEnglishSig ? 'ltr' : 'rtl';
  const sigTextAlign = isEnglishSig ? 'right' : 'left';

  const signatureHtml = signature ? `
    <div style="margin-top: 50px; text-align: ${sigTextAlign}; direction: ${sigDirection}; page-break-inside: avoid;">
      <p style="font-size: 16px; font-weight: bold; border-top: 2px solid ${styleOpt === 'invoice' ? '#111' : '#ccc'}; display: inline-block; padding-top: 8px; min-width: 200px;">
        ${escapeHtml(signature)}
      </p>
    </div>
  ` : '';

  const notesHtml = state.currentCardData.notes ? `
    <div style="margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: right; direction: rtl;">
      <h3 style="margin-top: 0; color: #475569; font-size: 16px; margin-bottom: 8px;">📝 ملاحظات</h3>
      <p style="margin: 0; color: #334155; white-space: pre-wrap; font-size: 14px;">${escapeHtml(state.currentCardData.notes)}</p>
    </div>
  ` : '';

  // Build styled HTML for PDF
  const container = document.createElement('div');
  container.style.cssText = 'position: fixed; top: -9999px; left: -9999px;';

  let layoutHtml = '';

  if (styleOpt === 'invoice') {
    // Invoice Style
    layoutHtml = `
      <div id="pdf-content" style="direction: rtl; font-family: 'Cairo', sans-serif; padding: 40px; background: white; color: #111;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 30px;">
          <div>
            <h1 style="margin: 0; font-size: 36px; text-transform: uppercase; letter-spacing: 2px;">فاتورة / كشف حساب</h1>
            <h2 style="margin: 5px 0 0 0; font-size: 20px; color: #555;">${escapeHtml(name)}</h2>
          </div>
          <div style="text-align: left; font-size: 14px;">
            <div style="margin-bottom: 4px;"><strong>التاريخ:</strong> ${exportDate}</div>
            <div><strong>رقم المرجع:</strong> INV-${Math.floor(1000 + Math.random() * 9000)}</div>
          </div>
        </div>
        
        ${notesHtml}

        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 30px;">
          <thead>
            <tr style="border-bottom: 2px solid #111;">
              <th style="padding: 12px 8px; text-align: right; font-weight: bold;">#</th>
              ${headers.map(h => `<th style="padding: 12px 8px; text-align: right; font-weight: bold;">${escapeHtml(h)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, ri) => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px 8px; color: #555;">${ri + 1}</td>
                ${row.map(cell => `<td style="padding: 12px 8px;">${escapeHtml(cell || '')}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
          <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 4px; min-width: 250px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>إجمالي السجلات:</span>
              <strong>${rows.length}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; border-top: 2px solid #111; padding-top: 10px;">
              <span>الملخص:</span>
              <span>مكتمل</span>
            </div>
          </div>
        </div>
        ${signatureHtml}
      </div>
    `;
  } else if (styleOpt === 'modern') {
    // Modern Style
    layoutHtml = `
      <div id="pdf-content" style="direction: rtl; font-family: 'Cairo', sans-serif; padding: 40px; background: white; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 30px; border-radius: 16px; color: white; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 25px rgba(139, 92, 246, 0.2);">
          <div>
            <h1 style="margin: 0; font-size: 32px;">${escapeHtml(name)}</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">نظرة عامة على البيانات والحسابات</p>
          </div>
          <div style="background: rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold;">${rows.length}</div>
            <div style="font-size: 12px;">سجل مسجل</div>
          </div>
        </div>
        
        ${notesHtml}

        <div style="border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="padding: 16px; text-align: center; color: #64748b; border-bottom: 2px solid #e2e8f0; width: 40px;">#</th>
                ${headers.map(h => `<th style="padding: 16px; text-align: right; color: #334155; border-bottom: 2px solid #e2e8f0;">${escapeHtml(h)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, ri) => `
                <tr style="background: ${ri % 2 === 0 ? 'white' : '#f8fafc'}; transition: all 0.2s;">
                  <td style="padding: 14px 16px; text-align: center; font-weight: bold; color: #94a3b8; border-bottom: 1px solid #f1f5f9;">${ri + 1}</td>
                  ${row.map(cell => {
                    let val = cell || '';
                    if (val === 'TRUE' || val === 'true' || val === 'نعم') val = '<span style="background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px;">✓ نعم</span>';
                    else if (val === 'FALSE' || val === 'false' || val === 'لا') val = '<span style="background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px;">✗ لا</span>';
                    else val = escapeHtml(val);
                    return `<td style="padding: 14px 16px; color: #475569; border-bottom: 1px solid #f1f5f9;">${val}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${signatureHtml}
        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #94a3b8;">
          تم التصدير بتاريخ ${exportDate}
        </div>
      </div>
    `;
  } else {
    // Classic Style (default)
    layoutHtml = `
      <div id="pdf-content" style="direction: rtl; font-family: 'Cairo', sans-serif; padding: 40px; background: white; color: #1a1a2e;">
        <div style="text-align: center; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 3px solid #6366f1;">
          <h1 style="font-size: 32px; font-weight: 800; margin-bottom: 8px;">${escapeHtml(name)}</h1>
          <p style="font-size: 14px; color: #666; margin-bottom: 4px;">تقرير بيانات الحساب</p>
          <p style="font-size: 13px; color: #888;">📅 ${exportDate}</p>
        </div>

        <div style="display: flex; gap: 20px; margin-bottom: 28px; justify-content: center;">
          <div style="background: #f0f0ff; padding: 14px 28px; border-radius: 12px; text-align: center; border: 1px solid #e0e0ff;">
            <div style="font-size: 24px; font-weight: 800; color: #6366f1;">${rows.length}</div>
            <div style="font-size: 12px; color: #666;">إجمالي العناصر</div>
          </div>
          <div style="background: #f0fdf4; padding: 14px 28px; border-radius: 12px; text-align: center; border: 1px solid #dcfce7;">
            <div style="font-size: 24px; font-weight: 800; color: #10b981;">${headers.length}</div>
            <div style="font-size: 12px; color: #666;">عدد الأعمدة</div>
          </div>
        </div>

        ${notesHtml}

        <table style="width: 100%; border-collapse: collapse; font-size: 13px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr>
              <th style="background: #6366f1; color: white; padding: 12px 14px; text-align: center; font-weight: 700; font-size: 12px; width: 50px;">#</th>
              ${headers.map(h => `<th style="background: #6366f1; color: white; padding: 12px 14px; text-align: right; font-weight: 700; font-size: 12px;">${escapeHtml(h)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, ri) => `
              <tr style="background: ${ri % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                <td style="padding: 10px 14px; border: 1px solid #f0f0f0; color: #6366f1; font-weight: 700; text-align: center; font-size: 12px;">${ri + 1}</td>
                ${row.map(cell => `<td style="padding: 10px 14px; border: 1px solid #f0f0f0; color: #333;">${escapeHtml(cell || '')}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${signatureHtml}
      </div>
    `;
  }

  container.innerHTML = layoutHtml;

  document.body.appendChild(container);

  const isLandscape = headers.length > 5;
  const htmlContent = container.innerHTML;

  showToast('جاري إنشاء ملف PDF...', 'success');

  try {
    const response = await fetch('/api/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: htmlContent, landscape: isLandscape })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'فشل التصدير');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${name}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();

    showToast('تم تحميل ملف PDF بنجاح', 'success');
    closeModal();
  } catch (e) {
    showToast('خطأ في إنشاء PDF: ' + e.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '📄 بدء التصدير';
    }
  } finally {
    document.body.removeChild(container);
  }
}

// ─── Toast Notifications ─────────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '✕'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── Utility Functions ───────────────────────────────────────────
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function escapeAttr(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── Rename Card & Notes & Excel ─────────────────────────────────
async function promptRenameCard() {
  const newName = prompt("أدخل الاسم الجديد للحساب:", state.currentCard);
  if (!newName || newName.trim() === "" || newName === state.currentCard) return;

  try {
    await api.renameCard(state.currentCard, newName.trim());
    showToast('تم تغيير الاسم بنجاح', 'success');
    navigateTo('card', { name: newName.trim() });
  } catch (e) {
    showToast('خطأ في تغيير الاسم: ' + e.message, 'error');
  }
}

async function saveNotes(event) {
  const notes = document.getElementById('card-notes').value;
  const btn = event.target;
  const originalText = btn.innerHTML;
  btn.innerHTML = '<div class="btn-spinner"></div> جاري الحفظ...';
  btn.disabled = true;

  try {
    await api.updateNotes(state.currentCard, notes);
    showToast('تم حفظ الملاحظات بنجاح', 'success');
    state.currentCardData.notes = notes;
  } catch (e) {
    showToast('خطأ في حفظ الملاحظات: ' + e.message, 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

function exportCardExcel() {
  window.location.href = `/api/cards/${encodeURIComponent(state.currentCard)}/export-excel`;
}

// ─── Service Worker Registration ─────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

// ─── Init ────────────────────────────────────────────────────────
window.addEventListener('hashchange', handleRoute);
window.addEventListener('DOMContentLoaded', () => {
  handleRoute();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state.editingRow >= 0) {
      cancelEditRow();
    } else {
      closeModal();
      document.querySelector('.confirm-overlay')?.remove();
    }
  }
  // Enter to save edit
  if (e.key === 'Enter' && state.editingRow >= 0) {
    e.preventDefault();
    saveEditRow(state.editingRow);
  }
});

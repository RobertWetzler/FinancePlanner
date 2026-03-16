/* =============================================
   App Module — Main application logic
   ============================================= */

const App = {
  data: null,

  init() {
    this.data = Storage.load();
    this.applySettings();
    this.bindNavigation();
    this.bindTabs();
    this.bindModals();
    this.bindExportImport();
    this.bindSettingsPage();
    this.bindProjectionControls();
    this.bindFIREControls();
    this.bindMonteCarloControls();
    this.bindMilestones();
    this.bindSeedData();
    this.bindImportSync();
    this.bindSnapshotButton();
    this.navigateTo('dashboard');
    this.toast('Welcome to ProjectionFinances!', 'info');
  },

  save() {
    Storage.save(this.data);
  },

  // ── Navigation ─────────────────────────────────────
  bindNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        this.navigateTo(page);
      });
    });
  },

  navigateTo(page) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`.nav-link[data-page="${page}"]`)?.classList.add('active');

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) {
      pageEl.classList.add('active');
      // Force re-animation
      pageEl.style.animation = 'none';
      pageEl.offsetHeight;
      pageEl.style.animation = '';
    }

    // Refresh page data
    switch (page) {
      case 'dashboard': this.refreshDashboard(); break;
      case 'accounts': this.refreshAccounts(); break;
      case 'income-expenses': this.refreshIncomeExpenses(); break;
      case 'projections': this.refreshProjections(); break;
      case 'fire': this.refreshFIRE(); break;
      case 'milestones': this.refreshMilestones(); break;
      case 'import-sync': this.refreshImportSync(); break;
    }
  },

  // ── Tabs ───────────────────────────────────────────
  bindTabs() {
    document.querySelectorAll('.tabs').forEach(tabsContainer => {
      tabsContainer.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const parent = tab.closest('.page') || tab.closest('section');
          parent.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          parent.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
          tab.classList.add('active');
          const target = document.getElementById(`tab-${tab.dataset.tab}`);
          if (target) target.classList.add('active');
        });
      });
    });
  },

  // ── Modal System ───────────────────────────────────
  bindModals() {
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');
    const cancelBtn = document.getElementById('modal-cancel');

    closeBtn.addEventListener('click', () => this.closeModal());
    cancelBtn.addEventListener('click', () => this.closeModal());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal();
    });

    // Account buttons
    document.getElementById('btn-add-asset').addEventListener('click', () => this.openAccountModal('asset'));
    document.getElementById('btn-add-liability').addEventListener('click', () => this.openAccountModal('liability'));
    document.getElementById('btn-add-income').addEventListener('click', () => this.openIncomeModal());
    document.getElementById('btn-add-expense').addEventListener('click', () => this.openExpenseModal());
    document.getElementById('btn-add-milestone').addEventListener('click', () => this.openMilestoneModal());
  },

  openModal(title, bodyHtml, onSave) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-overlay').classList.add('active');

    const saveBtn = document.getElementById('modal-save');
    const newSave = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSave, saveBtn);
    newSave.id = 'modal-save';
    newSave.addEventListener('click', () => {
      onSave();
      this.closeModal();
    });
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
  },

  // ── Account Modals ─────────────────────────────────
  openAccountModal(type, existing = null) {
    const isAsset = type === 'asset';
    const title = existing ? `Edit ${isAsset ? 'Asset' : 'Liability'}` : `Add ${isAsset ? 'Asset' : 'Liability'}`;

    const typeOptions = isAsset
      ? ['Checking', 'Savings', 'Investment', '401(k)', 'IRA', 'Roth IRA', 'HSA', 'Brokerage', 'Real Estate', 'Crypto', 'Other']
      : ['Mortgage', 'Student Loan', 'Auto Loan', 'Credit Card', 'Personal Loan', 'Other'];

    const body = `
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="modal-acc-name" value="${existing?.name || ''}" placeholder="e.g. ${isAsset ? 'Vanguard 401(k)' : 'Home Mortgage'}">
      </div>
      <div class="form-group">
        <label>Type</label>
        <select id="modal-acc-type">
          ${typeOptions.map(t => `<option value="${t}" ${existing?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Current Balance ($)</label>
        <input type="number" id="modal-acc-balance" value="${existing?.balance || ''}" min="0" step="100" placeholder="0">
      </div>
      <div class="form-group">
        <label>Expected Annual Growth Rate (%)</label>
        <input type="number" id="modal-acc-growth" value="${existing?.growth ?? (isAsset ? 7 : 0)}" min="-10" max="30" step="0.5">
        <small>${isAsset ? 'Expected annual return on this asset' : 'Interest rate on this debt'}</small>
      </div>
      ${isAsset ? `
      <div class="form-group">
        <label>Monthly Contribution ($)</label>
        <input type="number" id="modal-acc-contribution" value="${existing?.monthlyContribution || 0}" min="0" step="50">
      </div>` : `
      <div class="form-group">
        <label>Monthly Payment ($)</label>
        <input type="number" id="modal-acc-payment" value="${existing?.monthlyPayment || 0}" min="0" step="50">
      </div>`}
    `;

    this.openModal(title, body, () => {
      const item = {
        id: existing?.id || Storage.generateId(),
        name: document.getElementById('modal-acc-name').value || (isAsset ? 'Unnamed Asset' : 'Unnamed Liability'),
        type: document.getElementById('modal-acc-type').value,
        balance: parseFloat(document.getElementById('modal-acc-balance').value) || 0,
        growth: parseFloat(document.getElementById('modal-acc-growth').value) || 0,
      };

      if (isAsset) {
        item.monthlyContribution = parseFloat(document.getElementById('modal-acc-contribution').value) || 0;
      } else {
        item.monthlyPayment = parseFloat(document.getElementById('modal-acc-payment').value) || 0;
      }

      const list = isAsset ? this.data.accounts.assets : this.data.accounts.liabilities;
      const idx = list.findIndex(a => a.id === item.id);
      if (idx >= 0) list[idx] = item;
      else list.push(item);

      this.save();
      this.refreshAccounts();
      this.toast(`${isAsset ? 'Asset' : 'Liability'} saved!`, 'success');
    });
  },

  openIncomeModal(existing = null) {
    const body = `
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="modal-inc-name" value="${existing?.name || ''}" placeholder="e.g. Salary, Side Business">
      </div>
      <div class="form-group">
        <label>Type</label>
        <select id="modal-inc-type">
          ${['Salary', 'Business', 'Freelance', 'Rental', 'Dividends', 'Social Security', 'Pension', 'Other'].map(t =>
            `<option value="${t}" ${existing?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Annual Amount ($)</label>
        <input type="number" id="modal-inc-annual" value="${existing?.annual || ''}" min="0" step="1000">
      </div>
      <div class="form-group">
        <label>Annual Growth Rate (%)</label>
        <input type="number" id="modal-inc-growth" value="${existing?.growth ?? 3}" min="0" max="20" step="0.5">
        <small>Expected annual raise or growth</small>
      </div>
      <div class="form-group">
        <label>Start Age (optional)</label>
        <input type="number" id="modal-inc-start" value="${existing?.startAge || ''}" placeholder="Current age">
      </div>
      <div class="form-group">
        <label>End Age (optional)</label>
        <input type="number" id="modal-inc-end" value="${existing?.endAge || ''}" placeholder="Retirement age">
      </div>
    `;

    this.openModal(existing ? 'Edit Income' : 'Add Income', body, () => {
      const item = {
        id: existing?.id || Storage.generateId(),
        name: document.getElementById('modal-inc-name').value || 'Unnamed Income',
        type: document.getElementById('modal-inc-type').value,
        annual: parseFloat(document.getElementById('modal-inc-annual').value) || 0,
        growth: parseFloat(document.getElementById('modal-inc-growth').value) || 3,
        startAge: parseInt(document.getElementById('modal-inc-start').value) || null,
        endAge: parseInt(document.getElementById('modal-inc-end').value) || null,
      };

      const idx = this.data.income.findIndex(i => i.id === item.id);
      if (idx >= 0) this.data.income[idx] = item;
      else this.data.income.push(item);

      this.save();
      this.refreshIncomeExpenses();
      this.toast('Income saved!', 'success');
    });
  },

  openExpenseModal(existing = null) {
    const body = `
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="modal-exp-name" value="${existing?.name || ''}" placeholder="e.g. Housing, Food, Transportation">
      </div>
      <div class="form-group">
        <label>Category</label>
        <select id="modal-exp-type">
          ${['Housing', 'Food', 'Transportation', 'Healthcare', 'Insurance', 'Entertainment', 'Education', 'Travel', 'Subscriptions', 'Childcare', 'Other'].map(t =>
            `<option value="${t}" ${existing?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Annual Amount ($)</label>
        <input type="number" id="modal-exp-annual" value="${existing?.annual || ''}" min="0" step="500">
      </div>
      <div class="form-group">
        <label>Annual Inflation Rate (%)</label>
        <input type="number" id="modal-exp-growth" value="${existing?.growth ?? 3}" min="0" max="15" step="0.5">
      </div>
    `;

    this.openModal(existing ? 'Edit Expense' : 'Add Expense', body, () => {
      const item = {
        id: existing?.id || Storage.generateId(),
        name: document.getElementById('modal-exp-name').value || 'Unnamed Expense',
        type: document.getElementById('modal-exp-type').value,
        annual: parseFloat(document.getElementById('modal-exp-annual').value) || 0,
        growth: parseFloat(document.getElementById('modal-exp-growth').value) || 3,
      };

      const idx = this.data.expenses.findIndex(e => e.id === item.id);
      if (idx >= 0) this.data.expenses[idx] = item;
      else this.data.expenses.push(item);

      this.save();
      this.refreshIncomeExpenses();
      this.toast('Expense saved!', 'success');
    });
  },

  openMilestoneModal(existing = null) {
    const body = `
      <div class="form-group">
        <label>Milestone Name</label>
        <input type="text" id="modal-ms-name" value="${existing?.name || ''}" placeholder="e.g. Pay off mortgage, Reach $1M">
      </div>
      <div class="form-group">
        <label>Icon</label>
        <select id="modal-ms-icon">
          ${['🎯', '🏠', '🚗', '🎓', '💰', '🏝️', '🔥', '👶', '🏖️', '📈', '🎉'].map(i =>
            `<option value="${i}" ${existing?.icon === i ? 'selected' : ''}>${i}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Target Net Worth ($)</label>
        <input type="number" id="modal-ms-amount" value="${existing?.targetAmount || ''}" min="0" step="10000">
      </div>
      <div class="form-group">
        <label>Target Year (optional)</label>
        <input type="number" id="modal-ms-year" value="${existing?.targetYear || ''}" min="2024" max="2090">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="modal-ms-notes" rows="3" style="resize:vertical">${existing?.notes || ''}</textarea>
      </div>
    `;

    this.openModal(existing ? 'Edit Milestone' : 'Add Milestone', body, () => {
      const item = {
        id: existing?.id || Storage.generateId(),
        name: document.getElementById('modal-ms-name').value || 'Unnamed Milestone',
        icon: document.getElementById('modal-ms-icon').value,
        targetAmount: parseFloat(document.getElementById('modal-ms-amount').value) || 0,
        targetYear: parseInt(document.getElementById('modal-ms-year').value) || null,
        notes: document.getElementById('modal-ms-notes').value,
      };

      const idx = this.data.milestones.findIndex(m => m.id === item.id);
      if (idx >= 0) this.data.milestones[idx] = item;
      else this.data.milestones.push(item);

      this.save();
      this.refreshMilestones();
      this.toast('Milestone saved!', 'success');
    });
  },

  // ── Export / Import ────────────────────────────────
  bindExportImport() {
    document.getElementById('btn-export').addEventListener('click', () => {
      Storage.export(this.data);
      this.toast('Data exported!', 'success');
    });

    const importInput = document.getElementById('import-file');
    document.getElementById('btn-import').addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', async (e) => {
      if (e.target.files[0]) {
        try {
          const imported = await Storage.import(e.target.files[0]);
          this.data = { ...Storage.getDefaultData(), ...imported };
          this.save();
          this.navigateTo('dashboard');
          this.toast('Data imported successfully!', 'success');
        } catch (err) {
          this.toast('Import failed: ' + err.message, 'error');
        }
        e.target.value = '';
      }
    });

    document.getElementById('btn-settings-export')?.addEventListener('click', () => {
      Storage.export(this.data);
      this.toast('Data exported!', 'success');
    });

    document.getElementById('btn-settings-import')?.addEventListener('click', () => importInput.click());

    document.getElementById('btn-reset-data')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
        this.data = Storage.reset();
        this.navigateTo('dashboard');
        this.toast('All data has been reset.', 'info');
      }
    });
  },

  // ── Settings ───────────────────────────────────────
  bindSettingsPage() {
    document.getElementById('btn-save-settings').addEventListener('click', () => {
      this.data.settings.name = document.getElementById('setting-name').value;
      this.data.settings.age = parseInt(document.getElementById('setting-age').value) || 30;
      this.data.settings.retireAge = parseInt(document.getElementById('setting-retire-age').value) || 65;
      this.data.settings.lifeExpectancy = parseInt(document.getElementById('setting-life-exp').value) || 90;
      this.data.settings.defaultReturn = parseFloat(document.getElementById('setting-return').value) || 7;
      this.data.settings.defaultInflation = parseFloat(document.getElementById('setting-inflation').value) || 3;
      this.data.settings.taxRate = parseFloat(document.getElementById('setting-tax').value) || 25;
      this.data.settings.capitalGainsRate = parseFloat(document.getElementById('setting-capgains').value) || 15;
      this.data.settings.stateTaxRate = parseFloat(document.getElementById('setting-statetax').value) || 5;
      this.data.settings.currency = document.getElementById('setting-currency').value;
      this.data.settings.darkMode = document.getElementById('setting-dark').checked;
      this.data.settings.realValues = document.getElementById('setting-real-values').checked;
      this.data.settings.compact = document.getElementById('setting-compact').checked;

      this.save();
      this.applySettings();
      this.toast('Settings saved!', 'success');
    });

    document.getElementById('setting-dark').addEventListener('change', (e) => {
      this.data.settings.darkMode = e.target.checked;
      this.applySettings();
      this.save();
    });
  },

  applySettings() {
    const s = this.data.settings;
    document.body.classList.toggle('light-mode', !s.darkMode);

    // Populate settings fields
    document.getElementById('setting-name').value = s.name || '';
    document.getElementById('setting-age').value = s.age;
    document.getElementById('setting-retire-age').value = s.retireAge;
    document.getElementById('setting-life-exp').value = s.lifeExpectancy;
    document.getElementById('setting-return').value = s.defaultReturn;
    document.getElementById('setting-inflation').value = s.defaultInflation;
    document.getElementById('setting-tax').value = s.taxRate;
    document.getElementById('setting-capgains').value = s.capitalGainsRate || 15;
    document.getElementById('setting-statetax').value = s.stateTaxRate || 5;
    document.getElementById('setting-currency').value = s.currency;
    document.getElementById('setting-dark').checked = s.darkMode;
    document.getElementById('setting-real-values').checked = s.realValues;
    document.getElementById('setting-compact').checked = s.compact;
  },

  // ── Dashboard ──────────────────────────────────────
  refreshDashboard() {
    const s = this.data.settings;
    const fire = Engine.calculateFIRE(this.data);
    const cur = s.currency;
    const compact = s.compact;

    document.getElementById('dash-net-worth').textContent = Engine.formatCurrency(fire.currentNetWorth, cur, compact);
    document.getElementById('dash-assets').textContent = Engine.formatCurrency(fire.totalAssets, cur, compact);
    document.getElementById('dash-liabilities').textContent = Engine.formatCurrency(fire.totalLiabilities, cur, compact);
    document.getElementById('dash-savings-rate').textContent = Engine.formatPercent(fire.savingsRate);

    const annualExpenses = fire.annualExpenses || 40000;
    const fireNumber = Engine.computeTaxAdjustedFIRENumber(annualExpenses, 4, this.data, s.defaultReturn, s.defaultInflation);
    document.getElementById('dash-fire-number').textContent = Engine.formatCurrency(fireNumber, cur, compact);

    const yearsToFire = Engine.yearsToFIRE(
      fire.investedAssets, fireNumber,
      s.defaultReturn, s.defaultInflation, this.data
    );
    document.getElementById('dash-years-fire').textContent =
      yearsToFire === Infinity ? '∞' : yearsToFire === 0 ? '🔥 Now!' : yearsToFire.toFixed(0) + ' yrs';

    // FIRE progress bar
    const firePct = Math.min((fire.investedAssets / fireNumber) * 100, 100);
    document.getElementById('dash-fire-bar').style.width = firePct + '%';
    document.getElementById('dash-fire-pct').textContent = firePct.toFixed(1) + '%';

    if (firePct >= 100) {
      document.getElementById('dash-fire-text').textContent = '🎉 Congratulations! You\'ve reached Financial Independence!';
    } else if (fire.investedAssets > 0) {
      document.getElementById('dash-fire-text').textContent =
        `You're ${firePct.toFixed(1)}% of the way to your FIRE number of ${Engine.formatCurrency(fireNumber, cur, compact)}.`;
    } else {
      document.getElementById('dash-fire-text').textContent = 'Add your accounts and income to see your FIRE progress.';
    }

    // Charts
    const projections = Engine.projectNetWorth(this.data, 30, s.defaultReturn, s.defaultInflation, s.realValues);
    Charts.renderDashProjection('chart-dash-projection', projections);

    if (this.data.accounts.assets.length > 0) {
      Charts.renderAllocation('chart-dash-allocation', this.data.accounts.assets);
    }

    this.refreshDashboardSnapshotInfo();
  },

  // ── Accounts Page ──────────────────────────────────
  refreshAccounts() {
    this.renderAccountList('assets-list', this.data.accounts.assets, 'asset');
    this.renderAccountList('liabilities-list', this.data.accounts.liabilities, 'liability');
  },

  renderAccountList(containerId, items, type) {
    const container = document.getElementById(containerId);
    if (!items.length) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 100 4 2 2 0 000-4z"/></svg>
          <h3>No ${type === 'asset' ? 'assets' : 'liabilities'} yet</h3>
          <p>Click the button above to add your first ${type}.</p>
        </div>`;
      return;
    }

    const isAsset = type === 'asset';
    const cur = this.data.settings.currency;
    container.innerHTML = items.map(item => `
      <div class="account-item" data-id="${item.id}">
        <div class="account-info">
          <div class="account-name">${item.name}</div>
          <div class="account-type">${item.type}${item.monthlyContribution ? ' · $' + item.monthlyContribution.toLocaleString() + '/mo contribution' : ''}${item.monthlyPayment ? ' · $' + item.monthlyPayment.toLocaleString() + '/mo payment' : ''}</div>
        </div>
        <div>
          <div class="account-value ${isAsset ? 'positive' : 'negative'}">${Engine.formatCurrency(item.balance, cur)}</div>
          <div class="account-growth">${item.growth}% ${isAsset ? 'return' : 'interest'}</div>
        </div>
        <div class="account-actions">
          <button class="edit" data-action="edit" data-type="${type}" data-id="${item.id}">Edit</button>
          <button class="delete" data-action="delete" data-type="${type}" data-id="${item.id}">Delete</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const itemType = btn.dataset.type;
        const list = itemType === 'asset' ? this.data.accounts.assets : this.data.accounts.liabilities;
        const item = list.find(a => a.id === id);

        if (btn.dataset.action === 'edit' && item) {
          this.openAccountModal(itemType, item);
        } else if (btn.dataset.action === 'delete') {
          if (confirm('Delete this item?')) {
            const idx = list.findIndex(a => a.id === id);
            if (idx >= 0) list.splice(idx, 1);
            this.save();
            this.refreshAccounts();
            this.toast('Item deleted.', 'info');
          }
        }
      });
    });
  },

  // ── Income & Expenses Page ─────────────────────────
  refreshIncomeExpenses() {
    this.renderCashFlowList('income-list', this.data.income, 'income');
    this.renderCashFlowList('expenses-list', this.data.expenses, 'expense');

    if (this.data.income.length || this.data.expenses.length) {
      Charts.renderCashFlow('chart-cashflow', this.data.income, this.data.expenses);
    }
  },

  renderCashFlowList(containerId, items, type) {
    const container = document.getElementById(containerId);
    if (!items.length) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          <h3>No ${type} items yet</h3>
          <p>Click the button above to add ${type === 'income' ? 'an income stream' : 'an expense'}.</p>
        </div>`;
      return;
    }

    const cur = this.data.settings.currency;
    const isIncome = type === 'income';
    container.innerHTML = items.map(item => `
      <div class="account-item" data-id="${item.id}">
        <div class="account-info">
          <div class="account-name">${item.name}</div>
          <div class="account-type">${item.type}${item.startAge ? ' · starts age ' + item.startAge : ''}${item.endAge ? ' · ends age ' + item.endAge : ''} · ${item.growth}% annual growth</div>
        </div>
        <div>
          <div class="account-value ${isIncome ? 'positive' : 'negative'}">${isIncome ? '+' : '-'}${Engine.formatCurrency(item.annual, cur)}/yr</div>
          <div class="account-growth">${Engine.formatCurrency(item.annual / 12, cur)}/mo</div>
        </div>
        <div class="account-actions">
          <button class="edit" data-action="edit" data-type="${type}" data-id="${item.id}">Edit</button>
          <button class="delete" data-action="delete" data-type="${type}" data-id="${item.id}">Delete</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const list = type === 'income' ? this.data.income : this.data.expenses;
        const item = list.find(a => a.id === id);

        if (btn.dataset.action === 'edit' && item) {
          if (type === 'income') this.openIncomeModal(item);
          else this.openExpenseModal(item);
        } else if (btn.dataset.action === 'delete') {
          if (confirm('Delete this item?')) {
            const idx = list.findIndex(a => a.id === id);
            if (idx >= 0) list.splice(idx, 1);
            this.save();
            this.refreshIncomeExpenses();
            this.toast('Item deleted.', 'info');
          }
        }
      });
    });
  },

  // ── Projections Page ───────────────────────────────
  bindProjectionControls() {
    const yearsSlider = document.getElementById('proj-years');
    const returnSlider = document.getElementById('proj-return');
    const inflationSlider = document.getElementById('proj-inflation');
    const realToggle = document.getElementById('proj-real');

    const update = () => {
      document.getElementById('proj-years-val').textContent = yearsSlider.value + ' years';
      document.getElementById('proj-return-val').textContent = returnSlider.value + '%';
      document.getElementById('proj-inflation-val').textContent = inflationSlider.value + '%';
      this.refreshProjections();
    };

    yearsSlider.addEventListener('input', update);
    returnSlider.addEventListener('input', update);
    inflationSlider.addEventListener('input', update);
    realToggle.addEventListener('change', update);
  },

  refreshProjections() {
    const years = parseInt(document.getElementById('proj-years').value);
    const ret = parseFloat(document.getElementById('proj-return').value);
    const inf = parseFloat(document.getElementById('proj-inflation').value);
    const real = document.getElementById('proj-real').checked;

    const projections = Engine.projectNetWorth(this.data, years, ret, inf, real);
    Charts.renderProjection('chart-projection', projections, this.data.milestones);

    // Table
    const tbody = document.querySelector('#projection-table tbody');
    const cur = this.data.settings.currency;
    const compact = this.data.settings.compact;
    tbody.innerHTML = projections.map(p => `
      <tr>
        <td>${p.year}</td>
        <td>${p.age}</td>
        <td>${Engine.formatCurrency(p.grossIncome || p.income, cur, compact)}</td>
        <td style="color:var(--accent-red)">${Engine.formatCurrency(p.incomeTax || 0, cur, compact)}</td>
        <td>${Engine.formatCurrency(p.income, cur, compact)}</td>
        <td>${Engine.formatCurrency(p.expenses, cur, compact)}</td>
        <td>${Engine.formatCurrency(p.savings, cur, compact)}</td>
        <td>${Engine.formatCurrency(p.investmentReturns, cur, compact)}</td>
        <td style="color:var(--accent-red)">${Engine.formatCurrency(p.investmentTax || 0, cur, compact)}</td>
        <td style="color:${p.accessible < p.assets * 0.5 && p.age < 59.5 ? 'var(--accent-orange)' : 'inherit'}">${Engine.formatCurrency(p.accessible, cur, compact)}</td>
        <td><strong>${Engine.formatCurrency(p.netWorth, cur, compact)}</strong></td>
      </tr>
    `).join('');
  },

  // ── FIRE Calculator ────────────────────────────────
  bindFIREControls() {
    document.getElementById('btn-calc-fire').addEventListener('click', () => this.refreshFIRE());

    // FIRE type card click handlers
    document.querySelectorAll('.fire-type[data-fire-type]').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.dataset.fireType;
        const expenses = parseInt(card.dataset.fireExpenses);

        // Highlight active card
        document.querySelectorAll('.fire-type[data-fire-type]').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        if (type === 'coast') {
          // Coast FIRE: show the coast number (already invested enough, just let it grow)
          const s = this.data.settings;
          const fire = Engine.calculateFIRE(this.data);
          const swr = parseFloat(document.getElementById('fire-swr').value) || 4;
          const nomReturn = parseFloat(document.getElementById('fire-return').value) || 7;
          const inflation = parseFloat(document.getElementById('fire-inflation').value) || 3;
          const retireExpenses = parseFloat(document.getElementById('fire-expenses').value) || 40000;
          const fireNumber = Engine.computeFIRENumber(retireExpenses, swr);
          const coastNumber = Engine.computeCoastFIRE(s.retireAge, s.age, fireNumber, nomReturn, inflation);

          // Show coast-specific info
          const coastReached = fire.investedAssets >= coastNumber;
          document.getElementById('fire-number').textContent = Engine.formatCurrency(coastNumber, s.currency, s.compact);
          document.getElementById('fire-years').textContent = coastReached ? 'Now! 🏖️' : '—';
          document.getElementById('fire-date').textContent = coastReached ? 'Achieved' : '—';
          document.getElementById('fire-age').textContent = coastReached ? s.age : '—';
          this.toast(`Coast FIRE: You need ${Engine.formatCurrency(coastNumber, s.currency)} invested now so it grows to your FIRE number by retirement.`, 'info');
        } else {
          // Update expenses input and recalculate
          document.getElementById('fire-expenses').value = expenses;
          this.refreshFIRE();
          this.toast(`Switched to ${card.querySelector('h4').textContent} — $${expenses.toLocaleString()}/yr expenses`, 'info');
        }
      });
    });
  },

  refreshFIRE() {
    const s = this.data.settings;
    const fire = Engine.calculateFIRE(this.data);
    const cur = s.currency;
    const compact = s.compact;

    const annualExpRet = parseFloat(document.getElementById('fire-expenses').value) || fire.annualExpenses || 40000;
    const swr = parseFloat(document.getElementById('fire-swr').value) || 4;
    const nomReturn = parseFloat(document.getElementById('fire-return').value) || 7;
    const inflation = parseFloat(document.getElementById('fire-inflation').value) || 3;

    // Tax-adjusted FIRE number: accounts for taxes on withdrawals
    const fireNumberPreTax = Engine.computeFIRENumber(annualExpRet, swr);
    const fireNumber = Engine.computeTaxAdjustedFIRENumber(annualExpRet, swr, this.data, nomReturn, inflation);
    const yearsToFire = Engine.yearsToFIRE(fire.investedAssets, fireNumber, nomReturn, inflation, this.data);
    const yearsToAccessible = Engine.yearsToAccessibleFIRE(fireNumber, nomReturn, inflation, this.data);

    document.getElementById('fire-number').textContent = Engine.formatCurrency(fireNumber, cur, compact);
    document.getElementById('fire-number').title =
      `Pre-tax: ${Engine.formatCurrency(fireNumberPreTax, cur, compact)} → Tax-adjusted: ${Engine.formatCurrency(fireNumber, cur, compact)}`;
    document.getElementById('fire-years').textContent =
      yearsToFire === Infinity ? '∞' : yearsToFire === 0 ? 'Now! 🔥' : yearsToFire.toFixed(1) + ' yrs';
    document.getElementById('fire-years-sub').textContent =
      (yearsToAccessible > yearsToFire && yearsToAccessible !== Infinity)
        ? '⚠️ but not accessible yet' : '';

    const fireDate = new Date();
    fireDate.setFullYear(fireDate.getFullYear() + (yearsToFire === Infinity ? 0 : yearsToFire));
    document.getElementById('fire-date').textContent =
      yearsToFire === Infinity ? '—' : fireDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const fireAge = s.age + (yearsToFire === Infinity ? 0 : Math.ceil(yearsToFire));
    document.getElementById('fire-age').textContent = yearsToFire === Infinity ? '—' : fireAge;

    // Accessible FIRE metrics
    document.getElementById('fire-accessible-years').textContent =
      yearsToAccessible === Infinity ? '∞'
        : yearsToAccessible === 0 ? 'Now! 🔥'
        : yearsToAccessible.toFixed(1) + ' yrs';

    const accessAge = s.age + (yearsToAccessible === Infinity ? 0 : Math.ceil(yearsToAccessible));
    document.getElementById('fire-accessible-age').textContent =
      yearsToAccessible === Infinity ? '—' : accessAge;

    const accessDate = new Date();
    accessDate.setFullYear(accessDate.getFullYear() + (yearsToAccessible === Infinity ? 0 : yearsToAccessible));
    document.getElementById('fire-accessible-date').textContent =
      yearsToAccessible === Infinity ? ''
        : accessDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    document.getElementById('fire-accessible-sub').textContent =
      (yearsToAccessible === yearsToFire) ? 'Same as total — no gap!'
        : (yearsToAccessible === Infinity) ? 'Penalty-free funds only'
        : 'Penalty-free funds only';

    // Chart — with bucket projection
    const maxYears = Math.min(Math.max(yearsToFire === Infinity ? 30 : yearsToFire + 10, 20), 50);
    const projection = Engine.fireProjection(fire.investedAssets, fireNumber, nomReturn, inflation, Math.round(maxYears), this.data);

    // Generate bucket projections aligned to FIRE chart years
    const bucketProj = Engine.projectNetWorth(this.data, Math.round(maxYears), nomReturn, inflation, false);
    const bucketData = bucketProj.map(p => ({
      taxable: p.taxable || 0,
      taxFree: p.taxFree || 0,
      taxDeferred: p.taxDeferred || 0,
      restricted: p.restricted || 0,
      realAssets: p.realAssets || 0,
      accessible: p.accessible || 0,
    }));

    Charts.renderFIRE('chart-fire', projection, bucketData);

    // Early retirement accessibility warning
    const buckets = Engine.getBucketBalances(this.data);
    const totalInvested = Object.values(buckets).reduce((s, v) => s + v, 0);
    const lockedPct = totalInvested > 0
      ? ((buckets[Engine.BUCKET_TAX_DEFERRED] + buckets[Engine.BUCKET_RESTRICTED]) / totalInvested * 100)
      : 0;
    const accessWarningEl = document.getElementById('fire-access-warning');
    if (accessWarningEl) {
      if (s.age < 50 && lockedPct > 40) {
        const accessible = Engine.getAccessibleBalance(buckets, s.age);
        accessWarningEl.style.display = 'block';
        accessWarningEl.innerHTML = `
          <div class="warning-icon">⚠️</div>
          <div class="warning-content">
            <strong>Early Retirement Access Gap</strong>
            <p>${Math.round(lockedPct)}% of your invested assets (${Engine.formatCurrency(buckets[Engine.BUCKET_TAX_DEFERRED] + buckets[Engine.BUCKET_RESTRICTED], cur, compact)}) are in tax-deferred accounts (401(k)/IRA/HSA) that can't be withdrawn penalty-free until age 59½.</p>
            <p>Currently accessible without penalty: <strong>${Engine.formatCurrency(accessible, cur, compact)}</strong> — consider a Roth conversion ladder, Rule of 55, or 72(t) SEPP strategy to bridge the gap.</p>
          </div>`;
      } else {
        accessWarningEl.style.display = 'none';
      }
    }

    // FIRE Variants
    const variants = Engine.computeFIREVariants(swr);
    document.getElementById('lean-fire-num').textContent = Engine.formatCurrency(variants.lean, cur, compact);
    document.getElementById('regular-fire-num').textContent = Engine.formatCurrency(variants.regular, cur, compact);
    document.getElementById('fat-fire-num').textContent = Engine.formatCurrency(variants.fat, cur, compact);
    document.getElementById('barista-fire-num').textContent = Engine.formatCurrency(variants.barista, cur, compact);

    const coastNumber = Engine.computeCoastFIRE(s.retireAge, s.age, fireNumber, nomReturn, inflation);
    document.getElementById('coast-fire-num').textContent = Engine.formatCurrency(coastNumber, cur, compact);
  },

  // ── Monte Carlo ────────────────────────────────────
  bindMonteCarloControls() {
    document.getElementById('btn-run-mc').addEventListener('click', () => this.runMonteCarlo());
  },

  runMonteCarlo() {
    const fire = Engine.calculateFIRE(this.data);
    const trials = parseInt(document.getElementById('mc-trials').value);
    const mean = parseFloat(document.getElementById('mc-mean').value);
    const std = parseFloat(document.getElementById('mc-std').value);
    const years = parseInt(document.getElementById('mc-years').value);
    const withdrawal = parseFloat(document.getElementById('mc-withdrawal').value) || 0;

    const startBalance = fire.investedAssets || 0;
    const contribution = withdrawal > 0 ? 0 : fire.annualSavings;

    this.toast(`Running ${trials.toLocaleString()} simulations...`, 'info');

    // Use setTimeout to let UI update
    setTimeout(() => {
      const result = Engine.runMonteCarlo(startBalance, contribution, withdrawal, years, trials, mean, std, this.data);

      document.getElementById('mc-results').style.display = 'block';

      const cur = this.data.settings.currency;
      const compact = this.data.settings.compact;
      document.getElementById('mc-success').textContent = result.successRate.toFixed(1) + '%';
      document.getElementById('mc-median').textContent = Engine.formatCurrency(result.median, cur, compact);
      document.getElementById('mc-p10').textContent = Engine.formatCurrency(result.p10, cur, compact);
      document.getElementById('mc-p90').textContent = Engine.formatCurrency(result.p90, cur, compact);

      // Success gauge
      const gaugePct = result.successRate / 100;
      const gaugeArc = gaugePct * 251.2;
      document.getElementById('gauge-fill').setAttribute('stroke-dasharray', `${gaugeArc} 251.2`);
      document.getElementById('gauge-pct').textContent = result.successRate.toFixed(1) + '%';
      document.getElementById('gauge-pct').style.color =
        result.successRate >= 80 ? '#22c55e' : result.successRate >= 50 ? '#f59e0b' : '#ef4444';

      Charts.renderMonteCarlo('chart-montecarlo', result, years);
      Charts.renderHistogram('chart-mc-histogram', result.trials.map(t => t.finalBalance));

      this.toast('Simulation complete!', 'success');
    }, 50);
  },

  // ── Milestones Page ────────────────────────────────
  bindMilestones() {
    // Already bound via openMilestoneModal
  },

  refreshMilestones() {
    const container = document.getElementById('milestones-list');
    const milestones = this.data.milestones;
    const cur = this.data.settings.currency;

    if (!milestones.length) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          <h3>No milestones yet</h3>
          <p>Add financial goals like "Reach $1M" or "Pay off mortgage".</p>
        </div>`;
      return;
    }

    container.innerHTML = milestones.map(m => `
      <div class="milestone-item" data-id="${m.id}">
        <div class="milestone-icon">${m.icon || '🎯'}</div>
        <div class="milestone-info">
          <div class="milestone-name">${m.name}</div>
          <div class="milestone-detail">${m.targetYear ? 'Target: ' + m.targetYear : ''} ${m.notes ? '· ' + m.notes : ''}</div>
        </div>
        <div class="milestone-target">${m.targetAmount ? Engine.formatCurrency(m.targetAmount, cur) : ''}</div>
        <div class="account-actions">
          <button class="edit" data-action="edit" data-id="${m.id}">Edit</button>
          <button class="delete" data-action="delete" data-id="${m.id}">Delete</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = milestones.find(m => m.id === id);

        if (btn.dataset.action === 'edit' && item) {
          this.openMilestoneModal(item);
        } else if (btn.dataset.action === 'delete') {
          if (confirm('Delete this milestone?')) {
            const idx = milestones.findIndex(m => m.id === id);
            if (idx >= 0) milestones.splice(idx, 1);
            this.save();
            this.refreshMilestones();
            this.toast('Milestone deleted.', 'info');
          }
        }
      });
    });

    // Milestones chart
    const s = this.data.settings;
    const projections = Engine.projectNetWorth(this.data, 30, s.defaultReturn, s.defaultInflation, s.realValues);
    Charts.renderMilestones('chart-milestones', milestones, projections);
  },

  // ── Dashboard Snapshot Button ───────────────────────
  bindSnapshotButton() {
    document.getElementById('btn-record-snapshot').addEventListener('click', () => {
      const fire = Engine.calculateFIRE(this.data);
      const today = new Date().toISOString().split('T')[0];

      // Don't add duplicate for same day
      const existing = this.data.history.findIndex(h => h.date === today);
      const entry = {
        date: today,
        netWorth: fire.currentNetWorth,
        assets: fire.totalAssets,
        liabilities: fire.totalLiabilities
      };

      if (existing >= 0) {
        this.data.history[existing] = entry;
      } else {
        this.data.history.push(entry);
        this.data.history.sort((a, b) => a.date.localeCompare(b.date));
      }

      this.save();
      this.refreshDashboardSnapshotInfo();
      this.toast('📸 Snapshot recorded for ' + today, 'success');
    });
  },

  refreshDashboardSnapshotInfo() {
    const lastEl = document.getElementById('dash-last-snapshot');
    if (this.data.history.length > 0) {
      const last = this.data.history[this.data.history.length - 1];
      lastEl.textContent = `Last: ${last.date} — ${Engine.formatCurrency(last.netWorth, this.data.settings.currency)}`;
    } else {
      lastEl.textContent = 'No snapshots yet';
    }
  },

  // ── Import & Sync ──────────────────────────────────
  _csvState: { headers: [], rows: [], mapping: {}, format: 'generic' },

  bindImportSync() {
    const dropZone = document.getElementById('csv-drop-zone');
    const fileInput = document.getElementById('csv-file-input');

    // Drop zone events
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) this.handleCSVFile(file);
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) this.handleCSVFile(e.target.files[0]);
      e.target.value = '';
    });

    // Paste button
    document.getElementById('btn-parse-pasted').addEventListener('click', () => {
      const text = document.getElementById('csv-paste-area').value.trim();
      if (!text) { this.toast('Paste some data first!', 'error'); return; }

      // Convert tab-separated to CSV if needed
      const converted = text.includes('\t') ? text.split('\n').map(line => line.split('\t').join(',')).join('\n') : text;
      this.processCSVText(converted, 'Pasted Data');
    });

    // Cancel import
    document.getElementById('btn-cancel-import').addEventListener('click', () => {
      document.getElementById('csv-preview-section').style.display = 'none';
    });

    // Confirm import
    document.getElementById('btn-confirm-import').addEventListener('click', () => this.confirmImport());

    // Import type radio change
    document.querySelectorAll('input[name="import-type"]').forEach(radio => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.import-type-option').forEach(o => o.classList.remove('active'));
        radio.closest('.import-type-option').classList.add('active');
      });
    });

    // Snapshot form
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('snapshot-date').value = today;

    document.getElementById('btn-add-snapshot').addEventListener('click', () => {
      const date = document.getElementById('snapshot-date').value;
      const nw = parseFloat(document.getElementById('snapshot-nw').value);
      const assets = parseFloat(document.getElementById('snapshot-assets').value) || null;
      const liab = parseFloat(document.getElementById('snapshot-liab').value) || null;

      if (!date || isNaN(nw)) { this.toast('Please enter a date and net worth.', 'error'); return; }

      const entry = { date, netWorth: nw };
      if (assets !== null) entry.assets = assets;
      if (liab !== null) entry.liabilities = liab;

      const existing = this.data.history.findIndex(h => h.date === date);
      if (existing >= 0) this.data.history[existing] = entry;
      else this.data.history.push(entry);
      this.data.history.sort((a, b) => a.date.localeCompare(b.date));

      this.save();
      this.refreshSnapshotTable();
      this.toast('Snapshot added for ' + date, 'success');

      // Clear inputs
      document.getElementById('snapshot-nw').value = '';
      document.getElementById('snapshot-assets').value = '';
      document.getElementById('snapshot-liab').value = '';
    });
  },

  handleCSVFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => this.processCSVText(e.target.result, file.name);
    reader.onerror = () => this.toast('Failed to read file', 'error');
    reader.readAsText(file);
  },

  processCSVText(text, sourceName) {
    console.log('[CSV Import] Raw text length:', text.length, 'First 100 chars:', JSON.stringify(text.substring(0, 100)));
    const { headers, rows } = CSVImporter.parseCSV(text);
    console.log('[CSV Import] Parsed:', headers.length, 'headers,', rows.length, 'rows');
    console.log('[CSV Import] Headers:', headers);

    if (headers.length === 0 || rows.length === 0) {
      console.warn('[CSV Import] No data found. Headers:', headers, 'Row count:', rows.length);
      this.toast('No data found in file. Check the format.', 'error');
      return;
    }

    const preset = document.getElementById('import-preset').value;
    const detectedFormat = preset === 'auto' ? CSVImporter.detectFormat(headers) : preset;
    const mapping = CSVImporter.autoMapColumns(headers, detectedFormat);

    this._csvState = { headers, rows, mapping, format: detectedFormat, sourceName };

    // Show preview
    document.getElementById('csv-preview-section').style.display = 'block';
    document.getElementById('csv-detected-format').textContent =
      '📋 Detected: ' + (CSVImporter.presets[detectedFormat]?.name || 'Generic CSV');
    document.getElementById('csv-row-count').textContent =
      `${rows.length} rows × ${headers.length} columns from "${sourceName}"`;

    this.renderColumnMapping(headers, mapping);
    this.renderCSVPreview(headers, rows);

    // Scroll to preview
    document.getElementById('csv-preview-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.toast(`Parsed ${rows.length} rows from "${sourceName}"`, 'info');
  },

  renderColumnMapping(headers, mapping) {
    const importType = document.querySelector('input[name="import-type"]:checked').value;
    const container = document.getElementById('column-mapping');

    let fields = [];
    switch (importType) {
      case 'accounts':
        fields = [
          { key: 'name', label: 'Account Name', required: true },
          { key: 'amount', label: 'Balance / Value', required: true },
          { key: 'category', label: 'Account Type', required: false },
        ];
        break;
      case 'transactions':
        fields = [
          { key: 'date', label: 'Date', required: true },
          { key: 'amount', label: 'Amount', required: true },
          { key: 'name', label: 'Description', required: false },
          { key: 'category', label: 'Category', required: false },
        ];
        break;
      case 'net-worth':
        fields = [
          { key: 'date', label: 'Date', required: true },
          { key: 'balance', label: 'Net Worth', required: true },
        ];
        break;
      case 'balance-history':
        fields = [
          { key: 'date', label: 'Date', required: true },
          { key: 'balance', label: 'Balance', required: true },
          { key: 'name', label: 'Account Name', required: false },
        ];
        break;
    }

    const opts = headers.map(h => `<option value="${h}">${h}</option>`).join('');

    container.innerHTML = fields.map(f => `
      <div class="form-group">
        <label>${f.label}${f.required ? ' *' : ''}</label>
        <select data-mapping-key="${f.key}">
          <option value="">— Select Column —</option>
          ${opts}
        </select>
      </div>
    `).join('');

    // Pre-select mapped columns
    container.querySelectorAll('select[data-mapping-key]').forEach(sel => {
      const key = sel.dataset.mappingKey;
      if (mapping[key]) sel.value = mapping[key];
    });

    // Update mapping on change
    container.querySelectorAll('select').forEach(sel => {
      sel.addEventListener('change', () => {
        const key = sel.dataset.mappingKey;
        this._csvState.mapping[key] = sel.value || null;
      });
    });
  },

  renderCSVPreview(headers, rows) {
    const headRow = document.getElementById('csv-preview-head');
    headRow.innerHTML = headers.map(h => `<th>${h}</th>`).join('');

    const body = document.getElementById('csv-preview-body');
    const previewRows = rows.slice(0, 10);
    body.innerHTML = previewRows.map(row =>
      '<tr>' + headers.map(h => `<td>${row[h] || ''}</td>`).join('') + '</tr>'
    ).join('');

    if (rows.length > 10) {
      body.innerHTML += `<tr><td colspan="${headers.length}" style="text-align:center;color:var(--text-muted)">... and ${rows.length - 10} more rows</td></tr>`;
    }
  },

  confirmImport() {
    const importType = document.querySelector('input[name="import-type"]:checked').value;
    const { headers, rows, mapping, sourceName } = this._csvState;
    const cur = this.data.settings.currency;

    let importCount = 0;

    switch (importType) {
      case 'accounts': {
        const accounts = CSVImporter.processAsHoldings(rows, mapping, headers);
        accounts.forEach(acc => {
          acc.id = Storage.generateId();
          this.data.accounts.assets.push(acc);
          importCount++;
        });
        this.toast(`✅ Imported ${importCount} accounts as assets`, 'success');
        break;
      }

      case 'transactions': {
        const txns = CSVImporter.processAsTransactions(rows, mapping);
        const { annualIncome, annualExpenses, dateRange } = CSVImporter.summarizeTransactions(txns);

        annualIncome.forEach(inc => {
          inc.id = Storage.generateId();
          this.data.income.push(inc);
          importCount++;
        });
        annualExpenses.forEach(exp => {
          exp.id = Storage.generateId();
          this.data.expenses.push(exp);
          importCount++;
        });

        this.toast(`✅ Imported ${annualIncome.length} income + ${annualExpenses.length} expense categories from ${txns.length} transactions`, 'success');
        break;
      }

      case 'net-worth': {
        const history = CSVImporter.processAsNetWorthHistory(rows, mapping, headers);
        const existingDates = new Set(this.data.history.map(h => h.date));
        history.forEach(entry => {
          if (!existingDates.has(entry.date)) {
            this.data.history.push(entry);
            importCount++;
          }
        });
        this.data.history.sort((a, b) => a.date.localeCompare(b.date));
        this.toast(`✅ Imported ${importCount} net worth snapshots`, 'success');
        break;
      }

      case 'balance-history': {
        const balHistory = CSVImporter.processAsBalanceHistory(rows, mapping);
        // Convert to net worth history entries
        balHistory.forEach(entry => {
          const existing = this.data.history.find(h => h.date === entry.date);
          if (existing) {
            // Update existing entry
          } else {
            this.data.history.push({
              date: entry.date,
              netWorth: entry.balance,
            });
            importCount++;
          }
        });
        this.data.history.sort((a, b) => a.date.localeCompare(b.date));
        this.toast(`✅ Imported ${importCount} balance history entries`, 'success');
        break;
      }
    }

    // Record import in history
    if (!this.data.importHistory) this.data.importHistory = [];
    this.data.importHistory.push({
      date: new Date().toISOString(),
      source: sourceName,
      type: importType,
      count: importCount
    });

    this.save();
    document.getElementById('csv-preview-section').style.display = 'none';
    this.refreshImportSync();
  },

  refreshImportSync() {
    this.refreshSnapshotTable();
    this.refreshImportHistory();
  },

  refreshSnapshotTable() {
    const history = this.data.history || [];
    const cur = this.data.settings.currency;
    const compact = this.data.settings.compact;

    // History chart
    Charts.renderNetWorthHistory('chart-nw-history', history);

    // History table
    const tbody = document.getElementById('snapshot-history-body');
    if (!history.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No snapshots recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = [...history].reverse().map(h => `
      <tr>
        <td style="text-align:left">${h.date}</td>
        <td>${Engine.formatCurrency(h.netWorth, cur, compact)}</td>
        <td>${h.assets ? Engine.formatCurrency(h.assets, cur, compact) : '—'}</td>
        <td>${h.liabilities ? Engine.formatCurrency(h.liabilities, cur, compact) : '—'}</td>
        <td><button class="btn btn-small btn-danger" data-delete-snapshot="${h.date}">✕</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('button[data-delete-snapshot]').forEach(btn => {
      btn.addEventListener('click', () => {
        const date = btn.dataset.deleteSnapshot;
        this.data.history = this.data.history.filter(h => h.date !== date);
        this.save();
        this.refreshSnapshotTable();
        this.toast('Snapshot removed.', 'info');
      });
    });
  },

  refreshImportHistory() {
    const container = document.getElementById('import-history-list');
    const imports = this.data.importHistory || [];

    if (!imports.length) {
      container.innerHTML = '<div class="empty-state" style="padding:24px"><p>No imports yet. Upload a CSV or paste data to get started.</p></div>';
      return;
    }

    container.innerHTML = [...imports].reverse().map(imp => {
      const date = new Date(imp.date);
      const typeLabels = { accounts: 'Accounts', transactions: 'Transactions', 'net-worth': 'Net Worth', 'balance-history': 'Balance History' };
      return `
        <div class="import-history-item">
          <div class="import-history-meta">
            <strong>${imp.source || 'Unknown'}</strong>
            <span class="import-history-badge ${imp.type}">${typeLabels[imp.type] || imp.type}</span>
            <span>${imp.count} items</span>
          </div>
          <span style="color:var(--text-muted);font-size:0.8rem">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
        </div>
      `;
    }).join('');
  },

  // ── Seed Demo Data ─────────────────────────────────
  bindSeedData() {
    document.getElementById('btn-seed-data').addEventListener('click', () => {
      if (confirm('This will replace all current data with comprehensive demo data. Continue?')) {
        this.data = this.getSeedData();
        this.save();
        this.applySettings();
        this.navigateTo('dashboard');
        this.toast('🎉 Demo data loaded! Explore the app to see everything in action.', 'success');
      }
    });
  },

  getSeedData() {
    const id = () => Storage.generateId();
    return {
      settings: {
        name: 'Alex Johnson',
        age: 32,
        retireAge: 55,
        lifeExpectancy: 92,
        defaultReturn: 7,
        defaultInflation: 3,
        taxRate: 24,
        currency: 'USD',
        darkMode: true,
        realValues: true,
        compact: false
      },
      accounts: {
        assets: [
          { id: id(), name: 'Checking Account', type: 'Checking', balance: 12500, growth: 0.5, monthlyContribution: 0 },
          { id: id(), name: 'High-Yield Savings', type: 'Savings', balance: 35000, growth: 4.5, monthlyContribution: 500 },
          { id: id(), name: 'Emergency Fund', type: 'Savings', balance: 25000, growth: 4.5, monthlyContribution: 0 },
          { id: id(), name: 'Vanguard 401(k)', type: '401(k)', balance: 185000, growth: 8, monthlyContribution: 1875 },
          { id: id(), name: 'Roth IRA — Fidelity', type: 'Roth IRA', balance: 62000, growth: 8.5, monthlyContribution: 583 },
          { id: id(), name: 'Traditional IRA (Rollover)', type: 'IRA', balance: 28000, growth: 7.5, monthlyContribution: 0 },
          { id: id(), name: 'HSA — Health Savings', type: 'HSA', balance: 14200, growth: 7, monthlyContribution: 300 },
          { id: id(), name: 'Taxable Brokerage — VTI/VXUS', type: 'Brokerage', balance: 95000, growth: 8, monthlyContribution: 1200 },
          { id: id(), name: 'Company RSUs (Vested)', type: 'Investment', balance: 45000, growth: 10, monthlyContribution: 0 },
          { id: id(), name: 'Bitcoin & Ethereum', type: 'Crypto', balance: 18000, growth: 12, monthlyContribution: 200 },
          { id: id(), name: 'Primary Residence', type: 'Real Estate', balance: 480000, growth: 3.5, monthlyContribution: 0 },
          { id: id(), name: 'Rental Property — Duplex', type: 'Real Estate', balance: 320000, growth: 3.5, monthlyContribution: 0 },
          { id: id(), name: '529 College Fund', type: 'Other', balance: 8500, growth: 7, monthlyContribution: 250 }
        ],
        liabilities: [
          { id: id(), name: 'Home Mortgage (30yr @ 3.25%)', type: 'Mortgage', balance: 345000, growth: 3.25, monthlyPayment: 2100 },
          { id: id(), name: 'Rental Property Mortgage', type: 'Mortgage', balance: 215000, growth: 3.75, monthlyPayment: 1450 },
          { id: id(), name: 'Student Loans — MBA', type: 'Student Loan', balance: 32000, growth: 4.5, monthlyPayment: 580 },
          { id: id(), name: 'Auto Loan — Tesla Model 3', type: 'Auto Loan', balance: 18500, growth: 3.9, monthlyPayment: 485 },
          { id: id(), name: 'Credit Card (Chase Sapphire)', type: 'Credit Card', balance: 2800, growth: 19.99, monthlyPayment: 800 }
        ]
      },
      income: [
        { id: id(), name: 'Software Engineer Salary', type: 'Salary', annual: 165000, growth: 4, startAge: null, endAge: 55 },
        { id: id(), name: 'Annual RSU Vesting', type: 'Salary', annual: 35000, growth: 5, startAge: null, endAge: 55 },
        { id: id(), name: 'Annual Performance Bonus', type: 'Salary', annual: 20000, growth: 3, startAge: null, endAge: 55 },
        { id: id(), name: 'Rental Property Income', type: 'Rental', annual: 28800, growth: 3, startAge: null, endAge: null },
        { id: id(), name: 'Freelance Consulting', type: 'Freelance', annual: 18000, growth: 2, startAge: null, endAge: 50 },
        { id: id(), name: 'Dividend Income', type: 'Dividends', annual: 3200, growth: 6, startAge: null, endAge: null },
        { id: id(), name: 'Social Security (estimated)', type: 'Social Security', annual: 24000, growth: 2, startAge: 67, endAge: null }
      ],
      expenses: [
        { id: id(), name: 'Mortgage Payment (Primary)', type: 'Housing', annual: 25200, growth: 0 },
        { id: id(), name: 'Property Taxes & Insurance', type: 'Housing', annual: 8400, growth: 3 },
        { id: id(), name: 'Home Maintenance & Repairs', type: 'Housing', annual: 4800, growth: 3 },
        { id: id(), name: 'Utilities & Internet', type: 'Housing', annual: 4200, growth: 3.5 },
        { id: id(), name: 'Groceries', type: 'Food', annual: 9600, growth: 4 },
        { id: id(), name: 'Dining Out & Takeout', type: 'Food', annual: 6000, growth: 4 },
        { id: id(), name: 'Auto Loan + Gas + Maintenance', type: 'Transportation', annual: 10200, growth: 3 },
        { id: id(), name: 'Health Insurance (Employee Share)', type: 'Healthcare', annual: 3600, growth: 6 },
        { id: id(), name: 'Out-of-Pocket Medical/Dental', type: 'Healthcare', annual: 2400, growth: 5 },
        { id: id(), name: 'Life & Disability Insurance', type: 'Insurance', annual: 1800, growth: 2 },
        { id: id(), name: 'Umbrella & Rental Insurance', type: 'Insurance', annual: 1200, growth: 2 },
        { id: id(), name: 'Streaming & Subscriptions', type: 'Subscriptions', annual: 2400, growth: 5 },
        { id: id(), name: 'Entertainment & Hobbies', type: 'Entertainment', annual: 4800, growth: 3 },
        { id: id(), name: 'Vacation & Travel', type: 'Travel', annual: 8000, growth: 4 },
        { id: id(), name: 'Clothing & Personal Care', type: 'Other', annual: 3000, growth: 3 },
        { id: id(), name: 'Childcare & Activities', type: 'Childcare', annual: 15600, growth: 4 },
        { id: id(), name: 'Pet Care (Dog)', type: 'Other', annual: 2400, growth: 4 },
        { id: id(), name: 'Gifts & Donations', type: 'Other', annual: 3600, growth: 2 },
        { id: id(), name: 'Miscellaneous / Buffer', type: 'Other', annual: 3600, growth: 3 }
      ],
      milestones: [
        { id: id(), name: 'Pay Off Student Loans', icon: '🎓', targetAmount: null, targetYear: 2031, notes: 'Aggressively pay off remaining MBA student loans' },
        { id: id(), name: 'Reach $500K Invested', icon: '📈', targetAmount: 500000, targetYear: 2029, notes: 'Half-million milestone in invested assets' },
        { id: id(), name: 'Pay Off Primary Mortgage', icon: '🏠', targetAmount: null, targetYear: 2040, notes: 'Own primary residence free and clear' },
        { id: id(), name: 'Reach $1M Net Worth', icon: '💰', targetAmount: 1000000, targetYear: 2032, notes: 'The big milestone — two-comma club!' },
        { id: id(), name: 'Coast FIRE Reached', icon: '🏖️', targetAmount: 750000, targetYear: 2033, notes: 'Enough invested that compounding alone covers retirement' },
        { id: id(), name: 'Kids College Fully Funded', icon: '👶', targetAmount: 200000, targetYear: 2044, notes: '529 plans fully funded for two children' },
        { id: id(), name: 'Reach $2M Invested', icon: '🔥', targetAmount: 2000000, targetYear: 2040, notes: 'FIRE target — financial independence achieved' },
        { id: id(), name: 'Early Retirement at 55', icon: '🏝️', targetAmount: 2500000, targetYear: 2049, notes: 'Leave full-time work and live on investment income' },
        { id: id(), name: 'Purchase Vacation Home', icon: '🎯', targetAmount: null, targetYear: 2038, notes: 'Buy a cabin in the mountains or beach house' },
        { id: id(), name: 'Reach $5M Legacy Goal', icon: '🎉', targetAmount: 5000000, targetYear: 2060, notes: 'Long-term legacy wealth for family and charity' }
      ],
      history: [
        { date: '2023-01-15', netWorth: 285000, assets: 620000, liabilities: 335000 },
        { date: '2023-04-15', netWorth: 310000, assets: 640000, liabilities: 330000 },
        { date: '2023-07-15', netWorth: 345000, assets: 670000, liabilities: 325000 },
        { date: '2023-10-15', netWorth: 360000, assets: 680000, liabilities: 320000 },
        { date: '2024-01-15', netWorth: 400000, assets: 710000, liabilities: 310000 },
        { date: '2024-04-15', netWorth: 430000, assets: 735000, liabilities: 305000 },
        { date: '2024-07-15', netWorth: 465000, assets: 760000, liabilities: 295000 },
        { date: '2024-10-15', netWorth: 490000, assets: 785000, liabilities: 295000 },
        { date: '2025-01-15', netWorth: 530000, assets: 820000, liabilities: 290000 },
        { date: '2025-04-15', netWorth: 560000, assets: 845000, liabilities: 285000 },
        { date: '2025-07-15', netWorth: 595000, assets: 870000, liabilities: 275000 },
        { date: '2025-10-15', netWorth: 625000, assets: 895000, liabilities: 270000 },
        { date: '2026-01-15', netWorth: 680000, assets: 935000, liabilities: 255000 },
        { date: '2026-03-15', netWorth: 715200, assets: 1328200, liabilities: 613300 }
      ]
    };
  },

  // ── Toast Notifications ────────────────────────────
  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

// ── Initialize App ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());

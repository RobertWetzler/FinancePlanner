/* =============================================
   Storage Module — localStorage persistence
   ============================================= */

const Storage = {
  KEY: 'ember_finances_data',
  OLD_KEY: 'projectionfinances_data',

  getDefaultData() {
    return {
      settings: {
        name: '',
        age: 30,
        retireAge: 65,
        lifeExpectancy: 90,
        defaultReturn: 7,
        defaultInflation: 3,
        taxRate: 25,
        capitalGainsRate: 15,
        stateTaxRate: 5,
        currency: 'USD',
        darkMode: true,
        realValues: true,
        compact: false
      },
      accounts: {
        assets: [],
        liabilities: []
      },
      income: [],
      expenses: [],
      milestones: [],
      lifeEvents: [],
      history: []  // net worth snapshots over time
    };
  },

  load() {
    try {
      let raw = localStorage.getItem(this.KEY);
      // Migrate from old key if new key is empty
      if (!raw && this.OLD_KEY) {
        raw = localStorage.getItem(this.OLD_KEY);
        if (raw) {
          localStorage.setItem(this.KEY, raw);
          localStorage.removeItem(this.OLD_KEY);
        }
      }
      if (raw) {
        const data = JSON.parse(raw);
        // Merge with defaults for forward compat
        const defaults = this.getDefaultData();
        return {
          settings: { ...defaults.settings, ...data.settings },
          accounts: {
            assets: data.accounts?.assets || [],
            liabilities: data.accounts?.liabilities || []
          },
          income: data.income || [],
          expenses: data.expenses || [],
          milestones: data.milestones || [],
          lifeEvents: data.lifeEvents || [],
          history: data.history || []
        };
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    }
    return this.getDefaultData();
  },

  save(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save data:', e);
    }
  },

  export(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ember_finances_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async import(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
        } catch (err) {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  },

  reset() {
    localStorage.removeItem(this.KEY);
    return this.getDefaultData();
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
};

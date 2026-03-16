/* =============================================
   CSV Importer — Parse & map CSV from any source
   ============================================= */

const CSVImporter = {

  // ── Known Format Presets ──────────────────────────
  presets: {
    'generic': {
      name: 'Generic CSV',
      description: 'Any CSV with date and amount columns',
      dateColumns: ['date', 'Date', 'DATE', 'transaction_date', 'Transaction Date', 'Posted Date', 'trade_date'],
      amountColumns: ['amount', 'Amount', 'AMOUNT', 'balance', 'Balance', 'BALANCE', 'value', 'Value', 'market_value', 'Market Value'],
      nameColumns: ['description', 'Description', 'DESCRIPTION', 'name', 'Name', 'memo', 'Memo', 'payee', 'Payee', 'Symbol', 'Account Name'],
      categoryColumns: ['category', 'Category', 'CATEGORY', 'type', 'Type', 'account_type', 'Account Type'],
    },
    'mint': {
      name: 'Mint (Intuit)',
      description: 'Exported from Mint before shutdown',
      dateCol: 'Date',
      amountCol: 'Amount',
      nameCol: 'Description',
      categoryCol: 'Category',
      typeCol: 'Transaction Type',
      isDebitCredit: true,
    },
    'empower': {
      name: 'Empower / Personal Capital',
      description: 'Downloaded from Empower Personal Dashboard',
      dateCol: 'Date',
      amountCol: 'Amount',
      nameCol: 'Description',
      categoryCol: 'Category',
      accountCol: 'Account',
    },
    'fidelity': {
      name: 'Fidelity',
      description: 'Fidelity Investments CSV export',
      dateCol: 'Date',
      amountCol: 'Amount ($)',
      nameCol: 'Description',
      symbolCol: 'Symbol',
      balanceCol: 'Balance',
      quantityCol: 'Quantity',
    },
    'vanguard': {
      name: 'Vanguard',
      description: 'Vanguard transaction or holdings export',
      dateCol: 'Trade Date',
      amountCol: 'Net Amount',
      nameCol: 'Investment Name',
      symbolCol: 'Symbol',
      accountCol: 'Account Number',
      sharesCol: 'Shares',
      priceCol: 'Share Price',
    },
    'schwab': {
      name: 'Charles Schwab',
      description: 'Schwab brokerage/checking CSV export',
      dateCol: 'Date',
      amountCol: 'Amount',
      nameCol: 'Description',
      typeCol: 'Type',
      statusCol: 'Status',
    },
    'bank-statement': {
      name: 'Bank Statement (Generic)',
      description: 'Checking/savings account CSV statement',
      dateCol: 'Date',
      amountCol: 'Amount',
      nameCol: 'Description',
      balanceCol: 'Balance',
    },
    'net-worth-history': {
      name: 'Net Worth History',
      description: 'CSV with dates and net worth snapshots',
      dateCol: 'Date',
      netWorthCol: 'Net Worth',
      assetsCol: 'Assets',
      liabilitiesCol: 'Liabilities',
    }
  },

  // ── Core CSV Parser ────────────────────────────────
  parseCSV(text) {
    // Normalize line endings and strip BOM
    let cleaned = text.replace(/^\uFEFF/, '');
    const lines = cleaned.trim().split(/\r?\n/);
    if (lines.length < 2) return { headers: [], rows: [] };

    // Handle quoted fields properly
    const parseLine = (line) => {
      const fields = [];
      let field = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          fields.push(field.trim());
          field = '';
        } else {
          field += ch;
        }
      }
      fields.push(field.trim());
      // Trim trailing empty fields (Fidelity adds trailing commas to data rows)
      while (fields.length > 1 && fields[fields.length - 1] === '') {
        fields.pop();
      }
      return fields;
    };

    // Skip empty leading lines
    let startIdx = 0;
    while (startIdx < lines.length && lines[startIdx].trim() === '') startIdx++;

    // Clean BOM from first line (belt-and-suspenders)
    let headerLine = lines[startIdx];
    if (headerLine.charCodeAt(0) === 0xFEFF) headerLine = headerLine.slice(1);

    const headers = parseLine(headerLine);
    const headerCount = headers.length;
    const rows = [];

    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Skip disclaimer / footer lines (Fidelity, Schwab, etc.)
      if (line.startsWith('"The data') || line.startsWith('"Brokerage') ||
          line.startsWith('"Date downloaded') || line.startsWith('"This data') ||
          line.startsWith('"Note:') || line.startsWith('"Transactions')) continue;

      const fields = parseLine(line);

      // Accept exact match OR rows that are close (±2 fields)
      // and pad/trim to match header count
      if (fields.length >= headerCount - 2 && fields.length <= headerCount + 2) {
        const row = {};
        headers.forEach((h, idx) => row[h] = (idx < fields.length) ? fields[idx] : '');
        rows.push(row);
      }
    }

    return { headers, rows };
  },

  // ── Auto-detect format ────────────────────────────
  detectFormat(headers) {
    const h = headers.map(x => x.toLowerCase());

    // Mint: has "Transaction Type" column
    if (h.includes('transaction type') && h.includes('category')) return 'mint';
    // Empower: has Account + Category columns
    if (h.includes('account') && h.includes('category') && h.includes('description')) return 'empower';
    // Fidelity: has "Current Value" or "Account Number" + "Symbol" combo or "Amount ($)" or "Run Date"
    if (h.includes('current value') && h.includes('symbol') && h.includes('account number')) return 'fidelity';
    if (headers.includes('Amount ($)') || h.includes('run date')) return 'fidelity';
    // Vanguard: has "Trade Date" and "Investment Name" (transactions), or "Investment Name" + "Total Value" (holdings)
    if (h.includes('investment name') && (h.includes('total value') || h.includes('share price'))) return 'vanguard';
    if (h.includes('trade date') && (h.includes('investment name') || h.includes('net amount'))) return 'vanguard';
    // Schwab: has specific type column values
    if (h.includes('status') && h.includes('type') && h.includes('description')) return 'schwab';
    // Net worth history: has explicit net worth column
    if (h.includes('net worth') || h.includes('networth') || h.includes('net_worth')) return 'net-worth-history';
    // Bank statement: has balance column
    if (h.includes('balance') && h.includes('date')) return 'bank-statement';

    return 'generic';
  },

  // ── Auto-detect column mapping ────────────────────
  autoMapColumns(headers, importType) {
    const mapping = { date: null, amount: null, name: null, category: null, balance: null };
    const h = headers.map(x => x.toLowerCase());

    // Date column
    const dateCandidates = ['date', 'posted date', 'transaction date', 'trade date', 'run date', 'settlement date'];
    for (const c of dateCandidates) {
      const idx = h.indexOf(c);
      if (idx >= 0) { mapping.date = headers[idx]; break; }
    }

    // Amount column
    const amtCandidates = ['current value', 'total value', 'amount', 'amount ($)', 'net amount', 'market value', 'value', 'total'];
    for (const c of amtCandidates) {
      const idx = h.indexOf(c);
      if (idx >= 0) { mapping.amount = headers[idx]; break; }
    }

    // Name/Description column
    const nameCandidates = ['description', 'investment name', 'symbol', 'name', 'payee', 'memo', 'account name', 'account'];
    for (const c of nameCandidates) {
      const idx = h.indexOf(c);
      if (idx >= 0) { mapping.name = headers[idx]; break; }
    }

    // Category column
    const catCandidates = ['category', 'type', 'account type', 'security type', 'transaction type'];
    for (const c of catCandidates) {
      const idx = h.indexOf(c);
      if (idx >= 0) { mapping.category = headers[idx]; break; }
    }

    // Balance column
    const balCandidates = ['balance', 'current value', 'total value', 'ending balance', 'running balance', 'net worth', 'networth', 'total balance', 'assets', 'current balance', 'cost basis total'];
    for (const c of balCandidates) {
      const idx = h.indexOf(c);
      if (idx >= 0) { mapping.balance = headers[idx]; break; }
    }

    return mapping;
  },

  // ── Parse dollar amounts robustly ─────────────────
  parseAmount(str) {
    if (!str || str === '--' || str === 'N/A' || str === '') return 0;
    // Remove currency symbols, commas, spaces, quotes
    const cleaned = str.replace(/[$€£¥,\s"']/g, '');
    // Handle parentheses for negatives: (500) => -500
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      return -parseFloat(cleaned.slice(1, -1)) || 0;
    }
    return parseFloat(cleaned) || 0;
  },

  // ── Parse dates robustly ──────────────────────────
  parseDate(str) {
    if (!str) return null;
    const cleaned = str.trim().replace(/"/g, '');

    // Try standard formats
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d;

    // Try MM/DD/YYYY
    const parts = cleaned.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const [a, b, c] = parts.map(Number);
      // MM/DD/YYYY
      if (a <= 12 && b <= 31 && c > 1900) return new Date(c, a - 1, b);
      // YYYY/MM/DD
      if (a > 1900) return new Date(a, b - 1, c);
      // DD/MM/YYYY
      if (b <= 12 && a <= 31 && c > 1900) return new Date(c, b - 1, a);
    }

    return null;
  },

  // ── Process rows into account-update or history ───
  processAsTransactions(rows, mapping, accountName, accountType) {
    const transactions = [];
    for (const row of rows) {
      const date = this.parseDate(row[mapping.date]);
      const amount = this.parseAmount(row[mapping.amount]);
      const name = row[mapping.name] || '';
      const category = row[mapping.category] || '';

      if (date) {
        transactions.push({ date, amount, name, category });
      }
    }
    return transactions.sort((a, b) => a.date - b.date);
  },

  processAsBalanceHistory(rows, mapping) {
    const history = [];
    for (const row of rows) {
      const date = this.parseDate(row[mapping.date]);
      const balance = this.parseAmount(row[mapping.balance] || row[mapping.amount]);

      if (date && balance !== 0) {
        history.push({
          date: date.toISOString().split('T')[0],
          balance
        });
      }
    }
    return history.sort((a, b) => a.date.localeCompare(b.date));
  },

  processAsNetWorthHistory(rows, mapping, headers) {
    const hLower = headers.map(x => x.toLowerCase());
    // Try to find assets and liabilities columns
    const assetsCol = headers[hLower.indexOf('assets')] || headers[hLower.indexOf('total assets')];
    const liabCol = headers[hLower.indexOf('liabilities')] || headers[hLower.indexOf('total liabilities')] || headers[hLower.indexOf('debts')];

    const history = [];
    for (const row of rows) {
      const date = this.parseDate(row[mapping.date]);
      let netWorth = this.parseAmount(row[mapping.balance]);
      const assets = assetsCol ? this.parseAmount(row[assetsCol]) : null;
      const liabilities = liabCol ? this.parseAmount(row[liabCol]) : null;

      // If no explicit net worth but have assets & liabilities, compute it
      if (!netWorth && assets !== null && liabilities !== null) {
        netWorth = assets - liabilities;
      }

      if (date && netWorth !== 0) {
        const entry = {
          date: date.toISOString().split('T')[0],
          netWorth,
        };
        if (assets !== null) entry.assets = assets;
        if (liabilities !== null) entry.liabilities = liabilities;
        history.push(entry);
      }
    }
    return history.sort((a, b) => a.date.localeCompare(b.date));
  },

  processAsHoldings(rows, mapping, headers) {
    const accounts = [];
    const seen = new Set();

    // For Fidelity-style CSVs, prefer Description over Symbol for display name
    // but use Symbol as a compact identifier
    const hasDescription = headers.map(x => x.toLowerCase()).includes('description');
    const hasSymbol = headers.map(x => x.toLowerCase()).includes('symbol');
    const hasAccountName = headers.map(x => x.toLowerCase()).includes('account name');

    for (const row of rows) {
      // Build a useful display name
      let name = row[mapping.name] || 'Unknown';
      // If the mapped name column gave us a short ticker, try to use Description instead
      if (hasDescription && hasSymbol && name.length <= 6) {
        const desc = row['Description'] || row['description'] || '';
        const symbol = row['Symbol'] || row['symbol'] || '';
        name = desc ? (symbol ? symbol + ' — ' + desc : desc) : name;
      }
      // Prefix with account name if multiple accounts present
      const acctName = hasAccountName ? (row['Account Name'] || row['account name'] || '') : '';

      const amount = this.parseAmount(row[mapping.amount] || row[mapping.balance]);
      const category = row[mapping.category] || acctName || 'Investment';

      // Skip zero-value or negligible holdings
      if (amount <= 0) continue;

      const key = name + '|' + (acctName || category);
      if (!seen.has(key)) {
        seen.add(key);
        accounts.push({
          name: acctName ? name + ' (' + acctName + ')' : name,
          balance: amount,
          type: this.inferAccountType(category + ' ' + acctName, name),
          growth: 7,
          monthlyContribution: 0
        });
      } else {
        // If duplicate, add to existing
        const existing = accounts.find(a => a.name === (acctName ? name + ' (' + acctName + ')' : name));
        if (existing) existing.balance += amount;
      }
    }
    return accounts;
  },

  // ── Infer account type from text ──────────────────
  inferAccountType(category, name) {
    const text = (category + ' ' + name).toLowerCase();
    if (text.includes('401k') || text.includes('401(k)')) return '401(k)';
    if (text.includes('roth')) return 'Roth IRA';
    if (text.includes('ira') || text.includes('rollover')) return 'IRA';
    if (text.includes('hsa')) return 'HSA';
    if (text.includes('529') || text.includes('college')) return 'Other';
    if (text.includes('checking')) return 'Checking';
    if (text.includes('saving') || text.includes('money market')) return 'Savings';
    if (text.includes('brokerage') || text.includes('individual') || text.includes('taxable')) return 'Brokerage';
    if (text.includes('real estate') || text.includes('property') || text.includes('home')) return 'Real Estate';
    if (text.includes('crypto') || text.includes('bitcoin') || text.includes('ethereum')) return 'Crypto';
    if (text.includes('mortgage')) return 'Mortgage';
    if (text.includes('student') || text.includes('loan')) return 'Student Loan';
    if (text.includes('auto') || text.includes('car')) return 'Auto Loan';
    if (text.includes('credit')) return 'Credit Card';
    return 'Investment';
  },

  // ── Infer expense category from text ──────────────
  inferExpenseCategory(category, name) {
    const text = (category + ' ' + name).toLowerCase();
    if (text.includes('rent') || text.includes('mortgage') || text.includes('housing')) return 'Housing';
    if (text.includes('grocer') || text.includes('food') || text.includes('restaurant') || text.includes('dining')) return 'Food';
    if (text.includes('gas') || text.includes('auto') || text.includes('car') || text.includes('uber') || text.includes('lyft') || text.includes('transit')) return 'Transportation';
    if (text.includes('health') || text.includes('medical') || text.includes('doctor') || text.includes('pharm')) return 'Healthcare';
    if (text.includes('insur')) return 'Insurance';
    if (text.includes('entertain') || text.includes('movie') || text.includes('game')) return 'Entertainment';
    if (text.includes('travel') || text.includes('hotel') || text.includes('flight') || text.includes('airline')) return 'Travel';
    if (text.includes('subscri') || text.includes('netflix') || text.includes('spotify') || text.includes('streaming')) return 'Subscriptions';
    if (text.includes('child') || text.includes('daycare') || text.includes('school')) return 'Childcare';
    if (text.includes('education') || text.includes('tuition') || text.includes('course')) return 'Education';
    return 'Other';
  },

  // ── Summarize transactions into annual income/expenses ─
  summarizeTransactions(transactions) {
    const income = {};
    const expenses = {};

    for (const t of transactions) {
      const year = t.date.getFullYear();
      const cat = t.category || 'Other';
      const key = cat;

      if (t.amount > 0) {
        if (!income[key]) income[key] = { name: cat, total: 0, count: 0 };
        income[key].total += t.amount;
        income[key].count++;
      } else {
        if (!expenses[key]) expenses[key] = { name: cat, total: 0, count: 0 };
        expenses[key].total += Math.abs(t.amount);
        expenses[key].count++;
      }
    }

    // Annualize based on date range
    const dates = transactions.map(t => t.date).filter(Boolean);
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const yearSpan = Math.max((maxDate - minDate) / (365.25 * 86400000), 1 / 12);

    const annualIncome = Object.values(income).map(i => ({
      name: i.name,
      annual: Math.round(i.total / yearSpan),
      type: 'Other',
      growth: 3
    }));

    const annualExpenses = Object.values(expenses).map(e => ({
      name: e.name,
      annual: Math.round(e.total / yearSpan),
      type: this.inferExpenseCategory(e.name, e.name),
      growth: 3
    }));

    return { annualIncome, annualExpenses, dateRange: { from: minDate, to: maxDate } };
  }
};

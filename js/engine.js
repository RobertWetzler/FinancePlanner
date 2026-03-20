/* =============================================
   Financial Engine — Projections, FIRE, Monte Carlo
   ============================================= */

const Engine = {

  // ── Account Tax Bucket Classification ─────────────
  BUCKET_TAX_DEFERRED: 'tax-deferred',  // 401(k), Traditional IRA — penalty before 59.5
  BUCKET_TAX_FREE: 'tax-free',          // Roth IRA — contributions accessible, earnings penalized before 59.5
  BUCKET_TAXABLE: 'taxable',            // Brokerage, Checking, Savings, Crypto — fully accessible
  BUCKET_RESTRICTED: 'restricted',      // HSA — penalty for non-medical before 65
  BUCKET_REAL_ASSETS: 'real-assets',    // Real Estate — illiquid

  PENALTY_FREE_AGE: 59.5,
  HSA_PENALTY_FREE_AGE: 65,

  classifyAccount(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('401') || t === 'ira' || t.includes('traditional')) return this.BUCKET_TAX_DEFERRED;
    if (t.includes('roth')) return this.BUCKET_TAX_FREE;
    if (t.includes('hsa')) return this.BUCKET_RESTRICTED;
    if (t.includes('real estate')) return this.BUCKET_REAL_ASSETS;
    // Taxable: checking, savings, brokerage, crypto, investment, other
    return this.BUCKET_TAXABLE;
  },

  // Get starting balances by bucket
  getBucketBalances(data) {
    const buckets = {
      [this.BUCKET_TAXABLE]: 0,
      [this.BUCKET_TAX_DEFERRED]: 0,
      [this.BUCKET_TAX_FREE]: 0,
      [this.BUCKET_RESTRICTED]: 0,
      [this.BUCKET_REAL_ASSETS]: 0,
    };
    (data.accounts.assets || []).forEach(a => {
      const bucket = this.classifyAccount(a.type);
      buckets[bucket] += (a.balance || 0);
    });
    return buckets;
  },

  // Get monthly contributions by bucket
  getBucketContributions(data) {
    const buckets = {
      [this.BUCKET_TAXABLE]: 0,
      [this.BUCKET_TAX_DEFERRED]: 0,
      [this.BUCKET_TAX_FREE]: 0,
      [this.BUCKET_RESTRICTED]: 0,
      [this.BUCKET_REAL_ASSETS]: 0,
    };
    (data.accounts.assets || []).forEach(a => {
      const bucket = this.classifyAccount(a.type);
      buckets[bucket] += (a.monthlyContribution || 0) * 12;
    });
    return buckets;
  },

  // Compute accessible (penalty-free) balance at a given age
  getAccessibleBalance(buckets, age) {
    let accessible = buckets[this.BUCKET_TAXABLE] || 0;
    // Roth contributions are always accessible (we estimate ~60% of Roth balance is contributions)
    accessible += (buckets[this.BUCKET_TAX_FREE] || 0) * (age >= this.PENALTY_FREE_AGE ? 1.0 : 0.6);
    // Tax-deferred only after 59.5
    if (age >= this.PENALTY_FREE_AGE) accessible += buckets[this.BUCKET_TAX_DEFERRED] || 0;
    // HSA after 65 (any purpose) — before 65 only for medical
    if (age >= this.HSA_PENALTY_FREE_AGE) accessible += buckets[this.BUCKET_RESTRICTED] || 0;
    // Real assets are illiquid but count toward net worth
    // We include a fraction as theoretically sellable
    accessible += (buckets[this.BUCKET_REAL_ASSETS] || 0) * 0.3;
    return accessible;
  },

  // ── Tax Estimation ─────────────────────────────────
  // Effective combined tax rate on earned income
  getIncomeTaxRate(data) {
    const s = data.settings;
    const federal = (s.taxRate || 25) / 100;
    const state = (s.stateTaxRate || 0) / 100;
    // State is deductible from federal up to SALT cap, but simplified here
    return Math.min(federal + state, 0.50);
  },

  // Capital gains rate for taxable account growth
  getCapGainsRate(data) {
    const s = data.settings;
    return (s.capitalGainsRate || 15) / 100;
  },

  // Annual tax drag on taxable accounts for buy-and-hold investors.
  // Only dividends/distributions are taxed each year — unrealized gains are NOT.
  // Broad index ETFs (VTI, VXUS) yield ~1.5-2% in dividends.
  // That dividend income is taxed at the qualified dividend / cap gains rate.
  // So tax drag ≈ dividendYield × taxRate, NOT totalReturn × taxRate.
  getTaxableDragRate(data) {
    const cgRate = this.getCapGainsRate(data);
    const estimatedDividendYield = 0.018; // ~1.8% for total market index ETFs
    // Tax drag as fraction of total return (used to reduce growth)
    // e.g. if return is 8% and dividend yield is 1.8% taxed at 15%:
    //   drag = 1.8% × 15% = 0.27% annual drag on the balance
    // Expressed as fraction of return: 0.27% / 8% ≈ 0.034
    // But we apply it to the growth amount, so just return yield × rate
    return estimatedDividendYield * cgRate;
  },

  // Tax-adjusted FIRE number: how much you ACTUALLY need given the tax
  // on withdrawals from different account types.
  // Uses PROJECTED account mix at FIRE date, not current mix.
  computeTaxAdjustedFIRENumber(annualExpenses, swr, data, nominalReturn, inflationRate) {
    const baseNumber = this.computeFIRENumber(annualExpenses, swr);
    if (!data) return baseNumber;

    const incomeTax = this.getIncomeTaxRate(data);
    const cgRate = this.getCapGainsRate(data);

    // First, estimate when we'd hit base FIRE number to get projected mix at that date
    const ret = nominalReturn || data.settings.defaultReturn || 7;
    const inf = inflationRate || data.settings.defaultInflation || 3;
    const proj = this.projectNetWorth(data, 60, ret, inf, false);

    // Find the year we'd roughly hit the base number
    let fireYearIdx = proj.findIndex(p => p.netWorth >= baseNumber);
    if (fireYearIdx < 0) fireYearIdx = Math.min(30, proj.length - 1); // fallback to 30 years out

    const atFire = proj[fireYearIdx];
    const total = (atFire.taxable + atFire.taxDeferred + atFire.taxFree + atFire.restricted + atFire.realAssets) || 1;

    // Weight the tax hit by PROJECTED account mix at FIRE date
    const taxDeferredPct = atFire.taxDeferred / total;
    const taxablePct = atFire.taxable / total;
    const rothPct = atFire.taxFree / total;
    const hsaPct = atFire.restricted / total;
    const realPct = atFire.realAssets / total;

    // For taxable: after decades of growth, cost basis is a small fraction of value
    // Gains portion grows over time: ~60-80% gains after 20+ years
    const yearsGrowing = Math.max(fireYearIdx, 5);
    const gainsFraction = Math.min(1 - (1 / Math.pow(1 + ret / 100, yearsGrowing)), 0.85);

    const blendedTaxRate =
      taxDeferredPct * incomeTax +               // 401k/IRA: full income tax
      taxablePct * (cgRate * gainsFraction) +     // Taxable: cap gains on gains portion only
      rothPct * 0 +                               // Roth: tax-free
      hsaPct * 0.05 +                             // HSA: mostly medical, small tax
      realPct * (cgRate * 0.3);                   // Real estate: some gains if sold

    // You need MORE money because withdrawals are taxed
    const taxMultiplier = 1 / (1 - blendedTaxRate);

    return baseNumber * taxMultiplier;
  },

  // Net income after tax for a given gross income
  getNetIncome(grossIncome, data) {
    const taxRate = this.getIncomeTaxRate(data);
    return grossIncome * (1 - taxRate);
  },

  // ── Life Events: House Purchase Helpers ────────────
  getHouseEvents(data) {
    return (data.lifeEvents || []).filter(e => e.type === 'house' && e.enabled !== false);
  },

  getAllHouseEvents(data) {
    return (data.lifeEvents || []).filter(e => e.type === 'house');
  },

  // Calculate annual house costs for a given year
  getHouseCostsAtYear(house, year, purchaseYear) {
    const yearsOwned = year - purchaseYear;
    if (yearsOwned < 0) return null; // not yet purchased

    const homeValue = house.homePrice * Math.pow(1 + (house.appreciation || 3) / 100, yearsOwned);
    const propertyTax = homeValue * (house.propertyTaxRate || 1.1) / 100;
    const insurance = (house.annualInsurance || 1800) * Math.pow(1.03, yearsOwned);
    const maintenance = homeValue * (house.maintenanceRate || 1) / 100;
    const hoa = (house.monthlyHOA || 0) * 12 * Math.pow(1.03, yearsOwned);

    // Mortgage: fixed payment, calculate remaining balance
    const mortgageAmount = house.homePrice - (house.downPayment || 0);
    const monthlyRate = (house.mortgageRate || 6.5) / 100 / 12;
    const totalMonths = (house.mortgageTerm || 30) * 12;
    const monthlyPayment = monthlyRate > 0
      ? mortgageAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1)
      : mortgageAmount / totalMonths;
    const annualMortgage = monthlyPayment * 12;

    // Remaining mortgage balance after yearsOwned
    const monthsElapsed = Math.min(yearsOwned * 12, totalMonths);
    let remainingBalance = mortgageAmount;
    if (monthlyRate > 0) {
      remainingBalance = mortgageAmount * (Math.pow(1 + monthlyRate, totalMonths) - Math.pow(1 + monthlyRate, monthsElapsed))
        / (Math.pow(1 + monthlyRate, totalMonths) - 1);
    } else {
      remainingBalance = Math.max(0, mortgageAmount - monthlyPayment * monthsElapsed);
    }
    if (monthsElapsed >= totalMonths) remainingBalance = 0;

    // Mortgage interest vs principal (for the current year)
    const interestThisYear = remainingBalance * (house.mortgageRate || 6.5) / 100;
    const principalThisYear = Math.min(annualMortgage - interestThisYear, remainingBalance);

    // Rent savings (what you'd pay if renting instead)
    const rentSaved = (house.currentRent || 0) * 12 * Math.pow(1 + (house.rentGrowth || 3) / 100, yearsOwned);

    return {
      homeValue,
      propertyTax,
      insurance,
      maintenance,
      hoa,
      annualMortgage: remainingBalance > 0 ? annualMortgage : 0,
      interestThisYear: remainingBalance > 0 ? interestThisYear : 0,
      principalThisYear: remainingBalance > 0 ? principalThisYear : 0,
      remainingBalance: Math.max(0, remainingBalance),
      rentSaved,
      // Total annual cost of ownership (excluding principal which builds equity)
      totalOwnershipCost: propertyTax + insurance + maintenance + hoa + (remainingBalance > 0 ? interestThisYear : 0),
      // Net extra cost compared to renting
      netCostVsRent: propertyTax + insurance + maintenance + hoa + (remainingBalance > 0 ? annualMortgage : 0) - rentSaved,
      equity: homeValue - Math.max(0, remainingBalance),
    };
  },

  // ── Net Worth Projection (with bucket tracking) ───
  projectNetWorth(data, years, nominalReturn, inflationRate, useReal) {
    const s = data.settings;
    const currentAge = s.age;
    const totalAssets = data.accounts.assets.reduce((sum, a) => sum + (a.balance || 0), 0);
    const totalLiabilities = data.accounts.liabilities.reduce((sum, a) => sum + (a.balance || 0), 0);
    let netWorth = totalAssets - totalLiabilities;

    const realReturn = (1 + nominalReturn / 100) / (1 + inflationRate / 100) - 1;
    const effectiveReturn = useReal ? realReturn : nominalReturn / 100;

    // Track buckets
    const buckets = this.getBucketBalances(data);
    const annualContribs = this.getBucketContributions(data);

    // Tax rates
    const incomeTaxRate = this.getIncomeTaxRate(data);
    const taxDrag = this.getTaxableDragRate(data);

    const projections = [];
    let cumulativeInflation = 1;
    let investableAssets = totalAssets;

    // ── Life Events: Pre-process house purchases ────
    const houses = this.getHouseEvents(data);
    const currentYear = new Date().getFullYear();
    let totalMortgageBalance = 0;
    let totalHomeEquity = 0;
    let houseAnnualCosts = 0;    // non-equity costs (tax, insurance, maintenance, interest)
    let houseMortgagePayments = 0; // total mortgage payments (principal + interest)
    let houseRentSaved = 0;
    const lifeEventAnnotations = []; // for chart annotations

    // Helper: get income/expenses active at a given age, with per-stream growth
    // Supports fractional ages and gap periods (sabbaticals)
    const getIncomeAtAge = (age, yearsFromNow) => {
      const projYear = currentYear + yearsFromNow;
      return data.income.reduce((sum, i) => {
        const start = i.startAge || 0;
        const end = i.endAge || 999;
        if (age < start || age > end) return sum;

        const grown = (i.annual || 0) * Math.pow(1 + (i.growth || 0) / 100, yearsFromNow);

        // Check gap periods — calculate what fraction of this year is active
        if (i.gaps && i.gaps.length > 0) {
          let totalGapFraction = 0;
          for (const gap of i.gaps) {
            if (gap.start && gap.end) {
              const [gsY, gsM] = gap.start.split('-').map(Number);
              const [geY, geM] = gap.end.split('-').map(Number);
              const gapStartFrac = gsY + (gsM - 1) / 12;
              const gapEndFrac = geY + (geM - 1) / 12;
              // How much of this projection year overlaps with the gap?
              const overlapStart = Math.max(gapStartFrac, projYear);
              const overlapEnd = Math.min(gapEndFrac, projYear + 1);
              if (overlapStart < overlapEnd) {
                totalGapFraction += (overlapEnd - overlapStart);
              }
            }
          }
          const activeFraction = Math.max(0, 1 - totalGapFraction);
          return sum + grown * activeFraction;
        }

        return sum + grown;
      }, 0);
    };

    const getExpensesAtAge = (age, yearsFromNow) => {
      return data.expenses.reduce((sum, e) => {
        const grown = (e.annual || 0) * Math.pow(1 + (e.growth || 0) / 100, yearsFromNow);
        return sum + grown;
      }, 0);
    };

    for (let y = 0; y <= years; y++) {
      const age = currentAge + y;
      const projYear = currentYear + y;
      const grossIncome = getIncomeAtAge(age, y);
      const incomeTax = grossIncome * incomeTaxRate;
      const netIncome = grossIncome - incomeTax;
      const nominalExpenses = getExpensesAtAge(age, y);

      // ── House events for this year ────
      houseAnnualCosts = 0;
      houseMortgagePayments = 0;
      houseRentSaved = 0;
      totalMortgageBalance = 0;
      totalHomeEquity = 0;

      for (const house of houses) {
        const purchaseYear = house.purchaseYear || currentYear;
        if (projYear < purchaseYear) continue;

        // On purchase year: deduct down payment + closing costs
        if (projYear === purchaseYear && y > 0) {
          const downPayment = house.downPayment || 0;
          const closingCosts = (house.closingCosts || house.homePrice * 0.03);
          const totalUpfront = downPayment + closingCosts;
          buckets[this.BUCKET_TAXABLE] = Math.max(0, (buckets[this.BUCKET_TAXABLE] || 0) - totalUpfront);
          lifeEventAnnotations.push({ year: projYear, icon: '🏠', label: house.name || 'Home Purchase' });
        }

        const costs = this.getHouseCostsAtYear(house, projYear, purchaseYear);
        if (costs) {
          // Non-mortgage ownership costs (property tax, insurance, maintenance, HOA)
          // We do NOT include interest here — it's already in the mortgage payment
          houseAnnualCosts += costs.propertyTax + costs.insurance + costs.maintenance + costs.hoa;
          houseMortgagePayments += costs.annualMortgage;
          houseRentSaved += costs.rentSaved;
          totalMortgageBalance += costs.remainingBalance;
          totalHomeEquity += costs.equity;
        }
      }

      // Net house impact on cash flow:
      // Total cash out = mortgage payment + non-mortgage ownership costs
      // Net impact = cash out - rent no longer paying
      const houseCashOutflow = houseMortgagePayments + houseAnnualCosts;
      const houseNetCashImpact = houseCashOutflow - houseRentSaved;

      const totalExpensesWithHouse = nominalExpenses + houseNetCashImpact;
      const netSavings = netIncome - totalExpensesWithHouse;

      // Investment returns — during accumulation (buy & hold), only dividends are taxed
      // Unrealized cap gains are deferred until sale (withdrawal in FIRE)
      const totalReturns = investableAssets * effectiveReturn;
      const taxableBalance = buckets[this.BUCKET_TAXABLE] || 0;
      const dividendTax = taxableBalance * taxDrag; // taxDrag = dividendYield × capGainsRate
      const netReturns = totalReturns - dividendTax;

      const accessible = this.getAccessibleBalance(buckets, age);

      const divider = useReal ? cumulativeInflation : 1;
      projections.push({
        year: projYear,
        age,
        grossIncome: grossIncome / divider,
        incomeTax: incomeTax / divider,
        income: netIncome / divider,
        expenses: totalExpensesWithHouse / divider,
        baseExpenses: nominalExpenses / divider,
        houseCosts: houseNetCashImpact / divider,
        savings: netSavings / divider,
        investmentReturns: netReturns / divider,
        investmentTax: dividendTax / divider,
        totalTax: (incomeTax + dividendTax) / divider,
        netWorth: (netWorth + totalHomeEquity) / divider,
        assets: (investableAssets + totalHomeEquity) / divider,
        liabilities: (totalLiabilities * Math.pow(0.97, y) + totalMortgageBalance) / divider,
        // Bucket data (home equity goes into real assets)
        taxable: (buckets[this.BUCKET_TAXABLE] || 0) / divider,
        taxDeferred: (buckets[this.BUCKET_TAX_DEFERRED] || 0) / divider,
        taxFree: (buckets[this.BUCKET_TAX_FREE] || 0) / divider,
        restricted: (buckets[this.BUCKET_RESTRICTED] || 0) / divider,
        realAssets: ((buckets[this.BUCKET_REAL_ASSETS] || 0) + totalHomeEquity) / divider,
        accessible: accessible / divider,
        // Life event data
        homeEquity: totalHomeEquity / divider,
        mortgageBalance: totalMortgageBalance / divider,
        lifeEvents: lifeEventAnnotations.filter(a => a.year === projYear),
      });

      if (y < years) {
        // Grow each bucket with tax drag applied to taxable
        const growthRate = nominalReturn / 100;
        for (const key of Object.keys(buckets)) {
          if (key === this.BUCKET_TAXABLE) {
            // Taxable: full growth, minus dividend tax (small drag on balance)
            const grossGrowth = buckets[key] * growthRate;
            const divTax = buckets[key] * taxDrag; // dividend yield × tax rate
            buckets[key] = buckets[key] + grossGrowth - divTax + (annualContribs[key] || 0);
          } else {
            // Tax-sheltered buckets: grow tax-free
            buckets[key] = buckets[key] * (1 + growthRate) + (annualContribs[key] || 0);
          }
        }
        // Excess savings beyond account contributions go to taxable
        const totalAccountContribs = Object.values(annualContribs).reduce((s, v) => s + v, 0);
        const extraSavings = netSavings - totalAccountContribs;
        if (extraSavings > 0) {
          buckets[this.BUCKET_TAXABLE] += extraSavings;
        } else if (extraSavings < 0) {
          buckets[this.BUCKET_TAXABLE] = Math.max(0, buckets[this.BUCKET_TAXABLE] + extraSavings);
        }

        investableAssets = Object.values(buckets).reduce((s, v) => s + v, 0);
        netWorth = investableAssets - totalLiabilities * Math.pow(0.97, y + 1);
        cumulativeInflation *= (1 + inflationRate / 100);
      }
    }

    return projections;
  },

  // ── FIRE Calculations ──────────────────────────────
  calculateFIRE(data) {
    const s = data.settings;
    const currentAge = s.age;
    const totalAssets = data.accounts.assets.reduce((sum, a) => sum + (a.balance || 0), 0);
    const totalLiabilities = data.accounts.liabilities.reduce((sum, a) => sum + (a.balance || 0), 0);
    const currentNetWorth = totalAssets - totalLiabilities;
    const investedAssets = totalAssets;

    const incomeTaxRate = this.getIncomeTaxRate(data);

    // Income/expenses at current age only (for dashboard display)
    const grossIncome = data.income.reduce((sum, i) => {
      const start = i.startAge || 0;
      const end = i.endAge || 999;
      if (currentAge < start || currentAge > end) return sum;
      return sum + (i.annual || 0);
    }, 0);
    const annualIncomeTax = grossIncome * incomeTaxRate;
    const annualIncome = grossIncome - annualIncomeTax;
    const annualExpenses = data.expenses.reduce((sum, e) => sum + (e.annual || 0), 0);
    const annualSavings = annualIncome - annualExpenses;
    const savingsRate = grossIncome > 0 ? (annualSavings / grossIncome) * 100 : 0;

    return {
      currentNetWorth,
      investedAssets,
      totalAssets,
      totalLiabilities,
      grossIncome,
      annualIncomeTax,
      annualIncome,
      annualExpenses,
      annualSavings,
      savingsRate,
      currentAge,
      effectiveTaxRate: grossIncome > 0 ? (annualIncomeTax / grossIncome) * 100 : 0
    };
  },

  // Helper: compute net savings at a given age for a dataset (after income tax)
  // Supports gap periods for sabbaticals
  _getSavingsAtAge(data, age, yearsFromNow) {
    const currentYear = new Date().getFullYear();
    const projYear = currentYear + yearsFromNow;
    const grossIncome = data.income.reduce((sum, i) => {
      const start = i.startAge || 0;
      const end = i.endAge || 999;
      if (age < start || age > end) return sum;

      const grown = (i.annual || 0) * Math.pow(1 + (i.growth || 0) / 100, yearsFromNow);

      // Check gap periods — calculate what fraction of this year is active
      if (i.gaps && i.gaps.length > 0) {
        let totalGapFraction = 0;
        for (const gap of i.gaps) {
          if (gap.start && gap.end) {
            const [gsY, gsM] = gap.start.split('-').map(Number);
            const [geY, geM] = gap.end.split('-').map(Number);
            const gapStartFrac = gsY + (gsM - 1) / 12;
            const gapEndFrac = geY + (geM - 1) / 12;
            const overlapStart = Math.max(gapStartFrac, projYear);
            const overlapEnd = Math.min(gapEndFrac, projYear + 1);
            if (overlapStart < overlapEnd) {
              totalGapFraction += (overlapEnd - overlapStart);
            }
          }
        }
        const activeFraction = Math.max(0, 1 - totalGapFraction);
        return sum + grown * activeFraction;
      }

      return sum + grown;
    }, 0);
    const expenses = data.expenses.reduce((sum, e) => {
      return sum + (e.annual || 0) * Math.pow(1 + (e.growth || 0) / 100, yearsFromNow);
    }, 0);
    const netIncome = grossIncome * (1 - this.getIncomeTaxRate(data));
    return netIncome - expenses;
  },

  computeFIRENumber(annualExpenses, swr) {
    if (swr <= 0) return Infinity;
    return annualExpenses / (swr / 100);
  },

  yearsToFIRE(currentInvested, fireNumber, nominalReturn, inflationRate, data) {
    if (currentInvested >= fireNumber) return 0;
    if (!data) return Infinity;

    // Use full projection engine for consistency with accessible FIRE calc
    const proj = this.projectNetWorth(data, 80, nominalReturn, inflationRate, false);
    for (let y = 0; y < proj.length; y++) {
      if ((proj[y].assets || 0) >= fireNumber) return y;
    }
    return Infinity;
  },

  // Years until ACCESSIBLE (penalty-free) balance hits FIRE number
  yearsToAccessibleFIRE(fireNumber, nominalReturn, inflationRate, data) {
    if (!data) return Infinity;
    // Run full projection with bucket tracking to get accessible balance each year
    const proj = this.projectNetWorth(data, 80, nominalReturn, inflationRate, false);
    for (let y = 0; y < proj.length; y++) {
      if ((proj[y].accessible || 0) >= fireNumber) return y;
    }
    return Infinity;
  },

  fireProjection(currentInvested, fireNumber, nominalReturn, inflationRate, maxYears, data) {
    const currentAge = data ? data.settings.age : 30;
    const realReturn = (1 + nominalReturn / 100) / (1 + inflationRate / 100) - 1;
    const points = [{ year: 0, balance: currentInvested, fireNumber }];
    let balance = currentInvested;

    for (let y = 1; y <= maxYears; y++) {
      const age = currentAge + y;
      const savings = data ? this._getSavingsAtAge(data, age, y) : 0;
      balance = balance * (1 + realReturn) + savings;
      points.push({ year: y, balance, fireNumber });
    }
    return points;
  },

  // ── FIRE Variants ─────────────────────────────────
  computeFIREVariants(swr) {
    return {
      lean: this.computeFIRENumber(30000, swr),
      regular: this.computeFIRENumber(50000, swr),
      fat: this.computeFIRENumber(100000, swr),
      barista: this.computeFIRENumber(25000, swr),  // partial coverage
      coast: 0  // computed differently
    };
  },

  computeCoastFIRE(targetAge, currentAge, targetAmount, nominalReturn, inflationRate) {
    const realReturn = (1 + nominalReturn / 100) / (1 + inflationRate / 100) - 1;
    const years = targetAge - currentAge;
    if (years <= 0 || realReturn <= 0) return targetAmount;
    return targetAmount / Math.pow(1 + realReturn, years);
  },

  // ── Monte Carlo Simulation ────────────────────────
  runMonteCarlo(startBalance, annualContribution, annualWithdrawal, years, trials, meanReturn, stdDev, data) {
    const results = [];
    const hasData = data && data.income && data.settings;
    const currentAge = hasData ? data.settings.age : 30;

    for (let t = 0; t < trials; t++) {
      const path = [startBalance];
      let balance = startBalance;
      let failed = false;

      for (let y = 1; y <= years; y++) {
        // Generate random return using Box-Muller
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const annualReturn = (meanReturn / 100) + (stdDev / 100) * z;

        // Use age-aware savings if data is available
        const contribution = hasData ? this._getSavingsAtAge(data, currentAge + y, y) : annualContribution;

        balance = balance * (1 + annualReturn) + contribution - annualWithdrawal;

        if (balance < 0) {
          balance = 0;
          failed = true;
        }
        path.push(balance);
      }

      results.push({ path, finalBalance: balance, failed });
    }

    // Compute statistics
    const finalBalances = results.map(r => r.finalBalance).sort((a, b) => a - b);
    const successCount = results.filter(r => !r.failed && r.finalBalance > 0).length;

    const percentile = (arr, p) => {
      const idx = Math.floor(arr.length * p);
      return arr[Math.min(idx, arr.length - 1)];
    };

    return {
      trials: results,
      successRate: (successCount / trials) * 100,
      median: percentile(finalBalances, 0.5),
      p10: percentile(finalBalances, 0.1),
      p25: percentile(finalBalances, 0.25),
      p75: percentile(finalBalances, 0.75),
      p90: percentile(finalBalances, 0.9),
      mean: finalBalances.reduce((a, b) => a + b, 0) / finalBalances.length,
      min: finalBalances[0],
      max: finalBalances[finalBalances.length - 1],
      paths: {
        p10: this._getPercentilePath(results, years, 0.1),
        p25: this._getPercentilePath(results, years, 0.25),
        p50: this._getPercentilePath(results, years, 0.5),
        p75: this._getPercentilePath(results, years, 0.75),
        p90: this._getPercentilePath(results, years, 0.9),
      }
    };
  },

  _getPercentilePath(results, years, percentile) {
    const path = [];
    for (let y = 0; y <= years; y++) {
      const values = results.map(r => r.path[y]).sort((a, b) => a - b);
      const idx = Math.floor(values.length * percentile);
      path.push(values[Math.min(idx, values.length - 1)]);
    }
    return path;
  },

  // ── Utility Functions ─────────────────────────────
  formatCurrency(amount, currency = 'USD', compact = false) {
    if (amount === Infinity || amount === -Infinity) return '∞';
    if (isNaN(amount)) return '$0';

    const symbols = { USD: '$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$' };
    const sym = symbols[currency] || '$';

    if (compact && Math.abs(amount) >= 1e6) {
      return sym + (amount / 1e6).toFixed(1) + 'M';
    }
    if (compact && Math.abs(amount) >= 1e3) {
      return sym + (amount / 1e3).toFixed(0) + 'K';
    }

    return sym + Math.round(amount).toLocaleString('en-US');
  },

  formatPercent(value) {
    if (isNaN(value) || !isFinite(value)) return '—';
    return value.toFixed(1) + '%';
  }
};

/* =============================================================
   Ember Finances — Engine Test Suite
   Comprehensive tests for financial calculations accuracy
   
   Run: node tests/engine.test.js
   ============================================================= */

// Load the engine
const fs = require('fs');
const code = fs.readFileSync(__dirname + '/../js/engine.js', 'utf8');
const loadEngine = new Function(code + '\nreturn Engine;');
const Engine = loadEngine();

// ── Test Harness ────────────────────────────────────
let passed = 0, failed = 0, total = 0;

function assert(condition, message, details) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.log(`  ❌ ${message}`);
    if (details) console.log(`     ${details}`);
  }
}

function assertClose(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  const pct = expected !== 0 ? (diff / Math.abs(expected)) * 100 : diff;
  assert(diff <= tolerance, message, `Expected ~${expected.toLocaleString()}, got ${actual.toLocaleString()} (diff: ${diff.toLocaleString()}, ${pct.toFixed(2)}%)`);
}

function section(name) {
  console.log(`\n━━━ ${name} ━━━`);
}

// ── Test Data Factories ─────────────────────────────
function makeData(overrides = {}) {
  const base = {
    settings: { age: 30, retireAge: 65, lifeExpectancy: 90, defaultReturn: 7, defaultInflation: 3, taxRate: 25, capitalGainsRate: 15, stateTaxRate: 5, currency: 'USD', ...overrides.settings },
    accounts: {
      assets: overrides.assets || [],
      liabilities: overrides.liabilities || []
    },
    income: overrides.income || [],
    expenses: overrides.expenses || [],
    milestones: [],
    lifeEvents: overrides.lifeEvents || [],
    history: []
  };
  return base;
}

// ═══════════════════════════════════════════════════════
// 1. BASIC FIRE NUMBER CALCULATIONS
// ═══════════════════════════════════════════════════════
section('1. Basic FIRE Number (4% Rule)');

assert(Engine.computeFIRENumber(40000, 4) === 1000000, '$40K expenses / 4% SWR = $1M');
assert(Engine.computeFIRENumber(100000, 4) === 2500000, '$100K expenses / 4% SWR = $2.5M');
assert(Engine.computeFIRENumber(60000, 3) === 2000000, '$60K expenses / 3% SWR = $2M');
assert(Engine.computeFIRENumber(50000, 3.5) === 50000 / 0.035, '$50K / 3.5% SWR = $1.43M');
assert(Engine.computeFIRENumber(0, 4) === 0, '$0 expenses = $0 FIRE number');
assert(Engine.computeFIRENumber(40000, 0) === Infinity, '0% SWR = Infinity');

// ═══════════════════════════════════════════════════════
// 2. ACCOUNT CLASSIFICATION
// ═══════════════════════════════════════════════════════
section('2. Account Tax Bucket Classification');

assert(Engine.classifyAccount('401(k)') === 'tax-deferred', '401(k) → tax-deferred');
assert(Engine.classifyAccount('IRA') === 'tax-deferred', 'IRA → tax-deferred');
assert(Engine.classifyAccount('Traditional IRA') === 'tax-deferred', 'Traditional IRA → tax-deferred');
assert(Engine.classifyAccount('Roth IRA') === 'tax-free', 'Roth IRA → tax-free');
assert(Engine.classifyAccount('HSA') === 'restricted', 'HSA → restricted');
assert(Engine.classifyAccount('Brokerage') === 'taxable', 'Brokerage → taxable');
assert(Engine.classifyAccount('Checking') === 'taxable', 'Checking → taxable');
assert(Engine.classifyAccount('Savings') === 'taxable', 'Savings → taxable');
assert(Engine.classifyAccount('Crypto') === 'taxable', 'Crypto → taxable');
assert(Engine.classifyAccount('Real Estate') === 'real-assets', 'Real Estate → real-assets');
assert(Engine.classifyAccount('Other') === 'taxable', 'Other → taxable');

// ═══════════════════════════════════════════════════════
// 3. TAX CALCULATIONS
// ═══════════════════════════════════════════════════════
section('3. Tax Rate Calculations');

const taxData = makeData({ settings: { taxRate: 22, stateTaxRate: 5, capitalGainsRate: 15 } });
assertClose(Engine.getIncomeTaxRate(taxData), 0.27, 0.001, 'Income tax: 22% federal + 5% state = 27%');
assertClose(Engine.getCapGainsRate(taxData), 0.15, 0.001, 'Cap gains rate: 15%');

const highTaxData = makeData({ settings: { taxRate: 37, stateTaxRate: 13 } });
assertClose(Engine.getIncomeTaxRate(highTaxData), 0.50, 0.001, 'Income tax capped at 50% (37% + 13%)');

// Dividend tax drag — should be very small
const dragRate = Engine.getTaxableDragRate(taxData);
assertClose(dragRate, 0.018 * 0.15, 0.001, 'Dividend drag: 1.8% yield × 15% rate = 0.27%');
assert(dragRate < 0.01, `Tax drag is small (${(dragRate * 100).toFixed(3)}% < 1%)`);

// ═══════════════════════════════════════════════════════
// 4. ACCESSIBLE BALANCE BY AGE
// ═══════════════════════════════════════════════════════
section('4. Accessible (Penalty-Free) Balance by Age');

const buckets = {
  'taxable': 200000,
  'tax-deferred': 500000,
  'tax-free': 100000,
  'restricted': 50000,
  'real-assets': 300000,
};

// Age 30: taxable + 60% Roth + 30% real assets
const access30 = Engine.getAccessibleBalance(buckets, 30);
assertClose(access30, 200000 + 100000 * 0.6 + 300000 * 0.3, 100, 'Age 30: taxable($200K) + 60%Roth($60K) + 30%RE($90K) = $350K');

// Age 60 (past 59.5): adds full tax-deferred + full Roth
const access60 = Engine.getAccessibleBalance(buckets, 60);
assertClose(access60, 200000 + 500000 + 100000 + 300000 * 0.3, 100, 'Age 60: taxable + 401k + Roth + 30%RE = $890K');

// Age 65: adds HSA too
const access65 = Engine.getAccessibleBalance(buckets, 65);
assertClose(access65, 200000 + 500000 + 100000 + 50000 + 300000 * 0.3, 100, 'Age 65: everything = $940K');

// ═══════════════════════════════════════════════════════
// 5. INCOME TAX ON PROJECTIONS
// ═══════════════════════════════════════════════════════
section('5. Income Tax Applied to Projections');

const incomeData = makeData({
  settings: { age: 30, taxRate: 25, stateTaxRate: 5 },
  assets: [{ balance: 100000, type: 'Brokerage', growth: 7, monthlyContribution: 0 }],
  income: [{ annual: 100000, growth: 0, startAge: null, endAge: null, type: 'Salary' }],
  expenses: [{ annual: 30000, growth: 0, type: 'Housing' }],
});

const incProj = Engine.projectNetWorth(incomeData, 1, 7, 3, false);
assertClose(incProj[0].grossIncome, 100000, 1, 'Year 0: gross income = $100K');
assertClose(incProj[0].incomeTax, 30000, 1, 'Year 0: income tax = $30K (30%)');
assertClose(incProj[0].income, 70000, 1, 'Year 0: net income = $70K');
assertClose(incProj[0].expenses, 30000, 1, 'Year 0: expenses = $30K');
assertClose(incProj[0].savings, 40000, 1, 'Year 0: net savings = $40K');

// ═══════════════════════════════════════════════════════
// 6. INCOME END AGE (JOB STOPS)
// ═══════════════════════════════════════════════════════
section('6. Income Start/End Age');

const jobEndData = makeData({
  settings: { age: 25 },
  assets: [{ balance: 50000, type: 'Brokerage', growth: 7, monthlyContribution: 0 }],
  income: [{ annual: 100000, growth: 0, startAge: null, endAge: 27, type: 'Salary' }],
  expenses: [{ annual: 30000, growth: 0, type: 'Housing' }],
});

const jobProj = Engine.projectNetWorth(jobEndData, 5, 7, 3, false);
assert(jobProj[0].grossIncome > 0, 'Age 25: has income');
assert(jobProj[1].grossIncome > 0, 'Age 26: has income');
assert(jobProj[2].grossIncome > 0, 'Age 27: has income (endAge inclusive)');
assertClose(jobProj[3].grossIncome, 0, 1, 'Age 28: income = $0 (past endAge)');
assertClose(jobProj[4].grossIncome, 0, 1, 'Age 29: income = $0');

// Savings should go negative after job ends
assert(jobProj[3].savings < 0, 'Age 28: negative savings (expenses > 0, income = 0)');

// ═══════════════════════════════════════════════════════
// 6b. INCOME GAPS (Sabbaticals)
// ═══════════════════════════════════════════════════════
section('6b. Income Gaps (Sabbaticals)');

const currentYear = new Date().getFullYear();

// 3-month gap (May-Aug of current year)
const gap3moData = makeData({
  settings: { age: 25, taxRate: 0, stateTaxRate: 0, capitalGainsRate: 0 },
  assets: [{ balance: 100000, type: 'Brokerage', growth: 0, monthlyContribution: 0 }],
  income: [{ annual: 120000, growth: 0, type: 'Salary', gaps: [
    { start: currentYear + '-05', end: currentYear + '-08', label: '3mo gap' }
  ]}],
  expenses: [],
});

// 12-month gap (Jan-Dec of next year)
const gap12moData = makeData({
  settings: { age: 25, taxRate: 0, stateTaxRate: 0, capitalGainsRate: 0 },
  assets: [{ balance: 100000, type: 'Brokerage', growth: 0, monthlyContribution: 0 }],
  income: [{ annual: 120000, growth: 0, type: 'Salary', gaps: [
    { start: (currentYear + 1) + '-01', end: (currentYear + 1) + '-12', label: '11mo gap' }
  ]}],
  expenses: [],
});

// No gap
const noGapData = makeData({
  settings: { age: 25, taxRate: 0, stateTaxRate: 0, capitalGainsRate: 0 },
  assets: [{ balance: 100000, type: 'Brokerage', growth: 0, monthlyContribution: 0 }],
  income: [{ annual: 120000, growth: 0, type: 'Salary', gaps: [] }],
  expenses: [],
});

const noGapProj = Engine.projectNetWorth(noGapData, 3, 0, 0, false);
const gap3moProj = Engine.projectNetWorth(gap3moData, 3, 0, 0, false);
const gap12moProj = Engine.projectNetWorth(gap12moData, 3, 0, 0, false);

// Year 0: 3mo gap reduces income by 3/12 = 25% → $90K instead of $120K
assertClose(gap3moProj[0].grossIncome, 120000 * (9/12), 1000, '3mo gap in year 0: ~$90K income (75% of $120K)');

// With no gap, full income
assertClose(noGapProj[0].grossIncome, 120000, 1, 'No gap: full $120K income');

// 3mo gap should have MORE NW than 12mo gap at year 2
assert(gap3moProj[2].netWorth > gap12moProj[2].netWorth,
  `3mo gap NW ($${Math.round(gap3moProj[2].netWorth).toLocaleString()}) > 12mo gap NW ($${Math.round(gap12moProj[2].netWorth).toLocaleString()})`);

// No gap should have MORE NW than 3mo gap
assert(noGapProj[2].netWorth > gap3moProj[2].netWorth,
  `No gap NW ($${Math.round(noGapProj[2].netWorth).toLocaleString()}) > 3mo gap NW ($${Math.round(gap3moProj[2].netWorth).toLocaleString()})`);

// The difference should be proportional to lost income
const lostIncome3mo = noGapProj[2].netWorth - gap3moProj[2].netWorth;
const lostIncome12mo = noGapProj[2].netWorth - gap12moProj[2].netWorth;
assert(lostIncome12mo > lostIncome3mo * 2,
  `12mo gap costs more ($${Math.round(lostIncome12mo).toLocaleString()}) than 2x the 3mo gap ($${Math.round(lostIncome3mo).toLocaleString()})`);

console.log(`    [info] NW after 3yr: no gap=$${Math.round(noGapProj[2].netWorth).toLocaleString()}, 3mo gap=$${Math.round(gap3moProj[2].netWorth).toLocaleString()}, 12mo gap=$${Math.round(gap12moProj[2].netWorth).toLocaleString()}`);

// ═══════════════════════════════════════════════════════
// 7. COMPOUND GROWTH (NO TAX, SIMPLE)
// ═══════════════════════════════════════════════════════
section('7. Compound Growth Accuracy');

const growthData = makeData({
  settings: { age: 30, taxRate: 0, stateTaxRate: 0, capitalGainsRate: 0 },
  assets: [{ balance: 100000, type: 'Roth IRA', growth: 7, monthlyContribution: 0 }],
  income: [],
  expenses: [],
});

const growthProj = Engine.projectNetWorth(growthData, 10, 10, 0, false);
// $100K at 10% for 10 years = $100K × (1.10)^10 = $259,374
const expected10yr = 100000 * Math.pow(1.10, 10);
assertClose(growthProj[10].netWorth, expected10yr, 500, `$100K at 10% for 10yr = ~$${Math.round(expected10yr).toLocaleString()}`);

// With contributions: $100K + $10K/yr at 10% for 5 years
const contribData = makeData({
  settings: { age: 30, taxRate: 0, stateTaxRate: 0, capitalGainsRate: 0 },
  assets: [{ balance: 100000, type: 'Roth IRA', growth: 7, monthlyContribution: 833.33 }],
  income: [],
  expenses: [],
});

const contribProj = Engine.projectNetWorth(contribData, 5, 10, 0, false);
// Manually compute: balance grows by 10% + $10K/yr contribution
let manualBal = 100000;
for (let i = 0; i < 5; i++) {
  manualBal = manualBal * 1.10 + 10000;
}
assertClose(contribProj[5].netWorth, manualBal, 500, `$100K + $10K/yr at 10% for 5yr = ~$${Math.round(manualBal).toLocaleString()}`);

// ═══════════════════════════════════════════════════════
// 8. BUCKET GROWTH (TAX-DEFERRED VS TAXABLE)
// ═══════════════════════════════════════════════════════
section('8. Tax Bucket Growth Differences');

const bucketData = makeData({
  settings: { age: 30, taxRate: 0, stateTaxRate: 0, capitalGainsRate: 15 },
  assets: [
    { balance: 100000, type: 'Roth IRA', growth: 7, monthlyContribution: 0 },
    { balance: 100000, type: 'Brokerage', growth: 7, monthlyContribution: 0 },
  ],
  income: [],
  expenses: [],
});

const bucketProj = Engine.projectNetWorth(bucketData, 20, 8, 0, false);
const roth20 = bucketProj[20].taxFree;
const taxable20 = bucketProj[20].taxable;
// Roth should grow faster (no dividend drag)
assert(roth20 > taxable20, `After 20yr: Roth ($${Math.round(roth20).toLocaleString()}) > Taxable ($${Math.round(taxable20).toLocaleString()}) due to div tax drag`);
// But the difference should be modest (not huge)
const dragDiff = ((roth20 - taxable20) / roth20) * 100;
assert(dragDiff < 10, `Difference is modest: ${dragDiff.toFixed(1)}% < 10% (just dividend drag, not full cap gains)`);
assert(dragDiff > 0.5, `Difference is real: ${dragDiff.toFixed(1)}% > 0.5%`);

// ═══════════════════════════════════════════════════════
// 9. HOUSE PURCHASE CALCULATIONS
// ═══════════════════════════════════════════════════════
section('9. House Purchase — Mortgage Math');

const house = {
  homePrice: 500000,
  downPayment: 100000,
  mortgageRate: 6,
  mortgageTerm: 30,
  appreciation: 3,
  propertyTaxRate: 1.1,
  annualInsurance: 1800,
  maintenanceRate: 1,
  monthlyHOA: 0,
  currentRent: 2000,
  rentGrowth: 3,
};

// Year 0 costs
const yr0 = Engine.getHouseCostsAtYear(house, 2030, 2030);
assert(yr0 !== null, 'Year 0 costs exist');

// Mortgage payment validation: $400K at 6% for 30yr
const monthlyRate = 0.06 / 12;
const nMonths = 360;
const expectedMonthly = 400000 * (monthlyRate * Math.pow(1 + monthlyRate, nMonths)) / (Math.pow(1 + monthlyRate, nMonths) - 1);
assertClose(yr0.annualMortgage, expectedMonthly * 12, 10, `Annual mortgage: ~$${Math.round(expectedMonthly * 12).toLocaleString()} ($${Math.round(expectedMonthly)}/mo)`);

// Home value at year 0 = purchase price
assertClose(yr0.homeValue, 500000, 1, 'Home value at purchase = $500K');

// Equity at year 0 = down payment (no principal paid yet)
assertClose(yr0.equity, 100000, 100, 'Equity at purchase ≈ down payment $100K');

// Property tax year 0
assertClose(yr0.propertyTax, 500000 * 0.011, 10, 'Property tax: $500K × 1.1% = $5,500');

// Rent saved
assertClose(yr0.rentSaved, 2000 * 12, 1, 'Rent saved: $2,000/mo × 12 = $24,000');

// Year 10: home appreciated
const yr10 = Engine.getHouseCostsAtYear(house, 2040, 2030);
const expectedValue10 = 500000 * Math.pow(1.03, 10);
assertClose(yr10.homeValue, expectedValue10, 100, `Home value after 10yr at 3% = ~$${Math.round(expectedValue10).toLocaleString()}`);

// Year 10: mortgage balance should be lower
assert(yr10.remainingBalance < 400000, `Mortgage balance at yr 10 ($${Math.round(yr10.remainingBalance).toLocaleString()}) < original $400K`);
assert(yr10.remainingBalance > 200000, `Mortgage balance at yr 10 ($${Math.round(yr10.remainingBalance).toLocaleString()}) > $200K (still owe most)`);

// Year 10: equity should be much higher
assert(yr10.equity > yr0.equity, `Equity at yr 10 ($${Math.round(yr10.equity).toLocaleString()}) > yr 0 ($${Math.round(yr0.equity).toLocaleString()})`);

// Year 31: mortgage should be paid off
const yr31 = Engine.getHouseCostsAtYear(house, 2061, 2030);
assertClose(yr31.remainingBalance, 0, 100, 'Mortgage paid off after 30 years');
assertClose(yr31.annualMortgage, 0, 1, 'No mortgage payments after payoff');
assert(yr31.equity > 1000000, `Equity after 31yr: $${Math.round(yr31.equity).toLocaleString()} > $1M (appreciation)`);

// ═══════════════════════════════════════════════════════
// 10. HOUSE — NO DOUBLE-COUNTING
// ═══════════════════════════════════════════════════════
section('10. House Cost — No Double Counting');

// The net cash impact of a house should be:
// mortgage_payment + property_tax + insurance + maintenance + HOA - rent_saved
const cashOut = yr0.annualMortgage + yr0.propertyTax + yr0.insurance + yr0.maintenance + yr0.hoa;
const netVsRent = cashOut - yr0.rentSaved;
assert(netVsRent > 0, `Net cost vs renting is positive: $${Math.round(netVsRent).toLocaleString()}/yr`);

// Verify the ownership cost includes interest + tax + insurance + maintenance (NOT full mortgage principal)
assert(yr0.totalOwnershipCost > yr0.interestThisYear, 
  `Ownership cost ($${Math.round(yr0.totalOwnershipCost).toLocaleString()}) > interest alone ($${Math.round(yr0.interestThisYear).toLocaleString()}) — includes tax/insurance/maintenance`);

// Verify ownership cost does NOT include principal repayment
const ownershipMinusTaxInsMainHoa = yr0.totalOwnershipCost - yr0.propertyTax - yr0.insurance - yr0.maintenance - yr0.hoa;
assertClose(ownershipMinusTaxInsMainHoa, yr0.interestThisYear, 100,
  'Ownership cost non-tax/ins/maint portion = mortgage interest only (no principal double-count)');

// Interest should be less than full mortgage payment
assert(yr0.interestThisYear < yr0.annualMortgage, 
  `Interest ($${Math.round(yr0.interestThisYear).toLocaleString()}) < mortgage payment ($${Math.round(yr0.annualMortgage).toLocaleString()})`);

// Principal + interest ≈ mortgage payment
assertClose(yr0.principalThisYear + yr0.interestThisYear, yr0.annualMortgage, 100, 
  'Principal + Interest ≈ Annual Mortgage Payment');

// ═══════════════════════════════════════════════════════
// 11. HOUSE PROJECTION — NET WORTH IMPACT
// ═══════════════════════════════════════════════════════
section('11. House Purchase Impact on Net Worth');

const noHouseData = makeData({
  settings: { age: 30, taxRate: 22, stateTaxRate: 5, capitalGainsRate: 15 },
  assets: [{ balance: 300000, type: 'Brokerage', growth: 7, monthlyContribution: 2000 }],
  income: [{ annual: 150000, growth: 3, type: 'Salary' }],
  expenses: [{ annual: 36000, growth: 3, type: 'Housing' }],  // $3K/mo rent
});

const withHouseData = makeData({
  settings: { age: 30, taxRate: 22, stateTaxRate: 5, capitalGainsRate: 15 },
  assets: [{ balance: 300000, type: 'Brokerage', growth: 7, monthlyContribution: 2000 }],
  income: [{ annual: 150000, growth: 3, type: 'Salary' }],
  expenses: [{ annual: 36000, growth: 3, type: 'Housing' }],
  lifeEvents: [{
    id: 'test-house', type: 'house', enabled: true, name: 'Test Home',
    homePrice: 600000, downPayment: 120000, mortgageRate: 6.5, mortgageTerm: 30,
    appreciation: 3.5, propertyTaxRate: 1.1, annualInsurance: 2000, maintenanceRate: 1,
    monthlyHOA: 0, currentRent: 3000, rentGrowth: 3, purchaseYear: 2028
  }]
});

const noHouseProj = Engine.projectNetWorth(noHouseData, 30, 7, 3, false);
const withHouseProj = Engine.projectNetWorth(withHouseData, 30, 7, 3, false);

// Before purchase year: projections should be identical
const prePurchaseYear = 2027 - new Date().getFullYear();
if (prePurchaseYear >= 0 && prePurchaseYear < noHouseProj.length) {
  assertClose(noHouseProj[prePurchaseYear].netWorth, withHouseProj[prePurchaseYear].netWorth, 100,
    `Before purchase (${2027}): NW equal with and without house`);
}

// After purchase: with-house NW should account for equity
const yr5AfterPurchase = 2033 - new Date().getFullYear();
if (yr5AfterPurchase < withHouseProj.length) {
  assert(withHouseProj[yr5AfterPurchase].homeEquity > 0, 
    `5yr after purchase: has home equity ($${Math.round(withHouseProj[yr5AfterPurchase].homeEquity).toLocaleString()})`);
  assert(withHouseProj[yr5AfterPurchase].mortgageBalance > 0,
    `5yr after purchase: has mortgage balance ($${Math.round(withHouseProj[yr5AfterPurchase].mortgageBalance).toLocaleString()})`);
}

// Long term (30 years): house should help — appreciation + paid off mortgage + no rent
const lastNoHouse = noHouseProj[30].netWorth;
const lastWithHouse = withHouseProj[30].netWorth;
console.log(`    [info] 30yr NW without house: $${Math.round(lastNoHouse).toLocaleString()}`);
console.log(`    [info] 30yr NW with house:    $${Math.round(lastWithHouse).toLocaleString()}`);
// They should be in the same ballpark — house shouldn't destroy NW
assert(lastWithHouse > lastNoHouse * 0.6, 'With-house NW is not absurdly lower than without (>60% of no-house)');

// ═══════════════════════════════════════════════════════
// 12. DISABLED LIFE EVENTS
// ═══════════════════════════════════════════════════════
section('12. Disabled Life Events Ignored');

const disabledHouseData = makeData({
  settings: { age: 30, taxRate: 0, stateTaxRate: 0, capitalGainsRate: 0 },
  assets: [{ balance: 100000, type: 'Brokerage', growth: 7, monthlyContribution: 0 }],
  income: [],
  expenses: [],
  lifeEvents: [{
    id: 'disabled-house', type: 'house', enabled: false,
    homePrice: 500000, downPayment: 100000, mortgageRate: 6, mortgageTerm: 30,
    appreciation: 3, propertyTaxRate: 1.1, annualInsurance: 1800, maintenanceRate: 1,
    monthlyHOA: 0, currentRent: 0, rentGrowth: 3, purchaseYear: 2028
  }]
});

const noEventData = makeData({
  settings: { age: 30, taxRate: 0, stateTaxRate: 0, capitalGainsRate: 0 },
  assets: [{ balance: 100000, type: 'Brokerage', growth: 7, monthlyContribution: 0 }],
  income: [],
  expenses: [],
});

const disabledProj = Engine.projectNetWorth(disabledHouseData, 10, 7, 0, false);
const noEventProj = Engine.projectNetWorth(noEventData, 10, 7, 0, false);
assertClose(disabledProj[10].netWorth, noEventProj[10].netWorth, 1, 'Disabled house event = identical to no house event');

// ═══════════════════════════════════════════════════════
// 13. FIRE NUMBER — TAX ADJUSTMENT
// ═══════════════════════════════════════════════════════
section('13. Tax-Adjusted FIRE Number');

const fireTaxData = makeData({
  settings: { age: 30, taxRate: 22, stateTaxRate: 5, capitalGainsRate: 15 },
  assets: [
    { balance: 200000, type: '401(k)', growth: 7, monthlyContribution: 1500 },
    { balance: 100000, type: 'Brokerage', growth: 7, monthlyContribution: 500 },
    { balance: 50000, type: 'Roth IRA', growth: 7, monthlyContribution: 500 },
  ],
  income: [{ annual: 150000, growth: 3, type: 'Salary' }],
  expenses: [{ annual: 40000, growth: 3, type: 'Other' }],
});

const baseFireNum = Engine.computeFIRENumber(50000, 4); // $1.25M
const taxAdjFireNum = Engine.computeTaxAdjustedFIRENumber(50000, 4, fireTaxData, 7, 3);
assert(taxAdjFireNum > baseFireNum, `Tax-adjusted FIRE ($${Math.round(taxAdjFireNum).toLocaleString()}) > base ($${Math.round(baseFireNum).toLocaleString()})`);
assert(taxAdjFireNum < baseFireNum * 1.5, `Tax adjustment < 50% markup (got ${((taxAdjFireNum / baseFireNum - 1) * 100).toFixed(1)}%)`);

// All-Roth portfolio: tax adjustment should be minimal
const rothOnlyData = makeData({
  settings: { age: 30, taxRate: 22, stateTaxRate: 5, capitalGainsRate: 15 },
  assets: [{ balance: 300000, type: 'Roth IRA', growth: 7, monthlyContribution: 2000 }],
  income: [{ annual: 150000, growth: 3, type: 'Salary' }],
  expenses: [{ annual: 40000, growth: 3, type: 'Other' }],
});

const rothFireNum = Engine.computeTaxAdjustedFIRENumber(50000, 4, rothOnlyData, 7, 3);
const rothMarkup = (rothFireNum / baseFireNum - 1) * 100;
// Note: even all-Roth won't be 0% markup because excess savings go to taxable over time
assert(rothMarkup < 20, `Roth-heavy FIRE markup is small: ${rothMarkup.toFixed(1)}% < 20%`);

// ═══════════════════════════════════════════════════════
// 14. YEARS TO FIRE (CONSISTENCY)
// ═══════════════════════════════════════════════════════
section('14. Years to FIRE');

const fireData = makeData({
  settings: { age: 30, taxRate: 22, stateTaxRate: 5, capitalGainsRate: 15 },
  assets: [
    { balance: 200000, type: 'Brokerage', growth: 7, monthlyContribution: 3000 },
  ],
  income: [{ annual: 150000, growth: 3, type: 'Salary' }],
  expenses: [{ annual: 50000, growth: 3, type: 'Other' }],
});

const fireNumber = Engine.computeFIRENumber(50000, 4); // $1.25M
const ytf = Engine.yearsToFIRE(200000, fireNumber, 7, 3, fireData);
assert(ytf > 0, `Years to FIRE is positive: ${ytf}`);
assert(ytf < 30, `Years to FIRE is reasonable: ${ytf} < 30`);
assert(ytf !== Infinity, 'Years to FIRE is not infinity');

// Already FIRE'd
const richData = makeData({
  settings: { age: 40 },
  assets: [{ balance: 2000000, type: 'Brokerage', growth: 7, monthlyContribution: 0 }],
  income: [],
  expenses: [],
});

const ytfRich = Engine.yearsToFIRE(2000000, 1000000, 7, 3, richData);
assertClose(ytfRich, 0, 0.01, 'Already FIRE: years = 0');

// Accessible FIRE should be >= total FIRE
const ytfAccess = Engine.yearsToAccessibleFIRE(fireNumber, 7, 3, fireData);
assert(ytfAccess >= ytf, `Accessible FIRE (${ytfAccess}) >= total FIRE (${ytf})`);

// ═══════════════════════════════════════════════════════
// 15. CALCULATEFIRE — AFTER-TAX SAVINGS RATE
// ═══════════════════════════════════════════════════════
section('15. calculateFIRE — Tax-Adjusted Metrics');

const fireCalcData = makeData({
  settings: { age: 30, taxRate: 25, stateTaxRate: 5 },
  assets: [{ balance: 100000, type: 'Brokerage', growth: 7, monthlyContribution: 0 }],
  income: [{ annual: 200000, growth: 0, type: 'Salary' }],
  expenses: [{ annual: 60000, growth: 0, type: 'Other' }],
});

const fireCalc = Engine.calculateFIRE(fireCalcData);
assertClose(fireCalc.grossIncome, 200000, 1, 'Gross income: $200K');
assertClose(fireCalc.annualIncomeTax, 60000, 1, 'Income tax: $60K (30%)');
assertClose(fireCalc.annualIncome, 140000, 1, 'Net income: $140K');
assertClose(fireCalc.annualExpenses, 60000, 1, 'Expenses: $60K');
assertClose(fireCalc.annualSavings, 80000, 1, 'Savings: $80K');
assertClose(fireCalc.savingsRate, 40, 0.5, 'Savings rate: 40% of gross');

// ═══════════════════════════════════════════════════════
// 16. INFLATION ADJUSTMENT
// ═══════════════════════════════════════════════════════
section('16. Inflation Adjustment (Real vs Nominal)');

const inflData = makeData({
  settings: { age: 30, taxRate: 0, stateTaxRate: 0, capitalGainsRate: 0 },
  assets: [{ balance: 100000, type: 'Roth IRA', growth: 7, monthlyContribution: 0 }],
  income: [],
  expenses: [],
});

const nomProj = Engine.projectNetWorth(inflData, 20, 7, 3, false);
const realProj = Engine.projectNetWorth(inflData, 20, 7, 3, true);

assert(nomProj[20].netWorth > realProj[20].netWorth, 'Nominal NW > Real NW after 20 years');
// Real value should be lower by roughly the inflation factor
const inflFactor = Math.pow(1.03, 20);
assertClose(realProj[20].netWorth, nomProj[20].netWorth / inflFactor, nomProj[20].netWorth * 0.05,
  'Real NW ≈ Nominal NW / cumulative inflation');

// ═══════════════════════════════════════════════════════
// 17. MONTE CARLO — BASIC SANITY
// ═══════════════════════════════════════════════════════
section('17. Monte Carlo Simulation Sanity');

const mcResult = Engine.runMonteCarlo(100000, 10000, 0, 20, 500, 10, 15, null);
assert(mcResult.trials.length === 500, `500 trials run`);
assert(mcResult.successRate >= 0 && mcResult.successRate <= 100, `Success rate in range: ${mcResult.successRate.toFixed(1)}%`);
assert(mcResult.median > 0, `Median outcome positive: $${Math.round(mcResult.median).toLocaleString()}`);
assert(mcResult.p90 > mcResult.median, 'P90 > median');
assert(mcResult.p10 < mcResult.median, 'P10 < median');
assert(mcResult.p90 > mcResult.p10, 'P90 > P10 (spread exists)');

// With reasonable inputs, most trials should succeed
assert(mcResult.successRate > 70, `Success rate > 70% for accumulation: ${mcResult.successRate.toFixed(1)}%`);

// ═══════════════════════════════════════════════════════
// 18. FORMAT UTILITIES
// ═══════════════════════════════════════════════════════
section('18. Format Utilities');

assert(Engine.formatCurrency(1234567) === '$1,234,567', '$1,234,567 format');
assert(Engine.formatCurrency(1234567, 'USD', true) === '$1.2M', '$1.2M compact');
assert(Engine.formatCurrency(50000, 'USD', true) === '$50K', '$50K compact');
assert(Engine.formatCurrency(Infinity) === '∞', 'Infinity → ∞');
assert(Engine.formatPercent(42.567) === '42.6%', '42.6% format');
assert(Engine.formatPercent(NaN) === '—', 'NaN → —');

// ═══════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(50));
console.log(`RESULTS: ${passed}/${total} passed, ${failed} failed`);
if (failed > 0) {
  console.log('⚠️  SOME TESTS FAILED — review above');
  process.exit(1);
} else {
  console.log('🎉 ALL TESTS PASSED');
  process.exit(0);
}

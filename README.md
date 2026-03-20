# ProjectionFinances

A privacy-first financial planning tool inspired by [ProjectionLab](https://projectionlab.com/). Simulate your financial future, calculate when you can FIRE, and model life events - all running locally in your browser with no server or account linking required.

## Features

- **Net Worth Projections** - Visualize your finances over 5–60 years with stacked area charts showing tax-deferred, taxable, Roth, and real asset buckets
- **FIRE Calculator** - Compute your FIRE number with tax-adjusted withdrawals, accessible vs total NW, and multiple FIRE variants (Lean, Regular, Fat, Barista, Coast)
- **Monte Carlo Simulation** - Battle-test your plan with 100–2,500 randomized market scenarios
- **Life Events** - Model buying a house with interactive sliders for price, mortgage rate, appreciation, and more
- **What-If Scenarios** - Toggle income streams, sabbaticals, houses, and expenses on/off in real-time on both Projections and FIRE pages
- **Income Gaps** - Model sabbaticals and career breaks with month-level precision and adjustable duration sliders
- **Tax-Aware Engine** - Income tax, capital gains, dividend drag, and blended withdrawal tax rates by account type
- **Account Buckets** - Tracks taxable, 401(k)/IRA, Roth, HSA, and real assets separately with penalty-free accessibility by age
- **CSV Import** - Drop CSVs from Fidelity, Vanguard, Schwab, and 20+ other providers with auto-detection and deduplication on re-import
- **Net Worth Snapshots** - Record and chart your progress over time
- **Import/Export** - Full JSON data export and import, no cloud dependency

## Quick Start

```bash
cd ProjectionFinances
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

Click **Load Demo Data** in the sidebar to see everything populated with sample data.

## Importing Your Data

1. Download CSVs from your bank/brokerage (Fidelity, Vanguard, Schwab, etc.)
2. Go to **Import & Sync** and drop the file
3. Verify the column mapping and click **Import Data**
4. Re-importing the same CSV updates existing account balances instead of creating duplicates

## Running Tests

```bash
node tests/engine.test.js
```

## Tech Stack

- Vanilla HTML/CSS/JS - no build step, no framework
- [Chart.js](https://www.chartjs.org/) for all visualizations
- localStorage for data persistence
- `python3 -m http.server` or any static file server

## Privacy

All data stays in your browser. Nothing is sent to any server.

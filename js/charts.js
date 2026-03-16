/* =============================================
   Charts Module — Chart.js rendering
   ============================================= */

const Charts = {
  instances: {},

  colors: {
    primary: '#6366f1',
    primaryLight: 'rgba(99,102,241,0.15)',
    green: '#22c55e',
    greenLight: 'rgba(34,197,94,0.1)',
    blue: '#3b82f6',
    blueLight: 'rgba(59,130,246,0.15)',
    red: '#ef4444',
    redLight: 'rgba(239,68,68,0.1)',
    orange: '#f59e0b',
    orangeLight: 'rgba(245,158,11,0.15)',
    purple: '#a855f7',
    purpleLight: 'rgba(168,85,247,0.15)',
    teal: '#14b8a6',
    gray: '#64748b',
    gridColor: 'rgba(148,163,184,0.08)',
    gridBorder: 'rgba(148,163,184,0.15)',
  },

  defaultOptions() {
    return {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2.2,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: { size: 12, family: '-apple-system, BlinkMacSystemFont, sans-serif' },
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 10
          }
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: function(ctx) {
              let value = ctx.parsed.y;
              if (typeof value === 'number') {
                return ctx.dataset.label + ': $' + Math.round(value).toLocaleString();
              }
              return ctx.dataset.label + ': ' + value;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(148,163,184,0.08)', drawBorder: false },
          ticks: { color: '#64748b', font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(148,163,184,0.08)', drawBorder: false },
          ticks: {
            color: '#64748b',
            font: { size: 11 },
            callback: function(value) {
              if (Math.abs(value) >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
              if (Math.abs(value) >= 1e3) return '$' + (value / 1e3).toFixed(0) + 'K';
              return '$' + value;
            }
          }
        }
      }
    };
  },

  destroy(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  // ── Dashboard Projection Chart ────────────────────
  renderDashProjection(canvasId, projections) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = projections.map(p => p.year);
    const netWorthData = projections.map(p => p.netWorth);
    const assetsData = projections.map(p => p.assets);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Net Worth',
            data: netWorthData,
            borderColor: this.colors.green,
            backgroundColor: this.colors.greenLight,
            fill: true,
            tension: 0.3,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 5
          },
          {
            label: 'Assets',
            data: assetsData,
            borderColor: this.colors.blue,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [5, 5],
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4
          }
        ]
      },
      options: this.defaultOptions()
    });
  },

  // ── Asset Allocation Doughnut ──────────────────────
  renderAllocation(canvasId, assets) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const typeGroups = {};
    assets.forEach(a => {
      const type = a.type || 'Other';
      typeGroups[type] = (typeGroups[type] || 0) + (a.balance || 0);
    });

    const labels = Object.keys(typeGroups);
    const values = Object.values(typeGroups);
    const colors = [
      this.colors.primary, this.colors.green, this.colors.blue,
      this.colors.orange, this.colors.purple, this.colors.teal,
      this.colors.red, this.colors.gray
    ];

    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: 'transparent',
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#94a3b8',
              padding: 12,
              font: { size: 11 },
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#f1f5f9',
            bodyColor: '#cbd5e1',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function(ctx) {
                return ctx.label + ': $' + Math.round(ctx.raw).toLocaleString();
              }
            }
          }
        }
      }
    });
  },

  // ── Full Projection Chart (with bucket stacking) ──
  renderProjection(canvasId, projections, milestones = []) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = projections.map(p => p.year);
    const hasBuckets = projections[0] && projections[0].taxable !== undefined;

    const annotations = {};
    milestones.forEach((m, i) => {
      if (m.targetYear) {
        annotations['ms' + i] = {
          type: 'line',
          xMin: m.targetYear,
          xMax: m.targetYear,
          borderColor: this.colors.orange,
          borderWidth: 1.5,
          borderDash: [6, 4],
          label: {
            display: true,
            content: m.name,
            position: 'start',
            backgroundColor: 'rgba(245,158,11,0.2)',
            color: this.colors.orange,
            font: { size: 10 }
          }
        };
      }
    });

    // Find age 59.5 year for penalty-free annotation
    const penaltyFreeIdx = projections.findIndex(p => p.age >= 59.5);
    if (penaltyFreeIdx > 0 && hasBuckets) {
      annotations['penaltyFree'] = {
        type: 'line',
        xMin: projections[penaltyFreeIdx].year,
        xMax: projections[penaltyFreeIdx].year,
        borderColor: 'rgba(239,68,68,0.5)',
        borderWidth: 1.5,
        borderDash: [4, 4],
        label: {
          display: true,
          content: '59½ — Penalty-free access',
          position: 'start',
          backgroundColor: 'rgba(239,68,68,0.15)',
          color: '#ef4444',
          font: { size: 9 }
        }
      };
    }

    const options = this.defaultOptions();
    options.aspectRatio = 2.5;
    options.plugins.annotation = { annotations };

    const datasets = [];

    if (hasBuckets) {
      // Stacked area by bucket
      options.scales.y.stacked = true;
      options.scales.x.stacked = true;
      datasets.push(
        {
          label: 'Taxable (Accessible)',
          data: projections.map(p => p.taxable),
          borderColor: this.colors.green,
          backgroundColor: 'rgba(34,197,94,0.35)',
          fill: true,
          tension: 0.35,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          stack: 'buckets',
          order: 5
        },
        {
          label: 'Roth (Tax-Free)',
          data: projections.map(p => p.taxFree),
          borderColor: this.colors.blue,
          backgroundColor: 'rgba(59,130,246,0.35)',
          fill: true,
          tension: 0.35,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          stack: 'buckets',
          order: 4
        },
        {
          label: '401(k)/IRA (Tax-Deferred)',
          data: projections.map(p => p.taxDeferred),
          borderColor: this.colors.purple,
          backgroundColor: 'rgba(168,85,247,0.35)',
          fill: true,
          tension: 0.35,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          stack: 'buckets',
          order: 3
        },
        {
          label: 'HSA (Restricted)',
          data: projections.map(p => p.restricted),
          borderColor: this.colors.teal,
          backgroundColor: 'rgba(20,184,166,0.35)',
          fill: true,
          tension: 0.35,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          stack: 'buckets',
          order: 2
        },
        {
          label: 'Real Assets',
          data: projections.map(p => p.realAssets),
          borderColor: this.colors.orange,
          backgroundColor: 'rgba(245,158,11,0.25)',
          fill: true,
          tension: 0.35,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          stack: 'buckets',
          order: 1
        },
        {
          label: 'Penalty-Free Accessible',
          data: projections.map(p => p.accessible),
          borderColor: '#22c55e',
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          borderDash: [6, 4],
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          yAxisID: 'yOverlay',
          fill: false,
          order: 0
        }
      );

      // Set up overlay axis with matching range
      const allVals = projections.map(p =>
        (p.taxable || 0) + (p.taxFree || 0) + (p.taxDeferred || 0) + (p.restricted || 0) + (p.realAssets || 0)
      );
      const accessVals = projections.map(p => p.accessible || 0);
      const yMax = Math.max(...allVals, ...accessVals) * 1.1;
      options.scales.y.max = yMax;
      options.scales.yOverlay = {
        display: false,
        position: 'right',
        stacked: false,
        max: yMax,
        min: 0,
        grid: { display: false },
      };
    } else {
      datasets.push(
        {
          label: 'Net Worth',
          data: projections.map(p => p.netWorth),
          borderColor: this.colors.primary,
          backgroundColor: this.colors.primaryLight,
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5
        },
        {
          label: 'Assets',
          data: projections.map(p => p.assets),
          borderColor: this.colors.green,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [5, 5],
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4
        }
      );
    }

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options
    });
  },

  // ── Cash Flow Chart ────────────────────────────────
  renderCashFlow(canvasId, income, expenses) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const incomeLabels = income.map(i => i.name);
    const incomeValues = income.map(i => i.annual);
    const expenseLabels = expenses.map(e => e.name);
    const expenseValues = expenses.map(e => -e.annual);

    const labels = [...incomeLabels, ...expenseLabels];
    const data = [...incomeValues, ...expenseValues];
    const colors = [
      ...incomeValues.map(() => this.colors.green),
      ...expenseValues.map(() => this.colors.red)
    ];

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Annual Amount',
          data,
          backgroundColor: colors,
          borderRadius: 6,
          barThickness: 40
        }]
      },
      options: {
        ...this.defaultOptions(),
        plugins: {
          ...this.defaultOptions().plugins,
          legend: { display: false }
        }
      }
    });
  },

  // ── FIRE Projection Chart ─────────────────────────
  renderFIRE(canvasId, firePoints, bucketProjection) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = firePoints.map(p => 'Year ' + p.year);
    const balanceData = firePoints.map(p => p.balance);
    const fireLineData = firePoints.map(p => p.fireNumber);
    const fireReachedIdx = firePoints.findIndex(p => p.balance >= p.fireNumber);

    const datasets = [];

    // If we have bucket data, show stacked
    if (bucketProjection && bucketProjection.length === firePoints.length) {
      datasets.push(
        {
          label: 'Taxable',
          data: bucketProjection.map(b => b.taxable),
          borderColor: this.colors.green,
          backgroundColor: 'rgba(34,197,94,0.3)',
          fill: true, stack: 'buckets',
          tension: 0.35, borderWidth: 1, pointRadius: 0, order: 5
        },
        {
          label: 'Roth',
          data: bucketProjection.map(b => b.taxFree),
          borderColor: this.colors.blue,
          backgroundColor: 'rgba(59,130,246,0.3)',
          fill: true, stack: 'buckets',
          tension: 0.35, borderWidth: 1, pointRadius: 0, order: 4
        },
        {
          label: '401(k)/IRA',
          data: bucketProjection.map(b => b.taxDeferred),
          borderColor: this.colors.purple,
          backgroundColor: 'rgba(168,85,247,0.3)',
          fill: true, stack: 'buckets',
          tension: 0.35, borderWidth: 1, pointRadius: 0, order: 3
        },
        {
          label: 'HSA',
          data: bucketProjection.map(b => b.restricted),
          borderColor: this.colors.teal,
          backgroundColor: 'rgba(20,184,166,0.3)',
          fill: true, stack: 'buckets',
          tension: 0.35, borderWidth: 1, pointRadius: 0, order: 2
        },
        {
          label: 'Real Assets',
          data: bucketProjection.map(b => b.realAssets),
          borderColor: this.colors.orange,
          backgroundColor: 'rgba(245,158,11,0.2)',
          fill: true, stack: 'buckets',
          tension: 0.35, borderWidth: 1, pointRadius: 0, order: 1
        },
      );
    } else {
      datasets.push({
        label: 'Portfolio Value',
        data: balanceData,
        borderColor: this.colors.primary,
        backgroundColor: this.colors.primaryLight,
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: balanceData.map((_, i) => i === fireReachedIdx ? 6 : 0),
        pointBackgroundColor: this.colors.green,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 5
      });
    }

    // FIRE line always on top — uses separate y axis to avoid stacking
    datasets.push({
      label: 'FIRE Number',
      data: fireLineData,
      borderColor: this.colors.orange,
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [8, 4],
      tension: 0,
      pointRadius: 0,
      fill: false,
      yAxisID: 'yOverlay',
      order: 0
    });

    // Accessible line if buckets available — also on overlay axis
    if (bucketProjection && bucketProjection.length === firePoints.length) {
      datasets.push({
        label: 'Penalty-Free Accessible',
        data: bucketProjection.map(b => b.accessible),
        borderColor: '#22c55e',
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        borderDash: [6, 4],
        tension: 0.35,
        pointRadius: 0,
        fill: false,
        yAxisID: 'yOverlay',
        order: 0
      });
    }

    // Compute max across all data for shared axis range
    const allValues = [
      ...balanceData,
      ...fireLineData,
      ...(bucketProjection ? bucketProjection.map(b => b.accessible) : [])
    ];
    const yMax = Math.max(...allValues) * 1.1;

    const options = {
      ...this.defaultOptions(),
      scales: {
        x: {
          ...this.defaultOptions().scales.x,
        },
        y: {
          ...this.defaultOptions().scales.y,
          stacked: true,
          max: yMax,
        },
        yOverlay: {
          display: false,
          position: 'right',
          stacked: false,
          max: yMax,
          min: 0,
          grid: { display: false },
        }
      },
      plugins: {
        ...this.defaultOptions().plugins,
        annotation: fireReachedIdx >= 0 ? {
          annotations: {
            firePoint: {
              type: 'line',
              xMin: fireReachedIdx,
              xMax: fireReachedIdx,
              borderColor: this.colors.green,
              borderWidth: 1.5,
              borderDash: [4, 4],
              label: {
                display: true,
                content: '🔥 FIRE Reached!',
                position: 'start',
                backgroundColor: 'rgba(34,197,94,0.15)',
                color: this.colors.green,
                font: { size: 11, weight: 'bold' },
                padding: 6
              }
            }
          }
        } : {}
      }
    };

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options
    });
  },

  // ── Monte Carlo Chart ──────────────────────────────
  renderMonteCarlo(canvasId, mcResult, years) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = Array.from({ length: years + 1 }, (_, i) => 'Year ' + i);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '90th Percentile',
            data: mcResult.paths.p90,
            borderColor: 'rgba(34,197,94,0.4)',
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderDash: [3, 3],
            pointRadius: 0,
            tension: 0.3
          },
          {
            label: '75th Percentile',
            data: mcResult.paths.p75,
            borderColor: 'rgba(34,197,94,0.6)',
            backgroundColor: 'rgba(34,197,94,0.05)',
            fill: '+1',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3
          },
          {
            label: 'Median',
            data: mcResult.paths.p50,
            borderColor: this.colors.primary,
            backgroundColor: 'rgba(99,102,241,0.1)',
            fill: false,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.3
          },
          {
            label: '25th Percentile',
            data: mcResult.paths.p25,
            borderColor: 'rgba(245,158,11,0.6)',
            backgroundColor: 'rgba(245,158,11,0.05)',
            fill: '-1',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3
          },
          {
            label: '10th Percentile',
            data: mcResult.paths.p10,
            borderColor: 'rgba(239,68,68,0.5)',
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderDash: [3, 3],
            pointRadius: 0,
            tension: 0.3
          }
        ]
      },
      options: {
        ...this.defaultOptions(),
        aspectRatio: 2.2,
      }
    });
  },

  // ── Monte Carlo Histogram ─────────────────────────
  renderHistogram(canvasId, finalBalances) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // Create histogram bins
    const sorted = [...finalBalances].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const binCount = 30;
    const binSize = (max - min) / binCount || 1;
    const bins = Array(binCount).fill(0);
    const binLabels = [];

    for (let i = 0; i < binCount; i++) {
      const start = min + i * binSize;
      binLabels.push('$' + (start / 1000).toFixed(0) + 'K');
    }

    sorted.forEach(val => {
      const idx = Math.min(Math.floor((val - min) / binSize), binCount - 1);
      bins[idx]++;
    });

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: binLabels,
        datasets: [{
          label: 'Frequency',
          data: bins,
          backgroundColor: bins.map((_, i) => {
            const pct = i / binCount;
            if (pct < 0.2) return 'rgba(239,68,68,0.7)';
            if (pct < 0.4) return 'rgba(245,158,11,0.7)';
            return 'rgba(99,102,241,0.7)';
          }),
          borderRadius: 4,
        }]
      },
      options: {
        ...this.defaultOptions(),
        plugins: {
          ...this.defaultOptions().plugins,
          legend: { display: false },
          tooltip: {
            ...this.defaultOptions().plugins.tooltip,
            callbacks: {
              label: (ctx) => `${ctx.raw} simulations`
            }
          }
        },
        scales: {
          ...this.defaultOptions().scales,
          x: {
            ...this.defaultOptions().scales.x,
            ticks: {
              color: '#64748b',
              font: { size: 9 },
              maxRotation: 45,
              autoSkip: true,
              maxTicksLimit: 15
            }
          },
          y: {
            ...this.defaultOptions().scales.y,
            ticks: {
              color: '#64748b',
              font: { size: 11 },
              callback: (v) => v
            }
          }
        }
      }
    });
  },

  // ── Milestones Timeline ───────────────────────────
  renderMilestones(canvasId, milestones, projections) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (!projections.length || !milestones.length) return;

    const labels = projections.map(p => p.year);
    const netWorthData = projections.map(p => p.netWorth);

    const annotations = {};
    milestones.forEach((m, i) => {
      if (m.targetAmount) {
        annotations['ms_line_' + i] = {
          type: 'line',
          yMin: m.targetAmount,
          yMax: m.targetAmount,
          borderColor: [this.colors.orange, this.colors.green, this.colors.purple, this.colors.teal][i % 4],
          borderWidth: 1.5,
          borderDash: [6, 4],
          label: {
            display: true,
            content: m.name + ' ($' + (m.targetAmount / 1000).toFixed(0) + 'K)',
            position: 'end',
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: '#f1f5f9',
            font: { size: 10 }
          }
        };
      }
    });

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Projected Net Worth',
          data: netWorthData,
          borderColor: this.colors.primary,
          backgroundColor: this.colors.primaryLight,
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 0
        }]
      },
      options: {
        ...this.defaultOptions(),
        plugins: {
          ...this.defaultOptions().plugins,
          annotation: { annotations }
        }
      }
    });
  },

  // ── Net Worth History Chart ───────────────────────
  renderNetWorthHistory(canvasId, history) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx || !history.length) return;

    const labels = history.map(h => h.date);
    const nwData = history.map(h => h.netWorth);
    const assetsData = history.map(h => h.assets || null);
    const liabData = history.map(h => h.liabilities ? -h.liabilities : null);

    const datasets = [
      {
        label: 'Net Worth',
        data: nwData,
        borderColor: this.colors.green,
        backgroundColor: this.colors.greenLight,
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: this.colors.green,
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
        pointHoverRadius: 6
      }
    ];

    if (assetsData.some(v => v !== null)) {
      datasets.push({
        label: 'Assets',
        data: assetsData,
        borderColor: this.colors.blue,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [5, 5],
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: this.colors.blue,
        pointHoverRadius: 5
      });
    }
    if (liabData.some(v => v !== null)) {
      datasets.push({
        label: 'Liabilities',
        data: liabData.map(v => v !== null ? Math.abs(v) : null),
        borderColor: this.colors.red,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [5, 5],
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: this.colors.red,
        pointHoverRadius: 5
      });
    }

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        ...this.defaultOptions(),
        scales: {
          ...this.defaultOptions().scales,
          x: {
            ...this.defaultOptions().scales.x,
            ticks: {
              color: '#64748b',
              font: { size: 10 },
              maxRotation: 45,
              autoSkip: true,
              maxTicksLimit: 15
            }
          }
        }
      }
    });
  }
};

(() => {
  'use strict';

  const root = document.getElementById('results-ui');
  if (!root) return;

  const metrics = [
    { key: 'mask_psnr', label: 'Mask PSNR', short: 'PSNR', direction: 'max', digits: 2, unit: 'dB', note: 'Finite video mean. Zero-MSE videos are counted separately below.' },
    { key: 'mask_ssim', label: 'Mask SSIM', short: 'SSIM', direction: 'max', digits: 4, note: 'SSIM averaged within the ground-truth pixel mask.' },
    { key: 'mask_lpips', label: 'Mask LPIPS', short: 'LPIPS', direction: 'min', digits: 4, note: 'Perceptual distance on ground-truth-composited union-mask crops.' },
    { key: 'mask_dists', label: 'Mask DISTS', short: 'DISTS', direction: 'min', digits: 4, note: 'Perceptual distance on ground-truth-composited union-mask crops.' },
    { key: 'mask_vfid', label: 'Mask VFID', short: 'VFID', direction: 'min', digits: 4, overallOnly: true, note: 'Global Fréchet distance on ground-truth-composited union-mask crop videos. Available overall only.' },
    { key: 'mask_twe_pred', label: 'TWE Pred', short: 'TWE Pred', direction: 'min', digits: 2, tableOnly: true },
    { key: 'mask_twe_gt', label: 'TWE GT', short: 'TWE GT', digits: 2, tableOnly: true },
    { key: 'mask_twe_gap', label: 'TWE Gap', short: 'TWE Gap', direction: 'min', digits: 4, note: 'Reported gap between prediction and ground-truth temporal warping error.' },
    { key: 'mask_tc', label: 'Temporal Consistency', short: 'TC', direction: 'min', digits: 3, note: 'Mask-restricted temporal consistency error under the supplied evaluation protocol.' },
    { key: 'mask_flow_mean', label: 'Flow Mean', short: 'Flow Mean', direction: 'min', digits: 3, note: 'Reported mask-region Flow Mean under the supplied evaluation protocol.' },
    { key: 'mask_flow_var', label: 'Flow Variance', short: 'Flow Var', direction: 'min', digits: 3, note: 'Reported mask-region Flow Variance under the supplied evaluation protocol.' }
  ];
  const count = value => Number(value).toLocaleString('en-US');
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const arrow = metric => metric.direction === 'max' ? '↑' : metric.direction === 'min' ? '↓' : '';
  const format = (value, metric) => Number.isFinite(value) ? value.toFixed(metric.digits) : value === Infinity ? '∞' : '—';
  const bestValue = (records, metric) => {
    const values = records.map(record => record.values[metric.key]).filter(Number.isFinite);
    return !metric.direction || !values.length ? null : Math[metric.direction](...values);
  };

  root.classList.add('dvte-results');
  root.setAttribute('aria-busy', 'true');
  root.append(make('p', 'dr-loading', 'Loading the benchmark results…'));

  const readJson = url => fetch(url, { cache: 'no-cache' }).then(response => {
    if (!response.ok) throw new Error('Results request failed');
    return response.json();
  });
  Promise.all([
    readJson('../data/benchmark.json?v=20261020'),
    readJson('model-previews.json?v=20261020').catch(() => null)
  ])
    .then(([benchmark, previews]) => {
      const { methods, protocol } = benchmark.results;
      if (!Array.isArray(methods) || !methods.length || !Array.isArray(benchmark.categories)) throw new Error('Results data is incomplete');
      const verifiedSettings = new Map((Array.isArray(previews?.methods) ? previews.methods : []).map(method => [method.id, method.configuration]));
      const inferenceProtocol = previews?.protocol;
      const configurationFor = method => verifiedSettings.get(method.id === 'minimax-remover' ? 'minimax_remover' : method.id) || method.configuration;
      let metricKey = 'mask_psnr';
      let categoryId = 'overall';

      const panel = make('div', 'dr-panel');
      const toolbar = make('div', 'dr-toolbar');
      const selectors = make('div', 'dr-selectors');
      const metricLabel = make('label', 'dr-select-label', 'Compare a metric');
      const metricSelect = make('select', 'dr-select');
      metricSelect.id = 'dvte-result-metric';
      const metricOptions = new Map();
      metrics.filter(metric => !metric.tableOnly).forEach(metric => {
        const option = make('option', '', `${metric.label} ${arrow(metric)}${metric.overallOnly ? ' · overall only' : ''}`);
        option.value = metric.key;
        metricOptions.set(metric.key, option);
        metricSelect.append(option);
      });
      metricLabel.htmlFor = metricSelect.id;
      metricLabel.append(metricSelect);
      const categoryLabel = make('label', 'dr-select-label', 'Text category');
      const categorySelect = make('select', 'dr-select');
      categorySelect.id = 'dvte-result-category';
      categoryLabel.htmlFor = categorySelect.id;
      const overallOption = make('option', '', `Overall · ${count(protocol.samples)} videos`);
      overallOption.value = 'overall';
      categorySelect.append(overallOption);
      benchmark.categories.forEach(category => {
        const option = make('option', '', `${category.label} · ${count(category.count)}`);
        option.value = category.id;
        categorySelect.append(option);
      });
      categoryLabel.append(categorySelect);
      selectors.append(metricLabel, categoryLabel);
      const download = make('a', 'dr-download', 'Download CSV ↗');
      download.href = '../data/results.csv';
      download.download = 'DVTE-Bench-results.csv';
      toolbar.append(selectors, download);

      const chart = make('div', 'dr-chart');
      const chartHeader = make('div', 'dr-chart-header');
      const titleBlock = make('div', 'dr-chart-title-block');
      const chartTitle = make('h3', 'dr-chart-title');
      const chartScope = make('p', 'dr-chart-scope');
      titleBlock.append(chartTitle, chartScope);
      const direction = make('span', 'dr-direction');
      chartHeader.append(titleBlock, direction);
      const rows = make('ol', 'dr-bars');
      rows.setAttribute('aria-label', 'Method comparison');
      const chartAxis = make('div', 'dr-axis');
      const axisStart = make('span', '', '0');
      const axisEnd = make('span');
      chartAxis.append(axisStart, axisEnd);
      const chartNote = make('p', 'dr-chart-note');
      const psnrNote = make('p', 'dr-psnr-note');
      chart.append(chartHeader, rows, chartAxis, chartNote, psnrNote);

      const configuration = make('div', 'dr-configurations');
      configuration.append(make('p', 'dr-mini-heading', verifiedSettings.size ? 'Verified inference settings' : 'Reported method settings'));
      const configList = make('ul', 'dr-config-list');
      methods.forEach(method => {
        const item = make('li');
        item.append(make('strong', '', method.label), make('span', '', configurationFor(method)));
        configList.append(item);
      });
      configuration.append(configList, make('p', 'dr-setting-note', inferenceProtocol
        ? 'GT bounding boxes guide Ours and the masked baselines; CLEAR is mask-free. For Ours, packed pixel masks are used for scoring, not as model conditioning. All methods are scored in the dataset ground-truth pixel mask region; inference inputs and paste-back settings differ.'
        : 'Methods use the settings listed above; inference inputs and postprocessing differ. All reported scores are evaluated in the dataset ground-truth pixel mask region.'));

      const details = make('details', 'dr-table-details');
      const summary = make('summary', 'dr-table-summary');
      const summaryLabel = make('span', '', 'Explore the full numbers');
      const summaryCount = make('span', 'dr-summary-count');
      summary.append(summaryLabel, summaryCount);
      const tableIntro = make('p', 'dr-table-intro', 'The table follows the selected text category. Switch on full precision to inspect the exact stored values. The CSV contains every result.');
      const precisionLabel = make('label', 'dr-precision-label');
      const precisionInput = make('input');
      precisionInput.type = 'checkbox';
      precisionLabel.append(precisionInput, document.createTextNode('Show full precision'));
      const tableWrap = make('div', 'dr-table-wrap');
      tableWrap.tabIndex = 0;
      tableWrap.setAttribute('role', 'region');
      tableWrap.setAttribute('aria-label', 'Full benchmark results; scroll horizontally for all metrics');
      const table = make('table', 'dr-table');
      const tableCaption = make('caption');
      const tableHead = make('thead');
      const tableBody = make('tbody');
      table.append(tableCaption, tableHead, tableBody);
      tableWrap.append(table);
      const footnote = make('p', 'dr-table-footnote', '† Mask PSNR is the finite mean; zero-MSE videos retain PSNR = ∞ in the evaluation. The number of infinite videos is shown with each PSNR value. Highlighting compares the finite means. VFID is a global statistic and is reported overall only. TWE GT is a reference, so it is not ranked.');
      details.append(summary, tableIntro, precisionLabel, tableWrap, footnote);

      const protocolDetails = make('details', 'dr-protocol-details');
      protocolDetails.append(make('summary', '', 'Evaluation protocol & data disclosure'));
      const protocolBody = make('div', 'dr-protocol-body');
      [
        ['Coverage', protocol.selection],
        ['Metric region', protocol.metricScope],
        ...(inferenceProtocol ? [
          ['Inference guidance', inferenceProtocol.oursConditioning],
          ['Ours paste-back', `Pixel-mode seamless blend with ${inferenceProtocol.oursPasteback.dilationPixels}-pixel dilation, ${inferenceProtocol.oursPasteback.featherPixels}-pixel feathering, ring color matching and color-match EMA ${inferenceProtocol.oursPasteback.colorMatchEMA}.`],
          ['Baseline paste-back', inferenceProtocol.baselinePasteback],
          ['Inference steps', inferenceProtocol.speedCaveat]
        ] : []),
        ['Aggregation', protocol.aggregation],
        ['PSNR policy', protocol.maskPsnrPolicy],
        ['Spatial metrics', 'LPIPS, DISTS and VFID use ground-truth-composited union-mask crops. VFID uses ProPainter RGB-I3D 1024-D features.'],
        ['Temporal metrics', 'The temporal region is the current mask union the previous mask warped to the current frame by ground-truth backward flow. Flow metrics use the corresponding forward-flow region. Farneback flow uses a maximum side of 320.'],
        ['Seen-data disclosure', 'The overall evaluation includes 68 seen ASR regression samples with training overlap. The ASR category is identified separately; the overall score is not an unseen-only result.']
      ].forEach(([label, text]) => {
        const line = make('p');
        line.append(make('strong', '', `${label}. `), document.createTextNode(String(text || 'See the benchmark data.')));
        protocolBody.append(line);
      });
      protocolDetails.append(protocolBody);
      panel.append(toolbar, chart, configuration, details, protocolDetails);
      root.replaceChildren(panel);

      function update() {
        const metric = metrics.find(item => item.key === metricKey);
        const category = benchmark.categories.find(item => item.id === categoryId);
        const records = methods.map(method => ({ method, values: categoryId === 'overall' ? method.overall : method.byType[categoryId] }));
        if (records.some(record => !record.values)) throw new Error('Selected result is missing');
        const best = bestValue(records, metric);
        const values = records.map(record => record.values[metric.key]).filter(Number.isFinite);
        const maximum = Math.max(...values, 0);
        const scalePower = maximum > 0 ? 10 ** Math.floor(Math.log10(maximum)) : 1;
        const scaleMax = maximum > 0 ? Math.ceil(maximum / scalePower * 2) * scalePower / 2 : 1;
        const scopeName = category ? category.label : 'Overall';
        const samples = records[0].values.samples;
        metricOptions.get('mask_vfid').disabled = categoryId !== 'overall';
        metricSelect.value = metricKey;
        categorySelect.value = categoryId;
        chartTitle.textContent = `${metric.label}${metric.key === 'mask_psnr' ? ' · finite mean' : ''}`;
        chartScope.textContent = `${scopeName} · ${count(samples)} videos · ground-truth pixel mask region`;
        direction.textContent = `${arrow(metric)} ${metric.direction === 'max' ? 'Higher' : 'Lower'} is better`;
        direction.classList.toggle('dr-lower', metric.direction === 'min');
        rows.replaceChildren();
        records.forEach(({ method, values: result }) => {
          const value = result[metric.key];
          const isBest = best !== null && value === best;
          const item = make('li', `dr-bar-row${isBest ? ' is-best' : ''}${method.id === 'ours' ? ' is-ours' : ''}`);
          const methodName = make('div', 'dr-bar-method');
          methodName.append(make('span', '', method.label));
          if (isBest) methodName.append(make('span', 'dr-best-label', 'Best'));
          const track = make('div', 'dr-bar-track');
          track.setAttribute('aria-hidden', 'true');
          const fill = make('span', 'dr-bar-fill');
          fill.style.width = `${Number.isFinite(value) ? Math.max(0, value / scaleMax * 100) : 0}%`;
          track.append(fill);
          const score = make('span', 'dr-bar-score', `${format(value, metric)}${metric.unit ? ` ${metric.unit}` : ''}`);
          score.title = `Full precision: ${String(value)}`;
          score.tabIndex = 0;
          item.append(methodName, track, score);
          rows.append(item);
        });
        axisEnd.textContent = `${Number(scaleMax.toPrecision(6))}${metric.unit ? ` ${metric.unit}` : ''}`;
        chartNote.textContent = `${metric.note} Bars share a zero baseline; teal marks the best reported value for this selection.`;
        psnrNote.hidden = metric.key !== 'mask_psnr';
        psnrNote.textContent = `PSNR = ∞ videos: ${records.map(({ method, values: result }) => `${method.label} ${count(result.mask_psnr_infinite_samples || 0)}`).join(' · ')}.`;

        const tableMetrics = metrics.filter(item => categoryId === 'overall' || !item.overallOnly);
        summaryCount.textContent = `${tableMetrics.length} metrics · ${scopeName}`;
        tableCaption.textContent = `${scopeName}: ${count(samples)} videos, evaluated in the ground-truth pixel mask region`;
        const headings = make('tr');
        ['Method', 'Videos', ...tableMetrics.map(item => `${item.short}${item.key === 'mask_psnr' ? '†' : ''} ${arrow(item)}`)].forEach(label => {
          const heading = make('th', '', label);
          heading.scope = 'col';
          headings.append(heading);
        });
        tableHead.replaceChildren(headings);
        tableBody.replaceChildren();
        const bestByMetric = new Map(tableMetrics.map(item => [item.key, bestValue(records, item)]));
        records.forEach(({ method, values: result }) => {
          const row = make('tr', method.id === 'ours' ? 'dr-ours-row' : '');
          const name = make('th', '', method.label);
          name.scope = 'row';
          name.title = configurationFor(method);
          row.append(name, make('td', '', count(result.samples)));
          tableMetrics.forEach(definition => {
            const value = result[definition.key];
            const isBest = bestByMetric.get(definition.key) !== null && value === bestByMetric.get(definition.key);
            const cell = make('td', isBest ? 'dr-best-cell' : '');
            const displayed = precisionInput.checked && Number.isFinite(value) ? String(value) : format(value, definition);
            const number = make('span', 'dr-table-number', displayed);
            number.tabIndex = 0;
            number.title = `Full precision: ${String(value)}${isBest ? ' · Best reported value' : ''}`;
            if (isBest) number.setAttribute('aria-label', `${displayed}, best reported value`);
            cell.append(number);
            if (definition.key === 'mask_psnr') cell.append(make('small', 'dr-infinity-count', `∞ × ${count(result.mask_psnr_infinite_samples || 0)}`));
            row.append(cell);
          });
          tableBody.append(row);
        });
      }

      metricSelect.addEventListener('change', () => {
        metricKey = metricSelect.value;
        update();
      });
      categorySelect.addEventListener('change', () => {
        categoryId = categorySelect.value;
        if (categoryId !== 'overall' && metrics.find(metric => metric.key === metricKey).overallOnly) metricKey = 'mask_psnr';
        update();
      });
      precisionInput.addEventListener('change', update);
      update();
      root.setAttribute('aria-busy', 'false');
    })
    .catch(() => {
      const error = make('p', 'dr-error', 'The result explorer could not load. ');
      const fallback = make('a', '', 'View the original results table ↗');
      fallback.href = '../original.html#results';
      error.append(fallback);
      root.replaceChildren(error);
      root.setAttribute('aria-busy', 'false');
    });
})();

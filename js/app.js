(function () {
  'use strict';

  var data = window.MockData;

  function money(value) {
    return '¥' + Number(value || 0).toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function moneyOrDash(value) {
    return value == null ? '—' : money(value);
  }

  function priceSource(item, type) {
    if (type === 'couponFaceValue') return '卡券中心';
    if (type === 'mallProductPrice' && item.sourceSystem !== '商城') return '不适用';
    return item.sourceSystem;
  }

  function basisSource(item) {
    var map = {
      '商城商品单价': 'mallProductPrice',
      '实际优惠金额': 'actualDiscountAmount',
      '卡券面值': 'couponFaceValue',
      '网点价': 'dealerPrice'
    };
    return priceSource(item, map[item.priceBasisType] || 'actualDiscountAmount');
  }

  function renderPriceCard(item, label, type, value) {
    var basisByType = {
      mallProductPrice: '商城商品单价',
      actualDiscountAmount: '实际优惠金额',
      couponFaceValue: '卡券面值',
      dealerPrice: '网点价'
    };
    var selected = basisByType[type] === item.priceBasisType ? ' selected' : '';
    return '<div class="price-card' + selected + '"><span>' + label + '</span><strong>' + moneyOrDash(value) + '</strong><small>来源：' + priceSource(item, type) + '</small></div>';
  }

  function renderAmountSnapshot(item, type, value, note) {
    var source = priceSource(item, type);
    return '<div class="snapshot-cell"><strong>' + moneyOrDash(value) + '</strong><small>' + source + (note ? ' · ' + note : '') + '</small></div>';
  }

  function safe(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function identityColumns(record) {
    return {
      vin: record.vin || '—',
      mobile: record.mobile || '—',
      oneId: record.oneId || '—'
    };
  }

  function renderIdentityColumns(record) {
    var identity = identityColumns(record);
    return '<td class="identity-cell">' + identity.vin + '</td>' +
      '<td class="identity-cell">' + identity.mobile + '</td>' +
      '<td class="identity-cell">' + identity.oneId + '</td>';
  }

  function renderIdentitySummary(record) {
    var identity = identityColumns(record);
    return '<div class="identity-summary"><strong>VIN：' + identity.vin + '</strong><small>手机号码：' + identity.mobile + '</small><small>oneID：' + identity.oneId + '</small></div>';
  }

  function applicableProducts(item) {
    return item.products.filter(function (product) { return product.applicable !== false; });
  }

  function applicableMeta(item) {
    return { count: applicableProducts(item).length, total: item.products.length };
  }

  function applicableMallAmount(item) {
    if (item.sourceSystem !== '商城') return null;
    return applicableProducts(item).reduce(function (sum, product) { return sum + Number(product.amount || 0); }, 0);
  }

  function applicableActualDiscount(item) {
    return applicableProducts(item).reduce(function (sum, product) {
      return sum + Math.max(0, Number(product.discount || 0) - Number(product.refund || 0));
    }, 0);
  }

  function applicableDealerAmount(item) {
    return applicableProducts(item).reduce(function (sum, product) { return sum + Number(product.dealerPrice || 0); }, 0);
  }

  function settlementBasisValue(item) {
    if (item.priceBasisType === '商城商品单价') return applicableMallAmount(item);
    if (item.priceBasisType === '实际优惠金额') return applicableActualDiscount(item);
    if (item.priceBasisType === '卡券面值') return item.couponFaceValue;
    if (item.priceBasisType === '网点价') return applicableDealerAmount(item);
    return item.priceBasisValue;
  }

  function statusMeta(status) {
    var map = {
      refundable: { label: '退款窗口内', cls: 'status-warn' },
      processing: { label: 'E3S 处理中', cls: 'status-info' },
      settled: { label: '已结算', cls: 'status-done' },
      closed: { label: '无需结算', cls: 'status-muted' }
    };
    return map[status] || map.refundable;
  }

  function pageHead(title, subtitle, actions) {
    return '<div class="breadcrumb">卡券中心 <span>/</span> 卡券结算 <span>/</span> ' + title + '</div>' +
      '<div class="page-head"><div><h1>' + title + '</h1><p>' + subtitle + '</p></div><div class="page-actions">' + (actions || '') + '</div></div>';
  }

  function metricCard(label, value, foot, tone) {
    return '<div class="metric-card ' + (tone || '') + '"><div class="metric-label">' + label + '<span class="metric-dot"></span></div>' +
      '<div class="metric-value">' + value + '</div><div class="metric-foot">' + foot + '</div></div>';
  }

  function renderFlow() {
    var steps = [
      ['1', '核销明细回传', '商品、适用性与价格快照'],
      ['2', '筛选适用商品', '不适用商品不进入计算'],
      ['3', '退款/撤销重算', '仅扣减适用商品优惠'],
      ['4', '订单冻结', '不可退款后确定最终金额'],
      ['5', '提交 E3S', '每冻结一次订单提交一次']
    ];
    return '<section class="process-strip"><div class="process-title"><strong>卡券结算链路</strong><span>区分核销渠道与来源系统，不按账期，订单冻结后自动提交</span></div><div class="process-steps">' +
      steps.map(function (step, index) {
        return '<div class="process-step"><span class="step-index">' + step[0] + '</span><div><strong>' + step[1] + '</strong><small>' + step[2] + '</small></div></div>' +
          (index < steps.length - 1 ? '<span class="step-arrow">→</span>' : '');
      }).join('') + '</div></section>';
  }

  function renderReportRows(rows) {
    return rows.map(function (item) {
      var status = statusMeta(item.status);
      var identity = identityColumns(item);
      var applicability = applicableMeta(item);
      var actualDiscount = applicableActualDiscount(item);
      return '<tr data-status="' + item.status + '" data-channel="' + item.writeoffChannel + '" data-source="' + item.sourceSystem + '" data-search="' + [item.id, item.couponName, item.user, item.orderNo, identity.vin, identity.mobile, identity.oneId, item.writeoffChannel, item.sourceSystem].join(' ') + '">' +
        '<td><button class="link-btn detail-btn" data-id="' + item.id + '">' + item.id + '</button><small class="cell-sub">' + item.orderNo + '</small></td>' +
        '<td><strong class="cell-title">' + item.couponName + '</strong><small class="cell-sub">' + item.couponCode + '</small></td>' +
        renderIdentityColumns(item) +
        '<td><span class="writeoff-tag ' + (item.writeoffChannel === '线上' ? 'online' : 'offline') + '">' + item.writeoffChannel + '</span></td>' +
        '<td><span class="source-system-tag">' + item.sourceSystem + '</span></td>' +
        '<td>' + renderAmountSnapshot(item, 'mallProductPrice', applicableMallAmount(item), applicability.count + '/' + applicability.total + ' 件适用') + '</td>' +
        '<td>' + renderAmountSnapshot(item, 'actualDiscountAmount', actualDiscount, '仅适用商品' + (item.refundDeduction ? ' · 已扣退款 ' + money(item.refundDeduction) : '')) + '</td>' +
        '<td>' + renderAmountSnapshot(item, 'couponFaceValue', item.couponFaceValue) + '</td>' +
        '<td>' + renderAmountSnapshot(item, 'dealerPrice', applicableDealerAmount(item), '仅适用商品') + '</td>' +
        '<td><strong class="basis-type">' + item.priceBasisType + '</strong><small class="cell-sub">' + item.priceBasisNote + '</small></td>' +
        '<td class="amount-cell emphasized">' + money(settlementBasisValue(item)) + '</td>' +
        '<td><span class="original-rule">' + item.rule + '</span><small class="cell-sub">规则 ' + item.ruleVersion + '</small></td>' +
        '<td><span class="rule-line">' + money(item.settlement) + '</span></td>' +
        '<td><span class="status-pill ' + status.cls + '"><i></i>' + status.label + '</span><small class="cell-sub">' + item.statusTime + '</small></td>' +
        '<td><button class="link-btn detail-btn" data-id="' + item.id + '">详情</button></td></tr>';
    }).join('');
  }

  function reportPage() {
    return pageHead('卡券实例结算报表', '仅使用卡券适用商品汇总价格与优惠，再按原结算规则计算补贴金额。', '<button class="btn">导出当前结果</button>') +
      renderFlow() +
      '<div class="metrics-grid">' +
        metricCard('卡券实例数', data.summary.total, '线上与线下累计写入', 'metric-blue') +
        metricCard('退款窗口内', data.summary.refundable, '仅展示预计结算金额', 'metric-amber') +
        metricCard('E3S 处理中', data.summary.processing, '订单冻结后已自动提交', 'metric-purple') +
        metricCard('累计已结算', money(data.summary.settledAmount), 'E3S 已确认金额', 'metric-green') + '</div>' +
      '<section class="content-card filter-card"><div class="filter-grid report-filter-grid">' +
        '<label><span>快速搜索</span><input id="keyword" class="form-input" placeholder="实例ID / 订单号 / VIN / 手机号 / oneID"></label>' +
        '<label><span>核销渠道</span><select id="writeoff-channel-filter" class="form-select"><option value="">全部渠道</option><option value="线上">线上</option><option value="线下">线下</option></select></label>' +
        '<label><span>核销来源</span><select id="source-filter" class="form-select"><option value="">全部来源</option><option value="商城">商城</option><option value="E3S">E3S</option></select></label>' +
        '<label><span>结算状态</span><select id="status-filter" class="form-select"><option value="">全部状态</option><option value="refundable">退款窗口内</option><option value="processing">E3S 处理中</option><option value="settled">已结算</option><option value="closed">无需结算</option></select></label>' +
        '<div class="filter-actions"><button id="search-btn" class="btn btn-primary">查询</button><button id="reset-btn" class="btn">重置</button></div>' +
      '</div></section>' +
      '<div class="rule-notice"><span class="notice-icon">i</span><div><strong>先判定商品适用性，再计算补贴</strong><p>商城逐商品回传卡券适用标记、商品价格、实际优惠和网点价。卡券中心只汇总“适用”商品；不适用商品保留在明细中用于核对，但不进入结算基数。</p></div></div>' +
      '<section class="content-card table-card"><div class="table-toolbar"><div><strong>实例明细</strong><span id="result-count">共 ' + data.instances.length + ' 条</span></div><div class="table-hint"><span class="lock-icon">⇄</span>订单冻结后由系统自动提交 E3S</div></div>' +
      '<div class="table-wrapper"><table id="settlement-table"><thead><tr><th>实例ID / 订单号</th><th>卡券</th><th>VIN</th><th>手机号码</th><th>oneID</th><th>核销渠道</th><th>核销来源</th><th>适用商品商城价合计</th><th>适用商品实际优惠</th><th>卡券面值</th><th>适用商品网点价合计</th><th>价格标准类型</th><th>结算基数</th><th>结算规则</th><th>结算金额</th><th>结算状态</th><th>操作</th></tr></thead>' +
      '<tbody id="report-body">' + renderReportRows(data.instances) + '</tbody></table></div>' +
      '<div class="table-footer"><span>已展示 1-' + data.instances.length + ' 条</span><div class="pager"><button disabled>‹</button><button class="active">1</button><button>2</button><button>3</button><button>›</button></div></div></section>';
  }

  function bindReport() {
    var keyword = document.getElementById('keyword');
    var channelFilter = document.getElementById('writeoff-channel-filter');
    var sourceFilter = document.getElementById('source-filter');
    var statusFilter = document.getElementById('status-filter');

    function applyFilter() {
      var term = keyword.value.trim().toLowerCase();
      var channel = channelFilter.value;
      var source = sourceFilter.value;
      var status = statusFilter.value;
      var visible = 0;
      Array.prototype.forEach.call(document.querySelectorAll('#report-body tr'), function (row) {
        var matched = (!term || row.getAttribute('data-search').toLowerCase().indexOf(term) > -1) && (!channel || row.getAttribute('data-channel') === channel) && (!source || row.getAttribute('data-source') === source) && (!status || row.getAttribute('data-status') === status);
        row.hidden = !matched;
        if (matched) visible += 1;
      });
      document.getElementById('result-count').textContent = '共 ' + visible + ' 条';
    }

    document.getElementById('search-btn').addEventListener('click', applyFilter);
    document.getElementById('reset-btn').addEventListener('click', function () {
      keyword.value = '';
      channelFilter.value = '';
      sourceFilter.value = '';
      statusFilter.value = '';
      applyFilter();
    });
    bindDetailButtons();
  }

  function bindDetailButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('.detail-btn'), function (button) {
      button.addEventListener('click', function () { openDetail(this.getAttribute('data-id')); });
    });
  }

  function closeLayer() {
    var layer = document.querySelector('.prototype-layer');
    if (layer) layer.remove();
  }

  function openDetail(id) {
    var item = data.instances.filter(function (row) { return row.id === id; })[0];
    if (!item) return;
    var meta = statusMeta(item.status);
    var applicability = applicableMeta(item);
    var actualDiscount = applicableActualDiscount(item);
    var basisValue = settlementBasisValue(item);
    var routedConfig = item.writeoffChannel === '线上' ? '线上配置' : '线下配置';
    var isFinal = ['processing', 'settled', 'closed'].indexOf(item.status) > -1;
    var submissionProof = item.requestId ? '<div class="submission-proof"><span class="gate-icon">⇄</span><div><strong>订单冻结后已自动提交 E3S</strong><p>请求ID：' + item.requestId + '，每次订单冻结只提交一次结算。</p></div></div>' : '';
    var layer = document.createElement('div');
    layer.className = 'prototype-layer drawer-layer';
    layer.innerHTML = '<div class="layer-backdrop"></div><aside class="detail-drawer"><div class="drawer-head"><div><span class="eyebrow">卡券实例结算详情</span><h2>' + item.id + '</h2></div><button class="close-btn" aria-label="关闭">×</button></div>' +
      '<div class="drawer-body"><div class="detail-summary"><div><span>卡券名称</span><strong>' + item.couponName + '</strong></div><div><span>VIN / 手机号码 / oneID</span>' + renderIdentitySummary(item) + '<small class="detail-order">订单：' + item.orderNo + '</small></div><div><span>核销渠道 / 来源</span><strong>' + item.writeoffChannel + ' · ' + item.sourceSystem + '</strong></div><div><span>当前状态</span><strong><span class="status-pill ' + meta.cls + '"><i></i>' + meta.label + '</span></strong></div></div>' +
      '<div class="amount-bridge"><div><span>适用商品券优惠</span><strong>' + money(item.discount) + '</strong></div><b>−</b><div><span>适用商品退款扣减</span><strong class="deduction">' + money(item.refundDeduction) + '</strong></div><b>=</b><div class="amount-final"><span>' + (isFinal ? '最终适用商品优惠' : '当前适用商品优惠') + '</span><strong>' + money(actualDiscount) + '</strong></div></div>' +
      '<div class="price-snapshot-grid">' +
        renderPriceCard(item, '适用商品商城价合计', 'mallProductPrice', applicableMallAmount(item)) +
        renderPriceCard(item, '适用商品实际优惠', 'actualDiscountAmount', actualDiscount) +
        renderPriceCard(item, '卡券面值', 'couponFaceValue', item.couponFaceValue) +
        renderPriceCard(item, '适用商品网点价合计', 'dealerPrice', applicableDealerAmount(item)) +
      '</div>' +
      '<div class="detail-section"><div class="section-title"><div><h3>订单商品适用性与优惠拆分</h3><p>订单共 ' + applicability.total + ' 件商品，' + applicability.count + ' 件适用；仅适用商品进入补贴计算</p></div><span class="source-badge">' + item.sourceSystem + ' 回传</span></div>' +
      '<div class="mini-table"><table><thead><tr><th>商品</th><th>卡券适用性</th><th>商城价 / 网点价</th><th>分摊优惠</th><th>退款扣减</th><th>状态</th></tr></thead><tbody>' +
      item.products.map(function (product) { var applicable = product.applicable !== false; return '<tr class="' + (applicable ? '' : 'non-applicable-row') + '"><td><strong>' + product.name + '</strong><small class="cell-sub">' + product.sku + '</small></td><td><span class="applicable-tag ' + (applicable ? 'yes' : 'no') + '">' + (applicable ? '适用' : '不适用') + '</span><small class="cell-sub">' + product.applicableReason + '</small></td><td><strong>商城 ' + money(product.amount) + '</strong><small class="cell-sub">网点 ' + money(product.dealerPrice) + '</small></td><td>' + money(product.discount) + '</td><td class="deduction">' + (product.refund ? '-' + money(product.refund) : money(0)) + '</td><td>' + product.state + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>' +
      '<div class="detail-section calc-panel"><div class="section-title"><div><h3>结算计算</h3><p>核销渠道为“' + item.writeoffChannel + '”，自动选择' + routedConfig + '；先过滤适用商品，再按规则 ' + item.ruleVersion + ' 计算；基数来源：' + basisSource(item) + '</p></div><button class="link-btn" data-nav-rule>查看结算规则</button></div>' +
      '<div class="formula"><span>' + money(basisValue) + '<small>' + item.priceBasisType + ' / 适用商品结算基数</small></span><b>×</b><span>80%<small>规则结算比例</small></span><b>=</b><span class="formula-result">' + money(item.settlement) + '<small>' + (isFinal ? '最终应结算' : '预计应结算') + '</small></span></div>' +
      (!isFinal ? '<div class="inline-warning">当前订单仍可退款，此金额仅供预览，暂不可发送 E3S。</div>' : submissionProof) + '</div>' +
      '<div class="detail-section"><div class="section-title"><div><h3>变更记录</h3><p>优惠回传、退款重算、金额冻结和 E3S 提交的完整链路</p></div></div><div class="timeline">' +
      item.events.map(function (event, index) { return '<div class="timeline-item ' + (index === item.events.length - 1 ? 'latest' : '') + '"><i></i><div><time>' + event[0] + '</time><strong>' + event[1] + '</strong><p>' + event[2] + '</p></div></div>'; }).join('') +
      '</div></div></div><div class="drawer-footer"><button class="btn close-action">关闭</button></div></aside>';
    document.body.appendChild(layer);
    layer.querySelector('.layer-backdrop').addEventListener('click', closeLayer);
    layer.querySelector('.close-btn').addEventListener('click', closeLayer);
    layer.querySelector('.close-action').addEventListener('click', closeLayer);
    var ruleLink = layer.querySelector('[data-nav-rule]');
    if (ruleLink) ruleLink.addEventListener('click', function () { closeLayer(); window.navigateTo('rule-config'); });
  }

  function renderRuleRows() {
    return data.rules.map(function (rule) {
      var statusClass = rule.status === '已启用' ? 'status-done' : 'status-warn';
      var onlineRule = rule.onlineMethod + ' ' + rule.onlineValue + (rule.onlineMethod === '比例结算' ? '%' : '元');
      var offlineRule = rule.offlineMethod + ' ' + rule.offlineValue + (rule.offlineMethod === '比例结算' ? '%' : '元');
      return '<tr data-rule-id="' + safe(rule.ruleId) + '" data-search="' + safe([rule.ruleId, rule.templateId, rule.templateName].join(' ').toLowerCase()) + '">' +
        '<td><strong>' + safe(rule.ruleId) + '</strong><small class="cell-sub">' + safe(rule.version) + '</small></td>' +
        '<td>' + safe(rule.templateId) + '</td><td><strong>' + safe(rule.templateName) + '</strong></td>' +
        '<td><span class="original-rule">' + safe(onlineRule) + '</span></td><td>' + safe(rule.onlinePriceBasis) + '</td>' +
        '<td><span class="original-rule">' + safe(offlineRule) + '</span></td><td>' + safe(rule.offlinePriceBasis) + '</td>' +
        '<td><span class="status-pill ' + statusClass + '"><i></i>' + safe(rule.status) + '</span>' + (rule.usedCount ? '<small class="cell-sub">已有 ' + rule.usedCount + ' 条核销</small>' : '') + '</td>' +
        '<td class="rule-actions"><button class="link-btn rule-edit" data-rule-id="' + safe(rule.ruleId) + '">编辑</button><button class="link-btn danger-link rule-delete" data-rule-id="' + safe(rule.ruleId) + '">删除</button></td></tr>';
    }).join('');
  }

  function renderRules() {
    return pageHead('卡券规则设置', '每套规则同时维护线上与线下配置，结算执行时按实例核销渠道自动选择。', '<button id="rule-export" class="btn">导出</button><button id="rule-create" class="btn btn-primary">新建结算规则</button>') +
      '<section class="content-card filter-card"><div class="filter-grid rule-filter-grid">' +
        '<label><span>规则 ID</span><input id="rule-id-filter" class="form-input" placeholder="请输入规则 ID"></label>' +
        '<label><span>模板 ID</span><input id="template-id-filter" class="form-input" placeholder="请输入模板 ID"></label>' +
        '<label><span>模板名称</span><input id="template-name-filter" class="form-input" placeholder="请输入模板名称"></label>' +
        '<div class="filter-actions"><button id="rule-search" class="btn btn-primary">查询</button><button id="rule-reset" class="btn">重置</button></div>' +
      '</div></section>' +
      '<div class="rule-notice"><span class="notice-icon">i</span><div><strong>规则维护不选择结算渠道</strong><p>每套规则同时配置线上和线下计算口径。实际结算时，系统读取卡券实例的核销渠道：线上使用线上配置，线下使用线下配置。</p></div></div>' +
      '<div class="route-diagram runtime-rule-route"><div class="route-source"><span>卡券实例</span><strong>读取核销渠道</strong></div><span class="route-arrow">→</span><div class="route-decision"><span>结算执行时判断</span><strong>自动选择规则分支</strong></div><span class="route-arrow">→</span><div class="route-targets"><div><b>线上核销</b><span>使用线上配置</span></div><div><b>线下核销</b><span>使用线下配置</span></div></div></div>' +
      '<section class="content-card table-card"><div class="table-toolbar"><div><strong>结算规则列表</strong><span id="rule-result-count">共 ' + data.rules.length + ' 条</span></div></div><div class="table-wrapper"><table class="rule-management-table"><thead><tr><th>规则 ID</th><th>模板 ID</th><th>模板名称</th><th>线上结算规则</th><th>线上价格标准值</th><th>线下结算规则</th><th>线下价格标准值</th><th>状态</th><th>操作</th></tr></thead><tbody id="rule-body">' + renderRuleRows() +
      '</tbody></table></div></section>';
  }

  function ruleSelect(value, options) {
    return options.map(function (option) { return '<option' + (option === value ? ' selected' : '') + '>' + safe(option) + '</option>'; }).join('');
  }

  function ruleRadio(name, value, options, sources) {
    return options.map(function (option) {
      return '<label><span><input type="radio" name="' + safe(name) + '" value="' + safe(option) + '"' + (option === value ? ' checked' : '') + '> ' + safe(option) + '</span>' + (sources && sources[option] ? '<small>' + safe(sources[option]) + '</small>' : '') + '</label>';
    }).join('');
  }

  function bindRuleFormBehavior(layer) {
    function bindUnit(methodName, unitName) {
      var method = layer.querySelector('select[name="' + methodName + '"]');
      var unit = layer.querySelector('[data-rule-unit="' + unitName + '"]');
      method.addEventListener('change', function () { unit.textContent = method.value === '比例结算' ? '%' : '元'; });
    }
    bindUnit('onlineMethod', 'online');
    bindUnit('offlineMethod', 'offline');
  }

  function closeRuleModal() {
    var modal = document.querySelector('.rule-modal-overlay');
    if (modal) modal.remove();
  }

  function openRuleModal(ruleId) {
    var rule = data.rules.filter(function (row) { return row.ruleId === ruleId; })[0];
    if (rule && rule.usedCount) {
      window.showToast('该规则已有核销记录，禁止编辑');
      return;
    }
    var isEdit = !!rule;
    var draft = rule || { ruleId: '', templateId: '', templateName: '', brand: '东风日产', onlineMethod: '比例结算', onlineValue: '80', onlinePriceBasis: '实际优惠金额', offlineMethod: '比例结算', offlineValue: '80', offlinePriceBasis: '用户价', version: 'V1.0', status: '草稿', usedCount: 0, remark: '' };
    var layer = document.createElement('div');
    layer.className = 'modal-overlay rule-modal-overlay';
    layer.innerHTML = '<div class="modal-content rule-modal"><div class="modal-header"><div><span class="eyebrow">卡券规则设置</span><h2>' + (isEdit ? '编辑结算规则' : '新建结算规则') + '</h2></div><button class="close-btn rule-modal-close" type="button">×</button></div>' +
      '<form id="rule-form"><div class="modal-body rule-form-body"><div class="rule-form-grid">' +
      '<label><span>品牌</span><select name="brand" class="form-select">' + ruleSelect(draft.brand, ['东风日产', '启辰']) + '</select></label>' +
      '<label><span>模板名称</span><input name="templateName" class="form-input" value="' + safe(draft.templateName) + '" required></label>' +
      '<label><span>模板 ID</span><input name="templateId" class="form-input" value="' + safe(draft.templateId) + '" required></label>' +
      '<label><span>规则版本</span><input name="version" class="form-input" value="' + safe(draft.version) + '" required></label>' +
      '<label><span>状态</span><select name="status" class="form-select">' + ruleSelect(draft.status, ['草稿', '已启用']) + '</select></label></div>' +
      '<div class="runtime-routing-note"><strong>线上、线下配置均需维护</strong><span>规则保存后，实际结算根据卡券实例的核销渠道自动选用对应配置。</span></div>' +
      '<section class="rule-config-section offline-config" data-rule-channel="offline"><div class="rule-section-title"><strong>线下补贴条件</strong><span>沿用原功能</span></div><div class="condition-grid"><label><input type="checkbox" checked> 存在活动产品出库</label><label><input type="checkbox"> 存在预约单</label><label><input type="checkbox" checked> 活动产品结算金额为 0</label><label><input type="checkbox"> 存在其它产品出库</label></div></section>' +
      '<section class="rule-config-section offline-config" data-rule-channel="offline"><div class="rule-section-title"><strong>线下补贴计算规则</strong></div><div class="rule-calc-grid"><label><span>线下结算规则</span><select name="offlineMethod" class="form-select">' + ruleSelect(draft.offlineMethod, ['固定金额', '比例结算']) + '</select></label><label><span>结算值</span><div class="value-input"><input name="offlineValue" class="form-input" value="' + safe(draft.offlineValue) + '"><b data-rule-unit="offline">' + (draft.offlineMethod === '比例结算' ? '%' : '元') + '</b></div></label></div><fieldset><legend>线下结算价格标准值</legend><div class="radio-options">' + ruleRadio('offlinePriceBasis', draft.offlinePriceBasis, ['用户价', '网点价', '实际优惠金额', '卡券面值']) + '</div></fieldset></section>' +
      '<section class="rule-config-section online-config" data-rule-channel="online"><div class="rule-section-title"><strong>线上补贴计算规则</strong></div><div class="rule-calc-grid"><label><span>线上结算规则</span><select name="onlineMethod" class="form-select">' + ruleSelect(draft.onlineMethod, ['固定金额', '比例结算']) + '</select></label><label><span>结算值</span><div class="value-input"><input name="onlineValue" class="form-input" value="' + safe(draft.onlineValue) + '"><b data-rule-unit="online">' + (draft.onlineMethod === '比例结算' ? '%' : '元') + '</b></div></label></div><fieldset><legend>线上结算价格标准值</legend><div class="radio-options source-aware">' + ruleRadio('onlinePriceBasis', draft.onlinePriceBasis, ['商城商品单价', '实际优惠金额', '卡券面值', '网点价'], {'商城商品单价':'商城传入','实际优惠金额':'商城传入','卡券面值':'卡券中心读取','网点价':'商城传入'}) + '</div><small class="field-help">商城须按订单商品 + 卡券实例回传商品适用标记及三项价格数据；卡券中心仅汇总适用商品。卡券面值由卡券中心自行读取。</small></fieldset></section>' +
      '<section class="rule-config-section offline-config" data-rule-channel="offline"><div class="rule-section-title"><strong>上门取送车补贴条件</strong></div><label class="switch-row"><span>上门取送车订单状态为已完成</span><input type="checkbox" checked></label></section>' +
      '<div class="rule-form-grid"><label class="rule-form-wide"><span>补贴计算备注</span><textarea name="remark" class="form-textarea">' + safe(draft.remark) + '</textarea></label></div>' +
      '</div><div class="modal-footer"><button class="btn rule-modal-close" type="button">取消</button><button class="btn btn-primary" type="submit">保存</button></div></form></div>';
    document.body.appendChild(layer);
    Array.prototype.forEach.call(layer.querySelectorAll('.rule-modal-close'), function (button) { button.addEventListener('click', closeRuleModal); });
    layer.addEventListener('click', function (event) { if (event.target === layer) closeRuleModal(); });
    bindRuleFormBehavior(layer);
    layer.querySelector('#rule-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var form = new FormData(event.target);
      var saved = {
        ruleId: isEdit ? rule.ruleId : 'SR20260722' + String(data.rules.length + 1).padStart(3, '0'),
        templateId: form.get('templateId'), templateName: form.get('templateName'), brand: form.get('brand'),
        onlineMethod: form.get('onlineMethod'), onlineValue: form.get('onlineValue'), onlinePriceBasis: form.get('onlinePriceBasis'),
        offlineMethod: form.get('offlineMethod'), offlineValue: form.get('offlineValue'), offlinePriceBasis: form.get('offlinePriceBasis'),
        version: form.get('version'), status: form.get('status'), usedCount: isEdit ? rule.usedCount : 0, remark: form.get('remark')
      };
      if (isEdit) data.rules[data.rules.indexOf(rule)] = saved; else data.rules.unshift(saved);
      closeRuleModal();
      window.navigateTo('rule-config');
      window.showToast(isEdit ? '结算规则已保存' : '结算规则已新建');
    });
  }

  function openDeleteRuleModal(ruleId) {
    var rule = data.rules.filter(function (row) { return row.ruleId === ruleId; })[0];
    if (!rule) return;
    if (rule.usedCount) {
      window.showToast('该规则已有核销记录，禁止删除');
      return;
    }
    var layer = document.createElement('div');
    layer.className = 'modal-overlay rule-modal-overlay';
    layer.innerHTML = '<div class="modal-content confirm-rule-modal"><div class="modal-header"><h2>删除结算规则</h2><button class="close-btn rule-modal-close" type="button">×</button></div><div class="modal-body"><p>确认删除规则 <strong>' + safe(rule.ruleId) + '</strong>（' + safe(rule.templateName) + '）吗？</p><p class="delete-warning">删除后不可恢复。</p></div><div class="modal-footer"><button class="btn rule-modal-close" type="button">取消</button><button id="confirm-rule-delete" class="btn btn-danger" type="button">确认删除</button></div></div>';
    document.body.appendChild(layer);
    Array.prototype.forEach.call(layer.querySelectorAll('.rule-modal-close'), function (button) { button.addEventListener('click', closeRuleModal); });
    layer.querySelector('#confirm-rule-delete').addEventListener('click', function () {
      data.rules = data.rules.filter(function (row) { return row.ruleId !== ruleId; });
      closeRuleModal();
      window.navigateTo('rule-config');
      window.showToast('结算规则已删除');
    });
  }

  function bindRules() {
    var ruleId = document.getElementById('rule-id-filter');
    var templateId = document.getElementById('template-id-filter');
    var templateName = document.getElementById('template-name-filter');
    function applyRuleFilter() {
      var terms = [ruleId.value, templateId.value, templateName.value].map(function (value) { return value.trim().toLowerCase(); });
      var visible = 0;
      Array.prototype.forEach.call(document.querySelectorAll('#rule-body tr'), function (row) {
        var text = row.getAttribute('data-search');
        var matched = (!terms[0] || text.indexOf(terms[0]) > -1) && (!terms[1] || text.indexOf(terms[1]) > -1) && (!terms[2] || text.indexOf(terms[2]) > -1);
        row.hidden = !matched;
        if (matched) visible += 1;
      });
      document.getElementById('rule-result-count').textContent = '共 ' + visible + ' 条';
    }
    document.getElementById('rule-search').addEventListener('click', applyRuleFilter);
    document.getElementById('rule-reset').addEventListener('click', function () { ruleId.value = ''; templateId.value = ''; templateName.value = ''; applyRuleFilter(); });
    document.getElementById('rule-create').addEventListener('click', function () { openRuleModal(); });
    document.getElementById('rule-export').addEventListener('click', function () { window.showToast('已导出当前结算规则列表'); });
    Array.prototype.forEach.call(document.querySelectorAll('.rule-edit'), function (button) { button.addEventListener('click', function () { openRuleModal(this.getAttribute('data-rule-id')); }); });
    Array.prototype.forEach.call(document.querySelectorAll('.rule-delete'), function (button) { button.addEventListener('click', function () { openDeleteRuleModal(this.getAttribute('data-rule-id')); }); });
  }

  function renderSubmissions() {
    return pageHead('E3S 提交记录', '每次订单冻结后，卡券中心通过接口提交一次最终结算。', '<button class="btn" onclick="window.navigateTo(\'settlement-report\')">返回实例报表</button>') +
      '<div class="final-step-banner"><span class="gate-icon">⇄</span><div><strong>E3S 为最后结算步骤</strong><p>不人工勾选，不生成批次。订单退款窗口关闭且最终金额冻结后，系统立即提交一次 E3S 请求。</p></div></div>' +
      '<section class="content-card table-card"><div class="table-toolbar"><div><strong>接口提交记录</strong><span>共 ' + data.submissions.length + ' 条</span></div></div><div class="table-wrapper"><table class="submission-table"><thead><tr><th>请求ID</th><th>订单号</th><th>卡券实例ID</th><th>VIN</th><th>手机号码</th><th>oneID</th><th>结算金额</th><th>提交时间</th><th>E3S 结算单号</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
      data.submissions.map(function (record) { var processing = record.status.indexOf('处理') > -1; return '<tr><td><strong>' + record.requestId + '</strong></td><td>' + record.orderNo + '</td><td><button class="link-btn detail-btn" data-id="' + record.instanceId + '">' + record.instanceId + '</button></td>' + renderIdentityColumns(record) + '<td class="amount-cell emphasized">' + money(record.amount) + '</td><td>' + record.submittedAt + '</td><td>' + record.e3sNo + '</td><td><span class="status-pill ' + (processing ? 'status-info' : 'status-done') + '"><i></i>' + record.status + '</span></td><td><button class="link-btn detail-btn" data-id="' + record.instanceId + '">查看实例</button></td></tr>'; }).join('') +
      '</tbody></table></div></section>';
  }

  function renderSync() {
    return pageHead('商城数据同步', '监控商品优惠拆分、退款明细和不可退款事件。') +
      '<div class="empty-panel"><span>↻</span><h2>数据同步监控</h2><p>本轮原型暂不展开接口级监控，该页保留为后续幂等、重试和对账能力入口。</p></div>';
  }

  window.Pages = {
    'settlement-report': { render: reportPage, init: bindReport },
    'rule-config': { render: renderRules, init: bindRules },
    'e3s-submissions': { render: renderSubmissions, init: bindDetailButtons },
    'sync-monitor': { render: renderSync }
  };
})();

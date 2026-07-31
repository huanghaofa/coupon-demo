import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/huanghaofa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const baseUrl = 'http://127.0.0.1:8080/';
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport: { width: 2880, height: 1300 }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  const badResponses = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('#settlement-table');
  assert(await page.locator('#anno-toggle-btn').count() === 1, '标注开关应保持单例');
  assert(await page.locator('.anno-marker').count() === 0, '空标注数据不应生成标注点');

  const title = await page.locator('.page-head h1').textContent();
  assert(title.includes('卡券实例结算报表'), '报表标题不正确');
  const headers = await page.locator('#settlement-table thead th').allTextContents();
  assert(headers.length === 17, `期望 17 列，实际 ${headers.length} 列`);
  ['VIN', '手机号码', 'oneID', '核销渠道', '核销来源', '适用商品商城价合计', '适用商品实际优惠', '卡券面值', '适用商品网点价合计', '价格标准类型', '结算基数', '结算金额'].forEach((header) => {
    assert(headers.includes(header), `缺少表头：${header}`);
  });
  assert(!headers.includes('归属类型'), '报表不应再展示归属类型');
  assert(await page.locator('#owner-filter').count() === 0, '报表不应再提供归属类型筛选');
  assert(await page.locator('#report-body tr').count() === 6, '实例样例应为 6 条');
  assert(await page.locator('#report-body tr[data-channel="线上"][data-source="商城"]').count() === 5, '线上/商城样例应为 5 条');
  assert(await page.locator('#report-body tr[data-channel="线下"][data-source="E3S"]').count() === 1, '线下/E3S 样例应为 1 条');

  const firstRowText = await page.locator('#report-body tr[data-source="商城"]').first().textContent();
  assert(firstRowText.includes('卡券中心'), '卡券面值来源应显示卡券中心');
  assert(firstRowText.includes('商城'), '线上价格来源应显示商城');
  assert(firstRowText.includes('2/3 件适用'), '混合订单应展示 2/3 件适用');
  assert(firstRowText.includes('¥528.00'), '商城价合计应只汇总两件适用商品');
  assert(firstRowText.includes('¥502.00'), '网点价合计应只汇总两件适用商品');
  const offlineRowText = await page.locator('#report-body tr[data-source="E3S"]').textContent();
  assert(offlineRowText.includes('不适用'), '线下记录的商城商品单价应显示不适用');

  await page.selectOption('#writeoff-channel-filter', '线上');
  await page.click('#search-btn');
  assert(await page.locator('#report-body tr:visible').count() === 5, '线上筛选结果应为 5 条');
  await page.selectOption('#writeoff-channel-filter', '线下');
  await page.click('#search-btn');
  assert(await page.locator('#report-body tr:visible').count() === 1, '线下筛选结果应为 1 条');
  await page.click('#reset-btn');
  await page.selectOption('#source-filter', 'E3S');
  await page.click('#search-btn');
  assert(await page.locator('#report-body tr:visible').count() === 1, 'E3S 来源筛选结果应为 1 条');
  await page.click('#reset-btn');

  await page.screenshot({ path: 'artifacts/settlement-report.png', fullPage: true });

  await page.locator('#report-body tr[data-source="商城"] .detail-btn').first().click();
  await page.waitForSelector('.detail-drawer');
  assert(await page.locator('.price-card').count() === 4, '线上详情应展示四项价格快照');
  assert(await page.locator('.price-card.selected').count() === 1, '线上详情应突出一个结算价格标准');
  const onlineDetailText = await page.locator('.detail-drawer').textContent();
  assert(onlineDetailText.includes('线上 · 商城'), '线上详情缺少渠道/来源');
  assert(onlineDetailText.includes('来源：卡券中心'), '线上详情缺少卡券面值来源');
  assert(onlineDetailText.includes('基数来源：商城'), '线上详情计算依据来源不正确');
  assert(onlineDetailText.includes('核销渠道为“线上”，自动选择线上配置'), '线上详情应展示运行时规则路由');
  assert(onlineDetailText.includes('订单共 3 件商品，2 件适用'), '详情应明确商品适用数量');
  assert(onlineDetailText.includes('先过滤适用商品'), '详情应明确适用商品过滤顺序');
  assert(!onlineDetailText.includes('归属类型'), '详情不应再出现归属类型');
  assert(await page.locator('.applicable-tag.yes').count() === 2, '详情应有 2 件适用商品');
  assert(await page.locator('.applicable-tag.no').count() === 1, '详情应有 1 件不适用商品');
  const nonApplicableText = await page.locator('.non-applicable-row').textContent();
  assert(nonApplicableText.includes('不适用') && nonApplicableText.includes('¥0.00'), '不适用商品应标记且分摊优惠为 0');
  await page.locator('.detail-drawer').screenshot({ path: 'artifacts/instance-detail.png' });
  await page.click('.close-btn');

  await page.locator('#report-body tr[data-source="E3S"] .detail-btn').first().click();
  await page.waitForSelector('.detail-drawer');
  const offlineDetailText = await page.locator('.detail-drawer').textContent();
  assert(offlineDetailText.includes('线下 · E3S'), '线下详情缺少渠道/来源');
  assert(offlineDetailText.includes('网点价 / 适用商品结算基数'), '线下详情应以网点价作为样例结算基数');
  assert(offlineDetailText.includes('基数来源：E3S'), '线下详情计算依据来源不正确');
  assert(offlineDetailText.includes('核销渠道为“线下”，自动选择线下配置'), '线下详情应展示运行时规则路由');
  await page.locator('.detail-drawer').screenshot({ path: 'artifacts/offline-instance-detail.png' });
  await page.click('.close-btn');

  await page.locator('.nav-link[data-page="e3s-submissions"]').click();
  await page.waitForSelector('.submission-table');
  const submissionHeaders = await page.locator('.submission-table thead th').allTextContents();
  assert(submissionHeaders.length === 11, `E3S 提交记录期望 11 列，实际 ${submissionHeaders.length} 列`);
  assert(!submissionHeaders.includes('归属类型'), 'E3S 提交记录不应展示归属类型');
  ['VIN', '手机号码', 'oneID'].forEach((header) => assert(submissionHeaders.includes(header), `E3S 提交记录缺少 ${header}`));
  await page.locator('.nav-link[data-page="settlement-report"]').click();
  await page.waitForSelector('#settlement-table');

  await page.locator('.nav-link[data-page="rule-config"]').click();
  await page.waitForSelector('#rule-create');
  assert((await page.locator('.page-head h1').textContent()).includes('卡券规则设置'), '规则页导航失败');
  const ruleHeaders = await page.locator('.rule-management-table thead th').allTextContents();
  assert(ruleHeaders.length === 9, `规则列表期望 9 列，实际 ${ruleHeaders.length} 列`);
  assert(!ruleHeaders.includes('结算渠道'), '规则列表不应显示结算渠道');
  const routeText = await page.locator('.runtime-rule-route').textContent();
  assert(routeText.includes('线上核销') && routeText.includes('使用线上配置'), '规则页缺少线上运行时路由');
  assert(routeText.includes('线下核销') && routeText.includes('使用线下配置'), '规则页缺少线下运行时路由');
  await page.screenshot({ path: 'artifacts/settlement-rules.png', fullPage: true });
  await page.setViewportSize({ width: 2880, height: 2000 });
  await page.click('#rule-create');
  await page.waitForSelector('.rule-modal');
  assert(await page.locator('[name="settlementChannel"]').count() === 0, '规则弹窗不应包含结算渠道字段');
  assert(!(await page.locator('.rule-modal').textContent()).includes('固定枚举'), '规则弹窗不应保留渠道枚举说明');
  assert(await page.locator('.online-config:visible').count() === 1, '线上配置应始终显示');
  assert(await page.locator('.offline-config:visible').count() === 3, '线下配置应始终显示');
  assert((await page.locator('.runtime-routing-note').textContent()).includes('线上、线下配置均需维护'), '弹窗缺少运行时路由说明');
  const sourceLabels = await page.locator('.online-config .radio-options.source-aware label').allTextContents();
  assert(sourceLabels.length === 4, '线上价格标准应为四项');
  const expectedSources = {
    '商城商品单价': '商城传入',
    '实际优惠金额': '商城传入',
    '卡券面值': '卡券中心读取',
    '网点价': '商城传入'
  };
  sourceLabels.forEach((text) => {
    const name = Object.keys(expectedSources).find((key) => text.includes(key));
    assert(name && text.includes(expectedSources[name]), `价格来源标记不正确：${text}`);
  });
  await page.locator('.rule-modal').screenshot({ path: 'artifacts/settlement-rule-form.png' });
  await page.fill('[name="templateName"]', '运行时路由测试券');
  await page.fill('[name="templateId"]', 'CT-RUNTIME-ROUTE');
  await page.click('#rule-form button[type="submit"]');
  await page.waitForSelector('#rule-body tr[data-rule-id="SR20260722003"]');
  assert(await page.locator('#rule-body tr').count() === 3, '新建规则后应为 3 条');
  let createdRuleText = await page.locator('#rule-body tr[data-rule-id="SR20260722003"]').textContent();
  assert(createdRuleText.includes('比例结算 80%') && createdRuleText.includes('实际优惠金额') && createdRuleText.includes('用户价'), '新建规则应同时保存线上和线下配置');
  await page.locator('#rule-body tr[data-rule-id="SR20260722003"] .rule-edit').click();
  await page.waitForSelector('.rule-modal');
  await page.fill('[name="onlineValue"]', '75');
  await page.fill('[name="offlineValue"]', '65');
  await page.click('#rule-form button[type="submit"]');
  await page.waitForSelector('#rule-body tr[data-rule-id="SR20260722003"]');
  createdRuleText = await page.locator('#rule-body tr[data-rule-id="SR20260722003"]').textContent();
  assert(createdRuleText.includes('比例结算 75%') && createdRuleText.includes('比例结算 65%'), '编辑应同时保存线上和线下配置');
  await page.locator('#rule-body tr[data-rule-id="SR20260722003"] .rule-delete').click();
  await page.waitForSelector('#confirm-rule-delete');
  await page.click('#confirm-rule-delete');
  assert(await page.locator('#rule-body tr').count() === 2, '删除测试规则后应恢复为 2 条');

  await page.locator('.nav-link[data-page="settlement-report"]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForSelector('#settlement-table');
  const mobileLayout = await page.evaluate(() => {
    const wrapper = document.querySelector('.table-wrapper');
    return {
      bodyScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      tableScrollable: wrapper.scrollWidth > wrapper.clientWidth
    };
  });
  assert(mobileLayout.bodyScrollWidth <= mobileLayout.viewportWidth, `移动端存在全局横向溢出：${JSON.stringify(mobileLayout)}`);
  assert(mobileLayout.tableScrollable, '移动端表格容器应可横向滚动');
  await page.screenshot({ path: 'artifacts/mobile-report.png', fullPage: true });

  await page.locator('#report-body tr[data-source="商城"] .detail-btn').first().click();
  await page.waitForSelector('.detail-drawer');
  const mobileDetail = await page.evaluate(() => ({
    bodyScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    priceColumns: getComputedStyle(document.querySelector('.price-snapshot-grid')).gridTemplateColumns
  }));
  assert(mobileDetail.bodyScrollWidth <= mobileDetail.viewportWidth, `移动端详情存在全局横向溢出：${JSON.stringify(mobileDetail)}`);
  await page.click('.close-btn');
  await page.locator('.nav-link[data-page="rule-config"]').click();
  await page.waitForSelector('#rule-create');
  const mobileRulePage = await page.evaluate(() => ({
    bodyScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    tableScrollable: document.querySelector('.table-wrapper').scrollWidth > document.querySelector('.table-wrapper').clientWidth
  }));
  assert(mobileRulePage.bodyScrollWidth <= mobileRulePage.viewportWidth, `移动端规则页存在全局横向溢出：${JSON.stringify(mobileRulePage)}`);
  assert(mobileRulePage.tableScrollable, '移动端规则列表应在自身容器内横向滚动');
  await page.click('#rule-create');
  await page.waitForSelector('.rule-modal');
  const mobileRuleModal = await page.evaluate(() => ({
    bodyScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    modalScrolls: document.querySelector('.rule-modal').scrollHeight > document.querySelector('.rule-modal').clientHeight
  }));
  assert(mobileRuleModal.bodyScrollWidth <= mobileRuleModal.viewportWidth, `移动端规则弹窗存在全局横向溢出：${JSON.stringify(mobileRuleModal)}`);
  assert(await page.locator('.online-config:visible').count() === 1 && await page.locator('.offline-config:visible').count() === 3, '移动端规则弹窗应同时保留线上和线下配置');

  assert(consoleErrors.length === 0, `控制台错误：${consoleErrors.join(' | ')}`);
  assert(badResponses.length === 0, `资源错误：${badResponses.join(' | ')}`);

  console.log(JSON.stringify({
    pass: true,
    headers: headers.length,
    submissionHeaders: submissionHeaders.length,
    applicableProducts: 2,
    nonApplicableProducts: 1,
    rows: 6,
    onlineMallRows: 5,
    offlineE3SRows: 1,
    sourceLabels,
    ruleHeaders: ruleHeaders.length,
    mobileLayout,
    mobileDetail,
    mobileRulePage,
    mobileRuleModal,
    consoleErrors,
    badResponses
  }, null, 2));
  await browser.close();
})().catch(async (error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

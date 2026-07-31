# 执行步骤

## STEP-01 实例报表与金额口径
- 文件：`mock/data.js` `index.html` `js/app.js` `assets/css/app.css`
- 验收：报表一行一实例，分列显示核销渠道、核销来源、适用商品价格快照、价格标准、结算基数、应结算和状态；用户标识只保留 VIN、手机号码、oneID 三列。
- 验证技能：`prototype-verifier` `playwright-cli`

## STEP-02 实例详情与退款重算
- 文件：`js/app.js` `mock/data.js` `assets/css/app.css`
- 验收：点击详情可逐项查看商品适用性和原因；不适用商品不进入四项价格汇总、退款重算和完整计算公式。
- 验证技能：`prototype-verifier` `playwright-cli`

## STEP-03 E3S 订单级提交
- 文件：`js/app.js` `mock/data.js` `assets/css/app.css`
- 验收：页面不存在实例勾选和批次生成；每条提交记录对应一次订单冻结，含请求 ID、订单号、实例 ID、金额，以及分列展示的 VIN、手机号码和 oneID。
- 验证技能：`prototype-verifier` `playwright-cli`

## STEP-04 卡券规则设置原页面扩展
- 文件：`config/nav.json` `js/app.js` `mock/data.js`
- 验收：导航和页面名称沿用“卡券规则设置”；保留查询、新增、编辑、删除和导出；隐藏结算渠道；线上与线下配置始终同时展示；线上价格标准值提供商城商品单价、实际优惠金额、卡券面值和网点价并标明来源；已有核销记录的规则禁止编辑和删除。
- 验证技能：`prototype-verifier` `playwright-cli`

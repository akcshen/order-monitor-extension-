/**
 * 内置监控规则（发版前由开发者填写）。
 * 用户侧 Popup 不会编辑这些规则；安装/更新扩展时会同步进本地 storage。
 *
 * 必填：id（稳定不变）、name、orderListUrl（访问路径）、apiUrlIncludes（接口地址片段）、orderIdPath
 * 选填：orderFields、refreshSeconds、DOM 兜底字段
 *
 * 把 REPLACE_ME 换成真实后台后再 npm run build。
 */

/** @type {Array<object>} */
export const BUILTIN_PLATFORMS = [
  {
    id: 'builtin-main',
    name: '主订货后台',
    enabled: true,
    orderListUrl: 'https://REPLACE_ME/orders',
    apiUrlIncludes: '/api/order/list',
    orderIdPath: 'data.list[].orderNo',
    orderFields: [
      { label: '超市', path: 'shopName' },
      { label: '金额', path: 'amount' },
    ],
    refreshSeconds: 60,
    rowSelector: '',
    orderIdSelector: '',
    fieldSelectors: [],
    loginUrlIncludes: '',
  },
  // 多平台时继续往数组里加，id 保持唯一且稳定，例如 builtin-platform-b
]

export const DEFAULT_SETTINGS = {
  enabled: true,
  resendApiKey: '',
  toEmail: '',
  fromEmail: '',
  fromName: '订单监控助手',
  mergeNewOrdersInOneEmail: true,
  autoOpenOrderListTab: true,
}

export function createEmptyPlatform() {
  return {
    id: crypto.randomUUID(),
    name: '',
    enabled: true,
    matchUrls: [],
    orderListUrl: '',
    refreshSeconds: 60,
    apiUrlIncludes: '',
    orderIdPath: '',
    orderFields: [],
    rowSelector: '',
    orderIdSelector: '',
    fieldSelectors: [],
    loginUrlIncludes: 'login',
  }
}

export const DEFAULT_SEEN = {}
export const DEFAULT_MAIL_LOGS = []
export const DEFAULT_PENDING = []

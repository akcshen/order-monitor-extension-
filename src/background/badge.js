let todayKey = ''
let todayCount = 0

export async function bumpBadge(n = 1) {
  const key = new Date().toDateString()
  if (key !== todayKey) {
    todayKey = key
    todayCount = 0
  }
  todayCount += n
  await chrome.action.setBadgeText({ text: String(todayCount) })
  await chrome.action.setBadgeBackgroundColor({ color: '#d4380d' })
}

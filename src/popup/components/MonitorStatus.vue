<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  platforms: { type: Array, default: () => [] },
  mailLogs: { type: Array, default: () => [] },
})

const tabOpenMap = ref({})

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function todayNewCount(platformId) {
  const start = startOfToday()
  let n = 0
  for (const log of props.mailLogs) {
    if (log.platformId !== platformId || !log.at || log.at < start) continue
    n += Array.isArray(log.orderIds) ? log.orderIds.length : 0
  }
  return n
}

async function refreshTabStatus() {
  try {
    const tabs = await chrome.tabs.query({})
    const map = {}
    for (const p of props.platforms) {
      if (!p.orderListUrl) {
        map[p.id] = false
        continue
      }
      const base = p.orderListUrl.split('?')[0]
      map[p.id] = tabs.some((t) => t.url && t.url.startsWith(base))
    }
    tabOpenMap.value = map
  } catch (_) {
    tabOpenMap.value = {}
  }
}

watch(
  () => props.platforms,
  () => refreshTabStatus(),
  { immediate: true, deep: true },
)
</script>

<template>
  <div class="status-list">
    <el-empty
      v-if="!platforms.length"
      description="暂无内置规则（开发者需在 builtin-platforms.js 配置后重新打包）"
      :image-size="48"
    />
    <div v-for="p in platforms" :key="p.id" class="row">
      <div class="name">
        {{ p.name || p.id }}
        <el-tag :type="p.enabled ? 'success' : 'info'" size="small">
          {{ p.enabled ? '启用' : '暂停' }}
        </el-tag>
      </div>
      <div class="sub">今日新单 {{ todayNewCount(p.id) }} · 页面 {{ tabOpenMap[p.id] ? '已打开' : '未打开' }}</div>
    </div>
  </div>
</template>

<style scoped>
.row {
  padding: 8px 0;
  border-bottom: 1px solid #ebeef5;
}
.row:last-child {
  border-bottom: none;
}
.name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}
.sub {
  margin-top: 2px;
  font-size: 11px;
  color: #909399;
}
</style>

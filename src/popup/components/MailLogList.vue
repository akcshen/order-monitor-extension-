<script setup>
import { computed } from 'vue'

const props = defineProps({
  mailLogs: {
    type: Array,
    default: () => [],
  },
  platforms: {
    type: Array,
    default: () => [],
  },
})

const nameMap = computed(() => {
  const map = Object.create(null)
  for (const p of props.platforms) {
    map[p.id] = p.name || p.id
  }
  return map
})

function platformName(id) {
  return nameMap.value[id] || id || '-'
}

function formatTime(at) {
  if (!at) return '-'
  try {
    return new Date(at).toLocaleString()
  } catch {
    return String(at)
  }
}

function orderText(ids) {
  if (!Array.isArray(ids) || !ids.length) return '-'
  return ids.join(', ')
}
</script>

<template>
  <div class="mail-log-list">
    <el-empty v-if="!mailLogs.length" description="暂无发信日志" :image-size="48" />
    <div v-for="(log, i) in mailLogs" :key="(log.at || '') + '-' + i" class="log-row">
      <div class="top">
        <el-tag :type="log.ok ? 'success' : 'danger'" size="small">
          {{ log.ok ? '成功' : '失败' }}
        </el-tag>
        <span class="time">{{ formatTime(log.at) }}</span>
      </div>
      <div class="line">平台：{{ platformName(log.platformId) }}</div>
      <div class="line">订单：{{ orderText(log.orderIds) }}</div>
      <div v-if="!log.ok && log.error" class="err">{{ log.error }}</div>
    </div>
  </div>
</template>

<style scoped>
.log-row {
  padding: 8px 0;
  border-bottom: 1px solid #ebeef5;
  font-size: 12px;
}
.log-row:last-child {
  border-bottom: none;
}
.top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.time {
  color: #909399;
}
.line {
  color: #606266;
  word-break: break-all;
  line-height: 1.4;
}
.err {
  margin-top: 2px;
  color: #f56c6c;
  word-break: break-all;
}
</style>

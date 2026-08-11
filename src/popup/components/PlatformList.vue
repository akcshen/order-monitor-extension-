<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { MSG } from '../../shared/messaging.js'
import { createEmptyPlatform } from '../../shared/types.js'
import PlatformEditor from './PlatformEditor.vue'

const props = defineProps({
  platforms: {
    type: Array,
    default: () => [],
  },
  mailLogs: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['changed'])

const editorOpen = ref(false)
const editing = ref(null)
const isNew = ref(false)
/** platformId -> 是否有匹配 orderListUrl 的标签页 */
const tabOpenMap = ref({})

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 今日该平台新单约数：汇总当天 mailLogs 中的 orderIds 数量 */
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
  () => {
    refreshTabStatus()
  },
  { immediate: true, deep: true },
)

function openAdd() {
  editing.value = createEmptyPlatform()
  isNew.value = true
  editorOpen.value = true
}

function openEdit(p) {
  editing.value = p
  isNew.value = false
  editorOpen.value = true
}

async function toggleEnabled(p, enabled) {
  try {
    const res = await chrome.runtime.sendMessage({
      type: MSG.UPSERT_PLATFORM,
      payload: { ...p, enabled },
    })
    if (!res?.ok) {
      ElMessage.error(res?.error || '更新失败')
      emit('changed')
      return
    }
    emit('changed')
  } catch (e) {
    ElMessage.error(e.message || '更新失败')
    emit('changed')
  }
}

function onSaved() {
  emit('changed')
}

function onRemoved() {
  emit('changed')
}
</script>

<template>
  <div class="platform-list">
    <div class="toolbar">
      <span class="count">共 {{ platforms.length }} 个平台</span>
      <el-button type="primary" size="small" @click="openAdd">新增平台</el-button>
    </div>

    <el-empty v-if="!platforms.length" description="暂无平台，请新增" :image-size="48" />

    <div v-for="p in platforms" :key="p.id" class="platform-row">
      <div class="meta">
        <div class="name">
          {{ p.name || '(未命名)' }}
          <el-tag :type="p.enabled ? 'success' : 'info'" size="small" class="status-tag">
            {{ p.enabled ? '启用' : '停用' }}
          </el-tag>
        </div>
        <div class="sub">
          今日新单 {{ todayNewCount(p.id) }}
          · 监控页 {{ tabOpenMap[p.id] ? '已打开' : '未打开' }}
          · 刷新 {{ p.refreshSeconds || 60 }}s
        </div>
      </div>
      <el-switch
        :model-value="!!p.enabled"
        size="small"
        @change="(v) => toggleEnabled(p, v)"
      />
      <el-button size="small" @click="openEdit(p)">编辑</el-button>
    </div>

    <PlatformEditor
      v-model="editorOpen"
      :platform="editing"
      :is-new="isNew"
      @saved="onSaved"
      @removed="onRemoved"
    />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.count {
  font-size: 12px;
  color: #606266;
}
.platform-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 8px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #ebeef5;
}
.platform-row:last-of-type {
  border-bottom: none;
}
.name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.status-tag {
  font-weight: 400;
}
.sub {
  margin-top: 2px;
  font-size: 11px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
}
</style>

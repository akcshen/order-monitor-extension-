<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { MSG } from '../../shared/messaging.js'
import { createEmptyPlatform } from '../../shared/types.js'
import PlatformEditor from './PlatformEditor.vue'

defineProps({
  platforms: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['changed'])

const editorOpen = ref(false)
const editing = ref(null)
const isNew = ref(false)

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
        <div class="name">{{ p.name || '(未命名)' }}</div>
        <div class="sub">
          刷新 {{ p.refreshSeconds || 60 }}s
          <template v-if="p.orderListUrl"> · {{ p.orderListUrl }}</template>
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
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.sub {
  margin-top: 2px;
  font-size: 11px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}
</style>

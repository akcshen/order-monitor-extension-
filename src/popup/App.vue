<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { MSG } from '../shared/messaging.js'
import { DEFAULT_SETTINGS } from '../shared/types.js'
import SettingsForm from './components/SettingsForm.vue'
import PlatformList from './components/PlatformList.vue'
import MailLogList from './components/MailLogList.vue'

const loading = ref(true)
const testing = ref(false)
const retrying = ref(false)

const state = reactive({
  settings: { ...DEFAULT_SETTINGS },
  platforms: [],
  mailLogs: [],
  pendingMails: [],
})

function applyListState(res) {
  state.platforms = Array.isArray(res.platforms) ? res.platforms : []
  state.mailLogs = Array.isArray(res.mailLogs) ? res.mailLogs : []
  state.pendingMails = Array.isArray(res.pendingMails) ? res.pendingMails : []
}

async function refreshLists() {
  try {
    const res = await chrome.runtime.sendMessage({ type: MSG.GET_STATE })
    if (!res?.ok) {
      ElMessage.error(res?.error || '加载状态失败')
      return
    }
    applyListState(res)
  } catch (e) {
    ElMessage.error(e.message || '加载状态失败')
  }
}

async function loadState() {
  loading.value = true
  try {
    const res = await chrome.runtime.sendMessage({ type: MSG.GET_STATE })
    if (!res?.ok) {
      ElMessage.error(res?.error || '加载状态失败')
      return
    }
    state.settings = { ...DEFAULT_SETTINGS, ...(res.settings || {}) }
    applyListState(res)
  } catch (e) {
    ElMessage.error(e.message || '加载状态失败')
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  const res = await chrome.runtime.sendMessage({
    type: MSG.SAVE_SETTINGS,
    payload: { ...state.settings },
  })
  if (!res?.ok) {
    throw new Error(res?.error || '保存失败')
  }
  state.settings = { ...DEFAULT_SETTINGS, ...(res.settings || state.settings) }
  return res
}

function onSettingsSaved(settings) {
  state.settings = { ...DEFAULT_SETTINGS, ...(settings || {}) }
}

async function onTestEmail() {
  testing.value = true
  try {
    await saveSettings()
    const res = await chrome.runtime.sendMessage({ type: MSG.TEST_EMAIL })
    if (res?.ok) {
      ElMessage.success('测试邮件已发送')
      await refreshLists()
    } else {
      ElMessage.error(res?.error || '测试发信失败')
    }
  } catch (e) {
    ElMessage.error(e.message || '测试发信失败')
  } finally {
    testing.value = false
  }
}

async function onRetryPending() {
  retrying.value = true
  try {
    const res = await chrome.runtime.sendMessage({ type: MSG.RETRY_PENDING })
    if (!res?.ok) {
      ElMessage.error(res?.error || '重试失败')
      return
    }
    const remaining = res.remaining ?? 0
    if (remaining === 0) {
      ElMessage.success('待补发已全部重试成功')
    } else {
      ElMessage.warning(`仍有 ${remaining} 条待补发`)
    }
    await refreshLists()
  } catch (e) {
    ElMessage.error(e.message || '重试失败')
  } finally {
    retrying.value = false
  }
}

onMounted(loadState)
</script>

<template>
  <div class="popup-app" v-loading="loading">
    <header class="header">
      <h1>订单监控助手</h1>
      <el-tag :type="state.settings.enabled ? 'success' : 'info'" size="small">
        {{ state.settings.enabled ? '监控开启' : '监控关闭' }}
      </el-tag>
    </header>

    <section class="section">
      <h2>邮件与总设置</h2>
      <SettingsForm v-model="state.settings" @saved="onSettingsSaved" />
    </section>

    <section class="section">
      <h2>测试发信</h2>
      <el-button type="primary" plain style="width: 100%" :loading="testing" @click="onTestEmail">
        发送测试邮件
      </el-button>
    </section>

    <section class="section">
      <h2>平台规则</h2>
      <PlatformList :platforms="state.platforms" @changed="refreshLists" />
    </section>

    <section class="section">
      <h2>最近邮件日志</h2>
      <MailLogList :mail-logs="state.mailLogs" :platforms="state.platforms" />
    </section>

    <section class="section">
      <h2>待补发</h2>
      <p class="hint">当前队列：{{ state.pendingMails.length }} 条</p>
      <el-button
        type="warning"
        style="width: 100%"
        :disabled="!state.pendingMails.length"
        :loading="retrying"
        @click="onRetryPending"
      >
        重试待补发
      </el-button>
    </section>
  </div>
</template>

<style scoped>
.popup-app {
  width: 420px;
  max-height: 600px;
  overflow: auto;
  padding: 12px 14px 16px;
  box-sizing: border-box;
  background: #fafafa;
  color: #303133;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.header h1 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}
.section {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px 12px 12px;
  margin-bottom: 10px;
}
.section h2 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}
.hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: #909399;
}
</style>

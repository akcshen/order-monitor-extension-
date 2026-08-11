<script setup>
import { ElMessage } from 'element-plus'
import { MSG } from '../../shared/messaging.js'
import { DEFAULT_SETTINGS } from '../../shared/types.js'

const model = defineModel({
  type: Object,
  default: () => ({ ...DEFAULT_SETTINGS }),
})

const emit = defineEmits(['saved'])

async function onSave() {
  try {
    const res = await chrome.runtime.sendMessage({
      type: MSG.SAVE_SETTINGS,
      payload: {
        enabled: model.value.enabled,
        toEmail: (model.value.toEmail || '').trim(),
        mergeNewOrdersInOneEmail: model.value.mergeNewOrdersInOneEmail,
        autoOpenOrderListTab: model.value.autoOpenOrderListTab,
      },
    })
    if (!res?.ok) {
      ElMessage.error(res?.error || '保存失败')
      return
    }
    ElMessage.success('设置已保存')
    const saved = { ...DEFAULT_SETTINGS, ...(res.settings || model.value) }
    Object.assign(model.value, saved)
    emit('saved', saved)
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}
</script>

<template>
  <el-form label-position="top" size="small" class="settings-form">
    <el-form-item label="总开关">
      <el-switch v-model="model.enabled" active-text="监控中" inactive-text="已暂停" />
    </el-form-item>
    <el-form-item label="收件邮箱" required>
      <el-input v-model="model.toEmail" placeholder="接收新订单通知的邮箱" clearable />
      <p class="hint">发信通道由扩展内置配置，你只需填写接收通知的邮箱。</p>
    </el-form-item>
    <el-form-item label="合并发信">
      <el-switch
        v-model="model.mergeNewOrdersInOneEmail"
        active-text="同批合并一封"
        inactive-text="每单一封"
      />
    </el-form-item>
    <el-form-item label="自动打开订单列表">
      <el-switch
        v-model="model.autoOpenOrderListTab"
        active-text="无标签时自动打开"
        inactive-text="仅刷新已有标签"
      />
    </el-form-item>
    <el-button type="primary" style="width: 100%" @click="onSave">保存设置</el-button>
  </el-form>
</template>

<style scoped>
.settings-form :deep(.el-form-item) {
  margin-bottom: 10px;
}
.hint {
  margin: 4px 0 0;
  font-size: 11px;
  color: #909399;
  line-height: 1.4;
}
</style>

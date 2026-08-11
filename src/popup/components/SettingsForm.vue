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
  if (!model.value.toEmail?.trim()) {
    ElMessage.warning('请填写收件邮箱')
    return
  }
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
    ElMessage.success('已保存')
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
    <el-form-item label="监控开关">
      <el-switch v-model="model.enabled" active-text="开启" inactive-text="关闭" />
    </el-form-item>
    <el-form-item label="收件邮箱" required>
      <el-input v-model="model.toEmail" placeholder="接收新订单通知的邮箱" clearable />
    </el-form-item>
    <el-button type="primary" style="width: 100%" @click="onSave">保存</el-button>
  </el-form>
</template>

<style scoped>
.settings-form :deep(.el-form-item) {
  margin-bottom: 10px;
}
</style>

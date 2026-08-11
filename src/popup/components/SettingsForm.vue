<script setup>
import { reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { MSG } from '../../shared/messaging.js'
import { DEFAULT_SETTINGS } from '../../shared/types.js'

const props = defineProps({
  settings: {
    type: Object,
    default: () => ({ ...DEFAULT_SETTINGS }),
  },
})

const emit = defineEmits(['saved'])

const form = reactive({ ...DEFAULT_SETTINGS })

watch(
  () => props.settings,
  (val) => {
    Object.assign(form, DEFAULT_SETTINGS, val || {})
  },
  { immediate: true, deep: true },
)

async function onSave() {
  try {
    const res = await chrome.runtime.sendMessage({
      type: MSG.SAVE_SETTINGS,
      payload: { ...form },
    })
    if (!res?.ok) {
      ElMessage.error(res?.error || '保存失败')
      return
    }
    ElMessage.success('设置已保存')
    emit('saved', res.settings || { ...form })
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}
</script>

<template>
  <el-form label-position="top" size="small" class="settings-form">
    <el-form-item label="总开关">
      <el-switch v-model="form.enabled" active-text="监控中" inactive-text="已暂停" />
    </el-form-item>
    <el-form-item label="Resend API Key">
      <el-input
        v-model="form.resendApiKey"
        type="password"
        show-password
        placeholder="re_xxx"
        clearable
      />
    </el-form-item>
    <el-form-item label="收件邮箱">
      <el-input v-model="form.toEmail" placeholder="you@example.com" clearable />
    </el-form-item>
    <el-form-item label="发件邮箱">
      <el-input v-model="form.fromEmail" placeholder="noreply@your-domain.com" clearable />
    </el-form-item>
    <el-form-item label="发件人名称">
      <el-input v-model="form.fromName" clearable />
    </el-form-item>
    <el-form-item label="合并发信">
      <el-switch
        v-model="form.mergeNewOrdersInOneEmail"
        active-text="同批合并一封"
        inactive-text="每单一封"
      />
    </el-form-item>
    <el-form-item label="自动打开订单列表">
      <el-switch
        v-model="form.autoOpenOrderListTab"
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
</style>

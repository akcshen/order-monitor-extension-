<script setup>
import { computed, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MSG } from '../../shared/messaging.js'
import { createEmptyPlatform } from '../../shared/types.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  platform: { type: Object, default: null },
  isNew: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'saved', 'removed'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const form = reactive(createEmptyPlatform())
const matchUrlsText = reactive({ value: '' })
const saving = reactive({ value: false })

function resetFrom(platform) {
  const base = platform
    ? {
        ...createEmptyPlatform(),
        ...platform,
        matchUrls: [...(platform.matchUrls || [])],
        orderFields: (platform.orderFields || []).map((f) => ({ ...f })),
        fieldSelectors: (platform.fieldSelectors || []).map((f) => ({ ...f })),
      }
    : createEmptyPlatform()
  Object.assign(form, createEmptyPlatform(), base)
  matchUrlsText.value = (form.matchUrls || []).join('\n')
}

watch(
  () => [props.modelValue, props.platform, props.isNew],
  ([open]) => {
    if (open) resetFrom(props.platform)
  },
)

function addOrderField() {
  form.orderFields.push({ label: '', path: '' })
}

function removeOrderField(i) {
  form.orderFields.splice(i, 1)
}

function addFieldSelector() {
  form.fieldSelectors.push({ label: '', selector: '' })
}

function removeFieldSelector(i) {
  form.fieldSelectors.splice(i, 1)
}

function buildPayload() {
  const matchUrls = matchUrlsText.value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const refreshSeconds = Math.max(15, Number(form.refreshSeconds) || 60)
  return {
    ...form,
    matchUrls,
    refreshSeconds,
    orderFields: (form.orderFields || [])
      .map((f) => ({ label: (f.label || '').trim(), path: (f.path || '').trim() }))
      .filter((f) => f.label || f.path),
    fieldSelectors: (form.fieldSelectors || [])
      .map((f) => ({
        label: (f.label || '').trim(),
        selector: (f.selector || '').trim(),
      }))
      .filter((f) => f.label || f.selector),
  }
}

async function onSave() {
  if (!form.name?.trim()) {
    ElMessage.warning('请填写平台名称')
    return
  }
  saving.value = true
  try {
    const payload = buildPayload()
    const res = await chrome.runtime.sendMessage({
      type: MSG.UPSERT_PLATFORM,
      payload,
    })
    if (!res?.ok) {
      ElMessage.error(res?.error || '保存平台失败')
      return
    }
    ElMessage.success('平台已保存')
    visible.value = false
    emit('saved', payload)
  } catch (e) {
    ElMessage.error(e.message || '保存平台失败')
  } finally {
    saving.value = false
  }
}

async function onRemove() {
  if (props.isNew || !props.platform?.id) return
  try {
    await ElMessageBox.confirm(`确定删除平台「${form.name || props.platform.id}」？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    const res = await chrome.runtime.sendMessage({
      type: MSG.REMOVE_PLATFORM,
      payload: { id: props.platform.id },
    })
    if (!res?.ok) {
      ElMessage.error(res?.error || '删除失败')
      return
    }
    ElMessage.success('已删除')
    visible.value = false
    emit('removed', props.platform.id)
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isNew || !platform ? '新增平台' : '编辑平台'"
    width="400px"
    append-to-body
    destroy-on-close
    class="platform-editor-dialog"
  >
    <el-form label-position="top" size="small">
      <el-form-item label="名称" required>
        <el-input v-model="form.name" placeholder="如：美团闪购" clearable />
      </el-form-item>
      <el-form-item label="启用">
        <el-switch v-model="form.enabled" />
      </el-form-item>
      <el-form-item label="匹配 URL（每行一个）">
        <el-input
          v-model="matchUrlsText.value"
          type="textarea"
          :rows="3"
          placeholder="https://example.com/orders*&#10;*://*.example.com/*"
        />
      </el-form-item>
      <el-form-item label="订单列表 URL">
        <el-input v-model="form.orderListUrl" placeholder="https://..." clearable />
      </el-form-item>
      <el-form-item label="刷新间隔（秒，最小 15）">
        <el-input-number v-model="form.refreshSeconds" :min="15" :step="15" style="width: 100%" />
      </el-form-item>

      <el-divider content-position="left">接口模式</el-divider>
      <el-form-item label="API URL 包含">
        <el-input v-model="form.apiUrlIncludes" placeholder="/api/order/list" clearable />
      </el-form-item>
      <el-form-item label="订单号路径">
        <el-input v-model="form.orderIdPath" placeholder="data.list[].orderNo" clearable />
      </el-form-item>
      <el-form-item label="订单字段（label + path）">
        <div v-for="(f, i) in form.orderFields" :key="'of-' + i" class="row-pair">
          <el-input v-model="f.label" placeholder="label" />
          <el-input v-model="f.path" placeholder="path" />
          <el-button text type="danger" @click="removeOrderField(i)">删</el-button>
        </div>
        <el-button size="small" @click="addOrderField">添加字段</el-button>
      </el-form-item>

      <el-divider content-position="left">DOM 模式</el-divider>
      <el-form-item label="行选择器">
        <el-input v-model="form.rowSelector" placeholder=".order-row" clearable />
      </el-form-item>
      <el-form-item label="订单号选择器（相对行）">
        <el-input v-model="form.orderIdSelector" placeholder=".order-id" clearable />
      </el-form-item>
      <el-form-item label="字段选择器（label + selector）">
        <div v-for="(f, i) in form.fieldSelectors" :key="'fs-' + i" class="row-pair">
          <el-input v-model="f.label" placeholder="label" />
          <el-input v-model="f.selector" placeholder="selector" />
          <el-button text type="danger" @click="removeFieldSelector(i)">删</el-button>
        </div>
        <el-button size="small" @click="addFieldSelector">添加字段</el-button>
      </el-form-item>

      <el-form-item label="登录页 URL 包含">
        <el-input v-model="form.loginUrlIncludes" placeholder="login" clearable />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="footer">
        <el-button v-if="!isNew && platform" type="danger" plain @click="onRemove">删除</el-button>
        <span class="spacer" />
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving.value" @click="onSave">保存</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.row-pair {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 6px;
  margin-bottom: 6px;
}
.footer {
  display: flex;
  align-items: center;
  gap: 8px;
}
.spacer {
  flex: 1;
}
</style>

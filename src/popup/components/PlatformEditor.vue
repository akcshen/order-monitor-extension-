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
const saving = reactive({ value: false })
const showAdvanced = reactive({ value: false })

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
  showAdvanced.value = Boolean(
    form.rowSelector ||
      form.orderIdSelector ||
      (form.fieldSelectors && form.fieldSelectors.length) ||
      form.loginUrlIncludes,
  )
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

/** 由「访问路径」自动生成 matchUrls，用户不必再填一堆匹配规则 */
function deriveMatchUrls(pageUrl) {
  const url = (pageUrl || '').trim()
  if (!url) return []
  const urls = [url]
  // 同路径加通配，兼容 query/hash 变化
  if (!url.endsWith('*')) urls.push(`${url}*`)
  try {
    const u = new URL(url)
    urls.push(`${u.origin}${u.pathname}*`)
  } catch (_) {
    /* ignore invalid URL while typing */
  }
  return [...new Set(urls)]
}

function buildPayload() {
  const orderListUrl = (form.orderListUrl || '').trim()
  const apiUrlIncludes = (form.apiUrlIncludes || '').trim()
  const refreshSeconds = Math.max(15, Number(form.refreshSeconds) || 60)
  return {
    ...form,
    name: (form.name || '').trim(),
    orderListUrl,
    apiUrlIncludes,
    matchUrls: deriveMatchUrls(orderListUrl),
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
    ElMessage.warning('请填写名称')
    return
  }
  if (!form.orderListUrl?.trim()) {
    ElMessage.warning('请填写访问路径（订单列表页完整 URL）')
    return
  }
  if (!form.apiUrlIncludes?.trim() && !form.rowSelector?.trim()) {
    ElMessage.warning('请填写接口地址，或在高级选项中配置 DOM 选择器')
    return
  }
  if (form.apiUrlIncludes?.trim() && !form.orderIdPath?.trim()) {
    ElMessage.warning('使用接口模式时请填写订单号 JSON 路径，如 data.list[].orderNo')
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
      ElMessage.error(res?.error || '保存失败')
      return
    }
    ElMessage.success('已保存')
    visible.value = false
    emit('saved', payload)
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function onRemove() {
  if (props.isNew || !props.platform?.id) return
  try {
    await ElMessageBox.confirm(`确定删除「${form.name || props.platform.id}」？`, '删除确认', {
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
    :title="isNew || !platform ? '新增监控配置' : '编辑监控配置'"
    width="400px"
    append-to-body
    destroy-on-close
    class="platform-editor-dialog"
  >
    <el-form label-position="top" size="small">
      <el-form-item label="名称" required>
        <el-input v-model="form.name" placeholder="如：某某订货后台" clearable />
      </el-form-item>
      <el-form-item label="启用">
        <el-switch v-model="form.enabled" />
      </el-form-item>

      <el-form-item label="访问路径" required>
        <el-input
          v-model="form.orderListUrl"
          placeholder="https://admin.example.com/orders"
          clearable
        />
        <p class="field-hint">订单列表页完整 URL。插件会定时打开/刷新此页，并在该页注入监控。</p>
      </el-form-item>

      <el-form-item label="接口地址" required>
        <el-input
          v-model="form.apiUrlIncludes"
          placeholder="/api/order/list 或完整接口 URL 中的一段"
          clearable
        />
        <p class="field-hint">
          页面请求的订单列表接口，填 URL 中能唯一识别的一段即可（不必整串）。命中后读取响应 JSON。
        </p>
      </el-form-item>

      <el-form-item label="刷新间隔（秒）">
        <el-input-number v-model="form.refreshSeconds" :min="15" :step="15" style="width: 100%" />
        <p class="field-hint">Chrome 闹钟最短约 30～60 秒，实际间隔可能略长。</p>
      </el-form-item>

      <el-form-item label="订单号 JSON 路径" required>
        <el-input v-model="form.orderIdPath" placeholder="data.list[].orderNo" clearable />
        <p class="field-hint">用 [] 表示订单数组，如 data.list[].orderNo</p>
      </el-form-item>

      <el-form-item label="邮件中要带的字段">
        <p class="field-hint">path 相对「单条订单」对象，如 shopName、amount</p>
        <div v-for="(f, i) in form.orderFields" :key="'of-' + i" class="row-pair">
          <el-input v-model="f.label" placeholder="超市" />
          <el-input v-model="f.path" placeholder="shopName" />
          <el-button text type="danger" @click="removeOrderField(i)">删</el-button>
        </div>
        <el-button size="small" @click="addOrderField">添加字段</el-button>
      </el-form-item>

      <el-button text type="primary" @click="showAdvanced.value = !showAdvanced.value">
        {{ showAdvanced.value ? '收起高级选项' : '展开高级选项（DOM 兜底等）' }}
      </el-button>

      <template v-if="showAdvanced.value">
        <el-divider content-position="left">DOM 兜底（无接口时用）</el-divider>
        <el-form-item label="订单行选择器">
          <el-input v-model="form.rowSelector" placeholder=".order-row" clearable />
        </el-form-item>
        <el-form-item label="订单号选择器（相对行）">
          <el-input v-model="form.orderIdSelector" placeholder=".order-id" clearable />
        </el-form-item>
        <el-form-item label="字段选择器">
          <div v-for="(f, i) in form.fieldSelectors" :key="'fs-' + i" class="row-pair">
            <el-input v-model="f.label" placeholder="超市" />
            <el-input v-model="f.selector" placeholder=".shop" />
            <el-button text type="danger" @click="removeFieldSelector(i)">删</el-button>
          </div>
          <el-button size="small" @click="addFieldSelector">添加字段</el-button>
        </el-form-item>
        <el-form-item label="登录页 URL 包含">
          <el-input
            v-model="form.loginUrlIncludes"
            placeholder="可选，如 /login；空则不检测"
            clearable
          />
        </el-form-item>
      </template>
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
.field-hint {
  margin: 4px 0 0;
  font-size: 11px;
  color: #909399;
  line-height: 1.4;
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

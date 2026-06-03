# MediaCraft API 测试标准流程

> 每次修改 API 后必须执行。每次部署后本地+线上双重验证。

## 测试清单

### 1. 合规审查 API `/api/v1/compliance-check`

```
测试用例:
  "最好的国家级产品，治愈皮肤问题，100%有效" | douyin | title
预期:
  Score < 100, 至少发现3个违规词(最好/国家级/治愈/100%)
实际:
  ___
通过: [ ] 本地  [ ] 线上
```

### 2. 翻译 API `/api/v1/translate`

```
测试用例 EN→CN:
  "Portable Bluetooth Speaker with noise cancel"
预期:
  包含"便携""蓝牙""音箱""降噪"等中文词，而非"[中文翻译]"标签
实际:
  ___
通过: [ ] 本地  [ ] 线上
```

### 3. SEO 优化 `/api/v1/seo-optimize`

```
测试用例:
  title: "Best product ever amazing incredible" | platform: amazon
预期:
  suggestions 非空，提示标题过长或包含禁用词
实际:
  ___
通过: [ ] 本地  [ ] 线上
```

### 4. Format Checker `/api/v1/format-check`

```
测试用例:
  title: "#1 Best Cure GUARANTEED 100%" | platform: amazon
预期:
  Score < 50, issues 包含 banned_keyword 类型
实际:
  ___
通过: [ ] 本地  [ ] 线上
```

### 5. 物流计算 `/api/v1/shipping-calculate`

```
测试用例:
  weight: 2 | state: CA | origin: yiwu
预期:
  methods 非空，至少3种物流方式
实际:
  ___
通过: [ ] 本地  [ ] 线上
```

## 测试命令

```bash
# 本地测试
node -e "const {reviewContent}=require('./x402-api/compliance-engine'); \
  const r=reviewContent({text:'最好的国家级产品，治愈皮肤问题',platform:'douyin',type:'title'}); \
  console.log('Score:',r.score,'Checks:',r.checks.length)"

# 线上测试（Render部署后）
curl -s -X POST https://mediacraft-x402-api.onrender.com/api/v1/compliance-check \
  -H "Content-Type: application/json" \
  -d '{"text":"最好的国家级产品治愈皮肤问题","platform":"douyin","type":"title"}'
```

## 检查频率

| 触发条件 | 频率 |
|---------|------|
| 修改 platform-rules.json | 立即测试合规+格式化 |
| 修改 server.js 任何API | 立即测试全部5个端点 |
| 每次 Git push | 等待Render部署后测试线上 |
| 无修改 | 每周一次全面回归 |

## 失败处理

1. 本地通过 + 线上失败 → Render未部署，等待3分钟后重试
2. 本地失败 + 线上失败 → 代码bug，立即修复
3. 本地通过 + 线上通过 → 记录通过时间

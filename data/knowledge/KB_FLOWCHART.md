# 工作H — 知识库架构流程图

```
┌─────────────────────────────────────────────────────────┐
│                    工作H：知识库                          │
│                  （永远开放，永远增长）                    │
└─────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌───────────┐   ┌───────────┐   ┌───────────┐
    │  写入层    │   │  查询层    │   │  蒸馏层    │
    │ addAtom() │   │ search()  │   │ distill() │
    └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
          │               │               │
          ▼               ▼               ▼
    ┌──────────────────────────────────────────┐
    │           JSONL 原子文件（23个）            │
    │                                          │
    │  A组: quest_bidding, red_packet,         │
    │        category_winrate, competitor,     │
    │        platform_tips                     │
    │  B组: compliance, listing_seo,            │
    │        shipping, user_feedback           │
    │  C组: api_listing, pricing               │
    │  D组: agent_market                       │
    │  E组: opinion                            │
    │  F组: infra, tool_install                │
    │  G组: diagnostic, tutoring,              │
    │        knowledge_graph                   │
    │  *组: market_observation,                │
    │        lesson_learned, response_template │
    └────────────────────┬─────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │ 工作A    │    │ 工作B    │    │ 工作C-G  │
    │ Daemon  │    │ 工具箱   │    │ 其他工作  │
    └────┬────┘    └────┬────┘    └────┬────┘
         │              │              │
         ▼              ▼              ▼
    ┌─────────────────────────────────────┐
    │        getRelevantAtoms(W, topic)    │
    │        查询相关经验 → 融入响应生成     │
    └─────────────────────────────────────┘

写⼊流程:  事件发生 → addAtom(category, data) → JSONL追加
查询流程:  生成回答 → getRelevantAtoms(work, topic) → 融入上下文
蒸馏流程:  定期触发 → distill() → 提炼高频模式 → 清理冗余
```

## 知识原子结构

```
{
  id: "A-xxxxx",           // 唯一ID
  time: "2026-05-28T...",  // 记录时间
  work: "A",               // 所属工作线（* = 通用）
  category: "quest_bidding", // 分类
  source: "daemon-cycle",  // 来源
  pattern: "技术类胜率40%",  // 提炼的模式
  confidence: "observed",  // 置信度
  tags: ["tech","strategy"], // 标签
  detail: "具体说明..."      // 详细内容
}
```

## 当前状态

- 20 个知识原子
- 23 个分类文件
- 覆盖 A-G 全部工作线
- 已接入 Daemon（工作A）自动读写

## 增长计划

1. Daemon 每轮循环自动记录
2. 每赢一次自动记录胜率模式
3. 每失败一次自动记录原因
4. 达到 50 个原子后运行 distill() 蒸馏
5. 达到 100 个原子后生成知识图谱可视化

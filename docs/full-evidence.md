# Full evidence / 分卷协议（v0.2.1）

全量入口用于**已经获授权、去敏并保留原断点**的 Collection JSON。它不扩大scan授权、不重跑原始历史、不替代语义审阅。原生scan仍是有明确预算的采样入口，触限继续阻断评分。

```sh
node scripts/cli.mjs pack --collection <完整collection.private.json> --out <新私密分卷目录>
node scripts/cli.mjs evaluate --manifest <分卷目录/manifest.json> --evaluation <完整evaluation.private.json> --out <新报告目录>
```

原命令 `evaluate --collection ... --evaluation ... --out ...` 也走同一流式路径：将完整输入保存到报告目录的evidence分卷，再全局核验。没有500事件或12MiB总输入上限；JSON尾部空白不会导致语义相同输入被拒绝。需要Python3与SQLite标准库。输入和输出必须位于已授权私密位置，不放进Git或网站。

所有事件和额外字段保留在约4MiB的JSONL卷中，事件不拆断；大于卷目标的单个事件单独成卷。保留原id/eventId/sourceId/snapshotId/locator/时间和正文；缺少eventId时由源标识、原定位、原id、任务和时间稳定派生，不按卷重新编号。正式引用ID可使用稳定的跨源复合键（字母数字及 . _ : @ | / # = -，最长256字符），不强迫改成局部e1/e2；原生e编号也继续兼容。去敏后同文仍是不同事件，只可共享contentRef。重复id或eventId拒绝，不覆盖、不删除、不静默合并。

manifest包含各卷次序/起始序号、事件数、字节数和SHA256，元数据哈希、原输入哈希和全局根哈希。只有完整解析到EOF、未丢事件、主键唯一时才写complete清单；缺卷、坏哈希、重复卷、错序、计数不符或尾部非JSON数据均拒绝。哈希证明与本地清单一致，不是第三方真实性认证。

验证时按卷逐行读取，使用临时SQLite磁盘索引核对全部事件、全部reviewedEvidence/excludedEvidence及taskGroups；审阅ID重复、未知、重叠或排除事件被引用均拒绝。尚未审阅的事件可保留，但全局review门槛未闭合，仍无分数/维度/雷达/公开文件。每卷不出分，最终只运行一次全局24指标门槛及原公式。

正式报告的内存投影只加载指标/叙事引用所需的**事件元数据**；正文继续完整保存在分卷，引用索引的archiveRef明确对应卷文件和行号。它不是丢弃未引用证据，也不意味着只审阅引用集合。报告明确给出总保留数、全局审阅/排除数、家族数、卷数、哈希与正文清单位置。`review-events.private.jsonl`保存每个审阅处置；`evaluation-input.private.json`逐字节保留完整原评估；`evidence-index.private.json`记录完整性根与引用索引。引用索引内的占位正文不用于语义评分，语义判断须基于保留的完整卷。

有界内存：正文输入按64Ki字符块解码，卷约4MiB；SQLite缓存4MiB且临时表落盘。总历史容量不决定Node内存：Node仅接收元数据投影、24项决定与统计。单个JSON事件/控制值上限16Mi字符，源元数据和评估控制集合各16MiB，引用元数据投影12MiB，Node接收控制投影上限32MiB；超过时明确拒绝而不截断，需将异常单事件/控制导出显式分离，保留原数据。总磁盘随全部证据增长；无需声称无限资源。全量操作可能较长，以已保留/核验事件与卷说明进度，耗时不加分。

不上传分卷、报告、review或原始输入。网页未完成新版部署之前，仍不得发布个人评分。

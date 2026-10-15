# AI Native Score — Agent Skill

供你的agent直接使用的本地AI协作评价skill。授权选择Codex/Hermes等实例、日期与项目，收集去敏行为证据，输出丰富中文评价、六维雷达、覆盖度、反例和可执行建议。工具数量不加分。

**本地评价与可选聚合发布已可用。** 默认网站：[AI Native Score](https://ai-native-score.laolv-wenxiang.workers.dev)。先生成本地深度报告，用户明确确认准确聚合字段、昵称与目标后才上传。公开仓库只包含skill、收集器、评估器、发布客户端、必要脚本/测试、文档与合成fixture；网站/服务端/部署项目独立私有维护。

## 使用

需要Node 22.14+；Hermes SQLite读取还需带sqlite3的Python。克隆源码执行：

```sh
npm ci --ignore-scripts
npm run build
```

将 `skill/ai-native-score` 整个文件夹复制到所选agent的技能目录，不覆盖同名内容。例如Codex：

```sh
test ! -e "$HOME/.codex/skills/ai-native-score" && cp -R skill/ai-native-score "$HOME/.codex/skills/"
```

在agent里调用 `$ai-native-score`。选择准确实例、日期与项目后，skill展示扫描范围，执行只读收集，在当前agent模型中分析去敏记录，生成本地中文报告和雷达。已有范围授权无需重复询问，额外私密来源另行选择。

深度报告区分人类贡献和agent活动，结合真实结果、反例与长期工作/生活模式，解释强项、短板、建议和限制。缺证据时整体暂不评分：不输出临时总分、六维分、区间或雷达，只给缺口和补查/导出指引；缺证据结果不进入完整评分排行。仅导入skill或存在配置不证明使用能力。

如果agent使用云模型，去敏历史/摘要仍会进入其服务商上下文。本地收集器零网络不等于云agent语义评估完全离线；真正离线应使用本地模型。去敏尽力而为，先核对私密账本。

## 独立CLI

```sh
node skill/ai-native-score/scripts/cli.mjs plan --scope scope.local.json
node skill/ai-native-score/scripts/cli.mjs scan --scope scope.local.json --confirm-scope <计划摘要> --out reports/collection
node skill/ai-native-score/scripts/cli.mjs evaluate --collection reports/collection/collection.private.json --evaluation evaluation.private.json --out reports/assessment
```

准确格式见[SKILL.md](skill/ai-native-score/SKILL.md)和`schemas/`。输出report.md、离线report.html、report.json及私密evaluation；只有证据完整才有雷达和聚合public-score.json；新目录和私密文件，不覆盖旧结果。日期按UTC自然日。

用户明确选择公开时（默认站点已上线，可用 `--site` 指定其他兼容站点）：

```sh
node skill/ai-native-score/scripts/cli.mjs publish-plan --score reports/assessment/public-score.json --nickname "可选昵称"
# 核对全部字段与目标，并获得本次提交确认后：
node skill/ai-native-score/scripts/cli.mjs publish --score reports/assessment/public-score.json --nickname "同一昵称" --confirm-public <计划摘要> --receipt reports/submission.receipt.json
```

CLI只上传版本、六维分数、总分/区间、覆盖率、证据质量、类型及选填昵称。原文、源码、日期、任务ID、证据和路径不上传。返回网页链接；删除token仅以0600写入私密receipt、通过Authorization传送，不在URL或聊天中展示。网络失败保留同一receipt重试。

```sh
node skill/ai-native-score/scripts/cli.mjs delete --receipt reports/submission.receipt.json --confirm-delete <对应记录ID>
```

评分及昵称可能是个人信息。公开结果是实验性自评，可伪造，非认证。网站后端代码和部署配置不在本仓库。公开main与当前tag已重建为纯skill历史，旧v0.1.0 tag/release已移除。GitHub缓存、旧SHA可达对象及第三方已下载/克隆的副本不能保证消失。

## 评分依据与许可

六个等权维度：目标与委派、上下文表达、工作流编排、评估与判断、学习与复用、安全与责任。每轴四项原创行为指标0–4，未知为null；完整总分为六轴均值，显示整数。覆盖率、证据质量、能力分分别解释。

[方法与指标](docs/methodology.md) · [来源对应关系与许可边界](THIRD_PARTY.md) · [隐私与数据流](docs/privacy.md) · [合成报告](examples/report.synthetic.md)。公开框架只提供概念启发，未验证、认证或背书本指标；教育素养框架不能直接当职业绩效评价。本项目不复制非商业或ShareAlike课程正文/量表。

## 测试与构建

```sh
npm run check
npm test
npm run package
npm run scan
```

测试仅用合成数据：未知/区间、证据引用与重复、未使用skill不加分、日期/symlink/FIFO/预算、canary去敏、历史指令不执行、发布确认与目标绑定、凭据重试与删除。模型语义判断和注入抵抗仍需模型层验证，不能由格式测试保证。

[MIT](LICENSE)覆盖原创skill/代码/指标；外部链接保持各自许可。`reports/`、真实范围、receipt、.env和依赖目录不发布。

## am-0.2 证据门槛

先运行 `node skill/ai-native-score/scripts/cli.mjs discover`，区分发现、适配、授权和实际读取。Codex/Hermes支持原生读取及明确多profile；WorkBuddy、OpenClaw、DeepSeek Harness、ZCode、Claude Code、GPT/ChatGPT需选定导出或适配，未知路径不猜。运行可能较长，按来源和有效任务链报告覆盖，不按耗时或记录量给分。

每项需要用户决策/行动、结果、后续独立核验、反证检索、不确定性、下一级差距及可检验改进。多次提出要求不等于稳定实践；明确委派本身可作为相关决策证据，但仍需执行和核验。旧版记录保留版本，不自动删除或改分。

[逐项行为锚点](docs/behavior-anchors.md) · [报告约定](docs/report-guide.md) · [改造审计](docs/implementation-audit.md)。不读取凭据及受限目录，不保证绝对安全；云模型评估仍会接触去敏材料。

## v0.2.1 全量与分卷

原生scan仍有预算；完整去敏快照使用正式 `pack --collection <完整JSON> --out <分卷目录>`，然后 `evaluate --manifest <manifest.json> --evaluation <完整审阅JSON> --out <新报告目录>`。原evaluate --collection也自动走流式封装。无500事件/12MiB总输入门槛，全部正文与字段保留；哈希、顺序、全局主键、审阅处置及家族统一核验，不按卷出分。内存投影只含引用元数据，完整正文仍在私密卷。详见[全量协议与明确资源界限](docs/full-evidence.md)。网页未升级时仍禁止个人评分上传。

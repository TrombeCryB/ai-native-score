# 评分来源对应关系与许可边界

本项目的24项指标、0–4锚点、等权公式、缺证据区间与实现均为原创综合设计 `am-0.1`。以下框架提供概念启发，**没有验证、认证或背书这个分数**。教育素养框架与职业/生活任务表现不能直接画等号。对应关系是本项目作者的设计映射，不是来源作者发布的量表映射。

| 来源 | 对应原创指标 | 采用的概念与边界 |
| --- | --- | --- |
| [UNESCO AI competency framework for students (2024)](https://www.unesco.org/en/articles/ai-competency-framework-students) | A2工具限制、A3人机责任；F1–F4 | 人类主导与AI伦理启发责任维度；学生教育框架不直接等于专业能力测量。 |
| [OECD/EU — Empowering learners for the age of AI (2026)](https://www.oecd.org/en/publications/empowering-learners-for-the-age-of-ai_65cd27d4-en.html) | A2–A3；C1–C4；E1–E4；F4 | 使用、创造、管理与参与AI的多面性，支持不只看工具操作；本项目另写任务行为指标。 |
| [DigComp 3.0](https://joint-research-centre.ec.europa.eu/scientific-activities/key-competences-lifelong-learning/digital-competence-framework-digcomp/digcomp-30_en) | B1–B4；D2–D3；E2；F1/F4 | 信息判断、协作、创造、安全和问题解决启发上下文、核验与迁移；不复制能力等级表。 |
| [Anthropic AI Fluency Index](https://academy.claude.com/tutorials/the-ai-fluency-index) | A1；B2/B4；D3及全部未知处理 | 用行为证据观察协作；其公开观察范围有限，不能从对话或配置推断全部能力。相关4D课程采用CC BY-NC-SA，本项目不复制其正文、原量表或改写版本。 |
| [NIST AI RMF core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/) | C3；D3；F1–F4 | 治理、风险识别和持续管理启发失败升级、监督与责任。不是把风险框架改造成官方个人评分。 |
| [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) | A2/A4；C1–C4 | 合理流程、工具选择、简单性与复杂度取舍；更多agent或更复杂流程不自动得高分。 |
| [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) | D1/D2/D4；E3/E4 | 验收、独立检验、失败分析和评估维护；agent自称完成不足以证明结果可靠。 |
| [SPACE of Developer Productivity](https://www.microsoft.com/en-us/research/publication/the-space-of-developer-productivity-theres-more-to-it-than-you-think/) | 全部维度的数量代理限制，特别C4 | 活动数量不是能力/结果的单一代理；skill数、tokens、提交数、多agent数都不直接加分。 |

## 许可

[MIT](LICENSE)仅覆盖本项目原创skill、收集/评估/发布客户端代码、原创指标措辞和合成fixture。外部链接继续受其各自许可约束；不把CC BY-NC-SA、CC BY-SA或其他外部课程/量表正文并入MIT，不以引用链接声称获得再许可。没有拷贝外部图形、问卷、商标或大段正文。

[Hermes Agent源码](https://github.com/NousResearch/hermes-agent)仅用于了解记录格式；适配器独立编写，不导入执行agent代码。公开skill依赖：TypeScript (Apache-2.0)、tsx/esbuild/Node types (MIT)，锁定版本见package-lock.json及各包LICENSE。

网站、服务端和部署实现独立私有维护，不属于当前skill-only tree；旧公开refs和release按用户确认清理，无法保证缓存或外部副本消失。评分来源只解释方法，不表示上述机构与网站或本项目有关联。

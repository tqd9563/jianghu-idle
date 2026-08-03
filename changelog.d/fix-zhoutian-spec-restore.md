### 修复

- **周天规格丢失内容取回**：`zhoutian.md` v2.0 合并时自述「口径零变更」，实际整节丢失原 spec 的 §11 呈现一致性与 §6.4 敌人曲线锚定——前者是 `AcupointPanel.tsx` 与 `rules/copy/zhoutian.md` 的活引用目标（进度回落 / 印记常亮 / 气势条三层 UI 语义与组件映射），后者是「窍穴上线后不重锚敌人数值」的裁决依据。两节从归档件逐字取回，落 `systems/zhoutian/spec.md` v1.0。

### 变更

- **口径守恒表更正**：`design.md` 升 v2.1，守恒表按实际去向逐条重列——§2–§9/§12 并入正文、§6.4/§11 移交 `spec.md`、§10 指针化到 `rules/formulas.md` §5（优先级 1.5 行已逐字在册）、§13 收口清单留档归档件；frontmatter 移除不成立的「口径零变更」表述。
- **引用改指**：`AcupointPanel.tsx` 与 `rules/copy/zhoutian.md` 的上游指针从 design.md 改指 `spec.md` §1；文案冻结件的上游不再虚指 design.md 中不存在的措辞章节。

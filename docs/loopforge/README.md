# LoopForge 任务交付记录

- 工作项：LOOP-1，创建一个贪吃蛇的 H5。
- 原前端运行：`run-1794816416240418883`。
- 原代码基线：`a9065d203900c387267d1d1bfb4e2aab05a53c13`（main）。
- 本目录保留原任务结束时的需求、设计、实现说明、独立评审及测试报告。这些历史报告中的工作区路径和当时的 Git 状态不代表本次提交后的远端状态。
- 原任务最新工作区检查点缺少源码；本次从 MySQL 历史日志中的完整工作区快照恢复原始 9 个源文件。没有重新编写游戏。
- 恢复后的源码重新运行 `npm test`：16 项通过、0 失败；JavaScript 语法检查通过。

## 入口

- 运行方式见仓库根目录 [README.md](../../README.md)。
- [需求](requirement.md) / [设计](design.md) / [实现说明](implementation.md)。
- [独立评审](review.md) 中有非阻断改进项，适合作为后续 Bug 修复输入。
- [测试报告](test-report.md) 包含原任务实际验证记录与未验证范围。

## 恢复文件校验

| 文件 | SHA-256 |
| --- | --- |
| `README.md` | `27f2526e1312a39464f868fc50b43881fb6570af327f972ee476f7671c7a0f09` |
| `app.js` | `8553e8b3542e1a2ecd00e11cf1fb40737bcb66f94a64c9ef4768410a2f92c1cd` |
| `assets/OFL.txt` | `1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9` |
| `assets/noto-sans-sc-subset.woff2` | `80e41616fe283ee952c55f7b0efeb7dd01eeaaf5e75e12cf31fd41a0b9f74769` |
| `game-core.js` | `22664d11a964c95dcd69573b4ca3d4d9930f1fe6cac1643f9542a6a9f8239501` |
| `index.html` | `eea838a4e9fbfda96207fa52c6ec7b691f6a23dd3dd49764b122cf3303634265` |
| `package.json` | `119a0a09854149d27424ac0e388c3d41b0d8b083edbcc6c9e8015d2fc34f9567` |
| `styles.css` | `53462c50e9efdbbf5a39b68fea6d9327a230abcdd2471f0e53e9f6e939ec0091` |
| `tests/game-core.test.js` | `70b28aba7e57859731fbdf39b9875d47c415f027cc78aeb9c5ec275fea9fc03c` |

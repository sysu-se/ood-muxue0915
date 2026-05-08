# EVOLUTION.md - Design Evolution from Homework 1 to Homework 2

## 1. 如何实现提示功能？

提示功能通过分析当前棋盘状态，使用标准的数独求解逻辑实现：

### 候选提示（Candidate Hints）
- **实现位置**：`src/domain/solver.js` 中的 `getCandidates(grid, row, col)` 函数
- **工作原理**：
  - 收集候选数 1-9
  - 排除同行已有的数字
  - 排除同列已有的数字
  - 排除同个 3×3 宫已有的数字
  - 返回剩余候选数组

### 下一步提示（Next Step Hints）
- **实现位置**：`src/domain/solver.js` 中的 `findNextMove(grid)` 函数
- **工作原理**：
  1. 首先查找"裸单数"（Naked Singles）- 只有一个候选的格子
  2. 若无裸单数，查找"隐单数"（Hidden Singles）- 某行/列/宫中，某个数字只能放在一个位置
  3. 返回 `{row, col, value, reason}` 对象，说明推荐位置和推荐原因

### 冲突检测
- **函数**：`isInConflict(grid)` - 检测是否有空格子无法填入任何数字

## 2. 提示功能属于 Sudoku 还是 Game？

### 设计决策：提示属于 **Sudoku**

#### 理由

1. **职责划分**：
   - `Sudoku` = 领域模型，代表谜题本身
   - `Game` = 会话管理，管理玩家与 Sudoku 的交互历史

2. **提示是静态分析**：
   - 提示只依赖于当前棋盘状态
   - 不涉及历史记录或会话状态
   - 与 undo/redo 无关

3. **接口清晰**：
   ```javascript
   // Sudoku 提供纯粹的逻辑能力
   sudoku.getCandidateHint(row, col)  // -> [1,2,5,7]
   sudoku.getNextHint()                // -> {row:0, col:2, value:4, reason:'naked_single'}
   sudoku.isInConflict()               // -> true/false
   
   // Game 可以委托给 Sudoku
   const hint = game.getSudoku().getNextHint()
   ```

4. **可复用性**：
   - 同一 Sudoku 状态无论通过哪个 Game 会话查询，答案都相同
   - 提示能力独立于会话历史

## 3. 如何实现探索模式？

### 核心设计：探索模式作为 Game 的临时状态

```
┌─────────────────────────────────────────┐
│ Normal Mode                              │
│ ├─ Main History: [grid0, grid1, grid2]  │
│ └─ Current: grid2                        │
└─────────────────────────────────────────┘
         ↓ enterExplore()
┌─────────────────────────────────────────┐
│ Explore Mode                             │
│ ├─ Checkpoint: {original grid, history} │
│ ├─ Explore History: [grid0']            │
│ ├─ Failed Paths: Set of board hashes    │
│ └─ Current: grid0'                      │
└─────────────────────────────────────────┘
    ↓ commitExplore()              ↓ abandonExplore()
  归并到主历史              恢复主游戏状态，记住失败路径
```

### 实现方式

#### 进入探索模式
```javascript
game.enterExplore()
// 保存当前 game 状态为检查点
this.exploreMode = {
  grid: this.sudoku.getGrid(),
  history: this.history.clone(),
  historyIndex: this.historyIndex,
  startGrid: structuredClone(grid),  // 探索起点
  failedPaths: new Set()
}
```

#### 在探索中进行猜测
```javascript
game.guessExplore(move)
// ✓ 检查冲突 - 若发现冲突(无效格子)，返回失败
// ✓ 检查记忆 - 若到达已失败路径，警告用户
// ✓ 返回 {success, conflict, wasFailed, message}
```

#### 探索内的撤销和回滚
```javascript
game.undoExplore()       // 在探索内撤销
game.resetExplore()      // 回到探索起点
game.backtrackExplore()  // 放弃当前路径，记住失败，重置到起点
```

#### 提交或放弃探索
```javascript
game.commitExplore()   // 合并结果到主历史
game.abandonExplore()  // 恢复主状态，记住这条失败路径
```

### 关键特性

1. **冲突检测**：通过 `sudoku.isInConflict()` 检测无法继续的状态
2. **路径记忆**：使用 `Set<String>` 存储已失败的棋盘哈希值
3. **快速回滚**：保存整个探索检查点，可快速恢复
4. **主副分离**：探索中的操作不污染主 history

## 4. 主局面与探索局面的关系是什么？

### 对象关系

```
Main Game
├─ sudoku (当前棋盘状态)
├─ history (主历史)
├─ historyIndex (当前位置)
└─ exploreMode (null 或 checkpoint)
     ├─ grid (保存的主棋盘)
     ├─ history (保存的主历史)
     ├─ historyIndex (保存的历史位置)
     └─ startGrid (探索起点)
```

### 是共享还是复制？

- **采用复制方案**（Deep Copy）
- **原因**：
  1. 避免引用污染 - 探索过程不会影响主棋盘
  2. 独立管理 - 探索有独立的临时历史
  3. 提交合并简单 - 直接追加到主历史
  4. 失败回滚简单 - 直接恢复备份

### 深拷贝的处理

```javascript
// 进入探索时：深拷贝当前状态
this.exploreMode = {
  grid: structuredClone(this.sudoku.getGrid()),
  history: this.history.map(g => structuredClone(g)),
  ...
}

// 退出探索时：恢复或合并
game.commitExplore()   // 追加到主历史
game.abandonExplore()  // 恢复备份
```

### 提交时合并策略

```javascript
commitExplore() {
  // 截断主历史到当前位置
  if (this.historyIndex < this.history.length - 1) {
    this.history = this.history.slice(0, this.historyIndex + 1)
  }
  
  // 添加探索结果作为新步骤
  this.history.push(this.sudoku.getGrid())
  this.historyIndex++
  
  // 清除探索模式
  this.exploreMode = null
}
```

### 放弃时回滚策略

```javascript
abandonExplore() {
  // 1. 记住这条路失败
  this.failedExplorationPaths.add(boardHash)
  
  // 2. 恢复主棋盘
  this.sudoku = new Sudoku(this.exploreMode.grid)
  this.history = this.exploreMode.history
  this.historyIndex = this.exploreMode.historyIndex
  
  // 3. 清除探索模式
  this.exploreMode = null
}
```

## 5. History 结构在 Homework 2 中是否发生了变化？

### 变化情况

#### 基本 History 结构
- **HW1**：线性栈 `[grid0, grid1, ..., gridN]` + `historyIndex`
- **HW2**：仍为线性栈，**未引入树状分支**

#### 新增的探索 History
- 探索模式有独立的临时 history
- 只在提交时合并到主 history
- 分支不会永久存在于树中

#### 为什么保持线性设计？

1. **简化性**：树状分支会复杂化序列化、撤销、提交逻辑
2. **用户预期**：标准数独玩家习惯线性撤销/重做
3. **探索需求满足**：临时 history 足够支持单条探索路径
4. **后续扩展空间**：若需多路径探索，可升级而不破坏现有结构

### History 序列化

```javascript
toJSON() {
  return {
    sudoku: this.sudoku.toJSON(),
    history: this.history,              // 主历史
    historyIndex: this.historyIndex,
    exploreMode: this.exploreMode ? {   // 探索检查点
      grid: ...,
      history: ...,
      historyIndex: ...,
      failedPaths: Array.from(...)
    } : null,
    failedExplorationPaths: Array.from(...)
  }
}
```

## 6. Homework 1 中的哪些设计在 Homework 2 中暴露出了局限？

### 局限 1：Sudoku 中没有状态验证

**问题**：
- 在 HW1 中，Sudoku 是被动的容器
- 无法判断当前状态是否有效
- 无法判断是否仍可继续玩游戏

**在 HW2 中的需求**：
- 需要 `isInConflict()` 检测冲突
- 需要 `isSolved()` 检测完成
- 需要候选分析

**解决方案**：
- 扩展 Sudoku 添加了静态分析方法
- 这些方法是查询而非修改，保持 Sudoku 的领域模型纯洁性

### 局限 2：Game 对象职责单一

**问题**：
- HW1 中 Game 只管理历史
- 缺乏"模式"概念（单模式 vs 多模式）
- 无法支持平行的临时状态

**在 HW2 中的需求**：
- 需要在不同"模式"间切换（Normal ↔ Explore）
- 需要为探索保存检查点
- 需要跟踪失败路径

**解决方案**：
- 添加 `exploreMode` 状态字段
- 使用有限状态机思想（虽然简化实现）
- 每个模式有独立的历史和临时数据

### 局限 3：序列化未考虑扩展性

**问题**：
- HW1 的 `toJSON()` 格式过于简单
- 无法扩展新的会话状态

**在 HW2 中的改进**：
- Game 的 JSON 现在包含 `exploreMode` 字段
- 预留了 `failedExplorationPaths` 结构
- `createGameFromJSON` 能正确恢复完整状态

### 局限 4：没有冲突和有效性检查

**问题**：
- 用户可以让棋盘陷入无法继续的状态
- 在探索中无法判断"这条路死了"

**解决方案**：
- 添加了 `isInConflict()` 方法
- 在探索过程中实时检测冲突
- 支持"记忆"失败的探索路径

## 7. 如果重做 Homework 1，会如何修改原设计？

### 改进 1：预留 Sudoku 的「分析」接口

```javascript
// 原设计缺少这些方法
class Sudoku {
  // HW1 的方法
  getGrid() { }
  guess(move) { }
  clone() { }
  toJSON() { }
  toString() { }
  
  // 应该在 HW1 就添加的方法
  getCandidates(row, col) { }      // 候选分析
  isValid() { }                     // 有效性检查
  isSolved() { }                    // 完成检查
}
```

**含义**：将查询能力设计为 Sudoku 的一级功能，而不是后期加补丁。

### 改进 2：设计 Game 为状态机

```javascript
// 原设计：没有显式的状态管理
class Game {
  guess(move) { }
  undo() { }
  redo() { }
}

// 改进设计：增加状态管理能力
class Game {
  // 模式管理
  getMode() { }           // 当前模式：'normal' | 'explore' | 'solved'
  enterMode(mode) { }
  exitMode() { }
  
  // 还是保留原有接口
  guess(move) { }
  undo() { }
  redo() { }
}
```

### 改进 3：将历史管理提取为单独模块

```javascript
// 原设计：历史逻辑混在 Game 中
class Game {
  constructor() {
    this.history = []
    this.historyIndex = 0
  }
}

// 改进设计（预留接口）
class History {
  constructor() { }
  push(state) { }
  undo() { }
  redo() { }
  getState() { }
}

class Game {
  constructor() {
    this.history = new History()
  }
}
```

这样 HW2 中添加"探索历史"时，可以复用 History 类，而不是重复代码。

### 改进 4：分离「序列化格式」和「对象模型」

```javascript
// 原设计：toJSON() 直接暴露内部结构
game.toJSON() → { sudoku: {...}, history: [...], historyIndex: 0 }

// 改进设计：定义明确的格式规约
class GameSerializer {
  serialize(game) { }
  deserialize(json) { }
}
```

这样格式演进（如添加 `exploreMode`）会更清晰。

### 改进 5：显式的冲突/有效性设计

```javascript
// 原设计：被动接受所有 guess()
sudoku.guess({row, col, value})  // 可能导致无效状态，但不检查

// 改进设计：主动检查或返回验证结果
const result = sudoku.guess({row, col, value})
// result = {success: true|false, error?: string}
```

或者支持"尝试"：
```javascript
sudoku.tryGuess({row, col, value})  // 不修改状态，只验证
sudoku.guess({row, col, value})      // 确认修改
```

### 改进 6：预设扩展点和插件接口

```javascript
// 预设求解策略为可配置
const strategies = [
  NakedSingleStrategy,      // 裸单数
  HiddenSingleStrategy,     // 隐单数
  PointingPairStrategy,     // 更复杂的技巧
]

sudoku.setStrategies(strategies)
sudoku.getNextHint()  // 使用配置的策略
```

## 总结

### 设计演进的主线

1. **添加分析能力** - Sudoku 从被动容器 → 主动分析者
2. **状态管理升级** - Game 支持多模式（Normal/Explore）
3. **临时状态支持** - 探索模式有独立的临时历史和备份
4. **路径记忆** - 跟踪已失败的探索分支
5. **完整序列化** - 保存包括探索状态的完整游戏状态

### 核心改进方向

| 方面 | HW1 设计 | HW2 增强 | 未来可能 |\n|------|---------|---------|----------|\n| Sudoku 能力 | 被动容器 | +分析查询 | +验证返回值 |\n| Game 状态 | 单一模式 | 多模式 | 完整状态机 |\n| History 结构 | 线性栈 | +临时histor | +树状分支 |\n| 序列化 | 简单JSON | 扩展格式 | Schema 定义 |\n| 扩展性 | 无 | 预留接口 | 插件系统 |\n\n这种演进方式遵循了"开闭原则"——对新功能开放，对原有功能关闭，通过添加新方法而非修改旧逻辑来实现扩展。\n
# NewRAG

NewRAG 是一个前后端一体化的 RAG 开发仓库。

仓库当前包含：

- `frontend`：React + TypeScript + Vite 前端工作台
- `backed`：FastAPI 后端服务（目录名当前就是 `backed`）
- `docs`：联调、验收、规划与测试样例文档

这个仓库已经整理为单一 Git 仓库，前后端统一管理和提交。

## 仓库结构

```text
NewRAG/
├─ frontend/      # 前端应用
├─ backed/        # 后端服务
├─ docs/          # 联调与验收资料
├─ 参考资料/       # 辅助资料
└─ README.md      # 仓库总览说明
```

## 技术栈

### 前端

- React 18
- TypeScript 5
- Vite 5
- React Router DOM 7
- i18next
- Framer Motion

### 后端

- Python 3.11+
- FastAPI
- Uvicorn
- PyPDF2
- python-docx
- httpx
- pytest

## 快速开始

建议先启动后端，再启动前端。

### 1. 启动后端

```bash
cd backed
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

启动后可访问：

- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8000/ready`
- `http://127.0.0.1:8000/docs`

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

推荐在 `frontend/.env.local` 中配置：

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

前端通常运行在：

- `http://127.0.0.1:5173`
- `http://localhost:5173`

## 推荐联调顺序

1. 启动 `backed`
2. 启动 `frontend`
3. 在文档管理页上传文档
4. 在索引管理页执行索引构建
5. 到问答工作台或聊天页发起问题
6. 排查时查看系统状态页和后端 Swagger

## 常用开发命令

### 后端

```bash
cd backed
PYTHONPATH=. pytest -q
```

### 前端

```bash
cd frontend
npm run build
npm run lint
```

## 详细文档入口

- 前端说明：`frontend/README.md:1`
- 后端说明：`backed/README.md:1`

## 关键目录说明

### `frontend`

前端主要页面包括：

- `/chat`：多轮聊天
- `/qa`：问答工作台
- `/docs`：文档管理
- `/index`：索引管理
- `/graph`：证据图谱
- `/eval`：评测
- `/status`：系统状态
- `/settings`：系统设置
- `/chains`：思维链管理

### `backed`

后端主要接口分组：

- `/health`、`/ready`
- `/api/documents/*`
- `/api/index/*`
- `/api/qa/*`
- `/api/answers/*`
- `/api/feedback`
- `/api/llm/*`
- `/api/eval/*`
- `/api/tasks/*`

## 当前实现说明

- 后端目录名当前是 `backed`，不是 `backend`
- 聊天页附件当前不会自动进入知识库，真正入库要走文档管理页上传
- 聊天页麦克风当前主要是 UI 状态切换，还没有完整语音识别链路
- 评测页当前主要运行内置样例数据集
- 后端默认把运行数据写到 `backed/data`（或当前 `DATA_DIR`）

## Git 说明

当前仓库已经处理成一个单仓库：

- 前后端都在同一个 Git 仓库内
- 不再把 `frontend` 当作嵌套子仓库提交
- 当前远端名为 `NewRAG`

## 后续建议

- 增加根目录 `.env.example`
- 增加根目录启动脚本
- 增加 CI：前端构建 + 后端测试
- 视情况把默认分支从 `master` 迁移到 `main`

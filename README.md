# NewRAG

本地单机版 NewRAG，包含：
- `backed`：FastAPI 后端
- `frontend`：React + Vite 前端

## 本地启动

后端：

```powershell
cd backed
$env:PYTHONPATH='.'
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

前端：

```powershell
cd frontend
$env:VITE_API_BASE_URL='http://127.0.0.1:8000'
npm run dev
```

## 验证

后端测试：

```powershell
cd backed
$env:PYTHONPATH='.'
pytest -q
```

前端检查：

```powershell
cd frontend
npm run lint
npm run build
```

## 当前约束

- 目标环境是本地单机，不适合直接暴露到公网。
- LLM `mock` 模式仅用于开发模拟，不代表真实模型可用。
- 上传、删除、归档、恢复文档后，需要重建索引才能继续问答。

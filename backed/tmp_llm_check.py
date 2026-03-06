from app.llm.moonshot import generate_chat_completion
from app.llm.config_store import LLMConfigStore
from app.core.config import Settings

settings = Settings.from_env()
store = LLMConfigStore(settings.data_dir)
config = store.load()
api_key = store.load_api_key()

prompt = """You are a QA assistant. Answer only using the evidence.
Question: What is the launch code?
Evidence:
- [1] root | Fact A: The launch code is 314159.
Answer:"""

for max_tokens in [64, 128, 256, 512]:
    try:
        result = generate_chat_completion(
            config.base_url,
            api_key,
            model=config.model_id,
            user_prompt=prompt,
            temperature=0.2,
            max_tokens=max_tokens,
            enable_web_search=False,
        )
        print("max_tokens", max_tokens, "ok", result.text.strip()[:200])
    except Exception as exc:
        print("max_tokens", max_tokens, "err", type(exc).__name__, str(exc)[:200])

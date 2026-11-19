# Trading V2 Edge Agent (local Jan beta)

A local Python coding agent controlled by a Microsoft Edge extension and connected to Jan's OpenAI-compatible local API. No paid API key is required when using a local Jan model.

## Requirements

- Windows 10/11
- Python 3.10+
- Git
- Jan running with its local API server enabled at `http://127.0.0.1:1337/v1`
- A local clone of the Trading V2 repository

## Setup

1. Clone the repository branch `agent/edge-local-agent` to `C:\TradingV2-Agent` (or use an existing clone).
2. Open Command Prompt and run `cd /d C:\TradingV2-Agent\edge-agent`.
3. Run `start.bat` once. It creates a virtual environment, installs dependencies and opens the `.env` file.
4. Confirm `OPENAI_BASE_URL=http://127.0.0.1:1337/v1`, `OPENAI_API_KEY=jan-local`, `OPENAI_MODEL=Jan-v3.5-4B-Q5_K_M.gguf`, and `TRADING_V2_REPO=C:/TradingV2-Agent`. The API key value is only a local placeholder; do not replace it with a paid key for local Jan.
5. Save `.env`, close Notepad, and run `start.bat` again. Keep Jan and the backend terminal open.
6. Open Edge and visit `edge://extensions`.
7. Turn on Developer mode, choose Load unpacked, and select `C:\TradingV2-Agent\edge-agent\extension`.
8. Copy the pairing token from `%USERPROFILE%\.tradingv2-agent\token.txt` into the extension and save it.
9. Enter a work instruction and press Start agent.

## Safety boundaries

- The backend connects only to the configured OpenAI-compatible endpoint; by default this is Jan on localhost.
- The backend binds only to 127.0.0.1.
- File operations are confined to the configured repository and block common secret files.
- The agent can edit project text files and run only fixed validation profiles that exist in this repository: Git status, the Node dashboard test suite, Python compilation, extension JavaScript syntax, and extension manifest JSON validation. Rust and Deno build profiles are intentionally not offered because their source/configuration trees are not present in this branch.
- It cannot run arbitrary shell commands, commit, push, merge, deploy, change GitHub settings or place trades.
- Each run is capped at seven hours. Stop is checked between model/tool calls; an in-flight model request or test may take time to finish.
- Review all changes before committing or publishing.

This is an early local beta, not a background service. Windows and Jan must remain on, and the backend terminal must stay open while the agent works. Tool calling depends on the selected Jan model/server supporting OpenAI-compatible function calls; if the 4B model does not reliably call tools, the agent may need a different local model.

# Trading V2 Edge Agent (local beta)

A local Python coding agent controlled by a Microsoft Edge extension. The browser extension never receives the OpenAI API key.

## Requirements

- Windows 10/11
- Python 3.10+
- Git
- A local clone of the Trading V2 repository
- An OpenAI API project key with API billing enabled

## Setup

1. Clone https://github.com/ebehinkaranzp-code/tradingv2 to your PC if it is not already cloned.
2. Run start.bat once. It creates a virtual environment, installs dependencies and opens the .env file.
3. In .env set OPENAI_API_KEY to your API key and TRADING_V2_REPO to the absolute path of your local clone. Optionally set OPENAI_MODEL to a model enabled for your API project.
4. Run start.bat again and keep its terminal window open.
5. Open Edge and visit edge://extensions.
6. Turn on Developer mode, choose Load unpacked, and select this folder's extension directory.
7. Copy the pairing token from %USERPROFILE%\.tradingv2-agent\token.txt into the extension and save it.
8. Enter a work instruction and press Start agent.

## Safety boundaries

- The API key stays in the local backend .env; never paste it into the extension.
- The backend binds only to 127.0.0.1.
- File operations are confined to the configured repository and block common secret files.
- The agent can edit project text files and run only fixed validation profiles: git status, pytest, cargo test, Deno check/test/build.
- It cannot run arbitrary shell commands, commit, push, merge, deploy, change GitHub settings or place trades.
- Each run is capped at seven hours. Stop is checked between model/tool calls; an in-flight API request or test may take time to finish.
- Review all changes before committing or publishing.

This is an early local beta, not a background service. Windows must remain on and the backend terminal must stay open while the agent works.

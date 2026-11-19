#!/usr/bin/env python3
"""
Trading v2 — single-file GitHub MCP server
Requires Python 3.10+; uses only the Python standard library.

Environment variables:
  GITHUB_TOKEN       Fine-grained token; never put it in this file or GitHub.
  GITHUB_OWNER       e.g. ebehinkaranzp-code
  GITHUB_REPO        e.g. tradingv2
  GITHUB_BRANCH      optional; defaults to main
  GITHUB_API_URL     optional; defaults to https://api.github.com

Run as an MCP stdio server. The MCP client must launch this script as a process.
"""

import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

OWNER = os.environ.get("GITHUB_OWNER", "ebehinkaranzp-code")
REPO = os.environ.get("GITHUB_REPO", "tradingv2")
DEFAULT_BRANCH = os.environ.get("GITHUB_BRANCH", "main")
API = os.environ.get("GITHUB_API_URL", "https://api.github.com").rstrip("/")
TOKEN = os.environ.get("GITHUB_TOKEN", "")
PROTOCOL_VERSION = "2024-11-05"


class MCPError(Exception):
    pass


def github(method, path, payload=None):
    if not TOKEN:
        raise MCPError("GITHUB_TOKEN is not set. Configure it in the MCP host environment.")
    url = API + path
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("Authorization", "Bearer " + TOKEN)
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    req.add_header("User-Agent", "trading-v2-mcp/1.0")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read()
            return json.loads(raw.decode("utf-8")) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        raise MCPError(f"GitHub API returned HTTP {exc.code}: {detail[:1500]}") from exc
    except urllib.error.URLError as exc:
        raise MCPError(f"Could not reach GitHub API: {exc}") from exc


def repo_path(suffix=""):
    return f"/repos/{urllib.parse.quote(OWNER)}/{urllib.parse.quote(REPO)}{suffix}"


def safe_branch(value):
    branch = value or DEFAULT_BRANCH
    if not isinstance(branch, str) or not branch or branch.startswith("-") or ".." in branch:
        raise MCPError("Invalid branch name.")
    return branch


def safe_repo_path(value):
    if not isinstance(value, str) or not value.strip():
        raise MCPError("A non-empty file path is required.")
    path = value.replace("\\", "/").strip("/")
    parts = path.split("/")
    if any(p in ("", ".", "..") for p in parts) or path.startswith(".git/") or path == ".git":
        raise MCPError("Unsafe repository path.")
    return path


def tool_definitions():
    return [
        {
            "name": "repository_info",
            "description": "Get metadata and the default branch for the configured Trading v2 repository.",
            "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
        },
        {
            "name": "list_files",
            "description": "List files and directories in a repository path.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path; empty string means repository root."},
                    "branch": {"type": "string"},
                },
                "additionalProperties": False,
            },
        },
        {
            "name": "read_file",
            "description": "Read a UTF-8 text file from the repository.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "branch": {"type": "string"},
                },
                "required": ["path"],
                "additionalProperties": False,
            },
        },
        {
            "name": "write_file",
            "description": "Create or replace one UTF-8 text file and commit it to a branch.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "content": {"type": "string"},
                    "message": {"type": "string"},
                    "branch": {"type": "string"},
                },
                "required": ["path", "content", "message"],
                "additionalProperties": False,
            },
        },
        {
            "name": "batch_commit",
            "description": "Commit multiple UTF-8 text files in one Git commit. Each file item has path and content. Existing unrelated files are preserved.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "files": {
                        "type": "array",
                        "minItems": 1,
                        "maxItems": 100,
                        "items": {
                            "type": "object",
                            "properties": {
                                "path": {"type": "string"},
                                "content": {"type": "string"},
                            },
                            "required": ["path", "content"],
                            "additionalProperties": False,
                        },
                    },
                    "message": {"type": "string"},
                    "branch": {"type": "string"},
                },
                "required": ["files", "message"],
                "additionalProperties": False,
            },
        },
        {
            "name": "create_branch",
            "description": "Create a new branch from an existing branch.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "branch": {"type": "string"},
                    "from_branch": {"type": "string"},
                },
                "required": ["branch"],
                "additionalProperties": False,
            },
        },
        {
            "name": "create_pull_request",
            "description": "Open a pull request from a head branch into a base branch.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "head": {"type": "string"},
                    "base": {"type": "string"},
                    "body": {"type": "string"},
                },
                "required": ["title", "head"],
                "additionalProperties": False,
            },
        },
    ]


def get_ref(branch):
    return github("GET", repo_path("/git/ref/heads/" + urllib.parse.quote(branch, safe="")))


def list_files(args):
    branch = safe_branch(args.get("branch"))
    path = args.get("path", "")
    if path:
        path = safe_repo_path(path)
    endpoint = repo_path("/contents" + ("/" + urllib.parse.quote(path, safe="/") if path else ""))
    result = github("GET", endpoint + "?ref=" + urllib.parse.quote(branch))
    if isinstance(result, dict):
        result = [result]
    return [
        {
            "name": item.get("name"),
            "path": item.get("path"),
            "type": item.get("type"),
            "size": item.get("size"),
        }
        for item in result
    ]


def read_file(args):
    branch = safe_branch(args.get("branch"))
    path = safe_repo_path(args["path"])
    item = github(
        "GET",
        repo_path("/contents/" + urllib.parse.quote(path, safe="/") + "?ref=" + urllib.parse.quote(branch)),
    )
    if item.get("type") != "file":
        raise MCPError("The requested path is not a file.")
    if item.get("encoding") != "base64":
        raise MCPError("GitHub did not return base64 content.")
    raw = base64.b64decode(item.get("content", ""))
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise MCPError("This tool reads UTF-8 text files only; binary files are not supported.") from exc
    return {"path": path, "sha": item.get("sha"), "content": content}


def write_file(args):
    branch = safe_branch(args.get("branch"))
    path = safe_repo_path(args["path"])
    payload = {
        "message": args["message"],
        "content": base64.b64encode(args["content"].encode("utf-8")).decode("ascii"),
        "branch": branch,
    }
    try:
        old = github(
            "GET",
            repo_path("/contents/" + urllib.parse.quote(path, safe="/") + "?ref=" + urllib.parse.quote(branch)),
        )
        if old.get("type") == "file":
            payload["sha"] = old["sha"]
    except MCPError as exc:
        if "HTTP 404" not in str(exc):
            raise
    result = github("PUT", repo_path("/contents/" + urllib.parse.quote(path, safe="/")), payload)
    return {
        "path": path,
        "commit": result.get("commit", {}).get("sha"),
        "html_url": result.get("content", {}).get("html_url"),
    }


def batch_commit(args):
    branch = safe_branch(args.get("branch"))
    files = args["files"]
    if not files or len(files) > 100:
        raise MCPError("Provide between 1 and 100 files.")
    seen = set()
    for item in files:
        item["path"] = safe_repo_path(item["path"])
        if item["path"] in seen:
            raise MCPError("Duplicate path in batch: " + item["path"])
        seen.add(item["path"])

    ref = get_ref(branch)
    parent_sha = ref["object"]["sha"]
    parent_commit = github("GET", repo_path("/git/commits/" + parent_sha))
    base_tree = parent_commit["tree"]["sha"]

    tree_items = []
    for item in files:
        blob = github(
            "POST",
            repo_path("/git/blobs"),
            {"content": item["content"], "encoding": "utf-8"},
        )
        tree_items.append({
            "path": item["path"],
            "mode": "100644",
            "type": "blob",
            "sha": blob["sha"],
        })

    tree = github("POST", repo_path("/git/trees"), {"base_tree": base_tree, "tree": tree_items})
    commit = github(
        "POST",
        repo_path("/git/commits"),
        {"message": args["message"], "tree": tree["sha"], "parents": [parent_sha]},
    )
    github(
        "PATCH",
        repo_path("/git/refs/heads/" + urllib.parse.quote(branch, safe="")),
        {"sha": commit["sha"], "force": False},
    )
    return {"branch": branch, "commit": commit["sha"], "files_committed": len(files)}


def create_branch(args):
    new_branch = safe_branch(args["branch"])
    source_branch = safe_branch(args.get("from_branch"))
    source = get_ref(source_branch)
    result = github(
        "POST",
        repo_path("/git/refs"),
        {"ref": "refs/heads/" + new_branch, "sha": source["object"]["sha"]},
    )
    return {"branch": new_branch, "sha": result["object"]["sha"]}


def create_pull_request(args):
    head = safe_branch(args["head"])
    base = safe_branch(args.get("base"))
    result = github(
        "POST",
        repo_path("/pulls"),
        {
            "title": args["title"],
            "head": head,
            "base": base,
            "body": args.get("body", ""),
        },
    )
    return {"number": result.get("number"), "url": result.get("html_url")}


def call_tool(name, args):
    if name == "repository_info":
        repo = github("GET", repo_path())
        return {
            "full_name": repo.get("full_name"),
            "private": repo.get("private"),
            "default_branch": repo.get("default_branch"),
            "html_url": repo.get("html_url"),
        }
    if name == "list_files":
        return list_files(args)
    if name == "read_file":
        return read_file(args)
    if name == "write_file":
        return write_file(args)
    if name == "batch_commit":
        return batch_commit(args)
    if name == "create_branch":
        return create_branch(args)
    if name == "create_pull_request":
        return create_pull_request(args)
    raise MCPError("Unknown tool: " + str(name))


def send(message):
    sys.stdout.write(json.dumps(message, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def handle(message):
    method = message.get("method")
    request_id = message.get("id")
    params = message.get("params") or {}

    if method == "notifications/initialized" or method == "notifications/cancelled":
        return
    if method == "initialize":
        send({
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "trading-v2-github-mcp", "version": "1.0.0"},
            },
        })
        return
    if method == "ping":
        send({"jsonrpc": "2.0", "id": request_id, "result": {}})
        return
    if method == "tools/list":
        send({"jsonrpc": "2.0", "id": request_id, "result": {"tools": tool_definitions()}})
        return
    if method == "tools/call":
        try:
            result = call_tool(params.get("name"), params.get("arguments") or {})
            text_result = json.dumps(result, ensure_ascii=False, indent=2)
            send({
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {"content": [{"type": "text", "text": text_result}], "isError": False},
            })
        except Exception as exc:
            send({
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {"content": [{"type": "text", "text": str(exc)}], "isError": True},
            })
        return
    if request_id is not None:
        send({
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {"code": -32601, "message": "Method not found: " + str(method)},
        })


def main():
    # MCP stdio transport: one JSON-RPC message per line; stdout is protocol-only.
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            message = json.loads(line)
            if isinstance(message, dict):
                handle(message)
        except Exception as exc:
            send({
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": "Parse error: " + str(exc)},
            })


if __name__ == "__main__":
    main()

"""Security regression tests for trading_v2_mcp.py.

Run with: py -m unittest -v test_trading_v2_mcp.py
These tests are offline and do not require a GitHub token.
"""

import importlib.util
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).with_name("trading_v2_mcp.py")
SPEC = importlib.util.spec_from_file_location("trading_v2_mcp", MODULE_PATH)
MCP = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MCP)


class BranchSafetyTests(unittest.TestCase):
    def test_work_branch_is_allowed_for_writes(self):
        self.assertEqual(MCP.safe_write_branch("work/jan-agent"), "work/jan-agent")

    def test_main_is_readable_but_not_writable(self):
        self.assertEqual(MCP.safe_branch("main"), "main")
        with self.assertRaises(MCP.MCPError):
            MCP.safe_write_branch("main")

    def test_write_branch_must_be_explicit(self):
        for value in (None, "", "main", "release/v1"):
            with self.subTest(value=value):
                with self.assertRaises(MCP.MCPError):
                    MCP.safe_write_branch(value)

    def test_malformed_branch_is_rejected(self):
        for value in ("work/../main", "work//agent", "work/agent/", "work/a b"):
            with self.subTest(value=value):
                with self.assertRaises(MCP.MCPError):
                    MCP.safe_branch(value)


class RepositoryPathSafetyTests(unittest.TestCase):
    def test_normal_project_file_is_allowed(self):
        self.assertEqual(MCP.safe_repo_path("docs/architecture.md"), "docs/architecture.md")

    def test_path_traversal_is_rejected(self):
        for value in ("../README.md", "docs/../../secret.txt", ".git/config"):
            with self.subTest(value=value):
                with self.assertRaises(MCP.MCPError):
                    MCP.safe_repo_path(value)

    def test_secret_and_workflow_paths_are_rejected(self):
        for value in (
            ".env",
            ".env.local",
            "config/private.pem",
            "certs/client.p12",
            "secrets/token.txt",
            ".ssh/config",
            ".github/workflows/deploy.yml",
        ):
            with self.subTest(value=value):
                with self.assertRaises(MCP.MCPError):
                    MCP.safe_repo_path(value)


if __name__ == "__main__":
    unittest.main()

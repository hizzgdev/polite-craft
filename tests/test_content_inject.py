#!/usr/bin/env python3
"""
Polite Craft — Content Script 注入测试（Headless Chromium + 模拟 GitHub 页面）

这个测试会：
1. 启动 headless Chrome 并加载扩展
2. 导航到一个模拟 GitHub PR 页面（本地 HTML）
3. 检查 content script 是否注入
4. 检查工具栏是否出现在 textarea 下方
"""

import subprocess
import json
import time
import sys
import os

EXTENSION_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dist")
FIXTURES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
CHROME_BIN = "/usr/bin/chromium-browser"
CHROME_PORT = 9223

def mock_github_page_url():
    """Return file:// URL for the synthetic GitHub fixture."""
    mock_page_path = os.path.join(FIXTURES_DIR, "mock-github-page.html")
    return f"file://{mock_page_path}"

def launch_chrome():
    """启动 headless Chromium 并加载扩展"""
    cmd = [
        CHROME_BIN,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        f"--remote-debugging-port={CHROME_PORT}",
        f"--load-extension={EXTENSION_DIR}",
        "--disable-extensions-except=" + EXTENSION_DIR,
    ]
    print(f"[1] 启动 Chromium (headless)...")

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    time.sleep(2)

    if proc.poll() is not None:
        stderr = proc.stderr.read().decode('utf-8', errors='replace')
        print(f"  ✗ Chrome 启动失败: {stderr[:300]}")
        sys.exit(1)

    print(f"  ✓ Chrome PID: {proc.pid}")
    return proc

def main():
    print("=" * 60)
    print("  Polite Craft — Content Script 注入测试")
    print("=" * 60)

    mock_url = mock_github_page_url()
    print(f"\n  模拟页面: {mock_url}")

    chrome_proc = None

    try:
        chrome_proc = launch_chrome()

        print(f"\n[2] 导航到模拟 GitHub 页面...")
        print(f"\n[3] 等待 content script 执行 (5 秒)...")
        time.sleep(5)

        print(f"\n[4] 检查 content script 是否加载...")
        print(f"  （在真实浏览器中打开开发者工具查看 console 输出）")
        print(f"  预期日志:")
        print(f"    [Polite Craft] Content script loaded on: ...")
        print(f"    [Polite Craft] scanAndInject found X candidate textarea")
        print(f"    [Polite Craft] Toolbar injected for: new_comment_field")

        print(f"\n[5] 手动验证步骤:")
        print(f"  1. 打开 Chrome: chrome://extensions/")
        print(f"  2. 确认 Polite Craft 已加载")
        print(f"  3. 打开: {mock_url}")
        print(f"  4. 按 F12 打开开发者工具")
        print(f"  5. 查看 Console 标签，应有 Polite Craft 日志")
        print(f"  6. 检查 textarea 下方是否出现工具栏")

    finally:
        if chrome_proc:
            print(f"\n[*] 关闭 Chromium...")
            chrome_proc.terminate()
            try:
                chrome_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                chrome_proc.kill()
            print(f"  ✓ Chrome 已关闭")

    print("\n" + "=" * 60)
    print("  测试完成")
    print("=" * 60)
    print("\n  下一步：请在真实浏览器中验证")
    print("  1. npm run build")
    print("  2. chrome://extensions/ → 加载已解压的扩展 → 选择 dist/ 目录")
    print("  3. 打开任意 GitHub PR/Issue 页面")
    print("  4. 按 F12 → Console 查看日志")
    print("  5. 检查评论框下方是否出现工具栏")

    return 0

if __name__ == "__main__":
    sys.exit(main())

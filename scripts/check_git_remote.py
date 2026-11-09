import os
import subprocess
from pathlib import Path

def find_remotes():
    home = Path(r"C:\Users\pande")
    search_dirs = [
        home / ".gemini" / "antigravity-ide" / "scratch",
        home / "Desktop",
        home / "Documents",
        home / "source" / "repos",
    ]
    for base in search_dirs:
        if not base.exists():
            continue
        try:
            for item in base.iterdir():
                if item.is_dir() and (item / ".git").exists():
                    out = subprocess.getoutput(f'git -C "{item}" remote -v')
                    if "github.com" in out:
                        print(f"Found in {item.name}: {out.splitlines()[0]}")
        except Exception:
            pass

if __name__ == "__main__":
    find_remotes()


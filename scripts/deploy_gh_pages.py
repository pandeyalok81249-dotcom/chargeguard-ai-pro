import os
import subprocess
import tempfile
import shutil
from pathlib import Path

def deploy_gh_pages():
    base_dir = Path(".").resolve()
    dist_dir = base_dir / "frontend" / "dist"
    
    if not dist_dir.exists():
        raise RuntimeError("frontend/dist does not exist. Run npm run build first.")
        
    temp_dir = Path(tempfile.mkdtemp())
    print(f"Staging GitHub Pages release in {temp_dir}...")
    
    try:
        # Initialize Git in temp directory
        subprocess.run(["git", "init"], cwd=temp_dir, check=True)
        subprocess.run(["git", "config", "user.name", "ALOK KUMAR PANDEY"], cwd=temp_dir, check=True)
        subprocess.run(["git", "config", "user.email", "pandeyalok81249-dotcom@users.noreply.github.com"], cwd=temp_dir, check=True)
        
        # Copy built assets
        for item in dist_dir.iterdir():
            dst = temp_dir / item.name
            if item.is_dir():
                shutil.copytree(item, dst, dirs_exist_ok=True)
            else:
                shutil.copy2(item, dst)
                
        # Ensure .nojekyll exists
        (temp_dir / ".nojekyll").write_text("", encoding="utf-8")
        
        # Ensure 404.html exists as fallback to index.html for SPA routing
        shutil.copy2(temp_dir / "index.html", temp_dir / "404.html")
        
        # Commit and push
        subprocess.run(["git", "checkout", "-b", "gh-pages"], cwd=temp_dir, check=True)
        subprocess.run(["git", "add", "-A"], cwd=temp_dir, check=True)
        subprocess.run(["git", "commit", "-m", "deploy: publish ChargeGuard AI Pro web application to GitHub Pages"], cwd=temp_dir, check=True)
        
        remote_url = "https://github.com/pandeyalok81249-dotcom/chargeguard-ai-pro.git"
        subprocess.run(["git", "remote", "add", "origin", remote_url], cwd=temp_dir, check=True)
        
        print(f"Pushing gh-pages branch to {remote_url}...")
        res = subprocess.run(["git", "push", "-f", "origin", "gh-pages"], cwd=temp_dir, capture_output=True, text=True)
        print("Push output:", res.stdout)
        if res.stderr:
            print("Push stderr:", res.stderr)
        if res.returncode != 0:
            raise RuntimeError(f"Push failed with code {res.returncode}")
        print("Successfully deployed gh-pages branch to GitHub!")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    deploy_gh_pages()

import os
import zipfile
from pathlib import Path

def create_full_master_zip():
    base_dir = Path(".").resolve()
    zip_path = base_dir / "chargeguard-ai-pro-full-master.zip"
    
    exclude_dirs = {
        "node_modules",
        ".venv",
        "__pycache__",
        ".pytest_cache",
        "dist",
        "staging_android",
        ".git"
    }
    
    exclude_extensions = {".pyc", ".pyo"}
    
    print(f"Creating full master ZIP archive at {zip_path}...")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, dirs, files in os.walk(base_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for file in files:
                if file.endswith(tuple(exclude_extensions)) or file in ("chargeguard-ai-pro-full-master.zip", "chargeguard-ai-pro.zip"):
                    continue
                file_path = Path(root) / file
                rel_path = file_path.relative_to(base_dir)
                zip_file.write(file_path, Path("chargeguard-ai-pro") / rel_path)
                
    # Copy to brain artifact directory as well
    artifact_dir = Path(r"C:\Users\pande\.gemini\antigravity\brain\914fef5c-af49-4f71-bf46-44c6062a2bef")
    if artifact_dir.exists():
        dest_artifact = artifact_dir / "chargeguard-ai-pro-full-master.zip"
        dest_artifact.write_bytes(zip_path.read_bytes())
        print(f"Copied full master archive to artifact directory: {dest_artifact}")
        
    size_mb = zip_path.stat().st_size / (1024 * 1024)
    print(f"Success! Generated {zip_path.name} ({size_mb:.2f} MB)")

if __name__ == "__main__":
    create_full_master_zip()

import os
import shutil
import zipfile
from pathlib import Path

def create_zip():
    root_dir = Path(__file__).resolve().parent.parent
    zip_target = root_dir / "chargeguard-ai-pro.zip"
    downloads_target = Path(r"C:\Users\pande\Downloads\chargeguard-ai-pro.zip")
    desktop_target = Path(r"C:\Users\pande\OneDrive\Desktop\chargeguard-ai-pro.zip")

    exclude_dirs = {
        ".git",
        "node_modules",
        "__pycache__",
        ".pytest_cache",
        "venv",
        ".venv",
        "dist",
        ".vite",
        ".idea",
        ".vscode",
    }
    exclude_exts = {".pyc", ".pyo"}

    # Remove old zip if present so we don't include it or have conflict
    temp_zip = root_dir / "temp_archive.zip"
    if temp_zip.exists():
        temp_zip.unlink()

    print(f"Creating archive from {root_dir}...")
    file_count = 0
    with zipfile.ZipFile(temp_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(root_dir):
            # Prune excluded directories in-place so os.walk doesn't descend into them
            dirs[:] = [d for d in dirs if d not in exclude_dirs]

            for file in sorted(files):
                if file == "chargeguard-ai-pro.zip" or file == "temp_archive.zip":
                    continue
                file_path = Path(root) / file
                if file_path.suffix.lower() in exclude_exts:
                    continue

                rel_path = file_path.relative_to(root_dir)
                archive_name = Path("chargeguard-ai-pro") / rel_path
                zf.write(file_path, str(archive_name))
                file_count += 1

    # Replace workspace zip
    if zip_target.exists():
        zip_target.unlink()
    shutil.move(temp_zip, zip_target)
    print(f"Archive created with {file_count} files ({zip_target.stat().st_size:,} bytes).")

    # Copy to Downloads
    try:
        shutil.copy2(zip_target, downloads_target)
        print(f"Copied to Downloads: {downloads_target}")
    except Exception as e:
        print(f"Could not copy to Downloads: {e}")

    # Copy to Desktop
    try:
        if desktop_target.parent.exists():
            shutil.copy2(zip_target, desktop_target)
            print(f"Copied to Desktop: {desktop_target}")
    except Exception as e:
        print(f"Could not copy to Desktop: {e}")

if __name__ == "__main__":
    create_zip()

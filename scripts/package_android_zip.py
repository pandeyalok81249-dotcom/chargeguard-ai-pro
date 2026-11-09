import os
import shutil
import zipfile
from pathlib import Path

def create_android_studio_zip():
    base_dir = Path(".").resolve()
    android_src = base_dir / "frontend" / "android"
    staging_dir = base_dir / "staging_android"
    target_folder = staging_dir / "chargeguard-ai-pro-android"
    
    if staging_dir.exists():
        shutil.rmtree(staging_dir)
        
    target_folder.mkdir(parents=True, exist_ok=True)
    
    print(f"Copying files from {android_src} to {target_folder}...")
    for item in android_src.iterdir():
        dest = target_folder / item.name
        if item.is_dir():
            shutil.copytree(item, dest, dirs_exist_ok=True)
        else:
            shutil.copy2(item, dest)
            
    zip_path = base_dir / "chargeguard-ai-pro-android-studio.zip"
    if zip_path.exists():
        zip_path.unlink()
        
    print(f"Creating ZIP archive at {zip_path}...")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, dirs, files in os.walk(staging_dir):
            for file in files:
                file_path = Path(root) / file
                arcname = file_path.relative_to(staging_dir)
                zip_file.write(file_path, arcname)
                
    # Copy to brain artifact directory as well
    artifact_dir = Path(r"C:\Users\pande\.gemini\antigravity\brain\914fef5c-af49-4f71-bf46-44c6062a2bef")
    if artifact_dir.exists():
        dest_artifact = artifact_dir / "chargeguard-ai-pro-android-studio.zip"
        shutil.copy2(zip_path, dest_artifact)
        print(f"Copied archive to artifact directory: {dest_artifact}")
        
    # Clean up staging
    shutil.rmtree(staging_dir)
    size_mb = zip_path.stat().st_size / (1024 * 1024)
    print(f"Success! Generated {zip_path.name} ({size_mb:.2f} MB)")

if __name__ == "__main__":
    create_android_studio_zip()

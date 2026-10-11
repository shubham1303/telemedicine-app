"""Zip every lambdas/<name>/handler.py into lambdas/<name>/function.zip.

The zips are built the same way on any machine (fixed timestamp, fixed file
permissions, LF line endings), so the same handler.py always gives the same
zip and Terraform only redeploys a function when its code actually changed.

    python scripts/build_lambdas.py
"""
from pathlib import Path
import zipfile

LAMBDAS = Path(__file__).resolve().parents[1] / "lambdas"


def build(folder):
    source = (folder / "handler.py").read_bytes().replace(b"\r\n", b"\n")
    info = zipfile.ZipInfo("handler.py", date_time=(2020, 1, 1, 0, 0, 0))
    info.external_attr = 0o100644 << 16  # -rw-r--r--
    info.compress_type = zipfile.ZIP_DEFLATED
    info.create_system = 3  # unix, so the permissions above are used as-is
    with zipfile.ZipFile(folder / "function.zip", "w") as z:
        z.writestr(info, source)


if __name__ == "__main__":
    folders = sorted(p.parent for p in LAMBDAS.glob("*/handler.py"))
    for folder in folders:
        build(folder)
        print(f"built {folder.name}/function.zip")

import os
import re
import sys
from pathlib import Path

# Directory to scan (default to 'src', but allow override via CLI)
search_root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd() / "src"

if not search_root.exists():
    print(f"Search root '{search_root}' does not exist.")
    sys.exit(1)

# Regex patterns to identify red color usages
patterns = [
    re.compile(r"bg-red-\d+"),
    re.compile(r"text-red-\d+"),
    re.compile(r"border-red-\d+"),
    re.compile(r"ring-red-\d+"),
    re.compile(r"#[Ff]{2}[0]{4}"),  # #FF0000 (case-insensitive)
    re.compile(r"#([Ff0]{3})"),      # #F00 or similar
]

# File extensions to consider
include_exts = {".tsx", ".ts", ".jsx", ".js", ".css", ".scss", ".html"}

results = []

for root, _dirs, files in os.walk(search_root):
    # Skip node_modules and build directories if any
    if "node_modules" in root.split(os.sep):
        continue

    for fname in files:
        ext = Path(fname).suffix
        if ext not in include_exts:
            continue
        fpath = Path(root) / fname
        try:
            with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                for lineno, line in enumerate(f, start=1):
                    for pat in patterns:
                        if pat.search(line):
                            try:
                                rel_path = fpath.relative_to(Path.cwd())
                            except ValueError:
                                rel_path = fpath
                            results.append((rel_path, lineno, line.rstrip()))
                            break  # Avoid duplicate captures for same line
        except Exception as e:
            print(f"Error reading {fpath}: {e}", file=sys.stderr)

# Output results
for path, lineno, line in results:
    print(f"{path}:{lineno}: {line}")

print(f"\nTotal matches found: {len(results)}") 
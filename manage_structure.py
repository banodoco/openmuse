import os
import re
import argparse
from pathlib import Path

# --- Configuration ---
WORKSPACE_ROOT = Path(__file__).parent.resolve()
STRUCTURE_MD_FILE = WORKSPACE_ROOT / "structure.md"
IGNORE_DIRS = {'.git', 'node_modules', '.vscode', '.idea', '__pycache__'}
IGNORE_FILES = {
    'manage_structure.py', # This script
    'structure.md', 'bun.lockb',
    'package-lock.json', '.DS_Store'
}
IGNORE_EXTENSIONS = {'.png', '.sql', '.svg', '.ico', '.lockb'}
IGNORE_PATTERNS = {r'.*\.pyc$', r'.*\.log$'}
DEFAULT_LINES_TO_PEEK = 10

# --- Functions ---

def scan_project_files_for_verify(root_dir):
    """Scans project files for verification against structure.md."""
    actual_paths = set()
    root_path = Path(root_dir)
    for dirpath, dirnames, filenames in os.walk(root_path, topdown=True):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
        current_dir_path = Path(dirpath)
        relative_dir = current_dir_path.relative_to(root_path)
        if str(relative_dir) != '.':
            actual_paths.add(relative_dir.as_posix() + '/')
        for filename in filenames:
            file_path = current_dir_path / filename
            if filename in IGNORE_FILES: continue
            file_ext = file_path.suffix.lower()
            # Verification mode *does* ignore extensions listed, matching verify_structure logic
            if file_ext in IGNORE_EXTENSIONS: continue
            relative_file_path = (relative_dir / filename).as_posix()
            if any(re.match(pattern, relative_file_path) for pattern in IGNORE_PATTERNS): continue
            if str(relative_dir) == '.': actual_paths.add(filename)
            else: actual_paths.add(relative_file_path)
    return actual_paths

def extract_documented_paths(md_file):
    """Extracts file/directory paths from the structure.md code block for verification."""
    documented_paths_full = set()
    try:
        with open(md_file, 'r', encoding='utf-8') as f: content = f.read()
    except FileNotFoundError:
        print(f"Error: {md_file} not found.")
        return None
    code_block_match = re.search(r"```(?:\w*\n)?(.*?)```", content, re.DOTALL | re.IGNORECASE)
    if not code_block_match:
        print("Error: Could not find the code block in structure.md.")
        return None
    code_block_content = code_block_match.group(1).strip()
    lines = code_block_content.splitlines()
    path_stack = []
    for line in lines:
        line_strip = line.strip()
        if not line_strip or line_strip == '.': continue
        match = re.match(r"^([│├└\s─]*)(.*?)(?:\s*#.*)?$", line)
        if not match: continue
        prefix, node_part = match.groups()
        node_part = node_part.strip()
        if not node_part: continue
        potential_node_name = node_part.rstrip('/')
        # Ignore checks (Parsing for verify mode)
        if '*' in node_part: continue # Skip wildcard lines
        if (potential_node_name in IGNORE_DIRS or potential_node_name in IGNORE_FILES) and not path_stack: continue
        if node_part.endswith('/') and potential_node_name in IGNORE_DIRS: continue
        indent = len(prefix)
        while path_stack and indent <= path_stack[-1][1]: path_stack.pop()
        parent_path = path_stack[-1][0] if path_stack else ""
        if parent_path and not node_part.startswith('/'): current_path = f"{parent_path}/{node_part}"
        else:
            if node_part.rstrip('/') in IGNORE_DIRS or node_part.rstrip('/') in IGNORE_FILES: continue
            current_path = node_part
        is_dir = node_part.endswith('/')
        clean_path = current_path.rstrip('/')
        path_obj = Path(clean_path)
        if path_obj.name in IGNORE_DIRS: continue
        # Verification mode also ignores extensions specified in structure.md
        if not is_dir and path_obj.suffix.lower() in IGNORE_EXTENSIONS: continue
        if path_obj.name in IGNORE_FILES: continue
        final_path = clean_path + '/' if is_dir else clean_path
        if not any(part in IGNORE_DIRS for part in Path(final_path).parts):
            documented_paths_full.add(final_path)
        if is_dir and path_obj.name not in IGNORE_DIRS:
             path_stack.append((clean_path, indent))
    # Final filtering
    final_documented_paths = {
        p for p in documented_paths_full
        if Path(p).name not in IGNORE_FILES
        and (not p.endswith('/') or Path(p).name not in IGNORE_DIRS)
        and not any(part in IGNORE_DIRS for part in Path(p).parts)
        # Ensure files with ignored extensions are also filtered from documented set
        and (p.endswith('/') or Path(p).suffix.lower() not in IGNORE_EXTENSIONS)
    }
    return final_documented_paths

def peek_into_file(file_path, num_lines):
    """Reads and prints the first num_lines of a given file."""
    print(f"\n--- Peeking into: {file_path.relative_to(WORKSPACE_ROOT)} ({num_lines} lines) ---")
    try:
        # Use errors='ignore' for robustness against potential encoding issues in diverse files
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines_read = 0
            last_line = ''
            for i, line in enumerate(f):
                if i >= num_lines: break
                print(line, end='')
                lines_read += 1
                last_line = line
            if lines_read < num_lines and lines_read > 0: print("[EOF]")
            if lines_read > 0 and not last_line.endswith('\n'): print() # Ensure newline
    except Exception as e: print(f"  [Error reading file: {e}]")
    print("-" * (len(str(file_path.relative_to(WORKSPACE_ROOT))) + 25))

def scan_and_peek(root_dir, num_lines):
    """Scans the project and peeks into non-ignored files."""
    root_path = Path(root_dir)
    file_count = 0
    for dirpath, dirnames, filenames in os.walk(root_path, topdown=True):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
        current_dir_path = Path(dirpath)
        for filename in filenames:
            file_path = current_dir_path / filename
            relative_file_path = file_path.relative_to(root_path).as_posix()
            # Apply Ignore Rules (same as peek_files.py)
            if filename in IGNORE_FILES: continue
            file_ext = file_path.suffix.lower()
            if file_ext in IGNORE_EXTENSIONS: continue
            if any(re.match(pattern, relative_file_path) for pattern in IGNORE_PATTERNS): continue
            peek_into_file(file_path, num_lines)
            file_count += 1
    print(f"\nProcessed {file_count} files.")

# --- Main Execution ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Verify project structure against structure.md or peek into files.",
        formatter_class=argparse.RawTextHelpFormatter # Keep help text formatted
    )
    parser.add_argument(
        '--mode',
        choices=['verify', 'peek'],
        default='verify',
        help="Operation mode:\n"
             "  verify: Compare project structure with structure.md (default).\n"
             "  peek:   Print the first N lines of non-ignored project files."
    )
    parser.add_argument(
        "-n", "--lines",
        type=int,
        default=DEFAULT_LINES_TO_PEEK,
        help=f"Number of lines for peek mode (default: {DEFAULT_LINES_TO_PEEK})."
    )
    args = parser.parse_args()

    print(f"Scanning project files in: {WORKSPACE_ROOT}")
    print(f"Ignoring Dirs: {IGNORE_DIRS}")
    print(f"Ignoring Files: {IGNORE_FILES}")
    print(f"Ignoring Extensions: {IGNORE_EXTENSIONS}")
    print("-" * 30)

    if args.mode == 'verify':
        actual_files = scan_project_files_for_verify(WORKSPACE_ROOT)
        print(f"Found {len(actual_files)} files/folders for verification (after filtering)." )
        print(f"\nParsing documentation file: {STRUCTURE_MD_FILE}")
        documented_files = extract_documented_paths(STRUCTURE_MD_FILE)
        if documented_files is not None:
            print(f"Found {len(documented_files)} files/folders documented (after filtering ignores/wildcards/extensions)." )
            print("-" * 30)
            missing_in_docs = actual_files - documented_files
            missing_in_project = documented_files - actual_files
            if not missing_in_docs and not missing_in_project:
                print("✅ Success! Project structure matches structure.md (ignoring specified extensions/files/dirs).")
            else:
                if missing_in_docs:
                    print("\n🚨 Files/Folders found in project but MISSING in structure.md:")
                    for item in sorted(list(missing_in_docs)): print(f"  - {item}")
                if missing_in_project:
                    print("\n🚨 Files/Folders documented in structure.md but NOT FOUND in project:")
                    for item in sorted(list(missing_in_project)): print(f"  - {item}")
        else:
            print("\nCould not perform verification due to errors reading or parsing the markdown file.")

    elif args.mode == 'peek':
        if args.lines <= 0:
            print("Error: Number of lines (--lines) must be positive for peek mode.")
        else:
            print(f"Peeking into first {args.lines} lines of files...")
            scan_and_peek(WORKSPACE_ROOT, args.lines) 
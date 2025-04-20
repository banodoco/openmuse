import os
import sys

# --- Configuration ---

# Define source file extensions to include
# Add or remove extensions as needed for your project
SOURCE_EXTENSIONS = {
    '.py',      # Python
    '.ts',      # TypeScript
    '.tsx',     # TypeScript React
    '.js',      # JavaScript
    '.jsx',     # JavaScript React
    '.html',    # HTML
    '.css',     # CSS
    '.scss',    # SCSS
    '.less',    # Less
    '.md',      # Markdown
    '.sql',     # SQL
    '.sh',      # Shell script
    '.yml',     # YAML
    '.yaml',    # YAML
    # Add more relevant extensions here
}

# Define directories to always exclude
# Uses set for efficient lookups
EXCLUDE_DIRS = {
    '.git',
    'node_modules',
    'public',       # Usually contains static assets, not source code
    'dist',         # Common build output directory
    'build',        # Common build output directory
    '__pycache__',
    '.venv',        # Common Python virtual environment directory
    'venv',         # Common Python virtual environment directory
    '.vscode',      # Editor configuration
    '.idea',        # Editor configuration
    '.next',        # Next.js build output
    '.nuxt',        # Nuxt.js build output
    'coverage',     # Code coverage reports
    'cache',        # General cache folders
    '.cache',       # General cache folders
}

# Define specific files or filename patterns to exclude
# Uses set for efficient lookups
EXCLUDE_FILES = {
    'bun.lockb',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '.gitignore',
    '.env',         # Environment variables
    # Add specific large or generated files if needed
}

# Define prefixes for single-line comments (used for simple heuristic)
# This helps avoid counting comment lines as code
SINGLE_LINE_COMMENT_MARKERS = {'#', '//'}

# Optional: Exclude shadcn/ui components directory (often mostly generated)
# Set to False if you want to count lines in src/components/ui
EXCLUDE_SHADCN_UI_DIR = True
SHADCN_UI_PATH = os.path.join('src', 'components', 'ui') # Relative path

# --- Script Logic ---

total_loc = 0
counted_files = 0
error_files = []

# Start from the current working directory (assumed to be the repo root)
repo_root = '.'

print("Starting line count...")
print(f"Including extensions: {', '.join(sorted(list(SOURCE_EXTENSIONS)))}")
print(f"Excluding directories: {', '.join(sorted(list(EXCLUDE_DIRS)))}")
if EXCLUDE_SHADCN_UI_DIR:
    print(f"Excluding shadcn/ui directory: {SHADCN_UI_PATH}")
print(f"Excluding files: {', '.join(sorted(list(EXCLUDE_FILES)))}")
print("-" * 30)

for root, dirs, files in os.walk(repo_root, topdown=True):
    # Modify dirs in-place to prune traversal into excluded directories
    # Important: Use os.path.normpath to handle different path separators (e.g., on Windows)
    current_rel_path = os.path.normpath(os.path.relpath(root, repo_root))

    # Standard directory exclusion
    dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

    # Optional shadcn/ui exclusion
    if EXCLUDE_SHADCN_UI_DIR and current_rel_path.startswith(os.path.normpath(SHADCN_UI_PATH)):
        # If we are inside the shadcn UI path, clear dirs to stop descending
        # and continue to the next iteration to avoid processing files in this root.
        # print(f"Skipping directory (shadcn/ui): {current_rel_path}") # Uncomment for debugging
        dirs[:] = [] # Stop traversing deeper into this excluded path
        continue     # Skip processing files in this directory

    for filename in files:
        # Check if the specific file should be excluded
        if filename in EXCLUDE_FILES:
            continue

        # Check file extension
        _, ext = os.path.splitext(filename)
        if ext.lower() not in SOURCE_EXTENSIONS:
            continue

        file_path = os.path.join(root, filename)
        relative_file_path = os.path.relpath(file_path, repo_root)

        # Count lines in the file
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                file_loc = 0
                for line in f:
                    stripped_line = line.strip()
                    # Skip empty lines
                    if not stripped_line:
                        continue
                    # Simple check: skip lines starting with common comment markers
                    is_comment_line = False
                    for marker in SINGLE_LINE_COMMENT_MARKERS:
                        if stripped_line.startswith(marker):
                            is_comment_line = True
                            break
                    if not is_comment_line:
                        file_loc += 1

                # Uncomment the line below to see counts per file (can be verbose)
                # print(f"{relative_file_path}: {file_loc}")

                total_loc += file_loc
                counted_files += 1
        except Exception as e:
            error_files.append((relative_file_path, str(e)))
            # Optional: print errors as they occur
            # print(f"Error reading file {relative_file_path}: {e}", file=sys.stderr)

print("-" * 30)
print(f"Scan complete.")
print(f"Total estimated lines of code (LoC): {total_loc}")
print(f"Counted across {counted_files} files.")

if error_files:
    print(f"Encountered errors processing {len(error_files)} file(s):")
    # for path, err in error_files:
    #     print(f"  - {path}: {err}") # Uncomment to list files with errors

print("Note: LoC is estimated by counting non-empty lines that do not start")
print("with common single-line comment markers (#, //). Multi-line comments")
print("are not specifically handled by this simple heuristic.") 
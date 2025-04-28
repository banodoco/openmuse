#!/usr/bin/env python3
import re
import sys


def read_file(filename):
    try:
        with open(filename, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        sys.exit(f"Error reading file {filename}: {e}")


def main():
    # Read potential.md and pushes.md
    potential_content = read_file("potential.md")
    pushes_content = read_file("pushes.md")

    # Keywords to identify target commits
    keywords = ["Medium probability", "High probability", "Very High probability"]
    commit_hashes = set()
    for line in potential_content.splitlines():
        if any(keyword in line for keyword in keywords):
            m = re.search(r"`([a-f0-9]{7})`", line)
            if m:
                commit_hashes.add(m.group(1))

    if not commit_hashes:
        print("No medium or high potential commits found in potential.md")
        return

    # Split pushes.md into sections based on delimiter. Assuming sections are separated by lines with "---"
    sections = pushes_content.split("\n---\n")
    extracted_sections = []

    for section in sections:
        # Check if the section contains one of the commit hashes in the format `hash`
        for commit in commit_hashes:
            if f"`{commit}`" in section:
                extracted_sections.append(section.strip())
                break

    if extracted_sections:
        print("\n---\n".join(extracted_sections))
    else:
        print("No matching commit details found in pushes.md")


if __name__ == "__main__":
    main() 
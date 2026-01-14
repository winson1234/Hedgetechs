import base64
import os

image_path = "/Users/nanamizi/Hedgetechs/frontend/public/new-02.png"
ftl_path = "/Users/nanamizi/Hedgetechs/deployment/keycloak-config/themes/hedgetechs/email/html/executeActions.ftl"

print(f"Reading image from {image_path}...")
with open(image_path, "rb") as img_file:
    b64_string = base64.b64encode(img_file.read()).decode('utf-8')
print(f"Image read and encoded. Length: {len(b64_string)}")

print(f"Reading template from {ftl_path}...")
with open(ftl_path, "r") as ftl_file:
    content = ftl_file.read()

# Target start of the src attribute
start_marker = '<img src="data:image/png;base64,'
start_idx = content.find(start_marker)

if start_idx == -1:
    print("Error: Could not find image tag start marker in template.")
    exit(1)

# Find the end of the src attribute (closing quote)
# Content of src starts after the marker
src_content_start = start_idx + len(start_marker)
# Find the next double quote starting from there
src_content_end = content.find('"', src_content_start)

if src_content_end == -1:
    print("Error: Could not find closing quote for image src attribute.")
    exit(1)

print(f"Found existing base64 image at index {start_idx}. Replacing...")

# Construct new content
new_content = content[:start_idx] + start_marker + b64_string + content[src_content_end:]

print("Writing updated contentback to template...")
with open(ftl_path, "w") as ftl_file:
    ftl_file.write(new_content)

print("Successfully updated logo in executeActions.ftl")

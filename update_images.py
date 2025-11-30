import os
import re

# --- Configuration ---
IMAGES_DIR = 'images'
SCRIPT_FILE = 'script.js'
ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
# ---

def generate_image_list():
    """Scans the images directory and returns a list of file paths."""
    image_files = []
    if not os.path.exists(IMAGES_DIR):
        print(f"Error: Directory '{IMAGES_DIR}' not found.")
        return None

    for filename in sorted(os.listdir(IMAGES_DIR)):
        if any(filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS):
            # Use forward slashes for web paths
            image_files.append(f"{IMAGES_DIR}/{filename}")
    
    return image_files

def update_script_file(image_list):
    """Updates the JavaScript file with the new list of images."""
    if image_list is None:
        return

    try:
        with open(SCRIPT_FILE, 'r', encoding='utf-8') as f:
            script_content = f.read()
    except FileNotFoundError:
        print(f"Error: Script file '{SCRIPT_FILE}' not found.")
        return

    # Format the list into a JavaScript array string with nice indentation
    if image_list:
        js_array_items = ",\n        ".join([f"'{path}'" for path in image_list])
        js_array_string = f"[\n        {js_array_items}\n    ]"
    else:
        js_array_string = "[]"
    
    replacement_block = f"const imageUrls = {js_array_string};"

    # This regex is designed to handle the multi-line array definition
    pattern = re.compile(r"const imageUrls = \[.*?\];", re.DOTALL)
    
    if not pattern.search(script_content):
        print("Error: Could not find the 'imageUrls' array in the script.")
        print("Please ensure it is defined like: const imageUrls = [];")
        return

    new_script_content = pattern.sub(replacement_block, script_content, 1)

    try:
        with open(SCRIPT_FILE, 'w', encoding='utf-8') as f:
            f.write(new_script_content)
        print(f"Successfully updated '{SCRIPT_FILE}' with {len(image_list)} images.")
    except IOError as e:
        print(f"Error writing to script file: {e}")


if __name__ == "__main__":
    images = generate_image_list()
    update_script_file(images)

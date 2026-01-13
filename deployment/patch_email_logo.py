
import re
import os

base64_path = '/Users/nanamizi/Hedgetechs/deployment/logo_base64.txt'
template_path = '/Users/nanamizi/Hedgetechs/deployment/keycloak-config/themes/hedgetechs/email/html/executeActions.ftl'

with open(base64_path, 'r') as f:
    base64_str = f.read().strip()

with open(template_path, 'r') as f:
    content = f.read()

# Regex to match the existing img tag.
img_pattern = r'<img src="data:image/png;base64,[^"]+"[^>]*>'

# New tag with slightly bigger dimensions (45px height) and centering
# Original: 5474x1409 (~3.88 aspect ratio)
# Target Height: 45px => Width: ~175px
# Added margin: 0 auto to center the block element
new_img_tag = f'<img src="data:image/png;base64,{base64_str}" alt="Hedgetechs" width="175" height="45" style="display: block; height: 45px; width: 175px; max-width: 100%; border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; margin: 0 auto;">'

content = re.sub(img_pattern, new_img_tag, content)

# Change header background to light (white)
# Target: <div style="background-color: #0f172a; padding: 24px; text-align: center;">
# We replace the specific color #0f172a with #ffffff
content = content.replace('background-color: #0f172a;', 'background-color: #ffffff;')

with open(template_path, 'w') as f:
    f.write(content)

print("Successfully updated email template with resized logo (width=175, height=45) and light header.")

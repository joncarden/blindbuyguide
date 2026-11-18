#!/usr/bin/env python3
"""
Apply minimal design polish fixes to HTML files:
- Remove eyebrow/kicker <p> elements
- Edit specific CSS rules inside existing <style> blocks (never wholesale replacement)
"""

import re
from pathlib import Path
import sys


def remove_eyebrows(html: str) -> str:
    """Remove eyebrow <p> elements before headings."""
    patterns = [
        r'<p class="eyebrow"[^>]*>Luxury fragrance, sampled first</p>\s*',
        r'<p class="eyebrow"[^>]*>The guides</p>\s*',
        r'<p class="eyebrow"[^>]*>The data</p>\s*',
        r'<p class="eyebrow"[^>]*>The free Price Book</p>\s*',
    ]
    for pattern in patterns:
        html = re.sub(pattern, '', html)
    return html


def apply_css_fixes(css: str) -> str:
    """Make targeted edits to specific CSS rules. Never delete rules wholesale."""
    
    # Remove 3px border-left from .verdict (side-tab border)
    css = re.sub(
        r'\.verdict\{([^}]*?)border-left:3px solid var\(--accent\);?([^}]*?)\}',
        r'.verdict{\1\2}',
        css
    )
    
    # Add focus-visible outlines if not present
    if ':focus-visible' not in css:
        css += '\n*:focus-visible{outline:2px solid var(--accent);outline-offset:2px}'
    
    # Fix placeholder contrast to meet WCAG 4.5:1
    if '::placeholder' in css:
        css = re.sub(
            r'::placeholder\{[^}]*\}',
            '::placeholder{color:color-mix(in srgb,var(--ink) 60%,transparent);opacity:1}',
            css
        )
    else:
        css += '\n::placeholder{color:color-mix(in srgb,var(--ink) 60%,transparent);opacity:1}'
    
    # Fix figcaption: increase from 11px to 13px, remove letter-spacing
    css = re.sub(
        r'figcaption\{font:(\d+)px',
        r'figcaption{font:13px',
        css
    )
    css = re.sub(
        r'(figcaption\{[^}]*?)letter-spacing:[^;}]+;?',
        r'\1',
        css
    )
    
    # Fix header links: 44px min touch target, reduce tracking
    css = re.sub(
        r'(header a\{[^}]*?)padding:\s*\d+px\s+\d+px',
        r'\1padding:15px 16px',
        css
    )
    css = re.sub(
        r'(header a\{[^}]*?)letter-spacing:\s*[^;}]+',
        r'\1letter-spacing:.05em',
        css
    )
    
    # Fix button touch targets
    css = re.sub(
        r'(\.btn,button\{[^}]*?)padding:\s*\d+px\s+\d+px',
        r'\1padding:13px 20px',
        css
    )
    
    # Fix line-heights: increase to 1.35+ for text elements
    # Product card headings
    css = re.sub(
        r'(\.pcard strong\{[^}]*?)line-height:\s*[\d.]+',
        r'\1line-height:1.35',
        css
    )
    
    # Mood tiles
    css = re.sub(
        r'(\.moods a\{[^}]*?)line-height:\s*[\d.]+',
        r'\1line-height:1.35',
        css
    )
    
    # Watch headings
    css = re.sub(
        r'(\.watch-h\{[^}]*?)line-height:\s*[\d.]+',
        r'\1line-height:1.35',
        css
    )
    
    # Remove wide letter-spacing from body/caption text
    # Keep for uppercase labels (>.1em is okay for labels)
    css = re.sub(
        r'(\.lcap\{[^}]*?)letter-spacing:[^;}]+;?',
        r'\1',
        css
    )
    
    # Guide elements line-heights
    css = re.sub(
        r'(\.gx-start strong\{[^}]*?)line-height:\s*[\d.]+',
        r'\1line-height:1.35',
        css
    )
    css = re.sub(
        r'(\.gx-know strong\{[^}]*?)line-height:\s*[\d.]+',
        r'\1line-height:1.35',
        css
    )
    css = re.sub(
        r'(\.gt span\{[^}]*?)line-height:\s*[\d.]+',
        r'\1line-height:1.35',
        css
    )
    css = re.sub(
        r'(\.gcn\{[^}]*?)line-height:\s*[\d.]+',
        r'\1line-height:1.35',
        css
    )
    
    # Mobile: ensure UI text is 13-14px minimum
    # Find mobile section and fix sizes
    mobile_section_match = re.search(r'@media\(max-width:760px\)\{[^}]*\}', css, re.DOTALL)
    if mobile_section_match:
        mobile_css = mobile_section_match.group(0)
        
        # Fix figcaption mobile size
        mobile_css = re.sub(r'figcaption\{font-size:\s*\d+px', 'figcaption{font-size:14px', mobile_css)
        
        # Fix header links mobile size
        mobile_css = re.sub(r'header a\{font-size:\s*\d+px', 'header a{font-size:14px', mobile_css)
        
        # Fix button mobile size
        mobile_css = re.sub(r'(\.btn,button\{[^}]*?)font-size:\s*\d+px', r'\1font-size:14px', mobile_css)
        
        css = css.replace(mobile_section_match.group(0), mobile_css)
    
    # Add card insets for cramped padding (only if cards exist)
    if '.pcard' in css:
        # Ensure cards have proper internal padding
        css = re.sub(
            r'(\.pcard \.t\{[^}]*?)padding:\s*\d+px(?:\s+\d+px)?',
            r'\1padding:16px',
            css
        )
    
    return css


def process_html_file(filepath: Path) -> bool:
    """Process one HTML file. Returns True if modified."""
    try:
        content = filepath.read_text(encoding='utf-8')
        original = content
        
        # Remove eyebrows
        content = remove_eyebrows(content)
        
        # Apply CSS fixes within existing <style> block
        style_match = re.search(r'<style>(.*?)</style>', content, re.DOTALL)
        if style_match:
            original_css = style_match.group(1)
            fixed_css = apply_css_fixes(original_css)
            content = content.replace(
                f'<style>{original_css}</style>',
                f'<style>{fixed_css}</style>'
            )
        
        if content != original:
            filepath.write_text(content, encoding='utf-8')
            return True
        return False
        
    except Exception as e:
        print(f"Error processing {filepath}: {e}", file=sys.stderr)
        return False


def main():
    repo_root = Path(__file__).parent.parent.parent
    
    modified_count = 0
    error_count = 0
    
    for html_file in repo_root.rglob('*.html'):
        if 'node_modules' in str(html_file):
            continue
        
        try:
            if process_html_file(html_file):
                modified_count += 1
        except Exception as e:
            print(f"Error: {html_file}: {e}", file=sys.stderr)
            error_count += 1
    
    print(f"Modified {modified_count} HTML files")
    if error_count:
        print(f"Errors: {error_count}", file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

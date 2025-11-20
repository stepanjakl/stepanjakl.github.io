#!/bin/zsh

# Minify Test Script
# Installs/updates dependencies, creates a temp folder, minifies files, and starts a local server for testing.

set -e  # Exit on error

# Save original directory
ORIGINAL_PWD=$(pwd)

# Function to cleanup
cleanup() {
  echo "Cleaning up ./tmp..."
  if [[ -d "$ORIGINAL_PWD/tmp" ]]; then
    rm -rf "$ORIGINAL_PWD/tmp"
    echo "Cleanup complete."
  else
    echo "Tmp folder not found, nothing to clean."
  fi
  exit 0
}

# Cleanup on interrupt
trap cleanup INT

# Function to calculate and display savings
calculate_savings() {
  local size_before=$1
  local size_after=$2
  local savings=$((size_before - size_after))
  local size_before_kb=$(echo "scale=3; $size_before / 1024" | bc)
  local size_after_kb=$(echo "scale=3; $size_after / 1024" | bc)
  local percentage=$(echo "scale=1; ($savings * 100) / $size_before" | bc 2>/dev/null || echo "0")
  if (( savings > 0 )); then local color="\033[32m"; else local color="\033[31m"; fi
  echo "${size_before_kb} KiB - ${color}${percentage}%\033[0m = ${size_after_kb} KiB"
}

echo "Installing/updating dependencies with npm..."
npm install -g terser csso-cli html-minifier svgo

echo "Creating temporary test folder..."
mkdir -p ./tmp
TEST_DIR="./tmp/minify-test-$(date +%s)"
while [[ -d "$TEST_DIR" ]]; do
  TEST_DIR="./tmp/minify-test-$(date +%s)-$RANDOM"
done
mkdir -p "$TEST_DIR"

echo "Copying project files to $TEST_DIR..."
rsync -a --exclude="tmp" --exclude=".git" --exclude=".github" . "$TEST_DIR"

echo "Minifying files..."
cd "$TEST_DIR"

# Initialise totals
total_html_before=0
total_html_after=0
total_css_before=0
total_css_after=0
total_js_before=0
total_js_after=0
total_img_before=0
total_img_after=0


# Minify HTML
echo "Minifying index.html"
size_before=$(stat -f%z index.html)
total_html_before=$size_before
html-minifier --case-sensitive --collapse-inline-tag-whitespace --collapse-whitespace --minify-css --minify-js --minify-urls --quote-character='"' --remove-comments index.html --output index.html
size_after=$(stat -f%z index.html)
total_html_after=$size_after
calculate_savings $size_before $size_after
echo ""

# Minify CSS files (overwrite)
for css_file in styles/*.css; do
  size_before=$(stat -f%z "$css_file")
  total_css_before=$((total_css_before + size_before))
  start_time=$(python3 -c 'import time; print(int(time.time() * 1000))')
  echo "Minifying $css_file"
  csso --force-media-merge "$css_file" --output "$css_file"
  end_time=$(python3 -c 'import time; print(int(time.time() * 1000))')
  ms=$((end_time - start_time))
  size_after=$(stat -f%z "$css_file")
  total_css_after=$((total_css_after + size_after))
  echo "Done in ${ms} ms!"
  calculate_savings $size_before $size_after
  echo ""
done

# Minify all JS files (overwrite)
for js_file in scripts/*.js; do
  size_before=$(stat -f%z "$js_file")
  total_js_before=$((total_js_before + size_before))
  start_time=$(python3 -c 'import time; print(int(time.time() * 1000))')
  echo "Minifying $js_file"
  terser "$js_file" --compress --mangle --output "$js_file"
  end_time=$(python3 -c 'import time; print(int(time.time() * 1000))')
  ms=$((end_time - start_time))
  size_after=$(stat -f%z "$js_file")
  total_js_after=$((total_js_after + size_after))
  echo "Done in ${ms} ms!"
  calculate_savings $size_before $size_after
  echo ""
done

# Optimise images
echo "Optimising images..."
for img_file in images/*.svg; do
  if [[ "$img_file" == "images/icons.svg" || "$img_file" == "images/logos.svg" ]]; then
    echo "Skipping $img_file (excluded from optimisation)"
    continue
  fi
  size_before=$(stat -f%z "$img_file")
  total_img_before=$((total_img_before + size_before))
  echo "Optimising $img_file"
  svgo "$img_file" -o "$img_file"
  size_after=$(stat -f%z "$img_file")
  total_img_after=$((total_img_after + size_after))
  calculate_savings $size_before $size_after
  echo ""
done

# Savings summary
echo ""
echo "\033[33m✦ SAVINGS SUMMARY ✦\033[0m"


# HTML total
if (( total_html_before > 0 )); then
  total_html_savings=$((total_html_before - total_html_after))
  total_html_before_kb=$(echo "scale=3; $total_html_before / 1024" | bc)
  total_html_after_kb=$(echo "scale=3; $total_html_after / 1024" | bc)
  total_html_percentage=$(echo "scale=1; ($total_html_savings * 100) / $total_html_before" | bc 2>/dev/null || echo "0")
  if (( total_html_savings > 0 )); then color="\033[32m"; else color="\033[31m"; fi
  echo "Total HTML savings: ${total_html_before_kb} KiB - ${color}${total_html_percentage}%\033[0m = ${total_html_after_kb} KiB"
else
  echo "Total HTML savings: No HTML files processed"
fi

# CSS total
if (( total_css_before > 0 )); then
  total_css_savings=$((total_css_before - total_css_after))
  total_css_before_kb=$(echo "scale=3; $total_css_before / 1024" | bc)
  total_css_after_kb=$(echo "scale=3; $total_css_after / 1024" | bc)
  total_css_percentage=$(echo "scale=1; ($total_css_savings * 100) / $total_css_before" | bc 2>/dev/null || echo "0")
  if (( total_css_savings > 0 )); then color="\033[32m"; else color="\033[31m"; fi
  echo "Total CSS savings: ${total_css_before_kb} KiB - ${color}${total_css_percentage}%\033[0m = ${total_css_after_kb} KiB"
else
  echo "Total CSS savings: No CSS files processed"
fi

# JS total
if (( total_js_before > 0 )); then
  total_js_savings=$((total_js_before - total_js_after))
  total_js_before_kb=$(echo "scale=3; $total_js_before / 1024" | bc)
  total_js_after_kb=$(echo "scale=3; $total_js_after / 1024" | bc)
  total_js_percentage=$(echo "scale=1; ($total_js_savings * 100) / $total_js_before" | bc 2>/dev/null || echo "0")
  if (( total_js_savings > 0 )); then color="\033[32m"; else color="\033[31m"; fi
  echo "Total JS savings: ${total_js_before_kb} KiB - ${color}${total_js_percentage}%\033[0m = ${total_js_after_kb} KiB"
else
  echo "Total JS savings: No JS files processed"
fi

# SVG total
if (( total_img_before > 0 )); then
  total_img_savings=$((total_img_before - total_img_after))
  total_img_before_kb=$(echo "scale=3; $total_img_before / 1024" | bc)
  total_img_after_kb=$(echo "scale=3; $total_img_after / 1024" | bc)
  total_img_percentage=$(echo "scale=1; ($total_img_savings * 100) / $total_img_before" | bc 2>/dev/null || echo "0")
  if (( total_img_savings > 0 )); then color="\033[32m"; else color="\033[31m"; fi
  echo "Total SVG savings: ${total_img_before_kb} KiB - ${color}${total_img_percentage}%\033[0m = ${total_img_after_kb} KiB"
else
  echo "Total SVG savings: No SVG files processed"
fi

# Grand total
grand_before=$((total_html_before + total_css_before + total_js_before + total_img_before))
grand_after=$((total_html_after + total_css_after + total_js_after + total_img_after))
if (( grand_before > 0 )); then
  grand_savings=$((grand_before - grand_after))
  grand_before_kb=$(echo "scale=3; $grand_before / 1024" | bc)
  grand_after_kb=$(echo "scale=3; $grand_after / 1024" | bc)
  grand_percentage=$(echo "scale=1; ($grand_savings * 100) / $grand_before" | bc 2>/dev/null || echo "0")
  if (( grand_savings > 0 )); then color="\033[32m"; else color="\033[31m"; fi
  echo "Grand Total savings: ${grand_before_kb} KiB - ${color}${grand_percentage}%\033[0m = ${grand_after_kb} KiB"
else
  echo "Grand Total savings: No files processed"
fi
echo ""

echo "Starting local server at http://localhost:222"
echo "Press Ctrl+C to stop the server and clean up."
python3 -m http.server 222 2>/dev/null

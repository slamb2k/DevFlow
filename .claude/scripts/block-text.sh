#!/bin/bash

# Block letter generator using Unicode box characters with lolcat-style rainbow gradient
# Based on the lolcat implementation: https://github.com/busyloop/lolcat
# Usage: ./block-text.sh "YOUR TEXT"

# Check if banner should be skipped (used by automated tools to avoid duplicate banners)
if [[ "${SKIP_BANNER}" == "1" ]]; then
    exit 0
fi

declare -A letters

# Define each letter as 3 lines (removed trailing spaces for tighter spacing)
letters[A]="█▀█"$'\n'"█▀█"$'\n'"▀ ▀"
letters[B]="█▀▀▄"$'\n'"█▀▀▄"$'\n'"▀▀▀"
letters[C]="█▀▀"$'\n'"█  "$'\n'"▀▀▀"
letters[D]="█▀▄"$'\n'"█ █"$'\n'"▀▀ "
letters[E]="█▀▀"$'\n'"█▀ "$'\n'"▀▀▀"
letters[F]="█▀▀"$'\n'"█▀ "$'\n'"▀  "
letters[G]="█▀▀"$'\n'"█ █"$'\n'"▀▀▀"
letters[H]="█ █"$'\n'"█▀█"$'\n'"▀ ▀"
letters[I]="█"$'\n'"█"$'\n'"▀"
letters[J]="  █"$'\n'"  █"$'\n'"▀▀ "
letters[K]="█ █"$'\n'"█▀▄"$'\n'"▀ ▀"
letters[L]="█  "$'\n'"█  "$'\n'"▀▀▀"
letters[M]="█▄ ▄█"$'\n'"█ ▀ █"$'\n'"▀   ▀"
letters[N]="█▀█"$'\n'"█ █"$'\n'"▀ ▀"
letters[O]="█▀█"$'\n'"█ █"$'\n'"▀▀▀"
letters[P]="█▀█"$'\n'"█▀▀"$'\n'"▀  "
letters[Q]="█▀█"$'\n'"█ █"$'\n'"▀▀█"
letters[R]="█▀█"$'\n'"█▀▄"$'\n'"▀ ▀"
letters[S]="█▀▀"$'\n'"▀▀█"$'\n'"▀▀▀"
letters[T]="▀█▀"$'\n'" █ "$'\n'" ▀ "
letters[U]="█ █"$'\n'"█ █"$'\n'"▀▀▀"
letters[V]="█ █"$'\n'"█ █"$'\n'" ▀ "
letters[W]="█   █"$'\n'"█ █ █"$'\n'"▀▀▀▀▀"
letters[X]="█ █"$'\n'"▄▀▄"$'\n'"▀ ▀"
letters[Y]="█ █"$'\n'"▀▄▀"$'\n'" ▀ "
letters[Z]="▀▀█"$'\n'"▄▀ "$'\n'"▀▀▀"

# Numbers
letters[0]="█▀█"$'\n'"█ █"$'\n'"▀▀▀"
letters[1]="▄█ "$'\n'" █ "$'\n'"▄█▄"
letters[2]="█▀█"$'\n'"▄▀ "$'\n'"▀▀▀"
letters[3]="█▀█"$'\n'"▄▀█"$'\n'"▀▀▀"
letters[4]="█ █"$'\n'"▀▀█"$'\n'"  ▀"
letters[5]="█▀▀"$'\n'"▀▀█"$'\n'"▀▀▀"
letters[6]="█▀▀"$'\n'"█▀█"$'\n'"▀▀▀"
letters[7]="▀▀█"$'\n'" ▄▀"$'\n'" ▀ "
letters[8]="█▀█"$'\n'"█▀█"$'\n'"▀▀▀"
letters[9]="█▀█"$'\n'"▀▀█"$'\n'"▀▀▀"

# Special characters
letters[" "]="  "$'\n'"  "$'\n'"  "
letters[!]="█"$'\n'"█"$'\n'"▄"
letters[.]=" "$'\n'" "$'\n'"▄"
letters[,]=" "$'\n'" "$'\n'"▄"
letters[-]="   "$'\n'"▀▀▀"$'\n'"   "

# Pre-generate rainbow colors for fast access
generate_rainbow_palette() {
    local max_colors=256
    
    # Use Python to generate all colors at once if available
    if command -v python3 >/dev/null 2>&1; then
        python3 << 'PYTHON_END'
import math
import sys

max_colors = 256
freq = 0.1

for i in range(max_colors):
    pos = i * freq
    r = int(math.sin(pos) * 127 + 128)
    g = int(math.sin(pos + 2.0944) * 127 + 128)  # 2π/3
    b = int(math.sin(pos + 4.1888) * 127 + 128)  # 4π/3
    print(f"{r} {g} {b}")
PYTHON_END
    else
        # Fallback: Generate a simple rainbow palette using bash
        for ((i=0; i<max_colors; i++)); do
            local phase=$((i * 360 / max_colors))
            local r g b
            
            if [[ $phase -lt 60 ]]; then
                r=255; g=$((phase * 255 / 60)); b=0
            elif [[ $phase -lt 120 ]]; then
                r=$((255 - (phase - 60) * 255 / 60)); g=255; b=0
            elif [[ $phase -lt 180 ]]; then
                r=0; g=255; b=$(((phase - 120) * 255 / 60))
            elif [[ $phase -lt 240 ]]; then
                r=0; g=$((255 - (phase - 180) * 255 / 60)); b=255
            elif [[ $phase -lt 300 ]]; then
                r=$(((phase - 240) * 255 / 60)); g=0; b=255
            else
                r=255; g=0; b=$((255 - (phase - 300) * 255 / 60))
            fi
            
            echo "$r $g $b"
        done
    fi
}

# Function to print text in block letters with optional colors
print_block() {
    local text="${1^^}"  # Convert to uppercase
    local color_mode="${2:-none}"  # none, rainbow, simple
    
    local lines=("" "" "")
    local first_char=true
    
    for (( i=0; i<${#text}; i++ )); do
        char="${text:$i:1}"
        
        if [[ -n "${letters[$char]}" ]]; then
            # Split the letter into lines
            IFS=$'\n' read -rd '' -a letter_lines <<< "${letters[$char]}"
            
            # Add each line of the letter to our output lines
            for j in 0 1 2; do
                # Add a single space between characters (not for the first character)
                if [[ "$first_char" = false ]]; then
                    lines[$j]="${lines[$j]} "
                fi
                lines[$j]="${lines[$j]}${letter_lines[$j]}"
            done
            first_char=false
        else
            # Unknown character, add spaces
            for j in 0 1 2; do
                if [[ "$first_char" = false ]]; then
                    lines[$j]="${lines[$j]} "
                fi
                lines[$j]="${lines[$j]}  "
            done
            first_char=false
        fi
    done
    
    # Print with colors if requested
    if [[ "$color_mode" = "rainbow" ]]; then
        # Pre-generate the entire rainbow palette once
        readarray -t rainbow_colors < <(generate_rainbow_palette)
        local num_colors=${#rainbow_colors[@]}
        
        # Random starting position for animation
        local start_offset=$(($(date +%s%N) / 10000000 % num_colors))
        
        for line_num in 0 1 2; do
            local line="${lines[$line_num]}"
            local output=""
            
            # Build the entire colored line at once
            for (( pos=0; pos<${#line}; pos++ )); do
                char="${line:$pos:1}"
                
                if [[ "$char" != " " ]]; then
                    # Calculate color index
                    local color_idx=$(((start_offset + pos + line_num * 2) % num_colors))
                    local rgb=(${rainbow_colors[$color_idx]})
                    
                    # Add colored character to output
                    output+=$'\033'"[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${char}"
                else
                    output+=" "
                fi
            done
            
            # Print the entire line at once
            printf "%s\033[0m\n" "$output"
        done
    elif [[ "$color_mode" = "simple" ]]; then
        # Simple single color output - using random color
        local simple_colors=(
            $'\033[31m'  # Red
            $'\033[32m'  # Green
            $'\033[33m'  # Yellow
            $'\033[34m'  # Blue
            $'\033[35m'  # Magenta
            $'\033[36m'  # Cyan
            $'\033[91m'  # Bright Red
            $'\033[92m'  # Bright Green
            $'\033[93m'  # Bright Yellow
            $'\033[94m'  # Bright Blue
            $'\033[95m'  # Bright Magenta
            $'\033[96m'  # Bright Cyan
        )
        local reset=$'\033[0m'
        
        # Pick a random color from the array
        local random_index=$((RANDOM % ${#simple_colors[@]}))
        local chosen_color="${simple_colors[$random_index]}"
        
        for line in "${lines[@]}"; do
            printf "%s%s%s\n" "$chosen_color" "$line" "$reset"
        done
    elif [[ "$color_mode" = "rainbow-basic" ]]; then
        # Rainbow using basic 16 colors (more compatible)
        local basic_colors=(
            $'\033[31m'  # Red
            $'\033[33m'  # Yellow  
            $'\033[32m'  # Green
            $'\033[36m'  # Cyan
            $'\033[34m'  # Blue
            $'\033[35m'  # Magenta
            $'\033[91m'  # Bright Red
            $'\033[93m'  # Bright Yellow
            $'\033[92m'  # Bright Green
            $'\033[96m'  # Bright Cyan
            $'\033[94m'  # Bright Blue
            $'\033[95m'  # Bright Magenta
        )
        local reset=$'\033[0m'
        local num_colors=${#basic_colors[@]}
        
        for line_num in 0 1 2; do
            local line="${lines[$line_num]}"
            local output=""
            
            for (( pos=0; pos<${#line}; pos++ )); do
                char="${line:$pos:1}"
                
                if [[ "$char" != " " ]]; then
                    # Calculate color index
                    local color_idx=$(((pos + line_num * 3) % num_colors))
                    output+="${basic_colors[$color_idx]}${char}"
                else
                    output+=" "
                fi
            done
            
            printf "%s%s\n" "$output" "$reset"
        done
    else
        # Plain text output
        for line in "${lines[@]}"; do
            echo "$line"
        done
    fi
}

# Main
if [[ $# -eq 0 ]]; then
    echo "Usage: $0 [OPTIONS] \"TEXT TO CONVERT\""
    echo "Example: $0 SHIPPING"
    echo ""
    echo "Options:"
    echo "  --color, -c    Apply lolcat-style rainbow gradient (24-bit color)"
    echo "  --basic, -b    Apply rainbow using basic 16 colors (more compatible)"
    echo "  --simple, -s   Apply simple single color (cyan)"
    echo "  --plain, -p    Plain text without colors (default)"
    echo ""
    echo "Supported characters:"
    echo "  Letters: A-Z"
    echo "  Numbers: 0-9"
    echo "  Special: space ! . , -"
    exit 1
fi

# Check which color mode to use
if [[ "$1" == "--color" ]] || [[ "$1" == "-c" ]]; then
    shift
    print_block "$*" "rainbow"
elif [[ "$1" == "--basic" ]] || [[ "$1" == "-b" ]]; then
    shift
    print_block "$*" "rainbow-basic"
elif [[ "$1" == "--simple" ]] || [[ "$1" == "-s" ]]; then
    shift
    print_block "$*" "simple"
elif [[ "$1" == "--plain" ]] || [[ "$1" == "-p" ]]; then
    shift
    print_block "$*" "none"
else
    # Default to no color
    print_block "$*" "none"
fi


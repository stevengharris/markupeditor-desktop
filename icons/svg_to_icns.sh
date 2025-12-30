#!/bin/sh -x

# Create a Mac .icns file for the MarkupEditor application.
#
# Run this script from the icons directory: "sh svg_to_icns.sh markupeditor.svg". It will...
# 1. Make sure the SVG file was identified properly and exists.
# 2. Remove the .iconset directory if it exists.
# 3. Run svg2png (brew install svg2png) to generate a PNG file for each size specified in SIZES, 
#    placing the PNG files in the ./iconset directory.
# 4. Run iconutil to create the .icns file from the PNGs in the ./iconset directory.
#
# We leave the .iconset directory in place in case the PNG files are useful for other purposes.

#set -x

SIZES="
512,512x512
1024,1024x1024
"

if [ -f "$1" ]; then
    if [[ $1 != *.svg ]]; then
        echo "Must provide an SVG file argument."
        exit 1
    else
        SVG=$1
    fi
else
    echo "Expected SVG file $1 does not exist."
    exit 1
fi

echo "Creating .icns file from $SVG..."
# The .icns file will have the same base name as the .svg file
BASE=$(basename "$SVG" | sed 's/\.[^\.]*$//')
ICONSET="$BASE.iconset"
if [ -d "./$ICONSET" ]; then rm -rf "./$ICONSET"; fi 
mkdir -p "./$ICONSET"
for PARAMS in $SIZES; do
    SIZE=$(echo $PARAMS | cut -d, -f1)
    LABEL=$(echo $PARAMS | cut -d, -f2)
    echo " Creating icon_$LABEL.png"
    svg2png -w $SIZE -h $SIZE "$SVG" "./$ICONSET"/icon_$LABEL.png || true
done
if [ -d "./$BASE.icns" ]; then rm "./$BASE.icns"; fi 
iconutil -c icns "./$ICONSET" || true
#echo "Cleaning up..."
#rm -rf "./$ICONSET"
echo "Done."
#!/bin/sh -x

set -x

SIZES="
16,16x16
32,32x32
128,128x128
256,256x256
"

SVG=$1
echo "Processing $1..."
# take action on each file. $f store current file name
BASE=$(basename "$SVG" | sed 's/\.[^\.]*$//')
ICONSET="$BASE.iconset"
mkdir -p "./icons/$ICONSET"
for PARAMS in $SIZES; do
    SIZE=$(echo $PARAMS | cut -d, -f1)
    LABEL=$(echo $PARAMS | cut -d, -f2)
    svg2png -w $SIZE -h $SIZE "$SVG" "./icons/$ICONSET"/icon_$LABEL.png || true
done
iconutil -c icns "./icons/$ICONSET" || true
#rm -rf "./icons/$ICONSET"
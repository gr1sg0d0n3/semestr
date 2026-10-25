#!/bin/bash
# Кодирование роликов из кадров, записанных tools/record.js.
# Запуск: tools/encode.sh <папка с кадрами> <папка для результата>
set -e
F="$1"; M="$2"; A=14; N=720; BG=0xf4e7ec   # A: первый кадр окна (PRE-1), N: кадров в цикле
mkdir -p "$M"
ffmpeg -y -loglevel error -start_number $A -framerate 60 -i "$F/%05d.png" -frames:v $N \
  -vf "crop=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p -movflags +faststart "$M/nashdom-x.mp4"
ffmpeg -y -loglevel error -start_number $A -framerate 60 -i "$F/%05d.png" -filter_complex \
  "trim=end_frame=$N,fps=20,scale=960:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -loop 0 "$M/nashdom-loop.gif"
ffmpeg -y -loglevel error -start_number $A -framerate 60 -i "$F/%05d.png" -filter_complex \
  "trim=end_frame=$N,fps=20,scale=800:500:force_original_aspect_ratio=decrease,pad=800:500:(ow-iw)/2:(oh-ih)/2:color=$BG,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -loop 0 "$M/nashdom-800x500.gif"

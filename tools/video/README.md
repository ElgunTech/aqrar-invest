# Bələdçi tur videosu

`tour.cjs` portalı lokal mühitdə (frontend :5173, backend :8080) addım-addım gəzir, alt yazıları və kursoru üstə çəkir,
Chrome-un screencast kadrlarını (JPEG q92, 1920×1080) yazır və `frames.txt` siyahısını yaradır.

```bash
npm i playwright-core@1.48.2 ffmpeg-static@5.2.0 qrcode@1.5.4
node tour.cjs
ffmpeg -f concat -safe 0 -i frames.txt -vf "scale=1920:1080,setsar=1,fps=30,format=yuv420p" -c:v libx264 -preset slow -crf 18 -movflags +faststart tur.mp4
```

Hazır video `video/` qovluğundadır (git-ə daxil edilmir, ölçüsü böyükdür).

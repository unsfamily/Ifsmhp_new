These synthetic two-second 160×96 teal videos with a 440 Hz tone were generated for gallery regression tests. They contain no personal or third-party media.

- `sample.mp4`: H.264, yuv420p, AAC; valid upload/playback fixture.
- `sample.webm`: VP9, yuv420p, Opus; valid upload/playback fixture.
- `unsupported.mp4`: MPEG-4 Part 2, AAC; unsupported-codec rejection fixture.

Example reproduction with FFmpeg (use `libvpx-vp9`/`libopus` for WebM, `mpeg4`/`aac` for the rejection case):

```sh
ffmpeg -f lavfi -i color=c=teal:s=160x96:r=10 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 2 -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart sample.mp4
```

The tests use these committed fixtures and the backend's FFprobe dependency; they do not require FFmpeg at test runtime.

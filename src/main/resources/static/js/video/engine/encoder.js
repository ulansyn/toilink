/**
 * Экспортирует видео покадрово.
 * WebCodecs → MP4, fallback → MediaRecorder → WebM.
 */
export async function exportVideo(template, params, bgImage, onProgress, audioFile = null) {
  if (typeof VideoEncoder !== 'undefined') {
    try {
      return await viaWebCodecs(template, params, bgImage, onProgress, audioFile);
    } catch (e) {
      console.warn('WebCodecs failed, falling back to MediaRecorder:', e);
    }
  }
  return viaMediaRecorder(template, params, bgImage, onProgress, audioFile);
}

async function viaWebCodecs(template, params, bgImage, onProgress, audioFile) {
  const { Muxer, ArrayBufferTarget } = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@6/build/mp4-muxer.mjs');

  const fps         = template.fps ?? 30;
  const W           = template.width  ?? 1080;
  const H           = template.height ?? 1920;
  const duration    = template.duration;
  const totalFrames = Math.ceil(duration * fps);

  let pcmChannels = null;
  let sampleRate  = 48000;
  let numChannels = 2;

  if (audioFile) {
    const arrayBuffer = await audioFile.arrayBuffer();
    const tempCtx     = new OfflineAudioContext(2, 1, 48000);
    const decoded     = await tempCtx.decodeAudioData(arrayBuffer);

    sampleRate  = decoded.sampleRate;
    numChannels = Math.min(decoded.numberOfChannels, 2);

    const totalSamples = Math.ceil(sampleRate * duration);
    pcmChannels = [];

    for (let c = 0; c < numChannels; c++) {
      const pcm = new Float32Array(totalSamples);
      const src = decoded.getChannelData(Math.min(c, decoded.numberOfChannels - 1));
      for (let i = 0; i < totalSamples; i++) {
        pcm[i] = src[i % src.length];
      }
      pcmChannels.push(pcm);
    }
  }

  const target = new ArrayBufferTarget();

  const muxerOpts = {
    target,
    video: { codec: 'avc', width: W, height: H },
    fastStart: 'in-memory',
  };
  if (pcmChannels) {
    muxerOpts.audio = { codec: 'aac', numberOfChannels: numChannels, sampleRate };
  }

  const muxer = new Muxer(muxerOpts);

  let encError = null;
  const videoEnc = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error:  (e) => { encError = e; },
  });
  videoEnc.configure({
    codec:     'avc1.4d002a',
    width:     W,
    height:    H,
    bitrate:   12_000_000,
    framerate: fps,
  });

  let audioEnc = null;
  if (pcmChannels) {
    const supported = await AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2', numberOfChannels: numChannels, sampleRate,
    }).catch(() => ({ supported: false }));

    if (supported.supported) {
      audioEnc = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error:  (e) => { encError = e; },
      });
      audioEnc.configure({
        codec:            'mp4a.40.2',
        numberOfChannels: numChannels,
        sampleRate,
        bitrate:          192_000,
      });
    }
  }

  try {
    if (audioEnc && pcmChannels) {
      const CHUNK     = 1024;
      const totalSamp = pcmChannels[0].length;

      for (let i = 0; i < totalSamp; i += CHUNK) {
        if (encError) throw encError;

        while (audioEnc.encodeQueueSize >= 20) {
          await new Promise(r => setTimeout(r, 10));
        }

        const size  = Math.min(CHUNK, totalSamp - i);
        const plane = new Float32Array(size * numChannels);
        for (let c = 0; c < numChannels; c++) {
          plane.set(pcmChannels[c].subarray(i, i + size), c * size);
        }

        const aFrame = new AudioData({
          format:           'f32-planar',
          sampleRate,
          numberOfFrames:   size,
          numberOfChannels: numChannels,
          timestamp:        Math.round((i / sampleRate) * 1_000_000),
          data:             plane,
        });

        audioEnc.encode(aFrame);
        aFrame.close();
      }
      await audioEnc.flush();
    }

    const off = new OffscreenCanvas(W, H);
    const ctx = off.getContext('2d');

    for (let i = 0; i < totalFrames; i++) {
      if (encError) throw encError;

      while (videoEnc.encodeQueueSize >= 20) {
        await new Promise(r => setTimeout(r, 10));
      }

      const t = i / fps;
      template.draw(ctx, t, params, bgImage);

      const frame = new VideoFrame(off, {
        timestamp: Math.round(t * 1_000_000),
        duration:  Math.round((1 / fps) * 1_000_000),
      });

      videoEnc.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();

      onProgress(i / totalFrames);
      if (i % 10 === 0) await tick();
    }

    await videoEnc.flush();
    if (encError) throw encError;

  } finally {
    if (videoEnc.state !== 'closed') videoEnc.close();
    if (audioEnc && audioEnc.state !== 'closed') audioEnc.close();
  }

  muxer.finalize();
  return { blob: new Blob([target.buffer], { type: 'video/mp4' }), ext: 'mp4' };
}

async function viaMediaRecorder(template, params, bgImage, onProgress, audioFile = null) {
  const fps         = template.fps ?? 30;
  const W           = template.width  ?? 1080;
  const H           = template.height ?? 1920;
  const totalFrames = Math.ceil(template.duration * fps);

  const canvas      = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const stream     = canvas.captureStream(0);
  const videoTrack = stream.getVideoTracks()[0];

  let audioCtx    = null;
  let audioSource = null;
  if (audioFile) {
    audioCtx = new AudioContext();
    const buf  = await audioFile.arrayBuffer();
    const abuf = await audioCtx.decodeAudioData(buf);
    const dest = audioCtx.createMediaStreamDestination();
    audioSource = audioCtx.createBufferSource();
    audioSource.buffer = abuf;
    audioSource.loop   = true;
    audioSource.connect(dest);
    dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  }

  return new Promise((resolve, reject) => {
    const mime     = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9' : 'video/webm';
    const recorder = new MediaRecorder(stream, {
      mimeType: mime, videoBitsPerSecond: 8_000_000,
    });

    const chunks = [];
    recorder.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);
    recorder.onerror = reject;
    recorder.onstop  = () => {
      audioCtx?.close();
      resolve({ blob: new Blob(chunks, { type: 'video/webm' }), ext: 'webm' });
    };

    recorder.start();
    audioSource?.start();

    let startTime = null;
    let lastFrame = -1;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed    = (timestamp - startTime) / 1000;
      const frameIndex = Math.min(Math.floor(elapsed * fps), totalFrames - 1);

      if (frameIndex > lastFrame) {
        template.draw(ctx, frameIndex / fps, params, bgImage);
        videoTrack.requestFrame();
        onProgress(frameIndex / totalFrames);
        lastFrame = frameIndex;
      }

      if (elapsed >= template.duration) {
        recorder.stop();
        return;
      }
      requestAnimationFrame(step);
    }

    setTimeout(() => requestAnimationFrame(step), 50);
  });
}

const tick = () => new Promise(r => setTimeout(r, 0));

// Browser-camera entropy harvester.
// Captures grayscale frames at low resolution and emits inter-frame
// absolute-difference buffers as base64. Backend LSB-extracts entropy bits
// from these buffers and runs NIST-style health tests.

export class ChaosCameraSession {
  constructor({ width = 160, height = 120, fps = 12 } = {}) {
    this.width = width;
    this.height = height;
    this.fps = fps;
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.prevGray = null;
  }

  async start(videoEl) {
    this.video = videoEl;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.prevGray = null;
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.video) this.video.srcObject = null;
    this.prevGray = null;
  }

  _captureGray() {
    if (!this.video || !this.ctx) return null;
    this.ctx.drawImage(this.video, 0, 0, this.width, this.height);
    const { data } = this.ctx.getImageData(0, 0, this.width, this.height);
    const gray = new Uint8Array(this.width * this.height);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      // Rec. 601 luminance
      gray[j] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
    }
    return gray;
  }

  _diffBuffer(prev, curr) {
    const out = new Uint8Array(curr.length);
    for (let i = 0; i < curr.length; i++) out[i] = Math.abs(curr[i] - prev[i]);
    return out;
  }

  _toBase64(buf) {
    let s = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      s += String.fromCharCode.apply(null, buf.subarray(i, i + chunk));
    }
    return btoa(s);
  }

  // Capture `numFrames` consecutive diffs and return base64 strings + live stats.
  async harvest({ numFrames = 8, onTick } = {}) {
    if (!this.ctx) throw new Error("Camera not started");
    const diffs = [];
    const variances = [];
    let collected = 0;
    const intervalMs = 1000 / this.fps;

    // Prime previous gray frame
    this.prevGray = this._captureGray();
    if (!this.prevGray) throw new Error("Failed to capture initial frame");

    while (collected < numFrames) {
      await new Promise((r) => setTimeout(r, intervalMs));
      const curr = this._captureGray();
      if (!curr) continue;
      const diff = this._diffBuffer(this.prevGray, curr);
      // variance
      let sum = 0;
      for (let i = 0; i < diff.length; i++) sum += diff[i];
      const mean = sum / diff.length;
      let v = 0;
      for (let i = 0; i < diff.length; i++) v += (diff[i] - mean) ** 2;
      const variance = v / diff.length;
      variances.push(variance);
      diffs.push(this._toBase64(diff));
      this.prevGray = curr;
      collected++;
      if (onTick) onTick({ collected, total: numFrames, variance });
    }
    const avgVar = variances.reduce((a, b) => a + b, 0) / variances.length;
    return { frame_diffs_b64: diffs, avg_variance: avgVar };
  }
}

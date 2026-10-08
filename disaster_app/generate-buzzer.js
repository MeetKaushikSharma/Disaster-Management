/**
 * generate-buzzer.js
 * Generates an authentic, high-impact emergency alert buzzer audio file (.wav)
 * Pulsing harsh dual-tone square waves (880Hz & 660Hz) characteristic of emergency broadcast systems.
 */
const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const durationSeconds = 3.0; // 3 seconds looping cycle
const numSamples = Math.floor(sampleRate * durationSeconds);
const numChannels = 1;
const bitsPerSample = 16;
const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
const blockAlign = (numChannels * bitsPerSample) / 8;
const dataSize = numSamples * numChannels * (bitsPerSample / 8);

const buffer = Buffer.alloc(44 + dataSize);

// RIFF header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);

// fmt subchunk
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
buffer.writeUInt16LE(1, 20);  // audioFormat (1 = PCM)
buffer.writeUInt16LE(numChannels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(byteRate, 28);
buffer.writeUInt16LE(blockAlign, 32);
buffer.writeUInt16LE(bitsPerSample, 34);

// data subchunk
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

// Generate dual-tone harsh buzzer pulses (0.25s ON, 0.1s OFF)
let offset = 44;
const pulseLength = 0.35; // seconds per pulse cycle
for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  const cycleTime = t % pulseLength;
  let sample = 0;

  if (cycleTime < 0.25) {
    // Active pulse: Dual frequency square wave for harsh buzzer alarm sound
    const f1 = 880; // A5
    const f2 = 660; // E5
    const tone1 = Math.sin(2 * Math.PI * f1 * t) > 0 ? 0.6 : -0.6;
    const tone2 = Math.sin(2 * Math.PI * f2 * t) > 0 ? 0.4 : -0.4;
    sample = Math.floor((tone1 + tone2) * 26000); // 80% volume
  }

  buffer.writeInt16LE(sample, offset);
  offset += 2;
}

// Target directories
const targetDirs = [
  path.join(__dirname, 'assets', 'sounds'),
  path.join(__dirname, 'android', 'app', 'src', 'main', 'res', 'raw'),
];

targetDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, 'emergency_buzzer.wav');
  fs.writeFileSync(filePath, buffer);
  console.log(`✓ Generated ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
});

# Analysis of Old Working Code

## Overview

The old working implementation uses a **completely different approach** than the current Next.js implementation. Here are the critical differences:

## Key Methodology Differences

### 1. **Speech Recognition Method**

**Old Code (Working):**
- Uses **Socket.IO connection to Verbum AI's real-time speech recognition service**
- WebSocket endpoint: `wss://sdk.verbum.ai/listen`
- Streams raw PCM audio data directly to Verbum AI servers
- **Two separate socket connections** - one for each language
- Both sockets receive the same audio stream simultaneously

**Current Code (Not Working):**
- Uses **Web Speech Recognition API** (browser-based)
- Two separate recognition instances trying to listen to the same microphone
- Browser's speech recognition, not Verbum AI's

### 2. **Audio Processing Pipeline**

**Old Code:**
```javascript
// Lines 743-768
stream = await navigator.mediaDevices.getUserMedia({ 
  audio: { 
    echoCancellation: true, 
    noiseSuppression: true, 
    autoGainControl: true, 
    channelCount: 1 
  } 
});

// Create Audio Context
ctx = new AudioContext();

// Add Audio Worklet for downsampling to 8kHz PCM
await ctx.audioWorklet.addModule(...);

// Create media stream source
src = ctx.createMediaStreamSource(stream);

// Create worklet node for processing
worklet = new AudioWorkletNode(ctx, 'downsample-worklet');

// Send audio to BOTH sockets
worklet.port.onmessage = (ev) => {
  if(sock1 && sock1.connected) sock1.emit('audioStream', ev.data);
  if(sock2 && sock2.connected) sock2.emit('audioStream', ev.data);
};

// Connect the pipeline
src.connect(worklet);
worklet.connect(ctx.destination);
```

**Current Code:**
- No audio worklet
- No downsampling
- No streaming to Verbum AI
- Just uses browser's Web Speech API directly

### 3. **Language Detection Strategy**

**Old Code:**
- **Sends same audio to TWO separate Verbum AI recognition services**
- One configured for `en-US` (employee language)
- One configured for `es-MX` (customer language)
- Both services process the audio simultaneously
- Uses a **"winner" algorithm** based on:
  - Confidence scores
  - Timing windows (PAIR_WINDOW_MS)
  - Orphan timeout (ORPHAN_TIMEOUT_MS = 2500ms)

```javascript
// Lines 686-703: Winner selection logic
if (mateIdx >= 0) {
  const mate = otherBuf.splice(mateIdx, 1)[0];
  if (mate && mate.timeoutId) clearTimeout(mate.timeoutId);
  const winner = (mine.conf >= (mate.conf ?? 0)) ? mine : mate;
  processWinner(winner);
}
```

**Current Code:**
- Tries to run two Web Speech Recognition instances
- Both trying to access the same microphone
- No sophisticated winner selection
- Just whoever fires first

### 4. **Microphone Management**

**Old Code:**
```javascript
// Lines 582-608: Disables mic during TTS playback
if (stream) {
  micHoldCount++;
  stream.getTracks().forEach(t => t.enabled = false);
}

// Re-enables after playback
const releaseMic = () => {
  if (stream) {
    micHoldCount = Math.max(0, micHoldCount - 1);
    if (micHoldCount === 0) stream.getTracks().forEach(t => t.enabled = true);
  }
};
```

**Current Code:**
- Stops recognition engines during processing
- No track enable/disable management
- No hold counter for queued operations

### 5. **Audio Format**

**Old Code:**
- Downsamples to **8kHz PCM** (8000 Hz sample rate)
- 16-bit signed integers
- Mono channel
- Sends 160-sample chunks (20ms at 8kHz)
- This is optimized for speech recognition

**Current Code:**
- Uses whatever the browser provides (typically 48kHz)
- No downsampling
- Web Speech API handles it internally

## Why the Old Code Works Better

1. **Single Audio Stream**: One microphone stream is captured and sent to both recognition services
2. **Server-Side Recognition**: Verbum AI's servers do the heavy lifting, not the browser
3. **Optimized Audio Format**: 8kHz PCM is perfect for speech recognition
4. **Sophisticated Winner Selection**: Confidence-based algorithm prevents false positives
5. **Proper Resource Management**: Disables mic during TTS to prevent echo/feedback

## Critical Missing Pieces in Current Implementation

1. ❌ **No Socket.IO connection to Verbum AI**
2. ❌ **No audio worklet for downsampling**
3. ❌ **No PCM streaming**
4. ❌ **No winner selection algorithm**
5. ❌ **Relying on browser's Web Speech API instead of Verbum AI**

## Recommendation

To fix the current implementation, you need to:

1. **Switch from Web Speech API to Verbum AI Socket.IO streaming**
2. **Implement the audio worklet for downsampling to 8kHz PCM**
3. **Create two socket connections (one per language)**
4. **Stream the same audio to both sockets**
5. **Implement the winner selection algorithm**
6. **Add proper microphone track management**

The current approach of using two Web Speech Recognition instances is fundamentally flawed because:
- The browser may not support multiple simultaneous recognition sessions
- Web Speech API is less reliable than Verbum AI's dedicated service
- No confidence-based winner selection
- Browser's speech recognition may not support all the languages Verbum AI does

## Code Structure Comparison

**Old Code:**
```
getUserMedia() 
  → AudioContext 
  → AudioWorklet (downsample to 8kHz PCM) 
  → Socket.IO (ws1 for lang1, ws2 for lang2)
  → Verbum AI servers
  → speechRecognized events
  → Winner selection
  → Display & Translate
```

**Current Code:**
```
getUserMedia()
  → Web Speech Recognition (instance 1 for lang1)
  → Web Speech Recognition (instance 2 for lang2)
  → onresult events
  → First one to fire wins
  → Display & Translate
```

The old code is more complex but more reliable and accurate.

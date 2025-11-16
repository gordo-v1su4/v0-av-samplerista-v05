# Queue Slice System - Implementation Notes

## Objective

Implement an Ableton-style clip launching system for the slice navigator where clicking a slice while another is playing would queue the new slice instead of immediately switching to it.

## Expected Behavior

1. **Immediate Playback**: When no slice is currently playing, clicking a slice should start playback immediately
2. **Queueing**: When a slice is already playing, clicking a different slice should queue it for playback
3. **Visual Feedback**: The queued slice should blink/pulse in sync with the BPM to indicate it's waiting
4. **Seamless Transition**: When the current slice finishes, the queued slice should begin playing seamlessly without audio gaps
5. **Continuous Playback**: The audio should never stop during the transition from one slice to the queued slice

## Implementation Approach

### Phase 1: State Management
- Added `queuedSlice` state to track which slice is waiting to play
- Added `blinkingSlice` state for visual feedback synchronized to BPM
- Created a beat interval using `setInterval` based on BPM to control the blink timing

### Phase 2: Queue Logic
- Modified `handleSliceClick` to check if a slice is already playing
- If playing, set the clicked slice as `queuedSlice` instead of playing immediately
- Started a timeout to calculate when the current slice would finish

### Phase 3: Transition System
- Created `playQueuedSlice` function to handle the transition
- Used `setTimeout` to wait for the current slice to finish
- Attempted to stop the current playback and start the queued slice

### Phase 4: Visual Feedback
- Modified `drum-pads.tsx` to show different states:
  - Cyan border for currently playing slice
  - Yellow pulsing border for queued slice
  - Blinking indicator synchronized to BPM

## Issues Encountered

### Issue 1: Audio Stops During Transition
**Problem**: When the queued slice was supposed to start playing, the audio would stop completely but the UI would continue to animate as if playback was still happening.

**Symptoms**:
- Waveform playhead stopped moving
- Transport controls showed playing state
- Drum pad continued blinking
- No audio output

**Debug findings**:
- `playQueuedSlice` function was being called correctly
- `audioEngine.playSlice()` was being invoked
- Timeout calculations seemed accurate
- Audio context state showed "running"

### Issue 2: Competing Timeout Systems
**Problem**: Two separate timeout systems were fighting each other:
1. The timeout that tracked when the current slice would end
2. The timeout that cleared the `isPlaying` state after a slice finished

**Result**: The state would clear before the queued slice could start, or the queued slice would try to start while the previous one was still cleaning up.

### Issue 3: Queue Ignored
**Problem**: After adjustments, the queueing system would be completely ignored. Clicking a slice while another was playing would:
- Set the `queuedSlice` state correctly
- Show the blinking UI correctly
- But never actually trigger playback of the queued slice

**Debug findings**:
- `handleSliceEnd` was never being called when slices finished
- Timeouts were firing but not triggering audio
- The playback state became desynchronized from actual audio

### Issue 4: Complete Playback Failure
**Problem**: After multiple attempts to fix the queueing logic, even basic slice playback stopped working:
- Clicking sections changed UI but didn't play audio
- Slices would highlight but not play
- The entire synchronization between UI and audio broke

## Troubleshooting Attempts

### Attempt 1: Add Delays Between Transitions
Added a 50ms delay between stopping the previous slice and starting the queued one to allow for cleanup.

**Result**: No improvement - audio still stopped during transition.

### Attempt 2: Consolidate End Handling
Created a single `handleSliceEnd` function to consolidate the logic of what happens when a slice finishes, checking for queued slices before clearing state.

**Result**: The function wasn't being called reliably, queueing was ignored.

### Attempt 3: Extensive Debug Logging
Added `console.log("[v0] ...")` statements throughout the playback flow to track:
- When slices were clicked
- When queues were set
- When timeouts fired
- When audio engine methods were called
- When playback state changed

**Result**: Logs showed the logic was executing correctly, but audio wasn't following the state changes.

### Attempt 4: Simplify Timing Calculation
Recalculated the slice duration more accurately using:
\`\`\`typescript
const sliceDuration = ((slice.end - slice.start) / buffer.sampleRate) * 1000
\`\`\`

**Result**: Duration calculations were correct, but transition still failed.

### Attempt 5: Proper State Cleanup
Ensured that when stopping previous playback:
1. Call `audioEngine.stop()`
2. Clear the playing slice state
3. Wait briefly
4. Start new slice

**Result**: State cleared correctly but new slice didn't produce audio.

## Root Causes (Hypotheses)

### 1. Audio Engine State Management
The audio engine may not properly handle rapid stop/start cycles. When a slice is stopped and a new one starts immediately, the Web Audio API might not be ready to create a new source node.

### 2. Source Node Lifecycle
Each slice playback creates a new `AudioBufferSourceNode`. These nodes can only be started once, and attempting to reuse or rapidly recreate them may cause issues.

### 3. Timeout Precision
Using `setTimeout` to calculate when a slice will finish is imprecise. Audio playback timing can drift, and the timeout might fire before or after the actual audio ends.

### 4. State Desynchronization
The `isPlaying` state, `currentPlayingSlice`, `queuedSlice`, and actual audio playback became desynchronized, leading to the UI showing one state while the audio was in another.

## Lessons Learned

1. **Web Audio API Complexity**: The Web Audio API requires careful management of node lifecycles and timing. Rapid stop/start operations need special handling.

2. **Timing Challenges**: Synchronizing JavaScript timers with audio playback is difficult. The Web Audio API has its own high-precision clock that may not align with `setTimeout`.

3. **State Management**: Complex state interactions (playing, queued, blinking) require careful coordination to prevent race conditions.

4. **Incremental Changes**: Making large changes to working code can break fundamental functionality. Smaller, tested increments would be safer.

## Potential Solutions for Future Implementation

### Option 1: Use Audio Context Clock
Instead of `setTimeout`, use the Web Audio API's `currentTime` to schedule transitions:
\`\`\`typescript
const startTime = audioContext.currentTime + sliceDuration
sourceNode.start(startTime)
\`\`\`

### Option 2: Pre-schedule Multiple Slices
Schedule both the current and queued slice in advance, allowing the Web Audio API to handle the transition seamlessly.

### Option 3: Crossfade Approach
Instead of stopping and starting, use gain nodes to crossfade between slices for smoother transitions.

### Option 4: Dedicated Playback Queue Manager
Create a separate class or module specifically for managing the playback queue with its own timing and state management.

### Option 5: Use `onended` Callback
Rely on the source node's native `onended` callback instead of `setTimeout` to know when a slice truly finishes:
\`\`\`typescript
sourceNode.onended = () => {
  if (queuedSlice) {
    playSlice(queuedSlice)
  }
}
\`\`\`

## Current Status

**REVERTED**: The queueing system has been completely removed and the app reverted to version 24, where clicking a slice immediately plays it without queueing.

**Working Features**:
- Immediate slice playback on click
- BPM synchronization
- Transport controls
- Waveform display and playhead
- Section detection and navigation

**Not Implemented**:
- Clip queueing
- Beat-synchronized slice transitions
- Blink-on-beat visual feedback for queued slices

## Recommendations

Before attempting to re-implement this feature:

1. Create a minimal test case with just two audio slices and the Web Audio API
2. Verify that the basic transition works reliably
3. Add timing synchronization using `audioContext.currentTime`
4. Test with various BPM values and slice lengths
5. Only after the core mechanism works, integrate it into the full app
6. Consider using an existing audio library (Tone.js, Howler.js) that handles these edge cases

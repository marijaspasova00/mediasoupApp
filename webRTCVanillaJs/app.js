const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const startVideoButton = document.getElementById("startVideo");
const muteAudioButton = document.getElementById("muteAudio");
const shareScreenButton = document.getElementById("shareScreen");

let localStream;
let peerConnection;

async function initLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.srcObject = localStream;
  } catch (error) {
    console.error("Error accessing local camera and microphone:", error);
  }
}

// Mute/unmute audio
muteAudioButton.addEventListener("click", () => {
  localStream.getAudioTracks().forEach((track) => {
    track.enabled = !track.enabled;
    muteAudioButton.textContent = track.enabled ? "Mute Audio" : "Unmute Audio";
  });
});

// Share the screen
shareScreenButton.addEventListener("click", async () => {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    });
    localStream.getVideoTracks().forEach((track) => {
      localStream.removeTrack(track);
      track.stop();
    });
    localStream.addTrack(screenStream.getTracks()[0]);
    localVideo.srcObject = localStream;
  } catch (error) {
    console.error("Error sharing the screen:", error);
  }
});

function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
    localStream.getTracks().forEach((track) => track.stop());
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
  }
}

window.addEventListener("beforeunload", () => {
  endCall();
});
// Start video
startVideoButton.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    localStream.addTrack(stream.getVideoTracks()[0]);
    localVideo.srcObject = localStream;
    stopVideoButton.disabled = false;
    startVideoButton.disabled = true;
  } catch (error) {
    console.error("Error accessing video:", error);
  }
});

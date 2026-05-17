let stream = null;
let capturedImageBase64 = null;


// As we are using pure html,css,js, private .env file does not work. in real production, api key should be 
// stored securely and not exposed in client-side code. For demo purposes only.
const key = "AIzaSyC0nW9O9ABAEvHg6KmjoPDPeqBfarDlDLo";

const savedNumbers = {
    "Healthcare Assistant" : "601139996898"
}

const video = document.getElementById('video');
const snapshotCanvas = document.getElementById('snapshot');
const cameraFrame = document.getElementById('cameraFrame');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnScan = document.getElementById('btnScan');
const camSelect = document.getElementById('camSelect');
const camPlaceholder = document.getElementById('camPlaceholder');

async function enumerateCameras() { //connect cameras
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(d => d.kind === 'videoinput'); //keep camera video only
    camSelect.innerHTML = '';
    cameras.forEach((cam, i) => {
      const opt = document.createElement('option');
      opt.value = cam.deviceId;
      opt.textContent = cam.label || `Camera ${i + 1}`;
      camSelect.appendChild(opt);
    });
    if (cameras.length === 0) {
      camSelect.innerHTML = '<option>No cameras found</option>';
    }
  } catch (e) {
    camSelect.innerHTML = '<option>Unable to list cameras</option>';
  }
}

async function startCamera() {
  try {
    const deviceId = camSelect.value;
    const constraints = {
      video: deviceId ? { deviceId: { exact: deviceId }, facingMode: 'environment' } : { facingMode: 'environment' }
    };
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    video.classList.add('active');
    snapshotCanvas.classList.remove('active');
    camPlaceholder.style.display = 'none';
    cameraFrame.classList.add('live');
    statusDot.className = 'status-dot live';
    statusText.textContent = 'Ready to scan';
    btnStart.disabled = true;
    btnStop.disabled = false;
    btnScan.disabled = false;
    await enumerateCameras();
  } catch (e) {
    statusDot.className = 'status-dot';
    statusText.textContent = 'No camera access.Please upload an image';
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  video.classList.remove('active');
  video.srcObject = null;
  snapshotCanvas.classList.remove('active');
  camPlaceholder.style.display = '';
  cameraFrame.classList.remove('live');
  statusDot.className = 'status-dot';
  statusText.textContent = 'Camera stopped';
  btnStart.disabled = false;
  btnStop.disabled = true;
  btnScan.disabled = true;
  capturedImageBase64 = null;
}

function captureFrame() { //capture and convert image
  const ctx = snapshotCanvas.getContext('2d');
  snapshotCanvas.width = video.videoWidth;
  snapshotCanvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  return snapshotCanvas.toDataURL('image/jpeg', 1).split(',')[1];
}

function handleUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      stopCamera();
      snapshotCanvas.width = img.width;
      snapshotCanvas.height = img.height;
      const ctx = snapshotCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      snapshotCanvas.classList.add('active');
      camPlaceholder.style.display = 'none';
      cameraFrame.classList.add('live');
      capturedImageBase64 = e.target.result.split(',')[1];
      statusDot.className = 'status-dot done';
      statusText.textContent = 'Image loaded . tap Scan Drug';
      btnScan.disabled = false;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function doScan() {
  let imageData;
  
  if (stream && video.readyState === 4) {
    imageData = captureFrame();
    snapshotCanvas.classList.add('active');
    video.classList.remove('active');
  } else if (capturedImageBase64) {
    imageData = capturedImageBase64;
  } else {
    alert('Please start the camera or upload an image first.');
    return;
  }

  cameraFrame.classList.add('scanning');
  statusDot.className = 'status-dot scanning';
  statusText.textContent = 'Analyzing . please wait...';
  btnScan.disabled = true;
  document.getElementById('resultPlaceholder').style.display = 'none';
  document.getElementById('drugCard').classList.remove('visible');
  document.getElementById('loadingCard').classList.add('visible');

  try {
    const apikey = key;  //api key from google studio
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apikey}`, { //connected to gemini-2.5-flash
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({
        contents: [{
          parts: [
            {
//prompt 
              text: `AI assistant to identify medicine type 

{
  "identified": true,
  "brandName": "Brand name or 'Unknown'",
  "genericName": "Generic/chemical name",
  "drugClass": "e.g. NSAID, Antibiotic, Beta-blocker",
  "form": "e.g. Tablet, Capsule, Syrup, Injection",
  "typicalDosage": "identify dose",
  "schedule": "identify how many times per day",
  "use": "1-2 simple sentences describing what this drug treats or prevents that make every person in any age understand",
  "mechanism": "1-2 simple sentences explaining how this drug works in the body that make every person in any age understand",
  "sideEffects": ["side effect 1", "side effect 2", "side effect 3", "side effect 4"],
  "warning": "Most critical safety warning for this medication",
  "storage": "How to store this medicine properly"
}

If no medicine is visible in the image, respond:
{"identified": false}`
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageData
              }
            }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json" 
        }
      })
    });

    const data = await response.json();
    
    if (data.error) {
        throw new Error(data.error.message);
    }

    const result = JSON.parse(data.candidates[0].content.parts[0].text);

    cameraFrame.classList.remove('scanning');
    document.getElementById('loadingCard').classList.remove('visible');

    if (!result.identified) {
      statusDot.className = 'status-dot';
      statusText.textContent = `No drug detected: ${result.reason || 'try a clearer image'}`;
      document.getElementById('resultPlaceholder').style.display = '';
      document.getElementById('resultPlaceholder').querySelector('p').textContent = result.reason || 'No medicine identified. Try a clearer image.';
      btnScan.disabled = false;
      return;
    }

    document.getElementById('drugName').textContent = result.brandName || 'Unknown';
    document.getElementById('drugGeneric').textContent = result.genericName || '';
    document.getElementById('drugClass').textContent = result.drugClass || '—';
    document.getElementById('drugForm').textContent = result.form || '—';
    document.getElementById('drugDosage').textContent = result.typicalDosage || '—';
    document.getElementById('drugSchedule').textContent = result.schedule || '—';
    document.getElementById('drugUse').textContent = result.use || '—';
    document.getElementById('drugMechanism').textContent = result.mechanism || '—';

    const sideEffectsList = document.getElementById('drugSideEffects');
    sideEffectsList.innerHTML = '';
    (result.sideEffects || []).forEach(se => {
      const li = document.createElement('li'); li.textContent = se;
      sideEffectsList.appendChild(li);
    });

    document.getElementById('drugWarning').textContent = result.warning || '—';
    document.getElementById('drugStorage').textContent = result.storage || '—';

    document.getElementById('drugCard').classList.add('visible');
    statusDot.className = 'status-dot done';
    statusText.textContent = `Identified: ${result.brandName}`;
    saveToHistory(result.brandName || result.genericName || 'Unknown Drug', result.use || 'No description provided.');
    // 1. Prepare the text you want to say
const speechText = `${result.brandName}. ${result.use.toLowerCase()}`;
const deepgramApiKey = 'f6011770712f97bff893706bc129c5df312242fb';
const voiceModel = 'aura-2-phoebe-en'; 

try {
  
  const response = await fetch(`https://api.deepgram.com/v1/speak?model=${voiceModel}`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${deepgramApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: speechText })
  });

  if (!response.ok) {
    throw new Error('Could not get audio from Deepgram');
  }

  const audioBlob = await response.blob(); 
  const audioUrl = URL.createObjectURL(audioBlob); 

  const audioPlayer = new Audio(audioUrl);
  lastAudioPlayer = audioPlayer; 
  audioPlayer.playbackRate = 1.0; 

  audioPlayer.play();
  audioPlayer.onended = () => {
    btnScan.disabled = false;
    btnReplay.disabled = false;
    
    // 3. ADD THIS: Reset the text when finished
    statusText.textContent = `Identified: ${result.brandName}`; 
  };

} catch (error) {
  console.error("Voice Error:", error);
  btnScan.disabled = false; 
  statusText.textContent = 'Error playing voice.'; // Let them know it failed
}

  } catch (err) {
    cameraFrame.classList.remove('scanning');
    document.getElementById('loadingCard').classList.remove('visible');
    document.getElementById('resultPlaceholder').style.display = '';
    document.getElementById('resultPlaceholder').querySelector('p').textContent = 'Analysis failed. Try again.';
    statusDot.className = 'status-dot';
    statusText.textContent = 'Error . please try again';
    btnScan.disabled = false;
    console.error("Scanner Error:", err);
  }
}
enumerateCameras();

function sendSOS(contactName) {
    let number = savedNumbers[contactName];
    if (!number) {
        alert("Emergency contact not found!");
        return; 
    }
    let message = "EMERGENCY: Please Check On me!";
    window.open(`https://wa.me/${number}?text=${message}`, "_blank");
}

let isLargeText = false;
function toggleLargeText() {
  isLargeText = !isLargeText;
  
  if (isLargeText) {
    document.documentElement.style.fontSize = "150%"; 
  } else {
    document.documentElement.style.fontSize = "100%"; 
  }
}

function saveToHistory(drugName, drugUse) {
  let history = JSON.parse(localStorage.getItem('drugHistory')) || [];

  const newEntry = {
    name: drugName,
    use: drugUse,
    date: new Date().toLocaleDateString()
  };
  history.unshift(newEntry);

  if (history.length > 3) {
    history.pop();
  }

  localStorage.setItem('drugHistory', JSON.stringify(history));
  displayHistory();
}

function displayHistory() {
  const historyCard = document.getElementById('historyCard');
  const historyList = document.getElementById('historyList');
  
  if (!historyCard || !historyList) return; 
  
  let history = JSON.parse(localStorage.getItem('drugHistory')) || [];

  if (history.length === 0) {
    historyCard.style.display = 'none';
    return;
  }

  historyCard.style.display = 'block';
  historyList.innerHTML = '';

  history.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${item.name}</strong> <span style="font-size: 0.8em; color: gray;">(${item.date})</span><br><small>${item.use}</small>`;
    historyList.appendChild(li);
  });
}
function clearHistory() {
  localStorage.removeItem('drugHistory');
  displayHistory(); // refresh screen
}
displayHistory();

// Check if the browser supports Service Workers
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('PWA Service Worker registered successfully!');
      })
      .catch(error => {
        console.log('Service Worker registration failed:', error);
      });
  });
}
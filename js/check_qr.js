// --- Custom Alert Helper ---
function showCustomAlert(message) {
  const overlay = document.createElement("div");
  overlay.className = "custom-alert-overlay";
  overlay.innerHTML = `
    <div class="custom-alert-box">
      <p>${message.replace(/\n/g, "<br>")}</p>
      <button id="customAlertClose">OK</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("customAlertClose").onclick = () => {
    overlay.remove();
  };

  setTimeout(() => {
    if (document.body.contains(overlay)) overlay.remove();
  }, 3000);
}

// --- Duplicate scan guard variables ---
let lastScannedText = "";
let lastScannedTime = 0;

async function generateHash({ room, checkIn, checkOut, guests, reservation, breakfastFlag }) {
  const secret = "HOTEL_ONLY_SECRET_KEY";
  const data = `${room},${checkIn},${checkOut},${guests},${reservation},${breakfastFlag}`;
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data + secret));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

document.addEventListener("DOMContentLoaded", () => {
  // --- Clean up old localStorage entries (not from today) ---
  const localData = JSON.parse(localStorage.getItem("waitingList") || "[]");
  const today = new Date().toISOString().slice(0, 10);
  const todayList = localData.filter(entry => {
    const [ts] = entry.split(",");
    return ts.slice(0, 10) === today;
  });
  localStorage.setItem("waitingList", JSON.stringify(todayList));

  // --- "全記録" button event handler ---
  const viewAllBtn = document.getElementById("viewAllRecordsBtn");
  if (viewAllBtn) {
    viewAllBtn.onclick = () => {
      const localData = JSON.parse(localStorage.getItem("waitingList") || "[]");
      const today = new Date().toISOString().slice(0, 10);
      const filtered = localData.filter(entry => {
        const [ts] = entry.split(",");
        const date = ts.slice(0, 10);
        return date === today;
      }).sort((a, b) => new Date(a.split(",")[0]) - new Date(b.split(",")[0]));

      const content = filtered.map(entry => {
        const [ts, room, guests] = entry.split(",");
        return `${ts.slice(11, 16)} - ${room}号室 ${guests}名`;
      }).join("<br>");

      const overlay = document.createElement("div");
      overlay.className = "custom-alert-overlay";
      overlay.innerHTML = `
        <div class="custom-alert-box">
          <p>${content || "該当する記録がありません。"}</p>
          <button id="customAlertClose">OK</button>
        </div>
      `;
      document.body.appendChild(overlay);

      document.getElementById("customAlertClose").onclick = () => {
        overlay.remove();
      };
    };
  }
  // --- "追加" (manual entry) button event handler ---
  let manualRoomNumber = 101; // starting room number for manual entries
  const addManualBtn = document.getElementById("addManualEntryBtn");
  if (addManualBtn) {
    addManualBtn.onclick = () => {
      window.currentRoomText = String(manualRoomNumber);
      document.getElementById("guestCountInput").value = "1";
      document.getElementById("customPromptOverlay").style.display = "flex";
      const promptLabel = document.getElementById("customPromptLabel");
      if (promptLabel) {
        promptLabel.innerText = `${manualRoomNumber}号室：人数入力`;
      }
      const cancelBtn = document.getElementById("customPromptCancel");
      const confirmBtn = document.getElementById("customPromptConfirm");
      if (cancelBtn) cancelBtn.innerHTML = "キャンセル";
      if (confirmBtn) confirmBtn.innerHTML = "確定";
      manualRoomNumber += 1;
    };
  }
  // --- Helper to get current formatted time ---
  function getCurrentFormattedTime() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
  }
  // --- Preload reservation list ---
  const SCRIPT_BASE_URL = "https://script.google.com/macros/s/AKfycbydq0Sx4EDAb0eRbdmNwrSEZzCFAEmeiCLF5w7IxnsOdxGqBhi7ZyS4xee2SCTXpPcKaw/exec";
  let reservationSet = new Set();

  function preloadReservationList() {
    const callback = "handleReservationList";
    const query = `mode=reservationList&callback=${callback}`;
    const script = document.createElement("script");
    script.src = `${SCRIPT_BASE_URL}?${query}`;
    document.body.appendChild(script);
  }

  window.handleReservationList = function(response) {
    if (response.success && Array.isArray(response.reservations)) {
      reservationSet = new Set(response.reservations);
      console.log("📥 예약번호 리스트 로컬에 저장됨:", reservationSet);
    } else {
      console.warn("⚠️ 예약번호 리스트 불러오기 실패");
    }
  };

  preloadReservationList();
  const qrRegionId = "preview";
  const html5QrCode = new Html5Qrcode(qrRegionId);


  // Shared QR processing logic for both scan and button click
  function handleQrProcessing(decodedText) {
    const parts = decodedText.split(',');
    if (parts.length !== 7) {
      showCustomAlert("QRコードの形式が正しくありません。");
      return;
    }

    const [room, checkIn, checkOut, guests, reservation, breakfastFlag, hashFromQR] = parts;

    // 1. Check if Room Only (breakfastFlag === "0")
    if (breakfastFlag === "0") {
      showCustomAlert("Room Onlyプランです。");
      return;
    }

    // 2. Generate hash and compare
    generateHash({ room, checkIn, checkOut, guests, reservation, breakfastFlag }).then(calculatedHash => {
      if (calculatedHash !== hashFromQR) {
        showCustomAlert("フロントでご確認ください。");
        return;
      }

      // 3. Validate reservation number
      const isValidReservation = reservationSet.has(reservation.toLowerCase().split(/[-_]/)[0]);
      if (!isValidReservation) {
        showCustomAlert("フロントでご確認ください。");
        return;
      }

      // 4. Check for previous entries for the same room in localStorage
      const localData = JSON.parse(localStorage.getItem("waitingList") || "[]");
      const roomEntries = localData.filter(entry => entry.split(",")[1] === room);
      if (roomEntries.length > 0) {
        const sortedEntries = roomEntries.sort((a, b) => new Date(a.split(",")[0]) - new Date(b.split(",")[0]));
        const details = sortedEntries.map(entry => {
          const [ts, , g] = entry.split(",");
          return `${ts.slice(11, 16)} ${g}名`;
        }).join("<br>");
        const overlay = document.createElement("div");
        overlay.className = "custom-alert-overlay";
        overlay.innerHTML = `
          <div class="custom-alert-box custom-alert-duplicate">
            <p>${room}号室以前の記録があります<br>${details}</p>
            <div class="custom-prompt-buttons duplicate-buttons">
              <button id="cancelExisting">キャンセル</button>
              <button id="continueExisting">続ける</button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById("continueExisting").onclick = () => {
          overlay.remove();
          window.currentRoomText = room;
          document.getElementById("guestCountInput").value = guests;
          document.getElementById("customPromptOverlay").style.display = "flex";
        };
        document.getElementById("cancelExisting").onclick = () => {
          overlay.remove();
        };
        return;
      }

      // 5. All checks passed, show guest input popup
      window.currentRoomText = room;
      document.getElementById("guestCountInput").value = guests;
      document.getElementById("customPromptOverlay").style.display = "flex";
      const promptLabel = document.getElementById("customPromptLabel");
      if (promptLabel) {
        promptLabel.innerText = `${room}号室人数入力`;
      }
      const cancelBtn = document.getElementById("customPromptCancel");
      const confirmBtn = document.getElementById("customPromptConfirm");
      if (cancelBtn) cancelBtn.innerHTML = "キャンセル";
      if (confirmBtn) confirmBtn.innerHTML = "確定";
    });
  }

  function onScanSuccess(decodedText, decodedResult) {
    const now = Date.now();
    if (decodedText === lastScannedText && now - lastScannedTime < 3000) return;
    lastScannedText = decodedText;
    lastScannedTime = now;
    // qrResult.value = decodedText;
    handleQrProcessing(decodedText);
    // html5QrCode.stop().catch(err => console.error("Failed to stop scanner:", err));
  }

  navigator.mediaDevices.getUserMedia({ video: true })
    .then(() => {
      return Html5Qrcode.getCameras();
    })
    .then(devices => {
      if (devices && devices.length > 0) {
        let selectedCamera;

        // iOS 判別
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

        if (isIOS) {
          const backCamera = devices.find(device =>
            device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
          ) || devices[devices.length - 1];
          selectedCamera = { deviceId: { exact: backCamera.id } };
        } else {
          const backCamera = devices.find(device =>
            device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
          ) || devices[devices.length - 1];
          selectedCamera = { deviceId: { exact: backCamera.id } };
        }

        html5QrCode.start(
          selectedCamera,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onScanSuccess
        ).catch(err => {
          console.error("Camera start error:", err);
          qrResult.value = "カメラの起動に失敗しました。";
        });
      } else {
        qrResult.value = "カメラが見つかりませんでした。";
      }
    })
    .catch(err => {
      console.error("Camera access error:", err);
      qrResult.value = "カメラへのアクセスに失敗しました。";
    });

  // --- Reusable QR scanner restart function ---
  function restartQrScanner() {
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length > 0) {
        const backCamera = devices.find(device =>
          device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
        ) || devices[devices.length - 1];

        html5QrCode.start(
          { deviceId: { exact: backCamera.id } },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onScanSuccess
        ).catch(err => {
          console.error("カメラ再起動エラー:", err);
        });
      }
    });
  }

  // --- Submit guest count from custom modal ---
  window.submitGuestCount = function () {
    const guests = document.getElementById("guestCountInput").value;
    const room = window.currentRoomText;
    const timestamp = getCurrentFormattedTime();

    if (!guests || !room) {
      showCustomAlert("部屋番号または人数が不明です。");
      return;
    }

    const query = new URLSearchParams({
      mode: "breakfastSubmit",
      callback: "handlePostResponse",
      room: room,
      guests: guests,
      timestamp: timestamp
    });

    const script = document.createElement("script");
    script.src = `${SCRIPT_BASE_URL}?${query.toString()}`;
    document.body.appendChild(script);

    // Save guest info to localStorage
    const localData = JSON.parse(localStorage.getItem("waitingList") || "[]");
    const newEntry = `${timestamp},${room},${guests}`;
    localData.push(newEntry);
    localStorage.setItem("waitingList", JSON.stringify(localData));

    document.getElementById("customPromptOverlay").style.display = "none";
    showCustomAlert("登録しました。");
    lastScannedText = "";
    html5QrCode.stop().then(() => {
      restartQrScanner();
    }).catch(() => {
      restartQrScanner();
    });
  };

  // Hook confirm button to submitGuestCount
  const customPromptConfirm = document.getElementById("customPromptConfirm");
  if (customPromptConfirm) {
    customPromptConfirm.onclick = window.submitGuestCount;
  }

  // --- Reinitialize camera on page visibility change ---
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      html5QrCode.stop().then(() => {
        console.log("✅ カメラセッション停止完了");
        restartQrScanner();
      }).catch(err => {
        console.warn("⚠️ カメラ停止失敗またはすでに停止済み", err);
        restartQrScanner();
      });
    }
  });

  // const qrResult = document.getElementById("qrResult");
  // const searchButton = document.getElementById("searchButton");
  // if (searchButton) {
  //   searchButton.addEventListener("click", () => {
  //     const qrText = qrResult.value.trim();
  //     if (!qrText) {
  //       alert("QRコードが読み取られていません。");
  //       return;
  //     }
  //     handleQrProcessing(qrText);
  //   });
  // }

  const overlay = document.createElement("div");
  overlay.id = "loadingOverlay";
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
  overlay.style.display = "none";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = 9999;
  overlay.innerHTML = '<div style="color: white; font-size: 24px;">検索中…</div>';
  document.body.appendChild(overlay);
});

window.handleVerifyResponse = function(response) {
  document.getElementById("loadingOverlay").style.display = "none";
  if (!response.success) {
    showCustomAlert("⚠️QRコードの情報が変更された可能性があります。フロントでご確認ください。⚠️");
  } else if (response.match === true) {
    const breakfastFlag = Number(response.breakfastFlag);
    if (breakfastFlag === 0) {
      showCustomAlert("Room Onlyの部屋です。");
    } else if (breakfastFlag === 1) {
      showCustomAlert("朝食付き部屋です。");
    } else {
      showCustomAlert("✅ QRコードがデータベースと一致しました。");
    }
  } else {
    showCustomAlert("⚠️QRコードの情報が変更された可能性があります。フロントでご確認ください。");
  }
};

// --- Guest count modal button handlers ---
// Move these event listeners inside DOMContentLoaded to ensure elements exist
document.addEventListener("DOMContentLoaded", () => {
  const inputEl = document.getElementById("guestCountInput");
  const decreaseBtn = document.getElementById("decreaseGuestBtn");
  const increaseBtn = document.getElementById("increaseGuestBtn");
  if (decreaseBtn && inputEl) {
    decreaseBtn.onclick = () => {
      let val = parseInt(inputEl.value) || 1;
      if (val > 1) inputEl.value = val - 1;
    };
  }
  if (increaseBtn && inputEl) {
    increaseBtn.onclick = () => {
      let val = parseInt(inputEl.value) || 1;
      inputEl.value = val + 1;
    };
  }
  const customPromptCancel = document.getElementById("customPromptCancel");
  if (customPromptCancel && inputEl) {
    customPromptCancel.onclick = () => {
      document.getElementById("customPromptOverlay").style.display = "none";
      inputEl.value = "1";
    };
  }
});
  // --- JSONP global callback for breakfastSubmit ---
  window.handlePostResponse = function(response) {
    console.log("📦 서버 응답:", response);
  };

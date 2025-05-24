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

document.addEventListener("DOMContentLoaded", () => {
  preloadReservationList();
  // --- Message strings for alerts ---
  const messages = {
    alreadyHadBreakfast: {
      ja: "すでに朝食を召し上がりました。",
      en: "This room has already had breakfast."
    },
    roomOnly: {
      ja: "Room Onlyプランです。",
      en: "This room is a Room Only plan."
    },
    invalidQR: {
      ja: "QRコードが無効です。",
      en: "Invalid QR code."
    },
    confirmAtFront: {
      ja: "すみません、フロントでご確認ください。",
      en: "Please check with the front desk."
    },
    enterGuests: {
      ja: "人数を入力してください。",
      en: "Please enter the number of guests."
    },
    guestLimitExceeded: (max) => ({
      ja: `最大人数は${max}名です。`,
      en: `The maximum number of guests is ${max}.`
    })
  };
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
  // --- Helper to update localStorage waitingList entry ---
  // Replaces/overwrites status "0" entry for this room if present.
  // If only status "1" entries exist, calculates totalGuestsSoFar, checks remaining, and inserts if possible.
  function updateLocalStorageEntry(room, guestsToAdd, timestamp, status = "0", totalFromQR = null) {
    const localData = JSON.parse(localStorage.getItem("waitingList") || "[]");

    // Check how many guests have already had breakfast (status "1")
    const totalGuestsSoFar = localData.reduce((sum, entry) => {
      const [r, g, , s] = entry.split(",");
      return (String(r) === String(room) && s === "1") ? sum + parseInt(g || "0") : sum;
    }, 0);

    let newGuests = parseInt(guestsToAdd);
    if (totalFromQR !== null) {
      const remaining = totalFromQR - totalGuestsSoFar;
      console.log(`[DEBUG] Room: ${room}, Total from QR: ${totalFromQR}, Already eaten: ${totalGuestsSoFar}, Remaining: ${remaining}`);
      if (remaining <= 0) {
        console.log(`[DEBUG] Skipping add: no guests remaining for room ${room}.`);
        return;
      }
      newGuests = Math.min(newGuests, remaining);
    }

    if (newGuests <= 0) {
      console.log(`[DEBUG] Skipping add: newGuests <= 0 for room ${room}.`);
      return;
    }

    const newData = `${room},${newGuests},${timestamp},0`;

    // Look for existing status "0" entry to overwrite
    const index = localData.findIndex(entry => {
      const [r, , , s] = entry.split(",");
      return String(r) === String(room) && s === "0";
    });

    if (index !== -1) {
      console.log(`[DEBUG] Overwriting existing status 0 entry for room ${room}`);
      localData[index] = newData;
    } else {
      console.log(`[DEBUG] Adding new status 0 entry for room ${room}`);
      localData.push(newData);
    }

    localStorage.setItem("waitingList", JSON.stringify(localData));
  }
  // --- Custom Alert Modal Helper ---
  window.showCustomAlert = function(message) {
    const overlay = document.createElement("div");
    overlay.className = "custom-alert-overlay";
    overlay.innerHTML = `
      <div class="custom-alert-box">
        <p>${message.replace(/\n/g, "<br>")}</p>
        <button id="customAlertClose">OK</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
      if (overlay && overlay.parentNode) {
        overlay.remove();
      }
    };

    document.getElementById("customAlertClose").onclick = close;

    // Auto close after 3 seconds, except for guest list (#0) or messages with "名"
    if (!message.includes("#0") && !message.includes("名")) {
      setTimeout(close, 3000);
    }
  }
  // Prevent duplicate scans of the same QR code
  let lastScannedText = "";
  let lastScannedTime = 0;
  // --- Reusable QR scanner restart function ---
  function restartQrScanner() {
    html5QrCode.start(
      { facingMode: "user" },
      {
        fps: 15,
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const boxSize = Math.floor(minEdge * 0.85);
          return { width: boxSize, height: boxSize };
        }
      },
      onScanSuccess
    ).catch(err => {
      console.error("QRスキャナ起動エラー:", err);
    });
  }
  document.getElementById("loadingOverlay").style.display = "none";
  const savedList = JSON.parse(localStorage.getItem("waitingList") || "[]");
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  // Remove entries not from today and not between 06:00 and 10:59
  const todayList = savedList.filter(entry => {
    const timestamp = entry.split(",")[2];
    const date = timestamp.slice(0, 10);
    const hour = parseInt(timestamp.slice(11, 13));
    return date === today && hour >= 6 && hour < 11;
  });
  localStorage.setItem("waitingList", JSON.stringify(todayList));
  const listContainer = document.getElementById("List");

  const waitingList = todayList.filter(entry => {
    const parts = entry.split(",");
    const [room, guests, timestamp, status] = parts;
    const entryDate = timestamp.slice(0, 10);
    const entryHour = parseInt(timestamp.slice(11, 13));
    return (
      status === "0" &&
      entryDate === today &&
      entryHour >= 6 &&
      entryHour < 11
    );
  });

  waitingList.sort((a, b) => {
    const timeA = new Date(a.split(",")[2]);
    const timeB = new Date(b.split(",")[2]);
    return timeA - timeB;
  });

  waitingList.forEach(entry => {
    const [room, guests, timestamp] = entry.split(",");
    const button = document.createElement("button");
    button.classList.add("dynamic-button");
    button.textContent = `${room}号 ${guests}名`;
    button.onclick = () => {
      const localData = JSON.parse(localStorage.getItem("waitingList") || "[]");
      const index = localData.findIndex(entry => entry.split(",")[0] === room);
      if (index !== -1) {
        const [roomNum, guests, timestamp] = localData[index].split(",");
        const updatedEntry = `${roomNum},${guests},${timestamp},1`;
        localData[index] = updatedEntry;
        localStorage.setItem("waitingList", JSON.stringify(localData));
        // 버튼 비활성화 및 제거
        button.disabled = true;
        button.style.opacity = "0.5";
        setTimeout(() => button.remove(), 300);

        // Send to Google Apps Script via JSONP
        console.log("📤 서버로 전송되는 데이터 확인:", {
          room: roomNum,
          guests: guests,
          timestamp: timestamp
        });
        const query = new URLSearchParams({
          mode: "breakfastSubmit",
          callback: "handlePostResponse",
          room: roomNum,
          guests: guests,
          timestamp: timestamp
        });
        const jsonpScript = document.createElement("script");
        jsonpScript.src = `${SCRIPT_BASE_URL}?${query.toString()}`;
        document.body.appendChild(jsonpScript);
        // Restart QR scanner immediately after processing button click
        restartQrScanner();
      }
    };
    listContainer.appendChild(button);
  });

  // const SCRIPT_BASE_URL = "https://script.google.com/macros/s/AKfycbx2QKA2TI6_7Js9jNw1H5E0g12HNeXRSQSX8YCAL5MGHadyHlZF4cw0zyZiZ6DYgCwupQ/exec";
  const qrResult = document.getElementById("qrResult");
  const qrRegionId = "reader";
  const html5QrCode = new Html5Qrcode(qrRegionId);

  function onScanSuccess(decodedText, decodedResult) {
    const now = Date.now();
    if (decodedText === lastScannedText && now - lastScannedTime < 5000) return;
    lastScannedText = decodedText;
    lastScannedTime = now;
    console.log(`✅ QRコードスキャン成功: ${decodedText}`);
    const qrResult = document.getElementById("qrResult");
    qrResult.value = decodedText;
    setTimeout(() => { qrResult.value = ""; }, 500);

    const parts = decodedText.split(",");
    if (parts.length !== 7) {
      showCustomAlert(`${messages.invalidQR.ja}\n${messages.invalidQR.en}`);
      return;
    }

    const [room, checkIn, checkOut, guests, reservation, breakfastFlag, hashFromQR] = parts;

    if (breakfastFlag !== "1") {
      showCustomAlert(`${room}号は${messages.roomOnly.ja}\n${messages.roomOnly.en}`);
      lastScannedText = "";
      return;
    }

    generateHash({ room, checkIn, checkOut, guests, reservation, breakfastFlag }).then(calculatedHash => {
      if (calculatedHash !== hashFromQR) {
        showCustomAlert(`${messages.confirmAtFront.ja}\n${messages.confirmAtFront.en}`);
        lastScannedText = "";
        return;
      }

      const loading = document.getElementById("loadingOverlay");
      if (loading) loading.style.display = "flex";
      // --- Local lookup for reservation number in reservationSet ---
      const isValidReservation = reservationSet.has(reservation.toLowerCase().split(/[-_]/)[0]);

      if (!isValidReservation) {
        if (loading) loading.style.display = "none";
        showCustomAlert(`${messages.confirmAtFront.ja}\n${messages.confirmAtFront.en}`);
        lastScannedText = "";
        return;
      }
      if (loading) loading.style.display = "none";

      const localData = JSON.parse(localStorage.getItem("waitingList") || "[]");
      const matchingEntries = localData.filter(entry => entry.split(",")[0] === room);
      const totalGuestsSoFar = matchingEntries.reduce((sum, entry) => {
        const status = entry.split(",")[3];
        return sum + (status === "1" ? parseInt(entry.split(",")[1]) : 0);
      }, 0);

      const remainingGuests = parseInt(guests) - totalGuestsSoFar;
      if (remainingGuests <= 0) {
        showCustomAlert(`${room}号は${messages.alreadyHadBreakfast.ja}\n${messages.alreadyHadBreakfast.en}`);
        lastScannedText = "";
        return;
      }

      window.currentRoomText = room;
      window.maxGuestsFromQR = remainingGuests;
      document.getElementById("guestCountInput").value = remainingGuests;
      document.getElementById("customPromptOverlay").style.display = "flex";
      const promptLabel = document.getElementById("customPromptLabel");
      if (promptLabel) {
        promptLabel.innerText = "朝食を取る人数を入力してください。\nPlease enter the number of guests for breakfast.";
      }
      const cancelBtn = document.getElementById("customPromptCancel");
      const confirmBtn = document.getElementById("customPromptConfirm");
      if (cancelBtn) cancelBtn.innerHTML = "キャンセル<br>Cancel";
      if (confirmBtn) confirmBtn.innerHTML = "確定<br>Confirm";
      document.getElementById("guestCountInput").focus();

      const inputEl = document.getElementById("guestCountInput");
      const decreaseBtn = document.getElementById("decreaseGuestBtn");
      const increaseBtn = document.getElementById("increaseGuestBtn");

      decreaseBtn.onclick = () => {
        let val = parseInt(inputEl.value) || 1;
        if (val > 1) inputEl.value = val - 1;
      };
      increaseBtn.onclick = () => {
        let val = parseInt(inputEl.value) || 1;
        const max = window.maxGuestsFromQR || 10;
        if (val < max) inputEl.value = val + 1;
      };

      // Prevent zoom on double-tap for these buttons
      decreaseBtn.addEventListener("dblclick", (e) => e.preventDefault());
      increaseBtn.addEventListener("dblclick", (e) => e.preventDefault());
    });
  }

  async function generateHash({ room, checkIn, checkOut, guests, reservation, breakfastFlag }) {
    const secret = "HOTEL_ONLY_SECRET_KEY";
    const data = `${room},${checkIn},${checkOut},${guests},${reservation},${breakfastFlag}`;
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data + secret));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
  }

  Html5Qrcode.getCameras().then(devices => {
    if (devices && devices.length > 0) {
      html5QrCode.start(
        { facingMode: "user" },
        {
          fps: 15,
          qrbox: function(viewfinderWidth, viewfinderHeight) {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.floor(minEdge * 0.85);
            return { width: boxSize, height: boxSize };
          }
        },
        onScanSuccess
      ).catch(err => {
        console.error("Camera start error:", err);
        qrResult.value = "カメラの起動に失敗しました。";
      });
    } else {
      qrResult.value = "カメラが見つかりませんでした。";
    }
  }).catch(err => {
    console.error("Camera access error:", err);
    qrResult.value = "カメラへのアクセスに失敗しました。";
  });

  let count = 1;

  // Debug log 출력용
  function logDebug(msg) {
    const logBox = document.getElementById("debugLog");
    if (logBox) {
      const time = new Date().toLocaleTimeString();
      const entry = document.createElement("div");
      entry.textContent = `[${time}] ${msg}`;
      logBox.prepend(entry);
    }
  }

  const submitBtn = document.getElementById("searchButton");
  submitBtn.addEventListener("click", () => {
    const text = document.getElementById("qrResult").value.trim();
    if (!text) {
      showCustomAlert("QRコードをスキャンしてください。");
      // Clear input field after processing
      document.getElementById("qrResult").value = "";
      // Restart QR scanner after search attempt
      restartQrScanner();
      return;
    }

    if (text.startsWith("#")) {
      if (text === "#0") {
        const allData = JSON.parse(localStorage.getItem("waitingList") || "[]");
        if (allData.length === 0) {
          showCustomAlert("ローカルストレージにデータがありません。");
        } else {
          const display = allData.map(entry => {
            const parts = entry.split(",");
            const statusText = parts[3] === "1" ? "入場" : "待機";
            return `${parts[0]}号 ${parts[1]}名 ${parts[2]} (${statusText})`;
          }).join("\n");
          showCustomAlert(display);
          // The following block is intentionally commented out to prevent auto-close or auto-dismissal for #0
          /*
          const alertBox = document.querySelector(".custom-alert-overlay");
          if (alertBox) {
            const closeBtn = alertBox.querySelector("#customAlertClose");
            if (closeBtn) {
              closeBtn.onclick = () => {
                alertBox.remove();
              };
            }
          }
          */
        }
        // Clear input field after processing
        document.getElementById("qrResult").value = "";
        // Restart QR scanner after search attempt
        restartQrScanner();
        return;
      }

      const parts = text.substring(1).split(",");
      const command = parts[0];
      const room = parts[1];
      const guests = parts[2] || null;

      const listContainer = document.getElementById("List");
      const existingButton = Array.from(listContainer.children).find(btn =>
        btn.textContent.startsWith(`${room}号`)
      );

      if (command === "1") {
        if (!room || !guests) {
          showCustomAlert("追加するには部屋番号と人数が必要です（例: #1,501,2）");
          // Clear input field after processing
          document.getElementById("qrResult").value = "";
          // Restart QR scanner after search attempt
          restartQrScanner();
          return;
        }

        if (existingButton) {
          existingButton.textContent = `${room}号 ${guests}名`;
        } else {
          const button = document.createElement("button");
          button.classList.add("dynamic-button");
          button.textContent = `${room}号 ${guests}名`;
          button.onclick = () => {
            const localData = JSON.parse(localStorage.getItem("waitingList") || "[]");
            const index = localData.findIndex(entry => entry.split(",")[0] === room);
            if (index !== -1) {
              const [roomNum, guests, timestamp] = localData[index].split(",");
              const updatedEntry = `${roomNum},${guests},${timestamp},1`;
              localData[index] = updatedEntry;
              localStorage.setItem("waitingList", JSON.stringify(localData));
              // 버튼 비활성화 및 제거
              button.disabled = true;
              button.style.opacity = "0.5";
              setTimeout(() => button.remove(), 300);

              // JSONP 방식으로 서버에 데이터 전송
              console.log("📤 서버로 전송되는 데이터 확인:", {
                room: roomNum,
                guests: guests,
                timestamp: timestamp
              });
              const query = new URLSearchParams({
                mode: "breakfastSubmit",
                callback: "handlePostResponse",
                room: roomNum,
                guests: guests,
                timestamp: timestamp
              });
              const jsonpScript = document.createElement("script");
              jsonpScript.src = `${SCRIPT_BASE_URL}?${query.toString()}`;
              document.body.appendChild(jsonpScript);
            }
          };
          listContainer.appendChild(button);
        }

        // Save to localStorage
        const formattedTime = getCurrentFormattedTime();
        updateLocalStorageEntry(room, guests, formattedTime, "0");

        logDebug(`🟢 ${room}号 ${guests}名 を待機リストに追加または更新`);
      } else if (command === "2") {
        if (!room) {
          showCustomAlert("キャンセルには部屋番号が必要です（例: #2,501）");
          // Clear input field after processing
          document.getElementById("qrResult").value = "";
          // Restart QR scanner after search attempt
          restartQrScanner();
          return;
        }

        if (existingButton) {
          listContainer.removeChild(existingButton);
          logDebug(`🗑️ ${room}号 を待機リストから削除`);
        } else {
          showCustomAlert(`${room}号 は待機リストに存在しません`);
        }
      } else {
      showCustomAlert("不明なコマンドです。");
      }

      // Clear input field after processing
      document.getElementById("qrResult").value = "";
      // Restart QR scanner after search attempt
      restartQrScanner();
      return;
    }

    const parts = text.split(",");
    if (parts.length === 7) {
      // Destructure in the correct order including guests
      const [room, checkIn, checkOut, guests, reservation, breakfastFlag, hashFromQR] = parts;
      // Only pass the required fields (excluding guests) to generateHash
      generateHash({ room, checkIn, checkOut, reservation, breakfastFlag }).then(calculatedHash => {
        if (calculatedHash === hashFromQR) {
          logDebug("🟢 QR코드 형식 및 해시 일치 → 검색 실행");
          window.currentRoomText = text;
          document.getElementById("customPromptOverlay").style.display = "flex";
          // Set prompt message in Japanese and English (2 lines)
          var promptLabel = document.getElementById("customPromptLabel");
          if (promptLabel) {
            promptLabel.innerText = "朝食を取る人数を入力してください。\nPlease enter the number of guests for breakfast.";
          }
          // Set custom prompt button labels (2 lines, Japanese + English)
          var cancelBtn = document.getElementById("customPromptCancel");
          var confirmBtn = document.getElementById("customPromptConfirm");
          if (cancelBtn) cancelBtn.innerHTML = "キャンセル<br>Cancel";
          if (confirmBtn) confirmBtn.innerHTML = "確定<br>Confirm";
        } else {
          logDebug("❌ QR코드 해시 불일치 → 검색 차단");
          showCustomAlert(`${messages.invalidQR.ja}\n${messages.invalidQR.en}`);
        }
        // Clear input field after processing
        document.getElementById("qrResult").value = "";
        // Restart QR scanner after search attempt
        restartQrScanner();
      });
    } else {
      logDebug("⚠️ QR코드 형식 아님 → 검색 차단");
      showCustomAlert("QRコードの形式が正しくありません。");
      // Clear input field after processing
      document.getElementById("qrResult").value = "";
      // Restart QR scanner after search attempt
      restartQrScanner();
    }
  });

  // ✅ Enter, Return, Go, Done, Next 키 입력 시 검색 버튼 클릭 실행 (iPad/iOS 키보드 대응)
  document.addEventListener("keydown", (e) => {
    console.log("Pressed key:", e.key); // 콘솔에 키 출력
    if (
      ["Enter", "Return", "Go", "Done", "Next"].includes(e.key) &&
      document.activeElement?.id === "qrResult"
    ) {
      console.log("🔍 検索ボタンを実行します");
      e.preventDefault();
      document.getElementById("searchButton").click();
      document.activeElement.blur(); // 키보드 닫기
    }
  });

  // ✅ 입력 외의 영역을 터치하면 키보드 닫기
  document.addEventListener("touchstart", (e) => {
    const active = document.activeElement;
    if (
      active &&
      (active.tagName === "INPUT" || active.tagName === "TEXTAREA") &&
      !e.target.closest("input") &&
      !e.target.closest("textarea")
    ) { 
      // Delay blur slightly to ensure compatibility with iPadOS event processing
      setTimeout(() => {
        active.blur();
      }, 50);
    }
  });

  // ✅ 입력 필드 포커스/포커스아웃 시 스크롤 제어 개선
  let lastScrollY = 0;

  document.addEventListener("focusin", () => {
    lastScrollY = window.scrollY;
  });

  document.addEventListener("focusout", () => {
    setTimeout(() => {
      // 키보드 내려간 뒤에도 수동 스크롤한 적 없으면 복원
      if (window.scrollY > lastScrollY + 50) return; // 사용자가 직접 내린 경우 건드리지 않음
      window.scrollTo({ top: lastScrollY, behavior: "smooth" });
    }, 200);
  });
  // --- Helper functions for custom guest count modal ---
  window.submitGuestCount = function() {
    const guests = document.getElementById("guestCountInput").value;
    if (!guests) {
      showCustomAlert(`${messages.enterGuests.ja}\n${messages.enterGuests.en}`);
      return;
    }
    if (window.maxGuestsFromQR && parseInt(guests) > window.maxGuestsFromQR) {
      showCustomAlert(`${messages.guestLimitExceeded(window.maxGuestsFromQR).ja}\n${messages.guestLimitExceeded(window.maxGuestsFromQR).en}`);
      return;
    }

    const room = window.currentRoomText || "";
    const button = document.createElement("button");
    button.classList.add("dynamic-button");
    button.textContent = `${room}号 ${guests}名`;
    button.onclick = () => {
      const localData = JSON.parse(localStorage.getItem("waitingList") || "[]");
      // Only match entry with status "0"
      const index = localData.findIndex(entry => {
        const [r, , , s] = entry.split(",");
        return r === room && s === "0";
      });
      if (index !== -1) {
        const [roomNum, guests, timestamp] = localData[index].split(",");
        const updatedEntry = `${roomNum},${guests},${timestamp},1`;
        localData[index] = updatedEntry;
        localStorage.setItem("waitingList", JSON.stringify(localData));
        // 버튼 비활성화 및 제거
        button.disabled = true;
        button.style.opacity = "0.5";
        setTimeout(() => button.remove(), 300);

        console.log("📤 서버로 전송되는 데이터 확인:", {
          room: roomNum,
          guests: guests,
          timestamp: timestamp
        });
        const query = new URLSearchParams({
          mode: "breakfastSubmit",
          callback: "handlePostResponse",
          room: roomNum,
          guests: guests,
          timestamp: timestamp
        });
        const jsonpScript = document.createElement("script");
        jsonpScript.src = `${SCRIPT_BASE_URL}?${query.toString()}`;
        document.body.appendChild(jsonpScript);
      }
    };

    const listContainer = document.getElementById("List");
    // Check for an existing button with the same room number before appending
    const existingButton = Array.from(listContainer.children).find(btn =>
      btn.textContent.startsWith(`${room}号`)
    );

    if (existingButton) {
      existingButton.textContent = `${room}号 ${guests}名`;
    } else {
      listContainer.appendChild(button);
    }

    // --- localStorage에 저장 ---
    // Use updateLocalStorageEntry to update or add the entry for this room
    const formattedTime = getCurrentFormattedTime();
    updateLocalStorageEntry(room, guests, formattedTime, "0", null);

    document.getElementById("qrResult").value = "";
    document.getElementById("guestCountInput").value = "";
    document.getElementById("customPromptOverlay").style.display = "none";
    // Clear lastScannedText so the same QR can be scanned again
    lastScannedText = "";
    // Show confirmation message before restarting QR scanner
    showCustomAlert("スタッフがお呼びするまで、少々お待ちください。\nPlease wait until the staff calls you.");
    // Restart QR scanner after submitting guest count
    restartQrScanner();
  };

  window.closeCustomPrompt = function() {
    document.getElementById("customPromptOverlay").style.display = "none";
    document.getElementById("guestCountInput").value = "";
    // Clear lastScannedText so the same QR can be scanned again
    lastScannedText = "";
    restartQrScanner();
  };

  // 팝업 외부 터치 시 닫기 (cancel 동작 실행)
  const overlay = document.getElementById("customPromptOverlay");
  if (overlay) {
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        window.closeCustomPrompt(); // 외부 터치 시 팝업 닫기
      }
    });
  }
});

window.handlePostResponse = function(response) {
  console.log("📦 서버 응답:", response); // 콘솔에 출력
  restartQrScanner();
};
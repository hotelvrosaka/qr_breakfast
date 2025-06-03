// --- Name suggestion feature: guest name list fetch and suggestion box ---
let cachedGuestList = [];
let lastGuestListFetchedAt = null;

function fetchGuestFullList() {
  const script = document.createElement("script");
  const callback = "handleGuestFullList";
  const query = `mode=guestFullList&callback=${callback}`;
  script.src = `${getSheetApiUrl()}?${query}`;
  showUpdatingOverlay();
  document.body.appendChild(script);
  lastGuestListFetchedAt = new Date();
}

window.handleGuestFullList = function(response) {
  if (response.success && Array.isArray(response.list)) {
    if (response.list.length === 0) {
      console.warn("⚠️ 게스트 전체 목록이 비어 있습니다。갱신 중지");
      removeSearchOverlay();
      return;
    }
    cachedGuestList = response.list;
    console.log("✅ 게스트 전체 목록 불러오기 완료:", cachedGuestList);
  } else {
    console.error("❌ 게스트 전체 목록 오류", response.error);
  }
  removeSearchOverlay();
};


// --- Overlay helpers for search (name/room) ---
function createOverlayWithText(text) {
  const overlay = document.createElement("div");
  overlay.id = "searchOverlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.zIndex = "9999";
  overlay.style.color = "white";
  overlay.style.fontSize = "24px";
  overlay.textContent = text;
  document.body.appendChild(overlay);
}

function showSearchOverlay() {
  createOverlayWithText("検索中…");
}

function showUpdatingOverlay() {
  createOverlayWithText("更新中…");
}

function removeSearchOverlay() {
  const existingOverlay = document.getElementById("searchOverlay");
  if (existingOverlay) existingOverlay.remove();
}

// Include WanaKana for romaji to katakana conversion

// --- generateHash function (standalone, not imported) ---
async function generateHash(room, checkIn, checkOut, guests, reservation, breakfastFlag) {
  const secret = "HOTEL_ONLY_SECRET_KEY";
  const data = `${room},${checkIn},${checkOut},${guests},${reservation},${breakfastFlag}`;
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data + secret));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

async function generateHashFromObject({ room, checkIn, checkOut }) {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const days = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
  const secret = "HOTEL_ONLY_SECRET_KEY";

  const data = `${room},${checkIn},${checkOut},${days}`;
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data + secret));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}
const getSheetApiUrl = () => 'https://script.google.com/macros/s/AKfycbwRMjixETPUjWHof-vbb4I1s4lf7Cn53HzkmobHgzkgudZrwuNIbMShgrGoDx87OhvDsQ/exec';
const wanakanaScript = document.createElement("script");
wanakanaScript.src = "https://unpkg.com/wanakana";
document.head.appendChild(wanakanaScript);

// Convert full-width katakana to half-width katakana (including voiced/semi-voiced marks)
function kanaFullToHalf(str){
    let kanaMap = {
        "ガ": "ｶﾞ", "ギ": "ｷﾞ", "グ": "ｸﾞ", "ゲ": "ｹﾞ", "ゴ": "ｺﾞ",
        "ザ": "ｻﾞ", "ジ": "ｼﾞ", "ズ": "ｽﾞ", "ゼ": "ｾﾞ", "ゾ": "ｿﾞ",
        "ダ": "ﾀﾞ", "ヂ": "ﾁﾞ", "ヅ": "ﾂﾞ", "デ": "ﾃﾞ", "ド": "ﾄﾞ",
        "バ": "ﾊﾞ", "ビ": "ﾋﾞ", "ブ": "ﾌﾞ", "ベ": "ﾍﾞ", "ボ": "ﾎﾞ",
        "パ": "ﾊﾟ", "ピ": "ﾋﾟ", "プ": "ﾌﾟ", "ペ": "ﾍﾟ", "ポ": "ﾎﾟ",
        "ヴ": "ｳﾞ", "ヷ": "ﾜﾞ", "ヺ": "ｦﾞ",
        "ア": "ｱ", "イ": "ｲ", "ウ": "ｳ", "エ": "ｴ", "オ": "ｵ",
        "カ": "ｶ", "キ": "ｷ", "ク": "ｸ", "ケ": "ｹ", "コ": "ｺ",
        "サ": "ｻ", "シ": "ｼ", "ス": "ｽ", "セ": "ｾ", "ソ": "ｿ",
        "タ": "ﾀ", "チ": "ﾁ", "ツ": "ﾂ", "テ": "ﾃ", "ト": "ﾄ",
        "ナ": "ﾅ", "ニ": "ﾆ", "ヌ": "ﾇ", "ネ": "ﾈ", "ノ": "ﾉ",
        "ハ": "ﾊ", "ヒ": "ﾋ", "フ": "ﾌ", "ヘ": "ﾍ", "ホ": "ﾎ",
        "マ": "ﾏ", "ミ": "ﾐ", "ム": "ﾑ", "メ": "ﾒ", "モ": "ﾓ",
        "ヤ": "ﾔ", "ユ": "ﾕ", "ヨ": "ﾖ",
        "ラ": "ﾗ", "リ": "ﾘ", "ル": "ﾙ", "レ": "ﾚ", "ロ": "ﾛ",
        "ワ": "ﾜ", "ヲ": "ｦ", "ン": "ﾝ",
        "ァ": "ｧ", "ィ": "ｨ", "ゥ": "ｩ", "ェ": "ｪ", "ォ": "ｫ",
        "ッ": "ｯ", "ャ": "ｬ", "ュ": "ｭ", "ョ": "ｮ",
        "。": "｡", "、": "､", "ー": "ｰ", "「": "｢", "」": "｣", "・": "･",
        "　": " "
    };
    let reg = new RegExp('(' + Object.keys(kanaMap).join('|') + ')', 'g');
    return str.replace(reg, function(s){
        return kanaMap[s];
    }).replace(/゛/g, 'ﾞ').replace(/゜/g, 'ﾟ');
}

wanakanaScript.onload = () => {
  if (location.pathname.includes("qr_create.html")) {
    // --- Fetch guest full list for suggestions and search on page load ---
    fetchGuestFullList();
  }

  const searchBtName = document.getElementById("searchBtName");
  if (searchBtName) {
    searchBtName.addEventListener("click", () => {
      if (!window.wanakana || !wanakana.toKatakana) {
        alert("wanakana error");
        return;
      }


      // --- Show search overlay before searching ---
      showSearchOverlay();

      console.log("🧪 名前検索クリック");
      const baseInput = document.getElementById("name").value.trim();
      console.log("🔍 検索対象の入力:", baseInput);
      if (!baseInput) {
        alert("名前を入力してください。");
        removeSearchOverlay();
        return;
      }

      const fullKatakana = wanakana.toKatakana(baseInput);
      const halfKana = kanaFullToHalf(fullKatakana);
      const romajiInput = wanakana.toRomaji(baseInput);
      console.log("✅ kana:", fullKatakana);
      console.log("✅ halfKana:", halfKana);
      console.log("✅ romajiInput:", romajiInput);

      const searchTerms = Array.from(new Set([
        normalize(baseInput),
        halfKana,
        normalize(romajiInput)
      ]));
      console.log("🔍 生成された検索語一覧:", searchTerms);

      // --- Filter from cachedGuestList synchronously ---
      let foundResults = [];
      cachedGuestList.forEach(guest => {
        if (!guest.searchName) return;
        const guestSearchName = String(guest.searchName).toLowerCase();
        if (searchTerms.some(term => guestSearchName.includes(term))) {
          foundResults.push(guest);
        }
      });

      handleSearchResult({ success: true, matches: foundResults });
    });
  }

  // --- 部屋番号検索機能 追加 ---
  const searchBtRoom = document.getElementById("searchBtRoom");
  if (searchBtRoom) {
    searchBtRoom.addEventListener("click", () => {
      const baseInput = document.getElementById("room").value.trim();
      if (!baseInput) {
        alert("部屋番号を入力してください。");
        return;
      }

      console.log("🧪 部屋番号検索クリック");
      console.log("🔍 検索対象の部屋番号:", baseInput);

      showSearchOverlay();
      const searchTerm = normalize(baseInput);
      let foundResults = [];

      cachedGuestList.forEach(guest => {
        if (!guest.room) return;
        const guestRoom = String(guest.room).toLowerCase();
        if (guestRoom.includes(searchTerm)) {
          foundResults.push(guest);
        }
      });

      handleRoomSearchResult({ success: true, matches: foundResults });
    });
  }
};



function toHalfWidth(str) {
  // Convert full-width A-Z, a-z, 0-9 to half-width
  return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (s) {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  });
}

function toHalfWidthKana(str) {
  // Convert full-width katakana to half-width katakana
  return str.replace(/[\u30A1-\u30F6]/g, function(char) {
    const code = char.charCodeAt(0) - 0x60;
    return String.fromCharCode(code);
  });
}

const normalize = str => toHalfWidth(str).toLowerCase();

function fillFormWithData(data) {
  console.log("🧾 fillFormWithData:", data);
  document.getElementById("name").value = data.name || "";
  document.getElementById("room").value = data.room || "";
  document.getElementById("checkIn").value = data.checkIn || "";
  document.getElementById("checkOut").value = data.checkOut || "";
  document.getElementById("guests").value = data.guestCount || "";
  // Reservation: only use part before '-' or '_'
  const rawReservation = data.reservation || "";
  const cleanedReservation = rawReservation.split(/[-_]/)[0];
  document.getElementById("reservation").value = cleanedReservation;
  document.getElementById("payment").value = data.unpaid !== undefined ? String(data.unpaid) : "";
  // Set breakfast toggle
  const breakfastHidden = document.getElementById("breakfastHidden");
  const toggleOptions = document.querySelectorAll(".toggle-option");
  let val = (data.breakfastFlag === 1 || data.breakfastFlag === "1") ? "O" : "X";
  breakfastHidden.value = val;
  toggleOptions.forEach(option => {
    if (option.dataset.value === val) {
      option.classList.add("active");
    } else {
      option.classList.remove("active");
    }
  });
  // Show alert popup if memo exists
  if (data.memo && data.memo.trim() !== "") {
    alert(`📌 メモ:\n${data.memo}`);
  }
}

window.handleSearchResult = function(response) {
  // Remove search overlay
  removeSearchOverlay();
  console.log("🔍 検索結果:", response);
  const foundResults = response.success ? (response.matches || []) : [];
  if (!response.success || foundResults.length === 0) {
    alert("一致する名前が見つかりませんでした。");
    return;
  }

  if (foundResults.length === 1) {
    fillFormWithData(foundResults[0]);
  } else {
    // Format date as MM/DD for display
    const formatToMMDD = (dateStr) => {
      const date = new Date(dateStr);
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${mm}/${dd}`;
    };
    // Show custom select popup instead of prompt
    const popup = document.getElementById("customSelectPopup");
    const optionList = document.getElementById("popupOptions");
    optionList.innerHTML = ""; // Clear previous

    foundResults.forEach((item, index) => {
      const li = document.createElement("li");
      li.textContent = `${item.name}, #${item.room}, ${formatToMMDD(item.checkIn)} - ${formatToMMDD(item.checkOut)}`;
      li.addEventListener("click", () => {
        fillFormWithData(item);
        closeSelectPopup();
      });
      optionList.appendChild(li);
    });

    popup.style.display = "flex";
    // ✅ Allow clicking outside popup content to close the popup (not trigger selection)
    const customPopup = document.getElementById("customSelectPopup");
    customPopup.addEventListener("click", function (e) {
      if (e.target === customPopup) {
        closeSelectPopup();
      }
    });
  }
};

// JSONP callback for upload responses
window.handleJsonpResponse = function(response) {
  console.log("📥 アップロード結果:", response);
  if (response.debug) {
    console.log("📊 combined:", response.debug.combined);
    console.log("📊 expected:", response.debug.expected);
  }
  // You can handle post-upload feedback here if needed
};


// 部屋番号検索のJSONPコールバック
window.handleRoomSearchResult = function(response) {
  console.log("🔍 部屋番号検索結果:", response);
  // Remove search overlay (in case it was shown, e.g., for future compatibility)
  removeSearchOverlay();

  if (!response.success || !response.matches || response.matches.length === 0) {
    alert("一致する部屋番号が見つかりませんでした。");
    return;
  }

  if (response.matches.length === 1) {
    fillFormWithData(response.matches[0]);
  } else {
    const roomOptions = response.matches.map((item, index) =>
      `${index + 1}: ${item.room}, ${item.name}, ${item.checkIn}, ${item.checkOut}, ${item.reservation}`
    ).join("\n");
    const selected = prompt(`複数の一致が見つかりました。番号を選んでください:\n${roomOptions}`);
    const selectedIndex = parseInt(selected, 10) - 1;
    if (!isNaN(selectedIndex) && response.matches[selectedIndex]) {
      fillFormWithData(response.matches[selectedIndex]);
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const SHEET_NAME_SEARCH_API = getSheetApiUrl();

  if (location.pathname.includes("qr_create.html")) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const checkInInput = document.getElementById("checkIn");
    if (checkInInput) checkInInput.value = `${yyyy}-${mm}-${dd}`;
  }

  const form = document.getElementById("qrForm");

  // --- Name input suggestion feature ---
  const nameInput = document.getElementById("name");
  // Suggestion box setup
  const suggestionBox = document.createElement("ul");
  suggestionBox.id = "nameSuggestionBox";
  suggestionBox.style.position = "absolute";
  suggestionBox.style.zIndex = "10000";
  suggestionBox.style.background = "#fff";
  suggestionBox.style.border = "1px solid #ccc";
  suggestionBox.style.listStyle = "none";
  suggestionBox.style.padding = "0";
  suggestionBox.style.margin = "0";
  suggestionBox.style.maxHeight = "200px";
  suggestionBox.style.overflowY = "auto";
  suggestionBox.style.width = nameInput.offsetWidth + "px";
  suggestionBox.style.display = "none";
  document.body.appendChild(suggestionBox);

  nameInput.addEventListener("input", (e) => {
    if (!window.wanakana || !wanakana.toKatakana) return;
    const rawInput = e.target.value || "";
    const katakanaInput = normalize(kanaFullToHalf(wanakana.toKatakana(rawInput)));
    const romajiInput = normalize(wanakana.toRomaji(rawInput));
    const searchInputs = [katakanaInput, romajiInput];
    const matchMap = {};

    cachedGuestList.forEach(({ name, searchName }) => {
      if (searchName && searchInputs.some(inp => searchName.includes(inp))) {
        if (!matchMap[name]) matchMap[name] = 0;
        matchMap[name]++;
      }
    });

    const entries = Object.entries(matchMap);
    const limitedEntries = entries.slice(0, 5);
    if (limitedEntries.length === 0) {
      suggestionBox.style.display = "none";
      return;
    }

    suggestionBox.innerHTML = "";
    limitedEntries.forEach(([name, count]) => {
      const li = document.createElement("li");
      li.style.padding = "6px 10px";
      li.style.cursor = "pointer";
      li.textContent = count > 1 ? `${name} (${count})` : name;
      li.addEventListener("click", () => {
        nameInput.value = name;
        suggestionBox.style.display = "none";
        const searchBtName = document.getElementById("searchBtName");
        if (searchBtName) searchBtName.click();
      });
      suggestionBox.appendChild(li);
    });

    const rect = nameInput.getBoundingClientRect();
    suggestionBox.style.top = rect.bottom + window.scrollY + "px";
    suggestionBox.style.left = rect.left + window.scrollX + "px";
    suggestionBox.style.width = rect.width + "px";
    suggestionBox.style.display = "block";
  });

  document.addEventListener("click", (e) => {
    if (!suggestionBox.contains(e.target) && e.target !== nameInput) {
      suggestionBox.style.display = "none";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    document.querySelectorAll("input").forEach(el => el.blur());

    // 朝食の選択がされているかチェック
    const breakfast = document.getElementById("breakfastHidden")?.value || "";
    if (breakfast !== "O" && breakfast !== "X") {
      alert("朝食の選択が必要です（OまたはX）。");
      return;
    }

    const name = document.getElementById("name")?.value.trim() || "";
    const room = document.getElementById("room").value.trim() || "";
    const checkIn = document.getElementById("checkIn").value || "";
    const checkOut = document.getElementById("checkOut").value || "";
    const guests = document.getElementById("guests").value || "";
    const reservation = document.getElementById("reservation").value.trim() || "";

    const breakfastFlag = (breakfast === "O" || breakfast === "1") ? "1" : "0";
    const hash = await generateHash(room, checkIn, checkOut, guests, reservation, breakfastFlag);
    const qrText = `${room},${checkIn},${checkOut},${guests},${reservation},${breakfastFlag},${hash}`;

    // ✅ 팝업 티켓 정보 표시
    const breakfastTime = (breakfast === "O" || breakfast === "1") ? " (07:00~10:00)" : "";
    const textInfo = `Room : ${room}<br>Check-in : ${checkIn}<br>Check-out : ${checkOut}(~10:00)<br>Guests : ${guests}<br>Breakfast : ${breakfast}${breakfastTime}<br>Booking No : ${reservation}`;
    document.getElementById("popupText").innerHTML = textInfo;
    const popupQR = document.getElementById("popupQR");
    popupQR.innerHTML = "";
    new QRCode(popupQR, {
      text: qrText,
      width: 250,
      height: 250,
      correctLevel: QRCode.CorrectLevel.H
    });
    document.getElementById("qrOverlay").style.display = "flex";
    // Make overlay dismissible by clicking anywhere on the overlay (including the popup)
    const qrOverlay = document.getElementById("qrOverlay");
    qrOverlay.addEventListener("click", function () {
      qrOverlay.style.display = "none";
    });
  });

  // ✅ Enter 키 입력 시 키보드 닫기 (guests)
  document.getElementById("guests").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // submit 방지
      e.target.blur(); // 키보드 닫기
    }
  });

  // ✅ 이름 입력창에서 Enter 시 검색 버튼 클릭 (폼 제출 방지)
  if (nameInput) {
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault(); // 폼 제출 방지
        nameInput.blur();   // 키보드 닫기
        const searchBtName = document.getElementById("searchBtName");
        if (searchBtName) searchBtName.click(); // 이름 검색 버튼 클릭
      }
    });

    // ✅ 이름 입력창 클릭 시 자동 초기화
    nameInput.addEventListener("focus", () => {
      nameInput.value = "";
    });
  }

  const roomInput = document.getElementById("room");
  if (roomInput) {
    roomInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        roomInput.blur();
        const searchBtRoom = document.getElementById("searchBtRoom");
        if (searchBtRoom) searchBtRoom.click();
      }
    });

    // ✅ 방 번호 입력창 클릭 시 자동 초기화
    roomInput.addEventListener("focus", () => {
      roomInput.value = "";
    });
  }

  // ✅ 입력 외의 영역을 터치하면 키보드 닫기
  document.addEventListener("touchstart", (e) => {
    const active = document.activeElement;
    const suggestionBox = document.getElementById("nameSuggestionBox");
    const isTouchingSuggestion = suggestionBox && suggestionBox.contains(e.target);
  
    if (
      active &&
      (active.tagName === "INPUT" || active.tagName === "TEXTAREA") &&
      !e.target.closest("input") &&
      !e.target.closest("textarea") &&
      !isTouchingSuggestion
    ) {
      active.blur();
    }
  });

  // ✅ 파일 선택 후 input 초기화 (같은 파일도 다시 선택 가능)
  const fileInput = document.getElementById("fileInput");
  if (fileInput) {
    fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (e) {
        const overlay = document.createElement("div");
        overlay.id = "uploadOverlay";
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
        overlay.style.display = "flex";
        overlay.style.justifyContent = "center";
        overlay.style.alignItems = "center";
        overlay.style.zIndex = "9999";
        overlay.style.color = "white";
        overlay.style.fontSize = "24px";
        overlay.textContent = "アップロード中…";
        document.body.appendChild(overlay);
        const csvText = e.target.result;

        console.log("📄 원본 CSV 미리보기:", csvText.slice(0, 500));

        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: async function (results) {
            const rows = results.data;

            const compacted = await Promise.all(rows
              .filter(row => row["ステータス"] !== "キャンセル")
              .map(async row => {
                const fullReservation = row["booking_no"]?.trim() || row["#予約番号"]?.trim() || "";
                const reservation = fullReservation;
                let rawRoom = row["room"]?.trim() || row["部屋名"]?.trim() || "";
                const room = rawRoom.match(/\d{1,3}/)?.[0] || "";
                const reserver = row["name"]?.trim() || row["予約者"]?.trim() || "";
                const checkInRaw = row["check_in"]?.trim() || row["C/I"]?.trim() || "";
                const checkOutRaw = row["check_out"]?.trim() || row["C/O"]?.trim() || "";
                const formatDate = (raw) => {
                  const dateObj = new Date(raw);
                  if (isNaN(dateObj)) return "";
                  const yyyy = dateObj.getFullYear();
                  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
                  const dd = String(dateObj.getDate()).padStart(2, "0");
                  return `${yyyy}-${mm}-${dd}`;
                };
                const checkIn = formatDate(checkInRaw);
                const checkOut = formatDate(checkOutRaw);

                const guestCount = parseInt(row["guest_no"] || row["大人人数"] || "0", 10);
                const breakfastFlag = row["breakfast"] !== undefined
                  ? parseInt(row["breakfast"])
                  : (row["プラン名"]?.toLowerCase().includes("room only") ? 0 : 1);

                const days = checkOut && checkIn ? Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)) : "";
                const hash = await generateHash(room, checkIn, checkOut, guestCount, reservation, breakfastFlag);

                let searchName = reserver;
                if (window.wanakana) {
                  if (/^[\x00-\x7F\s]+$/.test(reserver)) {
                    searchName = wanakana.toRomaji(reserver).toLowerCase();
                  } else {
                    searchName = wanakana.toKatakana(reserver, { IMEMode: true });
                  }
                }
                const rawUnpaid = row["未収金"]?.trim() || "";
                const unpaid = rawUnpaid === "なし" ? "0" : rawUnpaid;
                const memo = (row["メモ"] ?? "").trim().replace(/,/g, '、');
                return [reservation, room, reserver, checkIn, checkOut, guestCount, breakfastFlag, searchName, unpaid, memo];
              }));

            console.log("📊 JSONP 전送用 문자열 배열 (with searchName):", compacted);
            const CHUNK_SIZE = 15;
            const expectedCount = compacted.length;
            const SHEET_API_URL = getSheetApiUrl();

            // --- 1. Clear sheet before uploading chunks (command-based) ---
            const commandScript = document.createElement("script");
            const clearQuery = `mode=importCsv&callback=handleCommandResponse&command=clear`;
            commandScript.src = `${SHEET_API_URL}?${clearQuery}`;
            document.body.appendChild(commandScript);

            window.handleCommandResponse = function(response) {
              if (response.success && response.cleared) {
                const chunks = [];
                for (let i = 0; i < compacted.length; i += CHUNK_SIZE) {
                  chunks.push(compacted.slice(i, i + CHUNK_SIZE));
                }
                uploadCsvChunksSequentially(chunks, 0, SHEET_API_URL);
              } else {
                console.error("❌ clear command 실패", response);
              }
            };
          }
        });
      };

      reader.readAsText(file, 'shift-jis'); // Use JIS encoding for Japanese CSV
    });
  }
});
// Helper to upload CSV in chunks sequentially
function uploadCsvChunksSequentially(chunks, index = 0, SHEET_API_URL) {
  if (index >= chunks.length) return;

  const chunk = chunks[index];
  const csvChunk = chunk.map(row =>
    row.map(cell =>
      String(cell)
        .replace(/\u00A0/g, '')
        .replace(/&nbsp;/g, '')
        .replace(/,/g, '、')
    ).join(',')
  ).join(';');
  const script = document.createElement("script");
  const query = `mode=importCsv&callback=uploadChunkCallback&csv=${encodeURIComponent(csvChunk)}`;
  script.src = `${SHEET_API_URL}?${query}`;
  document.body.appendChild(script);

  window.uploadChunkCallback = function(response) {
    console.log(`✅ 청크 ${index + 1} 업로드 완료`, response);
    if (index + 1 === chunks.length) {
      // Last chunk uploaded, remove overlay
      setTimeout(() => {
        const overlay = document.getElementById("uploadOverlay");
        if (overlay) overlay.remove();
      }, 500); // slight delay to ensure write completes
    }
    uploadCsvChunksSequentially(chunks, index + 1, SHEET_API_URL);
  };
}
// ✅ 팝업 닫기 함수
function closePopup() {
  document.getElementById("qrOverlay").style.display = "none";
}

// ✅ 팝업 선택 닫기 함수
function closeSelectPopup() {
  const popup = document.getElementById("customSelectPopup");
  if (popup) popup.style.display = "none";
  // Optionally clear options
  const optionList = document.getElementById("popupOptions");
  if (optionList) optionList.innerHTML = "";
}
  // ✅ 朝食トグルのクリック動作を追加
  const toggleOptions = document.querySelectorAll(".toggle-option");
  toggleOptions.forEach(option => {
    option.addEventListener("click", () => {
      toggleOptions.forEach(o => o.classList.remove("active"));
      option.classList.add("active");
      document.getElementById("breakfastHidden").value = option.dataset.value;
    });
  });

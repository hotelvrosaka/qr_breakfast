function getScriptUrl() {
  // 아래 URL을 배포된 Apps Script 웹 앱 주소로 교체하세요
  return "https://script.google.com/macros/s/AKfycbwRMjixETPUjWHof-vbb4I1s4lf7Cn53HzkmobHgzkgudZrwuNIbMShgrGoDx87OhvDsQ/exec";
}

// NOTE: 아래 YOUR_DEPLOYED_SCRIPT_ID를 실제 Google Apps Script의 배포 ID로 교체하세요!
document.addEventListener("DOMContentLoaded", () => {
  // 시작 날짜에 오늘 날짜 자동 입력
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  document.getElementById("stats-start-date").value = todayStr;

  const searchButton = document.getElementById("stats-search-button");

  searchButton.addEventListener("click", () => {
    const startDate = document.getElementById("stats-start-date").value;
    const endDate = document.getElementById("stats-end-date").value;

    if (!startDate || !endDate) {
      alert("開始日と終了日を選択してください。");
      return;
    }

    // 화면 비활성화 및 로딩 문구 표시
    const overlay = document.createElement("div");
    overlay.id = "loading-overlay";
    overlay.style.position = "fixed";
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(255, 255, 255, 0.7)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";
    overlay.innerHTML = "<div style='font-size: 24px; font-weight: bold;'>検索中...</div>";
    document.body.appendChild(overlay);

    const callback = "handleStatsResponse";
    const scriptUrl = getScriptUrl();
    const query = `?mode=fetchStats&startDate=${startDate}&endDate=${endDate}&callback=${callback}`;

    const script = document.createElement("script");
    script.src = scriptUrl + query;
    document.body.appendChild(script);
  });
});

function handleStatsResponse(response) {
  if (!response.success) {
    alert("データの取得に失敗しました。");
    // 로딩 화면 제거
    const existingOverlay = document.getElementById("loading-overlay");
    if (existingOverlay) existingOverlay.remove();
    return;
  }

  // 로딩 화면 제거
  const existingOverlay = document.getElementById("loading-overlay");
  if (existingOverlay) existingOverlay.remove();

  console.log("✅ 통계 데이터:", response);

  // 전체 방 수 계산
  const totalRoom = response.totalRoom || 0;
  const roomOnlyCount = response.roomOnlyCount || 0;
  const usedBreakfastRoomSet = new Set(response.rows.map(row => row.room));
  const usedBreakfastRoom = usedBreakfastRoomSet.size;
  const unusedBreakfastRoom = totalRoom - usedBreakfastRoom - roomOnlyCount;

  // 퍼센트 계산
  const usedRate = Math.round((usedBreakfastRoom / totalRoom) * 100);
  const unusedRate = Math.round((unusedBreakfastRoom / totalRoom) * 100);
  const roomOnlyRate = Math.round((roomOnlyCount / totalRoom) * 100);

  // 표에 값 표시 (퍼센트 포함)
  document.getElementById("total-room").textContent = `${totalRoom}`;
  document.getElementById("used-breakfast-room").textContent = `${usedBreakfastRoom} (${usedRate}％)`;
  document.getElementById("unused-breakfast-room").textContent = `${unusedBreakfastRoom} (${unusedRate}％)`;
  document.getElementById("room-only-count").textContent = `${roomOnlyCount} (${roomOnlyRate}％)`;

  // 총 이용객 수 계산
  const breakfastGuests = response.breakfastGuests || 0;

  // 날짜 차이 계산 (종료일 - 시작일 + 1일 포함)
  const start = new Date(document.getElementById("stats-start-date").value);
  const end = new Date(document.getElementById("stats-end-date").value);
  const dateDiff = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

  // 일평균 계산
  const guestAvg = Math.round(breakfastGuests / dateDiff);

  // room only 총합 및 평균 계산
  let roomOnlySum = 0;
  for (const rooms of Object.values(response.roomOnly || {})) {
    roomOnlySum += rooms.length;
  }
  const roomOnlyAvg = Math.round(roomOnlySum / dateDiff);

  console.log("🚪 room only 총 방 수:", roomOnlySum);
  console.log("📆 일평균 room only 방 수:", roomOnlyAvg);

  document.getElementById("sum-room-only").textContent = roomOnlySum;
  document.getElementById("avg-room-only").textContent = roomOnlyAvg;
  document.getElementById("sum-guest").textContent = breakfastGuests;
  document.getElementById("avg-guest").textContent = guestAvg;

  // 디버그 로그 출력
  console.log("총 이용객 수:", breakfastGuests);
  console.log("총 일수:", dateDiff);
  console.log("일평균 이용객 수:", guestAvg);

  // 시간대 범위 정의
  const timeRanges = [
    { label: "06:30 ~ 07:00", start: "06:30", end: "07:00", total: 0 },
    { label: "07:00 ~ 07:30", start: "07:00", end: "07:30", total: 0 },
    { label: "07:30 ~ 08:00", start: "07:30", end: "08:00", total: 0 },
    { label: "08:00 ~ 08:30", start: "08:00", end: "08:30", total: 0 },
    { label: "08:30 ~ 09:00", start: "08:30", end: "09:00", total: 0 },
    { label: "09:00 ~ 09:30", start: "09:00", end: "09:30", total: 0 },
    { label: "09:30 ~ 10:00", start: "09:30", end: "10:30", total: 0 }
  ];

  // 시간대별 합계 계산
  response.rows.forEach(row => {
    const fullTimestamp = row.timestamp || ""; // "YYYY-MM-DD HH:MM"
    const time = fullTimestamp.split(" ")[1];
    if (!time) return;

    for (const range of timeRanges) {
      if (time >= range.start && time < range.end) {
        range.total += row.guests;
        break;
      }
    }
  });

  // 시간대별 평균 출력
  console.log("📊 시간대별 통계:");
  timeRanges.forEach(range => {
    const avg = Math.round(range.total / dateDiff);
    console.log(`${range.label} → 총합: ${range.total}명, 일평균: ${avg}명`);
  });

  // 📌 roomOnly 정보 로그 출력
  console.log("🚫 조식 미포함(room only) 방 정보:");
  for (const [date, rooms] of Object.entries(response.roomOnly || {})) {
    console.log(`📅 ${date}: ${rooms.join(", ")}`);
  }

  const timeRangeBody = document.querySelector("#time-range-table tbody");
  timeRangeBody.innerHTML = "";

  timeRanges.forEach(range => {
    const avg = Math.round(range.total / dateDiff);
    const row = document.createElement("tr");

    const timeCell = document.createElement("td");
    timeCell.textContent = range.label;

    const totalCell = document.createElement("td");
    totalCell.textContent = range.total;

    const avgCell = document.createElement("td");
    avgCell.textContent = avg;

    row.appendChild(timeCell);
    row.appendChild(totalCell);
    row.appendChild(avgCell);

    timeRangeBody.appendChild(row);
  });

  const detailsButton = document.getElementById("stats-details-button");
  detailsButton.onclick = () => {
    const wb = XLSX.utils.book_new();

    // 시트1: 朝食
    // Sort rows by timestamp, then by room (natural Japanese order)
    const sortedBreakfastRows = [...response.rows].sort((a, b) => {
      const t1 = new Date(a.timestamp);
      const t2 = new Date(b.timestamp);
      if (t1 - t2 !== 0) return t1 - t2;
      return a.room.localeCompare(b.room, 'ja', { numeric: true });
    });
    const breakfastData = [
      ["時間", "部屋名", "利用者数"],
      ...sortedBreakfastRows.map(row => [row.timestamp, row.room, row.guests])
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(breakfastData);
    XLSX.utils.book_append_sheet(wb, ws1, "朝食");

    // 시트2: Room Only
    const roomOnlyData = [["日付", "部屋名"]];
    for (const [date, rooms] of Object.entries(response.roomOnly || {})) {
      for (const room of rooms) {
        roomOnlyData.push([date, room]);
      }
    }
    const ws2 = XLSX.utils.aoa_to_sheet(roomOnlyData);
    XLSX.utils.book_append_sheet(wb, ws2, "Room Only");

    const startDate = document.getElementById("stats-start-date").value;
    const endDate = document.getElementById("stats-end-date").value;
    const filename = `朝食_統計_${startDate}_to_${endDate}.xlsx`;

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };
}

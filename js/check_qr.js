async function generateHash({ room, checkIn, checkOut, guests, reservation }) {
  const secret = "HOTEL_ONLY_SECRET_KEY";
  const data = `${room},${checkIn},${checkOut},${reservation}`;
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data + secret));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

document.addEventListener("DOMContentLoaded", () => {
  const qrResult = document.getElementById("qrResult");
  const qrRegionId = "preview";
  const html5QrCode = new Html5Qrcode(qrRegionId);

  function onScanSuccess(decodedText, decodedResult) {
    qrResult.value = decodedText;
    html5QrCode.stop().catch(err => console.error("Failed to stop scanner:", err));
  }

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

  const searchButton = document.getElementById("searchButton");
  if (searchButton) {
    searchButton.addEventListener("click", async () => {
      const qrText = qrResult.value.trim();
      if (!qrText) {
        alert("QRコードが読み取られていません。");
        return;
      }

      const parts = qrText.split(',');
      if (parts.length !== 6) {
        alert("QRコードの形式が正しくありません。");
        return;
      }

      const [room, checkIn, checkOut, guests, reservation, hashFromQR] = parts;
      const calculatedHash = await generateHash({ room, checkIn, checkOut, guests, reservation });

      if (calculatedHash !== hashFromQR) {
        alert("❌ QRコードが不正です。");
        return;
      }

      document.getElementById("loadingOverlay").style.display = "flex";

      // ✅ 서버에 예약번호와 해쉬값 검증 요청
      try {
        const scriptUrl = "https://script.google.com/macros/s/AKfycbxwRK1JiiHP8dkZCNI1s1M4Iuy00Rp7Y7WOVgaXEFw0fyE81vDC4LfszmkFfwGduVHH4A/exec";
        const verifyUrl = `${scriptUrl}?callback=handleVerifyResponse&hashcode=${encodeURIComponent(hashFromQR)}&verifyReservation=${encodeURIComponent(reservation)}`;

        const script = document.createElement("script");
        console.log(verifyUrl);
        script.src = verifyUrl;
        document.body.appendChild(script);
      } catch (err) {
        console.error("Verification request failed:", err);
        alert("サーバーとの確認中にエラーが発生しました。");
      }

      html5QrCode.start(
        { facingMode: "user" },
        {
          fps: 10,
          qrbox: function(viewfinderWidth, viewfinderHeight) {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.floor(minEdge * 0.7);
            return { width: boxSize, height: boxSize };
          }
        },
        onScanSuccess
      ).catch(err => {
        console.error("検索後にQRスキャナ再起動エラー:", err);
      });
    });
  }

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
    alert("⚠️QRコードの情報が変更された可能性があります。フロントでご確認ください。⚠️");
  } else if (response.match === true) {
    const breakfastFlag = Number(response.breakfastFlag);
    if (breakfastFlag === 0) {
      alert("Room Onlyの部屋です。");
    } else if (breakfastFlag === 1) {
      alert("朝食付き部屋です。");
    } else {
      alert("✅ QRコードがデータベースと一致しました。");
    }
  } else {
    alert("⚠️QRコードの情報が変更された可能性があります。フロントでご確認ください。");
  }
};
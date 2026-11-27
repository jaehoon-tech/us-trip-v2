// 외부 API 키 (Phase 6에서 리퍼러 제한/재발급 예정)
window.CONFIG = {
  GOOGLE_MAPS_KEY: "AIzaSyCKPPMv6Ml-e04zX3nmynv5adLIuSn-6ck",
  OWM_API_KEY: "fcb8229150958f6b68a1ebea50d964d8",
  // 실시간 공유(Firebase Firestore). 아래 3개를 채우면 켜지고, 비워두면 기존처럼 편집자만 입력해요.
  FIREBASE: { projectId: "us-trip-53d37", apiKey: "AIzaSyBe630nrWdV5iLsBpUzQlZ4vasKgsX2tbM", room: "us4-b3da267340" },
  WEATHER_CITIES: [
    { name: "샌프란시스코", query: "San Francisco,US" },
    { name: "라스베이거스", query: "Las Vegas,US" },
    { name: "그랜드캐니언", query: "Grand Canyon Village,US" },
    { name: "로스앤젤레스", query: "Los Angeles,US" }
  ]
};

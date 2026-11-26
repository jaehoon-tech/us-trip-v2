# 금쪽이들의 세계정복 – 미국 서부 편
빌드 없는 정적 웹앱. GitHub Pages 로 배포합니다.

## 배포 (최초 1회)
1. 이 폴더 전체를 GitHub 저장소(예: `us-trip`)에 올림 (`.nojekyll` 포함)
2. 저장소 Settings → Pages → Branch: `main` / `/ (root)` → Save
3. `https://<아이디>.github.io/us-trip/` 접속 → 폰에서 "홈 화면에 추가"

## 편집 (나만)
- 내 폰에서 주소 뒤에 `?edit=1` 을 붙여 한 번 접속 → 이 기기가 편집자로 등록 (✏️ 버튼 생김)
- ✏️ → 장소/예약/지출 수정 → `⚙️`에서 저장소·토큰 설정 → `🚀 공개` 로 GitHub 에 커밋
- 토큰: GitHub → Settings → Developer settings → Fine-grained tokens → 이 저장소만, Contents: Read and write
- 편집자 해제: `?edit=0`

## 실시간 공유 (Firebase, 선택)
`js/config.js` 의 `FIREBASE` 에 projectId / apiKey / room(우리끼리만 아는 비밀 코드) 을 채우면 켜져요.
지출·장소·준비물을 친구들도 추가하고 서로 바로 보여요. 비워두면 기존처럼 편집자만 입력해요.
- 기기에서 편집자 등록/해제: 상단 파란 배너를 빠르게 5번 탭

## 비공개 정보
출입문 코드/PIN 은 예약 수정 시트의 "🔒 비공개 메모"에 적으면 이 기기에만 저장되고 GitHub 에 올라가지 않습니다.

## 앱 파일을 수정했다면
`sw.js` 맨 위 `VERSION` 숫자를 올리세요 (오프라인 캐시 갱신).

## API 키 보안 (필수)
- Google Cloud Console → 사용자 인증 정보 → 지도 키 → 애플리케이션 제한: 웹사이트 → `https://<아이디>.github.io/*`, `http://localhost:*/*`
- API 제한: Maps JavaScript API, Geocoding API, Places API 만
- OpenWeather 키는 노출되었으니 재발급 후 `js/config.js` 교체 권장

# Figma에서 같은 hex 값인데 색이 칙칙해 보이는 이유 (sRGB vs Display P3)

## 핵심 요약
일러스트에서 뽑은 PNG는 선명한데 Figma에서 같은 hex 값을 넣으면 채도가 낮아 보이는 문제의 원인은 화면이 아니라 "색상 프로필 해석 차이". Figma 새 파일은 기본이 sRGB, 반면 일러스트 PNG는 원본 문서의 P3 계열 프로필이 임베드되어 있어 같은 숫자값도 다르게 렌더링됨.

## 출처
Claude 채팅 세션 "Message translation and editing" (session_id: local_532907c6-9235-44a6-8af5-02959e57e048), 참고: [Manage color profiles in design files – Figma Learn](https://help.figma.com/hc/en-us/articles/360039825114-Manage-color-profiles-in-design-files)

## 상세 내용

### 원인
- Figma 파일은 파일 단위로 색상 프로필이 sRGB 또는 Display P3 중 하나로 지정됨 (새 파일 기본값: sRGB)
- 일러스트에서 내보낸 PNG는 원본 문서의 넓은 색공간(P3 계열) 프로필이 그대로 임베드되어, PNG 뷰어가 그 프로필을 읽고 채도 높게 렌더링
- 즉 hex 숫자는 동일해도 "어떤 색공간으로 해석하느냐"에 따라 실제 보이는 색이 달라짐

### 해결 방법
1. 파일 이름 옆 드롭다운 클릭
2. File color profile > Change to Display P3
3. 모달에서 **Keep color values (Assign)** 선택 — hex/RGB 값은 그대로 두고 해석 방식만 P3로 변경 (Convert를 선택하면 값 자체가 바뀌어버려서 원치 않는 결과가 나오므로 주의)
4. Assign Display P3 클릭

### 주의사항
모니터가 P3를 지원해야 실제로 vivid하게 보임. 지원하지 않는 모니터에서는 sRGB로 클램핑되어 보일 수 있음.

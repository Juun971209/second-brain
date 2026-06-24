# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## 누구인가

- 준형 — Junction(AI 네이티브 브랜드 디자인 에이전시) 운영
- 주요 클라이언트: 롯데카드, 하나투어/디지로카, KANU, 뉴케어, 창원대학교
- 팀: 은지, 지현

## 이 저장소

이 저장소는 "방주" — 준형의 세컨드 브레인이다. (GitHub: `Juun971209/second-brain`)

- 웹앱(`index.html` / `script.js`, GitHub Pages로 배포)과 Chrome 익스텐션(`extension/`)으로 노트를 작성·조회·수정·삭제한다.
- 노트는 마크다운 파일이며, 로컬 git 커밋이 아니라 **GitHub Contents API**를 통해 직접 저장소에 커밋된다. 즉 웹앱/익스텐션에서의 작성·수정·삭제가 로컬 작업 디렉토리와 무관하게 원격에 바로 반영된다.

## 작업 유형 4가지

방주의 폴더는 작업 유형에 따라 나뉜다. 노트를 어디에 적을지, 어떤 톤으로 도와야 할지는 이 구분을 따른다.

| 유형 | 폴더 | 성격 |
| --- | --- | --- |
| 클라이언트 작업 | `clients/` | 수주 프로젝트. 마감·피드백 관리가 중요 |
| 운영 디자인 | `operations/` | Junction 내부 반복 업무 (SNS 콘텐츠, 내부 자료 등). 템플릿화가 중요 |
| 개인 작업물 | `portfolio/` | 포트폴리오, 케이스 스터디, 장기 프로젝트 |
| 스터디 | `study/` | 팀 학습, 발표 자료, 리서치 |

`insights/`, `prompts/`, `logs/`, `templates/`는 위 4가지 작업 유형을 가로지르는 보조 카테고리다 (생각 정리, 프롬프트 모음, 작업 로그, 범용 템플릿).

## 폴더 구조

- `clients/` — 클라이언트별 노트 (예: `hana-tour/`, `lotte-card/`, `cwnu/`)
- `operations/` — 내부 운영 디자인 업무
- `portfolio/` — 개인 작업물 (`kanu/`, `nucare/`, `cwnu/`, `check-in-seoul/`)
- `study/` — 학습 노트
- `insights/` — 인사이트, 생각 정리
- `templates/` — 템플릿
- `prompts/` — 프롬프트 모음
- `logs/` — 작업 로그

카테고리 목록은 `categories.json`이 단일 소스이며, 웹앱 설정 화면에서 추가/삭제/이름변경할 수 있다.

## 세션 시작 시 자동 브리핑 규칙

작업을 시작하기 전에 항상 방주의 관련 노트를 먼저 스캔해서 맥락을 파악한 뒤 브리핑할 것.

- 클라이언트 이름이 언급되면 → `clients/`의 해당 폴더를 스캔하고 최신 노트 기준으로 브리핑
- "운영"이 언급되면 → `operations/`를 스캔하고 브리핑
- "포트폴리오"가 언급되면 → `portfolio/`를 스캔하고 브리핑
- "스터디"가 언급되면 → `study/`를 스캔하고 브리핑

로컬 git 상태가 원격(`origin/main`)보다 뒤처져 있을 수 있으니(웹앱/익스텐션이 API로 직접 커밋하기 때문), 스캔 전 항상 `git fetch`로 최신 상태를 확인할 것.

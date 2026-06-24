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

## 폴더 구조

- `clients/` — 클라이언트별 노트
- `insights/` — 인사이트, 생각 정리
- `templates/` — 템플릿
- `study/` — 학습 노트
- `prompts/` — 프롬프트 모음
- `logs/` — 작업 로그

카테고리 목록은 `categories.json`이 단일 소스이며, 웹앱 설정 화면에서 추가/삭제/이름변경할 수 있다.

## 작업 시작할 때

- 항상 방주의 최신 노트를 먼저 확인해서 맥락을 파악한 뒤 작업을 시작할 것.
- 위 이유로 로컬 git 상태가 원격(`origin/main`)보다 뒤처져 있을 수 있다. 작업 전 `git fetch`로 최신 상태를 확인할 것.

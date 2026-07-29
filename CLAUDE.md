## Approach

- Think before acting. Read existing files before writing code.
- Be concise in output but thorough in reasoning.
- Prefer editing over rewriting whole files.
- Do not re-read files you have already read unless the file may have changed.
- Test your code before declaring done.
- No sycophantic openers or closing fluff.
- Keep solutions simple and direct.
- User instructions always override this file.

# 문구 작성 방법

사이트의 모든 텍스트 문구는 `docs/TEXT_GUIDE.md`를 참고하여 작성해요.

## AI 어시스턴트 참고사항

- 변경 전 반드시 관련 파일을 읽고 기존 패턴을 따라요.
- 새 파일 생성보다 기존 파일 수정을 우선시 해요.
- 한국어 주석과 문서 작성이 기본이예요.
- es-lint, unit 테스트는 반드시 진행해요.
- 보안 민감 정보(API 키 등)는 `.env`에만 저장, 절대 커밋하지 않아요.
- `docs/progress.md`에 개발 진행 상황을 지속적으로 업데이트해요.
- `docs/bug-report.md`에 오류와 오류처리방법을 지속적으로 업데이트해요.
- `docs/`에 포함되어 있는 문서를 지속적으로 업데이트해요.
- 버전 규칙:
  | 변경 | 1.1.0→ |
  |------|--------|
  | 수정 | 1.1.1 |
  | 추가 | 1.2.0 |
  | 구조 | 2.1.0 |
- 타이밍: 명령 후 즉시.

# 개발 이력 기록 (필수)

모든 작업 — 오류 수정, 신규 기능, 기능 개선, 리팩터링 — 을 완료하면 반드시
`docs/DEVELOPMENT_LOG.md`의 "변경 이력" 맨 위에 항목을 추가해요.
형식: `### YYYY-MM-DD — 제목` + 유형 태그(`기능`/`수정`/`개선`/`문서`/`인프라`) + 한두 문장 요약 + 관련 파일.
큰 기능이면 같은 문서의 "기능 현황" 해당 절도 함께 갱신해요.

# 업데이트 로그 작성(필수)

`docs/DEVELOPMENT_LOG.md` 내용을 참고하여 `src/lib/changelog.ts`를 업데이트 해요.
버전 규칙: 신규 기능 = minor(1.1.0), 오류 수정/개선 = patch(1.0.2).
새 배포마다 맨 위에 추가해요 (상세 개발 기록은 docs/DEVELOPMENT_LOG.md).

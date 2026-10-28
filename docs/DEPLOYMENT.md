# 배포 안내

[README로 돌아가기](../README.md)

## 배포할 파일

웹사이트의 게시 디렉터리는 **`dist/`**입니다. `index.html`, 모든 JavaScript·CSS 파일, `vendor/`의 상대 경로를 유지하세요. 별도의 빌드 명령과 환경 변수는 필요하지 않습니다.

```text
배포 루트/
├── index.html
├── app.js
├── style.css
├── physics.js
├── conduction.js
├── temperature-field.js
├── temperature-material.js
├── flow-tracers.js
└── vendor/
    ├── three.module.js
    ├── OrbitControls.js
    └── THREE-LICENSE.txt
```

이 앱은 상대 경로를 사용하므로 저장소 이름이 포함된 하위 경로에서도 사용할 수 있습니다. HTTP(S)로 제공하고 `.js` 파일에 JavaScript MIME 유형이 적용되어야 합니다.

## GitHub Pages

저장소에는 `.github/workflows/pages.yml`이 포함되어 있습니다. 실수로 첫 업로드와 동시에 배포되지 않도록 **수동 실행**으로 구성했습니다. 별도의 `ci.yml`은 push와 pull request에서 자동 테스트를 실행합니다.

1. [GitHub 업로드 안내](GITHUB_UPLOAD.md)에 따라 폴더의 내용 전체를 저장소 루트에 업로드합니다.
2. 저장소의 **Settings → Pages → Build and deployment → Source**에서 **GitHub Actions**를 선택합니다.
3. **Actions → Deploy to GitHub Pages → Run workflow**를 엽니다.
4. 배포할 기본 브랜치(예: `main`)를 선택하고 **Run workflow**를 누릅니다.
5. 성공한 실행의 `github-pages` 환경 링크에서 사이트를 엽니다.

GitHub Actions와 Pages 사용이 허용된 저장소가 필요합니다. 환경의 브랜치 보호 규칙이 있으면 그 규칙이 허용하는 브랜치에서 실행합니다. 워크플로는 다음 순서로 처리합니다.

```text
저장소 가져오기 → Node.js 24 설정 → npm test
→ Pages 설정 → dist/ 업로드 → Pages 배포
```

Pages 설정과 배포에 필요한 권한은 워크플로에 선언되어 있으며 GitHub가 제공하는 토큰을 사용합니다. 별도의 개인 액세스 토큰이나 앱 API 키를 추가할 필요는 없습니다. 설정의 근거는 [GitHub 공식 custom workflow 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)입니다.

### push할 때 자동 배포하려면

Pages 설정을 끝낸 뒤 `pages.yml`의 `on` 부분에 아래 `push` 설정을 추가합니다. 기본 브랜치가 `main`이 아니면 실제 이름으로 바꾸세요.

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

현재 패키지는 자동 배포 설정을 활성화하지 않았습니다.

### Pages에서 문제가 생길 때

| 증상 | 확인 사항 |
| --- | --- |
| 배포 워크플로가 목록에 없음 | `.github/workflows/pages.yml`이 기본 브랜치의 저장소 루트 아래 있는지 확인 |
| Pages 설정 단계 실패 | Source가 GitHub Actions인지, 저장소에서 Pages 사용이 가능한지 확인 |
| 배포 권한·환경 오류 | 워크플로 권한과 `github-pages` 환경의 브랜치 규칙 확인 |
| 배포 전 테스트 실패 | 오류를 해결한 뒤 `npm test` 재실행 |
| 사이트 404 | 실행 완료 여부와 배포 결과에 표시된 URL 확인 |
| HTML만 보이고 3D가 없음 | `.js`·`vendor/` 파일 경로, MIME 유형, WebGL2 지원 확인 |

## 다른 정적 호스팅

이미 마련된 정적 호스팅에서는 다음과 같이 설정합니다.

| 설정 | 값 |
| --- | --- |
| 게시 디렉터리 | `dist` |
| 빌드 명령 | 없음 |
| 시작 페이지 | `index.html` |
| 서버 실행 명령 | 필요 없음 |

업로드 방식이면 `dist/` 안의 내용을 사이트 루트로 옮깁니다. 호스팅 설정에서 게시 디렉터리를 고르는 방식이면 프로젝트 루트를 연결하고 `dist`를 지정합니다. README·문서·테스트·로컬 서버를 사이트 루트에 공개할 필요는 없습니다.

## 배포 후 확인

네 실험 탭, 일반/열화상 전환, 열원 이동, 탐구 노트 기록·다운로드를 확인합니다. 배포 주소는 로컬 주소와 다르므로 기존 로컬 노트가 자동 이동하지 않습니다. 필요한 기록은 기존 주소에서 미리 내려받으세요.

이 안내와 워크플로 파일을 준비하는 과정에서 실제 GitHub 저장소 생성·업로드·Pages 게시를 수행한 것은 아닙니다. 로컬 검사 범위는 [검증 기록](VALIDATION.md)에 있습니다.

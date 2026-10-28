# GitHub 업로드 안내

[README로 돌아가기](../README.md)

## 업로드 폴더

`github-upload` 폴더가 저장소에 올릴 완성본입니다. **폴더 안의 내용 전체를 저장소 루트에** 넣으세요. 저장소 안에 `github-upload/README.md`로 한 겹 더 들어가면 첫 화면의 README와 워크플로 위치가 달라집니다.

포함한 항목은 실행 파일 `dist/`, 테스트, 로컬 서버, npm 실행 설정, README, 문서·이미지, 외부 라이브러리 라이선스, Git 설정 파일, GitHub Actions 워크플로입니다.

원본의 `.git/` 이력과 `.openai/` 호스팅 식별 정보는 포함하지 않았습니다. 실행 코드와 외부 라이브러리는 원본에서 복사했으며, README의 예시 이미지만 `docs/images/`에 정리했습니다.

## 방법 1: Git으로 올리기

1. GitHub에서 새 빈 저장소를 만듭니다. 이름은 예를 들어 `ongi-heat-lab`로 정할 수 있습니다.
2. 새 저장소를 만들 때 README·라이선스·`.gitignore` 자동 추가는 선택하지 않습니다.
3. `github-upload` 폴더에서 터미널을 열고 다음 명령을 실행합니다.

```sh
git init
git add .
git status --short
git commit -m "Add Ongi Heat Lab and documentation"
git branch -M main
```

다음 명령의 `YOUR_ACCOUNT`와 `YOUR_REPOSITORY`를 실제 계정·저장소 이름으로 바꾼 뒤 실행합니다.

```sh
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

`git add .`은 `.github/`, `.gitignore`, `.gitattributes`도 함께 추가합니다. 이미 README나 커밋이 있는 원격 저장소를 사용한다면 그 저장소를 먼저 clone한 뒤 내용물을 복사해 커밋하세요. 기존 이력을 덮어쓰는 강제 push는 필요하지 않습니다.

## 방법 2: GitHub 웹에서 올리기

1. 새 저장소를 만들거나 업로드할 저장소를 엽니다.
2. **Add file → Upload files**를 선택합니다. 빈 저장소에서는 **uploading an existing file** 링크를 사용할 수 있습니다.
3. `github-upload` 안의 파일과 폴더를 업로드 영역에 넣습니다.
4. 파일 목록에서 루트의 `README.md`, `package.json`, `dist/`, `docs/`, `tests/`를 확인합니다.
5. 숨김 항목인 `.github/`, `.gitignore`, `.gitattributes`가 들어갔는지 확인한 뒤 커밋합니다.

탐색기에서 점으로 시작하는 파일이나 폴더가 선택되지 않았다면 별도로 추가하세요. `.github/workflows/ci.yml`과 `.github/workflows/pages.yml`이 빠지면 자동 검사·수동 배포가 나타나지 않습니다.

## 업로드 전 확인

- [ ] `npm test`가 통과합니다.
- [ ] `npm start`로 실행한 뒤 브라우저에서 화면이 열립니다.
- [ ] `dist/vendor/`와 라이선스 원문이 포함되어 있습니다.
- [ ] `.github/workflows/`와 두 Git 설정 파일이 포함되어 있습니다.
- [ ] README의 문서 링크·이미지가 저장소 안의 상대 경로로 연결됩니다.
- [ ] 저장소의 공개 범위를 원하는 값으로 설정했습니다.
- [ ] 필요하면 소유자가 프로젝트 자체의 라이선스를 정해 `LICENSE`를 추가했습니다.

마지막 라이선스 항목은 재사용 조건을 선택하려는 경우를 위한 것입니다. 제공된 Three.js의 MIT 라이선스를 프로젝트 전체의 라이선스로 자동 적용하지 않았습니다.

## 업로드 후 확인

저장소 첫 화면에 README와 두 이미지가 표시되는지 확인하고, **Actions**에서 테스트 결과를 확인합니다. 사이트도 공개하려면 [배포 안내](DEPLOYMENT.md)를 따라 Pages를 설정한 뒤 수동 배포를 실행하세요.

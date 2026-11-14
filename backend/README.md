# Backend

## 실행

프로젝트 루트에서 가상환경을 활성화한 뒤 의존성을 설치합니다.

```bash
pip install -r requirements.txt
python backend/app.py
```

개발 서버 기본 주소는 `http://127.0.0.1:5000`입니다. 설정은 프로젝트 루트의 `.env`에서 읽습니다.

## 공통 응답

성공:

```json
{"success": true, "data": {}}
```

실패:

```json
{"success": false, "error": {"code": "ERROR_CODE", "message": "설명"}}
```

인증이 필요한 API는 Flask 세션 쿠키를 사용합니다. 프론트엔드 요청에는 `credentials: "include"`를 지정해야 합니다.

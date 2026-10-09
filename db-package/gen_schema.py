"""
models.py 의 SQLAlchemy 모델에서 실제 CREATE TABLE SQL 을 뽑아 docs/schema.sql 로 저장.

    cd backend && python gen_schema.py

스키마의 소스 오브 트루스는 models.py 입니다. 이 스크립트는 설계 문서/코드 리뷰용
참고본을 만들 뿐이며, 모델을 수정했다면 다시 실행해서 schema.sql 을 갱신하세요.
"""
import os

from sqlalchemy.dialects import sqlite
from sqlalchemy.schema import CreateTable, CreateIndex

from app import create_app
from config import TestConfig
from extensions import db
import models  # noqa: F401  (모델 클래스가 metadata 에 등록되도록 import)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "schema.sql")


def main():
    app = create_app(TestConfig, start_scheduler=False)
    with app.app_context():
        lines = [
            "-- 물품 대여 서비스 데이터베이스 스키마 (SQLite)",
            "-- backend/models.py 의 SQLAlchemy 모델에서 자동 생성됨 (python backend/gen_schema.py)",
            "-- 스키마의 소스 오브 트루스는 models.py 이며, 이 파일은 설계 문서/리뷰용 참고본입니다.",
            "",
            "PRAGMA foreign_keys = ON;",
            "",
        ]
        for table in db.metadata.sorted_tables:  # FK 의존 순서대로 정렬됨
            lines.append(str(CreateTable(table).compile(dialect=sqlite.dialect())).strip() + ";")
            for idx in sorted(table.indexes, key=lambda i: i.name):
                lines.append(str(CreateIndex(idx).compile(dialect=sqlite.dialect())).strip() + ";")
            lines.append("")

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"schema.sql 생성 완료: {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()

-- 물품 대여 서비스 데이터베이스 스키마 (SQLite)
-- backend/models.py 의 SQLAlchemy 모델에서 자동 생성됨 (python backend/gen_schema.py)
-- 스키마의 소스 오브 트루스는 models.py 이며, 이 파일은 설계 문서/리뷰용 참고본입니다.

PRAGMA foreign_keys = ON;

CREATE TABLE items (
	id INTEGER NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	category VARCHAR(50) NOT NULL, 
	description TEXT, 
	rfid_uid VARCHAR(32), 
	status VARCHAR(20) NOT NULL, 
	default_loan_days INTEGER NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id)
);
CREATE UNIQUE INDEX ix_items_rfid_uid ON items (rfid_uid);

CREATE TABLE users (
	student_id VARCHAR(20) NOT NULL, 
	name VARCHAR(50) NOT NULL, 
	email VARCHAR(120) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	role VARCHAR(10) NOT NULL, 
	is_overdue BOOLEAN NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (student_id)
);
CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE reservations (
	id INTEGER NOT NULL, 
	item_id INTEGER NOT NULL, 
	student_id VARCHAR(20) NOT NULL, 
	reserved_at DATETIME, 
	pickup_deadline DATETIME NOT NULL, 
	desired_loan_days INTEGER NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(item_id) REFERENCES items (id), 
	FOREIGN KEY(student_id) REFERENCES users (student_id)
);
CREATE UNIQUE INDEX uq_one_pending_reservation_per_item ON reservations (item_id) WHERE status = 'pending';

CREATE TABLE pending_confirmations (
	id INTEGER NOT NULL, 
	item_id INTEGER NOT NULL, 
	reservation_id INTEGER NOT NULL, 
	student_id VARCHAR(20) NOT NULL, 
	scanned_at DATETIME, 
	expires_at DATETIME NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(item_id) REFERENCES items (id), 
	FOREIGN KEY(reservation_id) REFERENCES reservations (id), 
	FOREIGN KEY(student_id) REFERENCES users (student_id)
);

CREATE TABLE rentals (
	id INTEGER NOT NULL, 
	reservation_id INTEGER NOT NULL, 
	item_id INTEGER NOT NULL, 
	student_id VARCHAR(20) NOT NULL, 
	rent_date DATETIME, 
	due_date DATETIME NOT NULL, 
	return_date DATETIME, 
	status VARCHAR(20) NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (reservation_id), 
	FOREIGN KEY(reservation_id) REFERENCES reservations (id), 
	FOREIGN KEY(item_id) REFERENCES items (id), 
	FOREIGN KEY(student_id) REFERENCES users (student_id)
);

CREATE TABLE overdue_notifications (
	id INTEGER NOT NULL, 
	rental_id INTEGER NOT NULL, 
	sent_at DATETIME, 
	channel VARCHAR(20), 
	PRIMARY KEY (id), 
	FOREIGN KEY(rental_id) REFERENCES rentals (id)
);

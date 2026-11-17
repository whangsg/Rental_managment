/*
  =====================================================================
   물품대여 서비스 - ESP32 RFID 키오스크 펌웨어 (부저 전용 버전)
  =====================================================================

  LED 없이 부저 하나만으로 결과를 알려주는 버전입니다.
  LED/저항을 구하면 원래 버전(esp32_rfid_kiosk.ino)을 쓰면 됩니다.

  역할:
    1. RC522로 RFID 태그의 UID를 읽는다.
    2. Wi-Fi로 Flask 서버에 HTTP POST /api/scan 을 보낸다.  (body: {"uid":"..."})
    3. 서버가 돌려준 result 코드에 따라 부저 소리로 사용자에게 알려준다.

  ESP32는 UID가 무슨 의미인지 모릅니다. "읽어서 보내고, 응답 보고 소리 내기"만 합니다.
  대여/반납/예약 판단은 전부 서버(Flask)가 합니다.

  ---------------------------------------------------------------------
  배선
  ---------------------------------------------------------------------
    RC522 SDA(SS)  -> GPIO 5
    RC522 SCK      -> GPIO 18
    RC522 MOSI     -> GPIO 23
    RC522 MISO     -> GPIO 19
    RC522 RST      -> GPIO 22
    RC522 GND      -> GND
    RC522 3.3V     -> 3.3V   (절대 5V 아님)
    RC522 IRQ      -> 연결 안 함

    수동 부저 (+) -> GPIO 27,  (-) -> GND
    (3핀 부저 모듈이면: S -> GPIO 27, + -> 3.3V, - -> GND)

  ---------------------------------------------------------------------
  서버 result 코드 -> 소리 (모두 서로 다르게 들리도록 만듦)
  ---------------------------------------------------------------------
    WAIT_CONFIRM  웹에서 본인확인하세요     음이 올라가는 "띠-리-링" (3음)
    RETURN_OK     반납 완료                 중간 높이의 긴 "삐-" 한 번
    REGISTERED    관리자 태그 등록 완료     높은 "삑삑" 두 번
    UNKNOWN_TAG   등록 안 된 태그           낮은 "붕붕붕" 세 번
    ERROR         예약 없음 / 기타 오류     아주 낮은 긴 "부-"
    NETWORK_FAIL  서버 응답 없음            아주 짧고 빠른 "삐삐삐삐삐" 다섯 번
    (시작할 때)   Wi-Fi 연결 성공           "삑삑" 두 번 (작은 소리)

  ---------------------------------------------------------------------
  준비 (Arduino IDE)
  ---------------------------------------------------------------------
    - 보드: "ESP32 Dev Module"
    - 라이브러리: "MFRC522" (GithubCommunity), "ArduinoJson" (Benoit Blanchon)
    - 아래 WIFI_SSID / WIFI_PASSWORD / SERVER_URL / DEVICE_KEY 를 본인 환경에 맞게 수정
    - 컴파일 에러 "'tone' was not declared" 가 나면 보드 매니저에서 esp32 를 3.x 로 업데이트
*/

#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ======================= 사용자 설정 (여기만 바꾸면 됨) =======================
//와이파이는 2.4인지도 확인.
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Flask 서버 주소. 노트북의 로컬 IP (예: 192.168.0.15). 포트는 run.py 의 5000. 포트는 무조건 5000으로 설정
const char* SERVER_URL    = "http://192.168.0.15:5000/api/scan";

// backend/config.py 의 DEVICE_API_KEY 와 같은 값이어야 함
const char* DEVICE_KEY    = "esp32-dev-key-change-me";
// ==========================================================================

#define SS_PIN     5
#define RST_PIN    22
#define BUZZER     27

MFRC522 rfid(SS_PIN, RST_PIN);

// String 대신 고정 크기 char 배열을 사용 (메모리 단편화 방지)
#define UID_BUF_LEN    21   // UID 최대 10바이트 -> 16진수 20자 + 널문자
#define BODY_BUF_LEN   50   // {"uid":"<최대 20자>"} = 최대 31자
#define RESULT_BUF_LEN 24   // "WAIT_CONFIRM" 등 (가장 긴 코드 12자)
char lastUid[UID_BUF_LEN] = "";
unsigned long lastScanMs = 0;
const unsigned long SAME_TAG_COOLDOWN_MS = 3000;  // 같은 태그를 3초 안에 다시 읽으면 무시(중복 전송 방지)


// ------------------------------------------------------------------ 소리 피드백
// freq: 음 높이(Hz), ms: 길이, gap: 소리 뒤 쉬는 시간
void beep(int freq, int ms, int gap = 60) {
  tone(BUZZER, freq, ms);
  delay(ms + gap);
}

void feedbackWaitConfirm() { beep(1500, 110); beep(2000, 110); beep(2600, 220); }       // 올라가는 3음
void feedbackReturnOk()    { beep(2000, 500); }                                          // 중간 높이 긴 소리
void feedbackRegistered()  { beep(2800, 100); beep(2800, 100); }                         // 높은 두 번
void feedbackUnknownTag()  { beep(700, 150); beep(700, 150); beep(700, 150); }           // 낮은 세 번
void feedbackError()       { beep(400, 800); }                                           // 아주 낮은 긴 소리
void feedbackNetworkFail() { for (int i = 0; i < 5; i++) beep(1200, 50, 50); }           // 짧고 빠른 다섯 번
void feedbackWifiOk()      { beep(2200, 70); beep(2200, 70); }                           // 시작 시 연결 성공
void feedbackFound()       { beep(1800, 120); beep(2400, 250); }                         // 등록된 태그: 경쾌한 두 음


// ------------------------------------------------------------------ Wi-Fi
bool connectWiFi() {
  Serial.printf("Wi-Fi 연결 중: %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(300);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n✅ 연결됨. ESP32 IP: %s\n", WiFi.localIP().toString().c_str());
    feedbackWifiOk();
  } else {
    Serial.println("\n⚠ Wi-Fi 연결 실패. SSID/비밀번호 확인 (2.4GHz 인지도 확인).");
    feedbackNetworkFail();
  }
  return WiFi.status() == WL_CONNECTED;
}

// Wi-Fi 상태 감시 (loop 에서 매번 호출, 오래 멈추지 않음)
//  - 끊겨 있으면 10초마다 재연결 시도
//  - 연결이 새로 성립/끊기는 순간 한 번만 안내
bool wifiWasUp = false;
unsigned long lastWifiTryMs = 0;
const unsigned long WIFI_RETRY_MS = 10000;

void maintainWiFi() {
  bool up = (WiFi.status() == WL_CONNECTED);

  if (up && !wifiWasUp) {
    Serial.printf("✅ Wi-Fi 연결됨. ESP32 IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.println("=== 준비 완료. 태그를 대주세요 ===");
    feedbackWifiOk();
  } else if (!up && wifiWasUp) {
    Serial.println("⚠ Wi-Fi 끊김. 재연결을 시도합니다.");
  }
  wifiWasUp = up;

  if (!up && millis() - lastWifiTryMs >= WIFI_RETRY_MS) {
    lastWifiTryMs = millis();
    Serial.println("Wi-Fi 재연결 시도...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}


// ------------------------------------------------------------------ 서버 전송
// 서버의 result 문자열을 result 버퍼에 채워 준다. (통신 실패 시 "NETWORK_FAIL")
void sendUidToServer(const char* uid, char* result, size_t resultLen) {
  strlcpy(result, "NETWORK_FAIL", resultLen);

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠ Wi-Fi 미연결 -> 서버 전송 생략");
    return;   // result 는 이미 "NETWORK_FAIL"
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  http.setTimeout(5000);

  char body[BODY_BUF_LEN];
  snprintf(body, sizeof(body), "{\"uid\":\"%s\"}", uid);
  int code = http.POST((uint8_t*)body, strlen(body));   // String 변환 없이 바이트로 전송

  if (code > 0) {
    // 서버는 409/404 같은 코드도 JSON body 에 result 를 넣어 보내므로 코드와 무관하게 파싱
    // (응답을 String 으로 받지 않고 스트림에서 바로 파싱)
    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, http.getStream());
    const char* r = doc["result"];
    Serial.printf("HTTP %d, result=%s, message=%s\n", code, r ? r : "(없음)", doc["message"] | "");

    if (err == DeserializationError::Ok && r) strlcpy(result, r, resultLen);
    else                                      strlcpy(result, "ERROR", resultLen);
  } else {
    Serial.printf("HTTP 요청 실패: %s\n", http.errorToString(code).c_str());
  }
  http.end();
}


// ------------------------------------------------------------------ setup / loop
void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(BUZZER, OUTPUT);

  SPI.begin();
  rfid.PCD_Init();
  delay(50);

  byte version = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  if (version == 0x00 || version == 0xFF) {
    Serial.println("⚠ RC522 를 찾을 수 없습니다. 배선을 확인하세요.");
    feedbackError();
  } else {
    Serial.printf("✅ RC522 OK (version 0x%02X)\n", version);
  }

  wifiWasUp = connectWiFi();
  lastWifiTryMs = millis();
  if (wifiWasUp) {
    Serial.println("=== 준비 완료. 태그를 대주세요 ===");
  } else {
    Serial.println("=== Wi-Fi 미연결: 대기 모드 ===");
    Serial.println("10초마다 재연결을 시도합니다. 태그는 읽지만 서버 전송은 실패(삐 5번) 처리됩니다.");
  }
}

void loop() {
  maintainWiFi();

  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  // UID -> 대문자 16진수 문자열
  char uid[UID_BUF_LEN] = "";
  size_t n = 0;
  for (byte i = 0; i < rfid.uid.size && n + 2 < UID_BUF_LEN; i++) {
    n += snprintf(uid + n, UID_BUF_LEN - n, "%02X", rfid.uid.uidByte[i]);   // 항상 2자리 대문자
  }
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  // 같은 태그를 짧은 시간 안에 반복 인식하면 무시 (한 번 대고 있는 동안 여러 번 전송되는 것 방지)
  if (strcmp(uid, lastUid) == 0 && millis() - lastScanMs < SAME_TAG_COOLDOWN_MS) return;
  strlcpy(lastUid, uid, sizeof(lastUid));
  lastScanMs = millis();

  Serial.printf("\n태그 인식: %s -> 서버 전송\n", uid);
  char result[RESULT_BUF_LEN];
  sendUidToServer(uid, result, sizeof(result));
  Serial.printf("결과: %s\n", result);

  if      (strcmp(result, "FOUND") == 0)        feedbackFound();
  else if (strcmp(result, "WAIT_CONFIRM") == 0) feedbackWaitConfirm();
  else if (strcmp(result, "RETURN_OK") == 0)    feedbackReturnOk();
  else if (strcmp(result, "REGISTERED") == 0)   feedbackRegistered();
  else if (strcmp(result, "UNKNOWN_TAG") == 0)  feedbackUnknownTag();
  else if (strcmp(result, "NETWORK_FAIL") == 0) feedbackNetworkFail();
  else                               feedbackError();
}

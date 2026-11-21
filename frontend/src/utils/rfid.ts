// RFID UID 규칙 (backend/routes/items.py, device.py 와 같은 규칙)
// - 16진수(0~9, A~F)만, 2자리씩 4~10바이트 → 8~20자리 짝수 길이
// - 저장은 대문자. 리더기(펌웨어)도 대문자 16진수로 보낸다.
export const RFID_UID_PATTERN = /^(?:[0-9A-F]{2}){4,10}$/;

export const RFID_UID_RULE_MESSAGE =
  "RFID UID는 16진수 문자(A~F, 0~9)로 구성된 8~20자리 문자열이어야 하며, 공백이나 특수문자는 사용할 수 없습니다.";

// 입력 편의: 소문자는 대문자로, NFC 앱이 붙이는 공백·콜론·하이픈은 뺀다. ("ab:31:27:ca" → "AB3127CA")
export function normalizeRfidUid(value: string) {
  return value.replace(/[\s:-]/g, "").toUpperCase();
}

// 비어 있으면 통과(태그 미지정), 값이 있으면 규칙 검사
export function isValidRfidUid(value: string) {
  return value === "" || RFID_UID_PATTERN.test(value);
}

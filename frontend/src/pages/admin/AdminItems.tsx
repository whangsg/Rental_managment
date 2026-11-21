import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api, type Item, type ItemInput } from "../../api";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import Icon from "../../components/Icon";
import { errorMessage } from "../../utils/format";
import { isValidRfidUid, normalizeRfidUid, RFID_UID_RULE_MESSAGE } from "../../utils/rfid";
import { LoadState, PageHeader } from "./common";

type Form = { name: string; category: string; description: string; rfid_uid: string; default_loan_days: string };
const emptyForm: Form = { name: "", category: "", description: "", rfid_uid: "", default_loan_days: "14" };

// 물품 관리: 목록, 등록, 수정(RFID 태그 재지정 포함), 삭제 (backend/routes/items.py 구현 완료)
export default function AdminItems() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    setError("");
    api.items
      .list()
      .then(setItems)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(load, [load]);

  const categories = useMemo(() => [...new Set((items ?? []).map((i) => i.category))], [items]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter(
      (i) => !q || i.name.toLowerCase().includes(q) || (i.rfid_uid ?? "").toLowerCase().includes(q) || i.category.toLowerCase().includes(q),
    );
  }, [items, query]);

  const done = (text: string) => {
    setEditing(null);
    setDeleting(null);
    setNotice(text);
    load();
  };

  return (
    <>
      <PageHeader
        title="물품 관리"
        desc="물품을 등록·수정하고 RFID 태그를 지정합니다."
        action={
          <Button onClick={() => setEditing("new")}>
            <Icon name="plus" size={18} />
            물품 등록
          </Button>
        }
      />

      {notice && (
        <div className="page-notice page-notice-success mb-4" role="status">
          <p>{notice}</p>
          <button type="button" className="icon-button h-7 w-7" aria-label="알림 닫기" onClick={() => setNotice("")}>
            <Icon name="plus" size={16} className="rotate-45" />
          </button>
        </div>
      )}

      <label className="search-box mb-4 max-w-[320px] bg-white">
        <Icon name="search" size={18} />
        <span className="sr-only">물품 검색</span>
        <input type="search" placeholder="이름, 카테고리, RFID UID 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      {!items ? (
        <LoadState error={error} onRetry={load} />
      ) : (
        <div className="panel table-box">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>물품</th>
                <th>카테고리</th>
                <th>RFID UID</th>
                <th>기본 대여</th>
                <th>상태</th>
                <th>
                  <span className="sr-only">관리</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((i) => (
                <tr key={i.id}>
                  <td>{i.id}</td>
                  <td className="font-semibold">{i.name}</td>
                  <td>{i.category}</td>
                  <td className="font-mono text-xs">{i.rfid_uid || <span className="text-[#a0aaa6]">미지정</span>}</td>
                  <td>{i.default_loan_days}일</td>
                  <td>
                    <Badge status={i.status} />
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <button type="button" className="text-button" onClick={() => setEditing(i)}>
                      수정
                    </button>
                    <button type="button" className="text-button ml-2 text-[#b84343]" onClick={() => setDeleting(i)}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#65716c]">
                    조건에 맞는 물품이 없어요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ItemFormModal
          item={editing === "new" ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(it, isNew) => done(isNew ? `'${it.name}'을(를) 등록했어요.` : `'${it.name}'을(를) 수정했어요.`)}
        />
      )}
      {deleting && <DeleteModal item={deleting} onClose={() => setDeleting(null)} onDeleted={() => done(`'${deleting.name}'을(를) 삭제했어요.`)} />}
    </>
  );
}

function ItemFormModal({
  item,
  categories,
  onClose,
  onSaved,
}: {
  item: Item | null;
  categories: string[];
  onClose: () => void;
  onSaved: (item: Item, isNew: boolean) => void;
}) {
  const [form, setForm] = useState<Form>(
    item
      ? {
          name: item.name,
          category: item.category,
          description: item.description ?? "",
          rfid_uid: item.rfid_uid ?? "",
          default_loan_days: String(item.default_loan_days),
        }
      : emptyForm,
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const days = Number(form.default_loan_days);
    // 백엔드 검증과 같은 규칙으로 먼저 확인
    if (!form.name.trim()) return setError("물품명은 필수입니다.");
    if (!form.category.trim()) return setError("카테고리를 선택해주세요.");
    if (form.name.trim().length > 100) return setError("물품명은 100자 이하여야 합니다.");
    if (form.category.trim().length > 50) return setError("카테고리는 50자 이하여야 합니다.");
    if (!isValidRfidUid(form.rfid_uid)) return setError(RFID_UID_RULE_MESSAGE);
    if (!Number.isInteger(days) || days < 1) return setError("기본 대여 일수는 1 이상의 정수여야 합니다.");

    const data: ItemInput = {
      name: form.name.trim(),
      category: form.category.trim(),
      description: form.description,
      rfid_uid: form.rfid_uid || null, // 입력할 때 이미 대문자·구분자 제거됨
      default_loan_days: days,
    };
    setSaving(true);
    try {
      const saved = item ? await api.items.update(item.id, data) : await api.items.create(data);
      onSaved(saved, !item);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop modal-center">
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="item-form-title" onSubmit={submit} noValidate>
        <h2 id="item-form-title" className="text-lg font-bold">
          {item ? "물품 수정" : "물품 등록"}
        </h2>
        <label className="field">
          <span>물품명 *</span>
          <input value={form.name} onChange={set("name")} maxLength={100} autoFocus />
        </label>
        <CategoryPicker
          categories={categories}
          value={form.category}
          onChange={(c) => {
            setForm((f) => ({ ...f, category: c }));
            setError(""); // "카테고리를 선택해주세요" 같은 이전 에러를 지운다
          }}
        />
        <label className="field">
          <span>설명</span>
          <input value={form.description} onChange={set("description")} />
        </label>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <label className="field">
            <span>RFID UID</span>
            <input
              value={form.rfid_uid}
              onChange={(e) => setForm((f) => ({ ...f, rfid_uid: normalizeRfidUid(e.target.value) }))}
              placeholder="예: AB3127CA"
              maxLength={40}
              className="font-mono"
              aria-invalid={!isValidRfidUid(form.rfid_uid)}
              aria-describedby="rfid-help"
            />
          </label>
          <label className="field">
            <span>기본 대여 일수</span>
            <input type="number" min={1} value={form.default_loan_days} onChange={set("default_loan_days")} />
          </label>
        </div>
        <p id="rfid-help" className={`-mt-2 text-xs ${isValidRfidUid(form.rfid_uid) ? "text-[#84908b]" : "font-semibold text-[#b84343]"}`}>
          {isValidRfidUid(form.rfid_uid)
            ? "16진수(0~9, A~F) 8~20자리."
            : /[^0-9A-F]/.test(form.rfid_uid)
              ? "0~9, A~F만 쓸 수 있어요."
              : `8~20자리(짝수)여야 해요. 지금 ${form.rfid_uid.length}자리예요.`}
        </p>
        {!form.rfid_uid && (
          <p className="notice notice-muted text-xs">
            RFID UID를 비우면 "태그 미지정"으로 등록돼요. 태그를 지정해야 리더기로 대여·반납할 수 있으니, 나중에 꼭 수정해주세요.
          </p>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            닫기
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "저장 중..." : item ? "수정하기" : "등록하기"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// 카테고리 선택: 드롭다운에서 기존 카테고리를 고르거나, 맨 아래 "새 카테고리 직접 입력"으로 추가해 고른다.
// (브라우저 기본 <select> 는 목록이 입력칸 바로 아래에 뜬다. <datalist> 는 화면 배율에 따라 엉뚱한 곳에 떠서 쓰지 않음)
const NEW_CATEGORY = "__new__";

function CategoryPicker({ categories, value, onChange }: { categories: string[]; value: string; onChange: (c: string) => void }) {
  // 이 창에서 새로 추가한 카테고리 (그 카테고리로 물품을 저장하면 다음부터 목록에 나온다)
  const [added, setAdded] = useState<string[]>(() => (value && !categories.includes(value) ? [value] : []));
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const list = [...categories, ...added];

  const add = () => {
    const c = draft.trim();
    if (!c) return setError("카테고리 이름을 입력해주세요.");
    if (c.length > 50) return setError("카테고리는 50자 이하여야 합니다.");
    if (!list.includes(c)) setAdded((a) => [...a, c]); // 이미 있으면 그걸 고른다
    onChange(c);
    cancel();
  };

  const cancel = () => {
    setAdding(false);
    setDraft("");
    setError("");
  };

  return (
    <div className="field">
      <label htmlFor="category-select">
        <span className="field-label">카테고리 *</span>
      </label>
      <select
        id="category-select"
        value={adding ? NEW_CATEGORY : value}
        data-empty={!value && !adding}
        onChange={(e) => {
          if (e.target.value === NEW_CATEGORY) setAdding(true);
          else {
            cancel();
            onChange(e.target.value);
          }
        }}
      >
        <option value="" disabled>
          카테고리를 선택하세요
        </option>
        {list.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={NEW_CATEGORY}>+ 새 카테고리 직접 입력</option>
      </select>

      {adding && (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault(); // 폼 전체가 제출되지 않게
                  add();
                }
                if (e.key === "Escape") cancel();
              }}
              placeholder="새 카테고리 이름"
              aria-label="새 카테고리 이름"
              maxLength={50}
              autoFocus
              className="min-w-0 flex-1"
            />
            <Button className="min-h-[47px]" onClick={add}>
              추가
            </Button>
            <Button variant="secondary" className="min-h-[47px]" onClick={cancel}>
              취소
            </Button>
          </div>
          {error && <p className="text-xs font-semibold text-[#b84343]">{error}</p>}
        </div>
      )}
    </div>
  );
}

function DeleteModal({ item, onClose, onDeleted }: { item: Item; onClose: () => void; onDeleted: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await api.items.remove(item.id);
      onDeleted();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop modal-center">
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
        <h2 id="delete-title" className="text-lg font-bold">
          '{item.name}'을(를) 삭제할까요?
        </h2>
        <p className="text-sm text-[#65716c]">삭제하면 되돌릴 수 없어요. 예약이나 대여 이력이 있는 물품은 삭제할 수 없어요.</p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            닫기
          </Button>
          <Button variant="danger" onClick={remove} disabled={busy}>
            {busy ? "삭제 중..." : "삭제"}
          </Button>
        </div>
      </div>
    </div>
  );
}

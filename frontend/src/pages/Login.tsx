import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api";
import { useAuth } from "../auth/AuthContext";
import Button from "../components/Button";
import Logo from "../components/Logo";

type Mode = "login" | "signup";

function Field(props: { label: string; name: string; type?: string; placeholder: string; value: string; onChange: (v: string) => void; autoComplete?: string }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        placeholder={props.placeholder}
        value={props.value}
        autoComplete={props.autoComplete}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

// 백엔드 에러 메시지를 그대로 보여주되, 서버에 연결하지 못한 경우는 따로 안내한다.
function errorMessage(e: unknown) {
  if (e instanceof ApiError) return e.message;
  return "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.";
}

export default function Login() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("");
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 이미 로그인되어 있으면 로그인 화면을 보여줄 필요가 없다.
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/items"} replace />;

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setNotice("");
  };

  const goAfterLogin = (role: string) => navigate(from ?? (role === "admin" ? "/admin" : "/items"), { replace: true });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    // 서버에 보내기 전 간단한 확인 (최종 검증은 백엔드가 한다)
    if (mode === "login") {
      if (!identifier.trim() || !password) return setError("이메일(또는 학번)과 비밀번호를 입력해주세요.");
    } else {
      if (!studentId.trim() || !name.trim() || !email.trim() || !password) return setError("모든 항목을 입력해주세요.");
      if (!email.includes("@")) return setError("올바른 이메일 주소를 입력해주세요.");
      if (password.length < 8) return setError("비밀번호는 8자 이상이어야 합니다.");
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        const u = await login(identifier, password);
        goAfterLogin(u.role);
      } else {
        await register({ student_id: studentId.trim(), name: name.trim(), email: email.trim(), password });
        // 가입이 끝나면 같은 정보로 바로 로그인한다.
        try {
          const u = await login(email, password);
          goAfterLogin(u.role);
        } catch {
          setIdentifier(email);
          switchMode("login");
          setNotice("가입되었습니다. 로그인해주세요.");
        }
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mobile-shell">
      <div className="auth-screen">
        <div className="auth-brand">
          <Logo />
          <p>
            필요한 학교 물품을
            <br />
            간편하게 예약하고 빌려보세요
          </p>
        </div>

        <div className="segmented auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>
            로그인
          </button>
          <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>
            회원가입
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          {mode === "login" ? (
            <Field label="이메일 또는 학번" name="identifier" placeholder="school@email.com" value={identifier} onChange={setIdentifier} autoComplete="username" />
          ) : (
            <>
              <Field label="학번" name="student_id" placeholder="학번을 입력해주세요" value={studentId} onChange={setStudentId} />
              <Field label="이름" name="name" placeholder="이름을 입력해주세요" value={name} onChange={setName} autoComplete="name" />
              <Field label="이메일" name="email" type="email" placeholder="school@email.com" value={email} onChange={setEmail} autoComplete="email" />
            </>
          )}
          <Field
            label="비밀번호"
            name="password"
            type="password"
            placeholder="8자 이상 입력해주세요"
            value={password}
            onChange={setPassword}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          {error && <p role="alert" className="auth-error">{error}</p>}
          {notice && <p role="status" className="auth-notice">{notice}</p>}

          <Button type="submit" className="mt-2 w-full" disabled={submitting}>
            {submitting ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
          </Button>
        </form>

        <div className="auth-help">
          <span>{mode === "login" ? "아직 계정이 없나요?" : "이미 계정이 있나요?"}</span>
          <button type="button" onClick={() => switchMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "회원가입" : "로그인"}
          </button>
        </div>
      </div>
    </div>
  );
}

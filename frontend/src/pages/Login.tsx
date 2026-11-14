import Logo from "../components/Logo";

// TODO: feature/ui-auth 에서 구현 (로그인/회원가입 탭, 폼, api.auth.login 연결)
export default function Login() {
  return (
    <div className="mobile-shell flex flex-col items-center justify-center gap-6 p-6">
      <Logo />
      <p className="text-sm text-[#65716c]">로그인 화면 (구현 예정)</p>
    </div>
  );
}

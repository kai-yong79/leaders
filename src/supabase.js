import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export let configurationError = "";
if (!url || !key)
  configurationError = "Supabase 연결 설정이 아직 준비되지 않았습니다.";
else {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:")
      throw new Error("Supabase 주소는 https://로 시작해야 합니다.");
    let publicKey = key.startsWith("sb_publishable_");
    if (key.startsWith("eyJ")) {
      const payload = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      publicKey = JSON.parse(atob(payload)).role === "anon";
    }
    if (!publicKey)
      throw new Error(
        "Publishable 공개용 키를 사용해 주세요. Secret 또는 service_role 키는 사용할 수 없습니다.",
      );
  } catch (error) {
    configurationError =
      error.message || "Supabase 주소와 공개용 키를 확인해 주세요.";
  }
}
export const supabase = configurationError
  ? null
  : createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });

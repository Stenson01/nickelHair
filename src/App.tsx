import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import MyTopAppBar from "./components/MyTopAppBar";
import MyProductList from "./components/MyProductList";
import { isSupabaseConfigured } from "./services/supabase/client";
import { supabaseService } from "./services/supabase/service";
import { useLanguage } from "./i18n/useLanguage";
import "./App.css";

export default function App() {
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;

    void supabaseService.getCurrentUser().then(({ data, error }) => {
      if (!isMounted) return;

      if (error) {
        console.error("Unable to fetch the current Supabase user:", error.message);
        return;
      }

      setCurrentUser(data.user);
    }).catch((error: unknown) => {
      if (isMounted) {
        console.error("Unable to fetch the current Supabase user:", error);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <MyTopAppBar currentUser={currentUser} />
      <main className="app-main">
        {currentUser?.email && (
          <p className="app-account-status">{t("signedInAs")} {currentUser.email}</p>
        )}
        <MyProductList />
      </main>
    </>
  );
}